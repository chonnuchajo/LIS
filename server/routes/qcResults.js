const express = require("express");
const router = express.Router();
const mongoose = require('mongoose');
const QCTestResult = require("../models/QCTestResult");
const Parameter = require("../models/Parameter");
const Petition = require("../models/Petition");
const { scheduleOrUnlockPhase2 } = require("../lib/phaseAdvance");
const PetitionAuditLog = require('../models/PetitionAuditLog');
const { qcResultAuditEvent, qcResultNote } = require('../lib/auditEvents');
const { isEnumAbnormal, isNumericAbnormal, isFieldAbnormal, isLabelToleranceAbnormal } = require('../lib/abnormal');

// mirror of src/lib/parameterValidation.ts getEntryValues / fieldValueList — keep in sync
function getEntryValuesJS(result, param) {
  if (param && param.multiEntry) {
    const e = result.entries;
    return Array.isArray(e) && e.length ? e : [{}];
  }
  return [result.values || {}];
}

function fieldValueListJS(values, field) {
  if (field.multiple) {
    const v = values[field.label];
    return Array.isArray(v) ? v : [];
  }
  return [values[field.label]];
}

// mirror of src/lib/substances.ts matchSubstanceKey: first whitespace token, lowercased
function matchSubstanceKeyJS(name) {
  const first = String(name || "").trim().split(/\s+/)[0];
  return first ? first.toLowerCase() : "";
}

function parseLabelPercentJS(raw) {
  const m = String(raw == null ? "" : raw).match(/(\d+(?:\.\d+)?)\s*%/);
  return m ? Number(m[1]) : null;
}

const CLASSIFICATION_CODES = [
  ['ULV', 'water'], ['EC', 'water'], ['EW', 'water'], ['SC', 'water'], ['SL', 'water'], ['ME', 'water'], ['ZC', 'water'], ['W/V', 'water'],
  ['W/W', 'sand'], ['WP', 'powder'], ['WDG', 'powder'], ['WG', 'powder'], ['GR', 'sand'], ['ST', 'sand'], ['GB', 'sand'], ['SP', 'powder'], ['DS', 'powder'], ['DP', 'powder'],
];

function productTypeFromSpecJS(raw) {
  const upperValue = String(raw || "").trim().toUpperCase();
  for (const [code, group] of CLASSIFICATION_CODES.sort((a, b) => b[0].length - a[0].length)) {
    const pattern = new RegExp(`(^|[^A-Z0-9])${code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^A-Z0-9]|$)`);
    if (pattern.test(upperValue)) return group;
  }
  return "";
}

function normalizeCategoryJS(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized === "RM" || normalized === "FG" ? normalized : "";
}

function categoryFromDeptJS(value) {
  const dept = String(value || "").trim().toLowerCase();
  if (dept === "rm") return "RM";
  if (dept === "fg") return "FG";
  return normalizeCategoryJS(value);
}

// mirror of src/lib/parameterValidation.ts isSubstanceAbnormal: build a virtual field, reuse isNumericAbnormal
function isSubstanceAbnormalJS(field, std, value) {
  if (!std || !std.operator || std.value == null) return false;
  return isNumericAbnormal(
    { ...field, standardOperator: std.operator, standardValue: std.value, standardValue2: std.value2 ?? null },
    value,
  );
}

function findSubstanceStandardJS(field, rawSpec, productType, category) {
  const subKey = matchSubstanceKeyJS(rawSpec);
  const wantedProductType = String(productType || productTypeFromSpecJS(rawSpec) || "").trim();
  const wantedCategory = normalizeCategoryJS(category);
  let best = null;
  for (const std of field.substanceStandards || []) {
    if (matchSubstanceKeyJS(std.substance) !== subKey) continue;
    const productTypes = Array.isArray(std.productTypes) ? std.productTypes.filter(Boolean) : [];
    const categories = Array.isArray(std.categories) ? std.categories.map(normalizeCategoryJS).filter(Boolean) : [];
    if (productTypes.length > 0 && (!wantedProductType || !productTypes.includes(wantedProductType))) continue;
    if (categories.length > 0 && (!wantedCategory || !categories.includes(wantedCategory))) continue;
    const score = (productTypes.length > 0 ? 2 : 0) + (categories.length > 0 ? 2 : 0);
    if (!best || score > best.score) best = { std, score };
  }
  return best ? best.std : undefined;
}

