const express = require('express');
const fs = require('fs');
const router = express.Router();
const { StockStandard, StockSolvent, StockGlassware } = require('../models/Stock');
const StockTransaction = require('../models/StockTransaction');
const ChemicalRequisition = require('../models/ChemicalRequisition');
const StockUnit = require('../models/StockUnit');
const User = require('../models/User');
const crypto = require('crypto');
const { isValidReceiveType, isValidUnitType } = require('../lib/stockSource');
const { sumWeights } = require('../lib/requisitionWeights');
const { normalizeActorFields } = require('../lib/stockActor');
const { buildLotBottleNumbers } = require('../lib/stockLotBottle');
const { buildStandardLabelCodeDefaults, formatStandardLabelCode, parseStandardLabelCode, standardLabelCodePrefix } = require('../lib/stockStandardLabelCode');
const {
  validateStandardUnitReceiveInput,
  validateSolventReceiveInput,
  composeSolventReceiveNote,
  normalizePhotoUrls,
  normalizeBottlePhotoUrls,
} = require('../lib/stockReceiveValidation');
const {
  buildPendingDeductionFilter,
  normalizeDeductionResolutionInput,
} = require('../lib/deductionResolution');
const { buildInUseItems, canAcknowledgeDeduction } = require('../lib/standardsInUse');
const {
  buildStandardExportDateRange,
  buildStandardLotExportHtml,
  buildStandardLotExportWorkbook,
  buildSolventRequisitionDoc,
  dateStamp,
  sanitizeFilenameSegment,
} = require('../lib/stockHistoryExport');

async function genUniqueQrId() {
  for (let i = 0; i < 5; i++) {
    const id = 'u_' + crypto.randomBytes(6).toString('hex'); // u_ + 12 hex
    const exists = await StockUnit.exists({ qrId: id });
    if (!exists) return id;
  }
  throw new Error('ไม่สามารถสร้าง qrId ที่ไม่ซ้ำได้');
}

function normalizeDefaultLabelCodeCount(value) {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1) return 1;
  return Math.min(count, 200);
}

async function standardLabelCodeDefaults(std, count, now = new Date()) {
  const units = await StockUnit.find({ itemCode: std.code, labelCode: { $exists: true, $nin: ['', null] } })
    .select('labelCode')
    .lean();
  return buildStandardLabelCodeDefaults(std.code, units, { count: normalizeDefaultLabelCodeCount(count), now });
}

function duplicateLabelCode(labelCodes) {
  const seen = new Set();
  for (const code of labelCodes) {
    if (seen.has(code)) return code;
    seen.add(code);
  }
  return '';
}

async function resolveReceiveLabelCodes(std, bottles, now = new Date()) {
  const parsed = bottles.map((bottle) => {
    const raw = bottle && bottle.labelCode;
    if (raw == null || String(raw).trim() === '') return null;
    const parsedCode = parseStandardLabelCode(raw, std.code);
    if (!parsedCode) {
      const prefix = standardLabelCodePrefix(std.code);
      const sample = formatStandardLabelCode(std.code, (now.getFullYear() + 543) % 100, 1);
      throw new Error(`Code ต้องขึ้นต้นด้วย ${prefix} และตามด้วยปี/เลขขวด เช่น ${sample}`);
    }
    return parsedCode.labelCode;
  });

  const providedCodes = new Set(parsed.filter(Boolean));
  const defaults = await standardLabelCodeDefaults(std, bottles.length + providedCodes.size, now);
  let defaultIndex = 0;
  const labelCodes = parsed.map((code) => {
    if (code) return code;
    while (providedCodes.has(defaults.codes[defaultIndex])) defaultIndex += 1;
    const next = defaults.codes[defaultIndex];
    defaultIndex += 1;
    return next;
  });

  const duplicateInRequest = duplicateLabelCode(labelCodes);
  if (duplicateInRequest) throw new Error(`Code ${duplicateInRequest} ซ้ำในรายการรับเข้า`);

  const existing = await StockUnit.findOne({ itemCode: std.code, labelCode: { $in: labelCodes } })
    .select('labelCode')
    .lean();
  if (existing) throw new Error(`Code ${existing.labelCode} ถูกใช้แล้ว`);

  return labelCodes;
}

function normalizeUnitLabelCodeUpdate(labelCode, itemCode) {
  const rawLabelCode = String(labelCode ?? '').trim().toUpperCase();
  if (!rawLabelCode) return '';
  const parsedCode = parseStandardLabelCode(rawLabelCode, itemCode);
  if (!parsedCode) {
    const prefix = standardLabelCodePrefix(itemCode);
    throw new Error(`Code ต้องขึ้นต้นด้วย ${prefix} และตามด้วยปี/เลขขวด เช่น ${prefix}6901`);
  }
  return parsedCode.labelCode;
}

async function personOf(req) {
  const m = await userMeta(req);
  return m.userName ? { email: m.userEmail, name: m.userName } : undefined;
}

const TIERS = ['primary', 'supplier', 'working'];
const RECEIVE_BARCODE_MODELS = {
  standard: StockStandard,
  solvent: StockSolvent,
  glassware: StockGlassware,
};

function normalizeReceiveBarcode(value) {
  return String(value || '').trim();
}

function receiveBarcodePayload(category, item, barcode) {
  return {
    barcode,
    category,
    itemId: item._id.toString(),
    itemCode: item.code || '',
    itemName: item.name || '',
    barcodes: item.barcodes || [],
  };
}

async function findReceiveBarcodeOwner(barcode) {
  for (const [category, Model] of Object.entries(RECEIVE_BARCODE_MODELS)) {
    const item = await Model.findOne({ barcodes: barcode }).lean();
    if (item) return { category, item };
  }
  return null;
}

