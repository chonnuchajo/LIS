# Dashboard Layout Config (Lab + QC) — Design

**Date:** 2026-06-10
**Status:** Approved (design), pending implementation plan
**Scope:** In-app Lab Dashboard + QC Dashboard. (Queue/TV display is out of scope.)

## Goal

Let an admin configure, **per role**, what the Lab and QC dashboards show and in
what order: toggle whole sections on/off, reorder them, and toggle individual KPI
cards. A live wireframe preview shows the resulting layout. At runtime each user
sees the layout for their role, falling back to a shared default.

## Decisions (from brainstorming)

- **Targets:** Lab Dashboard + QC Dashboard (in-app pages). Not QueueDisplay/TV.
- **Granularity:** deep — show/hide sections, reorder sections, toggle individual KPI cards.
- **Audience:** per role.
- **Runtime resolution:** resolve by the user's role automatically; fall back to a
  shared `_default` config; if that is also absent, fall back to the hard-coded
  catalog default (current layout, byte-for-byte backward compatible).
- **Preview:** box wireframe (skeleton), not a live render of the real dashboard.
- **Reorder UI:** up/down arrow buttons (no drag-and-drop library — repo has none,
  avoid a new dependency).

## 1. Section catalog (shared source of truth)

New file `src/lib/dashboardLayout.ts`. Defines the configurable pieces for each
dashboard, consumed by the dashboard pages, the settings UI, and the wireframe so
labels/ids never drift.

Sections per dashboard (`lab` and `qc` share the same shape):

| sectionId      | label (TH)                          | toggleable | reorderable | notes |
|----------------|-------------------------------------|------------|-------------|-------|
| `header`       | หัวเรื่อง + ค้นหา                    | no (forced on) | no (pinned top) | always first |
| `kpi`          | แถบ KPI                             | yes        | yes         | has 4 sub-toggles |
| `primaryTable` | ตารางคำร้องหลัก                     | no (forced on) | yes      | page backbone; cannot hide |
| `rightRail`    | การ์ดด้านขวา (Lab=รอรับเข้า, QC=รอ QC) | yes      | yes         | WaitingSamplesCard / PendingQcSamplesCard |
| `completed`    | กล่อง "ตรวจเสร็จแล้ว" (พับได้)        | yes        | yes         | Completed collapsible |

KPI sub-toggles (only meaningful when `kpi` section is enabled):
`all`, `waiting`, `inProgress`, `completed`.

Forced-on rule: `header` and `primaryTable` are always enabled (prevents an empty
dashboard). Their toggles render disabled with an explanatory tooltip.

Catalog default = the current hard-coded layout: all sections enabled, all KPIs on,
order = `header, kpi, primaryTable, rightRail, completed`. (`rightRail` renders
beside `primaryTable` in the existing grid — see §5 layout note.)

The catalog exports, at minimum:
- `DASHBOARD_IDS = ['lab', 'qc']`
- `SECTION_CATALOG[dashboard]` → ordered list of `{ id, label, toggleable, reorderable }`
- `KPI_CATALOG` → `[{ id, label }]` for the 4 KPI cards
- `defaultLayout(dashboard)` → `{ sections: [{id,enabled,order}], kpis: {...} }`
- helper `resolveSections(config, dashboard)` → normalized ordered+enabled list,
  re-inserting any catalog section missing from a stored config (forward-compatible
  when new sections are added later) and forcing `header`/`primaryTable` on.

## 2. Backend model + route

### Model `server/models/DashboardLayoutConfig.js`

```
dashboard : String  enum ['lab','qc']   required
roleId    : String  required            // a Role _id, or '_default'
sections  : [{ id: String, enabled: Boolean, order: Number }]
kpis      : { all: Boolean, waiting: Boolean, inProgress: Boolean, completed: Boolean }
timestamps: true
```

- Compound unique index `{ dashboard, roleId }`. Per the project soft-delete plugin
  convention, the unique index becomes `{ dashboard, roleId, deletedAt }` and the
  model applies the shared soft-delete plugin (see `project_soft_delete`).
- Auto-created on boot by `ensureCollections()` + `syncIndexes()` (no manual wiring).

### Route `server/routes/dashboard-layout.js`

Mounted via `mountApi()` so it is served at both `/api/dashboard-layout` and
`/LIS/api/dashboard-layout`. Registered in `server/index.js` alongside the other routes.

- `GET /dashboard-layout?dashboard=lab`
  Returns every stored config for that dashboard keyed by roleId, **plus** a
  synthesized `_default` entry from the catalog when none is stored — mirroring the
  "DB-or-default" merge pattern in `print.js` `GET /config`.
- `PUT /dashboard-layout/:dashboard/:roleId`
  Upsert (`findOneAndUpdate … {upsert:true}`). Validation:
  - `dashboard` ∈ catalog; every `sections[].id` ∈ catalog for that dashboard.
  - `header` and `primaryTable` coerced to `enabled: true` server-side regardless of
    payload (defense in depth — the UI also forbids disabling them).
  - `order` normalized to a contiguous sequence.
  - `kpis` keys restricted to the 4 known ids.

