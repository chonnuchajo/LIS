const express = require('express');
const SimpleMethodExclusion = require('../models/SimpleMethodExclusion');

const router = express.Router();

const ALLOWED_MATCH = new Set(['contains', 'startsWith', 'endsWith']);

router.get('/', async (_req, res) => {
  try {
    const docs = await SimpleMethodExclusion.find().sort({ createdAt: -1 }).lean();
    res.json(docs.map((doc) => ({
      _id: String(doc._id),
      pattern: doc.pattern,
      matchType: doc.matchType,
    })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const pattern = String(req.body && req.body.pattern || '').trim();
    const matchType = String(req.body && req.body.matchType || 'contains');
    if (!pattern) return res.status(400).json({ message: 'pattern required' });
    if (!ALLOWED_MATCH.has(matchType)) return res.status(400).json({ message: 'invalid matchType' });

    const doc = await SimpleMethodExclusion.findOneAndUpdate(
      { pattern, matchType },
      { $setOnInsert: { pattern, matchType } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
    res.json({ _id: String(doc._id), pattern: doc.pattern, matchType: doc.matchType });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const actor = req.query.actor || (req.body && req.body.actor) || 'system';
    await SimpleMethodExclusion.softDeleteMany({ _id: req.params.id }, actor);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
