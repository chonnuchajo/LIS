const express = require('express');
const router = express.Router();
const Sample = require('../models/Sample');

router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const query = status ? { status: { $in: status.split(',') } } : {};
    const samples = await Sample.find(query).sort({ date: -1, time: -1 });
    res.json(samples);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const sample = await Sample.findOne({ id: req.params.id });
    if (!sample) return res.status(404).json({ error: 'Not found' });
    res.json(sample);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const existing = await Sample.findOne({ id: req.body.id });
    if (existing) return res.status(409).json({ error: 'Sample ID already exists' });
    const sample = await Sample.create(req.body);
    res.status(201).json(sample);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const sample = await Sample.findOneAndUpdate(
      { id: req.params.id },
      req.body,
      { new: true }
    );
    if (!sample) return res.status(404).json({ error: 'Not found' });
    res.json(sample);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await Sample.findOneAndDelete({ id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
