# Dashboard Layout Config (Lab + QC) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin configure, per role, which sections and KPI cards the Lab and QC dashboards show and in what order, with a live wireframe preview; at runtime each user sees the layout for their role, falling back to a shared default.

**Architecture:** A shared section catalog (frontend `src/lib/dashboardLayout.ts` + backend `server/lib/dashboardLayout.js`) is the single source of truth for section ids, labels, and default layout. A new `DashboardLayoutConfig` collection stores per-`{dashboard, roleId}` overrides via a thin upsert route (mirrors `print.js`/`envRoomConfig.js`). The Lab/QC dashboard pages refactor their JSX into a `sectionId → renderNode` map and render enabled sections in configured order, resolved from the user's roles. The settings page gains a "แดชบอร์ด" tab with controls + a pure wireframe preview.

**Tech Stack:** React 18 + TypeScript + Vite + TanStack React Query + shadcn/ui (frontend, Vitest); Express 4 + Mongoose 8 (backend, `node:test`).

**Spec:** `docs/superpowers/specs/2026-06-10-dashboard-layout-config-design.md`

---

## File Structure

**Create:**
- `src/lib/dashboardLayout.ts` — catalog, types, default layout, resolution helpers (frontend SoT)
- `src/lib/dashboardLayout.test.ts` — Vitest for the above
- `server/lib/dashboardLayout.js` — validation + normalization + constants (backend SoT)
- `server/lib/dashboardLayout.test.js` — `node:test` for the above
- `server/models/DashboardLayoutConfig.js` — Mongoose model
- `server/routes/dashboardLayout.js` — GET list + PUT upsert
- `src/hooks/useDashboardLayout.ts` — runtime per-user layout resolution (dashboards)
- `src/hooks/useDashboardLayouts.ts` — list of configs for a dashboard (settings)
- `src/components/lis/DashboardLayoutPreview.tsx` — wireframe skeleton
- `src/components/lis/DashboardLayoutConfigCard.tsx` — settings editor (controls + preview)

**Modify:**
- `server/index.js` — mount the new route
- `src/lib/api.ts` — add `getDashboardLayouts` / `updateDashboardLayout`
- `src/pages/SettingsPage.tsx` — add "แดชบอร์ด" tab
- `src/pages/LabDashboard.tsx` — consume layout via section map
- `src/pages/QCDashboard.tsx` — consume layout via section map

**Design note (deviation from spec):** sibling config models (`EnvRoomConfig`, `PrintConfig`) do **not** use the soft-delete plugin because they are upsert-only config with no delete path. `DashboardLayoutConfig` follows the same pattern — plain compound unique index `{dashboard, roleId}`, no soft-delete plugin. The GET endpoint returns only stored docs; the client supplies the catalog default for any missing role (no server-side `_default` synthesis), keeping defaults defined in exactly one place per side.

---

## Task 1: Frontend catalog lib (`src/lib/dashboardLayout.ts`)

**Files:**
- Create: `src/lib/dashboardLayout.ts`
- Test: `src/lib/dashboardLayout.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/dashboardLayout.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  DASHBOARD_IDS,
  sectionCatalog,
  defaultLayout,
  resolveSections,
  resolveKpis,
  resolveLayoutForRoles,
  DEFAULT_ROLE_ID,
  type StoredLayout,
} from "./dashboardLayout";

describe("dashboardLayout catalog", () => {
  it("lists both dashboards", () => {
    expect(DASHBOARD_IDS).toEqual(["lab", "qc"]);
  });

  it("default layout has all sections enabled in catalog order", () => {
    const layout = defaultLayout("lab");
    expect(layout.sections.map((s) => s.id)).toEqual([
      "header",
      "kpi",
      "primaryTable",
      "rightRail",
      "completed",
    ]);
    expect(layout.sections.every((s) => s.enabled)).toBe(true);
    expect(layout.kpis).toEqual({ all: true, waiting: true, inProgress: true, completed: true });
  });

  it("rightRail label differs by dashboard", () => {
    const lab = sectionCatalog("lab").find((s) => s.id === "rightRail");
    const qc = sectionCatalog("qc").find((s) => s.id === "rightRail");
    expect(lab?.label).not.toEqual(qc?.label);
  });
});

describe("resolveSections", () => {
  it("re-inserts sections missing from a partial config", () => {
    const out = resolveSections("qc", { sections: [{ id: "kpi", enabled: false, order: 5 }] });
    expect(out.map((s) => s.id).sort()).toEqual(
      ["completed", "header", "kpi", "primaryTable", "rightRail"].sort(),
    );
    expect(out.find((s) => s.id === "kpi")?.enabled).toBe(false);
  });

  it("forces header and primaryTable enabled even if stored false", () => {
    const out = resolveSections("lab", {
      sections: [
        { id: "header", enabled: false, order: 0 },
        { id: "primaryTable", enabled: false, order: 1 },
      ],
    });
    expect(out.find((s) => s.id === "header")?.enabled).toBe(true);
    expect(out.find((s) => s.id === "primaryTable")?.enabled).toBe(true);
  });

  it("keeps header first and normalizes order to contiguous", () => {
    const out = resolveSections("lab", {
      sections: [
        { id: "completed", enabled: true, order: 0 },
        { id: "header", enabled: true, order: 9 },
        { id: "primaryTable", enabled: true, order: 1 },
      ],
    });
    expect(out[0].id).toBe("header");
    expect(out.map((s) => s.order)).toEqual([0, 1, 2, 3, 4]);
  });

  it("falls back to all-enabled when config is null", () => {
    const out = resolveSections("qc", null);
    expect(out.every((s) => s.enabled)).toBe(true);
  });
});

describe("resolveKpis", () => {
  it("defaults missing kpi flags to true", () => {
    expect(resolveKpis({ kpis: { waiting: false } })).toEqual({
      all: true,
      waiting: false,
      inProgress: true,
      completed: true,
    });
  });
});

describe("resolveLayoutForRoles", () => {
  const mk = (roleId: string, kpiAll: boolean): StoredLayout => ({
    dashboard: "qc",
    roleId,
    sections: defaultLayout("qc").sections,
    kpis: { all: kpiAll, waiting: true, inProgress: true, completed: true },
  });

  it("uses the first matching role in array order", () => {
    const configs = [mk("roleB", false), mk("roleA", true)];
    const layout = resolveLayoutForRoles("qc", configs, ["roleA", "roleB"]);
    expect(layout.kpis.all).toBe(true);
  });

  it("falls back to _default when no role matches", () => {
    const configs = [mk(DEFAULT_ROLE_ID, false)];
    const layout = resolveLayoutForRoles("qc", configs, ["unknown"]);
    expect(layout.kpis.all).toBe(false);
  });

  it("falls back to catalog default when nothing stored", () => {
    const layout = resolveLayoutForRoles("qc", [], ["unknown"]);
    expect(layout.kpis.all).toBe(true);
    expect(layout.sections.every((s) => s.enabled)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/dashboardLayout.test.ts`
