# API Key + การป้องกัน API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มแท็บ "API Key" (admin เท่านั้น) ในหน้า `/settings` สำหรับออก/เพิกถอน API key ต่อระบบภายนอก และเพิ่ม middleware กลางที่บังคับ key เฉพาะ endpoint ที่ระบบภายนอกเรียก โดยเริ่มที่โหมด audit ไม่กระทบของเดิม

**Architecture:** middleware ตัวเดียว (`apiGuard`) วางก่อน `mountApi(...)` ทุกบรรทัดใน `server/index.js` เทียบ path ที่เข้ามากับ policy registry (`server/lib/apiPolicy.js`) — ไม่ตรง = ปล่อยผ่านทันที (traffic ของหน้าเว็บทั้งหมดตกกลุ่มนี้) ตรงแล้วดูโหมดของ endpoint นั้น (`off` / `audit` / `enforce`) ที่ admin สลับได้จาก UI แล้วตรวจ key → scope → rate limit → บันทึก log ทุก logic เป็นฟังก์ชันบริสุทธิ์ + factory ที่ inject dependency เข้าไป จึงเทสได้โดยไม่ต้องต่อ DB

**Tech Stack:** Express 4 + Mongoose 8 (ไม่เพิ่ม npm dep — ใช้ `crypto` ของ Node), jest (ฝั่ง server), React 18 + TanStack Query + shadcn/ui + vitest (ฝั่ง FE)

**Spec:** `docs/superpowers/specs/2026-08-06-api-keys-and-api-protection-design.md`

## Global Constraints

- **ห้ามรัน `npm run build`** — `postbuild` เขียนทับไฟล์ที่ root แล้ว dev server พัง ใช้ `npx tsc -p tsconfig.app.json --noEmit` type-check แทน (`npx tsc --noEmit` เฉยๆ เป็น no-op เพราะ root tsconfig มี `files: []`)
- **เทสฝั่ง server เขียนสไตล์ jest** (`describe` / `test` / `expect`) รันด้วย `cd server && npx jest <path>` — ห้ามใช้ `require('node:test')` (ไฟล์เก่าบางตัวใช้อยู่ แต่ jest รายงาน suite นั้นว่า fail)
- **เทสฝั่ง FE**: vitest — `npm run test`
- **ข้อความ UI ทั้งหมดเป็นภาษาไทย** ตามหน้าอื่นในระบบ
- **model ใหม่ทุกตัวใส่ `softDeletePlugin`** จาก `server/lib/softDelete.js` (ยกเว้น log/mode ที่ระบุไว้ในแผนว่าไม่ใส่)
- **ห้ามใส่ route ที่ SPA เรียกลงใน policy registry** — SPA ไม่มี key ใส่แล้วเปิด enforce เมื่อไหร่หน้าเว็บดับ
- `mountApi()` mount ทุก router 2 ที่ (`/api/*` และ `/LIS/api/*`) → path matching ต้องรองรับทั้งคู่
- **commit ด้วย pathspec ระบุไฟล์ชัดเจนเสมอ** (`git add <ไฟล์>` ไม่ใช่ `git add -A`) เพราะอาจมี session อื่นแก้ไฟล์ในเครื่องเดียวกันอยู่
- key ที่ออกไปเก็บลง DB **เฉพาะ sha256 hash** ห้ามเก็บค่าเต็ม (`seed-data/*.json` เข้า git)
- คำสั่ง shell ในแผนนี้เขียนสไตล์ bash (ใช้ Bash tool) — ถ้ารันใน PowerShell ต้องเปลี่ยน `&&` เป็น `;` และ escape `$` คนละแบบ

## File Structure

| ไฟล์ | หน้าที่ |
|---|---|
| `server/lib/apiPolicy.js` | ทะเบียน scope + endpoint ที่ถูกคุม, `normalizePath`, `matchPolicy` |
| `server/lib/apiKeyAuth.js` | สร้าง/hash key, `evaluateKey`, `keyStatus`, `checkRateLimit` |
| `server/lib/policyModes.js` | แคชโหมดต่อ endpoint (`createModeCache`, `resolveMode`) |
| `server/lib/apiGuard.js` | `createApiGuard(deps)` + ตัวที่ต่อ model จริงแล้ว |
| `server/lib/adminGate.js` | `createAdminGate(deps)` — กัน route จัดการ key |
| `server/models/ApiKey.js` / `ApiRequestLog.js` / `ApiPolicyMode.js` | schema |
| `server/routes/apiKeys.js` | REST สำหรับหน้า UI (admin-gated) |
| `server/index.js` | mount guard + route ใหม่ |
| `server/export-data.js` | ข้าม collection log ตอน export |
| `src/lib/apiKeys.ts` | type + label ภาษาไทย + `isExpiringSoon` |
| `src/lib/api.ts` | client functions + `setApiUserEmail` |
| `src/context/AuthContext.tsx` | ส่งอีเมลผู้ใช้ปัจจุบันให้ api.ts |
| `src/components/lis/ApiKeyFormDialog.tsx` | ฟอร์มสร้าง/แก้ไข + จอโชว์ key ครั้งเดียว |
| `src/components/lis/ApiKeyList.tsx` | ตารางรายการ key |
| `src/components/lis/ApiPolicyTable.tsx` | ตาราง endpoint + สวิตช์โหมด |
| `src/components/lis/ApiRequestLogTable.tsx` | ตาราง log |
| `src/components/lis/ApiKeysPanel.tsx` | ประกอบทั้งแท็บ + query/mutation |
| `src/lib/tabRegistry.ts` / `src/pages/SettingsPage.tsx` | แท็บใหม่ |

---

### Task 1: Policy registry + path matching

**Files:**
- Create: `server/lib/apiPolicy.js`
- Test: `server/lib/apiPolicy.test.js`

**Interfaces:**
- Consumes: —
- Produces: `API_SCOPES: {id,label}[]`, `API_POLICIES: Policy[]`, `POLICY_MODES: string[]`, `normalizePath(url): string`, `matchPolicy(policies, method, url): Policy|null`, `policyPublicPath(policy): string`
  `Policy = { id, methods: string[], prefix, exact?, scope, label, defaultMode, legacyEnv?: string|null }`

- [ ] **Step 1: Write the failing test**

`server/lib/apiPolicy.test.js`:

```js
const {
  API_SCOPES,
  API_POLICIES,
  normalizePath,
  matchPolicy,
} = require('./apiPolicy');

describe('normalizePath', () => {
  test('ตัด prefix /api และ /LIS/api ได้ทั้งคู่', () => {
    expect(normalizePath('/api/temphum')).toBe('/temphum');
    expect(normalizePath('/LIS/api/temphum')).toBe('/temphum');
  });

  test('ตัด query string และ trailing slash', () => {
    expect(normalizePath('/LIS/api/line/ingest?key=abc')).toBe('/line/ingest');
    expect(normalizePath('/api/temphum/')).toBe('/temphum');
  });

  test('path ที่ไม่ได้ขึ้นต้นด้วย /api ปล่อยไว้ตามเดิม', () => {
    expect(normalizePath('/uploads/x.png')).toBe('/uploads/x.png');
  });
});

describe('matchPolicy', () => {
  test('POST /temphum ตรง policy temphum-push', () => {
    const p = matchPolicy(API_POLICIES, 'POST', '/LIS/api/temphum');
    expect(p?.id).toBe('temphum-push');
    expect(p?.scope).toBe('temphum:write');
  });

  test('GET /temphum ไม่ถูกคุม (หน้าเว็บใช้อยู่)', () => {
    expect(matchPolicy(API_POLICIES, 'GET', '/api/temphum')).toBeNull();
  });

  test('exact policy ไม่จับ sub-path', () => {
    expect(matchPolicy(API_POLICIES, 'POST', '/api/temphum/bulk')).toBeNull();
  });

  test('prefix policy จับ sub-path ได้', () => {
    const p = matchPolicy(API_POLICIES, 'POST', '/api/production-integration/petitions');
    expect(p?.id).toBe('production-integration');
  });

  test('route ที่หน้าเว็บใช้ต้องไม่ถูกคุม', () => {
    for (const path of ['/api/petitions', '/api/stock/standards', '/api/qc-results', '/api/api-keys']) {
      expect(matchPolicy(API_POLICIES, 'GET', path)).toBeNull();
      expect(matchPolicy(API_POLICIES, 'POST', path)).toBeNull();
    }
  });

  test('ทุก policy อ้าง scope ที่มีจริงในทะเบียน และเริ่มที่โหมด audit', () => {
    const scopeIds = API_SCOPES.map((s) => s.id);
    for (const p of API_POLICIES) {
      expect(scopeIds).toContain(p.scope);
      expect(p.defaultMode).toBe('audit');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest lib/apiPolicy.test.js`
Expected: FAIL — `Cannot find module './apiPolicy'`

- [ ] **Step 3: Write minimal implementation**

`server/lib/apiPolicy.js`:

```js
// ทะเบียนกลางของ "API ที่ระบบภายนอกเรียก" — middleware (lib/apiGuard.js) และหน้า
// ตั้งค่า (GET /api-keys/meta) อ่านจากไฟล์นี้ไฟล์เดียว
//
// ⚠️ ห้ามใส่ route ที่ SPA เรียก: หน้าเว็บไม่มี API key ใส่แล้วเปิดโหมด enforce
// เมื่อไหร่หน้าเว็บดับทันที

const POLICY_MODES = ['off', 'audit', 'enforce'];

const API_SCOPES = [
  { id: 'integration:write', label: 'รับคำขอจากระบบ production' },
  { id: 'temphum:write', label: 'ส่งค่าอุณหภูมิ/ความชื้น (Node-RED)' },
  { id: 'line:ingest', label: 'ส่ง event LINE ผ่าน n8n' },
];

const API_POLICIES = [
  {
    id: 'production-integration',
    methods: ['POST'],
    prefix: '/production-integration',
    scope: 'integration:write',
    label: 'สร้างคำขอจากระบบ production',
    defaultMode: 'audit',
    legacyEnv: 'PRODUCTION_INTEGRATION_TOKEN',
  },
  {
    id: 'temphum-push',
    methods: ['POST'],
    prefix: '/temphum',
    exact: true,
    scope: 'temphum:write',
    label: 'Node-RED push อุณหภูมิ/ความชื้น',
    defaultMode: 'audit',
    legacyEnv: null,
  },
  {
    id: 'line-ingest',
    methods: ['POST'],
    prefix: '/line/ingest',
    scope: 'line:ingest',
    label: 'n8n ส่ง event LINE เข้า LIS',
    defaultMode: 'audit',
    legacyEnv: 'LINE_INGEST_SECRET',
  },
];

// '/LIS/api/temphum?x=1' → '/temphum' (mountApi ผูก router ไว้ทั้ง /api และ /LIS/api)
function normalizePath(url) {
  let path = String(url || '').split('?')[0];
  if (path.startsWith('/LIS/')) path = path.slice(4);
  if (path === '/api') path = '/';
  else if (path.startsWith('/api/')) path = path.slice(4);
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path || '/';
}

function matchPolicy(policies, method, url) {
  const path = normalizePath(url);
  const verb = String(method || '').toUpperCase();
  return (
    (policies || []).find((p) => {
      if (!p.methods.includes(verb)) return false;
      if (p.exact) return path === p.prefix;
      return path === p.prefix || path.startsWith(`${p.prefix}/`);
    }) || null
  );
}

// path ที่โชว์ในหน้า UI เช่น 'POST /LIS/api/temphum'
function policyPublicPath(policy) {
  return `${policy.methods.join('/')} /LIS/api${policy.prefix}`;
}

module.exports = {
  POLICY_MODES,
  API_SCOPES,
  API_POLICIES,
  normalizePath,
  matchPolicy,
  policyPublicPath,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest lib/apiPolicy.test.js`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add server/lib/apiPolicy.js server/lib/apiPolicy.test.js
