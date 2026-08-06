# Sidebar Favorites + Context Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** คลิกขวาที่เมนูใน sidebar แล้วได้ context menu 4 คำสั่ง (เพิ่ม/เอาออกจากรายการโปรด, เปิดในแท็บใหม่, คัดลอกลิงก์, ย้ายขึ้น/ลง) พร้อมกลุ่ม "รายการโปรด" ปักบนสุดของ sidebar ที่เก็บบน server ผูกกับ user

**Architecture:** Logic ล้วน ๆ อยู่ใน pure module สองฝั่ง (`src/lib/favorites.ts`, `server/lib/favorites.js`) ที่ unit test ได้โดยไม่ต้องมี React หรือ express — ฝั่ง server เป็น model + route แบบ upsert-only ผูกด้วย email, ฝั่ง client เป็น React Query hook ที่ทำ optimistic update แล้วให้ `AppSidebar` กับ `NavItemContextMenu` เป็นแค่ชั้น render

**Tech Stack:** React 18 + TypeScript + Vite + TanStack React Query + Radix (`@radix-ui/react-context-menu` ผ่าน shadcn) + sonner (toast) / Express 4 + Mongoose 8 / Vitest (frontend) + Jest (server)

## Global Constraints

- ค่าคงที่ที่ต้องตรงกันทั้งสองฝั่ง: **จำนวนรายการโปรดสูงสุด = 20**, **ความยาว path สูงสุด = 100 ตัวอักษร**
- Key ของข้อมูลคือ **email (lowercase, trim)** ไม่ใช่ user `_id` — dev mode ไม่มี User doc จริง
- Model ใหม่ **ห้ามใส่ `softDeletePlugin`** — เป็น upsert-only config เหมือน `DashboardLayoutConfig` (`server/models/DashboardLayoutConfig.js:27`)
- API path ทุกอันต้อง mount ผ่าน `mountApi()` เพื่อให้ได้ทั้ง `/api/*` และ `/LIS/api/*`
- **ห้ามรัน `npm run build`** — type-check ด้วย `npx tsc -p tsconfig.app.json --noEmit` เท่านั้น (`npx tsc --noEmit` เฉย ๆ เป็น no-op เพราะ root tsconfig มี `files: []`) repo มี type error ค้างอยู่ก่อนแล้วราว 12 จุด ให้เช็คเฉพาะว่าไฟล์ที่แตะไม่เพิ่ม error ใหม่
- ข้อความ UI ทั้งหมดเป็นภาษาไทย
- Commit message เป็นภาษาไทยตามแบบ repo และปิดท้ายด้วย `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
- `git add` ต้องระบุ pathspec ของไฟล์ที่ตั้งใจ commit เท่านั้น (มี session อื่นแก้ไฟล์ในเครื่องเดียวกันได้)

## File Structure

| ไฟล์ | หน้าที่ |
|---|---|
| `server/lib/favorites.js` (ใหม่) | pure: `normalizeEmail`, `sanitizePaths`, ค่าคงที่ |
| `server/lib/favorites.test.js` (ใหม่) | Jest ครอบ pure lib ข้างบน |
| `server/models/UserFavorite.js` (ใหม่) | schema `{ email, paths[] }` |
| `server/routes/userFavorites.js` (ใหม่) | `GET /` + `PUT /` |
| `server/index.js` (แก้) | `mountApi('/user-favorites', ...)` |
| `src/lib/favorites.ts` (ใหม่) | pure: `toggleFavorite`, `moveFavorite`, `normalizeFavorites`, `MAX_FAVORITES` |
| `src/lib/favorites.test.ts` (ใหม่) | Vitest ครอบ pure lib ข้างบน |
| `src/lib/api.ts` (แก้) | `getUserFavorites`, `saveUserFavorites` |
| `src/hooks/useFavorites.ts` (ใหม่) | React Query + optimistic update + toast |
| `src/hooks/__tests__/useFavorites.test.tsx` (ใหม่) | Vitest ครอบ hook (optimistic + rollback) |
| `src/components/lis/NavItemContextMenu.tsx` (ใหม่) | ครอบ nav link ด้วย Radix ContextMenu |
| `src/components/lis/__tests__/NavItemContextMenu.test.tsx` (ใหม่) | Vitest ครอบ component |
| `src/components/lis/AppSidebar.tsx` (แก้) | กลุ่มรายการโปรด + ต่อ context menu |
| `src/components/lis/__tests__/AppSidebar.test.tsx` (แก้) | เคสใหม่ + อัปเดต mock ของ `@/lib/api` |

---

### Task 1: Server pure lib (`sanitizePaths` / `normalizeEmail`)

**Files:**
- Create: `server/lib/favorites.js`
- Test: `server/lib/favorites.test.js`

**Interfaces:**
- Consumes: (ไม่มี)
- Produces: `module.exports = { MAX_FAVORITES: 20, MAX_PATH_LENGTH: 100, normalizeEmail(value): string, sanitizePaths(value): string[] }`

- [ ] **Step 1: เขียน test ที่ยังไม่ผ่าน**

สร้าง `server/lib/favorites.test.js`:

```js
const { MAX_FAVORITES, normalizeEmail, sanitizePaths } = require('./favorites');

describe('normalizeEmail', () => {
  it('ตัดช่องว่างและแปลงเป็นตัวพิมพ์เล็ก', () => {
    expect(normalizeEmail('  Admin@ICPLadda.com ')).toBe('admin@icpladda.com');
  });

  it('คืนสตริงว่างเมื่อไม่ใช่ string', () => {
    expect(normalizeEmail(undefined)).toBe('');
    expect(normalizeEmail(123)).toBe('');
    expect(normalizeEmail(null)).toBe('');
  });
});

