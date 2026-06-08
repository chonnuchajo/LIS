const express = require('express');
const mongoose = require('mongoose');
const Method = require('../models/Method');
const SimpleMethod = require('../models/SimpleMethod');
const StandardConfig = require('../models/StandardConfig');

const router = express.Router();

const SEED = [
  { code: 'GC',        label: 'GC',        requiresMachine: true,  machinePrefix: 'GC',   defaultTimes: 3, order: 1, builtIn: true },
  { code: 'HPLC',      label: 'HPLC',      requiresMachine: true,  machinePrefix: 'HPLC', defaultTimes: 1, order: 2, builtIn: true },
  { code: 'TITRATION', label: 'Titration', requiresMachine: false, machinePrefix: '',     defaultTimes: 1, order: 3 },
  { code: 'DIGEST',    label: 'Digest',    requiresMachine: false, machinePrefix: '',     defaultTimes: 1, order: 4 },
  { code: 'REFLUX',    label: 'Reflux',    requiresMachine: false, machinePrefix: '',     defaultTimes: 1, order: 5 },
];

// Recreate the seed methods after a DB wipe. Idempotent: only inserts missing codes,
// never overwrites admin edits to existing ones.
async function ensureDefaults() {
  for (const m of SEED) {
    await Method.updateOne({ code: m.code }, { $setOnInsert: m }, { upsert: true });
  }
}

function validateBody(body, { isCreate }) {
  const code = String((body && body.code) || '').trim().toUpperCase();
  const label = String((body && body.label) || '').trim();
  if (isCreate && !code) {
    return { error: { message: 'code required', field: 'code' } };
  }
  if (isCreate && !/^[A-Z0-9_]+$/.test(code)) {
    return { error: { message: 'code ต้องเป็น A-Z 0-9 _ เท่านั้น', field: 'code' } };
  }
  if (!label) return { error: { message: 'label required', field: 'label' } };
  const requiresMachine = Boolean(body && body.requiresMachine);
  const machinePrefix = requiresMachine
    ? String((body && body.machinePrefix) || '').trim().toUpperCase()
    : '';
  if (requiresMachine && !machinePrefix) {
    return { error: { message: 'วิธีที่มีเครื่องต้องระบุ machinePrefix', field: 'machinePrefix' } };
  }
  const defaultTimes = Number(body && body.defaultTimes);
  if (!Number.isInteger(defaultTimes) || defaultTimes < 1 || defaultTimes > 100000) {
    return { error: { message: 'defaultTimes ต้องเป็นจำนวนเต็ม 1–100000', field: 'defaultTimes' } };
  }
  return {
    value: {
      code, label, requiresMachine, machinePrefix, defaultTimes,
      order: Number(body && body.order) || 0,
      active: !(body && (body.active === false || body.active === 'false')),
    },
  };
}

router.get('/', async (_req, res) => {
  try {
    await ensureDefaults();
    const docs = await Method.find().sort({ order: 1, code: 1 }).lean();
    res.json(docs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const built = validateBody(req.body, { isCreate: true });
    if (built.error) return res.status(400).json(built.error);
    const existing = await Method.findOne({ code: built.value.code }).lean();
    if (existing) return res.status(409).json({ message: 'code นี้มีอยู่แล้ว', field: 'code' });
    const doc = await Method.create(built.value);
    res.status(201).json(doc.toObject());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(404).json({ message: 'not found' });
    const current = await Method.findById(id).lean();
    if (!current) return res.status(404).json({ message: 'not found' });
    const built = validateBody({ ...req.body, code: current.code }, { isCreate: false });
    if (built.error) return res.status(400).json(built.error);
    // builtIn methods: lock machine wiring, allow label/defaultTimes/order/active.
    const patch = built.value;
    if (current.builtIn) {
      patch.requiresMachine = current.requiresMachine;
      patch.machinePrefix = current.machinePrefix;
    }
    patch.code = current.code; // code immutable after create
    const doc = await Method.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(404).json({ message: 'not found' });
    const doc = await Method.findById(id).lean();
    if (!doc) return res.status(404).json({ message: 'not found' });
    if (doc.builtIn) return res.status(403).json({ message: 'ลบวิธีพื้นฐานไม่ได้ (ปิดการใช้งานแทน)' });
    // Block delete if referenced anywhere.
    const inSimple = await SimpleMethod.findOne({ methods: { $elemMatch: { $elemMatch: { $eq: doc.code } } } }).lean();
    const inStd = await StandardConfig.findOne({ instrument: doc.code }).lean();
    if (inSimple || inStd) {
      return res.status(409).json({ message: 'วิธีนี้ถูกใช้อยู่ ลบไม่ได้ (ปิดการใช้งานแทน)' });
    }
    const actor = req.query.actor || (req.body && req.body.actor) || 'system';
    await Method.softDeleteMany({ _id: id }, actor);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