function requestHeader(req, name) {
  return req.get?.(name) || req.headers?.[String(name).toLowerCase()] || '';
}

async function userMeta(req) {
  if (req._stockUserMeta) return req._stockUserMeta;
  const raw = {
    email: req.body?._user?.email || requestHeader(req, 'x-user-email') || requestHeader(req, 'x-lis-user') || '',
    name: req.body?._user?.name || requestHeader(req, 'x-user-name') || '',
  };
  const email = String(raw.email || '').trim().toLowerCase();
  const stored = email ? await User.findOne({ email }).lean() : null;
  const actor = normalizeActorFields(raw, stored || {});
  req._stockUserMeta = { userEmail: actor.email, userName: actor.name };
  return req._stockUserMeta;
}

async function logTransaction(data) {
  try {
    await StockTransaction.create(data);
  } catch (err) {
    console.error('logTransaction failed:', err.message);
  }
}

function normalizeExportDate(value) {
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function contentDispositionFilename(filename) {
  const fallback = String(filename || 'stock-export')
    .replace(/[^ -~]+/g, '_')
    .replace(/[\"]/g, '_') || 'stock-export';
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function sendAttachment(res, { buffer, contentType, filename }) {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', contentDispositionFilename(filename));
  return res.send(buffer);
}

const RESOLUTION_REASON_LABELS = {
  empty: 'หมด',
  ineffective: 'ไม่มีประสิทธิภาพ',
  other: 'อื่นๆ',
};

async function applyUnitResolutionFromTransaction(tx, resolution, req) {
  // "รับทราบหมดอายุ" = สารละลายที่เตรียมไว้ครบกำหนด ไม่ใช่ขวดต้นทางมีปัญหา → ห้ามแตะขวด
  if (resolution.reason === 'expired') return null;
  if (tx.itemType !== 'standard' || !tx.qrId) return null;

  const unit = await StockUnit.findOne({ qrId: tx.qrId });
  if (!unit) throw new Error('ไม่พบขวด (QR)');

  if (resolution.reason === 'empty') {
    if (unit.status !== 'discarded') unit.status = 'empty';
  } else if (unit.status !== 'discarded') {
    unit.status = 'discarded';
    unit.discardedAt = new Date();
    unit.discardedBy = await personOf(req);
    unit.discardReason = resolution.note || RESOLUTION_REASON_LABELS[resolution.reason];
  }

  await unit.save();
  return unit;
}

function stripMeta(body) {
  if (!body) return body;
  const { _user, ...rest } = body;
  return rest;
}

function solventItemPayload(body = {}) {
  const payload = {};
  if (body.name !== undefined) payload.name = String(body.name);
  if (body.sizeLiter !== undefined) {
    const sizeLiter = Number(body.sizeLiter);
    payload.sizeLiter = Number.isFinite(sizeLiter) && sizeLiter > 0 ? sizeLiter : 0;
  }
  if (body.price !== undefined) {
    const price = Number(body.price);
    payload.price = Number.isFinite(price) && price >= 0 ? price : 0;
  }
  if (body.note !== undefined) payload.note = String(body.note);
  return payload;
}

function requireWholeBottleCount(value) {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1) return null;
  return count;
}

function solventVolumeMl(sizeLiter) {
  const liters = Number(sizeLiter);
  return Number.isFinite(liters) && liters > 0 ? liters * 1000 : 0;
}

async function createSolventUnitsForReceive({ item, qty, lotNo, exp, sizeLiter, photoUrls, receivedDate, createdBy }) {
  const itemId = item._id.toString();
  const normalizedLotNo = String(lotNo || '').trim();
  const existingLotBottleCount = normalizedLotNo
    ? await StockUnit.countDocuments({ itemType: 'solvent', itemId, kind: 'sealed', lotNo: normalizedLotNo })
    : 0;
  const lotBottleNumbers = buildLotBottleNumbers(existingLotBottleCount, qty);
  const volumeMl = solventVolumeMl(sizeLiter);
  const created = [];

  for (let index = 0; index < qty; index += 1) {
    const qrId = await genUniqueQrId();
    const unit = await StockUnit.create({
      qrId,
      itemType: 'solvent',
      itemId,
      itemCode: itemId,
      itemName: item.name,
      kind: 'sealed',
      type: '',
      lotNo: normalizedLotNo,
      lotBottleNo: lotBottleNumbers[index],
      exp: new Date(exp),
      volume: { initial: volumeMl, remaining: volumeMl, unit: 'ml' },
      status: 'active',
      receivedDate,
      createdBy,
      photoUrls: photoUrls.length ? photoUrls : undefined,
    });
    created.push(unit);
  }

  return created;
}

async function markSolventUnitsEmptyForDeduction(item, qty) {
  const count = Math.floor(Number(qty));
  if (!Number.isFinite(count) || count < 1) return;
  const itemId = item._id.toString();
  const units = await StockUnit.find({ itemType: 'solvent', itemId, status: 'active' })
    .sort({ receivedDate: 1, createdAt: 1, _id: 1 })
    .limit(count);
  for (const unit of units) {
    unit.status = 'empty';
    if (unit.volume) unit.volume.remaining = 0;
    await unit.save();
  }
}

// Pure: can this unit give up `mg`? (no DB) — shared by the endpoint and the
// lab-completion settle validator so both agree on the rules.
function planDeductMg(unit, mg) {
  const amount = Number(mg);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, reason: 'จำนวน mg ไม่ถูกต้อง' };
  if (!unit || unit.status !== 'active') return { ok: false, reason: 'ขวดนี้ใช้งานต่อไม่ได้' };
  if (unit.exp && new Date(unit.exp).getTime() < Date.now()) return { ok: false, reason: 'ขวดนี้หมดอายุแล้ว' };
  const remaining = Number(unit.volume && unit.volume.remaining) || 0;
  if (remaining < amount) return { ok: false, reason: 'ปริมาณคงเหลือไม่พอ' };
  return { ok: true, after: remaining - amount };
}

// Atomic: หัก mg จาก volume.remaining ของขวด (กัน race ด้วย $gte). โยน Error ถ้าไม่ผ่าน.
async function deductMgFromUnit(qrId, mg, meta = {}) {
  const amount = Number(mg);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('จำนวน mg ไม่ถูกต้อง');
  const unit = await StockUnit.findOne({ qrId });
  if (!unit) throw new Error('ไม่พบขวด (QR)');
  const plan = planDeductMg(unit, amount);
  if (!plan.ok) throw new Error(plan.reason);
  const updated = await StockUnit.findOneAndUpdate(
    { qrId, status: 'active', 'volume.remaining': { $gte: amount } },
    { $inc: { 'volume.remaining': -amount } },
    { new: true },
  );
  if (!updated) throw new Error('ปริมาณคงเหลือไม่พอ');
  const before = updated.volume.remaining + amount; // pre-decrement value, atomically consistent
  if (updated.volume.remaining <= 0) { updated.status = 'empty'; await updated.save(); }
  const std = await StockStandard.findOne({ code: updated.itemCode });
  await logTransaction({
    itemType: 'standard',
    itemId: std ? std._id.toString() : updated.itemCode,
    itemCode: updated.itemCode,
    itemName: updated.itemName,
    action: 'deduct',
    unitId: updated._id.toString(),
    qrId,
    volumeDelta: -amount,
    volumeUnit: 'mg',
    unit: 'mg',
    beforeQty: before,
    afterQty: updated.volume.remaining,
    weights: meta.weights,
    instrumentId: meta.instrumentId,
    instrumentName: meta.instrumentName,
    instrumentGroup: meta.instrumentGroup,
    sampleId: meta.sampleId,
    note: meta.note,
    userEmail: meta.userEmail,
    userName: meta.userName,
  });
  return { unit: updated, before, after: updated.volume.remaining };
}

function publicStockUnitPayload(unit) {
  return {
    kind: 'standard',
    qrId: unit.qrId,
    itemCode: unit.itemCode,
    itemName: unit.itemName,
    type: unit.type || 'primary',
    lotNo: unit.lotNo || '',
    lotBottleNo: unit.lotBottleNo || null,
    labelCode: unit.labelCode || '',
    exp: unit.exp || null,
    volume: unit.volume,
    status: unit.status,
    photoUrls: unit.photoUrls || [],
    updatedAt: unit.updatedAt,
  };
}

function publicSolventPayload(solvent, latestReceive) {
  return {
    kind: 'solvent',
    id: solvent._id.toString(),
    qrId: solvent._id.toString(),
    name: solvent.name,
    sizeLiter: solvent.sizeLiter,
    qty: solvent.qty,
    note: solvent.note || '',
    photoUrls: latestReceive?.photoUrls || [],
    latestReceiveNote: latestReceive?.note || '',
    updatedAt: solvent.updatedAt,
  };
}

router.get('/public/:qrId', async (req, res) => {
  try {
    const qrId = String(req.params.qrId || '').trim();
    if (!qrId) return res.status(400).json({ error: 'missing qrId' });

    const unit = await StockUnit.findOne({ qrId }).lean();
    if (unit) return res.json(publicStockUnitPayload(unit));

    let solvent = null;
    try {
      solvent = await StockSolvent.findById(qrId).lean();
    } catch {
      solvent = null;
    }
    if (solvent) {
      const latestReceive = await StockTransaction.findOne({
        itemType: 'solvent',
        itemId: solvent._id.toString(),
        action: 'receive',
        photoUrls: { $exists: true, $ne: [] },
      }).sort({ createdAt: -1 }).lean();
      return res.json(publicSolventPayload(solvent, latestReceive));
    }

    return res.status(404).json({ error: 'ไม่พบรายการ stock จาก QR นี้' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* ==================== RECEIVE BARCODES ==================== */

router.post('/barcodes/register', async (req, res) => {
  try {
    const barcode = normalizeReceiveBarcode(req.body?.barcode);
    const category = String(req.body?.category || '').trim();
    const itemId = String(req.body?.itemId || '').trim();
    const Model = RECEIVE_BARCODE_MODELS[category];

    if (!barcode) return res.status(400).json({ error: 'ต้องระบุ Barcode' });
    if (!Model) return res.status(400).json({ error: 'ประเภท Barcode ไม่ถูกต้อง' });
    if (!itemId) return res.status(400).json({ error: 'ต้องเลือกรายการ stock' });

    const item = await Model.findById(itemId);
    if (!item) return res.status(404).json({ error: 'ไม่พบรายการ stock' });

    const owner = await findReceiveBarcodeOwner(barcode);
    if (owner) {
      const ownerId = owner.item._id.toString();
      if (owner.category !== category || ownerId !== item._id.toString()) {
        return res.status(409).json({ error: 'Barcode นี้ถูกลงทะเบียนกับรายการอื่นแล้ว' });
      }
    }

    if (!Array.isArray(item.barcodes)) item.barcodes = [];
    if (!item.barcodes.includes(barcode)) {
      item.barcodes.push(barcode);
      await item.save();
    }

    return res.json(receiveBarcodePayload(category, item, barcode));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

/* ==================== STANDARDS ==================== */

router.get('/standards', async (req, res) => {
  try {
    res.json(await StockStandard.find().sort({ code: 1 }).collation({ locale: 'en', numericOrdering: true }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// standard ที่เบิกไปแล้วยังไม่ปิด + วันครบกำหนดตามความถี่ (แท็บ "กำลังใช้งานอยู่")
// ต้องอยู่เหนือ '/standards/:id' ไม่งั้นจะถูกจับเป็น id
router.get('/standards/in-use', async (req, res) => {
  try {
    const built = buildPendingDeductionFilter({ itemType: 'standard' });
    if (built.error) return res.status(400).json({ error: built.error });
    const txs = await StockTransaction.find(built.value)
      .select('itemCode itemName qrId weights volumeDelta instrumentGroup note createdAt userEmail userName')
      // เก่าสุดก่อน — ถ้าเกิน limit แถวที่หลุดต้องเป็นแถวใหม่สุด ไม่ใช่แถวที่เกินกำหนดนานสุด
      .sort({ createdAt: 1 })
      .limit(500)
      .lean();
    const codes = [...new Set(txs.map((t) => t.itemCode).filter(Boolean))];
    const standards = codes.length
      ? await StockStandard.find({ code: { $in: codes } }).select('code frequency').lean()
      : [];
    res.json({ serverTime: new Date().toISOString(), items: buildInUseItems(txs, standards) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/standards/:id/label-codes/defaults', async (req, res) => {
  try {
    const std = await StockStandard.findById(req.params.id);
    if (!std) return res.status(404).json({ error: 'Not found' });
    const count = normalizeDefaultLabelCodeCount(req.query.count);
    const defaults = await standardLabelCodeDefaults(std, count);
    res.json(defaults);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/standards/:id', async (req, res) => {
  try {
    const item = await StockStandard.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/standards', async (req, res) => {
  try {
    const body = stripMeta(req.body);
    const item = await StockStandard.create(body);
    await logTransaction({
      itemType: 'standard',
      itemId: item._id.toString(),
      itemCode: item.code,
      itemName: item.name,
      action: 'create',
      afterQty: item.primary?.qty ?? 0,
      unit: 'bottle',
      ...(await userMeta(req)),
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/standards/:id', async (req, res) => {
  try {
    const body = stripMeta(req.body);
    const before = await StockStandard.findById(req.params.id);
    if (!before) return res.status(404).json({ error: 'Not found' });
    const item = await StockStandard.findByIdAndUpdate(req.params.id, body, { new: true });
    const codeChanged = String(before.code || '') !== String(item.code || '');
    const nameChanged = String(before.name || '') !== String(item.name || '');
    if (codeChanged || nameChanged) {
      await StockUnit.updateMany(
        { itemCode: before.code },
        { $set: { itemCode: item.code, itemName: item.name } },
      );
    }
    await logTransaction({
      itemType: 'standard',
      itemId: item._id.toString(),
      itemCode: item.code,
      itemName: item.name,
      action: 'update',
      beforeQty: before.primary?.qty ?? 0,
      afterQty: item.primary?.qty ?? 0,
      delta: (item.primary?.qty ?? 0) - (before.primary?.qty ?? 0),
      unit: 'bottle',
      ...(await userMeta(req)),
    });
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/standards/:id', async (req, res) => {
  try {
    const actor = req.query.actor || (req.body && req.body.actor) || 'system';
    const item = await StockStandard.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    await item.softDelete(actor);
    await logTransaction({
      itemType: 'standard',
      itemId: item._id.toString(),
      itemCode: item.code,
      itemName: item.name,
      action: 'delete',
      beforeQty: item.primary?.qty ?? 0,
      ...(await userMeta(req)),
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Deduct: { tier: 'primary'|'supplier'|'working', qty: number, sampleId?, note? }
router.post('/standards/:id/deduct', async (req, res) => {
  try {
    const { tier = 'primary', qty, sampleId, note } = req.body;
    if (!TIERS.includes(tier)) return res.status(400).json({ error: 'Invalid tier' });
    const amount = Number(qty);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Invalid qty' });

    const item = await StockStandard.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });

    const before = item[tier]?.qty ?? 0;
    if (before < amount) return res.status(400).json({ error: 'จำนวน stock ไม่พอ' });

    item[tier].qty = before - amount;
    await item.save();

    await logTransaction({
      itemType: 'standard',
      itemId: item._id.toString(),
      itemCode: item.code,
      itemName: item.name,
      action: 'deduct',
      tier,
      beforeQty: before,
      afterQty: item[tier].qty,
      delta: -amount,
      unit: 'bottle',
      sampleId,
      note,
      ...(await userMeta(req)),
    });

    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// หัก mg จากขวดตรงๆ: { mg?, weights?[], instrumentGroup?, instrumentId?, instrumentName?, sampleId?, petitionNo?, note? }
router.post('/units/:qrId/deduct-mg', async (req, res) => {
  try {
    const { mg, weights, instrumentId, instrumentName, instrumentGroup, sampleId, petitionNo, note } = req.body || {};
    const amount = Array.isArray(weights) && weights.length ? sumWeights(weights) : mg;
    const meta = {
      weights: Array.isArray(weights) ? weights.map(Number) : undefined,
      instrumentId, instrumentName, sampleId,
      // กัน audit หาย: ค่านอก enum → undefined (default null)
      instrumentGroup: instrumentGroup === 'gc' || instrumentGroup === 'hplc' ? instrumentGroup : undefined,
      note: [petitionNo, note].filter(Boolean).join(' · '),
      ...(await userMeta(req)),
    };
    const result = await deductMgFromUnit(req.params.qrId, amount, meta);
    res.json(result.unit);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Receive: { tier, qty, note? }
router.post('/standards/:id/receive', async (req, res) => {
  try {
    const { tier = 'primary', qty, note } = req.body;
    if (!TIERS.includes(tier)) return res.status(400).json({ error: 'Invalid tier' });
    const amount = Number(qty);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Invalid qty' });

    const item = await StockStandard.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });

    const before = item[tier]?.qty ?? 0;
    item[tier].qty = before + amount;
    await item.save();

    await logTransaction({
      itemType: 'standard',
      itemId: item._id.toString(),
      itemCode: item.code,
      itemName: item.name,
      action: 'receive',
      tier,
      beforeQty: before,
      afterQty: item[tier].qty,
      delta: amount,
      unit: 'bottle',
      note,
      ...(await userMeta(req)),
    });

    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ==================== STANDARD UNITS (per-bottle) ==================== */

// รับเข้าหลายขวด: { lotNo?, sizeMl, unit?, type: 'primary'|'supplier'|'working', bottles: [{ exp }], note? }
router.post('/standards/:id/units/receive', async (req, res) => {
  try {
    const std = await StockStandard.findById(req.params.id);
    if (!std) return res.status(404).json({ error: 'ไม่พบสาร' });

    const { lotNo = '', purity = '', sizeMl, unit = 'mg', bottles, type, note } = req.body || {};
    const size = Number(sizeMl);
    if (!Number.isFinite(size) || size <= 0) return res.status(400).json({ error: 'ขนาด/ขวดไม่ถูกต้อง' });
    if (!Array.isArray(bottles) || bottles.length === 0) return res.status(400).json({ error: 'ต้องระบุอย่างน้อย 1 ขวด' });
    if (!isValidReceiveType(type)) return res.status(400).json({ error: 'ต้องเลือกประเภท (primary, supplier หรือ working)' });
    const validationError = validateStandardUnitReceiveInput(req.body || {});
    if (validationError) return res.status(400).json({ error: validationError });

    const now = new Date();
    const normalizedLotNo = String(lotNo).trim();
    const normalizedPurity = String(purity).trim();
    const existingLotBottleCount = normalizedLotNo
      ? await StockUnit.countDocuments({ itemCode: std.code, kind: 'sealed', lotNo: normalizedLotNo })
      : 0;
    const lotBottleNumbers = buildLotBottleNumbers(existingLotBottleCount, bottles.length);
    const labelCodes = await resolveReceiveLabelCodes(std, bottles, now);
    const created = [];
    for (const [index, b] of bottles.entries()) {
      const qrId = await genUniqueQrId();
      const photoUrls = normalizeBottlePhotoUrls(b);
      const u = await StockUnit.create({
        qrId,
        itemCode: std.code,
        itemName: std.name,
        itemType: 'standard',
        itemId: std._id.toString(),
        kind: 'sealed',
        type,
        lotNo: normalizedLotNo,
        purity: normalizedPurity,
        lotBottleNo: lotBottleNumbers[index],
        labelCode: labelCodes[index],
        exp: new Date(b.exp),
        volume: { initial: size, remaining: size, unit },
        status: 'active',
        receivedDate: now,
        createdBy: await personOf(req),
        photoUrls: photoUrls.length ? photoUrls : undefined,
      });
      created.push(u);
      await logTransaction({
        itemType: 'standard',
        itemId: std._id.toString(),
        itemCode: std.code,
        itemName: std.name,
        action: 'receive',
        unitId: u._id.toString(),
        qrId,
        afterQty: size,
        volumeDelta: size,
        volumeUnit: unit,
        unit,
        note,
        photoUrls: photoUrls.length ? photoUrls : undefined,
        ...(await userMeta(req)),
      });
    }
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// แจ้งสถานะขวด: POST /units/:qrId/discard { reason?, outcome? }
// outcome='empty' → หมด (status=empty); ไม่งั้น → discarded + เหตุผล
router.post('/units/:qrId/discard', async (req, res) => {
  try {
    const unit = await StockUnit.findOne({ qrId: req.params.qrId });
    if (!unit) return res.status(404).json({ error: 'ไม่พบขวด' });
    if (unit.status === 'discarded') return res.status(400).json({ error: 'ขวดนี้ถูกทิ้งแล้ว' });

    const reason = (req.body && req.body.reason) || '';
    const outcome = (req.body && req.body.outcome) === 'empty' ? 'empty' : 'discard';
    const std = await StockStandard.findOne({ code: unit.itemCode });

    if (outcome === 'empty') {
      unit.status = 'empty';
      await unit.save();
      await logTransaction({
        itemType: 'standard', itemId: std ? std._id.toString() : unit.itemCode,
        itemCode: unit.itemCode, itemName: unit.itemName, action: 'update',
        unitId: unit._id.toString(), qrId: unit.qrId, note: reason || 'แจ้งหมด', ...(await userMeta(req)),
      });
      return res.json({ status: 'empty', qrId: unit.qrId });
    }

    unit.status = 'discarded';
    unit.discardedAt = new Date();
    unit.discardedBy = await personOf(req);
    unit.discardReason = reason;
    await unit.save();
    await logTransaction({
      itemType: 'standard', itemId: std ? std._id.toString() : unit.itemCode,
      itemCode: unit.itemCode, itemName: unit.itemName, action: 'discard',
      unitId: unit._id.toString(), qrId: unit.qrId, note: reason, ...(await userMeta(req)),
    });
    res.json({ status: 'discarded', qrId: unit.qrId });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// แก้ข้อมูลรายขวด (เติม EXP/lot/ปริมาณ ให้ขวดที่ย้ายข้อมูลเดิมมา): PATCH /units/:qrId
router.patch('/units/:qrId', async (req, res) => {
  try {
    const unit = await StockUnit.findOne({ qrId: req.params.qrId });
    if (!unit) return res.status(404).json({ error: 'ไม่พบขวด' });
    if (unit.status === 'discarded') return res.status(400).json({ error: 'ขวดนี้ถูกทิ้งแล้ว แก้ไขไม่ได้' });

    const { lotNo, exp, volume, type, photoUrls, labelCode } = req.body || {};
    if (lotNo !== undefined) unit.lotNo = String(lotNo);
    if (exp !== undefined) unit.exp = exp ? new Date(exp) : null;
    if (type !== undefined && isValidUnitType(type)) unit.type = type;
    if (photoUrls !== undefined) unit.photoUrls = normalizePhotoUrls(photoUrls);
    if (labelCode !== undefined) {
      const nextLabelCode = normalizeUnitLabelCodeUpdate(labelCode, unit.itemCode);
      if (nextLabelCode) {
        const existing = await StockUnit.findOne({
          _id: { $ne: unit._id },
          itemCode: unit.itemCode,
          labelCode: nextLabelCode,
        }).select('labelCode').lean();
        if (existing) throw new Error(`Code ${nextLabelCode} ถูกใช้แล้ว`);
        unit.labelCode = nextLabelCode;
      } else {
        unit.labelCode = '';
      }
    }
    if (volume && typeof volume === 'object') {
      if (volume.unit !== undefined && ['ml', 'mg', 'g'].includes(volume.unit)) unit.volume.unit = volume.unit;
      if (volume.initial !== undefined) {
        const init = Number(volume.initial);
        if (Number.isFinite(init) && init >= 0) unit.volume.initial = init;
      }
      if (volume.remaining !== undefined) {
        const rem = Number(volume.remaining);
        if (Number.isFinite(rem) && rem >= 0) unit.volume.remaining = rem;
      }
    }
    // กันสถานะค้าง: ปรับ active/empty ตามคงเหลือ (ไม่ยุ่งกับขวดที่ถูกทิ้ง — กันไว้ด้านบนแล้ว)
    if (unit.volume.remaining <= 0) unit.status = 'empty';
    else if (unit.status === 'empty') unit.status = 'active';
    await unit.save();
    res.json(unit);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// list units: GET /units?itemCode=&status=&kind=
router.get('/units', async (req, res) => {
  try {
    const { itemCode, itemType, itemId, status, kind } = req.query;
    const f = {};
    if (itemCode) f.itemCode = itemCode;
    if (itemType) f.itemType = String(itemType).trim();
    if (itemId) f.itemId = String(itemId).trim();
    if (status) f.status = status;
    if (kind) f.kind = kind;
    const units = await StockUnit.find(f).sort({ createdAt: -1 }).limit(2000);
    res.json(units);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// get by qrId: GET /units/:qrId  (ปลายทางสแกน)
router.get('/units/:qrId', async (req, res) => {
  try {
    const unit = await StockUnit.findOne({ qrId: req.params.qrId });
    if (!unit) return res.status(404).json({ error: 'ไม่พบขวด' });
    res.json(unit);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ==================== SOLVENTS ==================== */

router.get('/solvents', async (req, res) => {
  try {
    res.json(await StockSolvent.find().sort({ name: 1 }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/solvents', async (req, res) => {
  try {
    const body = solventItemPayload(stripMeta(req.body));
    const item = await StockSolvent.create({ ...body, qty: 0 });
    await logTransaction({
      itemType: 'solvent',
      itemId: item._id.toString(),
      itemName: item.name,
      action: 'create',
      afterQty: item.qty,
      unit: 'bottle',
      ...(await userMeta(req)),
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/solvents/:id', async (req, res) => {
  try {
    const body = solventItemPayload(stripMeta(req.body));
    const before = await StockSolvent.findById(req.params.id);
    if (!before) return res.status(404).json({ error: 'Not found' });
    const item = await StockSolvent.findByIdAndUpdate(req.params.id, body, { new: true });
    await logTransaction({
      itemType: 'solvent',
      itemId: item._id.toString(),
      itemName: item.name,
      action: 'update',
      beforeQty: before.qty,
      afterQty: item.qty,
      delta: item.qty - before.qty,
      unit: 'bottle',
      ...(await userMeta(req)),
    });
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/solvents/:id', async (req, res) => {
  try {
    const actor = req.query.actor || (req.body && req.body.actor) || 'system';
    const item = await StockSolvent.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    await item.softDelete(actor);
    await logTransaction({
      itemType: 'solvent',
      itemId: item._id.toString(),
      itemName: item.name,
      action: 'delete',
      beforeQty: item.qty,
      ...(await userMeta(req)),
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/solvents/:id/deduct', async (req, res) => {
  try {
    const { qty, sampleId, note } = req.body;
    const amount = Number(qty);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Invalid qty' });
    const item = await StockSolvent.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    const before = item.qty;
    if (before < amount) return res.status(400).json({ error: 'จำนวน stock ไม่พอ' });
    item.qty = before - amount;
    await item.save();
    await markSolventUnitsEmptyForDeduction(item, amount);
    await logTransaction({
      itemType: 'solvent',
      itemId: item._id.toString(),
      itemName: item.name,
      action: 'deduct',
      beforeQty: before,
      afterQty: item.qty,
      delta: -amount,
      unit: 'bottle',
      sampleId,
      note,
      ...(await userMeta(req)),
    });
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/solvents/:id/receive', async (req, res) => {
  try {
    const { qty, note, lotNo, exp, sizeLiter, price, photoUrls: rawPhotoUrls } = req.body;
    const amount = requireWholeBottleCount(qty);
    if (!amount) return res.status(400).json({ error: 'จำนวนขวดต้องเป็นจำนวนเต็มบวก' });
    const validationError = validateSolventReceiveInput(req.body || {});
    if (validationError) return res.status(400).json({ error: validationError });
    const item = await StockSolvent.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    const before = item.qty;
    item.qty = before + amount;
    item.sizeLiter = Number(sizeLiter);
    item.price = Number(price);
    await item.save();
    const photoUrls = normalizePhotoUrls(rawPhotoUrls);
    const receivedDate = new Date();
    const meta = await userMeta(req);
    const createdBy = meta.userName ? { email: meta.userEmail, name: meta.userName } : undefined;
    await createSolventUnitsForReceive({ item, qty: amount, lotNo, exp, sizeLiter, photoUrls, receivedDate, createdBy });
    await logTransaction({
      itemType: 'solvent',
      itemId: item._id.toString(),
      itemName: item.name,
      action: 'receive',
      beforeQty: before,
      afterQty: item.qty,
      delta: amount,
      unit: 'bottle',
      note: composeSolventReceiveNote({ lotNo, exp, sizeLiter, price, note }),
      photoUrls: photoUrls.length ? photoUrls : undefined,
      ...meta,
    });
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ==================== GLASSWARE ==================== */

router.get('/glassware', async (req, res) => {
  try {
    res.json(await StockGlassware.find().sort({ name: 1 }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/glassware', async (req, res) => {
  try {
    const body = stripMeta(req.body);
    const item = await StockGlassware.create(body);
    await logTransaction({
      itemType: 'glassware',
      itemId: item._id.toString(),
      itemName: item.name,
      action: 'create',
      afterQty: item.qty,
      unit: 'piece',
      ...(await userMeta(req)),
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/glassware/:id', async (req, res) => {
  try {
    const body = stripMeta(req.body);
    const before = await StockGlassware.findById(req.params.id);
    if (!before) return res.status(404).json({ error: 'Not found' });
    const item = await StockGlassware.findByIdAndUpdate(req.params.id, body, { new: true });
    await logTransaction({
      itemType: 'glassware',
      itemId: item._id.toString(),
      itemName: item.name,
      action: 'update',
      beforeQty: before.qty,
      afterQty: item.qty,
      delta: item.qty - before.qty,
      unit: 'piece',
      ...(await userMeta(req)),
    });
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/glassware/:id', async (req, res) => {
  try {
    const actor = req.query.actor || (req.body && req.body.actor) || 'system';
    const item = await StockGlassware.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    await item.softDelete(actor);
    await logTransaction({
      itemType: 'glassware',
      itemId: item._id.toString(),
      itemName: item.name,
      action: 'delete',
      beforeQty: item.qty,
      ...(await userMeta(req)),
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/glassware/:id/deduct', async (req, res) => {
  try {
    const { qty, sampleId, note } = req.body;
    const amount = Number(qty);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Invalid qty' });
    const item = await StockGlassware.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    const before = item.qty;
    if (before < amount) return res.status(400).json({ error: 'จำนวน stock ไม่พอ' });
    item.qty = before - amount;
    await item.save();
    await logTransaction({
      itemType: 'glassware',
      itemId: item._id.toString(),
      itemName: item.name,
      action: 'deduct',
      beforeQty: before,
      afterQty: item.qty,
      delta: -amount,
      unit: 'piece',
      sampleId,
      note,
      ...(await userMeta(req)),
    });
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/glassware/:id/receive', async (req, res) => {
  try {
    const { qty, note } = req.body;
    const amount = Number(qty);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Invalid qty' });
    const item = await StockGlassware.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    const before = item.qty;
    item.qty = before + amount;
    await item.save();
    await logTransaction({
      itemType: 'glassware',
      itemId: item._id.toString(),
      itemName: item.name,
      action: 'receive',
      beforeQty: before,
      afterQty: item.qty,
      delta: amount,
      unit: 'piece',
      note,
      ...(await userMeta(req)),
    });
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ==================== STOCK HISTORY EXPORTS ==================== */

router.get('/exports/standard', async (req, res) => {
  try {
    const itemId = String(req.query.itemId || '').trim();
    const dateRange = buildStandardExportDateRange(req.query.startDate, req.query.endDate);
    const format = String(req.query.format || 'xlsx').trim().toLowerCase();
    if (!itemId) return res.status(400).json({ error: 'ต้องเลือก standard' });
    if (dateRange.error) return res.status(400).json({ error: dateRange.error });
    if (!['xlsx', 'pdf'].includes(format)) return res.status(400).json({ error: 'รองรับเฉพาะ xlsx หรือ pdf' });

    const standard = await StockStandard.findById(itemId).lean();
    if (!standard) return res.status(404).json({ error: 'ไม่พบ standard' });

    const transactions = await StockTransaction.find({
      itemType: 'standard',
      action: { $in: ['receive', 'deduct'] },
      createdAt: dateRange.value.createdAt,
      $or: [
        { itemId: standard._id.toString() },
        { itemCode: standard.code },
      ],
    })
      .sort({ createdAt: 1, _id: 1 })
      .limit(5000)
      .lean();

    const qrIds = [...new Set(transactions.map((tx) => tx.qrId).filter(Boolean))];
    const units = qrIds.length
      ? await StockUnit.find({ qrId: { $in: qrIds } })
        .select('qrId lotNo lotBottleNo exp volume type')
        .lean()
      : [];

    const safeCode = sanitizeFilenameSegment(standard.code || standard.name || 'standard');
    const baseFilename = `${safeCode}-standard-history-${dateRange.value.startDate}_to_${dateRange.value.endDate}-${dateStamp()}`;

    if (format === 'pdf') {
      const html = buildStandardLotExportHtml({ standard, units, transactions });
      if (!html) return res.status(400).json({ error: 'ไม่มีประวัติสำหรับ standard นี้' });

      const chromePath = process.env.PRINT_CHROME_PATH;
      if (!chromePath || !fs.existsSync(chromePath)) {
        return res.status(400).json({ error: 'ไม่พบ Chrome สำหรับสร้าง PDF (ตั้งค่า PRINT_CHROME_PATH)' });
      }

      const puppeteer = require('puppeteer-core');
      let browser;
      try {
        browser = await puppeteer.launch({
          executablePath: chromePath,
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
        const page = await browser.newPage();
        await page.setContent(html.toString('utf8'), { waitUntil: 'load', timeout: 20000 });
        await page.evaluateHandle('document.fonts.ready').catch(() => {});
        const pdf = await page.pdf({
          printBackground: true,
          preferCSSPageSize: true,
          margin: { top: '8mm', right: '8mm', bottom: '8mm', left: '8mm' },
        });
        await browser.close();
        browser = null;
        return sendAttachment(res, {
          buffer: Buffer.from(pdf),
          contentType: 'application/pdf',
          filename: `${baseFilename}.pdf`,
        });
      } finally {
        if (browser) await browser.close().catch(() => {});
      }
    }

    const workbook = buildStandardLotExportWorkbook({ standard, units, transactions });
    if (!workbook) return res.status(400).json({ error: 'ไม่มีประวัติสำหรับ standard นี้' });

    return sendAttachment(res, {
      buffer: workbook.buffer,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `${baseFilename}.xlsx`,
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.get('/exports/solvent', async (req, res) => {
  try {
    const solventId = String(req.query.solventId || '').trim();
    const date = normalizeExportDate(req.query.date);
    if (!solventId) return res.status(400).json({ error: 'ต้องเลือกสารเคมี' });
    if (!date) return res.status(400).json({ error: 'ต้องเลือกวันที่' });

    const solvent = await StockSolvent.findById(solventId).lean();
    if (!solvent) return res.status(404).json({ error: 'ไม่พบสารเคมี' });

    const requisitions = await ChemicalRequisition.find({ solventId: solvent._id.toString(), date })
      .sort({ createdAt: 1, _id: 1 })
      .limit(1000)
      .lean();
    if (requisitions.length === 0) return res.status(400).json({ error: 'ไม่มีประวัติเบิกสารเคมีตามวันที่เลือก' });

    const doc = buildSolventRequisitionDoc({ solvent, date, requisitions });
    const safeName = sanitizeFilenameSegment(solvent.name || 'solvent');
    return sendAttachment(res, {
      buffer: doc,
      contentType: 'application/msword; charset=utf-8',
      filename: `${safeName}-requisition-${date}.doc`,
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});
/* ==================== TRANSACTIONS (Audit Log) ==================== */

router.get('/transactions/pending-deduction', async (req, res) => {
  try {
    const built = buildPendingDeductionFilter(req.query || {});
    if (built.error) return res.status(400).json({ error: built.error });
    const txs = await StockTransaction.find(built.value)
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    res.json(txs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/transactions/:id/resolve-deduction', async (req, res) => {
  try {
    const norm = normalizeDeductionResolutionInput(req.body || {});
    if (norm.error) return res.status(400).json({ error: norm.error });

    const tx = await StockTransaction.findById(req.params.id);
    if (!tx) return res.status(404).json({ error: 'ไม่พบรายการเบิก' });
    if (tx.action !== 'deduct' || !['standard', 'solvent'].includes(tx.itemType)) {
      return res.status(400).json({ error: 'รองรับเฉพาะรายการเบิก Standard และสารเคมี' });
    }

    const actor = await userMeta(req);
    if (norm.value.reason === 'expired' && !canAcknowledgeDeduction(tx, actor.userEmail)) {
      return res.status(403).json({ error: 'รับทราบได้เฉพาะคนที่เบิก' });
    }

    await applyUnitResolutionFromTransaction(tx, norm.value, req);
    tx.deductionResolution = {
      ...norm.value,
      resolvedAt: new Date(),
      resolvedBy: { email: actor.userEmail, name: actor.userName },
    };
    await tx.save();
    res.json(tx);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/transactions', async (req, res) => {
  try {
    const { itemType, itemId, qrId, action, createdFrom, createdTo, limit = 200, skip = 0 } = req.query;
    const filter = {};
    if (itemType) filter.itemType = itemType;
    if (itemId) filter.itemId = itemId;
    if (qrId) filter.qrId = String(qrId).trim();
    if (action) filter.action = action;
    if (createdFrom || createdTo) {
      filter.createdAt = {};
      if (createdFrom) {
        const from = new Date(createdFrom);
        if (Number.isNaN(from.getTime())) return res.status(400).json({ error: 'Invalid createdFrom' });
        filter.createdAt.$gte = from;
      }
      if (createdTo) {
        const to = new Date(createdTo);
        if (Number.isNaN(to.getTime())) return res.status(400).json({ error: 'Invalid createdTo' });
        filter.createdAt.$lt = to;
      }
    }
    const txs = await StockTransaction.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(Math.max(0, Number.parseInt(skip, 10) || 0))
      .limit(Math.min(Number(limit) || 200, 1000))
      .lean();
    const missingNameEmails = [...new Set(txs
      .filter((tx) => !normalizeActorFields({ email: tx.userEmail, name: tx.userName }).name && tx.userEmail)
      .map((tx) => String(tx.userEmail).trim().toLowerCase()))];
    const users = missingNameEmails.length
      ? await User.find({ email: { $in: missingNameEmails } }).lean()
      : [];
    const userByEmail = new Map(users.map((user) => [String(user.email).trim().toLowerCase(), user]));
    res.json(txs.map((tx) => {
      const actor = normalizeActorFields(
        { email: tx.userEmail, name: tx.userName },
        userByEmail.get(String(tx.userEmail || '').trim().toLowerCase()) || {},
      );
      return { ...tx, userEmail: actor.email || tx.userEmail, userName: actor.name || tx.userName };
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
router.planDeductMg = planDeductMg;
router.userMeta = userMeta;
router.deductMgFromUnit = deductMgFromUnit;
router.normalizeUnitLabelCodeUpdate = normalizeUnitLabelCodeUpdate;