git commit -m "feat(api-guard): ทะเบียน endpoint ที่ต้องใช้ API key + path matching"
```

---

### Task 2: สร้าง/ตรวจ key + rate limit

**Files:**
- Create: `server/lib/apiKeyAuth.js`
- Test: `server/lib/apiKeyAuth.test.js`

**Interfaces:**
- Consumes: —
- Produces:
  - `generateApiKey(): { rawKey, keyHash, keyPrefix }`
  - `hashApiKey(rawKey): string` (sha256 hex)
  - `keyStatus(keyDoc, now?): 'active'|'expired'|'revoked'`
  - `evaluateKey({ rawKeyPresented, keyDoc, policy, now? }): { decision:'allow'|'deny', reason, status }`
  - `checkRateLimit(state: Map, keyId, limitPerMinute, nowMs?): { allowed, count }`
  - `DENY_STATUS: Record<reason, number>`

- [ ] **Step 1: Write the failing test**

`server/lib/apiKeyAuth.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest lib/apiKeyAuth.test.js`
Expected: FAIL — `Cannot find module './apiKeyAuth'`

- [ ] **Step 3: Write minimal implementation**

`server/lib/apiKeyAuth.js`:

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest lib/apiKeyAuth.test.js`
Expected: PASS (12 tests)

- [ ] **Step 5: Commit**

```bash
git add server/lib/apiKeyAuth.js server/lib/apiKeyAuth.test.js
git commit -m "feat(api-guard): สร้าง/ตรวจ API key + rate limit ต่อ key"
```

---

### Task 3: Model — ApiKey / ApiRequestLog / ApiPolicyMode

**Files:**
- Create: `server/models/ApiKey.js`, `server/models/ApiRequestLog.js`, `server/models/ApiPolicyMode.js`
- Test: `server/models/ApiKey.test.js`

**Interfaces:**
- Consumes: `softDeletePlugin` (`server/lib/softDelete.js`), `POLICY_MODES` (Task 1)
- Produces: mongoose model `ApiKey`, `ApiRequestLog`, `ApiPolicyMode`
  - `ApiKey` fields: `name, keyPrefix, keyHash, scopes[], expiresAt, revokedAt, revokedBy, rateLimitPerMinute, lastUsedAt, usageCount, createdBy`
  - `ApiKey.toJSON()` **ตัด `keyHash` ทิ้งเสมอ**
  - `ApiRequestLog` fields: `at, keyId, keyName, method, path, policyId, mode, outcome, reason, ip, status`
  - `ApiPolicyMode` fields: `policyId (unique), mode, updatedBy`

- [ ] **Step 1: Write the failing test**

`server/models/ApiKey.test.js`:

```js
const ApiKey = require('./ApiKey');
const ApiRequestLog = require('./ApiRequestLog');
const ApiPolicyMode = require('./ApiPolicyMode');

describe('ApiKey schema', () => {
  test('มีฟิลด์ครบตามสเปก', () => {
    const paths = Object.keys(ApiKey.schema.paths);
    for (const field of [
      'name', 'keyPrefix', 'keyHash', 'scopes', 'expiresAt', 'revokedAt',
      'revokedBy', 'rateLimitPerMinute', 'lastUsedAt', 'usageCount', 'createdBy',
      'deletedAt', // จาก softDeletePlugin
    ]) {
      expect(paths).toContain(field);
    }
  });

  test('rateLimitPerMinute ค่าเริ่มต้น 120 และ usageCount เริ่มที่ 0', () => {
    const doc = new ApiKey({ name: 'test', keyPrefix: 'lisk_abc123', keyHash: 'x'.repeat(64) });
    expect(doc.rateLimitPerMinute).toBe(120);
    expect(doc.usageCount).toBe(0);
    expect(doc.expiresAt).toBeNull();
  });

  test('toJSON ไม่หลุด keyHash ออกไปทาง API', () => {
    const doc = new ApiKey({ name: 'test', keyPrefix: 'lisk_abc123', keyHash: 'x'.repeat(64) });
    const json = doc.toJSON();
    expect(json.keyHash).toBeUndefined();
    expect(json.name).toBe('test');
  });

  test('ต้องมี name — validate ไม่ผ่านถ้าไม่ใส่', () => {
    const err = new ApiKey({ keyPrefix: 'lisk_abc123', keyHash: 'x'.repeat(64) }).validateSync();
    expect(err?.errors?.name).toBeTruthy();
  });
});

describe('ApiRequestLog schema', () => {
  test('at มี TTL index', () => {
    const indexes = ApiRequestLog.schema.indexes();
    const ttl = indexes.find(([keys]) => keys.at);
    expect(ttl).toBeTruthy();
    expect(ttl[1].expireAfterSeconds).toBeGreaterThan(0);
  });

  test('outcome จำกัดค่าที่รู้จัก', () => {
    const doc = new ApiRequestLog({ method: 'POST', path: '/temphum', outcome: 'ระเบิด' });
    expect(doc.validateSync()?.errors?.outcome).toBeTruthy();
  });
});

describe('ApiPolicyMode schema', () => {
  test('mode รับเฉพาะ off/audit/enforce', () => {
    expect(new ApiPolicyMode({ policyId: 'temphum-push', mode: 'enforce' }).validateSync()).toBeUndefined();
    expect(new ApiPolicyMode({ policyId: 'temphum-push', mode: 'บังคับ' }).validateSync()?.errors?.mode).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest models/ApiKey.test.js`
Expected: FAIL — `Cannot find module './ApiKey'`

- [ ] **Step 3: Write minimal implementation**

`server/models/ApiKey.js`:

```js
const mongoose = require('mongoose');
const { softDeletePlugin } = require('../lib/softDelete');

// API key สำหรับระบบภายนอก (Node-RED, n8n, ระบบ production) — ดู
// server/lib/apiPolicy.js ว่า scope ไหนเปิด endpoint อะไร
// เก็บเฉพาะ sha256 hash: ค่า key เต็มโชว์ครั้งเดียวตอนสร้างแล้วไม่มีที่ไหนเก็บอีก
// (seed-data/*.json เข้า git ด้วย)
const ApiKeySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  keyPrefix: { type: String, required: true, index: true },
  keyHash: { type: String, required: true, unique: true, index: true },
  scopes: { type: [String], default: [] },
  expiresAt: { type: Date, default: null },
  revokedAt: { type: Date, default: null },
  revokedBy: { type: String, default: '' },
  rateLimitPerMinute: { type: Number, default: 120, min: 0 },
  lastUsedAt: { type: Date, default: null },
  usageCount: { type: Number, default: 0 },
  createdBy: { type: String, default: '' },
}, { timestamps: true });

// กัน hash หลุดออก API ทุกทาง (res.json(doc) เรียก toJSON ให้เอง)
ApiKeySchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.keyHash;
    return ret;
  },
});

ApiKeySchema.plugin(softDeletePlugin);
module.exports = mongoose.model('ApiKey', ApiKeySchema);
```

`server/models/ApiRequestLog.js`:

```js
const mongoose = require('mongoose');

// log การเรียก endpoint ที่อยู่ใน policy registry — ใช้ตัดสินใจตอนสลับ audit → enforce
// ไม่ใส่ softDeletePlugin: เป็น log ล้วน ลบทิ้งอัตโนมัติด้วย TTL
// ⚠️ collection นี้ถูกข้ามใน export-data.js (ไม่มีค่าเชิงกู้คืน + churn ทุกชั่วโมง)
const TTL_DAYS = Number(process.env.API_LOG_TTL_DAYS || 30);

const ApiRequestLogSchema = new mongoose.Schema({
  at: { type: Date, default: Date.now },
  keyId: { type: mongoose.Schema.Types.ObjectId, ref: 'ApiKey', default: null },
  keyName: { type: String, default: '' },
  method: { type: String, default: '' },
  path: { type: String, default: '' },
  policyId: { type: String, default: '', index: true },
  mode: { type: String, enum: ['off', 'audit', 'enforce'], default: 'audit' },
  outcome: {
    type: String,
    enum: ['allowed', 'legacy-token', 'audit-pass', 'denied', 'rate-limited'],
    required: true,
  },
  reason: { type: String, default: '' },
  ip: { type: String, default: '' },
  status: { type: Number, default: 200 },
}, { versionKey: false });

ApiRequestLogSchema.index({ at: -1 });
ApiRequestLogSchema.index({ at: 1 }, { expireAfterSeconds: TTL_DAYS * 24 * 60 * 60 });

module.exports = mongoose.model('ApiRequestLog', ApiRequestLogSchema);
```

`server/models/ApiPolicyMode.js`:

```js
const mongoose = require('mongoose');
const { POLICY_MODES } = require('../lib/apiPolicy');

// โหมดของแต่ละ endpoint ที่ admin สลับจากหน้า /settings → แท็บ API Key
// ไม่มี doc = ใช้ defaultMode ที่ประกาศไว้ใน apiPolicy.js
const ApiPolicyModeSchema = new mongoose.Schema({
  policyId: { type: String, required: true, unique: true, index: true },
  mode: { type: String, enum: POLICY_MODES, default: 'audit' },
  updatedBy: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('ApiPolicyMode', ApiPolicyModeSchema);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest models/ApiKey.test.js`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add server/models/ApiKey.js server/models/ApiRequestLog.js server/models/ApiPolicyMode.js server/models/ApiKey.test.js
git commit -m "feat(api-guard): model ApiKey / ApiRequestLog / ApiPolicyMode"
```

---

### Task 4: แคชโหมดต่อ endpoint

**Files:**
- Create: `server/lib/policyModes.js`
- Test: `server/lib/policyModes.test.js`

**Interfaces:**
- Consumes: Task 1 (`API_POLICIES`)
- Produces:
  - `createModeCache({ load, ttlMs?, now? }): { get(): Promise<Record<string,string>>, invalidate(): void }`
  - `resolveMode(modes, policy): 'off'|'audit'|'enforce'`
  - `loadModesFromDb(): Promise<Record<string,string>>` (ต่อ model จริง)
  - `modeCache` — instance ที่ต่อ DB แล้ว (ใช้ใน apiGuard และ routes/apiKeys.js)

- [ ] **Step 1: Write the failing test**

`server/lib/policyModes.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest lib/policyModes.test.js`
Expected: FAIL — `Cannot find module './policyModes'`

- [ ] **Step 3: Write minimal implementation**

`server/lib/policyModes.js`:

```js
const ApiPolicyMode = require('../models/ApiPolicyMode');

function resolveMode(modes, policy) {
  return (modes && modes[policy.id]) || policy.defaultMode;
}

