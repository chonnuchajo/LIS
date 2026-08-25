const crypto = require('crypto');

const KEY_PREFIX_LENGTH = 12;

// sha256 พอสำหรับ key ที่ระบบสุ่มเอง (เอนโทรปี 256 บิต) — ไม่ใช้ bcrypt เพราะต้อง
// ตรวจทุก request และต้อง lookup ด้วย unique index
function hashApiKey(rawKey) {
  return crypto.createHash('sha256').update(String(rawKey)).digest('hex');
}

function generateApiKey() {
  const rawKey = `lisk_${crypto.randomBytes(32).toString('base64url')}`;
  return {
    rawKey,
    keyHash: hashApiKey(rawKey),
    keyPrefix: rawKey.slice(0, KEY_PREFIX_LENGTH),
  };
}

function keyStatus(keyDoc, now = new Date()) {
  if (!keyDoc) return 'unknown';
  if (keyDoc.revokedAt) return 'revoked';
  if (keyDoc.expiresAt && new Date(keyDoc.expiresAt).getTime() <= new Date(now).getTime()) {
    return 'expired';
  }
  return 'active';
}

const DENY_STATUS = {
  'no-key': 401,
  'unknown-key': 401,
  revoked: 401,
  expired: 401,
  'missing-scope': 403,
  'rate-limited': 429,
};

const deny = (reason) => ({ decision: 'deny', reason, status: DENY_STATUS[reason] });

function evaluateKey({ rawKeyPresented, keyDoc, policy, now = new Date() }) {
  if (!rawKeyPresented) return deny('no-key');
  if (!keyDoc) return deny('unknown-key');
  const status = keyStatus(keyDoc, now);
  if (status === 'revoked') return deny('revoked');
  if (status === 'expired') return deny('expired');
  if (policy?.scope && !(keyDoc.scopes || []).includes(policy.scope)) return deny('missing-scope');
  return { decision: 'allow', reason: 'ok', status: 200 };
}

// Fixed window 1 นาที เก็บใน memory (เซิร์ฟเวอร์รันโปรเซสเดียว) รีเซ็ตตอน restart
function checkRateLimit(state, keyId, limitPerMinute, nowMs = Date.now()) {
  const limit = Number(limitPerMinute) || 0;
  if (limit <= 0) return { allowed: true, count: 0 };
  const windowStart = Math.floor(nowMs / 60000) * 60000;
  const entry = state.get(keyId);
  if (!entry || entry.windowStart !== windowStart) {
    state.set(keyId, { windowStart, count: 1 });
    return { allowed: true, count: 1 };
  }
  entry.count += 1;
  return { allowed: entry.count <= limit, count: entry.count };
}

module.exports = {
  KEY_PREFIX_LENGTH,
  DENY_STATUS,
  hashApiKey,
  generateApiKey,
  keyStatus,
  evaluateKey,
  checkRateLimit,
};
