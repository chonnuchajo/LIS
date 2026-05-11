const express = require('express');
const router = express.Router();
const PhysicalResult = require('../models/PhysicalResult');

router.get('/', async (req, res) => {
  try {
    const results = await PhysicalResult.find();
    // Return as a map { sampleId: result }
    const map = {};
    results.forEach(r => { map[r.sampleId] = r.toObject(); });
    res.json(map);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:sampleId', async (req, res) => {
  try {
    const result = await PhysicalResult.findOne({ sampleId: req.params.sampleId });
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { sampleId, ...updates } = req.body;
    if (!sampleId) return res.status(400).json({ error: 'sampleId required' });
    const result = await PhysicalResult.findOneAndUpdate(
      { sampleId },
      { sampleId, ...updates },
      { new: true, upsert: true }
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
