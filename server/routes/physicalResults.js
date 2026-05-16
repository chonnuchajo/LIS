const express = require('express');
const router = express.Router();
const PhysicalResult = require('../models/PhysicalResult');
const Petition = require('../models/Petition');
const PetitionAuditLog = require('../models/PetitionAuditLog');

router.get('/', async (req, res) => {
  try {
    const results = await PhysicalResult.find();
    // Return as a map { sampleId: result }
    const map = {};
    results.forEach(r => { map[r.sampleId] = r.toObject(); });
    res.json(map);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:sampleId', async (req, res) => {
  try {
    const result = await PhysicalResult.findOne({ sampleId: req.params.sampleId });
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { sampleId, actor, ...updates } = req.body;
    if (!sampleId) return res.status(400).json({ error: 'sampleId required' });
    const result = await PhysicalResult.findOneAndUpdate(
      { sampleId },
      { sampleId, ...updates },
      { new: true, upsert: true }
    );

    // Bump petition pendingReview → inProgress on first result entry
    const petition = await Petition.findOne({ 'items.sampleId': sampleId });
    if (petition && petition.status === 'pendingReview') {
      const prevStatus = petition.status;
      petition.status = 'inProgress';
      if (!petition.firstResultAt) petition.firstResultAt = new Date();
      await petition.save();
      PetitionAuditLog.create({
        petitionId: petition._id,
        petitionNo: petition.petitionNo,
        event: 'statusChanged',
        fromStatus: prevStatus,
        toStatus: petition.status,
        actor: actor || 'system',
        note: 'เริ่มบันทึกผลตรวจ',
      }).catch((err) => console.error('[audit-log] failed:', err.message));
    }

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
