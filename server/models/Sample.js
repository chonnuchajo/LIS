const mongoose = require('mongoose');
const { softDeletePlugin } = require('../lib/softDelete');

const SampleSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  sender: String,
  receiver: String,
  instrument: String,
  density: Number,
  aiPercent: Number,
  preResult: Number,
  status: { type: String, enum: ['sent', 'physical', 'testing', 'done'], required: true },
  batchNo: String,
  mfgDate: String,
  note: String,
  userEmail: String,
}, { timestamps: true });

SampleSchema.plugin(softDeletePlugin);
module.exports = mongoose.model('Sample', SampleSchema);