// แคชในหน่วยความจำ: middleware อ่านทุก request ที่ตรง policy จึงไม่ควรยิง DB ทุกครั้ง
// รีเฟรชเมื่อ (ก) แก้ผ่าน API → invalidate() หรือ (ข) เลย TTL (เผื่อมีคนแก้ DB ตรงๆ)
function createModeCache({ load, ttlMs = 30000, now = () => Date.now() }) {
  let cache = null;
  let loadedAt = 0;
  let inflight = null;

  async function get() {
    if (cache && now() - loadedAt < ttlMs) return cache;
    if (!inflight) {
      inflight = Promise.resolve()
        .then(load)
        .then((value) => {
          cache = value || {};
          loadedAt = now();
          inflight = null;
          return cache;
        })
        .catch((err) => {
          inflight = null;
          throw err;
        });
    }
    return inflight;
  }

  function invalidate() {
    cache = null;
    loadedAt = 0;
  }

  return { get, invalidate };
}

async function loadModesFromDb() {
  const docs = await ApiPolicyMode.find().lean();
  return Object.fromEntries(docs.map((d) => [d.policyId, d.mode]));
}

const modeCache = createModeCache({ load: loadModesFromDb });

module.exports = { createModeCache, resolveMode, loadModesFromDb, modeCache };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest lib/policyModes.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add server/lib/policyModes.js server/lib/policyModes.test.js
git commit -m "feat(api-guard): แคชโหมด off/audit/enforce ต่อ endpoint"
```

---

### Task 5: Middleware apiGuard

**Files:**
- Create: `server/lib/apiGuard.js`
- Test: `server/lib/apiGuard.test.js`

**Interfaces:**
- Consumes: Task 1 (`API_POLICIES`, `matchPolicy`, `normalizePath`), Task 2 (`hashApiKey`, `evaluateKey`, `checkRateLimit`), Task 3 (models), Task 4 (`modeCache`, `resolveMode`)
- Produces:
  - `extractCredential(req): string`
  - `createApiGuard(deps): (req, res, next) => Promise<void>`
    deps = `{ policies, getModes, findKeyByHash, logRequest, touchKey, readEnv?, rateState?, now? }`
  - `apiGuard` — ตัวที่ต่อ model จริง (ใช้ใน `server/index.js`)
  - `req.apiKey` = `{ id, name, scopes }` เมื่อผ่านด้วย key

- [ ] **Step 1: Write the failing test**

`server/lib/apiGuard.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest lib/apiGuard.test.js`
Expected: FAIL — `Cannot find module './apiGuard'`

- [ ] **Step 3: Write minimal implementation**

`server/lib/apiGuard.js`:

```js
const { API_POLICIES, matchPolicy, normalizePath } = require('./apiPolicy');
const { hashApiKey, evaluateKey, checkRateLimit } = require('./apiKeyAuth');
const { resolveMode, modeCache } = require('./policyModes');
const ApiKey = require('../models/ApiKey');
const ApiRequestLog = require('../models/ApiRequestLog');

// ช่องทางที่ระบบภายนอกส่ง credential เข้ามา — รวม header เดิมของ
// production-integration (x-integration-token) และ n8n (x-lis-ingest-key / ?key=)
// ไว้ด้วย เพื่อให้ token เดิมยังทำงานระหว่างช่วงย้าย
function extractCredential(req) {
  const bearer = (req.get('authorization') || '').match(/^Bearer\s+(.+)$/i)?.[1];
  return (
    req.get('x-api-key') ||
    bearer ||
    req.get('x-integration-token') ||
    req.get('x-lis-ingest-key') ||
    (req.query && req.query.key) ||
    ''
  );
}

function createApiGuard({
  policies = API_POLICIES,
  getModes,
  findKeyByHash,
  logRequest,
  touchKey,
  readEnv = (name) => process.env[name],
  rateState = new Map(),
  now = () => new Date(),
}) {
  return async function apiGuard(req, res, next) {
    const policy = matchPolicy(policies, req.method, req.originalUrl || req.url);
    if (!policy) return next(); // traffic ของหน้าเว็บทั้งหมดออกทางนี้

    let modes = {};
    try {
      modes = await getModes();
    } catch {
      modes = {}; // DB มีปัญหา → ใช้ defaultMode (audit) ไม่บล็อกใคร
    }
    const mode = resolveMode(modes, policy);
    if (mode === 'off') return next();

    const at = now();
    const path = normalizePath(req.originalUrl || req.url);
    const credential = String(extractCredential(req) || '');
    const legacyToken = policy.legacyEnv ? readEnv(policy.legacyEnv) : '';
    const isLegacy = Boolean(legacyToken && credential && credential === legacyToken);

    let keyDoc = null;
    let verdict = { decision: 'allow', reason: 'ok', status: 200 };
    let rate = { allowed: true, count: 0 };

    if (isLegacy) {
      verdict = { decision: 'allow', reason: 'legacy-token', status: 200 };
    } else {
      if (credential) keyDoc = await findKeyByHash(hashApiKey(credential));
      verdict = evaluateKey({ rawKeyPresented: Boolean(credential), keyDoc, policy, now: at });
      if (verdict.decision === 'allow') {
        rate = checkRateLimit(rateState, String(keyDoc._id), keyDoc.rateLimitPerMinute, at.getTime());
        if (!rate.allowed) verdict = { decision: 'deny', reason: 'rate-limited', status: 429 };
      }
    }

    const enforcing = mode === 'enforce';
    const blocked = enforcing && verdict.decision === 'deny';
    let outcome;
    if (isLegacy) outcome = 'legacy-token';
    else if (!enforcing) outcome = 'audit-pass';
    else if (verdict.decision === 'deny') outcome = verdict.reason === 'rate-limited' ? 'rate-limited' : 'denied';
    else outcome = 'allowed';

    const log = {
      at,
      keyId: keyDoc?._id || null,
      keyName: keyDoc?.name || '',
      method: req.method,
      path,
      policyId: policy.id,
      mode,
      outcome,
      reason: verdict.reason,
      ip: req.ip || '',
      status: blocked ? verdict.status : 200,
    };
    Promise.resolve()
      .then(() => logRequest(log))
      .catch(() => {}); // log ล่มต้องไม่ทำให้ request ล่ม

    if (keyDoc && (verdict.decision === 'allow' || !enforcing)) {
      Promise.resolve().then(() => touchKey(keyDoc._id)).catch(() => {});
    }

    if (blocked) {
      return res.status(verdict.status).json({ error: { message: `API key ไม่ผ่าน: ${verdict.reason}` } });
    }
    if (keyDoc) req.apiKey = { id: String(keyDoc._id), name: keyDoc.name, scopes: keyDoc.scopes || [] };
    return next();
  };
}

// ตัวที่ต่อ model จริง — ใช้ใน server/index.js
const apiGuard = createApiGuard({
  policies: API_POLICIES,
  getModes: () => modeCache.get(),
  findKeyByHash: (keyHash) => ApiKey.findOne({ keyHash }).lean(),
  logRequest: (doc) => ApiRequestLog.create(doc),
  touchKey: (id) => ApiKey.updateOne({ _id: id }, { $set: { lastUsedAt: new Date() }, $inc: { usageCount: 1 } }),
});

module.exports = { extractCredential, createApiGuard, apiGuard };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest lib/apiGuard.test.js`
Expected: PASS (12 tests)

- [ ] **Step 5: Commit**

```bash
git add server/lib/apiGuard.js server/lib/apiGuard.test.js
git commit -m "feat(api-guard): middleware ตรวจ API key ตาม policy (off/audit/enforce)"
```

---

### Task 6: Admin gate ของ route จัดการ key

**Files:**
- Create: `server/lib/adminGate.js`
- Test: `server/lib/adminGate.test.js`

**Interfaces:**
- Consumes: `normalizeRoles` (`server/lib/roles.js`)
- Produces:
  - `createAdminGate({ findUserByEmail, isDevBypass?, warn? }): (req,res,next) => Promise<void>`
  - `requireAdminUser` — ตัวที่ต่อ model `User` จริง
  - ตั้ง `req.adminUser = { email, name }` เมื่อผ่าน

- [ ] **Step 1: Write the failing test**

`server/lib/adminGate.test.js`:

```js
const { createAdminGate } = require('./adminGate');

