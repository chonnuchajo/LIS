const express = require('express');
const SimpleMethod = require('../models/SimpleMethod');

const router = express.Router();

const ALLOWED = new Set(['GC', 'HPLC']);

function normalizeInstruments(value) {
  const list = Array.isArray(value)
    ? value
    : String(value || '').split(',');
  const set = new Set();
  list.forEach((entry) => {
    const token = String(entry).trim().toUpperCase();
    if (ALLOWED.has(token)) set.add(token);
  });
  return ['GC', 'HPLC'].filter((token) => set.has(token));
}

router.get('/', async (_req, res) => {
  try {
    const docs = await SimpleMethod.find().lean();
    res.json(docs.map((doc) => ({
      itemNo: doc.itemNo,
      instruments: doc.instruments || [],
    })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:itemNo', async (req, res) => {
  try {
    const itemNo = String(req.params.itemNo || '').trim();
    if (!itemNo) return res.status(400).json({ message: 'itemNo required' });
    const instruments = normalizeInstruments(req.body && req.body.instruments);
    const doc = await SimpleMethod.findOneAndUpdate(
      { itemNo },
      { $set: { instruments } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
    res.json({ itemNo: doc.itemNo, instruments: doc.instruments || [] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/', async (req, res) => {
  try {
    const updates = Array.isArray(req.body && req.body.updates) ? req.body.updates : [];
    const ops = updates
      .map((entry) => ({
        itemNo: String(entry && entry.itemNo || '').trim(),
        instruments: normalizeInstruments(entry && entry.instruments),
      }))
      .filter((entry) => entry.itemNo)
      .map((entry) => ({
        updateOne: {
          filter: { itemNo: entry.itemNo },
          update: { $set: { instruments: entry.instruments } },
          upsert: true,
        },
      }));
    if (ops.length === 0) return res.json({ matched: 0, upserted: 0 });
    const result = await SimpleMethod.bulkWrite(ops);
    res.json({
      matched: result.matchedCount || 0,
      upserted: (result.upsertedIds && Object.keys(result.upsertedIds).length) || 0,
      modified: result.modifiedCount || 0,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
