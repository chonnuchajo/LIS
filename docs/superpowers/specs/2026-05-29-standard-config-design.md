# Standard Config — Design Spec

**Date**: 2026-05-29
**Status**: Approved (pending impl plan)
**Scope**: Phase 1 — config-only. Stock deduction integration is deferred to Phase 2.

## Purpose

Add a new page `/standard-config` to capture per-substance calibration-standard
configuration (number of standard preparations + volumes per instrument type).
The config will later be used to deduct standard consumption from stock when
samples are run — but **this spec covers config only, not deduction**.

## Glossary

- **Substance**: Active ingredient parsed from a master item's `commonName`
  (e.g. `"ANILOFOS + BISPYRIBAC-SODIUM"` → `["ANILOFOS", "BISPYRIBAC-SODIUM"]`).
  See existing `parseSubstances()` in `PetitionAssignPage.tsx` / `MasterItems.tsx`.
- **Standard**: A calibration solution prepared for an instrument run.
- **Slot**: One concentration/volume in a multi-point calibration
  (e.g. 3 slots of `[10, 12, 15] ml`).
- **Instrument type**: `GC` or `HPLC` (the only two used today).
- **Override**: A rule that supplies a different config when the petition's
  `commonName` matches a pattern — e.g. when `commonName` contains `"ani"`,
  use 1 slot of 5 ml on GC instead of the base ANILOFOS config.

## Architecture

### Frontend

- New page: `src/pages/StandardConfig.tsx` mounted at `/standard-config`
  via `PrivateRoute` + `AppLayout`.
- Sidebar entry added to `src/lib/navItems.ts` (Master group, label
  `"Standard Config"`).
- Internal layout: shadcn `Tabs` — two tabs:
  - **Substances** — per-substance base config (auto-derived from master + manual rows)
  - **Overrides** — pattern-matched override rules
- Shared helper: extract `parseSubstances()` from its two current locations
  (`PetitionAssignPage.tsx`, `MasterItems.tsx`) to `src/lib/substances.ts`;
  both call sites import from there. Same algorithm ported to
  `server/utils/substances.js` for sync logic.

### Backend

- `server/models/StandardConfig.js` + `server/routes/standardConfigs.js`
- `server/models/StandardOverride.js` + `server/routes/standardOverrides.js`
- Register routes in `server/index.js`.

### Data layer

- `src/lib/api.ts` adds CRUD + sync calls for both collections.
- TanStack React Query keys: `['standard-configs']`, `['standard-overrides']`.
- Optimistic update on slot edits (with rollback on error); full refetch on
  add/delete/sync.

## Data Model

### `StandardConfig`

```js
{
  name: String,           // required, unique — e.g. "ABAMECTIN"
  nameLower: String,      // required, unique, indexed — lowercased+trimmed lookup key
  isManual: Boolean,      // default false; true = user-added (protected from sync deletion)
  gc: {
    enabled: Boolean,                       // default false
    unit: 'ml' | 'µL' | 'ppm' | 'mg',       // default 'ml'
    slots: [Number],                        // default []; values > 0
  },
  hplc: {
    enabled: Boolean,
    unit: 'ml' | 'µL' | 'ppm' | 'mg',
    slots: [Number],
  },
}
// timestamps: true
```

### `StandardOverride`

```js
{
  matchType: 'substring' | 'substance' | 'commonName',   // required
  matchValue: String,                                    // required, original casing
  matchValueLower: String,                               // required, indexed
  scope: 'substanceOnly' | 'wholeCommonName',            // default 'substanceOnly'
  note: String,                                          // default ''
  priority: Number,                                      // default 0 — higher wins
  gc: { enabled, unit, slots },                          // same shape as StandardConfig
  hplc: { enabled, unit, slots },
}
// timestamps: true
// compound unique index: { matchType: 1, matchValueLower: 1 }
```

### Lookup contract

```ts
function resolveStandardConfig(commonName: string, substanceIndex: number)
  : { name, gc, hplc, source: 'override' | 'base' | 'none' }
```