Expected: FAIL — cannot resolve module `./dashboardLayout`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/dashboardLayout.ts`:

```ts
// Single source of truth for Lab/QC dashboard layout config (frontend).
// Mirrors server/lib/dashboardLayout.js — keep section/kpi ids in sync.

export type DashboardId = "lab" | "qc";
export type SectionId = "header" | "kpi" | "primaryTable" | "rightRail" | "completed";
export type KpiId = "all" | "waiting" | "inProgress" | "completed";

export interface SectionDef {
  id: SectionId;
  label: string;
  toggleable: boolean; // can be hidden
  reorderable: boolean; // can move in order
}

export interface SectionConfig {
  id: SectionId;
  enabled: boolean;
  order: number;
}

export type KpiFlags = Record<KpiId, boolean>;

export interface DashboardLayout {
  sections: SectionConfig[];
  kpis: KpiFlags;
}

export interface StoredLayout extends DashboardLayout {
  dashboard: DashboardId;
  roleId: string;
}

export const DASHBOARD_IDS: DashboardId[] = ["lab", "qc"];
export const DEFAULT_ROLE_ID = "_default";
export const FORCED_SECTIONS: SectionId[] = ["header", "primaryTable"];

export const KPI_CATALOG: { id: KpiId; label: string }[] = [
  { id: "all", label: "งานทั้งหมด / ติดตาม" },
  { id: "waiting", label: "รอรับเข้าระบบ" },
  { id: "inProgress", label: "กำลังดำเนินการ" },
  { id: "completed", label: "ตรวจเสร็จแล้ว" },
];

const RIGHT_RAIL_LABEL: Record<DashboardId, string> = {
  lab: "การ์ดตัวอย่างรอรับเข้า",
  qc: "การ์ดตัวอย่างรอ QC",
};

export function sectionCatalog(dashboard: DashboardId): SectionDef[] {
  return [
    { id: "header", label: "หัวเรื่อง + ค้นหา", toggleable: false, reorderable: false },
    { id: "kpi", label: "แถบ KPI", toggleable: true, reorderable: true },
    { id: "primaryTable", label: "ตารางคำร้องหลัก", toggleable: false, reorderable: true },
    { id: "rightRail", label: RIGHT_RAIL_LABEL[dashboard], toggleable: true, reorderable: true },
    { id: "completed", label: 'กล่อง "ตรวจเสร็จแล้ว"', toggleable: true, reorderable: true },
  ];
}

export function defaultLayout(dashboard: DashboardId): DashboardLayout {
  return {
    sections: sectionCatalog(dashboard).map((s, i) => ({ id: s.id, enabled: true, order: i })),
    kpis: { all: true, waiting: true, inProgress: true, completed: true },
  };
}

type PartialLayout = Partial<Pick<DashboardLayout, "sections" | "kpis">> | null | undefined;

// Normalize a (possibly partial / out-of-order) stored config into a full,
// ordered, header-first list with contiguous order indices.
export function resolveSections(dashboard: DashboardId, config: PartialLayout): SectionConfig[] {
  const catalog = sectionCatalog(dashboard);
  const stored = new Map((config?.sections ?? []).map((s) => [s.id, s]));

  const merged: SectionConfig[] = catalog.map((def, i) => {
    const s = stored.get(def.id);
    return {
      id: def.id,
      enabled: s ? !!s.enabled : true,
      order: s && typeof s.order === "number" ? s.order : i,
    };
  });

  for (const m of merged) {
    if (FORCED_SECTIONS.includes(m.id)) m.enabled = true;
  }

  merged.sort((a, b) => {
    if (a.id === "header") return -1;
    if (b.id === "header") return 1;
    return a.order - b.order;
  });

  return merged.map((m, i) => ({ ...m, order: i }));
}

export function resolveKpis(config: PartialLayout): KpiFlags {
  const k = config?.kpis ?? {};
  return {
    all: k.all ?? true,
    waiting: k.waiting ?? true,
    inProgress: k.inProgress ?? true,
    completed: k.completed ?? true,
  };
}

function normalize(dashboard: DashboardId, c: PartialLayout): DashboardLayout {
  return { sections: resolveSections(dashboard, c), kpis: resolveKpis(c) };
}

