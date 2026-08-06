const { createApiGuard, extractCredential } = require('./apiGuard');
const { hashApiKey } = require('./apiKeyAuth');

const POLICIES = [
  {
    id: 'temphum-push', methods: ['POST'], prefix: '/temphum', exact: true,
    scope: 'temphum:write', label: 'push', defaultMode: 'audit', legacyEnv: null,
  },
  {
    id: 'line-ingest', methods: ['POST'], prefix: '/line/ingest',
    scope: 'line:ingest', label: 'ingest', defaultMode: 'audit', legacyEnv: 'LINE_INGEST_SECRET',
  },
];

const RAW = 'lisk_testkey';
const KEY_DOC = { _id: 'k1', name: 'Node-RED', scopes: ['temphum:write'], expiresAt: null, revokedAt: null, rateLimitPerMinute: 0 };

function makeReq({ method = 'POST', url = '/LIS/api/temphum', headers = {} } = {}) {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    method,
    originalUrl: url,
    query: {},
    ip: '10.0.0.9',
    get: (name) => lower[String(name).toLowerCase()],
  };
}

function makeRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return res;
}

function setup({ modes = {}, keys = { [hashApiKey(RAW)]: KEY_DOC }, env = {} } = {}) {
  const logs = [];
  const touched = [];
  const guard = createApiGuard({
    policies: POLICIES,
    getModes: async () => modes,
    findKeyByHash: async (hash) => keys[hash] || null,
    logRequest: async (doc) => { logs.push(doc); },
    touchKey: async (id) => { touched.push(id); },
    readEnv: (name) => env[name],
    rateState: new Map(),
    now: () => new Date('2026-08-06T10:00:00Z'),
  });
  return { guard, logs, touched };
}

test('path ที่ไม่อยู่ในทะเบียน → ผ่านทันที ไม่ log', async () => {
  const { guard, logs } = setup();
  const res = makeRes();
  let called = false;
  await guard(makeReq({ method: 'GET', url: '/LIS/api/petitions' }), res, () => { called = true; });
  expect(called).toBe(true);
  expect(logs).toHaveLength(0);
});

test('โหมด off → ผ่าน ไม่ log', async () => {
  const { guard, logs } = setup({ modes: { 'temphum-push': 'off' } });
  let called = false;
  await guard(makeReq(), makeRes(), () => { called = true; });
  expect(called).toBe(true);
  expect(logs).toHaveLength(0);
});

test('โหมด audit + ไม่มี key → ปล่อยผ่าน แต่ log ว่าจะโดน no-key', async () => {
  const { guard, logs } = setup({ modes: { 'temphum-push': 'audit' } });
  let called = false;
  await guard(makeReq(), makeRes(), () => { called = true; });
  expect(called).toBe(true);
  expect(logs[0]).toMatchObject({
    policyId: 'temphum-push', mode: 'audit', outcome: 'audit-pass', reason: 'no-key', path: '/temphum',
  });
});

test('โหมด enforce + ไม่มี key → 401 ไม่เรียก next', async () => {
  const { guard, logs } = setup({ modes: { 'temphum-push': 'enforce' } });
  const res = makeRes();
  let called = false;
  await guard(makeReq(), res, () => { called = true; });
  expect(called).toBe(false);
  expect(res.statusCode).toBe(401);
  expect(logs[0]).toMatchObject({ outcome: 'denied', reason: 'no-key', status: 401 });
});

test('โหมด enforce + key ถูกต้อง → ผ่าน, set req.apiKey, log allowed, touch key', async () => {
  const { guard, logs, touched } = setup({ modes: { 'temphum-push': 'enforce' } });
  const req = makeReq({ headers: { 'X-API-Key': RAW } });
  let called = false;
  await guard(req, makeRes(), () => { called = true; });
  expect(called).toBe(true);
  expect(req.apiKey).toMatchObject({ id: 'k1', name: 'Node-RED' });
  expect(logs[0]).toMatchObject({ outcome: 'allowed', reason: 'ok', keyName: 'Node-RED' });
  expect(touched).toEqual(['k1']);
});

