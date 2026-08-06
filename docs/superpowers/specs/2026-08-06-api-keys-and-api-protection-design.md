# API Key + การป้องกัน API (แท็บใหม่ในหน้าตั้งค่าระบบ)

วันที่: 2026-08-06

## 1. ปัญหา / เป้าหมาย

ตอนนี้ backend **ไม่มี authentication เลย** — ทุก route ที่ `mountApi()` ใน `server/index.js` เปิดโล่ง
ใครยิงถึงเครื่องก็เรียกได้หมด (frontend เองก็ไม่แนบ token อะไรไป — `src/lib/api.ts` ส่งแค่ `Content-Type`)
และเซิร์ฟเวอร์ตัวนี้ออกอินเทอร์เน็ตอยู่แล้ว (LINE webhook ชี้มาที่ `https://<host>/LIS/api/line/webhook`)

ของที่มี "กุญแจ" อยู่บ้างเป็น env var กระจัดกระจาย 3 ที่ ออกใหม่/เพิกถอน/ดูว่าใครใช้ไม่ได้เลย:
`PRODUCTION_INTEGRATION_TOKEN`, `LINE_INGEST_SECRET`, `LIS_SSO_SECRET`

**เป้าหมาย**
1. แท็บใหม่ **"API Key"** ในหน้า `/settings` (admin เท่านั้น) สำหรับ**ออก / ดู / เพิกถอน** API key ต่อระบบภายนอก
2. **บังคับ key** กับ endpoint ที่ระบบภายนอกเรียก โดย**ไม่กระทบหน้าเว็บเดิม** และเปิดใช้แบบ audit ก่อนค่อย enforce

## 2. ความต้องการ

| # | ข้อกำหนด | ที่มา |
|---|---|---|
| R1 | ป้องกัน**เฉพาะ endpoint ที่ระบบภายนอกเรียก** — route ที่ SPA ใช้ไม่แตะ | ผู้ใช้เลือก |
| R2 | key แต่ละใบ**เลือก scope ได้** ว่าเข้าถึงกลุ่มไหนบ้าง | ผู้ใช้เลือก |
| R3 | deploy แล้วเริ่มที่โหมด **audit** (log อย่างเดียว ไม่บล็อก) แล้วค่อยกดสวิตช์เป็น enforce ทีละ endpoint จาก UI | ผู้ใช้เลือก |
| R4 | key มี **วันหมดอายุ** และ **เพิกถอนได้ทันที** | ผู้ใช้เลือก |
| R5 | **Log การเรียก** (key ไหน เรียกอะไร เมื่อไหร่ จาก IP ไหน ผลเป็นอย่างไร) และดูได้ในแท็บ | ผู้ใช้เลือก |
| R6 | **Rate limit ต่อ key** เกินโควตาตอบ 429 | ผู้ใช้เลือก |
| R7 | ค่า key เต็มโชว์**ครั้งเดียว**ตอนสร้าง ระบบเก็บแค่ hash | มาตรฐาน |
| R8 | ของเดิมที่ยิงเข้ามาอยู่แล้ว (Node-RED, n8n, production) **ต้องไม่พัง**ตอน deploy | ผู้ใช้เลือก |

ไม่รวมในรอบนี้ (ดูข้อ 9): จำกัด IP ต่อ key, external read API, การ verify Azure AD token ฝั่ง backend

## 3. สิ่งที่มีอยู่แล้ว (ต่อยอด ไม่สร้างใหม่)

- **`mountApi()`** (`server/index.js`) — ทุก route ถูก mount 2 ที่: `/api/*` และ `/LIS/api/*` → path matching ต้องรองรับทั้งคู่
- **`server/lib/softDelete.js`** — `softDeletePlugin` ใช้กับทุก model ใหม่ (ดู `models/PrinterConfig.js` เป็นตัวอย่างสั้นที่สุด)
- **`src/lib/tabRegistry.ts`** — แท็บรายหน้า deny-model + `adminOnly` (แท็บ LINE ใช้อยู่)
- **`src/lib/api.ts` → `fetchApi()`** — จุดเดียวที่ JSON request ทุกตัววิ่งผ่าน ใส่ header กลางได้ที่นี่
- **`server/lib/roles.js` → `normalizeRoles()`** — เช็ค role `admin` ฝั่ง server
- **แพทเทิร์นเทส** — logic บริสุทธิ์อยู่ `server/lib/*.js` คู่กับ `*.test.js` (jest); FE ใช้ vitest
- **`ALLOW_DEV_STATUS`** — ธง dev-only ที่ prod ห้ามตั้ง (`routes/dev.js`) รอบนี้ใช้ซ้ำเป็นทางออกของ admin gate ตอน dev
- **token เดิม** `PRODUCTION_INTEGRATION_TOKEN` (`routes/productionIntegration.js`), `LINE_INGEST_SECRET` (`routes/line.js`)

