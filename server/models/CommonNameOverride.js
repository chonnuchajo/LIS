const mongoose = require('mongoose');
const { softDeletePlugin } = require('../lib/softDelete');

const CommonNameOverrideSchema = new mongoose.Schema({
  raw: { type: String, required: true, trim: true },
  rawKey: { type: String, required: true, unique: true },
  canonical: { type: String, required: true, trim: true },
  note: { type: String, default: '', trim: true },
}, { timestamps: true });

CommonNameOverrideSchema.plugin(softDeletePlugin);
module.exports = mongoose.model('CommonNameOverride', CommonNameOverrideSchema);
