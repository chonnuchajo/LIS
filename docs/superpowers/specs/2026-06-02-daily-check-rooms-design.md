# Daily Check — 5-Page Room Structure (Hub + Rooms)

**Date:** 2026-06-02
**Status:** Approved — ready for implementation plan
**Scope:** Frontend only. No backend / data-model changes.

## Summary

Expand the single `/daily-check` page into a hub-and-rooms structure of **5 pages**:
one summary hub plus four room pages, one per folder under `Forms/`. This change is
**structure only** ("โครงก่อน เนื้อไว้ทีหลัง") — three of the four rooms are
placeholders; only the existing balance-calibration content is moved into its room.

## Decisions (from brainstorming)

1. **5 pages** = 1 summary hub + 4 rooms (one per `Forms/` folder).
2. **Separate route per room** under `/daily-check`, with an in-page tab strip acting
   as the "submenu" (chosen over sidebar nesting / flat nav entries).
3. **Scaffold first** — forms are digitized later; rooms other than balance are placeholders.
4. The existing **balance calibration** content moves into the `ห้องเครื่องชั่ง` room page.

## Room → Folder mapping

| Room (Thai)        | Folder under `Forms/`   | Slug / route                 | Content now            |
|--------------------|-------------------------|------------------------------|------------------------|
| ห้องเครื่องชั่ง       | `ห้องเครื่องชั่ง`          | `/daily-check/balance`       | existing calibration   |
| ห้องเตรียมตัวอย่าง    | `ห้องเตรียมตัวอย่าง`       | `/daily-check/sample-prep`   | placeholder            |
| ห้องวิเคราะห์         | `ห้องวิเคราะห์`           | `/daily-check/analysis`      | placeholder            |
| ห้องสกัด            | `ห้องสกัด`               | `/daily-check/extraction`    | placeholder            |

Each room maps to a set of forms (equipment-usage logs + one temperature/humidity log).
The placeholder pages list these form names as a faint "coming soon" preview — metadata
only, not digitized forms. Form lists are derived from the `Forms/` folders (see Appendix).

## Architecture

### Routing (nested)

```
/daily-check                 → DailyCheckLayout (shared shell) with <Outlet/>
  index                      → DailyCheckSummary    (hub)
  /balance                   → BalanceRoomPage       (moved calibration)
  /sample-prep               → RoomPlaceholderPage   (slug=sample-prep)
  /analysis                  → RoomPlaceholderPage   (slug=analysis)
  /extraction                → RoomPlaceholderPage   (slug=extraction)
```

`PrivateRoute` wraps the parent `/daily-check` route. Child pathnames
(`/daily-check/balance`, etc.) are authorized by riding along with the `/daily-check`
permission (see Access Control).

### File structure

```
src/lib/dailyCheckRooms.ts          ← single source of truth: room id, slug, route,
                                       Thai label, icon, form-name list
src/pages/daily-check/
  ├─ DailyCheckLayout.tsx           ← AppLayout + PageHeader("Daily Check")
  │                                    + room tab strip + <Outlet/>
  ├─ DailyCheckSummary.tsx          ← hub: one card per room (links into the room)
  ├─ BalanceRoomPage.tsx            ← existing calibration UI (record + history tabs),
  │                                    moved out of the old DailyCheck.tsx
  └─ RoomPlaceholderPage.tsx        ← generic; reads room from config by slug,
                                       shows "อยู่ระหว่างพัฒนา" + faint form-name list
```

- **Delete** `src/pages/DailyCheck.tsx`; its calibration logic moves verbatim into
  `BalanceRoomPage.tsx` (minus the `AppLayout`/`PageHeader` wrapper, which the shared
  layout now owns). The room page keeps its inner `บันทึกผล` / `รายการบันทึก` tabs.
- The three non-balance rooms share `RoomPlaceholderPage` — no duplicated page code.

### Room tab strip (the "submenu")

- Lives in `DailyCheckLayout`, rendered on every `/daily-check*` page.
- Five entries: `สรุป | ห้องเครื่องชั่ง | ห้องเตรียมตัวอย่าง | ห้องวิเคราะห์ | ห้องสกัด`.
- Clicking navigates to the route; the active item is derived from the current route
  (use `NavLink`/`useLocation`).
- The sidebar keeps a single **"Daily Check"** entry — no nesting, no clutter.

### Access control

Add to `IMPLIED_CHILD_PATHS` in `src/lib/accessControl.ts`:

```js
"/daily-check": [
  "/daily-check/balance",
  "/daily-check/sample-prep",
  "/daily-check/analysis",
  "/daily-check/extraction",
],
```

Because the room routes are **not** in `NAV_ITEMS`, `isOwnNavPage()` returns false for
them, so they are auto-granted to anyone holding `/daily-check`. No new groups/permissions.

### Not touched

- **Backend** — no route, model, or schema change. Balance calibration keeps using the
  existing `DailyCheck` model and `/daily-checks` API.
- **`DailyCheckReminderWatcher`** — keeps watching balance calibration as before.

## Data flow

Unchanged from today for balance calibration: React Query → `api.getDailyChecks` /
`api.createDailyCheck` → `DailyCheck` collection. Placeholder rooms have no data flow yet.

## Error handling

- Unknown room slug under `/daily-check/*` → `RoomPlaceholderPage` should treat a
  missing config entry as a not-found state (render the existing 404/NotFound, or a
  "ไม่พบห้อง" message). The configured four slugs are the only valid ones.
- Existing calibration validation/toasts (6-value check, user-name check, tolerance
  evaluation) move unchanged into `BalanceRoomPage`.

## Testing

- Extend `src/lib/accessControl.test.ts`: a user granted `/daily-check` can access
  `/daily-check/balance`, `/sample-prep`, `/analysis`, `/extraction`; a user without it
  cannot. Confirm the room paths are not independently grantable as own nav pages.
- Add `src/lib/dailyCheckRooms.test.ts`: every room has a unique slug and a route of the
  form `/daily-check/<slug>`; four rooms present; labels non-empty.
- (Optional) smoke render test for `DailyCheckLayout` tab strip marking the active route.

## Appendix — forms per room (for placeholder lists)

Derived from `Forms/` on 2026-06-02. Names only; not digitized.

- **ห้องเครื่องชั่ง:** อุณหภูมิ/ความชื้น (ห้องชั่งสาร); Dry cabinet; เครื่องชั่ง 2/4/5 ตำแหน่ง; Hood.
- **ห้องเตรียมตัวอย่าง:** อุณหภูมิ/ความชื้น; Ultrasonic (Cleaner); Asirator pump; Desiccator;
  Hotplate; Magnetic stirrer; Oven; pH Meter; Water bath; milli-Q; Hood; Density.
- **ห้องวิเคราะห์:** อุณหภูมิ/ความชื้น (ห้องวิเคราะห์); GC 7890A / 8850 / 8890;
  HPLC 1260 Infinity III / Agilent 1260.
- **ห้องสกัด:** Asirator pump; Cooling; Desiccator; Heating mantle; Magnetic stirrer.
