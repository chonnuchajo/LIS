const express = require('express');
const router = express.Router();
const { StockStandard, StockSolvent, StockGlassware } = require('../models/Stock');
const StockTransaction = require('../models/StockTransaction');
const StockUnit = require('../models/StockUnit');
const crypto = require('crypto');

async function genUniqueQrId() {
  for (let i = 0; i < 5; i++) {
    const id = 'u_' + crypto.randomBytes(6).toString('hex'); // u_ + 12 hex
    const exists = await StockUnit.exists({ qrId: id });
    if (!exists) return id;
  }
  throw new Error('ไม่สามารถสร้าง qrId ที่ไม่ซ้ำได้');
}

// mirror ของ addShelfLife/computeWorkingExp ใน src/lib/stockUnit.ts
function addShelfLife(from, shelf) {
  const v = Math.max(0, Math.floor(Number(shelf && shelf.value) || 0));
  const d = new Date(from);
  if (shelf && shelf.unit === 'week') d.setDate(d.getDate() + v * 7);
  else if (shelf && shelf.unit === 'month') d.setMonth(d.getMonth() + v);
  else d.setDate(d.getDate() + v);
  return d;
}
function computeWorkingExp(withdrawnAt, shelf, parentExp) {
  const candidate = addShelfLife(withdrawnAt, shelf);
  if (parentExp && candidate.getTime() > new Date(parentExp).getTime()) return new Date(parentExp);
  return candidate;
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

/* ==================== STANDARDS ==================== */

router.get('/standards', async (req, res) => {
  try {
    res.json(await StockStandard.find().sort({ code: 1 }));
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
    const item = await StockStandard.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
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

// รับเข้าหลายขวด: { lotNo?, sizeMl, unit?, bottles: [{ exp }], note? }
router.post('/standards/:id/units/receive', async (req, res) => {
  try {
    const std = await StockStandard.findById(req.params.id);
    if (!std) return res.status(404).json({ error: 'ไม่พบสาร' });

    const { lotNo = '', sizeMl, unit = 'ml', bottles, note } = req.body || {};
    const size = Number(sizeMl);
    if (!Number.isFinite(size) || size <= 0) return res.status(400).json({ error: 'ขนาด/ขวดไม่ถูกต้อง' });
    if (!Array.isArray(bottles) || bottles.length === 0) return res.status(400).json({ error: 'ต้องระบุอย่างน้อย 1 ขวด' });

    const now = new Date();
    const created = [];
    for (const b of bottles) {
      const qrId = await genUniqueQrId();
      const u = await StockUnit.create({
        qrId,
        itemCode: std.code,
        itemName: std.name,
        kind: 'sealed',
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
        unit: 'ml',
        note,
        ...userMeta(req),
      });
    }
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err.message });
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
    const item = await StockSolvent.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
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
    const item = await StockGlassware.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
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
