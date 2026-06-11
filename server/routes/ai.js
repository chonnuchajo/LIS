const express = require('express');
const router = express.Router();
const QCTestResult = require('../models/QCTestResult');
const { zScore } = require('../lib/smartRules');

// POST /api/ai/outlier-check
// Body: { commonName, parameterId, fieldLabel, value }
// Returns: { warning, zScore?, mean?, stdev?, sampleSize, reason? }
router.post('/outlier-check', async (req, res) => {
  try {
    const { commonName, parameterId, fieldLabel, value } = req.body;
    if (!commonName || !parameterId || !fieldLabel || value == null) {
      return res.json({ warning: false, reason: 'missing_params' });
    }
    const num = typeof value === 'number' ? value : Number(value);
    if (isNaN(num)) return res.json({ warning: false, reason: 'not_numeric' });

    const results = await QCTestResult.find(
      { commonName, parameterId },
      { values: 1, enteredAt: 1 },
    )
      .sort({ enteredAt: -1 })
      .limit(10)
      .lean();

    const historicalValues = results
      .map((r) => {
        const v = r.values?.[fieldLabel];
        return v != null && v !== '' ? Number(v) : NaN;
      })
      .filter((v) => !isNaN(v));

    if (historicalValues.length < 3) {
      return res.json({ warning: false, sampleSize: historicalValues.length, reason: 'insufficient_data' });
    }

    const stats = zScore(historicalValues, num);
    if (!stats) return res.json({ warning: false, sampleSize: historicalValues.length, reason: 'zero_variance' });

    return res.json({
      warning: stats.warning,
      zScore: Math.round(stats.zScore * 100) / 100,
      mean: Math.round(stats.mean * 10000) / 10000,
      stdev: Math.round(stats.stdev * 10000) / 10000,
      sampleSize: historicalValues.length,
    });
  } catch (err) {
    return res.json({ warning: false, reason: 'error' });
  }
});

module.exports = router;
