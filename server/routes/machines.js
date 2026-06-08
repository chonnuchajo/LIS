const express = require('express');
const path = require('path');
const fs = require('fs');
const Machine = require('../models/Machine');

const router = express.Router();

const SEED_PATH = path.join(__dirname, '..', 'data', 'machines-seed.json');

router.get('/', async (req, res) => {
  try {
    const machines = await Machine.find().sort({ code: 1 });
    res.json(machines);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const item = await Machine.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const item = await Machine.create(req.body);
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const item = await Machine.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const actor = req.query.actor || (req.body && req.body.actor) || 'system';
    const item = await Machine.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    await item.softDelete(actor);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/seed', async (req, res) => {
  try {
    if (!fs.existsSync(SEED_PATH)) {
      return res.status(500).json({ error: 'seed file not found' });
    }
    const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf-8'));
    const ops = seed.map((m) => ({
      updateOne: {
        filter: { code: m.code, deletedAt: null },
        update: { $setOnInsert: m },
        upsert: true,
      },
    }));
    const result = await Machine.bulkWrite(ops);
    res.json({
      inserted: result.upsertedCount || 0,
      matched: result.matchedCount || 0,
      total: seed.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
