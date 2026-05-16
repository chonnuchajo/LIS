const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const SampleReceipt = require('../models/SampleReceipt');

// Generate next run number: RCV-YYYY-#### (resets yearly)
async function nextRunNo() {
  const year = new Date().getFullYear();
  const prefix = `RCV-${year}-`;
  const last = await SampleReceipt.findOne({ runNo: new RegExp(`^${prefix}`) })
    .sort({ runNo: -1 })
    .lean();
  const nextSeq = last ? Number(last.runNo.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

// GET /api/sample-receipts?from=&to=&receiver=
router.get('/', async (req, res) => {
  try {
    const { from, to, receiver } = req.query;
    const q = {};
    if (receiver) q.receiver = receiver;
    if (from || to) {
      q.receivedAt = {};
      if (from) {
        const d = new Date(from);
        if (!Number.isNaN(d.getTime())) q.receivedAt.$gte = d;
      }
      if (to) {
        const d = new Date(to);
        if (!Number.isNaN(d.getTime())) {
          d.setHours(23, 59, 59, 999);
          q.receivedAt.$lte = d;
        }
      }
      if (Object.keys(q.receivedAt).length === 0) delete q.receivedAt;
    }
    const items = await SampleReceipt.find(q).sort({ receivedAt: -1 }).lean();
    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /api/sample-receipts  (upsert by sampleId)
router.post('/', async (req, res) => {
  try {
    const { sampleId } = req.body || {};
    if (!sampleId) return res.status(400).json({ error: { message: 'sampleId required' } });

    const existing = await SampleReceipt.findOne({ sampleId }).lean();
    if (existing) {
      const { runNo: _ignore, sampleId: _sid, ...patch } = req.body;
      const updated = await SampleReceipt.findOneAndUpdate(
        { sampleId },
        patch,
        { new: true },
      );
      return res.json(updated);
    }

    const runNo = await nextRunNo();
    const doc = await SampleReceipt.create({ ...req.body, sampleId, runNo });
    res.status(201).json(doc);
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});

// PATCH /api/sample-receipts/:id  (update instrument etc.)
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const q = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { runNo: id };
    const { runNo: _ignore, sampleId: _sid, ...patch } = req.body || {};
    const doc = await SampleReceipt.findOneAndUpdate(q, patch, { new: true });
    if (!doc) return res.status(404).json({ error: { message: 'ไม่พบรายการรับ' } });
    res.json(doc);
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});

module.exports = router;
