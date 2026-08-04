const mongoose = require('mongoose');

const CoaAuditLogSchema = new mongoose.Schema(
  {
    coaId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoaDocument', required: true, index: true },
    coaNo: String,
    petitionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Petition', index: true },
    petitionNo: String,
    event: {
      type: String,
      required: true,
      enum: [
        'created',
        'updated',
        'submitted',
        'approved',
        'rejected',
        'revisionCreated',
        'revisionSubmitted',
        'revisionApproved',
        'superseded',
        'cancelled',
        'printed',
      ],
      index: true,
    },
    actor: { name: String, email: String, role: String },
    note: String,
    metadata: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true },
);

CoaAuditLogSchema.index({ coaId: 1, createdAt: -1 });
CoaAuditLogSchema.index({ event: 1, createdAt: -1 });

module.exports = mongoose.model('CoaAuditLog', CoaAuditLogSchema);
