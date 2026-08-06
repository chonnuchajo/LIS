const mongoose = require('mongoose');

// log การเรียก endpoint ที่อยู่ใน policy registry — ใช้ตัดสินใจตอนสลับ audit → enforce
// ไม่ใส่ softDeletePlugin: เป็น log ล้วน ลบทิ้งอัตโนมัติด้วย TTL
// ⚠️ collection นี้ถูกข้ามใน export-data.js (ไม่มีค่าเชิงกู้คืน + churn ทุกชั่วโมง)
const TTL_DAYS = Number(process.env.API_LOG_TTL_DAYS || 30);

const ApiRequestLogSchema = new mongoose.Schema({
  at: { type: Date, default: Date.now },
  keyId: { type: mongoose.Schema.Types.ObjectId, ref: 'ApiKey', default: null },
  keyName: { type: String, default: '' },
  method: { type: String, default: '' },
  path: { type: String, default: '' },
  policyId: { type: String, default: '', index: true },
  mode: { type: String, enum: ['off', 'audit', 'enforce'], default: 'audit' },
  outcome: {
    type: String,
    enum: ['allowed', 'legacy-token', 'audit-pass', 'denied', 'rate-limited'],
    required: true,
  },
  reason: { type: String, default: '' },
  ip: { type: String, default: '' },
  status: { type: Number, default: 200 },
}, { versionKey: false });

ApiRequestLogSchema.index({ at: -1 });
ApiRequestLogSchema.index({ at: 1 }, { expireAfterSeconds: TTL_DAYS * 24 * 60 * 60 });

module.exports = mongoose.model('ApiRequestLog', ApiRequestLogSchema);
