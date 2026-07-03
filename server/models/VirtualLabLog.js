const mongoose = require('mongoose');

const VirtualLabLogSchema = new mongoose.Schema({
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'VirtualLabRoom', required: true, index: true },
  virtualInstrumentId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  machine: { type: mongoose.Schema.Types.ObjectId, ref: 'Machine', required: true },
  oldStatus: { type: String, default: '' },
  newStatus: { type: String, required: true },
  note: { type: String, default: '' },
  actor: { type: String, default: 'system' },
}, { timestamps: true });

VirtualLabLogSchema.index({ room: 1, createdAt: -1 });

module.exports = mongoose.model('VirtualLabLog', VirtualLabLogSchema);
