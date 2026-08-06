// รายการโปรดของ sidebar (ผูกกับ user ด้วย email) — pure helpers ใช้ร่วมกับ routes/userFavorites.js
// mirror ของ src/lib/favorites.ts ฝั่ง frontend — MAX_FAVORITES ต้องตรงกัน

const MAX_FAVORITES = 20;
const MAX_PATH_LENGTH = 100;

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
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

module.exports = { MAX_FAVORITES, MAX_PATH_LENGTH, normalizeEmail, sanitizePaths };
