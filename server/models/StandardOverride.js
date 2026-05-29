const mongoose = require('mongoose');

const UNITS = ['ml', 'µL', 'ppm', 'mg'];
const MATCH_TYPES = ['substring', 'substance', 'commonName'];
const SCOPES = ['substanceOnly', 'wholeCommonName'];

const InstrumentConfigSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    unit: { type: String, enum: UNITS, default: 'ml' },
    slots: { type: [Number], default: [] },
  },
  { _id: false },
);

const StandardOverrideSchema = new mongoose.Schema(
  {
    matchType: { type: String, enum: MATCH_TYPES, required: true },
    matchValue: { type: String, required: true },
    matchValueLower: { type: String, required: true },
    scope: { type: String, enum: SCOPES, default: 'substanceOnly' },
    note: { type: String, default: '' },
    priority: { type: Number, default: 0 },
    gc: { type: InstrumentConfigSchema, default: () => ({}) },
    hplc: { type: InstrumentConfigSchema, default: () => ({}) },
  },
  { timestamps: true },
);

StandardOverrideSchema.index({ matchType: 1, matchValueLower: 1 }, { unique: true });

StandardOverrideSchema.statics.UNITS = UNITS;
StandardOverrideSchema.statics.MATCH_TYPES = MATCH_TYPES;
StandardOverrideSchema.statics.SCOPES = SCOPES;

module.exports = mongoose.model('StandardOverride', StandardOverrideSchema);
