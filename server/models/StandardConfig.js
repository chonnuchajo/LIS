const mongoose = require('mongoose');

const UNITS = ['ml', 'µL', 'ppm', 'mg'];

const InstrumentConfigSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    unit: { type: String, enum: UNITS, default: 'ml' },
    slots: { type: [Number], default: [] },
  },
  { _id: false },
);

const StandardConfigSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    nameLower: { type: String, required: true, unique: true, index: true },
    isManual: { type: Boolean, default: false },
    gc: { type: InstrumentConfigSchema, default: () => ({}) },
    hplc: { type: InstrumentConfigSchema, default: () => ({}) },
  },
  { timestamps: true },
);

StandardConfigSchema.statics.UNITS = UNITS;

module.exports = mongoose.model('StandardConfig', StandardConfigSchema);
