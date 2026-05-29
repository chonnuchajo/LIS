const express = require('express');
const mongoose = require('mongoose');
const StandardConfig = require('../models/StandardConfig');

const router = express.Router();

const MAX_KEYWORD_LEN = 200;
const MAX_TIMES = 100000;

function validateTimes(value, field) {
  if (value === null || value === undefined || value === '') return { ok: null };
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > MAX_TIMES) {
    return { error: { message: `${field} ต้องเป็นจำนวนเต็ม 0–${MAX_TIMES}`, field } };
  }
  return { ok: n };
}

// Returns { value } on success or { error: { message, field } } on failure.
function buildBody(body) {
  const keyword = String((body && body.keyword) || '').trim();
  if (!keyword) return { error: { message: 'keyword required', field: 'keyword' } };
  if (keyword.length > MAX_KEYWORD_LEN) {
    return { error: { message: `keyword too long (max ${MAX_KEYWORD_LEN})`, field: 'keyword' } };
  }
  const gc = validateTimes(body && body.gcTimes, 'gcTimes');
  if (gc.error) return { error: gc.error };
  const hplc = validateTimes(body && body.hplcTimes, 'hplcTimes');
  if (hplc.error) return { error: hplc.error };
  if ((gc.ok || 0) <= 0 && (hplc.ok || 0) <= 0) {
    return { error: { message: 'ต้องมีจำนวนครั้งอย่างน้อย 1 เครื่อง', field: 'gcTimes' } };
  }
  return {
    value: {
      keyword,
      keywordLower: keyword.toLowerCase(),
      gcTimes: gc.ok,
      hplcTimes: hplc.ok,
      note: String((body && body.note) || '').trim(),
    },
  };
}

router.get('/', async (_req, res) => {
  try {
    const docs = await StandardConfig.find().sort({ keywordLower: 1 }).lean();
    res.json(docs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const built = buildBody(req.body);
    if (built.error) return res.status(400).json(built.error);
    const existing = await StandardConfig.findOne({ keywordLower: built.value.keywordLower }).lean();
    if (existing) return res.status(409).json({ message: 'keyword นี้มีอยู่แล้ว', field: 'keyword' });
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
    const built = buildBody(req.body);
    if (built.error) return res.status(400).json(built.error);
    const clash = await StandardConfig.findOne({
      keywordLower: built.value.keywordLower,
      _id: { $ne: id },
    }).lean();
    if (clash) return res.status(409).json({ message: 'keyword นี้มีอยู่แล้ว', field: 'keyword' });
    const doc = await StandardConfig.findByIdAndUpdate(id, { $set: built.value }, { new: true }).lean();
    if (!doc) return res.status(404).json({ message: 'not found' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(404).json({ message: 'not found' });
    const doc = await StandardConfig.findByIdAndDelete(id).lean();
    if (!doc) return res.status(404).json({ message: 'not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
