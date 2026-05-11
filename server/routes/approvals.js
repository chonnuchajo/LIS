const express = require('express');
const router = express.Router();
const Approval = require('../models/Approval');

router.get('/', async (req, res) => {
  try {
    const approvals = await Approval.find();
    const map = {};
    approvals.forEach(a => {
      map[a.sampleId] = {
        labApproved: a.labApproved,
        labApprovedAt: a.labApprovedAt,
        qcStatus: a.qcStatus,
        qcNote: a.qcNote,
      };
    });
    res.json(map);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:sampleId/lab', async (req, res) => {
  try {
    const approval = await Approval.findOneAndUpdate(
      { sampleId: req.params.sampleId },
      { labApproved: true, labApprovedAt: new Date() },
      { new: true, upsert: true }
    );
    res.json(approval);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:sampleId/qc', async (req, res) => {
  try {
    const { status, note } = req.body;
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const approval = await Approval.findOneAndUpdate(
      { sampleId: req.params.sampleId },
      { qcStatus: status, qcNote: note },
      { new: true, upsert: true }
    );
    res.json(approval);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
