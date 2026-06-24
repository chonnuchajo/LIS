# Design: แท็บ "API" ในหน้าตั้งค่าระบบ (admin-only API endpoint list)

วันที่: 2026-06-24
สถานะ: approved

## เป้าหมาย

ให้ admin ดูรายการ API endpoint ทั้งหมดที่ backend mount อยู่ ผ่านแท็บใหม่ในหน้า
`ตั้งค่าระบบ` (`/settings`) แบบ read-only เห็นเฉพาะ role `admin`

## ขอบเขต (จากการ brainstorm)

- **เนื้อหา:** ลิสต์ endpoint เฉยๆ (method + path) — ไม่มีปุ่มยิงทดสอบ ไม่ใช่ health check
- **ที่อยู่:** แท็บใหม่ในหน้า `/settings` (ไม่สร้าง route หน้าแยก)
- **สิทธิ์:** role `admin` เท่านั้น — fix เป็น admin-only ไม่ผ่าน access matrix

### ทำไมไม่ใช้ `/api/list` ตามที่ขอตรงๆ
Frontend อยู่ใต้ basename `/LIS` → path `/api/list` กลายเป็น `/LIS/api/list` ซึ่ง
Vite proxy และ `.htaccess` จะส่งไป backend เสมอ ไม่เข้า React router เลย จึงวางเป็น
แท็บในหน้า settings แทน

## สถาปัตยกรรม

### Backend

**`server/lib/listRoutes.js`** — pure function `extractRoutes(app)`
- เดิน `app._router.stack` แบบ recursive ดึงทุก route layer เป็น `{ method, path }`
- รวม mount prefix ของ sub-router เข้ากับ path ภายใน (parse จาก `layer.regexp`)
- กรองเฉพาะ path ที่ขึ้นต้น `/api/` — ตัด duplicate ฝั่ง `/LIS/api/*` และ static/SPA layer ทิ้ง
- dedupe + sort ตาม path แล้ว method
- คืน `Array<{ method: string, path: string }>`

**`server/index.js`** — mount endpoint อ่าน list
- เพิ่ม `app.get('/api/_routes', handler)` และ `app.get('/LIS/api/_routes', handler)`
- ต้องวาง **หลัง** `mountApi(...)` ทุกตัว (stack ต้องถูก populate ก่อน — อ่านตอน request time)
  และ **ก่อน** บล็อก SPA fallback `app.get(['/LIS/*'], ...)` ไม่งั้น `/LIS/api/_routes`
  จะโดน `/LIS/*` จับก่อน
- handler: `res.json({ data: extractRoutes(app) })` ให้ shape เข้ากับ `api.get` wrapper เดิม

### Frontend

**`src/lib/api.ts`** — เพิ่ม `getApiRoutes()` → `GET /_routes` คืน `ApiRouteInfo[]`
(`type ApiRouteInfo = { method: string; path: string }`)

**`src/components/lis/ApiRoutesCard.tsx`** (ใหม่)
- React Query `["api-routes"]` → `api.getApiRoutes`
- ช่องค้นหา (filter ตาม path/method, substring, case-insensitive)
- แสดงจำนวนรวม + จำนวนหลัง filter
- ตาราง: method badge (สีตาม GET/POST/PUT/DELETE) + path; group ตาม segment แรก
  หลัง `/api/` (samples, petitions, ...) มีหัวกลุ่มคั่น
- loading / error state ตามแบบหน้าอื่น

**`src/pages/SettingsPage.tsx`** — เพิ่มแท็บ "API"
- `const isAdmin = normalizeRoles(user).includes('admin')` (จาก `@/lib/roles`, user จาก `useAuth`)
- render `<TabsTrigger value="api">API</TabsTrigger>` และ `<TabsContent value="api">`
  เฉพาะเมื่อ `isAdmin` — แยกจาก `useAccessibleTabs` matrix (ไม่เพิ่ม `"api"` ใน `TAB_KEYS`)

## Data flow

`ApiRoutesCard` → `api.getApiRoutes()` → `GET /LIS/api/_routes` → `extractRoutes(app)`
อ่าน `app._router.stack` ปัจจุบัน → คืน list → render ตาราง

## Error handling

- fetch ล้มเหลว → React Query `isError` → ข้อความ error ภาษาไทยในการ์ด
- backend handler ไม่ throw (introspection เป็น read อย่างเดียว); ถ้า `app._router` ไม่มี
  (กรณีหลุด) คืน `[]`

## Testing

- `server/lib/listRoutes.test.js` — mock app ที่มี nested router stack →
  ยืนยัน: dedupe `/LIS/api` ออก, sort ถูก, รวม mount prefix + sub path ถูก, ตัด static/SPA

## ไม่ทำ (YAGNI)

- ไม่มีปุ่มยิง/ทดสอบ API ในหน้า
- ไม่สร้าง route frontend แยก (`/api-list`)
- ไม่ใส่ `"api"` ใน access matrix (fix admin-only)
- ไม่ใส่ auth middleware ฝั่ง backend (consistent กับ route อื่นที่ gate ที่ frontend;
  ข้อมูลเป็นแค่รายชื่อ path ไม่ใช่ข้อมูลลับ)
