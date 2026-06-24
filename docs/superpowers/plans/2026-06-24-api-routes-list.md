# API Endpoint List Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มแท็บ "API" ในหน้า `/settings` ที่แสดงรายการ API endpoint ทั้งหมดของ backend แบบ read-only เห็นเฉพาะ role `admin`

**Architecture:** Backend introspect `app._router.stack` ผ่าน pure function `extractRoutes(app)` แล้ว expose ที่ `GET /api/_routes` (+ `/LIS/api/_routes`). Frontend ดึง list ผ่าน React Query มาแสดงในการ์ดใหม่ใต้แท็บ settings ที่ render เฉพาะ admin

**Tech Stack:** Express 4 (backend introspection + node:test), React 18 + TanStack Query + Tailwind (frontend)

## Global Constraints

- Backend route ทุกตัว mount สองที่ผ่าน `mountApi()` — `/api/*` และ `/LIS/api/*`; endpoint ใหม่ทำเองทั้งสอง path
- Frontend API base = `import.meta.env.BASE_URL + "api"`; เรียกผ่าน `api` object ใน `src/lib/api.ts` ด้วย path สัมพัทธ์ (ไม่ใส่ `/api` นำหน้า)
- Admin check ใช้ `normalizeRoles(user).includes("admin")` จาก `@/lib/roles` (convention เดิมทั้ง repo) — ห้ามใช้ `user.role === "admin"` ตรงๆ
- Server test เป็น `node:test` (`require('node:test')`), รันด้วย `node --test <file>` (ดู `server/lib/densityBatch.test.js` เป็นแบบ)
- Type-check frontend จริงด้วย `npx tsc -p tsconfig.app.json --noEmit` (root `tsc --noEmit` เป็น no-op)

---

### Task 1: `extractRoutes` — introspect Express stack (backend lib)

**Files:**
- Create: `server/lib/listRoutes.js`
- Test: `server/lib/listRoutes.test.js`

**Interfaces:**
- Consumes: (none)
- Produces:
  - `extractRoutes(app): Array<{ method: string, path: string }>` — เดิน `app._router.stack` (recursive), รวม mount prefix + sub path, กรองเฉพาะ path ที่ขึ้นต้น `/api/`, dedupe, sort ตาม path แล้ว method
  - `extractMountPath(layer): string` — แปลง `layer.regexp` เป็น mount path เช่น `/api/samples`
  - `joinPaths(a, b): string` — ต่อ path สองท่อนแบบ normalize slash

- [ ] **Step 1: Write the failing test**

สร้าง `server/lib/listRoutes.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { extractRoutes, extractMountPath, joinPaths } = require('./listRoutes');

// mock app: top-level health route + /api/samples router mounted twice (/api + /LIS/api)
function makeApp() {
  const samplesStack = [
    { route: { path: '/', methods: { get: true } } },
    { route: { path: '/:id', methods: { get: true, post: true } } },
  ];
  return {
    _router: {
      stack: [
        { route: { path: '/api/health', methods: { get: true } } },
        {
          name: 'router',
          regexp: { source: '^\\/api\\/samples\\/?(?=\\/|$)' },
          handle: { stack: samplesStack },
        },
        // duplicate /LIS mount — must be dropped
        {
          name: 'router',
          regexp: { source: '^\\/LIS\\/api\\/samples\\/?(?=\\/|$)' },
          handle: { stack: samplesStack },
        },
        // static/middleware layer with no route — must be ignored
        { name: 'serveStatic', regexp: { source: '^\\/uploads\\/?(?=\\/|$)' } },
      ],
    },
  };
}

test('extractMountPath: parses Express 4 mount regexp', () => {
  assert.equal(extractMountPath({ regexp: { source: '^\\/api\\/samples\\/?(?=\\/|$)' } }), '/api/samples');
  assert.equal(extractMountPath({ regexp: { fast_slash: true } }), '');
  assert.equal(extractMountPath({}), '');
});

test('joinPaths: normalizes slashes and root', () => {
  assert.equal(joinPaths('/api/samples', '/'), '/api/samples');
  assert.equal(joinPaths('/api/samples', '/:id'), '/api/samples/:id');
  assert.equal(joinPaths('', '/api/health'), '/api/health');
});

test('extractRoutes: collects, drops /LIS duplicates, dedupes, sorts', () => {
  const routes = extractRoutes(makeApp());
  assert.deepEqual(routes, [
    { method: 'GET', path: '/api/health' },
    { method: 'GET', path: '/api/samples' },
    { method: 'GET', path: '/api/samples/:id' },
    { method: 'POST', path: '/api/samples/:id' },
  ]);
});

test('extractRoutes: empty when no router', () => {
  assert.deepEqual(extractRoutes({}), []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test server/lib/listRoutes.test.js`
