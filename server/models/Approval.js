const mongoose = require('mongoose');

const ApprovalSchema = new mongoose.Schema({
  sampleId: { type: String, required: true, unique: true },
  labApproved: { type: Boolean, default: false },
  labApprovedAt: Date,
  qcStatus: { type: String, enum: ['approved', 'rejected', 'pending'], default: 'pending' },
  qcNote: String,
}, { timestamps: true });

module.exports = mongoose.model('Approval', ApprovalSchema);