No new auth middleware; the route lives behind the existing app. The settings page
itself is gated by the existing path-based access control (admin-only area).

### Seed data

After first real save, `npm run seed:export` picks up the new collection
automatically (dynamic `listCollections()`), so no seed wiring is needed; document
this in the implementation plan as a post-merge step per `project_seed_data_backup`.

## 3. Settings UI — new "แดชบอร์ด" tab

Extend `src/pages/SettingsPage.tsx`: add `<TabsTrigger value="dashboard">แดชบอร์ด</TabsTrigger>`
and a matching `<TabsContent>`. New component `src/components/lis/DashboardLayoutConfigCard.tsx`
(plus a thin container that owns query/mutation state, following the
EnvRoomConfigCard / PrintConfigCard split).

Controls:
- **Dashboard switch:** Lab / QC (segmented or inner tabs).
- **Role select:** dropdown of roles + a "ค่ามาตรฐาน (default)" option mapping to
  `_default`. Role list comes from the access-control matrix (same source
  AuthContext already loads: `GET /access-control` → `data.roles = [{id,name}]`).
- **Section list:** each row = label + enable `Switch` + ↑/↓ buttons.
  - `header`/`primaryTable`: Switch disabled (forced on) with tooltip; `header` also
    has reorder disabled (pinned top).
- **KPI sub-toggles:** 4 switches, shown/enabled only when `kpi` section is enabled.
- **Save button:** PUT for the selected `{dashboard, roleId}`; success/error toast
  via the existing `sonner` pattern; invalidate the `['dashboard-layout', dashboard]`
  query key.

Data layer: add `api.getDashboardLayouts(dashboard)` and
`api.updateDashboardLayout(dashboard, roleId, input)` to `src/lib/api.ts`, and a
`useDashboardLayouts` hook for the settings page (list form). Types live next to the
catalog in `src/lib/dashboardLayout.ts`.

## 4. Wireframe preview

Component `src/components/lis/DashboardLayoutPreview.tsx`, rendered beside the
controls. Pure function of the in-editor (unsaved) config — updates live as the admin
toggles/reorders:

- Draws `header` as a pinned top bar.
- Then each enabled section in `order` as a grey skeleton box labelled from the catalog.
- `kpi` box renders 4 mini cells; a disabled KPI cell is dimmed/struck so the admin
  sees exactly which cards drop.
- `rightRail`, when enabled, draws as a side column next to `primaryTable` (matching
  the real grid); when disabled, `primaryTable` spans full width.

No real data, no API calls — purely structural.

## 5. Dashboard consumption

Refactor `src/pages/LabDashboard.tsx` and `src/pages/QCDashboard.tsx`:

- Keep all existing data hooks/derivations unchanged.
- Extract the JSX body into a `sectionId → renderNode()` map (`header`, `kpi`,
  `primaryTable`, `rightRail`, `completed`).
- New hook `useDashboardLayout(dashboard)` (`src/hooks/useDashboardLayout.ts`):
  - Reads the user's `roles` from `useAuth()`.
  - **Resolves client-side** by reusing the same `GET /dashboard-layout?dashboard=…`
    list endpoint (no new single-config endpoint — keeps the API surface small and the
    response is small/cacheable via React Query).
  - Resolution order: first `role` in `user.roles` (in array order) that has a stored
    config → `_default` → catalog default.
- Render enabled sections in `order` via the map; `header` and `primaryTable` always
  present. KPI strip filters to enabled KPI ids.

**Layout note (explicit rule):** today `primaryTable` + `rightRail` share one CSS grid
(`xl:grid-cols-[minmax(0,1fr)_360px]`). The renderer applies this rule:

- If `rightRail` is enabled **and** ordered immediately after `primaryTable`, the two
  render together in the existing 2-column grid (today's look — this is the default order).
- If `rightRail` is enabled but **not** adjacent to `primaryTable`, it renders as a
  full-width stacked card at its own order position, and `primaryTable` spans full width.
- If `rightRail` is disabled, `primaryTable` spans full width.

All other sections (`kpi`, `completed`) always render as full-width stacked blocks in
their order position. This rule is total (no undefined cases) and the default order
reproduces today's layout exactly.

## 6. Testing

Vitest (co-located, matching repo convention):
- `dashboardLayout.test.ts`: catalog defaults; `resolveSections` re-inserts missing
  sections, forces `header`/`primaryTable` on, normalizes order; default layout equals
  current hard-coded layout.
- Resolution logic: role match → `_default` → catalog default.
- Backend validate: rejects unknown section/kpi ids and unknown dashboard; coerces
  `header`/`primaryTable` enabled.

No changes to petition-query logic; dashboards only wrap existing render output.

## Out of scope / YAGNI

- QueueDisplay / TV layout.
- Per-user (vs per-role) layouts.
- Free-form grid / drag-drop positioning.
- Configuring section internals (columns, page size, etc.) — only show/hide/order.

## Backward compatibility

With no stored configs, every dashboard resolves to the catalog default, which is the
current layout exactly. Shipping the feature with an empty collection changes nothing
visible until an admin saves a config.
