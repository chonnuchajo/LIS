const mongoose = require('mongoose');

const StandardConfigSchema = new mongoose.Schema(
  {
    // one row = one method (validated against the Method registry, not a fixed enum)
    instrument: { type: String, required: true, trim: true, uppercase: true },
    // 'all' = per-instrument default (non-deletable); 'substance' = per-commonName override
    scope: { type: String, enum: ['all', 'substance'], required: true },
    commonName: { type: String, default: null, trim: true }, // null when scope='all'
    commonNameLower: { type: String, default: null }, // lowercased; null when scope='all'
    times: { type: Number, required: true, min: 1 }, // จำนวนครั้งที่ใช้ standard
    isDefault: { type: Boolean, default: false }, // true → cannot be deleted
    note: { type: String, default: '' },
  },
  { timestamps: true },
);

// One row per (instrument, scope, commonName). Defaults differ by instrument
// (commonNameLower null), so they never collide; substance rows are unique per
// (instrument, commonName).
StandardConfigSchema.index(
  { instrument: 1, scope: 1, commonNameLower: 1 },
  { unique: true },
);

module.exports = mongoose.model('StandardConfig', StandardConfigSchema);
