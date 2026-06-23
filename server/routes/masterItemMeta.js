const express = require('express');
const MasterItemMeta = require('../models/MasterItemMeta');

const router = express.Router();

const DEFAULT_WEIGHT_WEBHOOK_URL = 'https://n8n-plant.icpladda.com/webhook/api/weight';
const WEIGHT_WEBHOOK_URL = process.env.WEIGHT_WEBHOOK_URL || DEFAULT_WEIGHT_WEBHOOK_URL;

const OVERRIDE_FIELDS = [
  'itemCode',
  'itemName',
  'itemType',
  'category',
  'unit',
  'status',
  'description',
];

const PACK_NUMBER_FIELDS = [
  'kgPerCarton',
  'grossKgPerUnit',
  'declaredKgPerUnit',
  'weightDiff',
  'packLevel',
  'unitsPerCarton',
  'measureSize',
];

const PACK_STRING_FIELDS = [
  'packSource',
  'cartonUnit',
  'packUnit',
  'measureUnit',
];

function normalizeQty(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function normalizeKg(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toPlain(doc) {
  const out = {
    itemNo: doc.itemNo,
    requiredInspectionQty: doc.requiredInspectionQty || 0,
  };
  OVERRIDE_FIELDS.forEach((key) => {
    out[key] = doc[key] || '';
  });
  PACK_NUMBER_FIELDS.forEach((key) => {
    out[key] = doc[key] ?? null;
  });
  PACK_STRING_FIELDS.forEach((key) => {
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
  PACK_NUMBER_FIELDS.forEach((key) => {
    if (body && Object.prototype.hasOwnProperty.call(body, key)) update[key] = normalizeKg(body[key]);
  });
  PACK_STRING_FIELDS.forEach((key) => {
    if (body && Object.prototype.hasOwnProperty.call(body, key)) update[key] = String(body[key] ?? '').trim();
  });
  return update;
}

function normalizeItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    const found = [payload.data, payload.items, payload.result, payload.rows].find(Array.isArray);
    if (Array.isArray(found)) return found;
  }
  return [];
}

function firstValue(item, keys) {
  for (const key of keys) {
    const value = item && item[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return '';
}

function weightUpdate(row) {
  const itemCode = String(firstValue(row, ['item_no', 'itemCode', 'item_code', 'code'])).trim();
  return {
    itemCode,
    itemName: String(firstValue(row, ['ชื่อการค้า', 'trade_name', 'tradename', 'tradeName', 'item_name1', 'itemName'])).trim(),
    itemType: String(firstValue(row, ['ชื่อสามัญ', 'common_name', 'commonname', 'commonName', 'item_name2', 'itemType'])).trim(),
    description: String(firstValue(row, ['ขนาด', 'size', 'desc2', 'description2', 'item_name3'])).trim(),
    kgPerCarton: normalizeKg(firstValue(row, ['kg_per_carton', 'gross_kg_per_carton'])),
    grossKgPerUnit: normalizeKg(row.gross_kg_per_unit),
    declaredKgPerUnit: normalizeKg(row.declared_kg_per_unit),
    weightDiff: normalizeKg(row.weight_diff),
    packLevel: normalizeKg(row.pack_level),
    packSource: String(row.pack_source ?? '').trim(),
    cartonUnit: String(row.carton_unit ?? '').trim(),
    unitsPerCarton: normalizeKg(row.units_per_carton),
    packUnit: String(row.pack_unit ?? '').trim(),
    measureSize: normalizeKg(row.measure_size),
    measureUnit: String(row.measure_unit ?? '').trim(),
  };
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
          filter: { itemNo: entry.itemNo, deletedAt: null },
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

router.post('/sync-weight', async (_req, res) => {
  try {
    const response = await fetch(WEIGHT_WEBHOOK_URL, { headers: { Accept: 'application/json' } });
    if (!response.ok) {
      return res.status(response.status).json({ message: 'Weight webhook request failed' });
    }

    const rows = normalizeItems(await response.json().catch(() => null));
    const updates = new Map();
    for (const row of rows) {
      const itemNo = String(firstValue(row, ['item_no', 'itemCode', 'item_code', 'code'])).trim();
      const update = weightUpdate(row);
      if (itemNo && update.kgPerCarton !== null) updates.set(itemNo, update);
    }

    if (updates.size === 0) return res.json({ matched: 0, upserted: 0, modified: 0, total: 0 });

    const result = await MasterItemMeta.bulkWrite(
      Array.from(updates, ([itemNo, update]) => ({
        updateOne: {
          filter: { itemNo, deletedAt: null },
          update: { $set: update },
          upsert: true,
        },
      })),
    );

    res.json({
      matched: result.matchedCount || 0,
      upserted: (result.upsertedIds && Object.keys(result.upsertedIds).length) || 0,
      modified: result.modifiedCount || 0,
      total: updates.size,
    });
  } catch (err) {
    res.status(502).json({ message: 'Cannot sync weight data', error: err.message });
  }
});

module.exports = router;