Resolution order (first match wins):

1. Parse `commonName` → `substances[]`; pick `substances[substanceIndex]`.
2. Query overrides ordered by `priority desc`:
   - `commonName` exact match (case-insensitive) → return
   - `substring` match in `commonName` → return
   - `substance` exact match against `substances[substanceIndex]` → return
3. Fallback to `StandardConfig` by substance name.
4. Otherwise → `source: 'none'`. UI shows "ยังไม่ตั้งค่า".

Notes:

- `nameLower` is stored separately to give a true unique index; Mongo's
  case-insensitive collation indexes have edge-case gotchas.
- `scope` exists so an override matched via `substance` can still cover the
  whole commonName when desired (e.g. for combo formulations).
- `stockItemId` is intentionally **not** modeled in Phase 1 — added in Phase 2
  when deduction logic is built.

## API

### `/api/standard-configs`

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | List all configs |
| `POST` | `/sync` | Derive from master items → upsert non-manual rows. **Does not delete stale rows.** Returns `{ added, updated }`. |
| `POST` | `/` | Create manual standard. Sets `isManual: true`. |
| `PUT` | `/:nameLower` | Update gc/hplc fields. `name` cannot be changed (rename = delete + create). |
| `DELETE` | `/:nameLower` | Allowed only when `isManual: true`. |

### `/api/standard-overrides`

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | List all overrides |
| `POST` | `/` | Create override rule |
| `PUT` | `/:id` | Update fields except `matchType` (immutable post-create) |
| `DELETE` | `/:id` | Delete override |

### Validation rules (server)

- `name` / `matchValue`: trimmed, non-empty, ≤ 200 chars.
- `slots`: array of finite numbers, each `> 0` and `≤ 10000`, max 20 items.
- `unit`: must be one of the enum values.
- `enabled: false` → slots/unit may be empty.
- `enabled: true` → `slots.length ≥ 1` required.
- Sync is idempotent (keyed by `nameLower`).
- Override compound unique index prevents identical rule duplicates.

### Permissions

- Module: `master` (same as MasterItems, SimpleMethod).
- Read: anyone with `master` read.
- Write (POST/PUT/DELETE/sync): `master` write.
- Frontend gates Add/Edit/Delete/Sync buttons via `usePermission('master')`.

### Error shape

- `400` validation: `{ message, field }`
- `404` not found: `{ message }`
- `409` duplicate: `{ message }`
- `500` server error: `{ message }`
- `502` upstream unavailable (sync only): `{ message: 'master items unavailable' }`

## UI — Substances Tab

```
┌─ Standard Config ─────────────────────────────────────────────┐
│  [ Substances ] [ Overrides ]                                 │
├───────────────────────────────────────────────────────────────┤
│  🔍 ค้นหา ...        [Sync จาก Master]  [+ เพิ่ม Standard]   │
│  Filter: [ ทั้งหมด ▾ ]  [ GC ] [ HPLC ] [ ยังไม่ตั้งค่า ]   │
├───────────────────────────────────────────────────────────────┤
│  Standard       Source    GC                  HPLC            │
│  ─────────────  ────────  ─────────────────   ─────────────── │
│  ABAMECTIN      master    ☑ 3 × [10,12,15] ml  ☐ —            │
│  ANILOFOS       master    ☑ 3 × [10,12,15] ml  ☐ —            │
│  BISPYRIBAC…    master    ☐ —                  ☑ 1 × [10] ml  │
│  XYZ            manual 🏷  ☑ 1 × [5] µL         ☐ —      [🗑] │
│  PROPANIL       master    ⚠ ยังไม่ตั้งค่า       ⚠              │
└───────────────────────────────────────────────────────────────┘
```

### Row structure

- **Standard column**: name + badge (`master` vs `manual`); delete button shown
  only for manual rows.
- **GC / HPLC columns**: each has an `enabled` checkbox; when enabled, a unit
  dropdown + chip-style slot editor appears. Disabled state shows `—`.
