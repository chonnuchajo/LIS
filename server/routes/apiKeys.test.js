const router = require('./apiKeys');
const { serializeKey, parseScopes, parseExpiresAt } = require('./apiKeys');

// ลำดับ register สำคัญ: '/:id' ต้องอยู่ท้ายสุด ไม่งั้นมันกลืน '/meta', '/logs',
// '/policy/:policyId' (บทเรียนเดิมจาก /stock/standards/in-use)
function registeredPaths(r) {
  return r.stack.filter((l) => l.route).map((l) => l.route.path);
}

describe('admin gate', () => {
  test('requireAdminUser ต้องเป็น middleware ตัวแรกของ router (ก่อน route จัดการ key ทุกตัว)', () => {
    expect(router.stack[0].handle.name).toBe('requireAdminUser');
  });
});

describe('ลำดับ route', () => {
  test('/meta, /logs, /policy/:policyId ต้องมาก่อน /:id', () => {
    const paths = registeredPaths(router);
    const idIndex = paths.indexOf('/:id');
    expect(idIndex).toBeGreaterThan(-1);
    for (const p of ['/meta', '/logs', '/policy/:policyId']) {
      expect(paths.indexOf(p)).toBeGreaterThan(-1);
      expect(paths.indexOf(p)).toBeLessThan(idIndex);
    }
  });
});

describe('serializeKey', () => {
  const NOW = new Date('2026-08-06T10:00:00Z');
  const doc = {
    _id: 'k1',
    name: 'Node-RED',
    keyPrefix: 'lisk_abc123',
    keyHash: 'x'.repeat(64),
    scopes: ['temphum:write'],
    expiresAt: null,
    revokedAt: null,
    rateLimitPerMinute: 120,
    lastUsedAt: null,
    usageCount: 3,
    createdBy: 'admin@icpladda.com',
    createdAt: new Date('2026-08-01T00:00:00Z'),
  };

  test('ไม่ส่ง keyHash ออกไปเด็ดขาด', () => {
    const out = serializeKey(doc, NOW);
    expect(out.keyHash).toBeUndefined();
    expect(Object.values(out)).not.toContain('x'.repeat(64));
  });

  test('แปลง _id เป็น id และคำนวณ status', () => {
    expect(serializeKey(doc, NOW).id).toBe('k1');
    expect(serializeKey(doc, NOW).status).toBe('active');
    expect(serializeKey({ ...doc, revokedAt: NOW }, NOW).status).toBe('revoked');
    expect(serializeKey({ ...doc, expiresAt: '2026-08-05T00:00:00Z' }, NOW).status).toBe('expired');
  });
});

describe('parseScopes', () => {
  test('รับ scope list ที่ถูกต้อง', () => {
    expect(parseScopes(['temphum:write', 'line:ingest'])).toEqual(['temphum:write', 'line:ingest']);
  });

  test('input ที่ไม่ใช่ array คืน []', () => {
    expect(parseScopes(undefined)).toEqual([]);
    expect(parseScopes(null)).toEqual([]);
    expect(parseScopes('temphum:write')).toEqual([]);
  });

  test('scope ที่ไม่รู้จัก throw พร้อมชื่อ scope นั้น', () => {
    expect(() => parseScopes(['temphum:write', 'bogus:scope'])).toThrow('bogus:scope');
  });
});

describe('parseExpiresAt', () => {
  test('undefined/null/"" คืน null', () => {
    expect(parseExpiresAt(undefined)).toBeNull();
    expect(parseExpiresAt(null)).toBeNull();
    expect(parseExpiresAt('')).toBeNull();
  });

  test('ISO string ที่ถูกต้องคืน Date', () => {
    const out = parseExpiresAt('2026-08-05T00:00:00Z');
    expect(out).toBeInstanceOf(Date);
    expect(out.toISOString()).toBe('2026-08-05T00:00:00.000Z');
  });

  test('ค่าที่ parse ไม่ได้ throw', () => {
    expect(() => parseExpiresAt('ไม่ใช่วันที่')).toThrow('วันหมดอายุไม่ถูกต้อง');
  });
});
