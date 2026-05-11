const express = require('express');
const router = express.Router();
const RealtimeDensity = require('../models/RealtimeDensity');

router.get('/', async (req, res) => {
  try {
    const densities = await RealtimeDensity.find().sort({ updatedAt: -1 });
    res.json(densities);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { sampleId, sampleName, density, sentAt } = req.body;
    if (!sampleId) return res.status(400).json({ error: 'sampleId required' });
    const result = await RealtimeDensity.findOneAndUpdate(
      { sampleId },
      { sampleId, sampleName, density, sentAt },
      { new: true, upsert: true }
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:sampleId', async (req, res) => {
  try {
    await RealtimeDensity.findOneAndDelete({ sampleId: req.params.sampleId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