## 4. สถาปัตยกรรม

```
request → apiGuard (middleware กลาง, วางก่อน mountApi ทุกตัว)
            │
            ├── matchPolicy(method, path) = null  → next()   // 99% ของ traffic = หน้าเว็บ
            └── เจอ policy
                  ├── mode = off      → next()
                  ├── mode = audit    → next() + log ว่า "ถ้า enforce จะเป็นยังไง"
                  └── mode = enforce  → evaluateKey() → next() | 401 | 403 | 429  (+ log)
```

### 4.1 Policy registry — `server/lib/apiPolicy.js`

แหล่งความจริงเดียว ทั้ง middleware และ UI อ่านจากที่นี่ (UI ดึงผ่าน `GET /api-keys/meta` ไม่ hardcode ฝั่ง FE)

```js
const API_SCOPES = [
  { id: 'integration:write', label: 'รับคำขอจากระบบ production' },
  { id: 'temphum:write',     label: 'ส่งค่าอุณหภูมิ/ความชื้น (Node-RED)' },
  { id: 'line:ingest',       label: 'ส่ง event LINE ผ่าน n8n' },
];

const API_POLICIES = [
  { id: 'production-integration', methods: ['POST'], prefix: '/production-integration',
    scope: 'integration:write', label: 'สร้างคำขอจากระบบ production', defaultMode: 'audit' },
  { id: 'temphum-push',           methods: ['POST'], prefix: '/temphum', exact: true,
    scope: 'temphum:write',   label: 'Node-RED push อุณหภูมิ/ความชื้น', defaultMode: 'audit' },
  { id: 'line-ingest',            methods: ['POST'], prefix: '/line/ingest',
    scope: 'line:ingest',     label: 'n8n ส่ง event LINE เข้า LIS', defaultMode: 'audit' },
];
```

**ไม่คุม** โดยตั้งใจ:
- `POST /line/webhook` และ `POST /auth/sso` — มีลายเซ็นของตัวเองอยู่แล้ว (HMAC ของ LINE / SSO token) ใส่ key ซ้ำไม่ได้อะไรเพิ่ม
- `GET /temphum` — หน้าเว็บใช้อยู่
- **ทุก route ที่ SPA เรียก** — SPA ไม่มี key ใส่ในตารางเมื่อไหร่แล้วกด enforce หน้าเว็บดับทันที (R1)

### 4.2 Model

**`server/models/ApiKey.js`** (+ `softDeletePlugin`)

| field | ชนิด | หมายเหตุ |
|---|---|---|
| `name` | String, required | เช่น "Node-RED ห้อง QC" |
| `keyPrefix` | String, index | 12 ตัวแรกของ key ไว้โชว์ในตาราง เช่น `lisk_7f3a9b…` |
| `keyHash` | String, unique index | `sha256(rawKey)` hex — **ไม่เก็บ key เต็ม** |
| `scopes` | [String] | อ้าง `API_SCOPES[].id` |
| `expiresAt` | Date \| null | null = ไม่หมดอายุ |
| `revokedAt` / `revokedBy` | Date / String | เพิกถอนแล้วใช้ไม่ได้ทันที |
| `rateLimitPerMinute` | Number, default 120 | 0 = ไม่จำกัด |
| `lastUsedAt` / `usageCount` | Date / Number | อัปเดตแบบ fire-and-forget |
| `createdBy` | String | อีเมล admin ที่กดสร้าง |

รูปแบบ key: `lisk_` + `crypto.randomBytes(32).toString('base64url')` (43 ตัว)
ใช้ **sha256** ไม่ใช่ bcrypt เพราะต้อง lookup ทุก request และตัว key สุ่มจากระบบ (เอนโทรปี 256 บิต) ไม่ใช่รหัสผ่านที่คนตั้ง — bcrypt จะช้าโดยไม่ได้ความปลอดภัยเพิ่ม และ lookup ด้วย unique index ทำไม่ได้

