# Simple Method Picker Popover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the always-expanded per-substance method pill row (and the bulk-add toolbar's per-method buttons) in the Simple Method tab with compact Popover + checkbox pickers that scale as the method registry grows.

**Architecture:** Add one presentational subcomponent `MethodSlotPicker` in `src/pages/MasterItems.tsx` used per substance slot, and a `BulkAddMethodPicker` popover in the floating toolbar. Both reuse existing data helpers (`toggleMethod`, `setSlotMethods`, `applyBulkAdd`) and existing handlers — no data-logic changes. Selection state, positional alignment, and save flow are untouched.

**Tech Stack:** React 18 + TypeScript, shadcn/ui (`Popover`, `Checkbox`, `Badge`, `Button`), lucide-react icons, Vitest for existing logic tests.

---

### Task 1: Add `MethodSlotPicker` subcomponent

**Files:**
- Modify: `src/pages/MasterItems.tsx` (add `ChevronDown` to the `lucide-react` import at lines 3–15; add the new component just above `function SimpleMethodTab(` near line 1180)

This is a presentational component with no new branching logic to unit-test (the toggle logic lives in the already-tested `toggleMethod`). Verification is type-check + manual. No test file is added for it.

- [ ] **Step 1: Add `ChevronDown` to the lucide-react import**

In the import block at the top (currently lines 3–15), add `ChevronDown`. Result:

```tsx
import {
  AlertCircle,
  ChevronDown,
  Database,
  FlaskConical,
  PackageSearch,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Wrench,
  Download,
} from "lucide-react";
```

- [ ] **Step 2: Add the `MethodSlotPicker` component**

Insert this immediately before `function SimpleMethodTab({` (currently line 1180):

```tsx
// Compact per-slot method picker: a trigger showing the selected method labels as
// badges (or a muted placeholder), opening a popover of checkboxes for every active
// method. Selection logic stays in `toggleMethod`; this is presentational only.
function MethodSlotPicker({
  methods,
  selected,
  onChange,
}: {
  methods: MethodDoc[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const selectedLabels = methods.filter((m) => selected.includes(m.code));
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 min-w-24 justify-between gap-1.5 px-2.5"
        >
          {selectedLabels.length > 0 ? (
            <span className="flex flex-wrap items-center gap-1">
              {selectedLabels.map((m) => (
                <Badge key={m.code} variant="secondary" className="rounded-full px-2 py-0 text-xs font-normal">
                  {m.label}
                </Badge>
              ))}
            </span>
          ) : (
            <span className="text-muted-foreground">เลือก</span>
          )}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 p-1.5">
        {methods.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">ยังไม่มี method</div>
        ) : (
          <div className="flex flex-col">
            {methods.map((m) => {
              const checked = selected.includes(m.code);
              return (
                <button
                  key={m.code}
                  type="button"
                  className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                  onClick={() => onChange(toggleMethod(selected, m.code))}
                >
                  <Checkbox checked={checked} className="pointer-events-none" tabIndex={-1} />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (`MethodSlotPicker` is defined but not yet used — TypeScript does not error on an unused local function, so this passes.)

- [ ] **Step 4: Commit**

```bash
git add src/pages/MasterItems.tsx
git commit -m "feat(simple-method): add MethodSlotPicker popover component"
```

---

### Task 2: Use `MethodSlotPicker` in the per-substance rows

**Files:**
- Modify: `src/pages/MasterItems.tsx` (the inline pill block inside `SimpleMethodTab`, currently lines ~1360–1381)

- [ ] **Step 1: Replace the inline pill block**

Find this block inside the `row.substances.map` (currently lines ~1360–1381):

```tsx
                                  <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
                                    {activeMethods.map((m) => {
                                      const active = current.includes(m.code);
                                      return (
                                        <Button
                                          key={m.code}
                                          type="button"
                                          size="sm"
                                          variant={active ? "default" : "outline"}
                                          className="h-7 rounded-full px-3"
                                          onClick={() =>
                                            onDraftChange(
                                              row.key,
                                              setSlotMethods(draftValue, index, toggleMethod(current, m.code)),
                                            )
                                          }
                                        >
                                          {m.label}
                                        </Button>
                                      );
                                    })}
                                  </div>
```

Replace it with:

```tsx
                                  <div className="ml-auto flex items-center justify-end">
                                    <MethodSlotPicker
                                      methods={activeMethods}
                                      selected={current}
                                      onChange={(next) =>
                                        onDraftChange(row.key, setSlotMethods(draftValue, index, next))
                                      }
                                    />
                                  </div>
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run existing tests (no regression)**

