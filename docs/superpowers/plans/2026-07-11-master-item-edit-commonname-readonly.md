# Master Item Edit Commonname Read-Only Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a read-only commonname field when editing an existing Master Item.

**Architecture:** Keep the read-only value out of `MasterItemForm` and compute it directly from the existing `item` prop. Reuse the same `commonNameKeys` and `firstValue` helpers already used by the detail drawer, so the edit dialog and detail drawer resolve commonname consistently.

**Tech Stack:** React, TypeScript, TanStack Query, shadcn/ui inputs, Vitest, Testing Library.

## Global Constraints

- Do not run `npm run build`, `npm run build:dev`, `npm run build:watch`, `vite build`, or equivalent build commands.
- Do not add commonname to the metadata payload.
- Do not change the existing editable `ประเภท` selector behavior.
- Show the read-only field only for existing item edits, not for new item creation.

---

### Task 1: Master Item Edit Dialog Read-Only Commonname

**Files:**
- Modify: `src/pages/MasterItems.tsx`
- Modify: `src/pages/__tests__/MasterItems.interactions.test.tsx`

**Interfaces:**
- Consumes: `firstValue(item, commonNameKeys): unknown`, `displayValue(value): string`, and the existing `item: MasterItem | null` prop in `MasterItemDialog`.
- Produces: a disabled/read-only input with accessible label `commonname` when `isEdit` is true.

- [ ] **Step 1: Write the failing test**

Add this test to `src/pages/__tests__/MasterItems.interactions.test.tsx` inside `describe("MasterItems interactions", () => { ... })`:

```tsx
  it("shows commonname as read-only when editing an item", async () => {
    renderMasterItems();

    const row = (await screen.findByText("FG-001")).closest("tr");
    expect(row).not.toBeNull();

    fireEvent.doubleClick(row!);
    const editButton = await screen.findByLabelText("แก้ไข item จากแถบรายละเอียด");
    fireEvent.click(editButton);

    const commonNameInput = await screen.findByLabelText("commonname");
    expect(commonNameInput).toHaveValue("Cypermethrin");
    expect(commonNameInput).toBeDisabled();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/pages/__tests__/MasterItems.interactions.test.tsx -t "shows commonname as read-only when editing an item"
```

Expected: FAIL because no labeled `commonname` input exists in the edit dialog.

- [ ] **Step 3: Write minimal implementation**

In `src/pages/MasterItems.tsx`, inside `MasterItemDialog` after `const isEdit = !!item;`, add:

```tsx
  const readOnlyCommonName = item ? displayValue(firstValue(item, commonNameKeys)) : "";
```

Then insert this field in the form grid after the `ชื่อ Item` input and before the existing `ประเภท` selector:

```tsx
            {isEdit && (
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="commonname">commonname</Label>
                <Input
                  id="commonname"
                  value={readOnlyCommonName}
                  disabled
                  readOnly
                />
              </div>
            )}
```

- [ ] **Step 4: Run focused test to verify it passes**

Run:

```bash
npx vitest run src/pages/__tests__/MasterItems.interactions.test.tsx -t "shows commonname as read-only when editing an item"
```

Expected: PASS.

- [ ] **Step 5: Run broader validation**

Run:

```bash
npx vitest run src/pages/__tests__/MasterItems.interactions.test.tsx
npx tsc --noEmit
```

Expected: the MasterItems interaction test file passes and TypeScript reports no new errors from this change.

- [ ] **Step 6: Commit**

Stage only files changed for this task:

```bash
git add docs/superpowers/specs/2026-07-11-master-item-edit-commonname-readonly-design.md docs/superpowers/plans/2026-07-11-master-item-edit-commonname-readonly.md src/pages/MasterItems.tsx src/pages/__tests__/MasterItems.interactions.test.tsx
git commit -m "feat: show master item commonname on edit"
```
