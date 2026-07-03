const mongoose = require('mongoose');

const StandardTimeSchema = new mongoose.Schema({
  importKey: { type: String, required: true, unique: true, index: true },
  sourceFile: { type: String, default: '' },
  sourceSheet: { type: String, required: true, index: true },
  rowNo: { type: Number, default: 0 },

  instrument: { type: String, required: true, index: true },
  machineType: { type: String, default: '', index: true },
  analysisName: { type: String, required: true, index: true },
  normalizedAnalysisName: { type: String, required: true, index: true },
  columnDimension: { type: String, default: '' },

  mobilePhaseTopUpMin: { type: Number, default: null },
  samplePrepPerBatchMin: { type: Number, default: null },
  standardPrepMin: { type: Number, default: null },
  stockStdFrequencyCount: { type: Number, default: null },
  stockStdFrequencyUnit: { type: String, default: '' },
  stockStdFrequencyDays: { type: Number, default: null },
  instrumentSetupMin: { type: Number, default: null },

  standardCycleMin: { type: Number, default: null },
  totalInjectionsPerBatch: { type: Number, default: null },
  machineRunTotalMin: { type: Number, default: null },
  machineRunText: { type: String, default: '' },

  dataProcessingMin: { type: Number, default: null },
  recordResultMin: { type: Number, default: null },
  reportingMin: { type: Number, default: null },
  standardTimeMin: { type: Number, default: null },
  standardTimeText: { type: String, default: '' },
  hasData: { type: Boolean, default: false, index: true },
  note: { type: String, default: '' },

  importedAt: { type: Date, default: Date.now },
}, { timestamps: true });

StandardTimeSchema.index({ instrument: 1, normalizedAnalysisName: 1, columnDimension: 1 });

module.exports = mongoose.model('StandardTime', StandardTimeSchema);
