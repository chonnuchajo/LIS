const express = require('express');
const MasterItemMeta = require('../models/MasterItemMeta');

const router = express.Router();

const OVERRIDE_FIELDS = [
  'itemCode',
  'itemName',
  'itemType',
  'category',
  'unit',
  'status',
  'description',
];

function normalizeQty(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function toPlain(doc) {
  const out = {
    itemNo: doc.itemNo,
    requiredInspectionQty: doc.requiredInspectionQty || 0,
  };
  OVERRIDE_FIELDS.forEach((key) => {
    out[key] = doc[key] || '';
  });
  return out;
}

function buildUpdate(body) {
  const update = {};
  OVERRIDE_FIELDS.forEach((key) => {
    if (body && Object.prototype.hasOwnProperty.call(body, key)) {
      update[key] = String(body[key] ?? '').trim();
    }
  });
  if (body && Object.prototype.hasOwnProperty.call(body, 'requiredInspectionQty')) {
    update.requiredInspectionQty = normalizeQty(body.requiredInspectionQty);
  }
  return update;
}

router.get('/', async (_req, res) => {
  try {
    const docs = await MasterItemMeta.find().lean();
    res.json(docs.map(toPlain));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:itemNo', async (req, res) => {
  try {
    const itemNo = String(req.params.itemNo || '').trim();
    if (!itemNo) return res.status(400).json({ message: 'itemNo required' });
    const update = buildUpdate(req.body || {});
    const doc = await MasterItemMeta.findOneAndUpdate(
      { itemNo },
      { $set: update },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
    res.json(toPlain(doc));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:itemNo', async (req, res) => {
  try {
    const itemNo = String(req.params.itemNo || '').trim();
    if (!itemNo) return res.status(400).json({ message: 'itemNo required' });
    const actor = req.query.actor || (req.body && req.body.actor) || 'system';
    await MasterItemMeta.softDeleteMany({ itemNo }, actor);
    res.json({ success: true });
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
        update: buildUpdate(entry || {}),
      }))
      .filter((entry) => entry.itemNo)
      .map((entry) => ({
        updateOne: {
          filter: { itemNo: entry.itemNo },
          update: { $set: entry.update },
          upsert: true,
        },
      }));
    if (ops.length === 0) return res.json({ matched: 0, upserted: 0 });
    const result = await MasterItemMeta.bulkWrite(ops);
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