Expected: FAIL — `Cannot find module './listRoutes'`

- [ ] **Step 3: Write minimal implementation**

สร้าง `server/lib/listRoutes.js`:

```js
// Introspect a mounted Express 4 app and list its API endpoints.
// Used by GET /api/_routes for the admin "API" settings tab.

function extractMountPath(layer) {
  const re = layer && layer.regexp;
  if (!re) return '';
  if (re.fast_slash) return '';
  const source = re.source || '';
  return source
    .replace(/^\^/, '')
    .replace(/\\\/\?\(\?=\\\/\|\$\)$/, '') // trailing /?(?=\/|$)
    .replace(/\$$/, '')
    .replace(/\\\//g, '/');
}

function joinPaths(a, b) {
  const left = (a || '').replace(/\/$/, '');
  const right = b || '';
  if (!right || right === '/') return left || '/';
  return left + (right.startsWith('/') ? right : '/' + right);
}

function methodsOf(route) {
  return Object.keys(route.methods || {})
    .filter((m) => route.methods[m] && m !== '_all')
    .map((m) => m.toUpperCase());
}

function collect(stack, prefix, out) {
  for (const layer of stack || []) {
    if (layer.route) {
      const full = joinPaths(prefix, layer.route.path);
      for (const method of methodsOf(layer.route)) {
        out.push({ method, path: full });
      }
    } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
      collect(layer.handle.stack, joinPaths(prefix, extractMountPath(layer)), out);
    }
  }
}

function extractRoutes(app) {
  const stack = app && app._router && app._router.stack;
  if (!stack) return [];
  const out = [];
  collect(stack, '', out);
  const seen = new Set();
  const deduped = [];
  for (const r of out) {
    if (!r.path.startsWith('/api/')) continue; // drop /LIS/api duplicates + static/SPA
    const key = `${r.method} ${r.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(r);
  }
  deduped.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
  return deduped;
}

module.exports = { extractRoutes, extractMountPath, joinPaths };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test server/lib/listRoutes.test.js`
Expected: PASS — 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add server/lib/listRoutes.js server/lib/listRoutes.test.js
git commit -m "feat(api): extractRoutes introspection helper for endpoint list" -- server/lib/listRoutes.js server/lib/listRoutes.test.js
```

---

### Task 2: Expose `GET /api/_routes` endpoint

**Files:**
- Modify: `server/index.js` (after the `/api/health` handlers, before the `dist` static/SPA block ~line 62-64)

**Interfaces:**
- Consumes: `extractRoutes(app)` from Task 1
- Produces: `GET /api/_routes` และ `GET /LIS/api/_routes` → `{ data: Array<{ method, path }> }`

- [ ] **Step 1: Add the endpoint**

ใน `server/index.js` แทรกหลังบรรทัด health (`app.get('/LIS/api/health', ...)`) และ **ก่อน** `// Serve React build if dist folder exists`:

```js
// Admin "API" settings tab: list all mounted API endpoints (read-only introspection).
// Must register before the SPA fallback so /LIS/api/_routes isn't swallowed by /LIS/*.
const { extractRoutes } = require('./lib/listRoutes');
const listRoutesHandler = (req, res) => res.json({ data: extractRoutes(app) });
app.get('/api/_routes', listRoutesHandler);
app.get('/LIS/api/_routes', listRoutesHandler);
```