describe('sanitizePaths', () => {
  it('คืน array ว่างเมื่อ input ไม่ใช่ array', () => {
    expect(sanitizePaths(undefined)).toEqual([]);
    expect(sanitizePaths('/petition')).toEqual([]);
    expect(sanitizePaths(null)).toEqual([]);
  });

  it('เก็บเฉพาะ string ที่ขึ้นต้นด้วย /', () => {
    expect(sanitizePaths(['/petition', 'petition', 42, null, '/stock'])).toEqual([
      '/petition',
      '/stock',
    ]);
  });

  it('ตัดช่องว่างหัวท้ายก่อนตรวจ', () => {
    expect(sanitizePaths(['  /petition  '])).toEqual(['/petition']);
  });

  it('ทิ้ง path ที่ยาวเกิน 100 ตัวอักษร', () => {
    const long = `/${'a'.repeat(100)}`;
    expect(sanitizePaths([long, '/stock'])).toEqual(['/stock']);
  });

  it('ตัดรายการซ้ำโดยคงลำดับแรกที่เจอ', () => {
    expect(sanitizePaths(['/stock', '/petition', '/stock'])).toEqual(['/stock', '/petition']);
  });

  it('ตัดเหลือ 20 รายการแรก', () => {
    const input = Array.from({ length: 25 }, (_, i) => `/page-${i}`);
    const result = sanitizePaths(input);
    expect(result).toHaveLength(MAX_FAVORITES);
    expect(result[0]).toBe('/page-0');
    expect(result[MAX_FAVORITES - 1]).toBe(`/page-${MAX_FAVORITES - 1}`);
  });
});
```

- [ ] **Step 2: รัน test ให้เห็นว่าไม่ผ่าน**

Run: `cd server && npx jest lib/favorites.test.js`
Expected: FAIL — `Cannot find module './favorites'`

- [ ] **Step 3: เขียน implementation**

สร้าง `server/lib/favorites.js`:

```js
// รายการโปรดของ sidebar (ผูกกับ user ด้วย email) — pure helpers ใช้ร่วมกับ routes/userFavorites.js
// mirror ของ src/lib/favorites.ts ฝั่ง frontend — MAX_FAVORITES ต้องตรงกัน

const MAX_FAVORITES = 20;
const MAX_PATH_LENGTH = 100;

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

// รับ array ดิบจาก client แล้วคืนเฉพาะ path ที่ใช้ได้ — ไม่ตรวจว่ามีอยู่จริงใน NAV_ITEMS
// เพราะ server ไม่รู้จัก nav catalog ของ frontend (client กรองอีกชั้นตอน render)
function sanitizePaths(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of value) {
    if (typeof raw !== 'string') continue;
    const path = raw.trim();
    if (!path.startsWith('/') || path.length > MAX_PATH_LENGTH) continue;
    if (seen.has(path)) continue;
    seen.add(path);
    out.push(path);
    if (out.length >= MAX_FAVORITES) break;
  }
  return out;
}

module.exports = { MAX_FAVORITES, MAX_PATH_LENGTH, normalizeEmail, sanitizePaths };
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `cd server && npx jest lib/favorites.test.js`
Expected: PASS ทั้ง 8 เคส

- [ ] **Step 5: Commit**

```bash
git add server/lib/favorites.js server/lib/favorites.test.js
git commit -m "feat(favorites): pure helper ตรวจ/ล้าง path รายการโปรดฝั่ง server

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Model + route + mount

**Files:**
- Create: `server/models/UserFavorite.js`
- Create: `server/routes/userFavorites.js`
- Modify: `server/index.js` (บล็อก `mountApi(...)` ราวบรรทัด 66)

**Interfaces:**
- Consumes: `require('../lib/favorites')` → `{ normalizeEmail, sanitizePaths }` จาก Task 1
- Produces: HTTP API สองเส้น
  - `GET /api/user-favorites?email=<email>` → `200 { data: { email: string, paths: string[] } }`
  - `PUT /api/user-favorites` body `{ email: string, paths: string[] }` → `200 { data: { email, paths } }`
  - ทั้งคู่ตอบ `400 { error: 'email จำเป็น' }` เมื่อ email ว่าง

- [ ] **Step 1: สร้าง model**

สร้าง `server/models/UserFavorite.js`:

```js
const mongoose = require('mongoose');

// รายการโปรดบน sidebar ของผู้ใช้แต่ละคน
// key ด้วย email ไม่ใช่ user _id เพราะ dev mode (src/config/dev.ts synthesizeDevUser)
// ใช้ id สังเคราะห์ที่ไม่มี User doc รองรับ แต่มี email เสมอทั้ง dev/prod
const UserFavoriteSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    paths: { type: [String], default: [] },
  },
  { timestamps: true },
);

// Upsert-only config (เหมือน DashboardLayoutConfig / EnvRoomConfig) — ไม่มี route ลบ doc
// จึงไม่ใส่ softDeletePlugin การเอาออกจากรายการโปรดคือการเขียน paths ใหม่
UserFavoriteSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model('UserFavorite', UserFavoriteSchema);
```

- [ ] **Step 2: สร้าง route**

สร้าง `server/routes/userFavorites.js`:

```js
const express = require('express');
const router = express.Router();
const UserFavorite = require('../models/UserFavorite');
const { normalizeEmail, sanitizePaths } = require('../lib/favorites');

