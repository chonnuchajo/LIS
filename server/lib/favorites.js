// รายการโปรดของ sidebar (ผูกกับ user ด้วย email) — pure helpers ใช้ร่วมกับ routes/userFavorites.js
// mirror ของ src/lib/favorites.ts ฝั่ง frontend — MAX_FAVORITES ต้องตรงกัน

const MAX_FAVORITES = 20;
const MAX_PATH_LENGTH = 100;
// เพดานความยาว email แบบหลวม ๆ (RFC 5321 บอกว่า envelope รวมไม่เกิน 254) — เอาไว้กัน junk
// ยาว ๆ ไม่ได้ validate ตาม RFC เป๊ะ ๆ
const MAX_EMAIL_LENGTH = 254;
// รูปแบบคร่าว ๆ local@domain.tld — ตั้งใจไม่เข้มงวดเกินไป (ไม่ผูกกับ RFC 5322 เต็มรูปแบบ)
// เพราะจุดประสงค์คือกัน junk/พิมพ์ผิดหยาบ ๆ ไม่ใช่ยืนยันตัวตนผู้ใช้จริง
const EMAIL_SHAPE_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

// ตรวจ "รูปร่าง" email เท่านั้น — ห้ามเช็คกับ collection User เด็ดขาด: dev mode
// สังเคราะห์ user ที่ไม่มี User doc โดยตั้งใจ (src/config/dev.ts synthesizeDevUser,
// เช่น "lab-analyst.dev@icpladda.com") ซึ่งเป็นเหตุผลที่ feature นี้ผูกด้วย email
// ไม่ใช่ user id — เช็คกับ User จะทำ dev mode พังทั้งกระดาน
function isValidEmailShape(value) {
  const email = normalizeEmail(value);
  return email.length > 0 && email.length <= MAX_EMAIL_LENGTH && EMAIL_SHAPE_RE.test(email);
}

// รับ array ดิบจาก client แล้วคืนเฉพาะ path ที่ใช้ได้ — ไม่ตรวจว่ามีอยู่จริงใน NAV_ITEMS
// เพราะ server ไม่รู้จัก nav catalog ของ frontend (client กรองอีกชั้นตอน render)
function sanitizePaths(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of value) {
    if (typeof raw !== 'string') continue;
    const path = raw.trim();
    if (!path.startsWith('/') || path.length > MAX_PATH_LENGTH) continue;
    if (seen.has(path)) continue;
    seen.add(path);
    out.push(path);
    if (out.length >= MAX_FAVORITES) break;
  }
  return out;
}

module.exports = {
  MAX_FAVORITES,
  MAX_PATH_LENGTH,
  normalizeEmail,
  sanitizePaths,
  isValidEmailShape,
};
