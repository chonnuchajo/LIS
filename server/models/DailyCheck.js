const mongoose = require('mongoose');

const DailyCheckSchema = new mongoose.Schema({
  scaleId: { type: String, required: true, index: true },
  scaleName: { type: String, required: true },
  model: { type: String, default: '' },

  weights100: { type: [String], validate: v => Array.isArray(v) && v.length === 3 },
  weights10: { type: [String], validate: v => Array.isArray(v) && v.length === 3 },
  avg100: { type: Number, required: true },
  avg10: { type: Number, required: true },

  status100: { type: String, enum: ['pass', 'fail'], required: true },
  status10: { type: String, enum: ['pass', 'fail'], required: true },
  status: { type: String, enum: ['pass', 'fail'], required: true, index: true },
  tolerance: { type: Number, default: 0.05 },

  recorder: { type: String, required: true },
  recorderId: { type: String, default: '' },
  recorderEmail: { type: String, default: '' },

  // YYYY-MM-DD (สำหรับ filter ตามวันแบบเร็ว)
  date: { type: String, required: true, index: true },
  checkedAt: { type: Date, required: true, default: Date.now },
}, { timestamps: true });

DailyCheckSchema.index({ date: -1, scaleId: 1 });

module.exports = mongoose.model('DailyCheck', DailyCheckSchema);