**`server/models/ApiRequestLog.js`**

`at` (Date, **TTL index** ตาม `API_LOG_TTL_DAYS` default 30), `keyId`, `keyName`, `method`, `path`,
`policyId`, `mode`, `outcome`, `reason`, `ip`, `status`

เขียนแบบ fire-and-forget (`.catch(() => {})`) — log ล่มต้องไม่ทำให้ request ล่ม

**`server/models/ApiPolicyMode.js`** — `{ policyId (unique), mode: 'off'|'audit'|'enforce', updatedBy }`
ไม่มี doc = ใช้ `defaultMode` จาก registry

### 4.3 Middleware — `server/lib/apiGuard.js`

แยก 2 ชั้นเพื่อเทสได้ตรงๆ:

**ชั้นบริสุทธิ์ (jest ทดสอบ)**
- `normalizePath(url)` → ตัด query, ตัด prefix `/LIS` แล้ว `/api` → เหลือ `/temphum`
- `matchPolicy(policies, method, path)` → `policy | null`
- `evaluateKey({ keyDoc, policy, now })` → `{ decision: 'allow'|'deny', reason }`
  reason: `ok` | `no-key` | `unknown-key` | `revoked` | `expired` | `missing-scope`
- `checkRateLimit(state, keyId, limit, now)` → `{ allowed, count }` (fixed window 1 นาที, state = Map ที่ส่งเข้าไป)

**ชั้น express**
1. `matchPolicy` ไม่เจอ → `next()` ทันที (ไม่แตะ DB, ไม่ log)
2. อ่าน key จาก `X-API-Key` หรือ `Authorization: Bearer <key>`
3. มี key → `ApiKey.findOne({ keyHash })` → `evaluateKey` → `checkRateLimit`
4. ไม่มี key แต่ตรงกับ **legacy token** ของ policy นั้น (`PRODUCTION_INTEGRATION_TOKEN` / `LINE_INGEST_SECRET`) → ผ่าน, `outcome = 'legacy-token'` (R8 — ไว้ดูว่าใครยังไม่ย้าย)
5. mode:
   - `off` → ผ่าน ไม่ log
   - `audit` → **ผ่านเสมอ** log `outcome = 'audit-pass'` พร้อม `reason` ที่จะใช้บล็อกถ้า enforce
   - `enforce` → ตามผล: allow → `next()` + set `req.apiKey`; deny → `401` (`no-key`/`unknown-key`/`revoked`/`expired`), `403` (`missing-scope`), `429` (rate limit)
6. log ทุกกรณีที่ match policy (ยกเว้น mode `off`) + อัปเดต `lastUsedAt`/`usageCount`

**แคชโหมด**: อ่าน `ApiPolicyMode` ทั้งหมดเก็บใน memory, รีเฟรชเมื่อ (ก) แก้ผ่าน API หรือ (ข) เกิน 30 วินาทีนับจากอ่านครั้งล่าสุด — กันกรณีแก้ DB ตรงๆ

**Rate limit**: `Map<keyId, { windowStart, count }>` ในหน่วยความจำ (เซิร์ฟเวอร์รันโปรเซสเดียว) รีเซ็ตตอน restart — ยอมรับได้

### 4.4 Admin gate ของ route จัดการ key — `server/lib/adminGate.js`

route `/api-keys` เองอยู่บน backend ที่ไม่มี auth ถ้าปล่อยไว้ ใครก็ยิง `POST /api-keys` ออก key ให้ตัวเองได้
ระบบป้องกันทั้งหมดก็ไร้ความหมาย รอบนี้ใช้:

- SPA แนบ `X-LIS-User: <email>` — เพิ่มที่ `fetchApi()` จุดเดียว ค่า email ตั้งผ่าน `setApiUserEmail()` ที่ `AuthContext` เรียกตอน user โหลดเสร็จ
- `requireAdminUser` ตรวจว่า user นั้นมีจริงใน DB และ `normalizeRoles(user).includes('admin')` ไม่ผ่าน → `403`
- `/api-keys` **ไม่อยู่ใน policy registry ตลอดไป** → API key เรียก route จัดการ key ไม่ได้ (key ออก key ไม่ได้)
- ตอน dev: ถ้า `ALLOW_DEV_STATUS === 'true'` ให้ผ่าน (dev user สังเคราะห์อาจไม่มีใน DB) พร้อม `console.warn`

