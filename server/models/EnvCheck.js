const mongoose = require('mongoose');

const EnvCheckSchema = new mongoose.Schema({
  room: { type: String, enum: ['balance', 'sample-prep', 'analysis'], required: true, index: true },
  roomName: { type: String, required: true },

  temperature: { type: Number, required: true },
  humidity: { type: Number, required: true },

  // snapshot ของเกณฑ์ที่ใช้ตอนบันทึก
  tempMin: { type: Number, required: true },
  tempMax: { type: Number, required: true },
  humidityMax: { type: Number, required: true },

  tempStatus: { type: String, enum: ['pass', 'fail'], required: true },
  humidityStatus: { type: String, enum: ['pass', 'fail'], required: true },
  status: { type: String, enum: ['pass', 'fail'], required: true, index: true },

  note: { type: String, default: '' },

  recorder: { type: String, required: true },
  recorderId: { type: String, default: '' },
  recorderEmail: { type: String, default: '' },

  // YYYY-MM-DD (filter ตามวันแบบเร็ว)
  date: { type: String, required: true, index: true },
  checkedAt: { type: Date, required: true, default: Date.now },
}, { timestamps: true });

EnvCheckSchema.index({ date: -1, room: 1 });

module.exports = mongoose.model('EnvCheck', EnvCheckSchema);
