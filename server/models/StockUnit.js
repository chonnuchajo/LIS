const mongoose = require('mongoose');

const VolumeSchema = new mongoose.Schema({
  initial: { type: Number, default: 0 },
  remaining: { type: Number, default: 0 },
  unit: { type: String, enum: ['ml', 'mg', 'g'], default: 'ml' },
}, { _id: false });

const PersonSchema = new mongoose.Schema({
  email: { type: String, default: '' },
  name: { type: String, default: '' },
}, { _id: false });

const StockUnitSchema = new mongoose.Schema({
  qrId: { type: String, required: true, unique: true, index: true },
  itemCode: { type: String, required: true, index: true },
  itemName: { type: String, default: '' },
  kind: { type: String, enum: ['sealed', 'working'], required: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockUnit', default: null },
  lotNo: { type: String, default: '' },
  exp: { type: Date, default: null },
  volume: { type: VolumeSchema, default: () => ({}) },
  status: { type: String, enum: ['active', 'empty', 'discarded'], default: 'active', index: true },
  receivedDate: { type: Date, default: null },
  withdrawnDate: { type: Date, default: null },
  discardedAt: { type: Date, default: null },
  discardedBy: { type: PersonSchema, default: undefined },
  discardReason: { type: String, default: '' },
  createdBy: { type: PersonSchema, default: undefined },
}, { timestamps: true });

StockUnitSchema.index({ exp: 1 });

module.exports = mongoose.model('StockUnit', StockUnitSchema);
