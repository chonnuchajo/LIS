const express = require('express');
const mongoose = require('mongoose');
const StandardConfig = require('../models/StandardConfig');
const Method = require('../models/Method');

const router = express.Router();

const MAX_COMMONNAME_LEN = 200;
const MAX_TIMES = 100000;
const MIN_TIMES = 1;

// Default rows come from the Method registry (one isDefault row per method, scope:'all').
// Standard config only applies to machine-based methods (GC/HPLC) — those are the ones
// that consume a standard. Non-machine methods (Titration/Digest/Reflux) are excluded.
async function ensureDefaults() {
  const methods = await Method.find({ requiresMachine: true }).lean();
  const machineCodes = methods.map((m) => m.code);
  for (const m of methods) {
    await StandardConfig.updateOne(
      { instrument: m.code, scope: 'all' },
      {
        $setOnInsert: {
          instrument: m.code,
          scope: 'all',
          commonName: null,
          commonNameLower: null,
          times: m.defaultTimes,
          isDefault: true,
          note: '',
        },
      },
      { upsert: true },
    );
  }
  // Drop any rows seeded for non-machine methods by earlier versions.
  await StandardConfig.deleteMany({ instrument: { $nin: machineCodes } });
}

function validateTimes(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < MIN_TIMES || n > MAX_TIMES) {
    return { error: { message: `จำนวนครั้งต้องเป็นจำนวนเต็ม ${MIN_TIMES}–${MAX_TIMES}`, field: 'times' } };
  }
  return { ok: n };
}

// Build/validate a substance-row body (POST + PUT on non-default rows).
// Returns { value } or { error: { message, field } }.
async function buildSubstanceBody(body) {
  const instrument = String((body && body.instrument) || '').toUpperCase();
  const valid = await Method.exists({ code: instrument });
  if (!valid) {
    return { error: { message: 'instrument ไม่ตรงกับวิธีที่มีในระบบ', field: 'instrument' } };
  }
  const commonName = String((body && body.commonName) || '').trim();
  if (!commonName) return { error: { message: 'commonName required', field: 'commonName' } };
  if (commonName.length > MAX_COMMONNAME_LEN) {
    return { error: { message: `commonName too long (max ${MAX_COMMONNAME_LEN})`, field: 'commonName' } };
  }
  const t = validateTimes(body && body.times);
  if (t.error) return { error: t.error };
  return {
    value: {
      instrument,
      scope: 'substance',
      commonName,
      commonNameLower: commonName.toLowerCase(),
      times: t.ok,
      isDefault: false,
      note: String((body && body.note) || '').trim(),
    },
  };
}

router.get('/', async (_req, res) => {
  try {
    await ensureDefaults();
    const docs = await StandardConfig.find()
      .sort({ isDefault: -1, commonNameLower: 1, instrument: 1 })
      .lean();
    res.json(docs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    if (req.body && req.body.scope === 'all') {
      return res.status(400).json({ message: 'สร้างค่าตั้งต้นไม่ได้', field: 'scope' });
    }
    const built = await buildSubstanceBody(req.body);
    if (built.error) return res.status(400).json(built.error);
    const existing = await StandardConfig.findOne({
      instrument: built.value.instrument,
      scope: 'substance',
      commonNameLower: built.value.commonNameLower,
    }).lean();
    if (existing) {
      return res.status(409).json({ message: 'สารนี้มีค่าของเครื่องนี้แล้ว', field: 'commonName' });
    }
    const doc = await StandardConfig.create(built.value);
    res.status(201).json(doc.toObject());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(404).json({ message: 'not found' });
    const current = await StandardConfig.findById(id).lean();
    if (!current) return res.status(404).json({ message: 'not found' });

    if (current.isDefault) {
      // Default rows: only times + note may change.
      const t = validateTimes(req.body && req.body.times);
      if (t.error) return res.status(400).json(t.error);
      const note = String((req.body && req.body.note) || '').trim();
      const doc = await StandardConfig.findByIdAndUpdate(
        id,
        { $set: { times: t.ok, note } },
        { new: true },
      ).lean();
      return res.json(doc);
    }

    const built = await buildSubstanceBody(req.body);
    if (built.error) return res.status(400).json(built.error);
    const clash = await StandardConfig.findOne({
      instrument: built.value.instrument,
      scope: 'substance',
      commonNameLower: built.value.commonNameLower,
      _id: { $ne: id },
    }).lean();
    if (clash) {
      return res.status(409).json({ message: 'สารนี้มีค่าของเครื่องนี้แล้ว', field: 'commonName' });
    }
    const doc = await StandardConfig.findByIdAndUpdate(id, { $set: built.value }, { new: true }).lean();
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(404).json({ message: 'not found' });
    const doc = await StandardConfig.findById(id).lean();
    if (!doc) return res.status(404).json({ message: 'not found' });
    if (doc.isDefault) return res.status(403).json({ message: 'ลบค่าตั้งต้นไม่ได้' });
    await StandardConfig.findByIdAndDelete(id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
