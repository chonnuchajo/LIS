const mongoose = require('mongoose');
const { softDeletePlugin } = require('../lib/softDelete');

const MachineSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, index: true },
  type: { type: String, default: '' },
  registerNo: { type: String, default: '' },
  name: { type: String, required: true, index: true },
  manufacturer: { type: String, default: '' },
  model: { type: String, default: '' },
  serialNo: { type: String, default: '' },
  manualDoc: { type: String, default: '' },
  installDate: { type: String, default: '' },
  startDate: { type: String, default: '' },
  location: { type: String, default: '', index: true },
  status: { type: String, enum: ['active', 'inactive', 'retired'], default: 'active' },
  note: { type: String, default: '' },
}, { timestamps: true });

MachineSchema.plugin(softDeletePlugin);
module.exports = mongoose.model('Machine', MachineSchema);
