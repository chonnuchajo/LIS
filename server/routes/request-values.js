const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

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
    const { collectionName, batchField, sampleField, valueField, refs } = req.body || {};
    if (!/^[A-Za-z0-9_-]+$/.test(String(collectionName || '')) || !batchField || !sampleField || !valueField || !Array.isArray(refs)) {
      return res.status(400).json({ error: 'invalid request-value source' });
    }
    const allowed = await mongoose.connection.db.listCollections({ name: collectionName }).hasNext();
    if (!allowed) return res.status(404).json({ error: 'collection not found' });
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
