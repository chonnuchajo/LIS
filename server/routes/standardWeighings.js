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
  const b = req.body || {};
  if (!b.petitionId || !mongoose.Types.ObjectId.isValid(String(b.petitionId))) {
    return res.status(400).json({ error: 'petitionId required' });
  }
  if (!b.commonName || !b.substance || !b.instrument) {
    return res.status(400).json({ error: 'commonName/substance/instrument required' });
  }
  const masses = Array.isArray(b.masses)
    ? b.masses.filter((m) => m !== '' && m !== null && m !== undefined).map(Number).filter((n) => Number.isFinite(n))
    : [];
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
  // Atomic upsert: the filter excludes already-deducted rows, so a concurrent
  // deduction can never be clobbered by a draft-save (no read-then-write race).
  try {
    const doc = await StandardWeighing.findOneAndUpdate(
      { petitionId: b.petitionId, commonName: b.commonName, substance: b.substance, instrument: b.instrument, deductedAt: null },
      { $set: set, $setOnInsert: { petitionId: b.petitionId, commonName: b.commonName, substance: b.substance, instrument: b.instrument } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
    return res.json(doc);
  } catch (err) {
    // A row exists but is already deducted → the deductedAt:null filter misses it, so upsert
    // attempts an insert that collides with the unique index (11000). Return the deducted row
    // unchanged (idempotent: a deducted row is final).
    if (err && err.code === 11000) {
      const existing = await StandardWeighing.findOne({
        petitionId: b.petitionId, commonName: b.commonName, substance: b.substance, instrument: b.instrument,
      }).lean();
      if (existing) return res.json(existing);
    }
    return res.status(400).json({ error: err.message });
  }
});

module.exports = router;
