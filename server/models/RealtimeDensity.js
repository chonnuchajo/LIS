const mongoose = require('mongoose');
const { softDeletePlugin } = require('../lib/softDelete');

const RealtimeDensitySchema = new mongoose.Schema({
  sampleId: { type: String, required: true },
  sampleName: { type: String, required: true },
  density: { type: Number, required: true },
  sentAt: { type: String, required: true },
}, { timestamps: true });

RealtimeDensitySchema.index({ sampleId: 1, deletedAt: 1 }, { unique: true });

RealtimeDensitySchema.plugin(softDeletePlugin);
module.exports = mongoose.model('RealtimeDensity', RealtimeDensitySchema);
