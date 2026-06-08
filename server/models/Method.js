const mongoose = require('mongoose');
const { softDeletePlugin } = require('../lib/softDelete');

const MethodSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  label: { type: String, required: true, trim: true },
  requiresMachine: { type: Boolean, default: false },
  machinePrefix: { type: String, default: '', uppercase: true, trim: true }, // used only when requiresMachine
  defaultTimes: { type: Number, default: 1, min: 1 },
  order: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  builtIn: { type: Boolean, default: false }, // GC/HPLC: cannot delete, cannot change requiresMachine/machinePrefix
}, { timestamps: true });

MethodSchema.plugin(softDeletePlugin);
module.exports = mongoose.model('Method', MethodSchema);