**ข้อจำกัดที่รู้ตัว**: header นี้ปลอมได้ถ้าคนอยู่ในเน็ตเวิร์กและรู้อีเมล admin — เท่ากับระดับความเชื่อถือที่ทั้งระบบใช้อยู่ตอนนี้ (หน้าเว็บก็ gate ด้วย FE อย่างเดียว) ไม่ได้แย่ลง แต่**ไม่ใช่ความปลอดภัยจริง** ตัวปิดรูนี้คือเฟส 2: backend verify Azure AD access token (ข้อ 9)

## 5. API

ทุก route ต่อไปนี้ผ่าน `requireAdminUser`:

| method | path | หน้าที่ |
|---|---|---|
| `GET` | `/api-keys/meta` | catalogue: scopes, policies + โหมดปัจจุบัน + สถิติ 7 วันต่อ policy |
| `GET` | `/api-keys` | รายการ key (ไม่มีค่า key เต็ม) |
| `POST` | `/api-keys` | สร้าง → **คืน `rawKey` ครั้งเดียว** |
| `PATCH` | `/api-keys/:id` | แก้ชื่อ / scopes / expiresAt / rateLimitPerMinute |
| `POST` | `/api-keys/:id/revoke` | เพิกถอนทันที |
| `DELETE` | `/api-keys/:id` | soft delete |
| `PATCH` | `/api-keys/policy/:policyId` | เปลี่ยนโหมด off/audit/enforce + ล้างแคช |
| `GET` | `/api-keys/logs?keyId=&outcome=&limit=` | log ล่าสุด (default 50, max 200) |

"สถิติ 7 วัน" = จำนวน log ย้อนหลัง 7 วันที่ `outcome = 'audit-pass'` และ `reason !== 'ok'` (คือครั้งที่**จะ**ถูกบล็อกถ้าเปิด enforce) นับแยกตาม `policyId`

mount: `mountApi('/api-keys', require('./routes/apiKeys'))`

**ลำดับที่พลาดไม่ได้**
- `app.use(apiGuard)` ต้องอยู่**ก่อน** `mountApi(...)` ทุกบรรทัด และ**หลัง** `express.json()`
- ใน `routes/apiKeys.js` ต้อง register `/policy/:policyId` และ `/logs` **ก่อน** `/:id` ไม่งั้น `:id` กลืน (บทเรียนเดิมจาก `/standards/in-use`)

## 6. UI

**แท็บ**: `src/lib/tabRegistry.ts` → `"/settings"` เพิ่ม `{ key: "api-keys", label: "API Key", adminOnly: true }`
(ต่อท้าย ก่อน/หลังแท็บ LINE ก็ได้ — ทั้งคู่ adminOnly)

**ไฟล์** (`src/components/lis/`) แยกชิ้นเล็กตามแพทเทิร์นเดิม:

| ไฟล์ | หน้าที่ |
|---|---|
| `ApiKeysPanel.tsx` | ประกอบ 3 ส่วนล่าง + query/mutation ทั้งหมด |
| `ApiKeyCreateDialog.tsx` | ฟอร์มสร้าง + จอโชว์ key เต็มครั้งเดียว (ปุ่มคัดลอก + คำเตือน) |
| `ApiKeyList.tsx` | ตาราง key + ปุ่มแก้ไข/เพิกถอน/ลบ |
| `ApiPolicyTable.tsx` | endpoint + dropdown โหมด + ตัวเลข "7 วันที่ผ่านมาจะถูกบล็อก N ครั้ง" |
| `ApiRequestLogTable.tsx` | log ล่าสุด + filter key/outcome |
| `src/lib/apiKeys.ts` | type + helper (สถานะ key: ใช้งาน / หมดอายุ / เพิกถอน) |

- catalogue ของ scope/endpoint **ดึงจาก `GET /api-keys/meta`** ไม่ mirror ฝั่ง FE — กันปัญหาแบบ `lineConfig.ts` ที่ต้องนั่ง sync สองที่
- ปุ่มเปลี่ยนโหมดเป็น `enforce` ให้ถามยืนยันผ่าน `ConfirmDialog` พร้อมบอกจำนวนครั้งที่จะโดนบล็อกจากสถิติ 7 วัน
- ข้อความทั้งหมดภาษาไทย ตามหน้าอื่น

