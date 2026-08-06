const { normalizeRoles } = require('./roles');
const User = require('../models/User');

// ⚠️ ข้อจำกัดที่รู้ตัว: backend ยังไม่ verify token ของ Azure AD ฉะนั้น header
// X-LIS-User ปลอมได้ถ้าอยู่ในเน็ตเวิร์กและรู้อีเมล admin — ระดับความเชื่อถือ
// เท่ากับที่ทั้งระบบใช้อยู่ (หน้าเว็บ gate ด้วย FE อย่างเดียว) ตัวปิดรูนี้จริงๆ
// คือเฟส 2: verify Azure AD access token ฝั่ง server
// ดู docs/superpowers/specs/2026-08-06-api-keys-and-api-protection-design.md ข้อ 4.4
function createAdminGate({ findUserByEmail, isDevBypass, warn = console.warn }) {
  return async function requireAdminUser(req, res, next) {
    if (isDevBypass()) {
      warn('[adminGate] ข้ามการตรวจสิทธิ์ (ALLOW_DEV_STATUS=true) — ห้ามตั้งค่านี้บน production');
      return next();
    }
    const email = String(req.get('x-lis-user') || '').trim().toLowerCase();
    if (!email) {
      return res.status(401).json({ error: { message: 'ต้องระบุผู้ใช้ (header X-LIS-User)' } });
    }
    let user;
    try {
      user = await findUserByEmail(email);
    } catch (err) {
      return res.status(500).json({ error: { message: `ตรวจสอบสิทธิ์ไม่สำเร็จ: ${err.message}` } });
    }
    if (!user || !normalizeRoles(user).includes('admin')) {
      return res.status(403).json({ error: { message: 'เฉพาะผู้ดูแลระบบเท่านั้น' } });
    }
    req.adminUser = { email, name: user.name };
    return next();
  };
}

const requireAdminUser = createAdminGate({
  findUserByEmail: (email) => User.findOne({ email }).lean(),
  isDevBypass: () => process.env.ALLOW_DEV_STATUS === 'true',
});

module.exports = { createAdminGate, requireAdminUser };
