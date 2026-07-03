// server/routes/standardWeighings.js
const express = require('express');
const mongoose = require('mongoose');
const StandardWeighing = require('../models/StandardWeighing');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { petitionId } = req.query;
    if (!petitionId || !mongoose.Types.ObjectId.isValid(String(petitionId))) {
      return res.status(400).json({ error: 'petitionId required' });
    }
    const rows = await StandardWeighing.find({ petitionId }).sort({ commonName: 1, substance: 1 }).lean();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upsert a draft weighing (no deduction). Keyed by (petitionId, commonName, substance, instrument).
router.put('/', async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.petitionId || !mongoose.Types.ObjectId.isValid(String(b.petitionId))) {
      return res.status(400).json({ error: 'petitionId required' });
    }
    if (!b.commonName || !b.substance || !b.instrument) {
      return res.status(400).json({ error: 'commonName/substance/instrument required' });
    }
    const masses = Array.isArray(b.masses) ? b.masses.map(Number).filter((n) => Number.isFinite(n)) : [];
    const set = {
      petitionNo: String(b.petitionNo || ''),
      sampleId: String(b.sampleId || ''),
      times: b.times == null ? null : Number(b.times),
      mode: b.mode === 'working' ? 'working' : 'fresh',
      masses,
      totalMg: masses.reduce((s, n) => s + n, 0),
      bottleQrId: String(b.bottleQrId || ''),
      workingQrId: String(b.workingQrId || ''),
      note: String(b.note || ''),
    };
    // Never let a draft-save clobber an already-deducted record.
    const existing = await StandardWeighing.findOne({
      petitionId: b.petitionId, commonName: b.commonName, substance: b.substance, instrument: b.instrument,
    });
    if (existing && existing.deductedAt) return res.json(existing.toObject());
    const doc = await StandardWeighing.findOneAndUpdate(
      { petitionId: b.petitionId, commonName: b.commonName, substance: b.substance, instrument: b.instrument },
      { $set: set, $setOnInsert: { petitionId: b.petitionId, commonName: b.commonName, substance: b.substance, instrument: b.instrument } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
    res.json(doc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