function makeReq(headers = {}) {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return { get: (name) => lower[String(name).toLowerCase()] };
}
function makeRes() {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

const USERS = {
  'admin@icpladda.com': { email: 'admin@icpladda.com', name: 'แอดมิน', roles: ['admin'] },
  'lab@icpladda.com': { email: 'lab@icpladda.com', name: 'แล็บ', roles: ['lab'] },
};
const deps = {
  findUserByEmail: async (email) => USERS[email] || null,
  isDevBypass: () => false,
  warn: () => {},
};

test('ไม่มี header X-LIS-User → 401', async () => {
  const gate = createAdminGate(deps);
  const res = makeRes();
  let called = false;
  await gate(makeReq(), res, () => { called = true; });
  expect(called).toBe(false);
  expect(res.statusCode).toBe(401);
});

test('user ไม่ใช่ admin → 403', async () => {
  const gate = createAdminGate(deps);
  const res = makeRes();
  await gate(makeReq({ 'X-LIS-User': 'lab@icpladda.com' }), res, () => {});
  expect(res.statusCode).toBe(403);
});

test('ไม่มี user คนนี้ใน DB → 403', async () => {
  const gate = createAdminGate(deps);
  const res = makeRes();
  await gate(makeReq({ 'X-LIS-User': 'ghost@icpladda.com' }), res, () => {});
  expect(res.statusCode).toBe(403);
});

test('admin ผ่าน และตั้ง req.adminUser (ตัวพิมพ์ใหญ่ในอีเมลก็ต้องผ่าน)', async () => {
  const gate = createAdminGate(deps);
  const req = makeReq({ 'X-LIS-User': 'Admin@ICPLadda.com' });
  let called = false;
  await gate(req, makeRes(), () => { called = true; });
  expect(called).toBe(true);
  expect(req.adminUser).toEqual({ email: 'admin@icpladda.com', name: 'แอดมิน' });
});

test('โหมด dev (ALLOW_DEV_STATUS) ผ่านได้โดยไม่ต้องมี header', async () => {
  const gate = createAdminGate({ ...deps, isDevBypass: () => true });
  let called = false;
  await gate(makeReq(), makeRes(), () => { called = true; });
  expect(called).toBe(true);
});

test('DB พัง → 500 ไม่ใช่ปล่อยผ่าน', async () => {
  const gate = createAdminGate({
    ...deps,
    findUserByEmail: async () => { throw new Error('db down'); },
  });
  const res = makeRes();
  let called = false;
  await gate(makeReq({ 'X-LIS-User': 'admin@icpladda.com' }), res, () => { called = true; });
  expect(called).toBe(false);
  expect(res.statusCode).toBe(500);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest lib/adminGate.test.js`
Expected: FAIL — `Cannot find module './adminGate'`

- [ ] **Step 3: Write minimal implementation**

`server/lib/adminGate.js`:

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest lib/adminGate.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add server/lib/adminGate.js server/lib/adminGate.test.js
git commit -m "feat(api-guard): admin gate สำหรับ route จัดการ API key"
```

---

### Task 7: REST routes `/api-keys`

**Files:**
- Create: `server/routes/apiKeys.js`
- Test: `server/routes/apiKeys.test.js`

**Interfaces:**
- Consumes: Task 1–6 ทั้งหมด
- Produces:
  - `serializeKey(doc, now?)` → `{ id, name, keyPrefix, scopes, expiresAt, revokedAt, rateLimitPerMinute, lastUsedAt, usageCount, createdBy, createdAt, status }`
  - router ที่ตอบ envelope `{ data: ... }` ทุก endpoint (ยกเว้น DELETE ที่ตอบ `{ ok: true }`)
  - endpoints: `GET /meta`, `GET /logs`, `PATCH /policy/:policyId`, `GET /`, `POST /`, `PATCH /:id`, `POST /:id/revoke`, `DELETE /:id`

- [ ] **Step 1: Write the failing test**

`server/routes/apiKeys.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest routes/apiKeys.test.js`
Expected: FAIL — `Cannot find module './apiKeys'`

- [ ] **Step 3: Write minimal implementation**

`server/routes/apiKeys.js`:

```js
const express = require('express');
const ApiKey = require('../models/ApiKey');
const ApiRequestLog = require('../models/ApiRequestLog');
const ApiPolicyMode = require('../models/ApiPolicyMode');
const { API_SCOPES, API_POLICIES, POLICY_MODES, policyPublicPath } = require('../lib/apiPolicy');
const { generateApiKey, keyStatus } = require('../lib/apiKeyAuth');
const { modeCache, loadModesFromDb, resolveMode } = require('../lib/policyModes');
const { requireAdminUser } = require('../lib/adminGate');

const router = express.Router();

// ทุก endpoint ในนี้เป็นของ admin เท่านั้น และ /api-keys ต้องไม่ถูกใส่ใน
// apiPolicy.js ตลอดไป → API key เรียก route จัดการ key ไม่ได้ (key ออก key ไม่ได้)
router.use(requireAdminUser);

const SCOPE_IDS = API_SCOPES.map((s) => s.id);

function serializeKey(doc, now = new Date()) {
  return {
    id: String(doc._id),
    name: doc.name,
    keyPrefix: doc.keyPrefix,
    scopes: doc.scopes || [],
    expiresAt: doc.expiresAt ? new Date(doc.expiresAt).toISOString() : null,
    revokedAt: doc.revokedAt ? new Date(doc.revokedAt).toISOString() : null,
    rateLimitPerMinute: doc.rateLimitPerMinute ?? 120,
    lastUsedAt: doc.lastUsedAt ? new Date(doc.lastUsedAt).toISOString() : null,
    usageCount: doc.usageCount ?? 0,
    createdBy: doc.createdBy || '',
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
    status: keyStatus(doc, now),
  };
}

function parseScopes(input) {
  const scopes = Array.isArray(input) ? input.map(String) : [];
  const unknown = scopes.filter((s) => !SCOPE_IDS.includes(s));
  if (unknown.length) throw new Error(`scope ไม่รู้จัก: ${unknown.join(', ')}`);
  return scopes;
}

function parseExpiresAt(input) {
  if (input === undefined || input === null || input === '') return null;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) throw new Error('วันหมดอายุไม่ถูกต้อง');
  return date;
}

// --- routes ที่มี path คงที่ ต้อง register ก่อน '/:id' ---------------------

// GET /api-keys/meta — ทะเบียน scope + endpoint + โหมดปัจจุบัน + สถิติ 7 วัน
router.get('/meta', async (req, res) => {
  try {
    const modes = await loadModesFromDb();
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const stats = await ApiRequestLog.aggregate([
      { $match: { at: { $gte: since }, outcome: 'audit-pass', reason: { $ne: 'ok' } } },
      { $group: { _id: '$policyId', count: { $sum: 1 } } },
    ]);
    const wouldBlock = Object.fromEntries(stats.map((s) => [s._id, s.count]));
    res.json({
      data: {
        scopes: API_SCOPES,
        modes: POLICY_MODES,
        policies: API_POLICIES.map((p) => ({
          id: p.id,
          label: p.label,
          methods: p.methods,
          path: policyPublicPath(p),
          scope: p.scope,
          mode: resolveMode(modes, p),
          legacyEnv: p.legacyEnv || null,
          wouldBlock7d: wouldBlock[p.id] || 0,
        })),
      },
    });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// GET /api-keys/logs?keyId=&outcome=&limit=
router.get('/logs', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const filter = {};
    if (req.query.keyId) filter.keyId = req.query.keyId;
    if (req.query.outcome) filter.outcome = String(req.query.outcome);
    if (req.query.policyId) filter.policyId = String(req.query.policyId);
    const docs = await ApiRequestLog.find(filter).sort({ at: -1 }).limit(limit).lean();
    res.json({
      data: docs.map((d) => ({
        id: String(d._id),
        at: new Date(d.at).toISOString(),
        keyName: d.keyName || '',
        method: d.method,
        path: d.path,
        policyId: d.policyId,
        mode: d.mode,
        outcome: d.outcome,
        reason: d.reason,
        ip: d.ip,
        status: d.status,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// PATCH /api-keys/policy/:policyId — สลับโหมด off/audit/enforce
router.patch('/policy/:policyId', async (req, res) => {
  try {
    const policy = API_POLICIES.find((p) => p.id === req.params.policyId);
    if (!policy) return res.status(404).json({ error: { message: 'ไม่พบ endpoint นี้ในทะเบียน' } });
    const mode = String(req.body?.mode || '');
    if (!POLICY_MODES.includes(mode)) {
      return res.status(400).json({ error: { message: 'โหมดต้องเป็น off / audit / enforce' } });
    }
    await ApiPolicyMode.findOneAndUpdate(
      { policyId: policy.id },
      { $set: { mode, updatedBy: req.adminUser?.email || '' } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    modeCache.invalidate();
    res.json({ data: { policyId: policy.id, mode } });
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});

// --- CRUD ของตัว key -------------------------------------------------------

router.get('/', async (req, res) => {
  try {
    const now = new Date();
    const docs = await ApiKey.find().sort({ createdAt: -1 }).lean();
    res.json({ data: docs.map((d) => serializeKey(d, now)) });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /api-keys — คืน rawKey ครั้งเดียวเท่านั้น หลังจากนี้ไม่มีที่ไหนเก็บอีก
router.post('/', async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: { message: 'ต้องตั้งชื่อ key' } });
    const scopes = parseScopes(req.body?.scopes);
    if (scopes.length === 0) return res.status(400).json({ error: { message: 'ต้องเลือกอย่างน้อย 1 scope' } });
    const { rawKey, keyHash, keyPrefix } = generateApiKey();
    const doc = await ApiKey.create({
      name,
      keyPrefix,
      keyHash,
      scopes,
      expiresAt: parseExpiresAt(req.body?.expiresAt),
      rateLimitPerMinute: Number(req.body?.rateLimitPerMinute ?? 120),
      createdBy: req.adminUser?.email || '',
    });
    res.status(201).json({ data: { ...serializeKey(doc.toObject()), rawKey } });
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const patch = {};
    if (req.body?.name !== undefined) patch.name = String(req.body.name).trim();
    if (req.body?.scopes !== undefined) patch.scopes = parseScopes(req.body.scopes);
    if (req.body?.expiresAt !== undefined) patch.expiresAt = parseExpiresAt(req.body.expiresAt);
    if (req.body?.rateLimitPerMinute !== undefined) {
      patch.rateLimitPerMinute = Number(req.body.rateLimitPerMinute);
    }
    const doc = await ApiKey.findByIdAndUpdate(req.params.id, { $set: patch }, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ error: { message: 'ไม่พบ key นี้' } });
    res.json({ data: serializeKey(doc.toObject()) });
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});

router.post('/:id/revoke', async (req, res) => {
  try {
    const doc = await ApiKey.findByIdAndUpdate(
      req.params.id,
      { $set: { revokedAt: new Date(), revokedBy: req.adminUser?.email || '' } },
      { new: true },
    );
    if (!doc) return res.status(404).json({ error: { message: 'ไม่พบ key นี้' } });
    res.json({ data: serializeKey(doc.toObject()) });
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const doc = await ApiKey.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: { message: 'ไม่พบ key นี้' } });
    await doc.softDelete(req.adminUser?.email || '');
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});

module.exports = router;
module.exports.serializeKey = serializeKey;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest routes/apiKeys.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add server/routes/apiKeys.js server/routes/apiKeys.test.js
git commit -m "feat(api-keys): REST จัดการ key + โหมด endpoint + log (admin only)"
```

---

### Task 8: ต่อ guard และ route เข้า `server/index.js` + ทดสอบมือ

**Files:**
- Modify: `server/index.js` (บรรทัด 28 — เหนือ `mountApi('/samples', ...)`)

**Interfaces:**
- Consumes: `apiGuard` (Task 5), `routes/apiKeys` (Task 7)
- Produces: `/api/api-keys` + `/LIS/api/api-keys` ใช้งานได้ และทุก request ผ่าน guard

- [ ] **Step 1: แก้ `server/index.js`**

ก่อนบรรทัด `// API Routes` ใส่:

```js
// ป้องกัน API ที่ระบบภายนอกเรียก — ต้องอยู่ก่อน mountApi ทุกบรรทัด (แต่หลัง
// express.json เพราะบาง route อ่าน req.body) path ที่ไม่อยู่ใน
// server/lib/apiPolicy.js จะถูกปล่อยผ่านทันที = traffic ของหน้าเว็บไม่กระทบ
const { apiGuard } = require('./lib/apiGuard');
app.use(apiGuard);
```

แล้วเพิ่มบรรทัด mount ต่อจาก `mountApi('/access-control', ...)`:

```js
mountApi('/api-keys', require('./routes/apiKeys')); // จัดการ API key (admin เท่านั้น)
```

- [ ] **Step 2: รันเซิร์ฟเวอร์แล้วตรวจว่าหน้าเว็บไม่กระทบ**

```bash
cd server && npm run dev
```

Expected: boot ปกติ — เห็น `✅ Connected to MongoDB` และ `🚀 Server running on port 3001` (มี `📦 Created collection: apikeys / apirequestlogs / apipolicymodes`)

```bash
curl -s http://localhost:3001/api/health
curl -s http://localhost:3001/api/temphum
```
Expected: ทั้งคู่ตอบปกติ (guard ไม่แตะ GET)

- [ ] **Step 3: ตรวจโหมด audit — ยิงโดยไม่มี key ต้องผ่าน**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3001/api/temphum \
  -H "Content-Type: application/json" -d '{"board":"test","temp":25,"hum":50}'
```
Expected: `200` (โหมดเริ่มต้น = audit)

- [ ] **Step 4: ตรวจว่ามี log ถูกบันทึก**

```bash
cd server && node -e "require('dotenv').config({path:'.env'});const m=require('mongoose');m.connect(process.env.MONGODB_URI||'mongodb://localhost:27017/LIS-DB').then(async()=>{const L=require('./models/ApiRequestLog');console.log(await L.find().sort({at:-1}).limit(3).lean());process.exit(0)})"
```
Expected: เห็น 1 แถว `{ policyId: 'temphum-push', mode: 'audit', outcome: 'audit-pass', reason: 'no-key', status: 200 }`

- [ ] **Step 5: ตรวจโหมด enforce — ต้องบล็อกเมื่อไม่มี key และผ่านเมื่อมี**

ตั้งโหมดเป็น enforce ตรงๆ ใน DB (UI ยังไม่เสร็จ) แล้วรีสตาร์ตเซิร์ฟเวอร์ (ล้างแคชโหมด):

```bash
cd server && node -e "require('dotenv').config({path:'.env'});const m=require('mongoose');m.connect(process.env.MONGODB_URI||'mongodb://localhost:27017/LIS-DB').then(async()=>{const P=require('./models/ApiPolicyMode');await P.findOneAndUpdate({policyId:'temphum-push'},{\$set:{mode:'enforce'}},{upsert:true});console.log('ok');process.exit(0)})"
```

ออก key ทดสอบ:

```bash
cd server && node -e "require('dotenv').config({path:'.env'});const m=require('mongoose');const {generateApiKey}=require('./lib/apiKeyAuth');m.connect(process.env.MONGODB_URI||'mongodb://localhost:27017/LIS-DB').then(async()=>{const K=require('./models/ApiKey');const g=generateApiKey();await K.create({name:'ทดสอบ',keyPrefix:g.keyPrefix,keyHash:g.keyHash,scopes:['temphum:write']});console.log(g.rawKey);process.exit(0)})"
```

รีสตาร์ตเซิร์ฟเวอร์ แล้ว:

```bash
curl -s -o /dev/null -w "no-key=%{http_code}\n" -X POST http://localhost:3001/api/temphum \
  -H "Content-Type: application/json" -d '{"board":"test"}'
curl -s -o /dev/null -w "with-key=%{http_code}\n" -X POST http://localhost:3001/api/temphum \
  -H "Content-Type: application/json" -H "X-API-Key: <rawKey ที่ได้จากคำสั่งบน>" -d '{"board":"test"}'
```
Expected: `no-key=401` และ `with-key=200`

- [ ] **Step 6: คืนโหมดกลับเป็น audit แล้วลบข้อมูลทดสอบ**

```bash
cd server && node -e "require('dotenv').config({path:'.env'});const m=require('mongoose');m.connect(process.env.MONGODB_URI||'mongodb://localhost:27017/LIS-DB').then(async()=>{const P=require('./models/ApiPolicyMode');const K=require('./models/ApiKey');await P.deleteMany({});await K.deleteMany({name:'ทดสอบ'});console.log('cleaned');process.exit(0)})"
```
Expected: `cleaned`

- [ ] **Step 7: Commit**

```bash
git add server/index.js
git commit -m "feat(api-guard): ต่อ middleware และ route /api-keys เข้า server"
```

---

### Task 9: ไม่ export collection log ลง seed-data

**Files:**
- Modify: `server/export-data.js:61-64`
- Test: `server/export-data.test.js`

**Interfaces:**
- Consumes: —
- Produces: `SKIP_COLLECTIONS: string[]`, `selectCollections(names, only, skip): string[]`

- [ ] **Step 1: Write the failing test**

`server/export-data.test.js`:

```js
const { SKIP_COLLECTIONS, selectCollections } = require('./export-data');

test('ข้าม system.* เสมอ', () => {
  expect(selectCollections(['system.views', 'petitions'], [], SKIP_COLLECTIONS)).toEqual(['petitions']);
});

test('ข้าม collection log ที่ไม่มีค่าเชิงกู้คืน (auto-sync commit ทุกชั่วโมง)', () => {
  expect(SKIP_COLLECTIONS).toContain('apirequestlogs');
  expect(selectCollections(['apirequestlogs', 'apikeys'], [], SKIP_COLLECTIONS)).toEqual(['apikeys']);
});

test('--only ชนะทุกอย่าง (สั่งตรงๆ ให้ export ได้)', () => {
  expect(selectCollections(['apirequestlogs', 'apikeys'], ['apirequestlogs'], SKIP_COLLECTIONS))
    .toEqual(['apirequestlogs']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest export-data.test.js`
Expected: FAIL — `SKIP_COLLECTIONS is not defined` / undefined

- [ ] **Step 3: Write minimal implementation**

`server/export-data.js` ตอนนี้เป็น IIFE ที่รันทันทีตอน require (บรรทัด 41 `(async () => {` … บรรทัด 92 `})();`)
ถ้าไม่แก้ตรงนี้ **เทสจะไปต่อ MongoDB จริงและ export ทับ `seed-data/`** ฉะนั้นต้องทำ 3 อย่าง:

(ก) เพิ่มก่อนบรรทัด 41:

```js
// collection ที่ไม่ต้อง export ลง seed-data/: เป็น log ล้วน กู้คืนไปก็ไม่มีประโยชน์
// แต่ auto-sync.ps1 จะ commit ไฟล์ใหม่ให้ทุกชั่วโมง (Node-RED ยิงนาทีละครั้ง)
const SKIP_COLLECTIONS = ['apirequestlogs'];

// ONLY (จาก --only) ชนะ skip list เสมอ เผื่ออยากดัมพ์ log จริงๆ
function selectCollections(names, only = [], skip = SKIP_COLLECTIONS) {
  return names
    .filter((n) => !n.startsWith('system.'))
    .filter((n) => (only.length ? only.includes(n) : !skip.includes(n)));
}
```

(ข) แทนที่บล็อกเลือก collection เดิม (บรรทัด ~61-64) ด้วย:

```js
    const cols = selectCollections(
      (await db.listCollections({ type: 'collection' }).toArray()).map((c) => c.name),
      ONLY,
    );
```

(ค) เปลี่ยน IIFE เป็นฟังก์ชันที่รันเฉพาะตอนถูกเรียกเป็น script แล้ว export ฟังก์ชันบริสุทธิ์ออกมา:

- บรรทัด 41: `(async () => {` → `async function main() {`
- บรรทัด 92: `})();` → `}`
- ต่อท้ายไฟล์:

```js
// รันเฉพาะตอนถูกเรียกเป็น script — require จากเทสต้องไม่ไปต่อ MongoDB จริง
if (require.main === module) main();

module.exports = { SKIP_COLLECTIONS, selectCollections };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest export-data.test.js`
Expected: PASS (3 tests)

ตรวจว่า export จริงยังทำงาน:
Run: `cd server && npm run seed:export`
Expected: จบด้วยสรุปจำนวน doc และ **ไม่มีบรรทัด `apirequestlogs`**

- [ ] **Step 5: Commit**

```bash
git add server/export-data.js server/export-data.test.js
git commit -m "chore(seed): ไม่ export apirequestlogs ลง seed-data"
```

---

### Task 10: FE — type + label + helper

**Files:**
- Create: `src/lib/apiKeys.ts`, `src/lib/apiKeys.test.ts`

**Interfaces:**
- Consumes: รูปแบบ response จาก Task 7
- Produces: types `ApiKeyItem`, `ApiKeyStatus`, `ApiPolicyMode`, `ApiPolicyItem`, `ApiKeyMeta`, `ApiScope`, `ApiRequestLogItem`, `ApiKeyInput`; label maps; `isExpiringSoon`

- [ ] **Step 1: Write the failing test**

`src/lib/apiKeys.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isExpiringSoon, API_POLICY_MODE_LABEL, API_KEY_STATUS_LABEL } from "./apiKeys";

const NOW = new Date("2026-08-06T10:00:00Z");

describe("isExpiringSoon", () => {
  it("ไม่ตั้งวันหมดอายุ → ไม่เตือน", () => {
    expect(isExpiringSoon(null, NOW)).toBe(false);
  });

  it("เหลือ 3 วัน → เตือน", () => {
    expect(isExpiringSoon("2026-08-09T10:00:00Z", NOW)).toBe(true);
  });

  it("เหลือ 10 วัน → ยังไม่เตือน", () => {
    expect(isExpiringSoon("2026-08-16T10:00:00Z", NOW)).toBe(false);
  });

  it("หมดอายุไปแล้ว → ไม่ใช่ 'ใกล้หมดอายุ' (สถานะเป็น expired ไปแล้ว)", () => {
    expect(isExpiringSoon("2026-08-01T10:00:00Z", NOW)).toBe(false);
  });

  it("ค่าที่แปลงเป็นวันที่ไม่ได้ → ไม่เตือน", () => {
    expect(isExpiringSoon("ไม่ใช่วันที่", NOW)).toBe(false);
  });
});

describe("label", () => {
  it("มีคำแปลไทยครบทุกโหมดและทุกสถานะ", () => {
    expect(Object.keys(API_POLICY_MODE_LABEL).sort()).toEqual(["audit", "enforce", "off"]);
    expect(Object.keys(API_KEY_STATUS_LABEL).sort()).toEqual(["active", "expired", "revoked"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/apiKeys.test.ts`
Expected: FAIL — cannot resolve `./apiKeys`

- [ ] **Step 3: Write minimal implementation**

`src/lib/apiKeys.ts`:

```ts
// Type + คำแปลของแท็บ "API Key" ในหน้า /settings
// ทะเบียน scope/endpoint ตัวจริงอยู่ที่ server/lib/apiPolicy.js และส่งมาทาง
// GET /api-keys/meta — ห้าม hardcode ซ้ำที่นี่ (บทเรียนจาก lineConfig.ts)

export type ApiKeyStatus = "active" | "expired" | "revoked";
export type ApiPolicyMode = "off" | "audit" | "enforce";

export type ApiScope = { id: string; label: string };

export type ApiKeyItem = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  expiresAt: string | null;
  revokedAt: string | null;
  rateLimitPerMinute: number;
  lastUsedAt: string | null;
  usageCount: number;
  createdBy: string;
  createdAt: string | null;
  status: ApiKeyStatus;
};

/** ตอบกลับเฉพาะตอนสร้าง — ค่า key เต็มไม่มีที่ไหนเก็บอีก */
export type CreatedApiKey = ApiKeyItem & { rawKey: string };

export type ApiKeyInput = {
  name: string;
  scopes: string[];
  expiresAt: string | null;
  rateLimitPerMinute: number;
};

export type ApiPolicyItem = {
  id: string;
  label: string;
  methods: string[];
  path: string;
  scope: string;
  mode: ApiPolicyMode;
  legacyEnv: string | null;
  wouldBlock7d: number;
};

export type ApiKeyMeta = {
  scopes: ApiScope[];
  modes: ApiPolicyMode[];
  policies: ApiPolicyItem[];
};

export type ApiRequestLogItem = {
  id: string;
  at: string;
  keyName: string;
  method: string;
  path: string;
  policyId: string;
  mode: ApiPolicyMode;
  outcome: string;
  reason: string;
  ip: string;
  status: number;
};

export const API_KEY_STATUS_LABEL: Record<ApiKeyStatus, string> = {
  active: "ใช้งาน",
  expired: "หมดอายุ",
  revoked: "เพิกถอนแล้ว",
};

export const API_POLICY_MODE_LABEL: Record<ApiPolicyMode, string> = {
  off: "ปิด (ไม่ตรวจ)",
  audit: "เฝ้าดู (ไม่บล็อก)",
  enforce: "บังคับใช้ key",
};

export const API_OUTCOME_LABEL: Record<string, string> = {
  allowed: "ผ่าน",
  "legacy-token": "ผ่าน (token เดิม)",
  "audit-pass": "ผ่าน (โหมดเฝ้าดู)",
  denied: "ปฏิเสธ",
  "rate-limited": "เกินโควตา",
};

export const API_REASON_LABEL: Record<string, string> = {
  ok: "—",
  "legacy-token": "ใช้ token เดิมใน .env",
  "no-key": "ไม่ได้ส่ง key มา",
  "unknown-key": "key ไม่รู้จัก",
  revoked: "key ถูกเพิกถอน",
  expired: "key หมดอายุ",
  "missing-scope": "scope ไม่ครอบ endpoint นี้",
  "rate-limited": "ยิงเกินโควตาต่อนาที",
};

export const EXPIRING_SOON_DAYS = 7;

/** ใกล้หมดอายุใน 7 วัน (ที่หมดไปแล้วนับเป็นสถานะ expired ไม่ใช่ "ใกล้หมด") */
export function isExpiringSoon(
  expiresAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!expiresAt) return false;
  const ms = new Date(expiresAt).getTime() - now.getTime();
  if (Number.isNaN(ms)) return false;
  return ms > 0 && ms <= EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/apiKeys.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/apiKeys.ts src/lib/apiKeys.test.ts
git commit -m "feat(api-keys): type + คำแปลไทยของแท็บ API Key"
```

---

### Task 11: FE — client API + ส่งอีเมลผู้ใช้ปัจจุบัน

**Files:**
- Modify: `src/lib/api.ts` (ฟังก์ชัน `fetchApi` ~บรรทัด 76-79, `fetchBlob` ~150-154, และ object `api` ~บรรทัด 171)
- Modify: `src/context/AuthContext.tsx` (หลังบล็อกที่คำนวณ `user` — บรรทัด ~189)

**Interfaces:**
- Consumes: Task 10 (types), Task 7 (endpoints)
- Produces: `setApiUserEmail(email?: string | null): void` และ `api.getApiKeys/getApiKeyMeta/createApiKey/updateApiKey/revokeApiKey/deleteApiKey/setApiPolicyMode/getApiKeyLogs`

- [ ] **Step 1: เพิ่ม `setApiUserEmail` + header ใน `src/lib/api.ts`**

เหนือ `async function fetchApi(...)` ใส่:

```ts
// อีเมลผู้ใช้ที่ล็อกอินอยู่ — ส่งไปกับทุก request เป็น header X-LIS-User เพื่อให้
// backend ตรวจสิทธิ์ admin ของ route /api-keys ได้ (AuthContext เป็นคนตั้งค่า)
// ⚠️ ไม่ใช่ security จริง (ปลอมได้) เฟส 2 จะเปลี่ยนไปใช้ Azure AD token
let currentUserEmail = "";

export function setApiUserEmail(email?: string | null) {
  currentUserEmail = email ? String(email) : "";
}

function identityHeaders(): Record<string, string> {
  return currentUserEmail ? { "X-LIS-User": currentUserEmail } : {};
}
```

แล้วแก้ header ทั้งใน `fetchApi` และ `fetchBlob` จาก

```ts
      headers: { "Content-Type": "application/json", ...options?.headers },
```

เป็น

```ts
      headers: { "Content-Type": "application/json", ...identityHeaders(), ...options?.headers },
```

- [ ] **Step 2: เพิ่มฟังก์ชัน API ใน object `api`**

เพิ่ม import type ที่หัวไฟล์:

```ts
import type {
  ApiKeyItem,
  ApiKeyInput,
  ApiKeyMeta,
  ApiPolicyMode,
  ApiRequestLogItem,
  CreatedApiKey,
} from "@/lib/apiKeys";
```

แล้วเพิ่มใน object `api` (ต่อท้ายกลุ่ม printer config เพื่อให้อ่านง่าย):

```ts
  // API keys (แท็บ API Key ในหน้าตั้งค่าระบบ — admin เท่านั้น)
  getApiKeys: () => request<{ data: ApiKeyItem[] }>("/api-keys").then((r) => r.data),
  getApiKeyMeta: () => request<{ data: ApiKeyMeta }>("/api-keys/meta").then((r) => r.data),
  createApiKey: (input: ApiKeyInput) =>
    request<{ data: CreatedApiKey }>("/api-keys", {
      method: "POST",
      body: JSON.stringify(input),
    }).then((r) => r.data),
  updateApiKey: (id: string, input: Partial<ApiKeyInput>) =>
    request<{ data: ApiKeyItem }>(`/api-keys/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }).then((r) => r.data),
  revokeApiKey: (id: string) =>
    request<{ data: ApiKeyItem }>(`/api-keys/${id}/revoke`, { method: "POST" }).then((r) => r.data),
  deleteApiKey: (id: string) => request<{ ok: boolean }>(`/api-keys/${id}`, { method: "DELETE" }),
  setApiPolicyMode: (policyId: string, mode: ApiPolicyMode) =>
    request<{ data: { policyId: string; mode: ApiPolicyMode } }>(`/api-keys/policy/${policyId}`, {
      method: "PATCH",
      body: JSON.stringify({ mode }),
    }).then((r) => r.data),
  getApiKeyLogs: (params?: { keyId?: string; outcome?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.keyId) qs.set("keyId", params.keyId);
    if (params?.outcome) qs.set("outcome", params.outcome);
    if (params?.limit) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ data: ApiRequestLogItem[] }>(`/api-keys/logs${suffix}`).then((r) => r.data);
  },
```

- [ ] **Step 3: ให้ AuthContext ป้อนอีเมลเข้า api.ts**

ใน `src/context/AuthContext.tsx` เพิ่ม import:

```ts
import { setApiUserEmail } from "@/lib/api";
```

แล้วหลังบล็อกที่คำนวณ `const user: AuthUser | null = ...` (จบราวบรรทัด 189) ใส่:

```ts
  // ส่งอีเมลผู้ใช้ปัจจุบันให้ api.ts แนบเป็น header X-LIS-User (backend ใช้ตรวจ
  // สิทธิ์ admin ของ route /api-keys)
  useEffect(() => {
    setApiUserEmail(user?.email);
  }, [user?.email]);
```

- [ ] **Step 4: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่จากไฟล์ที่แก้ (repo มี latent error เดิมอยู่ ~12 จุด — เทียบกับผลก่อนแก้ด้วย `git stash` ถ้าไม่แน่ใจ)

Run: `npm run test -- src/lib/apiKeys.test.ts`
Expected: PASS (ยืนยันว่าการแก้ api.ts ไม่ทำ import พัง)

- [ ] **Step 5: Commit**

```bash
git add src/lib/api.ts src/context/AuthContext.tsx
git commit -m "feat(api-keys): client API + ส่ง X-LIS-User ไปกับทุก request"
```

---

### Task 12: FE — ฟอร์มสร้าง/แก้ไข key

**Files:**
- Create: `src/components/lis/ApiKeyFormDialog.tsx`

**Interfaces:**
- Consumes: Task 10 (`ApiScope`, `ApiKeyItem`, `ApiKeyInput`, `CreatedApiKey`)
- Produces: default export `ApiKeyFormDialog` — props
  `{ open, onOpenChange(open), scopes, editing?: ApiKeyItem | null, saving: boolean, onSubmit(input: ApiKeyInput): Promise<CreatedApiKey | ApiKeyItem> }`
  โหมดสร้าง (`editing` = null) จะโชว์ค่า key เต็มหลังบันทึกสำเร็จ

- [ ] **Step 1: เขียนคอมโพเนนต์**

`src/components/lis/ApiKeyFormDialog.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiKeyInput, ApiKeyItem, ApiScope, CreatedApiKey } from "@/lib/apiKeys";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scopes: ApiScope[];
  editing?: ApiKeyItem | null;
  saving: boolean;
  onSubmit: (input: ApiKeyInput) => Promise<CreatedApiKey | ApiKeyItem>;
}

const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

export default function ApiKeyFormDialog({
  open,
  onOpenChange,
  scopes,
  editing,
  saving,
  onSubmit,
}: Props) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState("");
  const [rateLimit, setRateLimit] = useState("120");
  const [rawKey, setRawKey] = useState("");
  const [copied, setCopied] = useState(false);

  // รีเซ็ตฟอร์มทุกครั้งที่เปิด (deps = [open] เท่านั้น ไม่งั้น refetch ระหว่าง
  // กรอกจะล้างสิ่งที่พิมพ์ไว้)
  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setSelected(editing?.scopes ?? []);
    setExpiresAt(toDateInput(editing?.expiresAt ?? null));
    setRateLimit(String(editing?.rateLimitPerMinute ?? 120));
    setRawKey("");
    setCopied(false);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleScope = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("ต้องตั้งชื่อ key");
      return;
    }
    if (selected.length === 0) {
      toast.error("ต้องเลือกอย่างน้อย 1 scope");
      return;
    }
    const input: ApiKeyInput = {
      name: name.trim(),
      scopes: selected,
      expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null,
      rateLimitPerMinute: Number(rateLimit) || 0,
    };
    const result = await onSubmit(input);
    if (!editing && "rawKey" in result) {
      setRawKey(result.rawKey); // โชว์ค่าเต็มครั้งเดียว
      return;
    }
    onOpenChange(false);
  };

  const copyKey = async () => {
    await navigator.clipboard.writeText(rawKey);
    setCopied(true);
    toast.success("คัดลอก key แล้ว");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {rawKey ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                สร้าง key แล้ว
              </DialogTitle>
              <DialogDescription>
                คัดลอกเก็บไว้ตอนนี้เลย — ระบบเก็บแค่ค่าเข้ารหัส ปิดหน้าต่างนี้แล้วจะดูค่าเต็มไม่ได้อีก
                ถ้าทำหายต้องสร้างใบใหม่
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3">
              <code className="flex-1 break-all text-xs">{rawKey}</code>
              <Button size="sm" variant="outline" onClick={copyKey}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              วิธีใช้: ส่ง header <code>X-API-Key: {"<key>"}</code> ไปกับทุก request
            </p>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>เสร็จแล้ว</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{editing ? "แก้ไข API key" : "สร้าง API key"}</DialogTitle>
              <DialogDescription>
                ตั้งชื่อให้รู้ว่าใบนี้ของระบบไหน แล้วเลือกว่าให้เข้าถึงอะไรได้บ้าง
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="api-key-name">ชื่อ</Label>
                <Input
                  id="api-key-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น Node-RED ห้อง QC"
                />
              </div>
              <div className="space-y-2">
                <Label>เข้าถึงอะไรได้บ้าง (scope)</Label>
                {scopes.map((scope) => (
                  <label key={scope.id} className="flex items-start gap-2 text-sm">
                    <Checkbox
                      checked={selected.includes(scope.id)}
                      onCheckedChange={() => toggleScope(scope.id)}
                    />
                    <span>
                      {scope.label}
                      <span className="ml-1 text-xs text-muted-foreground">({scope.id})</span>
                    </span>
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="api-key-exp">วันหมดอายุ</Label>
                  <Input
                    id="api-key-exp"
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">เว้นว่าง = ไม่หมดอายุ</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="api-key-rate">โควตา (ครั้ง/นาที)</Label>
                  <Input
                    id="api-key-rate"
                    type="number"
                    min={0}
                    value={rateLimit}
                    onChange={(e) => setRateLimit(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">0 = ไม่จำกัด</p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                ยกเลิก
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {editing ? "บันทึก" : "สร้าง key"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่จากไฟล์นี้

- [ ] **Step 3: Commit**

```bash
git add src/components/lis/ApiKeyFormDialog.tsx
git commit -m "feat(api-keys): ฟอร์มสร้าง/แก้ไข key + โชว์ค่าเต็มครั้งเดียว"
```

---

### Task 13: FE — ตารางรายการ key

**Files:**
- Create: `src/components/lis/ApiKeyList.tsx`

**Interfaces:**
- Consumes: Task 10 (`ApiKeyItem`, `ApiScope`, label maps, `isExpiringSoon`)
- Produces: default export `ApiKeyList` — props `{ items, scopes, onEdit(item), onRevoke(item), onDelete(item) }`

- [ ] **Step 1: เขียนคอมโพเนนต์**

`src/components/lis/ApiKeyList.tsx`:

```tsx
import { Ban, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  API_KEY_STATUS_LABEL,
  isExpiringSoon,
  type ApiKeyItem,
  type ApiScope,
} from "@/lib/apiKeys";

interface Props {
  items: ApiKeyItem[];
  scopes: ApiScope[];
  onEdit: (item: ApiKeyItem) => void;
  onRevoke: (item: ApiKeyItem) => void;
  onDelete: (item: ApiKeyItem) => void;
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" }) : "—";

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("th-TH", { dateStyle: "medium" }) : "ไม่หมดอายุ";

const statusVariant = (status: ApiKeyItem["status"]) =>
  status === "active" ? "default" : status === "expired" ? "secondary" : "destructive";

export default function ApiKeyList({ items, scopes, onEdit, onRevoke, onDelete }: Props) {
  const scopeLabel = (id: string) => scopes.find((s) => s.id === id)?.label ?? id;

  if (items.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        ยังไม่มี API key — กด "สร้าง API key" เพื่อออกใบแรก
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="p-2 text-left">ชื่อ</th>
            <th className="p-2 text-left">key</th>
            <th className="p-2 text-left">scope</th>
            <th className="p-2 text-left">หมดอายุ</th>
            <th className="p-2 text-left">ใช้ล่าสุด</th>
            <th className="p-2 text-right">ครั้ง</th>
            <th className="p-2 text-left">สถานะ</th>
            <th className="p-2" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-t">
              <td className="p-2 font-medium">{item.name}</td>
              <td className="p-2 font-mono text-xs text-muted-foreground">{item.keyPrefix}…</td>
              <td className="p-2">
                <div className="flex flex-wrap gap-1">
                  {item.scopes.map((s) => (
                    <Badge key={s} variant="outline" className="text-[11px]">
                      {scopeLabel(s)}
                    </Badge>
                  ))}
                </div>
              </td>
              <td className="p-2">
                {fmtDate(item.expiresAt)}
                {isExpiringSoon(item.expiresAt) && (
                  <Badge variant="secondary" className="ml-1 text-[11px]">
                    ใกล้หมดอายุ
                  </Badge>
                )}
              </td>
              <td className="p-2 text-muted-foreground">{fmt(item.lastUsedAt)}</td>
              <td className="p-2 text-right tabular-nums">{item.usageCount}</td>
              <td className="p-2">
                <Badge variant={statusVariant(item.status)}>{API_KEY_STATUS_LABEL[item.status]}</Badge>
              </td>
              <td className="p-2">
                <div className="flex justify-end gap-1">
                  <Button size="icon" variant="ghost" title="แก้ไข" onClick={() => onEdit(item)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    title="เพิกถอน"
                    disabled={item.status === "revoked"}
                    onClick={() => onRevoke(item)}
                  >
                    <Ban className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" title="ลบ" onClick={() => onDelete(item)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่จากไฟล์นี้

- [ ] **Step 3: Commit**

```bash
git add src/components/lis/ApiKeyList.tsx
git commit -m "feat(api-keys): ตารางรายการ key"
```

---

### Task 14: FE — ตาราง endpoint + ตาราง log

**Files:**
- Create: `src/components/lis/ApiPolicyTable.tsx`, `src/components/lis/ApiRequestLogTable.tsx`

**Interfaces:**
- Consumes: Task 10 (`ApiPolicyItem`, `ApiPolicyMode`, `ApiRequestLogItem`, label maps)
- Produces:
  - `ApiPolicyTable` — props `{ policies, saving, onChangeMode(policyId, mode): void }`
  - `ApiRequestLogTable` — props `{ logs, loading, outcomeFilter, onOutcomeFilterChange(value) }`

- [ ] **Step 1: เขียน `ApiPolicyTable.tsx`**

```tsx
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { API_POLICY_MODE_LABEL, type ApiPolicyItem, type ApiPolicyMode } from "@/lib/apiKeys";

interface Props {
  policies: ApiPolicyItem[];
  saving: boolean;
  onChangeMode: (policyId: string, mode: ApiPolicyMode) => void;
}

const MODES: ApiPolicyMode[] = ["off", "audit", "enforce"];

export default function ApiPolicyTable({ policies, saving, onChangeMode }: Props) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="p-2 text-left">endpoint</th>
            <th className="p-2 text-left">scope ที่ต้องมี</th>
            <th className="p-2 text-left">7 วันที่ผ่านมา</th>
            <th className="p-2 text-left">โหมด</th>
          </tr>
        </thead>
        <tbody>
          {policies.map((policy) => (
            <tr key={policy.id} className="border-t">
              <td className="p-2">
                <div className="font-medium">{policy.label}</div>
                <code className="text-xs text-muted-foreground">{policy.path}</code>
              </td>
              <td className="p-2">
                <Badge variant="outline" className="text-[11px]">{policy.scope}</Badge>
                {policy.legacyEnv && (
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    ยังรับ token เดิม: {policy.legacyEnv}
                  </div>
                )}
              </td>
              <td className="p-2">
                {policy.wouldBlock7d > 0 ? (
                  <span className="text-amber-600">
                    จะถูกบล็อก {policy.wouldBlock7d} ครั้ง
                  </span>
                ) : (
                  <span className="text-muted-foreground">ไม่มีที่จะถูกบล็อก</span>
                )}
              </td>
              <td className="p-2">
                <Select
                  value={policy.mode}
                  disabled={saving}
                  onValueChange={(value) => onChangeMode(policy.id, value as ApiPolicyMode)}
                >
                  <SelectTrigger className="w-[190px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODES.map((mode) => (
                      <SelectItem key={mode} value={mode}>
                        {API_POLICY_MODE_LABEL[mode]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: เขียน `ApiRequestLogTable.tsx`**

```tsx
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  API_OUTCOME_LABEL,
  API_REASON_LABEL,
  type ApiRequestLogItem,
} from "@/lib/apiKeys";

interface Props {
  logs: ApiRequestLogItem[];
  loading: boolean;
  outcomeFilter: string;
  onOutcomeFilterChange: (value: string) => void;
}

const OUTCOMES = ["all", "audit-pass", "allowed", "legacy-token", "denied", "rate-limited"];

const tone = (outcome: string) =>
  outcome === "denied" || outcome === "rate-limited" ? "destructive" : "outline";

export default function ApiRequestLogTable({
  logs,
  loading,
  outcomeFilter,
  onOutcomeFilterChange,
}: Props) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">กรองผลลัพธ์</span>
        <Select value={outcomeFilter} onValueChange={onOutcomeFilterChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OUTCOMES.map((o) => (
              <SelectItem key={o} value={o}>
                {o === "all" ? "ทั้งหมด" : API_OUTCOME_LABEL[o] ?? o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
      ) : logs.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          ยังไม่มีการเรียกเข้ามาที่ endpoint ที่ถูกคุม
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="p-2 text-left">เวลา</th>
                <th className="p-2 text-left">endpoint</th>
                <th className="p-2 text-left">key</th>
                <th className="p-2 text-left">ผลลัพธ์</th>
                <th className="p-2 text-left">เหตุผล</th>
                <th className="p-2 text-left">IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t">
                  <td className="p-2 whitespace-nowrap text-muted-foreground">
                    {new Date(log.at).toLocaleString("th-TH", {
                      dateStyle: "short",
                      timeStyle: "medium",
                    })}
                  </td>
                  <td className="p-2">
                    <code className="text-xs">{log.method} {log.path}</code>
                  </td>
                  <td className="p-2">{log.keyName || "—"}</td>
                  <td className="p-2">
                    <Badge variant={tone(log.outcome)}>
                      {API_OUTCOME_LABEL[log.outcome] ?? log.outcome}
                    </Badge>
                  </td>
                  <td className="p-2 text-muted-foreground">
                    {API_REASON_LABEL[log.reason] ?? log.reason}
                  </td>
                  <td className="p-2 text-muted-foreground">{log.ip || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่จากสองไฟล์นี้

- [ ] **Step 4: Commit**

```bash
git add src/components/lis/ApiPolicyTable.tsx src/components/lis/ApiRequestLogTable.tsx
git commit -m "feat(api-keys): ตารางโหมด endpoint + ตาราง log การเรียก"
```

---

### Task 15: FE — ประกอบแท็บเข้าหน้า /settings

**Files:**
- Create: `src/components/lis/ApiKeysPanel.tsx`
- Modify: `src/lib/tabRegistry.ts:34-41`, `src/pages/SettingsPage.tsx` (บล็อกแท็บ LINE ~บรรทัด 224-233)

**Interfaces:**
- Consumes: Task 10–14 ทั้งหมด + `useConfirm` (`@/context/ConfirmDialog`)
- Produces: default export `ApiKeysPanel` (ไม่มี props) และแท็บ `api-keys` ในหน้า `/settings`

- [ ] **Step 1: เขียน `ApiKeysPanel.tsx`**

```tsx
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import ApiKeyFormDialog from "@/components/lis/ApiKeyFormDialog";
import ApiKeyList from "@/components/lis/ApiKeyList";
import ApiPolicyTable from "@/components/lis/ApiPolicyTable";
import ApiRequestLogTable from "@/components/lis/ApiRequestLogTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfirm } from "@/context/ConfirmDialog";
import { api } from "@/lib/api";
import {
  API_POLICY_MODE_LABEL,
  type ApiKeyInput,
  type ApiKeyItem,
  type ApiPolicyMode,
} from "@/lib/apiKeys";

const errMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;

export default function ApiKeysPanel() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ApiKeyItem | null>(null);
  const [outcomeFilter, setOutcomeFilter] = useState("all");

  const { data: meta } = useQuery({ queryKey: ["api-keys", "meta"], queryFn: api.getApiKeyMeta });
  const { data: keys = [] } = useQuery({ queryKey: ["api-keys"], queryFn: api.getApiKeys });
  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ["api-keys", "logs", outcomeFilter],
    queryFn: () =>
      api.getApiKeyLogs({ outcome: outcomeFilter === "all" ? undefined : outcomeFilter, limit: 50 }),
  });

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["api-keys"] });
  };

  const createMutation = useMutation({
    mutationFn: api.createApiKey,
    onSuccess: () => {
      toast.success("สร้าง API key แล้ว");
      refreshAll();
    },
    onError: (err) => toast.error(errMessage(err, "สร้างไม่สำเร็จ")),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<ApiKeyInput> }) =>
      api.updateApiKey(id, input),
    onSuccess: () => {
      toast.success("บันทึกแล้ว");
      refreshAll();
    },
    onError: (err) => toast.error(errMessage(err, "บันทึกไม่สำเร็จ")),
  });

  const revokeMutation = useMutation({
    mutationFn: api.revokeApiKey,
    onSuccess: () => {
      toast.success("เพิกถอน key แล้ว");
      refreshAll();
    },
    onError: (err) => toast.error(errMessage(err, "เพิกถอนไม่สำเร็จ")),
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteApiKey,
    onSuccess: () => {
      toast.success("ลบ key แล้ว");
      refreshAll();
    },
    onError: (err) => toast.error(errMessage(err, "ลบไม่สำเร็จ")),
  });

  const modeMutation = useMutation({
    mutationFn: ({ policyId, mode }: { policyId: string; mode: ApiPolicyMode }) =>
      api.setApiPolicyMode(policyId, mode),
    onSuccess: (result) => {
      toast.success(`เปลี่ยนเป็น "${API_POLICY_MODE_LABEL[result.mode]}" แล้ว`);
      refreshAll();
    },
    onError: (err) => toast.error(errMessage(err, "เปลี่ยนโหมดไม่สำเร็จ")),
  });

  const handleSubmit = async (input: ApiKeyInput) =>
    editing
      ? updateMutation.mutateAsync({ id: editing.id, input })
      : createMutation.mutateAsync(input);

  const handleRevoke = async (item: ApiKeyItem) => {
    const ok = await confirm({
      title: "เพิกถอน key นี้?",
      description: `"${item.name}" จะใช้งานไม่ได้ทันที ระบบที่ใช้ key ใบนี้อยู่จะโดนปฏิเสธ`,
      confirmText: "เพิกถอน",
      variant: "danger",
    });
    if (ok) revokeMutation.mutate(item.id);
  };

  const handleDelete = async (item: ApiKeyItem) => {
    const ok = await confirm({
      title: "ลบ key นี้?",
      description: `"${item.name}" จะหายจากรายการ (ประวัติการเรียกยังอยู่)`,
      confirmText: "ลบ",
      variant: "danger",
    });
    if (ok) deleteMutation.mutate(item.id);
  };

  const handleChangeMode = async (policyId: string, mode: ApiPolicyMode) => {
    const policy = meta?.policies.find((p) => p.id === policyId);
    if (mode === "enforce" && policy) {
      const ok = await confirm({
        title: "บังคับใช้ key กับ endpoint นี้?",
        description:
          policy.wouldBlock7d > 0
            ? `จากสถิติ 7 วันที่ผ่านมา จะมี ${policy.wouldBlock7d} ครั้งที่ถูกบล็อก — ตรวจว่าระบบปลายทางตั้ง key ครบแล้วก่อนกดยืนยัน`
            : "7 วันที่ผ่านมาไม่มีการเรียกที่จะถูกบล็อก เปิดได้เลย",
        confirmText: "บังคับใช้",
        variant: policy.wouldBlock7d > 0 ? "danger" : "default",
      });
      if (!ok) return;
    }
    modeMutation.mutate({ policyId, mode });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">API key</CardTitle>
            <CardDescription>
              ออก key ให้ระบบภายนอก (Node-RED, n8n, ระบบ production) ค่า key เต็มโชว์ครั้งเดียวตอนสร้าง
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            สร้าง API key
          </Button>
        </CardHeader>
        <CardContent>
          <ApiKeyList
            items={keys}
            scopes={meta?.scopes ?? []}
            onEdit={(item) => {
              setEditing(item);
              setFormOpen(true);
            }}
            onRevoke={handleRevoke}
            onDelete={handleDelete}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">การป้องกัน endpoint</CardTitle>
          <CardDescription>
            "เฝ้าดู" = ปล่อยผ่านแต่บันทึกว่าใครจะโดนบล็อก ใช้ดูให้ชัวร์ก่อนเปลี่ยนเป็น "บังคับใช้ key"
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ApiPolicyTable
            policies={meta?.policies ?? []}
            saving={modeMutation.isPending}
            onChangeMode={handleChangeMode}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ประวัติการเรียก</CardTitle>
          <CardDescription>50 รายการล่าสุด (เก็บย้อนหลัง 30 วัน)</CardDescription>
        </CardHeader>
        <CardContent>
          <ApiRequestLogTable
            logs={logs}
            loading={logsLoading}
            outcomeFilter={outcomeFilter}
            onOutcomeFilterChange={setOutcomeFilter}
          />
        </CardContent>
      </Card>

      <ApiKeyFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        scopes={meta?.scopes ?? []}
        editing={editing}
        saving={createMutation.isPending || updateMutation.isPending}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
```

- [ ] **Step 2: เพิ่มแท็บใน `src/lib/tabRegistry.ts`**

ในอาร์เรย์ของ `"/settings"` เพิ่มบรรทัดต่อจากแท็บ `line`:

```ts
    { key: "api-keys", label: "API Key", adminOnly: true },
```

- [ ] **Step 3: เพิ่ม `TabsContent` ใน `src/pages/SettingsPage.tsx`**

เพิ่ม import:

```tsx
import ApiKeysPanel from "@/components/lis/ApiKeysPanel";
```

แล้วต่อจากบล็อก `{isAdmin && ( <TabsContent value="line"> ... )}` ใส่:

```tsx
        {isAdmin && (
          <TabsContent value="api-keys" className="space-y-3">
            <p className="text-sm text-muted-foreground">
              ออก API key ให้ระบบภายนอกเรียก LIS และกำหนดว่า endpoint ไหนบังคับใช้ key แล้วบ้าง
            </p>
            <ApiKeysPanel />
          </TabsContent>
        )}
```

- [ ] **Step 4: Type-check + เทสทั้งชุด**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่

Run: `npm run test`
Expected: PASS ทั้งหมด (รวมเทสใหม่ของ `src/lib/apiKeys.test.ts`)

Run: `cd server && npx jest lib/apiPolicy.test.js lib/apiKeyAuth.test.js lib/policyModes.test.js lib/apiGuard.test.js lib/adminGate.test.js models/ApiKey.test.js routes/apiKeys.test.js export-data.test.js`
Expected: PASS ทั้ง 8 ไฟล์

- [ ] **Step 5: ทดสอบมือบนหน้าเว็บ**

รัน `npm run dev` (ทั้ง FE และ server) แล้วเข้า `http://localhost:8000/settings` ด้วย role admin:
1. เห็นแท็บ "API Key" (สลับ role เป็น lab ด้วย DevRoleSwitcher แล้วต้องไม่เห็น)
2. กด "สร้าง API key" → ตั้งชื่อ, ติ๊ก scope, กดสร้าง → เห็นค่า key เต็ม + ปุ่มคัดลอกทำงาน
3. ปิด dialog → key โผล่ในตาราง สถานะ "ใช้งาน"
4. ตาราง "การป้องกัน endpoint" แสดง 3 แถว โหมด "เฝ้าดู (ไม่บล็อก)"
5. เปลี่ยนโหมดเป็น "บังคับใช้ key" → เด้ง confirm พร้อมตัวเลขสถิติ → ยืนยันแล้ว toast ขึ้น
6. ยิง `curl -X POST http://localhost:3001/api/temphum -H "Content-Type: application/json" -d '{"board":"t"}'` → ได้ 401 และแถวใหม่โผล่ในตาราง "ประวัติการเรียก" (กด refresh หน้า)
7. เปลี่ยนโหมดกลับเป็น "เฝ้าดู" แล้วเพิกถอน/ลบ key ทดสอบทิ้ง

Expected: ครบทุกข้อ

- [ ] **Step 6: Commit**

```bash
git add src/components/lis/ApiKeysPanel.tsx src/lib/tabRegistry.ts src/pages/SettingsPage.tsx
git commit -m "feat(api-keys): แท็บ API Key ในหน้าตั้งค่าระบบ"
```

---

### Task 16: เอกสาร

**Files:**
- Modify: `CLAUDE.md` (เพิ่มหัวข้อใหม่ต่อจากส่วน "LINE integration")

**Interfaces:**
- Consumes: ทุก task ก่อนหน้า
- Produces: หัวข้อ "API protection / API keys" ใน CLAUDE.md

- [ ] **Step 1: เพิ่มหัวข้อใน `CLAUDE.md`**

แทรกต่อจากบล็อก "### LINE integration" (ก่อน "### Authentication"):

```markdown
### API protection / API keys

Endpoint ที่ **ระบบภายนอก** เรียก (ไม่ใช่ SPA) ถูกคุมด้วย middleware กลาง `server/lib/apiGuard.js`
ที่ `app.use()` ไว้ก่อน `mountApi(...)` ทุกบรรทัด

- **ทะเบียนเดียว** `server/lib/apiPolicy.js` — `API_SCOPES` + `API_POLICIES` (ตอนนี้: production-integration,
  temphum push, line ingest) path ที่ไม่อยู่ในทะเบียนถูกปล่อยผ่านทันที → **ห้ามใส่ route ที่ SPA เรียก**
  ลงในทะเบียนนี้ เพราะหน้าเว็บไม่มี key เปิด enforce เมื่อไหร่หน้าเว็บดับ
- **สามโหมดต่อ endpoint** เก็บใน `ApiPolicyMode` สลับได้จาก UI: `off` / `audit` (ปล่อยผ่าน + log ว่าจะโดน
  บล็อกเพราะอะไร) / `enforce` ค่าเริ่มต้นของทุก endpoint = `audit`
- **key**: `lisk_<random>` เก็บเฉพาะ sha256 ใน `ApiKey` (`seed-data/` เข้า git) ส่งมาทาง `X-API-Key` หรือ
  `Authorization: Bearer` มี scope / วันหมดอายุ / เพิกถอน / rate limit ต่อนาที
- **token เดิม** (`PRODUCTION_INTEGRATION_TOKEN`, `LINE_INGEST_SECRET`) ยังใช้ได้ระหว่างช่วงย้าย
  guard บันทึก log ว่า `legacy-token` เพื่อดูว่าเหลือใครยังไม่ย้าย
- **log** `ApiRequestLog` (TTL 30 วัน ปรับด้วย `API_LOG_TTL_DAYS`) — ถูก **ข้าม** ใน `export-data.js`
  (`SKIP_COLLECTIONS`) ไม่งั้น auto-sync commit ทุกชั่วโมง
- **UI**: แท็บ "API Key" ในหน้า `/settings` (`src/components/lis/ApiKeysPanel.tsx`, admin-only)
  ทะเบียน scope/endpoint ดึงจาก `GET /api-keys/meta` — อย่า hardcode ซ้ำฝั่ง FE
- **⚠️ route จัดการ key** กันด้วย `server/lib/adminGate.js` ที่อ่าน header `X-LIS-User` (SPA ใส่ให้ที่
  `fetchApi()`) แล้วเช็ค role admin ใน DB — **ปลอมได้** เท่ากับระดับความเชื่อถือของทั้งระบบตอนนี้
  ตัวปิดรูจริงคือให้ backend verify Azure AD token (ยังไม่ทำ) ดูสเปก
  `docs/superpowers/specs/2026-08-06-api-keys-and-api-protection-design.md`
```

- [ ] **Step 2: ตรวจงานรวมครั้งสุดท้าย**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Run: `npm run test`
Run: `cd server && npx jest lib/api models/ApiKey routes/apiKeys export-data`
Expected: ผ่านทั้งหมด

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: บันทึกระบบ API key + การป้องกัน API ใน CLAUDE.md"
```

---

## หลัง implement เสร็จ (ให้ผู้ใช้ทำบน production)

1. deploy — ทุก endpoint อยู่โหมด `audit` ไม่มีอะไรถูกบล็อก
2. เข้า `/settings` → แท็บ API Key → สร้าง key ให้ Node-RED / n8n / ระบบ production ตาม scope
3. ตั้ง header `X-API-Key` ที่ระบบปลายทาง
4. ดูตาราง "ประวัติการเรียก" จนไม่เหลือ `ผ่าน (โหมดเฝ้าดู)` ที่เหตุผลเป็น "ไม่ได้ส่ง key มา" และไม่เหลือ `ผ่าน (token เดิม)`
5. สลับ endpoint นั้นเป็น "บังคับใช้ key"
6. ครบทุก endpoint แล้วค่อยลบ `PRODUCTION_INTEGRATION_TOKEN` / `LINE_INGEST_SECRET` ออกจาก `server/.env`
7. `cd server && npm run seed:export` แล้ว commit เพื่อให้ `seed-data/` ตรงกับ DB
