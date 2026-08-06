const { createModeCache, resolveMode } = require('./policyModes');

describe('resolveMode', () => {
  const policy = { id: 'temphum-push', defaultMode: 'audit' };

  test('ไม่มีค่าใน DB → ใช้ defaultMode', () => {
    expect(resolveMode({}, policy)).toBe('audit');
    expect(resolveMode(null, policy)).toBe('audit');
  });

  test('มีค่าใน DB → ใช้ค่านั้น', () => {
    expect(resolveMode({ 'temphum-push': 'enforce' }, policy)).toBe('enforce');
  });
});

describe('createModeCache', () => {
  test('เรียก load ครั้งเดียวถ้ายังไม่หมดอายุแคช', async () => {
    let calls = 0;
    const cache = createModeCache({
      load: async () => { calls += 1; return { a: 'enforce' }; },
      ttlMs: 30000,
      now: () => 1000,
    });
    expect(await cache.get()).toEqual({ a: 'enforce' });
    await cache.get();
    expect(calls).toBe(1);
  });

  test('โหลดใหม่เมื่อเลย TTL', async () => {
    let calls = 0;
    let clock = 0;
    const cache = createModeCache({
      load: async () => { calls += 1; return { a: 'audit' }; },
      ttlMs: 30000,
      now: () => clock,
    });
    await cache.get();
    clock = 31000;
    await cache.get();
    expect(calls).toBe(2);
  });

  test('invalidate() บังคับโหลดใหม่ทันที', async () => {
    let calls = 0;
    const cache = createModeCache({
      load: async () => { calls += 1; return {}; },
      ttlMs: 30000,
      now: () => 1000,
    });
    await cache.get();
    cache.invalidate();
    await cache.get();
    expect(calls).toBe(2);
  });

  test('load พังแล้วไม่ค้าง — เรียกใหม่ได้', async () => {
    let calls = 0;
    const cache = createModeCache({
      load: async () => {
        calls += 1;
        if (calls === 1) throw new Error('db down');
        return { a: 'off' };
      },
      ttlMs: 30000,
      now: () => 1000,
    });
    await expect(cache.get()).rejects.toThrow('db down');
    expect(await cache.get()).toEqual({ a: 'off' });
  });
});
