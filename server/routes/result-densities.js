const express = require('express');
const router = express.Router();
const ResultDensity = require('../models/ResultDensity');
const { batchMatches } = require('../lib/densityBatch');

// GET /api/result-densities/products — distinct product names for filter dropdown
router.get('/products', async (req, res) => {
  try {
    const products = await ResultDensity.distinct('Product name');
    res.json(products.filter(Boolean).sort());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/result-densities/by-batch/:batch — rows whose Sample name trailing
// batch number matches :batch. Matching is done in JS via batchMatches so the
// rule is identical to the unit-tested helper (009 == 9, suffix-tolerant).
router.get('/by-batch/:batch', async (req, res) => {
  try {
    const batch = String(req.params.batch || '').trim();
    if (!batch) return res.json({ batch, docs: [] });
    const all = await ResultDensity.find({}).sort({ _id: 1 }).lean();
    const docs = all.filter((d) => batchMatches(batch, d['Sample name']));
    res.json({ batch, docs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/result-densities?page=1&limit=100&search=&product=&date=YYYY-MM-DD
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;
    const search = (req.query.search || '').trim();
    const product = (req.query.product || '').trim();
    const date = (req.query.date || '').trim(); // "YYYY-MM-DD"

    const filter = {};

    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ 'Sample ID': re }, { 'Sample name': re }];
    }

    if (product) {
      filter['Product name'] = product;
    }

    if (date) {
      // Convert "2026-06-12" → "6/12/2026" to match "M/D/YYYY h:mm AM" format in DB
      const [y, m, d] = date.split('-');
      const formatted = `${parseInt(m, 10)}/${parseInt(d, 10)}/${y}`;
      filter['Date & time'] = { $regex: `^${formatted.replace(/\//g, '\\/')}` };
    }

    const [docs, total] = await Promise.all([
      ResultDensity.find(filter).sort({ _id: -1 }).skip(skip).limit(limit).lean(),
      ResultDensity.countDocuments(filter),
    ]);

    res.json({ docs, total, page, limit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
