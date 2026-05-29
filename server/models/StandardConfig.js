const mongoose = require('mongoose');

const StandardConfigSchema = new mongoose.Schema(
  {
    // keyword matched (contains, case-insensitive) against a product's commonName
    keyword: { type: String, required: true, trim: true },
    keywordLower: { type: String, required: true, unique: true, index: true },
    // how many times a standard is normally used on each instrument (null = not used)
    gcTimes: { type: Number, default: null },
    hplcTimes: { type: Number, default: null },
    note: { type: String, default: '' },
  },
  { timestamps: true },
);

module.exports = mongoose.model('StandardConfig', StandardConfigSchema);
