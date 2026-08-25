const mongoose = require('mongoose');

// รายการโปรดบน sidebar ของผู้ใช้แต่ละคน
// key ด้วย email ไม่ใช่ user _id เพราะ dev mode (src/config/dev.ts synthesizeDevUser)
// ใช้ id สังเคราะห์ที่ไม่มี User doc รองรับ แต่มี email เสมอทั้ง dev/prod
const UserFavoriteSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    paths: { type: [String], default: [] },
  },
  { timestamps: true },
);

// Upsert-only config (เหมือน DashboardLayoutConfig / EnvRoomConfig) — ไม่มี route ลบ doc
// จึงไม่ใส่ softDeletePlugin การเอาออกจากรายการโปรดคือการเขียน paths ใหม่
UserFavoriteSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model('UserFavorite', UserFavoriteSchema);
