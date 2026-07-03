const express = require('express');
const StandardTime = require('../models/StandardTime');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
    const q = {};

    if (req.query.instrument) q.instrument = String(req.query.instrument);
    if (req.query.machineType) q.machineType = String(req.query.machineType).toUpperCase();
    if (req.query.hasData != null) q.hasData = String(req.query.hasData) === 'true';
    if (req.query.search) {
      const rx = new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      q.$or = [{ analysisName: rx }, { instrument: rx }, { columnDimension: rx }];
    }

    const [items, total] = await Promise.all([
      StandardTime.find(q)
        .sort({ machineType: 1, instrument: 1, analysisName: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      StandardTime.countDocuments(q),
    ]);
    res.json({ items, total, page, limit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/summary', async (_req, res) => {
  try {
    const byInstrument = await StandardTime.aggregate([
      {
        $group: {
          _id: '$instrument',
          total: { $sum: 1 },
          withData: { $sum: { $cond: ['$hasData', 1, 0] } },
          avgStandardTimeMin: { $avg: '$standardTimeMin' },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    res.json({ byInstrument });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const allowed = [
      'mobilePhaseTopUpMin',
      'samplePrepPerBatchMin',
      'standardPrepMin',
      'instrumentSetupMin',
      'standardCycleMin',
      'totalInjectionsPerBatch',
      'machineRunTotalMin',
      'dataProcessingMin',
      'recordResultMin',
      'reportingMin',
      'standardTimeMin',
      'note',
    ];
    const patch = {};
    for (const key of allowed) {
      if (!(key in req.body)) continue;
      patch[key] = key === 'note'
        ? String(req.body[key] || '').trim()
        : (req.body[key] === '' || req.body[key] == null ? null : Number(req.body[key]));
      if (key !== 'note' && patch[key] != null && !Number.isFinite(patch[key])) {
        return res.status(400).json({ error: `${key} must be a number` });
      }
    }
    if ('standardTimeMin' in patch) {
      patch.hasData = patch.standardTimeMin != null;
      patch.standardTimeText = patch.standardTimeMin == null ? '' : minutesText(patch.standardTimeMin);
    }
    const doc = await StandardTime.findByIdAndUpdate(req.params.id, patch, { new: true, runValidators: true }).lean();
    if (!doc) return res.status(404).json({ error: 'Standard time not found' });
    res.json(doc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

function minutesText(value) {
  const minutes = Math.round(Number(value) || 0);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} hr ${m} min` : `${m} min`;
}

module.exports = router;
