const express = require('express');
const router = express.Router();
const ResultDensity = require('../models/ResultDensity');

// GET /api/result-densities?page=1&limit=100
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      ResultDensity.find().sort({ _id: -1 }).skip(skip).limit(limit).lean(),
      ResultDensity.countDocuments(),
    ]);
    res.json({ docs, total, page, limit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
