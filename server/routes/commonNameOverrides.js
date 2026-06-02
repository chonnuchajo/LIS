const express = require('express');
const CommonNameOverride = require('../models/CommonNameOverride');

const router = express.Router();

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

router.get('/', async (_req, res) => {
  try {
    const docs = await CommonNameOverride.find().sort({ raw: 1 }).lean();
    res.json(docs.map((doc) => ({
      _id: String(doc._id),
      raw: doc.raw,
      canonical: doc.canonical,
      note: doc.note || '',
    })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const raw = String(req.body && req.body.raw || '').trim();
    const canonical = String(req.body && req.body.canonical || '').trim();
    const note = String(req.body && req.body.note || '').trim();
    if (!raw) return res.status(400).json({ message: 'raw required' });
    if (!canonical) return res.status(400).json({ message: 'canonical required' });
    const rawKey = normalizeKey(raw);
    const doc = await CommonNameOverride.findOneAndUpdate(
      { rawKey },
      { $set: { raw, canonical, note }, $setOnInsert: { rawKey } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
    res.json({ _id: String(doc._id), raw: doc.raw, canonical: doc.canonical, note: doc.note || '' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await CommonNameOverride.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
