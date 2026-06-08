const express = require('express');
const ItemGroup = require('../models/ItemGroup');

const router = express.Router();

function toStrArray(v) {
  if (!Array.isArray(v)) return [];
  return v.map((s) => String(s).trim()).filter(Boolean);
}

function toDTO(doc) {
  return {
    _id: String(doc._id),
    name: doc.name,
    description: doc.description || '',
    commonNames: doc.commonNames || [],
    tradeNames: doc.tradeNames || [],
    includeItemNos: doc.includeItemNos || [],
    excludeItemNos: doc.excludeItemNos || [],
    status: doc.status || 'active',
    sortOrder: doc.sortOrder || 0,
  };
}

function sanitize(body) {
  return {
    name: String((body && body.name) || '').trim(),
    description: String((body && body.description) || '').trim(),
    commonNames: toStrArray(body && body.commonNames),
    tradeNames: toStrArray(body && body.tradeNames),
    includeItemNos: toStrArray(body && body.includeItemNos),
    excludeItemNos: toStrArray(body && body.excludeItemNos),
    status: (body && body.status) === 'inactive' ? 'inactive' : 'active',
    sortOrder: Number((body && body.sortOrder) || 0),
  };
}

router.get('/', async (_req, res) => {
  try {
    const docs = await ItemGroup.find().sort({ sortOrder: 1, name: 1 }).lean();
    res.json(docs.map(toDTO));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const data = sanitize(req.body);
    if (!data.name) return res.status(400).json({ message: 'name required' });
    const doc = await ItemGroup.create(data);
    res.status(201).json(toDTO(doc.toObject()));
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(400).json({ message: 'ชื่อกลุ่มนี้มีอยู่แล้ว' });
    }
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const data = sanitize(req.body);
    if (!data.name) return res.status(400).json({ message: 'name required' });
    const doc = await ItemGroup.findByIdAndUpdate(req.params.id, data, {
      new: true, runValidators: true,
    }).lean();
    if (!doc) return res.status(404).json({ message: 'Not found' });
    res.json(toDTO(doc));
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(400).json({ message: 'ชื่อกลุ่มนี้มีอยู่แล้ว' });
    }
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const actor = req.query.actor || (req.body && req.body.actor) || 'system';
    await ItemGroup.softDeleteMany({ _id: req.params.id }, actor);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