## 7. การทดสอบ

**jest (`server/lib/apiGuard.test.js`)** — logic บริสุทธิ์:
- `normalizePath` ตัด `/LIS/api` และ `/api` ได้ทั้งคู่ + ตัด query string
- `matchPolicy` แม่นเรื่อง method (GET `/temphum` ไม่ match), `exact` vs prefix, path ที่ไม่เกี่ยว → null
- `evaluateKey` ครบทุก reason: ok / no-key / unknown-key / revoked / expired / missing-scope
- `checkRateLimit` นับในหน้าต่างเดียวกัน, ข้ามนาทีแล้วรีเซ็ต, `limit = 0` = ไม่จำกัด

**jest (`server/routes/apiKeys.test.js`)** ตามแพทเทิร์น `routes/line.test.js`:
- สร้าง key แล้วคืน `rawKey` **ครั้งเดียว** และ `GET` รายการต้องไม่มี `keyHash`/`rawKey`
- `requireAdminUser` บล็อกเมื่อไม่มี header / user ไม่ใช่ admin

**vitest (FE)** — `src/lib/apiKeys.test.ts` เฉพาะ helper สถานะ key (หมดอายุ/เพิกถอน/ใช้งาน)

**ทดสอบมือก่อนปิดงาน**: หน้าเว็บทุกหน้าใช้งานได้ปกติ (guard ต้องไม่แตะ), `curl` POST `/api/temphum` โดยไม่มี key ในโหมด audit → ผ่าน + มี log; สลับเป็น enforce → 401; ใส่ key ถูก scope → ผ่าน

## 8. ลำดับ deploy

1. deploy โค้ด — ทุก policy อยู่โหมด `audit` **ไม่มีอะไรถูกบล็อก** (R3/R8)
2. admin เข้า `/settings` → แท็บ API Key → สร้าง key ให้ Node-RED / n8n / production ทีละใบ ตาม scope ที่ต้องใช้
3. ไปตั้ง header `X-API-Key` ในแต่ละระบบปลายทาง
4. ดูตาราง log จนไม่มี `audit-pass (no-key)` และไม่มี `legacy-token` ของ endpoint นั้นแล้ว → กดสวิตช์เป็น `enforce`
5. ทำทีละ endpoint จนครบ แล้วค่อยลบ env token เดิมออกจาก `.env`
6. รัน `npm run seed:export` + commit หลังมีการสร้าง key จริง (ตามกติกา seed-data ของ repo)

**สองเรื่องที่ต้องจัดการเพราะ `seed-data/` เข้า git**
- `ApiKey` เก็บแค่ hash (ตามข้อ 4.2) จึงปลอดภัยที่จะถูก export
- `export-data.js` ดัมพ์ทุก collection แบบ dynamic → ต้องเพิ่ม **`SKIP_COLLECTIONS = ['apirequestlogs']`**
  ไม่งั้น log (Node-RED ยิงนาทีละครั้ง ≈ 43k doc/30 วัน) จะถูก commit ใหม่ทุกชั่วโมงโดย `auto-sync.ps1`
  — log ไม่มีค่าเชิงกู้คืนข้อมูลอยู่แล้ว

## 9. นอกขอบเขต / ข้อจำกัดที่รู้ตัว

| เรื่อง | สถานะ |
|---|---|
| Backend verify Azure AD token (ปิดรู `X-LIS-User` ปลอมได้ + ป้องกัน route ที่ SPA ใช้) | **เฟส 2** — งานใหญ่ ต้องแก้ `api.ts` + `AuthContext` + JWKS |
| External read API (`/api/external/...` ให้ระบบอื่นดึงข้อมูล LIS) | ยังไม่มีคนขอ registry รองรับเพิ่ม scope ได้ทันที |
| จำกัด IP/CIDR ต่อ key | ผู้ใช้ไม่เลือกในรอบนี้ |
| Rate limit แบบข้ามโปรเซส (Redis) | เกินความจำเป็น เซิร์ฟเวอร์รันโปรเซสเดียว |
| หมุน key อัตโนมัติ (rotation) | ทำมือผ่าน UI ได้อยู่แล้ว (สร้างใบใหม่ → ย้าย → เพิกถอนใบเก่า) |