// Pick the effective layout for a user: first matching role (array order),
// then the shared default role, then the hard-coded catalog default.
export function resolveLayoutForRoles(
  dashboard: DashboardId,
  configs: StoredLayout[],
  roleIds: string[],
): DashboardLayout {
  const byRole = new Map(configs.filter((c) => c.dashboard === dashboard).map((c) => [c.roleId, c]));
  for (const rid of roleIds) {
    const hit = byRole.get(rid);
    if (hit) return normalize(dashboard, hit);
  }
  const def = byRole.get(DEFAULT_ROLE_ID);
  if (def) return normalize(dashboard, def);
  return defaultLayout(dashboard);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/dashboardLayout.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dashboardLayout.ts src/lib/dashboardLayout.test.ts
git commit -m "feat: dashboard layout catalog + resolution helpers (frontend)"
```

---

## Task 2: Backend logic lib (`server/lib/dashboardLayout.js`)

**Files:**
- Create: `server/lib/dashboardLayout.js`
- Test: `server/lib/dashboardLayout.test.js`

- [ ] **Step 1: Write the failing test**

Create `server/lib/dashboardLayout.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const {
  DASHBOARDS,
  SECTION_IDS,
  KPI_IDS,
  validate,
  normalizeSections,
  normalizeKpis,
} = require('./dashboardLayout');

test('constants expose both dashboards and five sections', () => {
  assert.deepEqual(DASHBOARDS, ['lab', 'qc']);
  assert.deepEqual(SECTION_IDS, ['header', 'kpi', 'primaryTable', 'rightRail', 'completed']);
  assert.deepEqual(KPI_IDS, ['all', 'waiting', 'inProgress', 'completed']);
});

test('validate rejects unknown section id', () => {
  const err = validate({ sections: [{ id: 'bogus', enabled: true, order: 0 }] });
  assert.match(err, /section id/);
});

test('validate rejects unknown kpi id', () => {
  const err = validate({ kpis: { bogus: true } });
  assert.match(err, /kpi id/);
});

test('validate passes a well-formed body', () => {
  const err = validate({
    sections: [{ id: 'kpi', enabled: false, order: 1 }],
    kpis: { all: true },
  });
  assert.equal(err, null);
});

test('normalizeSections forces header/primaryTable on and orders header first', () => {
  const out = normalizeSections([
    { id: 'completed', enabled: true, order: 0 },
    { id: 'header', enabled: false, order: 9 },
    { id: 'primaryTable', enabled: false, order: 1 },
  ]);
  assert.equal(out[0].id, 'header');
  assert.equal(out.find((s) => s.id === 'header').enabled, true);
  assert.equal(out.find((s) => s.id === 'primaryTable').enabled, true);
  assert.deepEqual(out.map((s) => s.order), [0, 1, 2]);
});

test('normalizeKpis defaults missing flags to true', () => {
  assert.deepEqual(normalizeKpis({ waiting: false }), {
    all: true,
    waiting: false,
    inProgress: true,
    completed: true,
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test server/lib/dashboardLayout.test.js`
Expected: FAIL — Cannot find module `./dashboardLayout`.

- [ ] **Step 3: Write the implementation**

Create `server/lib/dashboardLayout.js`:

```js
// Single source of truth for Lab/QC dashboard layout config (backend).
// Mirrors src/lib/dashboardLayout.ts — keep section/kpi ids in sync.

const DASHBOARDS = ['lab', 'qc'];
const SECTION_IDS = ['header', 'kpi', 'primaryTable', 'rightRail', 'completed'];
const FORCED_ON = ['header', 'primaryTable'];
const KPI_IDS = ['all', 'waiting', 'inProgress', 'completed'];

function validate(body) {
  const { sections, kpis } = body || {};
  if (sections != null) {
    if (!Array.isArray(sections)) return 'sections ต้องเป็น array';
    for (const s of sections) {
      if (!s || !SECTION_IDS.includes(s.id)) return `section id ไม่ถูกต้อง: ${s && s.id}`;
      if (typeof s.enabled !== 'boolean') return 'section.enabled ต้องเป็น boolean';
      if (typeof s.order !== 'number') return 'section.order ต้องเป็นตัวเลข';
    }
  }
  if (kpis != null) {
    if (typeof kpis !== 'object') return 'kpis ต้องเป็น object';
    for (const k of Object.keys(kpis)) {
      if (!KPI_IDS.includes(k)) return `kpi id ไม่ถูกต้อง: ${k}`;
      if (typeof kpis[k] !== 'boolean') return 'kpi value ต้องเป็น boolean';
    }
  }
  return null;
}

function normalizeSections(sections) {
  const arr = Array.isArray(sections)
    ? sections.map((s) => ({ id: s.id, enabled: !!s.enabled, order: s.order }))
    : [];
  for (const s of arr) {
    if (FORCED_ON.includes(s.id)) s.enabled = true;
  }
  arr.sort((a, b) => {
    if (a.id === 'header') return -1;
    if (b.id === 'header') return 1;
    return a.order - b.order;
  });
  return arr.map((s, i) => ({ id: s.id, enabled: s.enabled, order: i }));
}

function normalizeKpis(kpis) {
  const k = kpis || {};
  return {
    all: typeof k.all === 'boolean' ? k.all : true,
    waiting: typeof k.waiting === 'boolean' ? k.waiting : true,
    inProgress: typeof k.inProgress === 'boolean' ? k.inProgress : true,
    completed: typeof k.completed === 'boolean' ? k.completed : true,
  };
}

module.exports = {
  DASHBOARDS,
  SECTION_IDS,
  FORCED_ON,
  KPI_IDS,
  validate,
  normalizeSections,
  normalizeKpis,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test server/lib/dashboardLayout.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add server/lib/dashboardLayout.js server/lib/dashboardLayout.test.js
git commit -m "feat: dashboard layout validation/normalization (backend)"
```

---

## Task 3: Backend model (`server/models/DashboardLayoutConfig.js`)

**Files:**
- Create: `server/models/DashboardLayoutConfig.js`

- [ ] **Step 1: Write the model**

Create `server/models/DashboardLayoutConfig.js`:

```js
const mongoose = require('mongoose');

const SectionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { _id: false },
);

const DashboardLayoutConfigSchema = new mongoose.Schema(
  {
    dashboard: { type: String, enum: ['lab', 'qc'], required: true, index: true },
    roleId: { type: String, required: true }, // a Role _id, or '_default'
    sections: { type: [SectionSchema], default: [] },
    kpis: {
      all: { type: Boolean, default: true },
      waiting: { type: Boolean, default: true },
      inProgress: { type: Boolean, default: true },
      completed: { type: Boolean, default: true },
    },
  },
  { timestamps: true },
);

// Upsert-only config (like EnvRoomConfig / PrintConfig) — no soft-delete plugin.
DashboardLayoutConfigSchema.index({ dashboard: 1, roleId: 1 }, { unique: true });

module.exports = mongoose.model('DashboardLayoutConfig', DashboardLayoutConfigSchema);
```

- [ ] **Step 2: Verify the model loads**

Run: `node -e "require('./server/models/DashboardLayoutConfig'); console.log('ok')"`
Expected: prints `ok` (no schema errors).

- [ ] **Step 3: Commit**

```bash
git add server/models/DashboardLayoutConfig.js
git commit -m "feat: DashboardLayoutConfig model"
```

---

## Task 4: Backend route + mount (`server/routes/dashboardLayout.js`, `server/index.js`)

**Files:**
- Create: `server/routes/dashboardLayout.js`
- Modify: `server/index.js` (after the `mountApi('/env-room-config', …)` line ~51)

- [ ] **Step 1: Write the route**

Create `server/routes/dashboardLayout.js`:

```js
const express = require('express');
const router = express.Router();
const DashboardLayoutConfig = require('../models/DashboardLayoutConfig');
const { DASHBOARDS, validate, normalizeSections, normalizeKpis } = require('../lib/dashboardLayout');

function pick(doc) {
  return {
    dashboard: doc.dashboard,
    roleId: doc.roleId,
    sections: (doc.sections || []).map((s) => ({ id: s.id, enabled: !!s.enabled, order: s.order })),
    kpis: normalizeKpis(doc.kpis),
  };
}

// GET /api/dashboard-layout?dashboard=lab — stored configs for that dashboard.
// Missing roles fall back to the catalog default on the client.
router.get('/', async (req, res) => {
  try {
    const { dashboard } = req.query;
    if (!DASHBOARDS.includes(dashboard)) return res.status(400).json({ error: 'dashboard ไม่ถูกต้อง' });
    const docs = await DashboardLayoutConfig.find({ dashboard }).lean();
    res.json({ data: docs.map(pick) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/dashboard-layout/:dashboard/:roleId — upsert one role's layout.
router.put('/:dashboard/:roleId', async (req, res) => {
  try {
    const { dashboard, roleId } = req.params;
    if (!DASHBOARDS.includes(dashboard)) return res.status(400).json({ error: 'dashboard ไม่ถูกต้อง' });
    if (!roleId) return res.status(400).json({ error: 'roleId จำเป็น' });
    const err = validate(req.body || {});
    if (err) return res.status(400).json({ error: err });

    const sections = normalizeSections((req.body || {}).sections);
    const kpis = normalizeKpis((req.body || {}).kpis);
    const doc = await DashboardLayoutConfig.findOneAndUpdate(
      { dashboard, roleId },
      { dashboard, roleId, sections, kpis },
      { new: true, upsert: true },
    ).lean();
    res.json({ data: pick(doc) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 2: Mount the route**

In `server/index.js`, add immediately after the `mountApi('/env-room-config', …)` line (currently line ~51):

```js
mountApi('/dashboard-layout', require('./routes/dashboardLayout'));
```

- [ ] **Step 3: Verify the server boots and the route answers**

Start the backend in one shell: `cd server && npm run dev`
In another shell:

Run: `curl -s "http://localhost:3001/api/dashboard-layout?dashboard=lab"`
Expected: `{"data":[]}` (empty until a config is saved).

Run: `curl -s -X PUT "http://localhost:3001/api/dashboard-layout/lab/_default" -H "Content-Type: application/json" -d "{\"sections\":[{\"id\":\"kpi\",\"enabled\":false,\"order\":3}],\"kpis\":{\"waiting\":false}}"`
Expected: JSON `{"data":{...}}` where `sections` is normalized (header first, contiguous order) and `kpis.waiting=false`, others `true`.

Run: `curl -s "http://localhost:3001/api/dashboard-layout?dashboard=lab"`
Expected: array now contains the `_default` doc.

Run (rejection check): `curl -s -X PUT "http://localhost:3001/api/dashboard-layout/lab/_default" -H "Content-Type: application/json" -d "{\"sections\":[{\"id\":\"bogus\",\"enabled\":true,\"order\":0}]}"`
Expected: `400` with `{"error":"section id ไม่ถูกต้อง: bogus"}`.

- [ ] **Step 4: Commit**

```bash
git add server/routes/dashboardLayout.js server/index.js
git commit -m "feat: dashboard-layout route (GET list + PUT upsert)"
```

---

## Task 5: API client methods (`src/lib/api.ts`)

**Files:**
- Modify: `src/lib/api.ts` (add methods near the Env room config block ~line 348)

- [ ] **Step 1: Add the API methods**

In `src/lib/api.ts`, add an import at the top with the other `@/lib` type imports:

```ts
import type { DashboardId, StoredLayout, DashboardLayout } from "@/lib/dashboardLayout";
```

Then add inside the `api` object, right after the `updateEnvRoomConfig` method (~line 355):

```ts
  // ── Dashboard layout config (per-role section/KPI layout for Lab & QC) ──
  getDashboardLayouts: (dashboard: DashboardId) =>
    request<{ data: StoredLayout[] }>(`/dashboard-layout?dashboard=${dashboard}`).then((r) => r.data),
  updateDashboardLayout: (dashboard: DashboardId, roleId: string, input: DashboardLayout) =>
    request<{ data: StoredLayout }>(`/dashboard-layout/${dashboard}/${encodeURIComponent(roleId)}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }).then((r) => r.data),
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no new errors referencing `api.ts` or `dashboardLayout` (repo has ~12 pre-existing latent errors per `project_real_typecheck_command` — confirm none are newly introduced by this change).

- [ ] **Step 3: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat: api client for dashboard-layout config"
```

---

## Task 6: Hooks (`useDashboardLayouts`, `useDashboardLayout`)

**Files:**
- Create: `src/hooks/useDashboardLayouts.ts` (settings: full list for a dashboard)
- Create: `src/hooks/useDashboardLayout.ts` (runtime: resolved layout for current user)

- [ ] **Step 1: Write the settings-list hook**

Create `src/hooks/useDashboardLayouts.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { DashboardId } from "@/lib/dashboardLayout";

// All stored configs for one dashboard, keyed for the settings editor.
export function useDashboardLayouts(dashboard: DashboardId) {
  return useQuery({
    queryKey: ["dashboard-layout", dashboard],
    queryFn: () => api.getDashboardLayouts(dashboard),
  });
}
```

- [ ] **Step 2: Write the runtime-resolution hook**

Create `src/hooks/useDashboardLayout.ts`:

```ts
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import {
  defaultLayout,
  resolveLayoutForRoles,
  type DashboardId,
  type DashboardLayout,
} from "@/lib/dashboardLayout";

// Resolve the effective layout for the current user on a dashboard:
// first matching role → '_default' → catalog default. Never blocks render —
// while loading (or on error) it returns the catalog default so the dashboard
// looks exactly as it does today.
export function useDashboardLayout(dashboard: DashboardId): DashboardLayout {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["dashboard-layout", dashboard],
    queryFn: () => api.getDashboardLayouts(dashboard),
  });

  return useMemo(() => {
    const roleIds = user?.roles ?? (user?.role ? [user.role] : []);
    if (!data) return defaultLayout(dashboard);
    return resolveLayoutForRoles(dashboard, data, roleIds);
  }, [data, dashboard, user?.roles, user?.role]);
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no new errors from the two new hook files. (`useAuth().user` exposes `role?: string` and `roles?: string[]` — confirmed in `src/context/AuthContext.tsx`.)

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useDashboardLayouts.ts src/hooks/useDashboardLayout.ts
git commit -m "feat: dashboard layout hooks (settings list + runtime resolve)"
```

---

## Task 7: Wireframe preview component (`DashboardLayoutPreview.tsx`)

**Files:**
- Create: `src/components/lis/DashboardLayoutPreview.tsx`

A pure presentational component — no data, no API. Renders the in-editor layout as
grey skeleton boxes so the admin sees the structure live.

- [ ] **Step 1: Write the component**

Create `src/components/lis/DashboardLayoutPreview.tsx`:

```tsx
import {
  sectionCatalog,
  resolveSections,
  KPI_CATALOG,
  type DashboardId,
  type DashboardLayout,
} from "@/lib/dashboardLayout";

interface Props {
  dashboard: DashboardId;
  layout: DashboardLayout;
}

// Box wireframe of the dashboard. Mirrors the real render rule:
// rightRail enabled AND immediately after primaryTable → side column;
// otherwise full-width stacked. header always pinned top.
export default function DashboardLayoutPreview({ dashboard, layout }: Props) {
  const catalog = sectionCatalog(dashboard);
  const labelOf = (id: string) => catalog.find((c) => c.id === id)?.label ?? id;
  const ordered = resolveSections(dashboard, layout).filter((s) => s.enabled);

  const rows: JSX.Element[] = [];
  for (let i = 0; i < ordered.length; i += 1) {
    const s = ordered[i];
    if (s.id === "rightRail") continue; // rendered alongside primaryTable below

    if (s.id === "primaryTable") {
      const next = ordered[i + 1];
      const railAdjacent = next?.id === "rightRail";
      rows.push(
        <div key="primaryTable" className="flex gap-2">
          <div className="flex-1 rounded-md border border-dashed border-slate-300 bg-slate-100 px-3 py-6 text-center text-xs text-slate-500">
            {labelOf("primaryTable")}
          </div>
          {railAdjacent && (
            <div className="w-24 rounded-md border border-dashed border-slate-300 bg-slate-100 px-2 py-6 text-center text-[10px] text-slate-500">
              {labelOf("rightRail")}
            </div>
          )}
        </div>,
      );
      continue;
    }

    if (s.id === "kpi") {
      rows.push(
        <div key="kpi" className="grid grid-cols-4 gap-2">
          {KPI_CATALOG.map((k) => {
            const on = layout.kpis[k.id];
            return (
              <div
                key={k.id}
                className={`rounded-md border border-dashed px-2 py-3 text-center text-[10px] ${
                  on
                    ? "border-slate-300 bg-slate-100 text-slate-500"
                    : "border-slate-200 bg-slate-50 text-slate-300 line-through"
                }`}
              >
                {k.label}
              </div>
            );
          })}
        </div>,
      );
      continue;
    }

    // header, completed, or a non-adjacent rightRail → full-width block
    rows.push(
      <div
        key={s.id}
        className="rounded-md border border-dashed border-slate-300 bg-slate-100 px-3 py-3 text-center text-xs text-slate-500"
      >
        {labelOf(s.id)}
      </div>,
    );
  }

  // A rightRail enabled but NOT adjacent to primaryTable renders as its own block.
  const rail = ordered.find((s) => s.id === "rightRail");
  const railIndex = ordered.findIndex((s) => s.id === "rightRail");
  const primaryIndex = ordered.findIndex((s) => s.id === "primaryTable");
  if (rail && railIndex !== primaryIndex + 1) {
    rows.splice(railIndex, 0, (
      <div
        key="rightRail-block"
        className="rounded-md border border-dashed border-slate-300 bg-slate-100 px-3 py-3 text-center text-xs text-slate-500"
      >
        {labelOf("rightRail")}
      </div>
    ));
  }

  return <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">{rows}</div>;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no new errors from `DashboardLayoutPreview.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/lis/DashboardLayoutPreview.tsx
git commit -m "feat: dashboard layout wireframe preview"
```

---

## Task 8: Settings editor card + tab (`DashboardLayoutConfigCard.tsx`, `SettingsPage.tsx`)

**Files:**
- Create: `src/components/lis/DashboardLayoutConfigCard.tsx`
- Modify: `src/pages/SettingsPage.tsx`

The card owns: dashboard switch, role select, section list (toggle + ↑/↓), KPI
sub-toggles, the live preview, and the save mutation.

- [ ] **Step 1: Write the editor card**

Create `src/components/lis/DashboardLayoutConfigCard.tsx`:

```tsx
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayoutPreview from "@/components/lis/DashboardLayoutPreview";
import { api } from "@/lib/api";
import {
  DASHBOARD_IDS,
  DEFAULT_ROLE_ID,
  FORCED_SECTIONS,
  KPI_CATALOG,
  defaultLayout,
  resolveSections,
  resolveKpis,
  sectionCatalog,
  type DashboardId,
  type DashboardLayout,
  type KpiId,
  type SectionId,
} from "@/lib/dashboardLayout";

interface RoleOption {
  id: string;
  name: string;
}

interface Props {
  roles: RoleOption[];
}

export default function DashboardLayoutConfigCard({ roles }: Props) {
  const queryClient = useQueryClient();
  const [dashboard, setDashboard] = useState<DashboardId>("lab");
  const [roleId, setRoleId] = useState<string>(DEFAULT_ROLE_ID);

  const { data: configs = [] } = useQuery({
    queryKey: ["dashboard-layout", dashboard],
    queryFn: () => api.getDashboardLayouts(dashboard),
  });

  // The layout currently being edited (local, unsaved).
  const [draft, setDraft] = useState<DashboardLayout>(() => defaultLayout("lab"));

  // Load draft from stored config (or catalog default) whenever dashboard/role/data changes.
  useEffect(() => {
    const stored = configs.find((c) => c.roleId === roleId);
    setDraft({
      sections: resolveSections(dashboard, stored ?? null),
      kpis: resolveKpis(stored ?? null),
    });
  }, [dashboard, roleId, configs]);

  const catalog = useMemo(() => sectionCatalog(dashboard), [dashboard]);
  const labelOf = (id: SectionId) => catalog.find((c) => c.id === id)?.label ?? id;
  const defOf = (id: SectionId) => catalog.find((c) => c.id === id);

  const toggleSection = (id: SectionId) => {
    setDraft((d) => ({
      ...d,
      sections: d.sections.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
    }));
  };

  const move = (id: SectionId, dir: -1 | 1) => {
    setDraft((d) => {
      const arr = [...d.sections].sort((a, b) => a.order - b.order);
      const idx = arr.findIndex((s) => s.id === id);
      const target = idx + dir;
      // header is pinned at index 0; never swap into/over it.
      if (idx <= 0 || target <= 0 || target >= arr.length) return d;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return { ...d, sections: arr.map((s, i) => ({ ...s, order: i })) };
    });
  };

  const toggleKpi = (id: KpiId) => {
    setDraft((d) => ({ ...d, kpis: { ...d.kpis, [id]: !d.kpis[id] } }));
  };

  const saveMutation = useMutation({
    mutationFn: () => api.updateDashboardLayout(dashboard, roleId, draft),
    onSuccess: () => {
      toast.success("บันทึก layout แดชบอร์ดแล้ว");
      queryClient.invalidateQueries({ queryKey: ["dashboard-layout", dashboard] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    },
  });

  const sectionsInOrder = [...draft.sections].sort((a, b) => a.order - b.order);
  const kpiEnabled = draft.sections.find((s) => s.id === "kpi")?.enabled ?? true;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Controls */}
      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={dashboard} onValueChange={(v) => setDashboard(v as DashboardId)}>
            <TabsList>
              {DASHBOARD_IDS.map((d) => (
                <TabsTrigger key={d} value={d}>
                  {d === "lab" ? "Lab" : "QC"}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Select value={roleId} onValueChange={setRoleId}>
            <SelectTrigger className="h-9 w-56">
              <SelectValue placeholder="เลือก role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DEFAULT_ROLE_ID}>ค่ามาตรฐาน (default)</SelectItem>
              {roles.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Section list */}
        <div className="space-y-2">
          {sectionsInOrder.map((s) => {
            const def = defOf(s.id);
            const forced = FORCED_SECTIONS.includes(s.id);
            return (
              <div key={s.id} className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    disabled={!def?.reorderable || s.id === "header"}
                    onClick={() => move(s.id, -1)}
                    aria-label="เลื่อนขึ้น"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    disabled={!def?.reorderable || s.id === "header"}
                    onClick={() => move(s.id, 1)}
                    aria-label="เลื่อนลง"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <span className="flex-1 text-sm">{labelOf(s.id)}</span>
                <Switch
                  checked={s.enabled}
                  disabled={forced}
                  onCheckedChange={() => toggleSection(s.id)}
                  title={forced ? "ส่วนนี้ต้องแสดงเสมอ" : undefined}
                />
              </div>
            );
          })}
        </div>

        {/* KPI sub-toggles */}
        <div className={kpiEnabled ? "" : "opacity-50 pointer-events-none"}>
          <p className="mb-2 text-xs font-medium text-muted-foreground">KPI ที่แสดง</p>
          <div className="grid grid-cols-2 gap-2">
            {KPI_CATALOG.map((k) => (
              <label key={k.id} className="flex items-center gap-2 text-sm">
                <Switch checked={draft.kpis[k.id]} onCheckedChange={() => toggleKpi(k.id)} />
                {k.label}
              </label>
            ))}
          </div>
        </div>

        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "กำลังบันทึก…" : "บันทึก"}
        </Button>
      </div>

      {/* Live wireframe */}
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">ตัวอย่างผังหน้าจอ</p>
        <DashboardLayoutPreview dashboard={dashboard} layout={draft} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire the tab into SettingsPage**

In `src/pages/SettingsPage.tsx`:

(a) Add imports near the other component imports:

```tsx
import DashboardLayoutConfigCard from "@/components/lis/DashboardLayoutConfigCard";
```

(b) Add a query for the role list. The access-control matrix is fetched via the
generic `api.get` (same call `useCanAccessPath`/`PrivateRoute` use) and returns
`res.data.data` with a `roles` array of `{ id, name }`. After the existing `printers`
query (~line 48), add:

```tsx
  const { data: accessMatrix } = useQuery({
    queryKey: ["access-control"],
    queryFn: async () => {
      const res = await api.get<{ roles?: { id: string; name: string }[] }>("/access-control");
      return res.data.data;
    },
  });
  const roleOptions = (accessMatrix?.roles ?? []).map((r) => ({ id: r.id, name: r.name }));
```

> Reuse the existing `["access-control"]` query key (already used by
> `useCanAccessPath.ts`) so this shares cache with the rest of the app — do not add a
> new `api` method.

(c) Add the tab trigger inside `<TabsList>` after the printers trigger:

```tsx
          <TabsTrigger value="dashboard">แดชบอร์ด</TabsTrigger>
```

(d) Add the tab content after the printers `<TabsContent>`:

```tsx
        <TabsContent value="dashboard" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            เลือกว่าจะแสดงส่วนไหน เรียงลำดับอย่างไร และ KPI ใบไหน — แยกตาม role (ค่ามาตรฐานใช้เมื่อ role นั้นยังไม่ตั้งค่า)
          </p>
          <DashboardLayoutConfigCard roles={roleOptions} />
        </TabsContent>
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no new errors. Resolve any `api.getAccessControl` naming mismatch per the note in Step 2(b).

- [ ] **Step 4: Manual verification**

With both servers running, open `/LIS/settings` (settings page) in the browser → "แดชบอร์ด" tab.
Expected:
- Lab/QC switch and role dropdown render.
- Toggling a section / dragging order with ↑↓ updates the wireframe live.
- `header` and `primaryTable` switches are disabled (forced on); `header` ↑↓ disabled.
- Disabling the KPI section greys out the 4 KPI toggles.
- "บันทึก" shows a success toast; reloading the page re-loads the saved config for that role.

- [ ] **Step 5: Commit**

```bash
git add src/components/lis/DashboardLayoutConfigCard.tsx src/pages/SettingsPage.tsx
git commit -m "feat: dashboard layout settings tab + editor card"
```

---

## Task 9: Consume layout in LabDashboard

**Files:**
- Modify: `src/pages/LabDashboard.tsx`

Refactor the JSX body into a `sectionId → ReactNode` map and render enabled
sections in order. Keep all existing data hooks and derivations unchanged.

- [ ] **Step 1: Add the layout hook and section map**

In `src/pages/LabDashboard.tsx`:

(a) Add imports:

```tsx
import { useDashboardLayout } from "@/hooks/useDashboardLayout";
import type { SectionId } from "@/lib/dashboardLayout";
```

(b) Inside the component, after the existing derivations, add:

```tsx
  const layout = useDashboardLayout("lab");
  const kpiOn = layout.kpis;
```

(c) Replace the existing KPI strip JSX so each `StatCard` is wrapped by its KPI flag.
Wrap the 4 cards individually, e.g.:

```tsx
        {kpiOn.all && (
          <StatCard
            icon={ClipboardList}
            value={labTotal}
            label="งานทั้งหมดใน Lab"
            variant="neutral"
            sublabel={`รวมงานเสร็จแล้ว ${completedPetitions.length}`}
            active={activeKpi === "all"}
            onClick={() => toggleKpi("all")}
          />
        )}
        {kpiOn.waiting && (
          <StatCard
            icon={Hourglass}
            value={waitingReceivePetitions.length}
            label="รอรับเข้าระบบ"
            variant="amber"
            active={activeKpi === "waiting"}
            onClick={() => toggleKpi("waiting")}
          />
        )}
        {kpiOn.inProgress && (
          <StatCard
            icon={Activity}
            value={inProgressPetitions.length}
            label="กำลังดำเนินการ"
            variant="blue"
            active={activeKpi === "inProgress"}
            onClick={() => toggleKpi("inProgress")}
          />
        )}
        {kpiOn.completed && (
          <StatCard
            icon={CheckCircle2}
            value={completedPetitions.length}
            label="ตรวจเสร็จแล้ว"
            variant="green"
            active={activeKpi === "completed"}
            onClick={() => toggleKpi("completed")}
          />
        )}
```

(d) Build the section map. Define each section as a `ReactNode` keyed by `SectionId`,
using the *existing* JSX blocks verbatim:

```tsx
  const sectionNodes: Partial<Record<SectionId, JSX.Element>> = {
    header: (/* existing Header block */ <>{/* … */}</>),
    kpi: (/* existing KPI strip grid */ <>{/* … */}</>),
    primaryTable: (/* the <PetitionDashboardTable … /> primary table */ <>{/* … */}</>),
    rightRail: (<WaitingSamplesCard petitions={waitingReceivePetitions} />),
    completed: (/* existing Completed collapsible block */ <>{/* … */}</>),
  };
```

(e) Replace the single returned layout with an ordered render. Use the explicit
rightRail-adjacency rule from the spec:

```tsx
  const ordered = layout.sections.filter((s) => s.enabled);

  return (
    <AppLayout>
      {ordered.map((s, i) => {
        if (s.id === "rightRail") return null; // rendered with primaryTable when adjacent
        if (s.id === "primaryTable") {
          const next = ordered[i + 1];
          const railAdjacent = next?.id === "rightRail";
          return (
            <div
              key="primaryTable"
              className={
                railAdjacent
                  ? "grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 mb-4"
                  : "mb-4"
              }
            >
              {sectionNodes.primaryTable}
              {railAdjacent ? sectionNodes.rightRail : null}
            </div>
          );
        }
        return (
          <div key={s.id} className="mb-4">
            {sectionNodes[s.id]}
          </div>
        );
      })}
      {/* rightRail enabled but NOT adjacent to primaryTable → its own block */}
      {(() => {
        const railIdx = ordered.findIndex((s) => s.id === "rightRail");
        const primaryIdx = ordered.findIndex((s) => s.id === "primaryTable");
        if (railIdx !== -1 && railIdx !== primaryIdx + 1) {
          return <div className="mb-4">{sectionNodes.rightRail}</div>;
        }
        return null;
      })()}
    </AppLayout>
  );
```

> Implementation note: move the existing header `<div>`, KPI `<div className="grid …">`,
> `<PetitionDashboardTable … />`, and the Completed `<Collapsible>` blocks *unchanged*
> into the `sectionNodes` map. Do not alter their internals — only relocate them. Remove
> the old hard-coded main grid (`grid … [minmax(0,1fr)_360px]`) since the renderer now
> owns the primaryTable+rightRail grid.

- [ ] **Step 2: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no new errors from `LabDashboard.tsx`.

- [ ] **Step 3: Manual verification (default = unchanged)**

With no stored `lab` config (or `_default` = all on), open the Lab dashboard.
Expected: visually identical to before this change (header, KPI ×4, table + right card in 2-col grid, completed collapsible).

Then save a `lab/_default` config in Settings that disables `rightRail` and the
`waiting` KPI, reload the Lab dashboard.
Expected: right card gone (table full width), only 3 KPI cards shown.

- [ ] **Step 4: Commit**

```bash
git add src/pages/LabDashboard.tsx
git commit -m "feat: LabDashboard renders sections from layout config"
```

---

## Task 10: Consume layout in QCDashboard

**Files:**
- Modify: `src/pages/QCDashboard.tsx`

Identical treatment to Task 9, adapted to QC's specifics: dashboard id `"qc"`,
right rail is `<PendingQcSamplesCard samples={pendingQcSamples} />`, and the "all"
KPI uses `trackedTotal` / label "คำร้องที่ QC ติดตาม".

- [ ] **Step 1: Add the layout hook, KPI flags, and section map**

In `src/pages/QCDashboard.tsx`:

(a) Add imports:

```tsx
import { useDashboardLayout } from "@/hooks/useDashboardLayout";
import type { SectionId } from "@/lib/dashboardLayout";
```

(b) After the derivations add:

```tsx
  const layout = useDashboardLayout("qc");
  const kpiOn = layout.kpis;
```

(c) Wrap each of the 4 `StatCard`s in its KPI flag, mirroring Task 9 Step 1(c) but
using QC's values: `all` → `value={trackedTotal} label="คำร้องที่ QC ติดตาม"`,
`waiting` → `pendingReceivePetitions.length`, `inProgress` → `inProgressPetitions.length`,
`completed` → `completedPetitions.length`.

(d) Build the `sectionNodes` map with QC's blocks (header, KPI strip, the primary
`<PetitionDashboardTable … />`, `rightRail: <PendingQcSamplesCard samples={pendingQcSamples} />`,
and the Completed `<Collapsible>` block), moving the existing JSX unchanged.

(e) Replace the returned layout with the same ordered renderer as Task 9 Step 1(e)
(the rightRail-adjacency block is dashboard-agnostic — copy it verbatim, it reads
`sectionNodes` and `layout.sections`).

- [ ] **Step 2: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no new errors from `QCDashboard.tsx`.

- [ ] **Step 3: Manual verification**

With no stored `qc` config, open the QC dashboard → visually identical to before.
Save a `qc/_default` that reorders `completed` above `primaryTable` and disables `kpi`;
reload → no KPI strip, completed box appears above the main table.

- [ ] **Step 4: Commit**

```bash
git add src/pages/QCDashboard.tsx
git commit -m "feat: QCDashboard renders sections from layout config"
```

---

## Task 11: Full verification + seed backup

**Files:** none (verification + data backup)

- [ ] **Step 1: Run the full frontend test suite**

Run: `npm run test`
Expected: all pass, including the new `dashboardLayout.test.ts`.

- [ ] **Step 2: Run the backend logic test**

Run: `node --test server/lib/dashboardLayout.test.js`
Expected: all pass.

- [ ] **Step 3: Full type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors introduced by this feature (only the ~12 pre-existing latent errors, if any, per `project_real_typecheck_command`).

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no new lint errors in the created/modified files.

- [ ] **Step 5: End-to-end smoke**

With both servers up: in Settings → แดชบอร์ด, create a config for a real role (not
`_default`), then switch to that role via the DevRoleSwitcher and open the matching
dashboard. Confirm the dashboard reflects that role's layout, and that a role with no
config falls back to `_default`, and no `_default` falls back to the original layout.

- [ ] **Step 6: Back up the new collection to seed-data**

Per `project_seed_data_backup`, export so the new `dashboardlayoutconfigs` collection
is committed (recoverable on DB wipe):

Run: `cd server && npm run seed:export`
Then:

```bash
git add server/seed-data/
git commit -m "chore: seed-data backup incl. dashboard layout config"
```

---

## Self-Review (completed during planning)

- **Spec coverage:** §1 catalog → Task 1/2; §2 model+route → Task 3/4; §3 settings tab → Task 8; §4 wireframe → Task 7; §5 consumption → Task 9/10 (incl. explicit rightRail-adjacency rule); §6 testing → Tasks 1, 2, 11. API/hooks (implied by §3/§5) → Task 5/6. Seed backup (§2) → Task 11.
- **Deviation logged:** no soft-delete plugin + no server-side `_default` synthesis (matches sibling config models; defaults live once per side). Documented in File Structure.
- **Type consistency:** `DashboardLayout`, `StoredLayout`, `SectionId`, `KpiId`, `resolveSections`, `resolveKpis`, `resolveLayoutForRoles`, `defaultLayout`, `DEFAULT_ROLE_ID`, `FORCED_SECTIONS` used identically across frontend lib, hooks, preview, and editor. Backend exports `DASHBOARDS/SECTION_IDS/KPI_IDS/validate/normalizeSections/normalizeKpis`, consumed by the route.
- **Resolved:** access-control matrix is fetched via `api.get<…>("/access-control")` → `res.data.data.roles` (`[{id,name}]`), reusing the existing `["access-control"]` query key — no new `api` method (Task 8 Step 2b).
```
