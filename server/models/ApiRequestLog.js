const mongoose = require('mongoose');

// log การเรียก endpoint ที่อยู่ใน policy registry — ใช้ตัดสินใจตอนสลับ audit → enforce
// ไม่ใส่ softDeletePlugin: เป็น log ล้วน ลบทิ้งอัตโนมัติด้วย TTL
// ⚠️ collection นี้ถูกข้ามใน export-data.js (ไม่มีค่าเชิงกู้คืน + churn ทุกชั่วโมง)
//
// ต้อง validate เอง: Number('ค่าพิมพ์ผิด') = NaN → expireAfterSeconds: NaN → syncIndexes()
// (เรียกทุก boot ใน ensureCollections()) reject แล้ว server/index.js สั่ง process.exit(1) แค่
// เพราะ .env พิมพ์ตัวเลขผิด ต้อง fallback เป็น 30 วันแทนที่จะปล่อยให้ค่าพังไหลไปถึง Mongoose
function parseTtlDays(raw) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 30;
}
const TTL_DAYS = parseTtlDays(process.env.API_LOG_TTL_DAYS);

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

// ไม่มี index({at:-1}) แยกต่างหาก — ดัชนี TTL {at:1} ข้างล่างใช้เดินย้อนกลับ (reverse traversal)
// รองรับ .sort({at:-1}) (ดู routes/apiKeys.js GET /logs) ได้อยู่แล้ว ไม่ต้องมีดัชนีซ้ำอีกตัว
ApiRequestLogSchema.index({ at: 1 }, { expireAfterSeconds: TTL_DAYS * 24 * 60 * 60 });

module.exports = mongoose.model('ApiRequestLog', ApiRequestLogSchema);
module.exports.parseTtlDays = parseTtlDays;