Run: `npm run test`
Expected: PASS — `src/pages/__tests__/buildSimpleMethodRows.test.ts` and all other suites green. No logic changed.

- [ ] **Step 4: Manual verification**

Start backend (`cd server && npm run dev`) and frontend (`npm run dev`), open the Simple Method tab. Confirm:
- A single-substance row shows one compact picker; clicking it opens the checkbox popover.
- Selecting a method adds its badge to the trigger; the cell border turns primary (dirty).
- Unchecking removes the badge.
- A multi-substance row shows one picker per substance, each independent.
- `บันทึก` persists; after reload, selections survive in the right slots (positional).

- [ ] **Step 5: Commit**

```bash
git add src/pages/MasterItems.tsx
git commit -m "feat(simple-method): use popover picker for per-substance methods"
```

---

### Task 3: Add `BulkAddMethodPicker` and wire it into the toolbar

**Files:**
- Modify: `src/pages/MasterItems.tsx` (add `BulkAddMethodPicker` near `MethodSlotPicker`; replace the toolbar's per-method buttons at lines ~1122–1135)

- [ ] **Step 1: Add the `BulkAddMethodPicker` component**

Insert immediately after the `MethodSlotPicker` component (from Task 1):

```tsx
// Floating-toolbar bulk picker: a single "เพิ่ม method ▾" trigger opening a popover
// that lists each active method. Clicking a method calls `onAdd(code)` and leaves the
// popover open so several can be added in a row.
function BulkAddMethodPicker({
  methods,
  disabled,
  onAdd,
}: {
  methods: MethodDoc[];
  disabled: boolean;
  onAdd: (code: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 rounded-full px-3"
          disabled={disabled}
        >
          เพิ่ม method
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-44 p-1.5">
        {methods.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">ยังไม่มี method</div>
        ) : (
          <div className="flex flex-col">
            {methods.map((m) => (
              <button
                key={m.code}
                type="button"
                className="rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                onClick={() => onAdd(m.code)}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Replace the toolbar's per-method buttons**

Find this block in the floating toolbar (currently lines ~1122–1135):

```tsx
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">เพิ่มทุกสาร:</span>
                {activeMethods.map((m) => (
                  <Button
                    key={m.code}
                    size="sm"
                    variant="outline"
                    className="h-7 rounded-full px-3"
                    disabled={selectedKeys.size === 0}
                    onClick={() => applyBulkAdd(m.code)}
                  >
                    {m.label}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 rounded-full px-3 text-muted-foreground"
                  disabled={selectedKeys.size === 0}
                  onClick={applyBulkClear}
                >
                  ล้าง
                </Button>
              </div>
```

Replace it with:

```tsx
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">เพิ่มทุกสาร:</span>
                <BulkAddMethodPicker
                  methods={activeMethods}
                  disabled={selectedKeys.size === 0}
                  onAdd={applyBulkAdd}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 rounded-full px-3 text-muted-foreground"
                  disabled={selectedKeys.size === 0}
                  onClick={applyBulkClear}
                >
                  ล้าง
                </Button>
              </div>
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run existing tests (no regression)**

Run: `npm run test`
Expected: PASS — all suites green.

- [ ] **Step 5: Manual verification**

On the Simple Method tab with at least one row selected:
- The toolbar shows a single `เพิ่ม method ▾` button (disabled when nothing selected).
- Opening it lists every active method; clicking one adds that method to every selected row's slots (badges appear).
- The popover stays open so a second method can be added.
- `ล้าง` clears, `บันทึก` saves.

- [ ] **Step 6: Commit**

```bash
git add src/pages/MasterItems.tsx
git commit -m "feat(simple-method): collapse bulk-add toolbar into popover picker"
```

---

## Self-Review Notes

- **Spec coverage:** `MethodSlotPicker` (spec §Design/New subcomponent) → Task 1+2; bulk-add popover (spec §Bulk-add toolbar) → Task 3; `ChevronDown` import → Task 1 Step 1; no-search, no-✕, single-button-trigger decisions all honored.
- **No data-logic change:** only `activeMethods.map(Button)` blocks are replaced; `toggleMethod`, `setSlotMethods`, `applyBulkAdd`, `applyBulkClear`, save flow untouched — matches spec non-goals.
- **Type consistency:** `MethodDoc` props `code`/`label` match `src/lib/methodRegistry.ts`; `onChange(next: string[])` feeds `setSlotMethods(draftValue, index, next)`; `onAdd(code)` matches existing `applyBulkAdd(code: string)`.
- **Commit hygiene:** each commit stages only `src/pages/MasterItems.tsx` by explicit pathspec (a concurrent committer may touch `develop`).
