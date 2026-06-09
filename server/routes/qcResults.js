const express = require("express");
const router = express.Router();
const QCTestResult = require("../models/QCTestResult");
const Parameter = require("../models/Parameter");
const { scheduleOrUnlockPhase2 } = require("../lib/phaseAdvance");

// Mirrors src/lib/parameterValidation.ts — keep in sync if rules change.
function isEnumAbnormal(field, value) {
  if (field.type !== "enum") return false;
  const expected = field.expectedValues || [];
  if (expected.length === 0) return false;
  if (value === null || value === undefined) return false;
  const str = String(value);
  if (str === "") return false;
  return !expected.includes(str);
}

function isNumericAbnormal(field, value) {
  if (field.type !== "number" && field.type !== "float") return false;
  if (!field.standardOperator) return false;
  if (field.standardValue == null) return false;
  if (value === null || value === undefined || value === "") return false;
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return false;
  const v1 = field.standardValue;
  const v2 = field.standardValue2;
  switch (field.standardOperator) {
    case "lt": return num >= v1;
    case "lte": return num > v1;
    case "eq": return num !== v1;
    case "gte": return num < v1;
    case "gt": return num <= v1;
    case "between":
      if (v2 == null) return false;
      return num < v1 || num > v2;
    case "tolerance":
      if (v2 == null || v2 <= 0) return false;
      return Math.abs(num - v1) > Math.abs(v1) * (v2 / 100);
    default:
      return false;
  }
}

function isFieldAbnormal(field, value) {
  return isEnumAbnormal(field, value) || isNumericAbnormal(field, value);
}

// mirror of src/lib/substances.ts matchSubstanceKey: first whitespace token, lowercased
function matchSubstanceKeyJS(name) {
  const first = String(name || "").trim().split(/\s+/)[0];
  return first ? first.toLowerCase() : "";
}

// mirror of src/lib/parameterValidation.ts isSubstanceAbnormal: build a virtual field, reuse isNumericAbnormal
function isSubstanceAbnormalJS(field, std, value) {
  if (!std || !std.operator || std.value == null) return false;
  return isNumericAbnormal(
    { ...field, standardOperator: std.operator, standardValue: std.value, standardValue2: std.value2 ?? null },
    value,
  );
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
      { petitionId: 1, itemSeq: 1, parameterId: 1, values: 1 }
    ).lean();

    const map = {};
    for (const id of ids) map[id] = [];
    for (const d of docs) {
      const filledLabels = Object.entries(d.values || {})
        .filter(([, v]) => v != null && String(v).trim() !== "")
        .map(([k]) => k);
      const bucket = map[d.petitionId];
      if (bucket) {
        bucket.push({
          itemSeq: d.itemSeq,
          parameterId: String(d.parameterId),
          filledLabels,
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
    const raw = String(req.query.petitionIds || "").trim();
    if (!raw) return res.json({});
    const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) return res.json({});

    const docs = await QCTestResult.find(
      { petitionId: { $in: ids } },
      { petitionId: 1, parameterId: 1, itemSeq: 1, values: 1 }
    ).lean();

    const paramIds = Array.from(new Set(docs.map((d) => String(d.parameterId))));
    const params = paramIds.length
      ? await Parameter.find({ _id: { $in: paramIds } }, { valueFields: 1 }).lean()
      : [];
    const paramById = new Map(params.map((p) => [String(p._id), p]));

    const valuesByItem = {};   // `${petitionId}__${itemSeq}` -> { [parameterId]: values }
    for (const d of docs) {
      const key = `${d.petitionId}__${d.itemSeq}`;
      if (!valuesByItem[key]) valuesByItem[key] = {};
      valuesByItem[key][String(d.parameterId)] = d.values || {};
    }

    const map = {};
    for (const id of ids) map[id] = false;

    for (const d of docs) {
      if (map[d.petitionId]) continue;
      const param = paramById.get(String(d.parameterId));
      if (!param?.valueFields?.length) continue;
      const values = d.values || {};
      for (const field of param.valueFields) {
        const isNumeric = field.type === "number" || field.type === "float";
        if (field.substanceMode && isNumeric) {
          const prefix = `${field.label}::`;
          let flagged = false;
          for (const [vkey, vval] of Object.entries(values)) {
            if (!vkey.startsWith(prefix)) continue;
            const subKey = vkey.slice(prefix.length);
            const std = (field.substanceStandards || []).find(
              (s) => matchSubstanceKeyJS(s.substance) === subKey,
            );
            if (isSubstanceAbnormalJS(field, std, vval)) { flagged = true; break; }
          }
          if (flagged) { map[d.petitionId] = true; break; }
          continue;
        }
        if (field.conditionalMode && isNumeric) {
          const ctx = { sameParam: values, otherParams: valuesByItem[`${d.petitionId}__${d.itemSeq}`] || {} };
          const vf = resolveFieldStandardJS(field, ctx);
          if (isFieldAbnormal(vf, values[field.label])) { map[d.petitionId] = true; break; }
          continue;
        }
        if (isFieldAbnormal(field, values[field.label])) {
          map[d.petitionId] = true;
          break;
        }
      }
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
      fieldLabel, value,
      enteredBy,
      phase, // 1 = Phase 1 (default), 2 = Phase 2 (after)
    } = req.body;

    if (!petitionId || itemSeq == null || !parameterId || !fieldLabel) {
      return res.status(400).json({ error: "petitionId, itemSeq, parameterId, fieldLabel are required" });
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

    const update = {
      $set: {
        petitionNo, sampleId, sampleName, commonName, parameterName,
        [`${valuesKey}.${fieldLabel}`]: value,
        updatedBy: enteredBy,
        updatedAt: now,
      },
    };

    if (isNew || !existing.enteredBy) {
      update.$set.enteredBy = enteredBy;
      update.$set.enteredAt = now;
    }

    const doc = await QCTestResult.findOneAndUpdate(filter, update, {
      upsert: true,
      new: true,
    });

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

module.exports = router;