- [ ] **Step 2: Verify it returns routes**

เปิด backend (`cd server && npm run dev`) แล้วรัน:

Run: `curl -s http://localhost:3001/api/_routes`
Expected: JSON `{"data":[{"method":"GET","path":"/api/_routes"},...]}` — มีหลาย entry รวม `/api/samples`, `/api/petitions` ฯลฯ และ **ไม่มี** path ที่ขึ้นต้น `/LIS/`

- [ ] **Step 3: Commit**

```bash
git add server/index.js
git commit -m "feat(api): expose GET /api/_routes endpoint list" -- server/index.js
```

---

### Task 3: `api.getApiRoutes()` client method

**Files:**
- Modify: `src/lib/api.ts` (add type near other exported types; add method inside the `api` object alongside e.g. `getDocumentNumberConfigs`)

**Interfaces:**
- Consumes: `GET /_routes` from Task 2
- Produces:
  - `export type ApiRouteInfo = { method: string; path: string }`
  - `api.getApiRoutes(): Promise<ApiRouteInfo[]>`

- [ ] **Step 1: Add the type**

ใน `src/lib/api.ts` เพิ่มใกล้ๆ top (หลัง import block หรือก่อน `export const api`):

```ts
export type ApiRouteInfo = { method: string; path: string };
```

- [ ] **Step 2: Add the method**

ในอ็อบเจกต์ `export const api = { ... }` เพิ่ม (วางใกล้ `getDocumentNumberConfigs`):

```ts
  getApiRoutes: () =>
    request<{ data: ApiRouteInfo[] }>("/_routes").then((r) => r.data),
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่จาก `src/lib/api.ts` (repo มี latent error เดิม ~12 ตัว — ต้องไม่เพิ่มจากไฟล์นี้)

- [ ] **Step 4: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat(api): add api.getApiRoutes client method" -- src/lib/api.ts
```

---

### Task 4: `ApiRoutesCard` component

**Files:**
- Create: `src/components/lis/ApiRoutesCard.tsx`

**Interfaces:**
- Consumes: `api.getApiRoutes`, `ApiRouteInfo` from Task 3
- Produces: `export default function ApiRoutesCard()` — ตารางรายการ endpoint + ช่องค้นหา + นับจำนวน, group ตาม segment แรกหลัง `/api/`

- [ ] **Step 1: Create the component**

สร้าง `src/components/lis/ApiRoutesCard.tsx`:

