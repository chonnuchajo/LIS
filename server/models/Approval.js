const mongoose = require('mongoose');
const { softDeletePlugin } = require('../lib/softDelete');

const ApprovalSchema = new mongoose.Schema({
  sampleId: { type: String, required: true },
  labApproved: { type: Boolean, default: false },
  labApprovedAt: Date,
  qcStatus: { type: String, enum: ['approved', 'rejected', 'pending'], default: 'pending' },
  qcNote: String,
}, { timestamps: true });

ApprovalSchema.index({ sampleId: 1, deletedAt: 1 }, { unique: true });

ApprovalSchema.plugin(softDeletePlugin);
module.exports = mongoose.model('Approval', ApprovalSchema);
