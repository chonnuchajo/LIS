const mongoose = require('mongoose');

// Generic per-instrument daily working-check, keyed by room.
// Phase 1 user: ห้องเตรียมตัวอย่าง (roomSlug "sample-prep").
const ReadingSchema = new mongoose.Schema({
  key: { type: String, required: true },     // "temp" | "ph"
  label: { type: String, default: '' },      // "อุณหภูมิ" | "pH"
  value: { type: Number, required: true },
  unit: { type: String, default: '' },       // "°C" | ""
}, { _id: false });

const EquipmentCheckSchema = new mongoose.Schema({
  roomSlug: { type: String, required: true, index: true },
  instrumentId: { type: String, required: true, index: true },
  instrumentName: { type: String, required: true },
  brand: { type: String, default: '' },

  status: { type: String, enum: ['normal', 'abnormal'], required: true, index: true },
  readings: { type: [ReadingSchema], default: [] },
  note: { type: String, default: '' },

  recorder: { type: String, required: true },
  recorderId: { type: String, default: '' },
  recorderEmail: { type: String, default: '' },

  date: { type: String, required: true, index: true }, // YYYY-MM-DD
  period: { type: String, enum: ['morning', 'afternoon'], index: true },
  checkedAt: { type: Date, required: true, default: Date.now },
}, { timestamps: true });

EquipmentCheckSchema.index({ roomSlug: 1, date: -1, instrumentId: 1 });
EquipmentCheckSchema.index({ roomSlug: 1, date: -1, period: 1, instrumentId: 1 });

module.exports = mongoose.model('EquipmentCheck', EquipmentCheckSchema);