- **Warning state**: when a substance's simple-method declares the instrument
  but `enabled` is `false` (or `enabled: true` but `slots` empty), show
  `⚠ ยังไม่ตั้งค่า`.

### Slot editor

```
[ml ▾] [ 10 ✕ ] [ 12 ✕ ] [ 15 ✕ ] [ + ]
```

- Each chip is click-to-edit; ✕ removes the slot.
- `+` appends a new slot (up to 20).
- Auto-save on blur — no global Save button. Tiny inline spinner during the
  mutation; on error, toast + retain local value for retry.

### Sync UX

- Clicking **Sync จาก Master** opens a confirm dialog
  ("ดึง substance จาก master item ใหม่ N รายการ?").
- After success: toast `เพิ่ม X / อัพเดต Y`; newly-added rows briefly highlight
  pale green (~3 s).
- Sync derives `gc.enabled` / `hplc.enabled` from the row's simple-method entry
  (positional lookup against `parseSubstances(commonName)[i]`). Slots stay empty
  until the user fills them.
- **Stale rows are not removed** — a substance that disappears from master
  remains in the table. (Phase 2 may add a stale badge or cleanup button.)

### Add manual standard

- `+ เพิ่ม Standard` button opens a dialog with name + GC/HPLC configurators.
- On submit → POST → close dialog → toast + scroll to new row.

### Search & filter

- Search: case-insensitive substring on `name`, 200 ms debounce.
- Filter chips: `ทั้งหมด` / `GC enabled` / `HPLC enabled` / `ยังไม่ตั้งค่า`.
- State persists in URL query (`?q=...&filter=gc`) for bookmarking.

## UI — Overrides Tab

```
┌─ Standard Config ─────────────────────────────────────────────┐
│  [ Substances ] [ Overrides ]                                 │
├───────────────────────────────────────────────────────────────┤
│  🔍 ค้นหา rule ...              [+ เพิ่ม Override Rule]        │
├───────────────────────────────────────────────────────────────┤
│ Pri  Match              Scope        GC              HPLC  ⋯ │
│ ──── ─────────────────  ───────────  ──────────────  ──────  │
│  10  substring "ani"    substance    ☑ 1×[5] ml       ☐ —  🗑│
│   5  substance ANILOFOS whole        ☐ —              ☑ 1×[10] ml│
│   1  commonName "ANI…"  whole        ☑ 2×[8,10] ml    ☐ —    │
└───────────────────────────────────────────────────────────────┘
```

Rows sorted by `priority desc`; click to expand inline editor (same shape as
the add dialog).

### Add rule dialog

```
┌─ เพิ่ม Override Rule ───────────────────────────────┐
│ Match type:  ◉ Substring  ○ Substance  ○ CommonName│
│ Match value: [ _______________________ ]            │
│   ↳ Substring: free-text (case-insensitive)         │
│   ↳ Substance: dropdown from StandardConfig list    │
│   ↳ CommonName: dropdown from master items          │
│                                                     │
│ Scope: ◉ เฉพาะ substance ที่ match  ○ ทั้ง commonName│
│        (the "เฉพาะ substance" option is disabled    │
│         when match type = commonName)               │
│                                                     │
│ Priority: [ 10 ]  (higher = matched first)          │
│ Note:     [ _____________________________ ]         │
│                                                     │
│ GC config:   ☑ enabled  [ml ▾] [10][12][15][+]      │
│ HPLC config: ☐ enabled                              │
│                                                     │
│         [ ยกเลิก ]  [ บันทึก ]                      │
└─────────────────────────────────────────────────────┘
```

### Live preview

While the user fills `matchValue`, compute matches client-side against the
master-items list already in cache and show:

```
จะกระทบ commonName เหล่านี้ (3 รายการ):
 · ANILOFOS                       (substance #1)
 · ANILOFOS + BISPYRIBAC-SODIUM   (substance #1)
 · ANITHEM                        (substance #1)
```