test('รับ key ทาง Authorization: Bearer ได้ด้วย', async () => {
  const { guard } = setup({ modes: { 'temphum-push': 'enforce' } });
  let called = false;
  await guard(makeReq({ headers: { Authorization: `Bearer ${RAW}` } }), makeRes(), () => { called = true; });
  expect(called).toBe(true);
});

test('scope ไม่พอ → 403', async () => {
  const { guard } = setup({
    modes: { 'line-ingest': 'enforce' },
    keys: { [hashApiKey(RAW)]: KEY_DOC },
  });
  const res = makeRes();
  await guard(makeReq({ url: '/LIS/api/line/ingest', headers: { 'X-API-Key': RAW } }), res, () => {});
  expect(res.statusCode).toBe(403);
});

test('token เดิมใน env ยังใช้ได้ และ log ว่า legacy-token', async () => {
  const { guard, logs } = setup({
    modes: { 'line-ingest': 'enforce' },
    env: { LINE_INGEST_SECRET: 'old-secret' },
  });
  let called = false;
  await guard(
    makeReq({ url: '/LIS/api/line/ingest', headers: { 'X-LIS-Ingest-Key': 'old-secret' } }),
    makeRes(),
    () => { called = true; },
  );
  expect(called).toBe(true);
  expect(logs[0]).toMatchObject({ outcome: 'legacy-token' });
});

test('เกิน rate limit → 429 (enforce)', async () => {
  const { guard, logs } = setup({
    modes: { 'temphum-push': 'enforce' },
    keys: { [hashApiKey(RAW)]: { ...KEY_DOC, rateLimitPerMinute: 1 } },
  });
  const req = () => makeReq({ headers: { 'X-API-Key': RAW } });
  await guard(req(), makeRes(), () => {});
  const res = makeRes();
  await guard(req(), res, () => {});
  expect(res.statusCode).toBe(429);
  expect(logs[1]).toMatchObject({ outcome: 'rate-limited', reason: 'rate-limited' });
});

test('getModes พัง → fallback เป็น defaultMode (audit) ไม่บล็อก traffic', async () => {
  const guard = createApiGuard({
    policies: POLICIES,
    getModes: async () => { throw new Error('db down'); },
    findKeyByHash: async () => null,
    logRequest: async () => {},
    touchKey: async () => {},
    readEnv: () => undefined,
  });
  let called = false;
  await guard(makeReq(), makeRes(), () => { called = true; });
  expect(called).toBe(true);
});

test('logRequest พังต้องไม่ทำให้ request พัง', async () => {
  const guard = createApiGuard({
    policies: POLICIES,
    getModes: async () => ({ 'temphum-push': 'audit' }),
    findKeyByHash: async () => null,
    logRequest: async () => { throw new Error('write failed'); },
    touchKey: async () => {},
    readEnv: () => undefined,
  });
  let called = false;
  await guard(makeReq(), makeRes(), () => { called = true; });
  expect(called).toBe(true);
});

describe('extractCredential', () => {
  test('อ่านได้ทุกช่องทางที่ระบบภายนอกใช้อยู่', () => {
    expect(extractCredential(makeReq({ headers: { 'X-API-Key': 'a' } }))).toBe('a');
    expect(extractCredential(makeReq({ headers: { Authorization: 'Bearer b' } }))).toBe('b');
    expect(extractCredential(makeReq({ headers: { 'X-Integration-Token': 'c' } }))).toBe('c');
    expect(extractCredential(makeReq({ headers: { 'X-LIS-Ingest-Key': 'd' } }))).toBe('d');
    expect(extractCredential({ ...makeReq(), query: { key: 'e' } })).toBe('e');
    expect(extractCredential(makeReq())).toBe('');
  });
});
