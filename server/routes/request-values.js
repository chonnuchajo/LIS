const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Petition = require('../models/Petition');
const { requireAdminUser } = require('../lib/adminGate');

// Request-value sources expose collection and field metadata; keep them admin-only.
router.use(requireAdminUser);

router.get('/petition-fields', async (_req, res) => {
  try {
    const sample = await Petition.findOne({}).lean();
    const fields = new Set(['items.batchNo', 'items.sampleName', 'batchNo', 'sampleName']);
    const visit = (value, prefix = '') => {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) { if (value[0]) visit(value[0], `${prefix}[]`); return; }
      for (const [key, child] of Object.entries(value)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (child && typeof child === 'object') visit(child, path);
        else fields.add(path);
      }
    };
    visit(sample);
    res.json(Array.from(fields).sort());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/collections', async (_req, res) => {
  try {
    const names = (await mongoose.connection.db.listCollections({ type: 'collection' }).toArray())
      .map((entry) => entry.name)
      .filter((name) => /^[A-Za-z0-9_-]+$/.test(name))
      .sort();
    res.json(names);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/fields', async (req, res) => {
  try {
    const name = String(req.query.collectionName || '');
    if (!/^[A-Za-z0-9_-]+$/.test(name)) return res.status(400).json({ error: 'invalid collection' });
    if (!(await mongoose.connection.db.listCollections({ name }).hasNext())) return res.status(404).json({ error: 'collection not found' });
    const sample = await mongoose.connection.db.collection(name).findOne({}, { projection: { _id: 0 } });
    res.json(Object.keys(sample || {}).sort());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { collectionName, collectionMatchField, batchField, sampleField, valueField, refs } = req.body || {};
    if (!/^[A-Za-z0-9_-]+$/.test(String(collectionName || '')) || !valueField || !Array.isArray(refs)) {
      return res.status(400).json({ error: 'invalid request-value source' });
    }
    const allowed = await mongoose.connection.db.listCollections({ name: collectionName }).hasNext();
    if (!allowed) return res.status(404).json({ error: 'collection not found' });
    if (collectionMatchField) {
      const keys = refs.map((r) => String(r.value ?? '').trim());
      const docs = await mongoose.connection.db.collection(collectionName).find({ [collectionMatchField]: { $in: keys } }, { projection: { [collectionMatchField]: 1, [valueField]: 1 } }).toArray();
      const values = Object.fromEntries(docs.map((doc) => [String(doc[collectionMatchField] ?? '').trim(), doc[valueField] ?? '']));
      return res.json({ values });
    }
    if (!batchField || !sampleField) return res.status(400).json({ error: 'matching fields required' });
    const keys = refs.map((r) => `${String(r.batch ?? '').trim()}\u0000${String(r.sample ?? '').trim()}`);
    const docs = await mongoose.connection.db.collection(collectionName).find({
      [batchField]: { $in: refs.map((r) => r.batch).filter(Boolean) },
      [sampleField]: { $in: refs.map((r) => r.sample).filter(Boolean) },
    }, { projection: { [batchField]: 1, [sampleField]: 1, [valueField]: 1 } }).toArray();
    const values = {};
    for (const doc of docs) {
      const key = `${String(doc[batchField] ?? '').trim()}\u0000${String(doc[sampleField] ?? '').trim()}`;
      if (keys.includes(key)) values[key] = doc[valueField] ?? '';
    }
    res.json({ values });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
module.exports = router;