If more than 50, show "5 รายการแรก ... และอีก 47". This guards against
unintended substring captures (e.g. `"ani"` matching `"ANIMAL"`).

### Edit / delete

- Inline expand on row click; same controls as the add dialog.
- 🗑 prompts a confirm dialog.
- `matchType` is **immutable** after creation — change requires delete + recreate.

### Conflict warning

When saving, if another rule has the same priority **and** an overlapping match,
show a non-blocking warning:

> "rule นี้ priority เท่ากับ 'substring ani' (id:xxx) — อาจ match ทับกัน,
> แนะนำให้ปรับ priority"

Overlap is computed best-effort client-side.

## Errors

### Frontend

- Network / 500 → toast `บันทึกไม่สำเร็จ — ลองอีกครั้ง`; keep local edit;
  show a retry button on the row.
- 400 → inline error under the field (uses `field` from response).
- 409 → dialog/inline error "ชื่อนี้มีอยู่แล้ว".
- Concurrent edit (rare): on mutation conflict, refetch + toast
  `มีการแก้ไขจากที่อื่น — โหลดใหม่แล้ว`.

### Backend

- Standard try/catch wrappers per route (match the style of `simpleMethods.js`).
- Sync endpoint returns 502 if master items query fails.

## Testing

### Unit (Vitest)

- `src/lib/substances.ts` — port existing tests from current call sites.
- `resolveStandardConfig()` — verify priority order: commonName > substring
  > substance > base > none.
- Override scope: `substanceOnly` vs `wholeCommonName`.
- Slot validation: rejects `0`, negatives, NaN, values `> 10000`, arrays > 20.

### Component (Vitest + Testing Library)

- Substances tab:
  - renders rows; filter `GC enabled` works
  - inline slot edit triggers mutation with correct payload
  - manual row shows delete; master row does not
  - sync button disabled without permission
- Overrides tab:
  - add dialog renders all three match types
  - live preview matches mocked master items
  - matchType field disabled in edit mode
  - conflict warning fires on same-priority overlap

### Manual / Playwright (optional smoke)

- Sync from master → row appears → set slots → reload → values persisted.
- Add override substring "ani" → preview shows expected matches → save → list
  refreshes; lookup returns override for matching commonName.

## Out of Scope (Phase 2+)

- Stock deduction logic — schema/contract is fixed here; deduction itself is
  deferred.
- Auto-sync on master save (server hook).
- Bulk CSV import/export.
- Audit log / version history.
- Per-machine-instance config (today's granularity is instrument type).
- Field-level permissions (today: anyone with `master` write edits the whole row).

## Open Questions / Risks

1. **Substring false-positives** — `"ani"` will match `"ANIMAL"` if such a
   commonName ever exists. Live preview reduces but does not eliminate this.
2. **Stale rows after master deletion** — Phase 1 keeps them; Phase 2 may add a
   stale badge or cleanup tool.
3. **Unit enum coverage** — `ml / µL / ppm / mg` is the current set. Extendable
   later by enum addition (backwards-compatible).

## Files Touched (preview, not exhaustive)

- `server/models/StandardConfig.js` (new)
- `server/models/StandardOverride.js` (new)
- `server/routes/standardConfigs.js` (new)
- `server/routes/standardOverrides.js` (new)
- `server/utils/substances.js` (new — server port of parseSubstances)
- `server/index.js` (register routes)
- `src/pages/StandardConfig.tsx` (new)
- `src/lib/substances.ts` (new — extract shared helper)
- `src/lib/api.ts` (add endpoints)
- `src/lib/navItems.ts` (add menu entry)
- `src/App.tsx` (add route)
- `src/pages/PetitionAssignPage.tsx` (refactor: import shared `parseSubstances`)
- `src/pages/MasterItems.tsx` (refactor: import shared `parseSubstances`)
- `src/lib/__tests__/substances.test.ts` (new)
- `src/lib/__tests__/resolveStandardConfig.test.ts` (new)
- `src/pages/__tests__/StandardConfig.test.tsx` (new)
