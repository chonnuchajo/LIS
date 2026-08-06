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
    // เลียนแบบ req.path ของ Express จริง (pathname ที่ parse แล้ว ไม่มี query, คงตัวพิมพ์เดิม)
    path: url.split('?')[0],
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

// C1: ปิดช่องบายพาสด้วยตัวพิมพ์ — Express route แบบ case-insensitive แต่ก่อนหน้านี้
// matchPolicy เทียบแบบ case-sensitive ทำให้ POST /LIS/api/TEMPHUM (ตัวใหญ่) หลุดพ้น policy
// ไปเงียบๆ แม้ enforce mode จะเปิดอยู่ก็ตาม
test('โหมด enforce + path ตัวพิมพ์ใหญ่ + ไม่มี key → 401 (กัน bypass ด้วย casing)', async () => {
  const { guard, logs } = setup({ modes: { 'temphum-push': 'enforce' } });
  const res = makeRes();
  let called = false;
  await guard(makeReq({ url: '/LIS/api/TEMPHUM' }), res, () => { called = true; });
  expect(called).toBe(false);
  expect(res.statusCode).toBe(401);
  expect(logs[0]).toMatchObject({ policyId: 'temphum-push', path: '/temphum', outcome: 'denied' });
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

// M7: req.apiKey ต้องตั้งเฉพาะตอน verdict อนุมัติจริง (allow) เท่านั้น — I2 ทำให้ route ปลายทาง
// (productionIntegration.js, line.js) เริ่มเชื่อ req.apiKey เป็น credential ทางเลือก ถ้ายังตั้ง
// ให้ทันทีที่หา keyDoc เจอ (ของเดิม) แม้ key จะถูกเพิกถอนไปแล้ว route เหล่านั้นจะเผลอยอมรับ
// key ที่เพิกถอนแล้วไปด้วยในโหมด audit
test('โหมด audit + key ถูกเพิกถอน → ผ่าน (audit ไม่บล็อก) แต่ req.apiKey ต้องไม่ถูกตั้ง', async () => {
  const { guard, logs } = setup({
    modes: { 'temphum-push': 'audit' },
    keys: { [hashApiKey(RAW)]: { ...KEY_DOC, revokedAt: new Date('2020-01-01T00:00:00Z') } },
  });
  const req = makeReq({ headers: { 'X-API-Key': RAW } });
  let called = false;
  await guard(req, makeRes(), () => { called = true; });
  expect(called).toBe(true);
  expect(req.apiKey).toBeUndefined();
  expect(logs[0]).toMatchObject({ outcome: 'audit-pass', reason: 'revoked' });
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

// I4: จำกัดจำนวน log แถวของการถูกปฏิเสธต่อ policy ต่อนาที กันคนไม่มี key ยิงรัวๆ ใส่ endpoint
// enforce แล้วยัด ApiRequestLog ไม่อั้น — response ต้องยังตอบ 401 ถูกต้องทุกครั้ง แค่ log ไม่เขียน
// เกินโควตา (60 ครั้ง/นาที)
test('เกิน cap log ของ denial ต่อนาที (60 ครั้ง) → ครั้งที่ 61 ยัง 401 เหมือนเดิมแต่ไม่เขียน log เพิ่ม', async () => {
  const { guard, logs } = setup({ modes: { 'temphum-push': 'enforce' } });
  let lastRes;
  for (let i = 0; i < 61; i += 1) {
    lastRes = makeRes();
    // eslint-disable-next-line no-await-in-loop
    await guard(makeReq(), lastRes, () => {});
  }
  expect(lastRes.statusCode).toBe(401);
  expect(logs).toHaveLength(60);
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

test('findKeyByHash พัง + โหมด audit + มี credential → ผ่าน ไม่ throw และ log ถูกเขียน', async () => {
  const logs = [];
  const guard = createApiGuard({
    policies: POLICIES,
    getModes: async () => ({ 'temphum-push': 'audit' }),
    findKeyByHash: async () => { throw new Error('mongo down'); },
    logRequest: async (doc) => { logs.push(doc); },
    touchKey: async () => {},
    readEnv: () => undefined,
    now: () => new Date('2026-08-06T10:00:00Z'),
  });
  const req = makeReq({ headers: { 'X-API-Key': RAW } });
  let called = false;
  await expect(guard(req, makeRes(), () => { called = true; })).resolves.toBeUndefined();
  expect(called).toBe(true);
  expect(logs[0]).toMatchObject({ outcome: 'audit-pass', reason: 'unknown-key' });
});

test('findKeyByHash พัง + โหมด enforce + มี credential → 401 unknown-key ไม่เรียก next และไม่ throw', async () => {
  const guard = createApiGuard({
    policies: POLICIES,
    getModes: async () => ({ 'temphum-push': 'enforce' }),
    findKeyByHash: async () => { throw new Error('mongo down'); },
    logRequest: async () => {},
    touchKey: async () => {},
    readEnv: () => undefined,
    now: () => new Date('2026-08-06T10:00:00Z'),
  });
  const req = makeReq({ headers: { 'X-API-Key': RAW } });
  const res = makeRes();
  let called = false;
  await expect(guard(req, res, () => { called = true; })).resolves.toBeDefined();
  expect(called).toBe(false);
  expect(res.statusCode).toBe(401);
  expect(res.body).toMatchObject({ error: { message: expect.stringContaining('unknown-key') } });
});

test('credential ผ่าน query string (?key=) เท่านั้น → ไม่ถูกอ่าน (401 no-key) แม้ key จะถูกต้อง', async () => {
  const { guard, logs } = setup({ modes: { 'temphum-push': 'enforce' } });
  const res = makeRes();
  let called = false;
  await guard(
    { ...makeReq(), query: { key: RAW } },
    res,
    () => { called = true; },
  );
  expect(called).toBe(false);
  expect(res.statusCode).toBe(401);
  expect(logs[0]).toMatchObject({ outcome: 'denied', reason: 'no-key', status: 401 });
});

describe('extractCredential', () => {
  test('อ่านได้ทุกช่องทางที่ระบบภายนอกใช้อยู่ ยกเว้น query string', () => {
    expect(extractCredential(makeReq({ headers: { 'X-API-Key': 'a' } }))).toBe('a');
    expect(extractCredential(makeReq({ headers: { Authorization: 'Bearer b' } }))).toBe('b');
    expect(extractCredential(makeReq({ headers: { 'X-Integration-Token': 'c' } }))).toBe('c');
    expect(extractCredential(makeReq({ headers: { 'X-LIS-Ingest-Key': 'd' } }))).toBe('d');
    expect(extractCredential({ ...makeReq(), query: { key: 'e' } })).toBe(''); // ?key= ไม่ถูกอ่านแล้ว กัน secret หลุดเข้า access log
    expect(extractCredential(makeReq())).toBe('');
  });
});