```tsx
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type ApiRouteInfo } from "@/lib/api";

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-100 text-emerald-700",
  POST: "bg-blue-100 text-blue-700",
  PUT: "bg-amber-100 text-amber-700",
  PATCH: "bg-amber-100 text-amber-700",
  DELETE: "bg-red-100 text-red-700",
};

export default function ApiRoutesCard() {
  const { data: routes = [], isLoading, isError } = useQuery({
    queryKey: ["api-routes"],
    queryFn: api.getApiRoutes,
  });
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return routes;
    return routes.filter(
      (r) => r.path.toLowerCase().includes(q) || r.method.toLowerCase().includes(q),
    );
  }, [routes, filter]);

  const groups = useMemo(() => {
    const map = new Map<string, ApiRouteInfo[]>();
    for (const r of filtered) {
      const seg = r.path.replace(/^\/api\//, "").split("/")[0] || "(root)";
      if (!map.has(seg)) map.set(seg, []);
      map.get(seg)!.push(r);
    }
    return Array.from(map.entries());
  }, [filtered]);

  if (isLoading) return <p className="text-sm text-muted-foreground">กำลังโหลด…</p>;
  if (isError) return <p className="text-sm text-red-600">โหลดรายการ API ไม่สำเร็จ</p>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        รายการ API endpoint ทั้งหมดของ backend (read-only) — สำหรับ admin
      </p>
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="ค้นหา path หรือ method…"
          className="w-full max-w-sm rounded-md border px-3 py-1.5 text-sm"
        />
        <span className="whitespace-nowrap text-sm text-muted-foreground">
          {filtered.length} / {routes.length} endpoint
        </span>
      </div>
      <div className="space-y-4">
        {groups.map(([seg, items]) => (
          <div key={seg}>
            <h3 className="mb-1 text-sm font-semibold text-foreground">{seg}</h3>
            <ul className="divide-y rounded-md border">
              {items.map((r) => (
                <li
                  key={`${r.method} ${r.path}`}
                  className="flex items-center gap-3 px-3 py-1.5"
                >
                  <span
                    className={`inline-block w-16 rounded px-2 py-0.5 text-center text-xs font-semibold ${
                      METHOD_COLORS[r.method] ?? "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {r.method}
                  </span>
                  <code className="text-sm">{r.path}</code>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {groups.length === 0 && (
          <p className="text-sm text-muted-foreground">ไม่พบ endpoint ที่ตรงกับการค้นหา</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่จาก `ApiRoutesCard.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/lis/ApiRoutesCard.tsx
git commit -m "feat(settings): ApiRoutesCard endpoint list view" -- src/components/lis/ApiRoutesCard.tsx
```

---

### Task 5: Admin-only "API" tab in SettingsPage

**Files:**
- Modify: `src/pages/SettingsPage.tsx`

**Interfaces:**
- Consumes: `ApiRoutesCard` (Task 4), `useAuth` (`@/hooks/useAuth`), `normalizeRoles` (`@/lib/roles`)
- Produces: แท็บ `value="api"` ที่ render เฉพาะเมื่อ `isAdmin` (แยกจาก `useAccessibleTabs` matrix — ไม่แตะ `TAB_KEYS`)

- [ ] **Step 1: Add imports**

ใน `src/pages/SettingsPage.tsx` เพิ่ม import:

```tsx
import ApiRoutesCard from "@/components/lis/ApiRoutesCard";
import { useAuth } from "@/hooks/useAuth";
import { normalizeRoles } from "@/lib/roles";
```

- [ ] **Step 2: Compute isAdmin**

ใน body ของ `SettingsPage` (หลัง `const queryClient = useQueryClient();`) เพิ่ม:

```tsx
  const { user } = useAuth();
  const isAdmin = normalizeRoles(user).includes("admin");
```

- [ ] **Step 3: Add the TabsTrigger**

ใน `<TabsList>` หลังบล็อก `{isVisible("dashboard") && (...)}` เพิ่ม:

```tsx
          {isAdmin && (
            <TabsTrigger value="api">API</TabsTrigger>
          )}
```

- [ ] **Step 4: Add the TabsContent**

หลัง `<TabsContent value="dashboard">...</TabsContent>` block (ก่อนปิด `</Tabs>`) เพิ่ม:

```tsx
        {isAdmin && (
          <TabsContent value="api" className="space-y-3">
            <ApiRoutesCard />
          </TabsContent>
        )}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่จาก `SettingsPage.tsx`

- [ ] **Step 6: Manual verify (dev)**

เปิด `npm run dev` + backend. ที่ `/settings`:
- ใช้ DevRoleSwitcher เป็น `admin` → เห็นแท็บ "API", คลิกแล้วเห็นรายการ endpoint + ค้นหาได้
- สลับเป็น role อื่น (เช่น QC) → แท็บ "API" หายไป

- [ ] **Step 7: Commit**

```bash
git add src/pages/SettingsPage.tsx
git commit -m "feat(settings): admin-only API endpoint list tab" -- src/pages/SettingsPage.tsx
```

---

## Self-Review Notes

- **Spec coverage:** backend introspect (Task 1) ✓, endpoint mount before SPA fallback (Task 2) ✓, client method (Task 3) ✓, card with filter/count/group (Task 4) ✓, admin-only tab outside matrix (Task 5) ✓, extractRoutes unit test (Task 1) ✓
- **YAGNI ตาม spec:** ไม่มีปุ่มยิงทดสอบ, ไม่มี route แยก, ไม่แตะ access matrix, ไม่มี auth middleware backend
- **Type consistency:** `ApiRouteInfo` / `getApiRoutes` / `extractRoutes` ใช้ชื่อตรงกันทุก task
