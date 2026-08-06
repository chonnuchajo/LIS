const mongoose = require('mongoose');
const { softDeletePlugin } = require('../lib/softDelete');

// API key สำหรับระบบภายนอก (Node-RED, n8n, ระบบ production) — ดู
// server/lib/apiPolicy.js ว่า scope ไหนเปิด endpoint อะไร
// เก็บเฉพาะ sha256 hash: ค่า key เต็มโชว์ครั้งเดียวตอนสร้างแล้วไม่มีที่ไหนเก็บอีก
// (seed-data/*.json เข้า git ด้วย)
const ApiKeySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  keyPrefix: { type: String, required: true, index: true },
  keyHash: { type: String, required: true }, // ดูดัชนี compound unique {keyHash,deletedAt} ด้านล่าง — ครอบ lookup อยู่แล้ว ไม่ต้องมี index เดี่ยวซ้ำ
  scopes: { type: [String], default: [] },
  expiresAt: { type: Date, default: null },
  revokedAt: { type: Date, default: null },
  revokedBy: { type: String, default: '' },
  rateLimitPerMinute: { type: Number, default: 120, min: 0 },
  lastUsedAt: { type: Date, default: null },
  usageCount: { type: Number, default: 0 },
  createdBy: { type: String, default: '' },
}, { timestamps: true });

// กัน hash หลุดออก API ทุกทาง (res.json(doc) เรียก toJSON ให้เอง)
ApiKeySchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.keyHash;
    return ret;
  },
});

// unique keyHash ในแถวที่ยังไม่ถูกลบ (compound กับ deletedAt — soft-delete pattern)
ApiKeySchema.index({ keyHash: 1, deletedAt: 1 }, { unique: true });

ApiKeySchema.plugin(softDeletePlugin);
module.exports = mongoose.model('ApiKey', ApiKeySchema);
