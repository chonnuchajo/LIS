const mongoose = require('mongoose');
const { softDeletePlugin } = require('../lib/softDelete');

const CommonNameOverrideSchema = new mongoose.Schema({
  raw: { type: String, required: true, trim: true },
  rawKey: { type: String, required: true },
  canonical: { type: String, required: true, trim: true },
  note: { type: String, default: '', trim: true },
}, { timestamps: true });

CommonNameOverrideSchema.index({ rawKey: 1, deletedAt: 1 }, { unique: true });

CommonNameOverrideSchema.plugin(softDeletePlugin);
module.exports = mongoose.model('CommonNameOverride', CommonNameOverrideSchema);
