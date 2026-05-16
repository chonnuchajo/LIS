const mongoose = require('mongoose');

const PetitionAuditLogSchema = new mongoose.Schema(
  {
    petitionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Petition',
      required: true,
      index: true,
    },
    petitionNo: { type: String, required: true, index: true },
    event: {
      type: String,
      enum: ['created', 'statusChanged', 'assigned', 'reviewed', 'updated', 'deleted'],
      required: true,
    },
    fromStatus: { type: String },
    toStatus: { type: String },
    actor: { type: String, default: 'system' },
    note: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

PetitionAuditLogSchema.index({ petitionId: 1, createdAt: -1 });
PetitionAuditLogSchema.index({ createdAt: -1 });
PetitionAuditLogSchema.index({ event: 1, createdAt: -1 });
PetitionAuditLogSchema.index({ toStatus: 1, createdAt: -1 });

module.exports = mongoose.model('PetitionAuditLog', PetitionAuditLogSchema);