function visibleSubstanceStandardJS(field, rawSpec, includeRestricted, productType, category) {
  const std = findSubstanceStandardJS(field, rawSpec, productType, category);
  if (!std) return undefined;
  if (!includeRestricted && std.headOnly) return undefined;
  return std;
}

function findLabelToleranceStandardJS(field, rawSpec, productType) {
  const subKey = matchSubstanceKeyJS(rawSpec);
  const labelPercent = parseLabelPercentJS(rawSpec);
  const wantedProductType = String(productType || "").trim();
  let best = null;
  for (const std of field.labelToleranceStandards || []) {
    const substance = String(std.substance || '').trim();
    const stdProductTypes = Array.isArray(std.productTypes) ? std.productTypes.filter(Boolean) : [];
    const wantsSubstance = substance.length > 0;
    const wantsPercent = std.labelPercent != null;
    const wantsProductType = stdProductTypes.length > 0;
    if (wantsSubstance && matchSubstanceKeyJS(substance) !== subKey) continue;
    if (wantsPercent && labelPercent !== std.labelPercent) continue;
    if (wantsProductType && (!wantedProductType || !stdProductTypes.includes(wantedProductType))) continue;
    const score = (wantsPercent ? 4 : 0) + (wantsProductType ? 2 : 0) + (wantsSubstance ? 1 : 0);
    if (!best || score > best.score) best = { std, score };
  }
  return best ? best.std : undefined;
}
// รวม rawSpec (มี %) จาก commonName โดย split "+" แล้ว match ด้วย first-token key
function rawSpecForSubKey(commonName, subKey) {
  const parts = String(commonName || "").split("+").map((s) => s.trim()).filter(Boolean);
  return parts.find((p) => matchSubstanceKeyJS(p) === subKey) || "";
}

// mirror of src/lib/parameterValidation.ts evalCondition / resolveStandard — keep in sync
function conditionSourceValueJS(cond, ctx) {
  if (cond.sourceParameterId) {
    return (ctx.otherParams[String(cond.sourceParameterId)] || {})[cond.sourceFieldLabel];
  }
  return ctx.sameParam[cond.sourceFieldLabel];
}

function evalConditionJS(cond, ctx) {
  const raw = conditionSourceValueJS(cond, ctx);
  if (raw === null || raw === undefined || raw === "") return false;
  const target = cond.value;
  if (cond.op === "eq" || cond.op === "ne") {
    const tNum = typeof target === "number" ? target : Number(target);
    const rNum = Number(raw);
    const numericPair = target !== "" && !Number.isNaN(tNum) && !Number.isNaN(rNum);
    const equal = numericPair ? rNum === tNum : String(raw) === String(target);
    return cond.op === "eq" ? equal : !equal;
  }
  const n = Number(raw);
  const t = typeof target === "number" ? target : Number(target);
  if (Number.isNaN(n) || Number.isNaN(t)) return false;
  if (cond.op === "gt") return n > t;
  if (cond.op === "gte") return n >= t;
  if (cond.op === "lt") return n < t;
  if (cond.op === "lte") return n <= t;
  if (cond.op === "between") {
    const t2 = cond.value2 == null ? NaN : Number(cond.value2);
    if (Number.isNaN(t2)) return false;
    return n >= t && n <= t2;
  }
  return false;
}

