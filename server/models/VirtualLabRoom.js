const mongoose = require('mongoose');

const VirtualInstrumentSchema = new mongoose.Schema({
  machine: { type: mongoose.Schema.Types.ObjectId, ref: 'Machine', required: true },
  x: { type: Number, default: 1 },
  y: { type: Number, default: 1 },
  status: {
    type: String,
    enum: ['idle', 'running', 'error', 'maintenance', 'offline'],
    default: 'idle',
    index: true,
  },
  note: { type: String, default: '' },
  updatedBy: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now },
}, { _id: true });

const VirtualLabRoomSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, index: true },
  instruments: { type: [VirtualInstrumentSchema], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('VirtualLabRoom', VirtualLabRoomSchema);
