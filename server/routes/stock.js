const express = require('express');
const router = express.Router();
const { StockStandard, StockSolvent, StockGlassware } = require('../models/Stock');
const StockTransaction = require('../models/StockTransaction');
const StockUnit = require('../models/StockUnit');
const crypto = require('crypto');
const { isValidReceiveType, isValidUnitType } = require('../lib/stockSource');
const { sumWeights } = require('../lib/requisitionWeights');

async function genUniqueQrId() {
  for (let i = 0; i < 5; i++) {
    const id = 'u_' + crypto.randomBytes(6).toString('hex'); // u_ + 12 hex
    const exists = await StockUnit.exists({ qrId: id });
    if (!exists) return id;
  }
  throw new Error('ไม่สามารถสร้าง qrId ที่ไม่ซ้ำได้');
}

function personOf(req) {
  const m = userMeta(req);
  return m.userName ? { email: m.userEmail, name: m.userName } : undefined;
}

const TIERS = ['primary', 'supplier', 'working'];

function userMeta(req) {
  return {
    userEmail: req.body?._user?.email || req.headers['x-user-email'] || '',
    userName: req.body?._user?.name || req.headers['x-user-name'] || '',
  };
}

async function logTransaction(data) {
  try {
    await StockTransaction.create(data);
  } catch (err) {
    console.error('logTransaction failed:', err.message);
  }
}

function stripMeta(body) {
  if (!body) return body;
  const { _user, ...rest } = body;
  return rest;
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
    sampleId: meta.sampleId,
    note: meta.note,
    userEmail: meta.userEmail,
    userName: meta.userName,
  });
  return { unit: updated, before, after: updated.volume.remaining };
}

/* ==================== STANDARDS ==================== */

router.get('/standards', async (req, res) => {
  try {
    res.json(await StockStandard.find().sort({ code: 1 }).collation({ locale: 'en', numericOrdering: true }));
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
      ...userMeta(req),
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
      ...userMeta(req),
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
      ...userMeta(req),
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
      ...userMeta(req),
    });

    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// หัก mg จากขวดตรงๆ: { mg?, weights?[], instrumentId?, instrumentName?, sampleId?, petitionNo?, note? }
router.post('/units/:qrId/deduct-mg', async (req, res) => {
  try {
    const { mg, weights, instrumentId, instrumentName, sampleId, petitionNo, note } = req.body || {};
    const amount = Array.isArray(weights) && weights.length ? sumWeights(weights) : mg;
    const meta = {
      weights: Array.isArray(weights) ? weights.map(Number) : undefined,
      instrumentId, instrumentName, sampleId,
      note: [petitionNo, note].filter(Boolean).join(' · '),
      ...userMeta(req),
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
      ...userMeta(req),
    });

    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ==================== STANDARD UNITS (per-bottle) ==================== */

// รับเข้าหลายขวด: { lotNo?, sizeMl, unit?, source: 'primary'|'supply', bottles: [{ exp }], note? }
router.post('/standards/:id/units/receive', async (req, res) => {
  try {
    const std = await StockStandard.findById(req.params.id);
    if (!std) return res.status(404).json({ error: 'ไม่พบสาร' });

    const { lotNo = '', sizeMl, unit = 'ml', bottles, type, note } = req.body || {};
    const size = Number(sizeMl);
    if (!Number.isFinite(size) || size <= 0) return res.status(400).json({ error: 'ขนาด/ขวดไม่ถูกต้อง' });
    if (!Array.isArray(bottles) || bottles.length === 0) return res.status(400).json({ error: 'ต้องระบุอย่างน้อย 1 ขวด' });
    if (!isValidReceiveType(type)) return res.status(400).json({ error: 'ต้องเลือกประเภท (primary, supplier หรือ working)' });

    const now = new Date();
    const created = [];
    for (const b of bottles) {
      const qrId = await genUniqueQrId();
      const u = await StockUnit.create({
        qrId,
        itemCode: std.code,
        itemName: std.name,
        kind: 'sealed',
        type,
        lotNo,
        exp: b && b.exp ? new Date(b.exp) : null,
        volume: { initial: size, remaining: size, unit },
        status: 'active',
        receivedDate: now,
        createdBy: personOf(req),
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
        ...userMeta(req),
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
        unitId: unit._id.toString(), qrId: unit.qrId, note: reason || 'แจ้งหมด', ...userMeta(req),
      });
      return res.json({ status: 'empty', qrId: unit.qrId });
    }

    unit.status = 'discarded';
    unit.discardedAt = new Date();
    unit.discardedBy = personOf(req);
    unit.discardReason = reason;
    await unit.save();
    await logTransaction({
      itemType: 'standard', itemId: std ? std._id.toString() : unit.itemCode,
      itemCode: unit.itemCode, itemName: unit.itemName, action: 'discard',
      unitId: unit._id.toString(), qrId: unit.qrId, note: reason, ...userMeta(req),
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

    const { lotNo, exp, volume, type } = req.body || {};
    if (lotNo !== undefined) unit.lotNo = String(lotNo);
    if (exp !== undefined) unit.exp = exp ? new Date(exp) : null;
    if (type !== undefined && isValidUnitType(type)) unit.type = type;
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
    const { itemCode, status, kind } = req.query;
    const f = {};
    if (itemCode) f.itemCode = itemCode;
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
    const body = stripMeta(req.body);
    const item = await StockSolvent.create(body);
    await logTransaction({
      itemType: 'solvent',
      itemId: item._id.toString(),
      itemName: item.name,
      action: 'create',
      afterQty: item.qty,
      unit: 'bottle',
      ...userMeta(req),
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/solvents/:id', async (req, res) => {
  try {
    const body = stripMeta(req.body);
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
      ...userMeta(req),
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
      ...userMeta(req),
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
      ...userMeta(req),
    });
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/solvents/:id/receive', async (req, res) => {
  try {
    const { qty, note } = req.body;
    const amount = Number(qty);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Invalid qty' });
    const item = await StockSolvent.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    const before = item.qty;
    item.qty = before + amount;
    await item.save();
    await logTransaction({
      itemType: 'solvent',
      itemId: item._id.toString(),
      itemName: item.name,
      action: 'receive',
      beforeQty: before,
      afterQty: item.qty,
      delta: amount,
      unit: 'bottle',
      note,
      ...userMeta(req),
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
      ...userMeta(req),
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
      ...userMeta(req),
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
      ...userMeta(req),
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
      ...userMeta(req),
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
      ...userMeta(req),
    });
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ==================== TRANSACTIONS (Audit Log) ==================== */

router.get('/transactions', async (req, res) => {
  try {
    const { itemType, itemId, action, limit = 200 } = req.query;
    const filter = {};
    if (itemType) filter.itemType = itemType;
    if (itemId) filter.itemId = itemId;
    if (action) filter.action = action;
    const txs = await StockTransaction.find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit) || 200, 1000));
    res.json(txs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
router.planDeductMg = planDeductMg;
router.deductMgFromUnit = deductMgFromUnit;