// GET /api/user-favorites?email=... — path รายการโปรดตามลำดับที่ผู้ใช้จัดไว้
router.get('/', async (req, res) => {
  try {
    const email = normalizeEmail(req.query.email);
    if (!email) return res.status(400).json({ error: 'email จำเป็น' });
    const doc = await UserFavorite.findOne({ email }).lean();
    res.json({ data: { email, paths: doc ? sanitizePaths(doc.paths) : [] } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/user-favorites — เขียนทั้ง array ทับของเดิม (client เป็นเจ้าของลำดับ)
router.put('/', async (req, res) => {
  try {
    const body = req.body || {};
    const email = normalizeEmail(body.email);
    if (!email) return res.status(400).json({ error: 'email จำเป็น' });
    const paths = sanitizePaths(body.paths);
    const doc = await UserFavorite.findOneAndUpdate(
      { email },
      { email, paths },
      { new: true, upsert: true },
    ).lean();
    res.json({ data: { email: doc.email, paths: doc.paths || [] } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 3: mount route**

ใน `server/index.js` เพิ่มบรรทัดถัดจาก `mountApi('/dashboard-layout', require('./routes/dashboardLayout'));`:

```js
mountApi('/user-favorites', require('./routes/userFavorites')); // รายการโปรดบน sidebar ต่อ user
```

- [ ] **Step 4: ตรวจว่า server บูตขึ้นและ route ตอบจริง**

เปิด backend ในอีก terminal: `cd server && npm run dev`

จากนั้นยิงจริง (PowerShell):

```powershell
Invoke-RestMethod -Uri "http://localhost:3001/api/user-favorites?email=smoke@icpladda.com"
Invoke-RestMethod -Uri "http://localhost:3001/api/user-favorites" -Method Put -ContentType "application/json" -Body '{"email":"smoke@icpladda.com","paths":["/petition","bad","/stock","/petition"]}'
Invoke-RestMethod -Uri "http://localhost:3001/LIS/api/user-favorites?email=smoke@icpladda.com"
```

Expected:
1. เส้นแรก → `paths` เป็น array ว่าง
2. เส้นสอง → `paths` = `/petition`, `/stock` (ทิ้ง `bad` และตัวซ้ำ)
3. เส้นสาม → ค่าเดิมกลับมา (ยืนยันว่า mount ทั้ง `/api` และ `/LIS/api`)

ลบ doc ทดสอบทิ้งหลังตรวจเสร็จ:

```powershell
Invoke-RestMethod -Uri "http://localhost:3001/api/user-favorites" -Method Put -ContentType "application/json" -Body '{"email":"smoke@icpladda.com","paths":[]}'
```

- [ ] **Step 5: Commit**

```bash
git add server/models/UserFavorite.js server/routes/userFavorites.js server/index.js
git commit -m "feat(favorites): model + API /user-favorites เก็บรายการโปรดต่อ user

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Frontend pure lib

**Files:**
- Create: `src/lib/favorites.ts`
- Test: `src/lib/favorites.test.ts`

**Interfaces:**
- Consumes: (ไม่มี)
- Produces:
  - `export const MAX_FAVORITES = 20`
  - `export type FavoriteMoveDirection = "up" | "down"`
  - `export function toggleFavorite(paths: string[], path: string): string[]`
  - `export function moveFavorite(paths: string[], path: string, direction: FavoriteMoveDirection): string[]` — คืน array **ตัวเดิม (identity เดิม)** เมื่อขยับไม่ได้
  - `export function normalizeFavorites(paths: string[] | undefined, knownPaths: string[]): string[]`

- [ ] **Step 1: เขียน test ที่ยังไม่ผ่าน**

สร้าง `src/lib/favorites.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MAX_FAVORITES, moveFavorite, normalizeFavorites, toggleFavorite } from "./favorites";

describe("toggleFavorite", () => {
  it("ต่อท้ายเมื่อยังไม่มี", () => {
    expect(toggleFavorite(["/stock"], "/petition")).toEqual(["/stock", "/petition"]);
  });

  it("เอาออกเมื่อมีอยู่แล้ว", () => {
    expect(toggleFavorite(["/stock", "/petition"], "/stock")).toEqual(["/petition"]);
  });

  it("ไม่แก้ array เดิม", () => {
    const original = ["/stock"];
    toggleFavorite(original, "/petition");
    expect(original).toEqual(["/stock"]);
  });
});

describe("moveFavorite", () => {
  it("ย้ายขึ้นสลับกับตัวก่อนหน้า", () => {
    expect(moveFavorite(["/a", "/b", "/c"], "/b", "up")).toEqual(["/b", "/a", "/c"]);
  });

  it("ย้ายลงสลับกับตัวถัดไป", () => {
    expect(moveFavorite(["/a", "/b", "/c"], "/b", "down")).toEqual(["/a", "/c", "/b"]);
  });

  it("คืน array ตัวเดิมเมื่ออยู่หัวแถวแล้วสั่งขึ้น", () => {
    const paths = ["/a", "/b"];
    expect(moveFavorite(paths, "/a", "up")).toBe(paths);
  });

  it("คืน array ตัวเดิมเมื่ออยู่ท้ายแถวแล้วสั่งลง", () => {
    const paths = ["/a", "/b"];
    expect(moveFavorite(paths, "/b", "down")).toBe(paths);
  });

  it("คืน array ตัวเดิมเมื่อหา path ไม่เจอ", () => {
    const paths = ["/a", "/b"];
    expect(moveFavorite(paths, "/zzz", "up")).toBe(paths);
  });
});

describe("normalizeFavorites", () => {
  const known = ["/petition", "/stock", "/qc-testing"];

  it("คงลำดับที่เก็บไว้ ไม่ใช่ลำดับของ knownPaths", () => {
    expect(normalizeFavorites(["/stock", "/petition"], known)).toEqual(["/stock", "/petition"]);
  });

  it("ทิ้ง path ที่ไม่รู้จัก", () => {
    expect(normalizeFavorites(["/stock", "/ไม่มีแล้ว"], known)).toEqual(["/stock"]);
  });

  it("ตัดตัวซ้ำ", () => {
    expect(normalizeFavorites(["/stock", "/stock"], known)).toEqual(["/stock"]);
  });

  it("คืน array ว่างเมื่อ input เป็น undefined", () => {
    expect(normalizeFavorites(undefined, known)).toEqual([]);
  });

  it("ตัดเหลือไม่เกิน MAX_FAVORITES", () => {
    const many = Array.from({ length: 25 }, (_, i) => `/page-${i}`);
    expect(normalizeFavorites(many, many)).toHaveLength(MAX_FAVORITES);
  });
});
```

- [ ] **Step 2: รัน test ให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run src/lib/favorites.test.ts`
Expected: FAIL — resolve โมดูล `./favorites` ไม่ได้

- [ ] **Step 3: เขียน implementation**

สร้าง `src/lib/favorites.ts`:

```ts
// รายการโปรดบน sidebar — pure helper ล้วน ไม่มี React/network
// mirror ของ server/lib/favorites.js — MAX_FAVORITES ต้องตรงกันสองฝั่ง

export const MAX_FAVORITES = 20;

export type FavoriteMoveDirection = "up" | "down";

/** มีอยู่แล้ว → เอาออก, ยังไม่มี → ต่อท้าย (ตัวใหม่สุดอยู่ล่างสุด) */
export function toggleFavorite(paths: string[], path: string): string[] {
  return paths.includes(path) ? paths.filter((p) => p !== path) : [...paths, path];
}

/**
 * สลับตำแหน่งกับเพื่อนบ้าน คืน array ตัวเดิม (identity เดิม) เมื่อขยับไม่ได้
 * ผู้เรียกใช้เช็คด้วย `next !== paths` เพื่อข้ามการยิง API ที่ไม่จำเป็นได้
 */
export function moveFavorite(
  paths: string[],
  path: string,
  direction: FavoriteMoveDirection,
): string[] {
  const index = paths.indexOf(path);
  if (index < 0) return paths;
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= paths.length) return paths;
  const next = [...paths];
  next[index] = paths[target];
  next[target] = paths[index];
  return next;
}

/** ตัดตัวซ้ำ + ทิ้ง path ที่ไม่มีใน nav catalog แล้ว + cap ที่ MAX_FAVORITES */
export function normalizeFavorites(
  paths: string[] | undefined,
  knownPaths: string[],
): string[] {
  const known = new Set(knownPaths);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const path of paths ?? []) {
    if (!known.has(path) || seen.has(path)) continue;
    seen.add(path);
    out.push(path);
    if (out.length >= MAX_FAVORITES) break;
  }
  return out;
}
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `npx vitest run src/lib/favorites.test.ts`
Expected: PASS ทั้ง 13 เคส

- [ ] **Step 5: Commit**

```bash
git add src/lib/favorites.ts src/lib/favorites.test.ts
git commit -m "feat(favorites): pure helper toggle/move/normalize ฝั่ง frontend

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: API client + `useFavorites` hook

**Files:**
- Modify: `src/lib/api.ts` (เพิ่มถัดจากบล็อก `getDashboardLayouts` / `updateDashboardLayout` ราวบรรทัด 573-580)
- Create: `src/hooks/useFavorites.ts`
- Test: `src/hooks/__tests__/useFavorites.test.tsx`

**Interfaces:**
- Consumes: `toggleFavorite`, `moveFavorite`, `MAX_FAVORITES`, `FavoriteMoveDirection` จาก Task 3; API จาก Task 2
- Produces:
  - `api.getUserFavorites(email: string): Promise<UserFavorites>` และ `api.saveUserFavorites(email: string, paths: string[]): Promise<UserFavorites>` โดย `type UserFavorites = { email: string; paths: string[] }`
  - `useFavorites(): { favorites: string[]; isFavorite(path: string): boolean; toggle(path: string): void; move(path: string, direction: FavoriteMoveDirection): void }`

- [ ] **Step 1: เขียน test ที่ยังไม่ผ่าน**

สร้าง `src/hooks/__tests__/useFavorites.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFavorites } from "../useFavorites";

const getUserFavorites = vi.fn();
const saveUserFavorites = vi.fn();

vi.mock("@/lib/api", () => ({
  api: {
    getUserFavorites: (...args: unknown[]) => getUserFavorites(...args),
    saveUserFavorites: (...args: unknown[]) => saveUserFavorites(...args),
  },
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { email: "Admin@ICPLadda.com" } }),
}));

const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (...args: unknown[]) => toastError(...args) } }));

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useFavorites", () => {
  beforeEach(() => {
    getUserFavorites.mockResolvedValue({ email: "admin@icpladda.com", paths: ["/stock"] });
    saveUserFavorites.mockResolvedValue({ email: "admin@icpladda.com", paths: [] });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("โหลดรายการโปรดด้วย email ตัวพิมพ์เล็ก", async () => {
    const { result } = renderHook(() => useFavorites(), { wrapper });
    await waitFor(() => expect(result.current.favorites).toEqual(["/stock"]));
    expect(getUserFavorites).toHaveBeenCalledWith("admin@icpladda.com");
  });

  it("toggle อัปเดตทันทีแบบ optimistic แล้วยิง PUT", async () => {
    const { result } = renderHook(() => useFavorites(), { wrapper });
    await waitFor(() => expect(result.current.favorites).toEqual(["/stock"]));

    act(() => result.current.toggle("/petition"));

    await waitFor(() => expect(result.current.favorites).toEqual(["/stock", "/petition"]));
    expect(saveUserFavorites).toHaveBeenCalledWith("admin@icpladda.com", ["/stock", "/petition"]);
  });

  it("rollback กลับค่าเดิมเมื่อ PUT ล้มเหลว", async () => {
    saveUserFavorites.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useFavorites(), { wrapper });
    await waitFor(() => expect(result.current.favorites).toEqual(["/stock"]));

    act(() => result.current.toggle("/petition"));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    await waitFor(() => expect(result.current.favorites).toEqual(["/stock"]));
  });

  it("ไม่ยิง PUT เมื่อย้ายตัวที่อยู่หัวแถวขึ้นไปอีก", async () => {
    const { result } = renderHook(() => useFavorites(), { wrapper });
    await waitFor(() => expect(result.current.favorites).toEqual(["/stock"]));

    act(() => result.current.move("/stock", "up"));

    expect(saveUserFavorites).not.toHaveBeenCalled();
  });

  it("เตือนและไม่ยิง PUT เมื่อเกิน 20 รายการ", async () => {
    const full = Array.from({ length: 20 }, (_, i) => `/page-${i}`);
    getUserFavorites.mockResolvedValue({ email: "admin@icpladda.com", paths: full });
    const { result } = renderHook(() => useFavorites(), { wrapper });
    await waitFor(() => expect(result.current.favorites).toHaveLength(20));

    act(() => result.current.toggle("/petition"));

    expect(toastError).toHaveBeenCalled();
    expect(saveUserFavorites).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: รัน test ให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run src/hooks/__tests__/useFavorites.test.tsx`
Expected: FAIL — resolve `../useFavorites` ไม่ได้

- [ ] **Step 3: เพิ่มฟังก์ชันใน `src/lib/api.ts`**

เพิ่ม type ใกล้ ๆ type อื่นด้านบนไฟล์ (หลัง `export interface PetitionFlowNotification { ... }` ราวบรรทัด 51):

```ts
export type UserFavorites = { email: string; paths: string[] };
```

แล้วเพิ่มสองเมธอดในอ็อบเจ็กต์ `api` ถัดจากบล็อก `updateDashboardLayout`:

```ts
  // ── รายการโปรดบน sidebar (ผูกกับ user ด้วย email) ──
  getUserFavorites: (email: string) =>
    request<{ data: UserFavorites }>(
      `/user-favorites?email=${encodeURIComponent(email)}`,
    ).then((r) => r.data),
  saveUserFavorites: (email: string, paths: string[]) =>
    request<{ data: UserFavorites }>("/user-favorites", {
      method: "PUT",
      body: JSON.stringify({ email, paths }),
    }).then((r) => r.data),
```

- [ ] **Step 4: เขียน hook**

สร้าง `src/hooks/useFavorites.ts`:

```ts
import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, type UserFavorites } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  MAX_FAVORITES,
  moveFavorite,
  toggleFavorite,
  type FavoriteMoveDirection,
} from "@/lib/favorites";

// อ้างอิงตัวเดียวกันเสมอ เพื่อไม่ให้ useMemo ของผู้เรียกคำนวณใหม่ทุก render
const EMPTY_PATHS: string[] = [];

export function useFavorites() {
  const { user } = useAuth();
  const email = (user?.email ?? "").trim().toLowerCase();
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["user-favorites", email], [email]);

  const { data } = useQuery({
    queryKey,
    queryFn: () => api.getUserFavorites(email),
    enabled: !!email,
    staleTime: 5 * 60 * 1000,
  });

  const favorites = data?.paths ?? EMPTY_PATHS;

  const mutation = useMutation({
    mutationFn: (paths: string[]) => api.saveUserFavorites(email, paths),
    onMutate: async (paths: string[]) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<UserFavorites>(queryKey);
      queryClient.setQueryData<UserFavorites>(queryKey, { email, paths });
      return { previous };
    },
    onError: (_err, _paths, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      toast.error("บันทึกรายการโปรดไม่สำเร็จ");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const isFavorite = useCallback((path: string) => favorites.includes(path), [favorites]);

  const toggle = useCallback(
    (path: string) => {
      if (!email) return;
      if (!favorites.includes(path) && favorites.length >= MAX_FAVORITES) {
        toast.error(`รายการโปรดเก็บได้สูงสุด ${MAX_FAVORITES} รายการ`);
        return;
      }
      mutation.mutate(toggleFavorite(favorites, path));
    },
    [email, favorites, mutation],
  );

  const move = useCallback(
    (path: string, direction: FavoriteMoveDirection) => {
      if (!email) return;
      const next = moveFavorite(favorites, path, direction);
      // moveFavorite คืน array ตัวเดิมเมื่อขยับไม่ได้ — ไม่ต้องยิง API
      if (next === favorites) return;
      mutation.mutate(next);
    },
    [email, favorites, mutation],
  );

  return { favorites, isFavorite, toggle, move };
}
```

- [ ] **Step 5: รัน test ให้ผ่าน**

Run: `npx vitest run src/hooks/__tests__/useFavorites.test.tsx`
Expected: PASS ทั้ง 5 เคส

- [ ] **Step 6: Commit**

```bash
git add src/lib/api.ts src/hooks/useFavorites.ts src/hooks/__tests__/useFavorites.test.tsx
git commit -m "feat(favorites): useFavorites hook + API client optimistic update

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `NavItemContextMenu` component

**Files:**
- Create: `src/components/lis/NavItemContextMenu.tsx`
- Test: `src/components/lis/__tests__/NavItemContextMenu.test.tsx`

**Interfaces:**
- Consumes: `FavoriteMoveDirection` จาก Task 3; `ContextMenu*` จาก `@/components/ui/context-menu`; `Tooltip*` จาก `@/components/ui/tooltip`
- Produces: `export default function NavItemContextMenu(props: NavItemContextMenuProps)` โดย

```ts
type NavItemContextMenuProps = {
  path: string;                       // path ของ nav item เช่น "/petition"
  isFavorite: boolean;
  inFavorites: boolean;               // true เมื่อ render อยู่ในกลุ่ม "รายการโปรด"
  canMoveUp: boolean;
  canMoveDown: boolean;
  tooltip?: string;                   // ใส่เมื่อ sidebar พับ (โหมด rail) — ไม่ใส่ = ไม่มี tooltip
  onToggleFavorite: () => void;
  onMove: (direction: FavoriteMoveDirection) => void;
  children: ReactNode;                // ต้องเป็น element เดียวที่รับ ref ได้ (เช่น <Link>)
};
```

**หมายเหตุการซ้อน trigger:** `TooltipTrigger` กับ `ContextMenuTrigger` ต้องซ้อน `asChild` ทั้งคู่ลงบน element เดียวกัน — `ContextMenu` และ `Tooltip` ตัว Root ไม่ render DOM จึงเป็น ancestor ได้ทั้งคู่ ห้ามเอา `<Tooltip>` ไปเป็น child ของ `ContextMenuTrigger asChild` (Root ไม่ใช่ DOM element → Slot พัง)

- [ ] **Step 1: เขียน test ที่ยังไม่ผ่าน**

สร้าง `src/components/lis/__tests__/NavItemContextMenu.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import NavItemContextMenu, { type NavItemContextMenuProps } from "../NavItemContextMenu";

// jsdom ไม่มี pointer-capture API ที่ Radix เรียกตอนเปิดเมนู
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

type Overrides = Partial<NavItemContextMenuProps>;

function renderMenu(overrides: Overrides = {}) {
  const onToggleFavorite = vi.fn();
  const onMove = vi.fn();
  const utils = render(
    <TooltipProvider>
      <NavItemContextMenu
        path="/petition"
        isFavorite={false}
        inFavorites={false}
        canMoveUp={false}
        canMoveDown={false}
        onToggleFavorite={onToggleFavorite}
        onMove={onMove}
        {...overrides}
      >
        <a href="/petition">รายการคำร้อง</a>
      </NavItemContextMenu>
    </TooltipProvider>,
  );
  return { ...utils, onToggleFavorite, onMove };
}

function openMenu() {
  fireEvent.contextMenu(screen.getByText("รายการคำร้อง"));
}

describe("NavItemContextMenu", () => {
  it("คลิกขวาแล้วเปิดเมนู เพิ่มในรายการโปรด + เปิดในแท็บใหม่ + คัดลอกลิงก์", async () => {
    renderMenu();
    openMenu();

    expect(await screen.findByText("เพิ่มในรายการโปรด")).toBeInTheDocument();
    expect(screen.getByText("เปิดในแท็บใหม่")).toBeInTheDocument();
    expect(screen.getByText("คัดลอกลิงก์")).toBeInTheDocument();
  });

  it("สลับเป็น เอาออกจากรายการโปรด เมื่อเป็นรายการโปรดอยู่แล้ว", async () => {
    renderMenu({ isFavorite: true });
    openMenu();

    expect(await screen.findByText("เอาออกจากรายการโปรด")).toBeInTheDocument();
    expect(screen.queryByText("เพิ่มในรายการโปรด")).not.toBeInTheDocument();
  });

  it("ไม่แสดงปุ่มย้ายเมื่ออยู่นอกกลุ่มรายการโปรด", async () => {
    renderMenu({ isFavorite: true });
    openMenu();

    await screen.findByText("เอาออกจากรายการโปรด");
    expect(screen.queryByText("ย้ายขึ้น")).not.toBeInTheDocument();
    expect(screen.queryByText("ย้ายลง")).not.toBeInTheDocument();
  });

  it("แสดงปุ่มย้ายเมื่ออยู่ในกลุ่มรายการโปรด และเรียก onMove", async () => {
    const { onMove } = renderMenu({ isFavorite: true, inFavorites: true, canMoveDown: true });
    openMenu();

    fireEvent.click(await screen.findByText("ย้ายลง"));
    expect(onMove).toHaveBeenCalledWith("down");
  });

  it("เรียก onToggleFavorite เมื่อกดเมนูรายการโปรด", async () => {
    const { onToggleFavorite } = renderMenu();
    openMenu();

    fireEvent.click(await screen.findByText("เพิ่มในรายการโปรด"));
    expect(onToggleFavorite).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: รัน test ให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run src/components/lis/__tests__/NavItemContextMenu.test.tsx`
Expected: FAIL — resolve `../NavItemContextMenu` ไม่ได้

- [ ] **Step 3: เขียน component**

สร้าง `src/components/lis/NavItemContextMenu.tsx`:

```tsx
import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ExternalLink, Link2, Star, StarOff } from "lucide-react";
import { toast } from "sonner";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { FavoriteMoveDirection } from "@/lib/favorites";

export type NavItemContextMenuProps = {
  path: string;
  isFavorite: boolean;
  /** true เมื่อ render อยู่ในกลุ่ม "รายการโปรด" — ปุ่มย้ายขึ้น/ลงโผล่เฉพาะตอนนี้ */
  inFavorites: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** ใส่เมื่อ sidebar พับเป็น rail — ไม่ใส่ = ไม่ครอบ tooltip */
  tooltip?: string;
  onToggleFavorite: () => void;
  onMove: (direction: FavoriteMoveDirection) => void;
  children: ReactNode;
};

// BASE_URL = "/" ตอน dev, "/LIS/" ตอน prod — ต่อกับ path ให้ได้ URL เต็มที่เปิด/คัดลอกได้จริง
function absoluteHref(path: string) {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "");
  return `${base}${path}`;
}

async function copyToClipboard(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // ตกไปใช้ fallback ข้างล่าง
  }
  // clipboard API ใช้ไม่ได้เมื่อไม่ใช่ secure context (เช่น http ภายในองค์กร)
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

const NavItemContextMenu = ({
  path,
  isFavorite,
  inFavorites,
  canMoveUp,
  canMoveDown,
  tooltip,
  onToggleFavorite,
  onMove,
  children,
}: NavItemContextMenuProps) => {
  const trigger = <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>;

  const handleOpenInNewTab = () => {
    window.open(absoluteHref(path), "_blank", "noopener,noreferrer");
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}${absoluteHref(path)}`;
    const ok = await copyToClipboard(url);
    if (ok) toast.success("คัดลอกลิงก์แล้ว");
    else toast.error("คัดลอกลิงก์ไม่สำเร็จ");
  };

  return (
    <ContextMenu>
      {tooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent side="right">{tooltip}</TooltipContent>
        </Tooltip>
      ) : (
        trigger
      )}
      <ContextMenuContent className="w-56">
        <ContextMenuItem onSelect={onToggleFavorite}>
          {isFavorite ? (
            <StarOff className="mr-2 h-4 w-4" />
          ) : (
            <Star className="mr-2 h-4 w-4" />
          )}
          {isFavorite ? "เอาออกจากรายการโปรด" : "เพิ่มในรายการโปรด"}
        </ContextMenuItem>
        <ContextMenuItem onSelect={handleOpenInNewTab}>
          <ExternalLink className="mr-2 h-4 w-4" />
          เปิดในแท็บใหม่
        </ContextMenuItem>
        <ContextMenuItem onSelect={handleCopyLink}>
          <Link2 className="mr-2 h-4 w-4" />
          คัดลอกลิงก์
        </ContextMenuItem>
        {inFavorites && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem disabled={!canMoveUp} onSelect={() => onMove("up")}>
              <ArrowUp className="mr-2 h-4 w-4" />
              ย้ายขึ้น
            </ContextMenuItem>
            <ContextMenuItem disabled={!canMoveDown} onSelect={() => onMove("down")}>
              <ArrowDown className="mr-2 h-4 w-4" />
              ย้ายลง
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
};

export default NavItemContextMenu;
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `npx vitest run src/components/lis/__tests__/NavItemContextMenu.test.tsx`
Expected: PASS ทั้ง 5 เคส

- [ ] **Step 5: Commit**

```bash
git add src/components/lis/NavItemContextMenu.tsx src/components/lis/__tests__/NavItemContextMenu.test.tsx
git commit -m "feat(favorites): NavItemContextMenu คลิกขวาที่เมนู sidebar

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: ต่อเข้า `AppSidebar` + กลุ่มรายการโปรด

**Files:**
- Modify: `src/components/lis/AppSidebar.tsx` (import ด้านบน, ต่อจาก `sections` ราวบรรทัด 174-214, การ render item ราวบรรทัด 342-385, เงื่อนไข "ไม่พบเมนู" ราวบรรทัด 390-403)
- Modify: `src/components/lis/__tests__/AppSidebar.test.tsx`

**Interfaces:**
- Consumes: `useFavorites()` จาก Task 4, `normalizeFavorites` จาก Task 3, `NavItemContextMenu` จาก Task 5
- Produces: (ไม่มี export ใหม่)

- [ ] **Step 1: เขียน test ที่ยังไม่ผ่าน**

แก้ `src/components/lis/__tests__/AppSidebar.test.tsx` — เปลี่ยน mock ของ `@/lib/api` (บรรทัด 19-31) ให้มีเมธอดรายการโปรดครบ และให้ทดสอบสลับค่าได้:

```tsx
const getUserFavorites = vi.fn();

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn().mockResolvedValue({
      data: {
        data: {
          roles: [{ id: "admin", name: "Admin" }],
          groups: [],
          permissions: {},
        },
      },
    }),
    getUserFavorites: (...args: unknown[]) => getUserFavorites(...args),
    saveUserFavorites: vi.fn().mockResolvedValue({ email: "admin@example.com", paths: [] }),
  },
}));
```

ใน `beforeEach` เพิ่มค่าเริ่มต้น (ไม่มีรายการโปรด):

```tsx
    getUserFavorites.mockResolvedValue({ email: "admin@example.com", paths: [] });
```

แล้วเพิ่ม 3 เคสท้าย `describe("AppSidebar", ...)`:

```tsx
  it("ไม่แสดงกลุ่มรายการโปรดเมื่อยังไม่มีรายการโปรด", async () => {
    renderSidebar();

    await screen.findByPlaceholderText("ค้นหาเมนู...");
    expect(screen.queryByText("รายการโปรด")).not.toBeInTheDocument();
  });

  it("แสดงกลุ่มรายการโปรดบนสุดตามลำดับที่เก็บไว้", async () => {
    getUserFavorites.mockResolvedValue({
      email: "admin@example.com",
      paths: ["/stock", "/petition"],
    });
    const { container } = renderSidebar();

    await screen.findByText("รายการโปรด");

    const nav = getSidebarNav(container);
    const headings = Array.from(nav.querySelectorAll("button > span.truncate")).map(
      (el) => el.textContent,
    );
    expect(headings[0]).toBe("รายการโปรด");

    const links = Array.from(nav.querySelectorAll("a")).map((el) => el.getAttribute("href"));
    expect(links.slice(0, 2)).toEqual(["/stock", "/petition"]);
  });

  it("ไม่แสดงรายการโปรดที่ชี้ path ซึ่งไม่มีใน NAV_ITEMS", async () => {
    getUserFavorites.mockResolvedValue({
      email: "admin@example.com",
      paths: ["/ไม่มีหน้านี้แล้ว"],
    });
    renderSidebar();

    await screen.findByPlaceholderText("ค้นหาเมนู...");
    expect(screen.queryByText("รายการโปรด")).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: รัน test ให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run src/components/lis/__tests__/AppSidebar.test.tsx`
Expected: FAIL — 2 เคสใหม่ที่คาดว่าจะเจอ "รายการโปรด" หาไม่เจอ

- [ ] **Step 3: เพิ่ม import และคำนวณกลุ่มรายการโปรดใน `AppSidebar.tsx`**

เพิ่ม import (ต่อจาก import ที่มีอยู่ด้านบนไฟล์):

```tsx
import { NAV_ITEMS, type NavItem } from "@/lib/navItems";
import { normalizeFavorites } from "@/lib/favorites";
import { useFavorites } from "@/hooks/useFavorites";
import NavItemContextMenu from "./NavItemContextMenu";
```

(บรรทัด `import { NAV_ITEMS } from "@/lib/navItems";` เดิมถูกแทนที่ด้วยบรรทัดแรกข้างบน)

เพิ่มค่าคงที่ใกล้ ๆ `EMPTY_GROUPS` ด้านบนไฟล์:

```tsx
const FAVORITES_SECTION_ID = "favorites";
const NAV_PATHS = NAV_ITEMS.map((item) => item.path);
```

ใน body ของ component เรียก hook (วางใกล้ ๆ `const roles = normalizeRoles(user);`):

```tsx
  const { favorites, isFavorite, toggle: toggleFavoritePath, move: moveFavoritePath } = useFavorites();
```

แล้วต่อท้าย `useMemo` ของ `sections` (หลังบรรทัด 214) เพิ่มสองบล็อกนี้:

```tsx
  // ลำดับยึดตาม favorites ที่เก็บไว้ ไม่ใช่ลำดับใน NAV_ITEMS
  const favoritePaths = useMemo(() => normalizeFavorites(favorites, NAV_PATHS), [favorites]);

  const allSections = useMemo(() => {
    if (favoritePaths.length === 0) return sections;
    const items = favoritePaths
      .map((path) => NAV_ITEMS.find((item) => item.path === path))
      .filter((item): item is NavItem => !!item);
    if (items.length === 0) return sections;
    return [{ id: FAVORITES_SECTION_ID, label: "รายการโปรด", items }, ...sections];
  }, [favoritePaths, sections]);
```

- [ ] **Step 4: เปลี่ยนการ render ให้ใช้ `allSections` และครอบ context menu**

เปลี่ยน `{sections.map((section, sIdx) => {` (บรรทัด 303) เป็น `{allSections.map((section, sIdx) => {`

เปลี่ยน `sections.every(` ในบล็อก "ไม่พบเมนู" (บรรทัด 393) เป็น `allSections.every(`

แล้วแทนที่ก้อน `visibleItems.map((item) => { ... })` ทั้งก้อน (บรรทัด 342-385) ด้วย:

```tsx
                {visibleItems.map((item) => {
                  const targetPath = item.path === "/" ? "/home" : item.path;
                  const isActive =
                    item.path === activePath ||
                    (item.path === "/" &&
                      (location.pathname === "/home" || location.pathname.startsWith("/dashboard/")));
                  const inFavorites = section.id === FAVORITES_SECTION_ID;
                  // ตำแหน่งอ้างจากรายการเต็มที่เก็บไว้ ไม่ใช่รายการที่ผ่านตัวกรอง —
                  // ไม่งั้นสิทธิ์/ช่องค้นหาจะทำให้ย้ายผิดตำแหน่ง
                  const favIndex = favoritePaths.indexOf(item.path);
                  const link = (
                    <Link
                      to={targetPath}
                      onClick={(e) => {
                        persistNavScroll();
                        // Let the browser handle modifier/middle clicks natively
                        // (open in new tab/window) — only run SPA side effects on
                        // a plain left click.
                        if (
                          e.button === 0 &&
                          !e.metaKey &&
                          !e.ctrlKey &&
                          !e.shiftKey &&
                          !e.altKey
                        ) {
                          onNavigate?.();
                        }
                      }}
                      className={cn(
                        "flex items-center w-full rounded-lg text-sm font-medium transition-colors no-underline",
                        collapsed ? "justify-center h-10 px-0" : "gap-3 px-3 py-2.5",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <item.icon className="w-5 h-5 shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                  return (
                    // path เดียวโผล่ได้สองที่ (กลุ่มโปรด + กลุ่มเดิม) — key ต้องผูก section ด้วย
                    <NavItemContextMenu
                      key={`${section.id}:${item.path}`}
                      path={item.path}
                      isFavorite={isFavorite(item.path)}
                      inFavorites={inFavorites}
                      canMoveUp={inFavorites && favIndex > 0}
                      canMoveDown={inFavorites && favIndex >= 0 && favIndex < favoritePaths.length - 1}
                      tooltip={collapsed ? item.label : undefined}
                      onToggleFavorite={() => toggleFavoritePath(item.path)}
                      onMove={(direction) => moveFavoritePath(item.path, direction)}
                    >
                      {link}
                    </NavItemContextMenu>
                  );
                })}
```

- [ ] **Step 5: รัน test ให้ผ่าน**

Run: `npx vitest run src/components/lis/__tests__/AppSidebar.test.tsx`
Expected: PASS ทั้ง 7 เคส (4 เคสเดิม + 3 เคสใหม่)

- [ ] **Step 6: ตรวจของจริงในเบราว์เซอร์**

เปิดทั้งสองโปรเซส (`npm run dev` ที่ root และ `cd server && npm run dev`) แล้วเช็คตามนี้:

1. คลิกขวาที่เมนูใด ๆ → เมนูโผล่ 3 คำสั่ง (ยังไม่มีย้ายขึ้น/ลง)
2. กด "เพิ่มในรายการโปรด" → กลุ่ม "รายการโปรด" โผล่บนสุดทันที และเมนูนั้นยังอยู่ในกลุ่มเดิมด้วย
3. เพิ่มอีกรายการ → คลิกขวาในกลุ่มรายการโปรด → มี "ย้ายขึ้น"/"ย้ายลง" และ disable ถูกต้องที่หัว/ท้าย
4. กด "เปิดในแท็บใหม่" → แท็บใหม่เปิดหน้าถูกต้อง
5. กด "คัดลอกลิงก์" → toast ขึ้น และวางแล้วได้ URL เต็ม
6. **ปิดเมนูด้วย Esc แล้วลองคลิกเมนู sidebar ต่อทันที** — ต้องกดได้ ถ้ากดไม่ได้แปลว่า Radix ค้าง `pointer-events: none` บน body ให้ตรวจว่า `RoutePointerLockGuard` ครอบถึงหรือยัง (ค้นด้วย `grep -rn "RoutePointerLockGuard" src`)
7. รีเฟรชหน้า → รายการโปรดยังอยู่ครบตามลำดับเดิม
8. พับ sidebar เป็น rail → กลุ่มรายการโปรดโชว์เฉพาะไอคอน คลิกขวายังใช้ได้ และ tooltip ยังขึ้น

- [ ] **Step 7: Commit**

```bash
git add src/components/lis/AppSidebar.tsx src/components/lis/__tests__/AppSidebar.test.tsx
git commit -m "feat(favorites): กลุ่มรายการโปรดบนสุด sidebar + ต่อ context menu

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: ตรวจรอบสุดท้ายทั้ง repo

**Files:** (ไม่แก้ไฟล์ นอกจากเจอ error)

- [ ] **Step 1: type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่ในไฟล์ที่แตะ (`src/lib/favorites.ts`, `src/hooks/useFavorites.ts`, `src/components/lis/NavItemContextMenu.tsx`, `src/components/lis/AppSidebar.tsx`, `src/lib/api.ts`) — repo มี error ค้างอยู่ก่อนหน้าราว 12 จุดในไฟล์อื่น ให้เทียบกับผลก่อนเริ่มงาน

- [ ] **Step 2: test ฝั่ง frontend ทั้งชุด**

Run: `npm run test`
Expected: PASS ทั้งหมด

- [ ] **Step 3: test ฝั่ง server ทั้งชุด**

Run: `cd server && npm test`
Expected: PASS ทั้งหมด

- [ ] **Step 4: lint**

Run: `npm run lint`
Expected: ไม่มี error ใหม่จากไฟล์ที่เพิ่ม/แก้

- [ ] **Step 5: Commit ถ้ามีอะไรต้องแก้**

ถ้า step 1-4 ผ่านหมดโดยไม่ต้องแก้อะไร ข้ามขั้นนี้ ถ้าต้องแก้:

```bash
git add <ไฟล์ที่แก้>
git commit -m "fix(favorites): แก้ตามผล type-check/lint

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
