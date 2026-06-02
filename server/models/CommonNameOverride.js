const mongoose = require('mongoose');

const CommonNameOverrideSchema = new mongoose.Schema({
  raw: { type: String, required: true, trim: true },
  rawKey: { type: String, required: true, unique: true, index: true },
  canonical: { type: String, required: true, trim: true },
  note: { type: String, default: '', trim: true },
}, { timestamps: true });

module.exports = mongoose.model('CommonNameOverride', CommonNameOverrideSchema);
