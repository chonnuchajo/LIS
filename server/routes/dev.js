const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Petition = require('../models/Petition');
const PetitionAuditLog = require('../models/PetitionAuditLog');

const VALID_STATUSES = [
  'deliveringQC',
  'sampleSent',
  'pendingReview',
  'inProgress',
  'success',
  'approved',
  'rejected',
];

// Dev-only helpers. Gated by ALLOW_DEV_STATUS=true so the raw mutators below can
// never run in production (prod .env must NOT set the flag).
function devEnabled() {
  return process.env.ALLOW_DEV_STATUS === 'true';
}

// PATCH /api/dev/petition-status/:id  → raw-set petition.status (bypass every
// business guard). For local testing of status-dependent UI only. Intentionally
// does NOT touch companion fields (receive timestamps, assignee, …).
router.patch('/petition-status/:id', async (req, res) => {
  if (!devEnabled()) {
    return res.status(403).json({ error: { message: 'dev status setter is disabled (set ALLOW_DEV_STATUS=true)' } });
  }
  try {
    const { status, actor } = req.body || {};
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: { message: `status ต้องเป็นหนึ่งใน: ${VALID_STATUSES.join(', ')}` } });
    }
    const id = req.params.id;
    const q = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { petitionNo: id };
    const doc = await Petition.findOne(q);
    if (!doc) return res.status(404).json({ error: { message: 'ไม่พบคำร้อง' } });

    const fromStatus = doc.status;
    doc.status = status;
    await doc.save();

    if (fromStatus !== status) {
      PetitionAuditLog.create({
        petitionId: doc._id,
        petitionNo: doc.petitionNo,
        event: 'statusChanged',
        fromStatus,
        toStatus: status,
        actor: actor || '__dev__',
        note: '[dev] เปลี่ยนสถานะ (raw)',
      }).catch((err) => console.error('[audit-log] failed to write:', err.message));
    }

    res.json(doc);
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});

module.exports = router;
