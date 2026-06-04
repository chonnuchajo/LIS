const express = require('express');
const SimpleMethod = require('../models/SimpleMethod');

const router = express.Router();

// Normalize an incoming per-substance AND-set array (string[][]).
// Each slot → array of uppercase non-empty codes, de-duplicated, order preserved.
function normalizeMethods(value) {
  if (!Array.isArray(value)) return [];
  return value.map((slot) => {
    const list = Array.isArray(slot) ? slot : [slot];
    const seen = new Set();
    const out = [];
    for (const entry of list) {
      const code = String(entry || '').trim().toUpperCase();
      if (code && !seen.has(code)) { seen.add(code); out.push(code); }
    }
    return out;
  });
}

router.get('/', async (_req, res) => {
  try {
    const docs = await SimpleMethod.find().lean();
    res.json(docs.map((doc) => ({
      itemNo: doc.itemNo,
      instruments: doc.instruments || [],
      methods: doc.methods, // undefined when not migrated yet → client falls back to instruments
    })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:itemNo', async (req, res) => {
  try {
    const itemNo = String(req.params.itemNo || '').trim();
    if (!itemNo) return res.status(400).json({ message: 'itemNo required' });
    const methods = normalizeMethods(req.body && req.body.methods);
    const doc = await SimpleMethod.findOneAndUpdate(
      { itemNo },
      { $set: { methods } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
    res.json({ itemNo: doc.itemNo, methods: doc.methods || [], instruments: doc.instruments || [] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/', async (req, res) => {
  try {
    const updates = Array.isArray(req.body && req.body.updates) ? req.body.updates : [];
    const ops = updates
      .map((entry) => ({
        itemNo: String((entry && entry.itemNo) || '').trim(),
        methods: normalizeMethods(entry && entry.methods),
      }))
      .filter((entry) => entry.itemNo)
      .map((entry) => ({
        updateOne: {
          filter: { itemNo: entry.itemNo },
          update: { $set: { methods: entry.methods } },
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