function resolveFieldStandardJS(field, ctx) {
  if (!field.conditionalMode) return field;
  for (const rule of field.conditionalStandards || []) {
    const matched = (rule.conditions || []).every((c) => evalConditionJS(c, ctx));
    if (matched) {
      return { ...field, conditionalMode: false, standardOperator: rule.operator, standardValue: rule.value, standardValue2: rule.value2 == null ? null : rule.value2 };
    }
  }
  return { ...field, conditionalMode: false, standardOperator: undefined, standardValue: null, standardValue2: null };
}

// mirror of src/lib/parameterValidation.ts resolveConditionalOutput — keep in sync
function resolveConditionalOutputJS(field, ctx) {
  if (!field.conditionalMode || field.conditionalResult !== "output") return null;
  const selfVal = ctx.sameParam[field.label];
  if (selfVal === null || selfVal === undefined || selfVal === "") return null;
  for (const rule of field.conditionalStandards || []) {
    if ((rule.conditions || []).every((c) => evalConditionJS(c, ctx))) {
      return {
        text: (rule.outputText && String(rule.outputText).trim()) || rule.label || "",
        kind: rule.outputKind || "normal",
      };
    }
  }
  return { text: "", kind: "abnormal" };
}

// GET /api/qc-results/testers?petitionIds=id1,id2,...
// Returns a map of petitionId → unique tester names (from enteredBy/updatedBy)
router.get("/testers", async (req, res) => {
  try {
    const raw = String(req.query.petitionIds || "").trim();
    if (!raw) return res.json({});
    const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) return res.json({});

    const docs = await QCTestResult.find(
      { petitionId: { $in: ids } },
      { petitionId: 1, enteredBy: 1, updatedBy: 1 }
    ).lean();

    const map = {};
    for (const id of ids) map[id] = [];
    const seen = {};
    for (const id of ids) seen[id] = new Set();

    // Show only the current owner (= latest editor) of each doc.
    // Matches what the detail page displays per field, so list ↔ detail are consistent.
    for (const d of docs) {
      const pid = d.petitionId;
      const name = d.updatedBy?.name || d.enteredBy?.name;
      if (name && !seen[pid].has(name)) {
        seen[pid].add(name);
        map[pid].push(name);
      }
    }
    res.json(map);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/qc-results/progress?petitionIds=id1,id2,...
// Returns map of petitionId → [{ itemSeq, parameterId, filledLabels }] so the
// client can compute filled vs. required totals (denominator needs Parameter
// metadata that the QCTestResult collection doesn't carry).
router.get("/progress", async (req, res) => {
  try {
    const raw = String(req.query.petitionIds || "").trim();
    if (!raw) return res.json({});
    const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) return res.json({});

    const docs = await QCTestResult.find(
      { petitionId: { $in: ids } },
      { petitionId: 1, itemSeq: 1, parameterId: 1, values: 1, entries: 1 }
    ).lean();

    const paramIds = Array.from(new Set(docs.map((d) => String(d.parameterId))));
    const params = paramIds.length
      ? await Parameter.find({ _id: { $in: paramIds } }, { valueFields: 1, multiEntry: 1 }).lean()
      : [];
    const paramById = new Map(params.map((p) => [String(p._id), p]));

    const map = {};
    for (const id of ids) map[id] = [];
    for (const d of docs) {
      const param = paramById.get(String(d.parameterId)) || {};
      const labels = new Set();
      for (const values of getEntryValuesJS(d, param)) {
        for (const [k, v] of Object.entries(values)) {
          // a field counts as filled if any entry/element carries a non-empty value
          if (Array.isArray(v)) {
            if (v.some((x) => x != null && String(x).trim() !== "")) labels.add(k);
          } else if (v != null && String(v).trim() !== "") {
            labels.add(k);
          }
        }
      }
      const bucket = map[d.petitionId];
      if (bucket) {
        bucket.push({
          itemSeq: d.itemSeq,
          parameterId: String(d.parameterId),
          filledLabels: Array.from(labels),
        });
      }
    }
    res.json(map);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/qc-results/abnormal-flags?petitionIds=id1,id2,...
// Returns map of petitionId → boolean (true if any field in any result is abnormal).
router.get("/abnormal-flags", async (req, res) => {
  try {
    const includeRestricted = String(req.query.includeRestricted || "").trim() === "1";
    const raw = String(req.query.petitionIds || "").trim();
    if (!raw) return res.json({});
    const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) return res.json({});

    const docs = await QCTestResult.find(
      { petitionId: { $in: ids } },
      { petitionId: 1, parameterId: 1, itemSeq: 1, commonName: 1, values: 1, entries: 1 }
    ).lean();

    const paramIds = Array.from(new Set(docs.map((d) => String(d.parameterId))));
    const params = paramIds.length
      ? await Parameter.find({ _id: { $in: paramIds } }, { valueFields: 1, multiEntry: 1 }).lean()
      : [];
    const paramById = new Map(params.map((p) => [String(p._id), p]));

    const petitions = await Petition.find(
      { _id: { $in: ids } },
      { dept: 1, items: 1 },
    ).lean();
    const categoryByItem = {};
    for (const petition of petitions) {
      const category = categoryFromDeptJS(petition.dept);
      for (const item of petition.items || []) {
        categoryByItem[`${String(petition._id)}__${item.seq}`] = category;
      }
    }

    const valuesByItem = {};   // `${petitionId}__${itemSeq}` -> { [parameterId]: values }
    for (const d of docs) {
      const key = `${d.petitionId}__${d.itemSeq}`;
      if (!valuesByItem[key]) valuesByItem[key] = {};
      const param = paramById.get(String(d.parameterId));
      valuesByItem[key][String(d.parameterId)] = getEntryValuesJS(d, param || {})[0] || {};
    }

    const map = {};
    for (const id of ids) map[id] = false;

    for (const d of docs) {
      if (map[d.petitionId]) continue;
      const param = paramById.get(String(d.parameterId));
      if (!param?.valueFields?.length) continue;
      const ctxBucket = valuesByItem[`${d.petitionId}__${d.itemSeq}`] || {};
      let flagged = false;
      for (const values of getEntryValuesJS(d, param)) {
        for (const field of param.valueFields) {
          const isNumeric = field.type === "number" || field.type === "float";
          if (field.substanceMode && isNumeric) {
            const prefix = `${field.label}::`;
            for (const [vkey, vval] of Object.entries(values)) {
              if (!vkey.startsWith(prefix)) continue;
              const subKey = vkey.slice(prefix.length);
              const raw = rawSpecForSubKey(d.commonName, subKey) || subKey;
              const productType = productTypeFromSpecJS(raw) || productTypeFromSpecJS(d.commonName);
              const category = categoryByItem[`${d.petitionId}__${d.itemSeq}`] || "";
              const std = visibleSubstanceStandardJS(field, raw, includeRestricted, productType, category);
              if (isSubstanceAbnormalJS(field, std, vval)) { flagged = true; break; }
            }
            if (flagged) break;
            continue;
          }
          if (field.labelToleranceMode && isNumeric) {
            const prefix = `${field.label}::`;
            for (const [vkey, vval] of Object.entries(values)) {
              if (!vkey.startsWith(prefix)) continue;
              const subKey = vkey.slice(prefix.length);
              const raw = rawSpecForSubKey(d.commonName, subKey);
              const productType = productTypeFromSpecJS(raw) || productTypeFromSpecJS(d.commonName);
              const std = findLabelToleranceStandardJS(field, raw, productType);
              if (isLabelToleranceAbnormal(std, raw, vval)) { flagged = true; break; }
            }
            if (flagged) break;
            continue;
          }
          if (field.conditionalMode && field.conditionalResult === "output" && isNumeric) {
            const out = resolveConditionalOutputJS(field, { sameParam: values, otherParams: ctxBucket });
            if (out && out.kind === "abnormal") { flagged = true; break; }
            continue;
          }
          const vf = field.conditionalMode && isNumeric
            ? resolveFieldStandardJS(field, { sameParam: values, otherParams: ctxBucket })
            : field;
          for (const v of fieldValueListJS(values, field)) {
            if (isFieldAbnormal(vf, v)) { flagged = true; break; }
          }
          if (flagged) break;
        }
        if (flagged) break;
      }
      if (flagged) map[d.petitionId] = true;
    }

    res.json(map);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/qc-results/last-values?commonName=&parameterId=&excludePetitionId=
// คืนผลตรวจล่าสุดก่อนหน้าของ common name + parameter เดียวกัน (ไม่รวม petition ปัจจุบัน)
router.get("/last-values", async (req, res) => {
  try {
    const commonName = String(req.query.commonName || "").trim();
    const parameterId = String(req.query.parameterId || "").trim();
    const excludePetitionId = String(req.query.excludePetitionId || "").trim();
    if (!commonName || !parameterId) return res.json({});

    const filter = { commonName, parameterId };
    if (excludePetitionId) filter.petitionId = { $ne: excludePetitionId };

    const doc = await QCTestResult.findOne(filter)
      .sort({ enteredAt: -1, updatedAt: -1 })
      .lean();

    if (!doc) return res.json({});
    res.json({ petitionNo: doc.petitionNo, enteredAt: doc.enteredAt, values: doc.values || {} });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/qc-results/:petitionId
router.get("/:petitionId", async (req, res) => {
  try {
    const results = await QCTestResult.find({ petitionId: req.params.petitionId }).lean();
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/qc-results — upsert a single field value
router.put("/", async (req, res) => {
  try {
    const {
      petitionId, petitionNo,
      itemSeq, sampleId, sampleName, commonName,
      parameterId, parameterName,
      fieldLabel, value, entryIndex,
      enteredBy,
      phase, // 1 = Phase 1 (default), 2 = Phase 2 (after)
    } = req.body;

    if (!petitionId || itemSeq == null || !parameterId || !fieldLabel) {
      return res.status(400).json({ error: "petitionId, itemSeq, parameterId, fieldLabel are required" });
    }

    // sanity ceiling — entries are "unlimited" in practice but guard against runaway padding
    if (entryIndex != null && (!Number.isInteger(entryIndex) || entryIndex < 0 || entryIndex > 1000)) {
      return res.status(400).json({ error: "entryIndex อยู่นอกช่วงที่อนุญาต (0–1000)" });
    }

    // Reject saves for reference fields — their value is computed, not entered
    const paramForCheck = await Parameter.findById(parameterId).lean();
    const fieldDef = paramForCheck?.valueFields?.find((f) => f.label === fieldLabel);
    if (fieldDef?.type === 'reference') {
      return res.status(400).json({ error: "ช่องนี้ดึงค่าจาก parameter อื่นโดยอัตโนมัติ — บันทึกไม่ได้" });
    }

    const phaseNum = phase === 2 ? 2 : 1;
    const valuesKey = phaseNum === 2 ? "valuesPhase2" : "values";

    const filter = { petitionId, itemSeq, parameterId };
    const now = new Date();

    const existing = await QCTestResult.findOne(filter);
    const isNew = !existing;

    const baseSet = {
      petitionNo, sampleId, sampleName, commonName, parameterName,
      updatedBy: enteredBy,
      updatedAt: now,
    };
    if (isNew || !existing?.enteredBy) {
      baseSet.enteredBy = enteredBy;
      baseSet.enteredAt = now;
    }

    let existingFieldValue;
    const update = { $set: baseSet };

    if (phaseNum === 1 && Number.isInteger(entryIndex) && entryIndex >= 0) {
      // multiEntry write: read-modify-write the entries array (avoids dot-path
      // numeric-index creating an object instead of an array)
      const entries = Array.isArray(existing?.entries)
        ? existing.entries.map((e) => ({ ...(e || {}) }))
        : [];
      while (entries.length <= entryIndex) entries.push({});
      existingFieldValue = entries[entryIndex][fieldLabel];
      entries[entryIndex][fieldLabel] = value;
      update.$set.entries = entries;
    } else {
      existingFieldValue = existing?.[valuesKey]?.[fieldLabel];
      update.$set[`${valuesKey}.${fieldLabel}`] = value;
    }

    const doc = await QCTestResult.findOneAndUpdate(filter, update, {
      upsert: true,
      new: true,
    });

    // ลง audit log ระดับ field ทุกครั้งที่บันทึก (fire-and-forget — ไม่ให้กระทบการบันทึกค่า)
    const auditEvent = qcResultAuditEvent({ existingFieldValue });
    const petitionObjId = mongoose.Types.ObjectId.isValid(petitionId)
      ? new mongoose.Types.ObjectId(petitionId)
      : undefined;
    if (petitionObjId) {
      PetitionAuditLog.create({
        petitionId: petitionObjId,
        petitionNo,
        event: auditEvent,
        actor: enteredBy?.name || enteredBy?.email || 'system',
        note: qcResultNote(auditEvent, { parameterName, parameterId, fieldLabel, sampleName }),
        metadata: { itemSeq, sampleName, commonName, parameterId, parameterName, fieldLabel, phase: phaseNum, entryIndex },
      }).catch((err) => {
        console.error('[audit-log] qc-result write failed:', err.message);
      });
    }

    // If this field has triggersPhase2 and was filled in Phase 1, schedule advance
    if (phaseNum === 1 && fieldDef?.triggersPhase2 && paramForCheck) {
      try {
        await scheduleOrUnlockPhase2({
          petitionId,
          parameter: paramForCheck,
          field: fieldDef,
          fieldLabel,
          value,
          itemSeq,
        });
      } catch (e) {
        console.error("[phase-advance] schedule failed:", e.message);
      }
    }

    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/qc-results/entries — replace the whole entries array (multiEntry add/remove)
router.put("/entries", async (req, res) => {
  try {
    const {
      petitionId, petitionNo, itemSeq, sampleId, sampleName, commonName,
      parameterId, parameterName, entries, enteredBy,
    } = req.body;
    if (!petitionId || itemSeq == null || !parameterId || !Array.isArray(entries)) {
      return res.status(400).json({ error: "petitionId, itemSeq, parameterId, entries[] required" });
    }
    if (entries.length > 1001) {
      return res.status(400).json({ error: "entries เกินจำนวนที่อนุญาต" });
    }
    const filter = { petitionId, itemSeq, parameterId };
    const now = new Date();
    const existing = await QCTestResult.findOne(filter);
    const update = {
      $set: {
        petitionNo, sampleId, sampleName, commonName, parameterName,
        entries, updatedBy: enteredBy, updatedAt: now,
      },
    };
    if (!existing || !existing.enteredBy) {
      update.$set.enteredBy = enteredBy;
      update.$set.enteredAt = now;
    }
    const doc = await QCTestResult.findOneAndUpdate(filter, update, { upsert: true, new: true });

    // audit (fire-and-forget) — entries array was replaced (add/remove/edit of multiEntry rows).
    // entry removal deletes recorded data, so it must be audited. event is enum-constrained
    // (see PetitionAuditLog) — reuse 'resultUpdated' and put the detail in the note.
    const petitionObjId = mongoose.Types.ObjectId.isValid(petitionId)
      ? new mongoose.Types.ObjectId(petitionId)
      : undefined;
    if (petitionObjId) {
      PetitionAuditLog.create({
        petitionId: petitionObjId,
        petitionNo,
        event: 'resultUpdated',
        actor: enteredBy?.name || enteredBy?.email || 'system',
        note: `QC ปรับรายการหลายค่า ${parameterName || parameterId}: ${entries.length} รายการ${sampleName ? ` (${sampleName})` : ''}`,
        metadata: { itemSeq, sampleName, commonName, parameterId, parameterName, entryCount: entries.length },
      }).catch((err) => {
        console.error('[audit-log] qc-result entries write failed:', err.message);
      });
    }

    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
