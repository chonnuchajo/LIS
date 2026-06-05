# Simple Method — Method Picker Popover

**Date:** 2026-06-05
**Status:** Approved (pending spec review)
**Area:** `src/pages/MasterItems.tsx` (Simple Method tab)

## Problem

The Simple Method tab lets you assign a positional **AND-set of method codes** to each
substance slot of a row. Today every active method is rendered as an inline pill button
per substance, and you toggle each on/off:

```
Ethanol   [GC] [HPLC] [Titration] [Digest] [Reflux]
```

The method registry has grown from 2 (GC/HPLC) to 5 (GC, HPLC, Titration, Digest,
Reflux) and will keep growing. Rendering every method inline overflows the row, wastes
horizontal space, and breaks on small screens — confirmed as the main pain point.

The same overflow affects the floating **bulk-add toolbar** at the bottom, which also
maps every active method to a button.

## Goal

Replace the always-expanded pill row with a **compact Popover + checkbox** picker that
shows only the selected methods, scaling cleanly as methods grow. Keep all data logic
(positional alignment, AND-sets, save) untouched — this is a presentational change.

## Non-goals

- No change to `buildSimpleMethodRows`, `readSlotMethods`, the method registry, save
  flow, or positional alignment with `parseSubstances`.
- No change to the helper functions `toggleMethod` / `setSlotMethods` / `assignmentsEqual`.
- No search box in the popover (5 methods; revisit if it grows past ~10).

## Design

### New subcomponent: `MethodSlotPicker`

A presentational component local to `MasterItems.tsx`, used per substance slot.

**Props**
```ts
{
  methods: MethodDoc[];          // active methods, in registry order
  selected: string[];            // current AND-set for this slot
  onChange: (next: string[]) => void;
}
```

**Trigger** — a compact `Button` (variant `outline`, `size="sm"`):
- When `selected.length > 0`: render the selected method labels as small inline
  `Badge`s (secondary, rounded-full, read-only — **no ✕**), followed by a `ChevronDown`
  icon.
- When empty: muted placeholder text `เลือก` + `ChevronDown`.
- The whole button opens the popover. No nested buttons (avoids invalid HTML / click
  conflicts) — removal happens inside the popover.

**PopoverContent** (~`w-44`, `align="end"`):
- A vertical list, one row per active method: a `Checkbox` + the method `label`.
  - `checked = selected.includes(m.code)`
  - `onCheckedChange` → `onChange(toggleMethod(selected, m.code))`
  - Whole row is clickable (label + checkbox toggle together).
- If `methods.length === 0`: muted text `ยังไม่มี method`.

### Wiring in `SimpleMethodTab` (replaces lines ~1360–1381)

Inside the per-substance `.map`, replace the inline `activeMethods.map(... Button ...)`
block with:

```tsx
<MethodSlotPicker
  methods={activeMethods}
  selected={current}
  onChange={(next) =>
    onDraftChange(row.key, setSlotMethods(draftValue, index, next))
  }
/>
```

Everything around it is unchanged:
- dirty border (`border-primary`) on the wrapping cell,
- single-substance `ml-auto w-fit`, multi-substance shows the substance name before the picker,
- `isDirty` / `assignmentsEqual` logic.

### Bulk-add toolbar (bottom floating bar, lines ~1122–1145)

Replace the inline per-method buttons (`activeMethods.map`) with a single
**`เพิ่ม method ▾`** `Button` that opens a `Popover`. The popover lists each active
method as a clickable row; clicking a method calls `applyBulkAdd(m.code)` (existing
handler, unchanged) and can leave the popover open for multiple adds. Keep the existing
`เลือก N รายการ` count, the `ล้าง` button, and the `บันทึก` button as-is. The bar
stays disabled-aware (`selectedKeys.size === 0`).

### Imports

Add `ChevronDown` to the existing `lucide-react` import. `Popover`, `PopoverContent`,
`PopoverTrigger`, `Checkbox`, `Badge`, `Button` are already imported.

## Testing / Verification

- `npx tsc --noEmit` — type-check.
- `npm run test` — existing Vitest (`buildSimpleMethodRows.test.ts`) must still pass;
  no logic changed, so it should be green untouched.
- Manual / Playwright check on the Simple Method tab:
  - single-substance row: pick/unpick a method, badge updates, dirty border shows, save persists.
  - multi-substance row: each slot independent, positional alignment preserved after reload.
  - empty selection shows `เลือก`; popover with no active methods shows the empty note.
  - bulk-add popover adds a method to all selected rows; `ล้าง` and `บันทึก` still work.

## Risks

- **Click handling**: keeping the trigger a single button (no ✕ on badges) avoids
  button-in-button and stopPropagation pitfalls.
- **Popover inside scrollable table**: the table body scrolls; Radix Popover portals to
  body by default, so it won't be clipped. Verify positioning on a scrolled row.
