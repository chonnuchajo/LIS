const router = require('./apiKeys');
const { serializeKey } = require('./apiKeys');

// ลำดับ register สำคัญ: '/:id' ต้องอยู่ท้ายสุด ไม่งั้นมันกลืน '/meta', '/logs',
// '/policy/:policyId' (บทเรียนเดิมจาก /stock/standards/in-use)
function registeredPaths(r) {
  return r.stack.filter((l) => l.route).map((l) => l.route.path);
}

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
