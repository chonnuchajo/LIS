const {
  generateApiKey,
  hashApiKey,
  keyStatus,
  evaluateKey,
  checkRateLimit,
} = require('./apiKeyAuth');

const POLICY = { id: 'temphum-push', scope: 'temphum:write' };
const NOW = new Date('2026-08-06T10:00:00Z');

describe('generateApiKey', () => {
  test('ขึ้นต้นด้วย lisk_ และสุ่มไม่ซ้ำ', () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.rawKey.startsWith('lisk_')).toBe(true);
    expect(a.rawKey.length).toBeGreaterThan(40);
    expect(a.rawKey).not.toBe(b.rawKey);
  });

  test('keyHash = sha256 ของ key เต็ม และ keyPrefix เป็น 12 ตัวแรก', () => {
    const { rawKey, keyHash, keyPrefix } = generateApiKey();
    expect(keyHash).toBe(hashApiKey(rawKey));
    expect(keyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(keyPrefix).toBe(rawKey.slice(0, 12));
  });
});

describe('keyStatus', () => {
  test('เพิกถอนแล้ว → revoked (สำคัญกว่าหมดอายุ)', () => {
    expect(keyStatus({ revokedAt: NOW, expiresAt: null }, NOW)).toBe('revoked');
  });
  test('เลยวันหมดอายุ → expired', () => {
    expect(keyStatus({ expiresAt: '2026-08-01T00:00:00Z' }, NOW)).toBe('expired');
  });
  test('ไม่ตั้งวันหมดอายุ → active', () => {
    expect(keyStatus({ expiresAt: null }, NOW)).toBe('active');
  });
});

describe('evaluateKey', () => {
  const activeKey = { _id: 'k1', scopes: ['temphum:write'], expiresAt: null, revokedAt: null };

  test('key ถูกต้องและมี scope → allow', () => {
    expect(evaluateKey({ rawKeyPresented: true, keyDoc: activeKey, policy: POLICY, now: NOW }))
      .toEqual({ decision: 'allow', reason: 'ok', status: 200 });
  });

  test('ไม่ส่ง key มาเลย → no-key / 401', () => {
    const r = evaluateKey({ rawKeyPresented: false, keyDoc: null, policy: POLICY, now: NOW });
    expect(r).toEqual({ decision: 'deny', reason: 'no-key', status: 401 });
  });

  test('ส่ง key มาแต่หาไม่เจอ → unknown-key / 401', () => {
    const r = evaluateKey({ rawKeyPresented: true, keyDoc: null, policy: POLICY, now: NOW });
    expect(r).toEqual({ decision: 'deny', reason: 'unknown-key', status: 401 });
  });

  test('key ถูกเพิกถอน → revoked / 401', () => {
    const r = evaluateKey({
      rawKeyPresented: true,
      keyDoc: { ...activeKey, revokedAt: '2026-08-05T00:00:00Z' },
      policy: POLICY,
      now: NOW,
    });
    expect(r.reason).toBe('revoked');
    expect(r.status).toBe(401);
  });

  test('key หมดอายุ → expired / 401', () => {
    const r = evaluateKey({
      rawKeyPresented: true,
      keyDoc: { ...activeKey, expiresAt: '2026-08-05T00:00:00Z' },
      policy: POLICY,
      now: NOW,
    });
    expect(r.reason).toBe('expired');
  });

  test('scope ไม่ครอบ endpoint นี้ → missing-scope / 403', () => {
    const r = evaluateKey({
      rawKeyPresented: true,
      keyDoc: { ...activeKey, scopes: ['line:ingest'] },
      policy: POLICY,
      now: NOW,
    });
    expect(r).toEqual({ decision: 'deny', reason: 'missing-scope', status: 403 });
  });
});

describe('checkRateLimit', () => {
  const T = Date.parse('2026-08-06T10:00:30Z');

  test('นับสะสมในนาทีเดียวกัน และบล็อกเมื่อเกิน', () => {
    const state = new Map();
    expect(checkRateLimit(state, 'k1', 2, T)).toEqual({ allowed: true, count: 1 });
    expect(checkRateLimit(state, 'k1', 2, T)).toEqual({ allowed: true, count: 2 });
    expect(checkRateLimit(state, 'k1', 2, T)).toEqual({ allowed: false, count: 3 });
  });

  test('ข้ามนาทีแล้วรีเซ็ต', () => {
    const state = new Map();
    checkRateLimit(state, 'k1', 1, T);
    expect(checkRateLimit(state, 'k1', 1, T + 60000).allowed).toBe(true);
  });

  test('limit = 0 คือไม่จำกัด', () => {
    const state = new Map();
    for (let i = 0; i < 50; i += 1) {
      expect(checkRateLimit(state, 'k1', 0, T).allowed).toBe(true);
    }
  });

  test('แยกโควตาตาม key', () => {
    const state = new Map();
    checkRateLimit(state, 'k1', 1, T);
    expect(checkRateLimit(state, 'k2', 1, T).allowed).toBe(true);
  });
});
