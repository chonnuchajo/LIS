const mongoose = require('mongoose');

const RealtimeDensitySchema = new mongoose.Schema({
  sampleId: { type: String, required: true, unique: true },
  sampleName: { type: String, required: true },
  density: { type: Number, required: true },
  sentAt: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('RealtimeDensity', RealtimeDensitySchema);
