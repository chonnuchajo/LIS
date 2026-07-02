# Master Item — group membership bubbles + group filter

**Date:** 2026-07-02
**Status:** Approved, pending implementation
**Scope:** `src/pages/MasterItems.tsx` only (frontend). No backend / schema / API changes.

## Problem

The Master Item table list gives no indication of which `ItemGroup`(s) an item
belongs to. Group membership is only visible after opening the detail dialog
(`MasterItems.tsx` — "กลุ่มที่สังกัด" badges). Users want to see, at a glance in
the list, which group each item is in ("bubble") and to filter the list by group.

Note: "batch" in the original request meant *grouping badges*, not the
production-lot `batchNo` concept used on `Sample`.

## What already exists (reuse, do not rebuild)

- `itemGroups` query in the `MasterItems` component (`useQuery(["item-groups"])`).
- `groupIdsFor(itemNo)` → `groupMembership.get(itemNo) ?? []`, backed by
  `useItemGroupMembership()` (Map<itemNo, groupId[]>, resolved from the raw
  slim catalog — the single source of truth also used by testing flows).
- `pagedItems.map` already destructures `originalItemNo` per row.
- Detail dialog already renders member-group badges (`variant="secondary"`).

All data needed is already loaded in the component; this is purely presentational
plus one filter predicate.

## Design

### 1. Group bubbles in the table

- Build `groupNameById: Map<string, string>` from `itemGroups` (memoized).
- In the **"ชื่อ Item"** cell (`TableCell` at ~`MasterItems.tsx:933`), render the
  item name, then below it a wrapping row of small badges — one per group in
  `groupIdsFor(originalItemNo)`, labelled via `groupNameById`.
- Style: `Badge variant="secondary"`, compact (`text-[10px]`, tight padding),
  `flex flex-wrap gap-1 mt-1`. Matches the detail-dialog badges.
- If the item is in no group, render nothing extra (just the name).
- Unknown group IDs (stale membership) are skipped, not shown as blanks.

### 2. Group filter dropdown

- New state `groupFilter` (default `"all"`).
- New `Select` placed next to the existing category `Select` in the CardHeader.
- Options:
  - `"all"` → "ทุกกลุ่ม" (default)
  - one option per group, `value = group._id`, label = `group.name`, ordered by
    `sortOrder` then `name`
  - `"__none__"` → "ไม่อยู่ในกลุ่มใด" (items with empty membership — helps find
    ungrouped items)
- Filtering in the existing `filteredItems` useMemo, add a `matchesGroup` clause:
  - `"all"` → always true
  - `"__none__"` → `groupIdsFor(originalItemNo).length === 0`
  - otherwise → `groupIdsFor(originalItemNo).includes(groupFilter)`
  - add `groupMembership` (and `itemGroups`/`groupFilter`) to the useMemo deps.
- Add `groupFilter` to the page-reset `useEffect` deps so switching filter resets
  to page 1 (consistent with `search`/`categoryFilter`/`pageSize`).

## Out of scope (YAGNI)

- No change to the detail dialog (already shows member groups).
- No per-group color (would need an `ItemGroup.color` schema field).
- No multi-select group filter (single-select is enough).
- No backend/API/model changes.

## Testing / verification

- `npx tsc -p tsconfig.app.json --noEmit` clean (real type-check per repo note;
  root `tsc --noEmit` is a no-op).
- `npm run lint`.
- Manual: run dev, open Master Item — confirm badges appear under names for
  grouped items, "ทุกกลุ่ม"/specific group/"ไม่อยู่ในกลุ่มใด" filter each narrow
  the list correctly, and paging resets on filter change.
