const mongoose = require('mongoose');

const PhysicalResultSchema = new mongoose.Schema({
  sampleId: { type: String, required: true, unique: true },
  density: String,
  densityStatus: { type: String, enum: ['normal', 'abnormal'] },
  dissolutionValue: String,
  dissolutionStatus: { type: String, enum: ['normal', 'abnormal'] },
  physicalStatus: { type: String, enum: ['normal', 'abnormal'] },
  colorMatch: { type: String, enum: ['match', 'mismatch'] },
  colorNote: String,
  photoUrl: String,
  status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
  completedAt: String,
}, { timestamps: true });

module.exports = mongoose.model('PhysicalResult', PhysicalResultSchema);
