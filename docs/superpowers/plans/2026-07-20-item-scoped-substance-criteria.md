# Item-Scoped Substance Criteria Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make per-substance parameter criteria distinguish same-name substances by master item code and package size, expose raw master item context, insert new parameter fields at the top, and confirm unsaved dialog closes.

**Architecture:** Extend the existing `SubstanceStandard` model with optional master item context while preserving legacy substance-only rules. Keep the logic in the existing Parameter Settings helpers and dialogs, with focused UI additions and no backend migration.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, TanStack Query, shadcn/Radix dialog components.

## Global Constraints

- Do not run build commands on this machine.
- Use focused Vitest tests and static inspection; `npx tsc --noEmit` is allowed if needed.
- Existing `substanceStandards` entries without master item fields must remain valid.
- No unrelated refactors or production root file rewrites.

---

## File Structure

- `src/lib/api.ts`: extend the `SubstanceStandard` type with optional item context fields.
- `src/lib/parameterCriteriaRows.ts`: include item context in row data, search text, and row identity.
- `src/lib/parameterCriteriaRows.test.ts`: add helper-level tests for item-scoped rows.
- `src/components/lis/ParameterCriteriaTabs.tsx`: render item code, package size, and raw master context on the substance tab.
- `src/components/lis/SubstanceStandardsDialog.tsx`: create item-scoped rules from master rows, dedupe by `substance + itemNo + packSize`, and show master context in selected rows.
- `src/components/lis/SubstanceStandardsDialog.test.tsx`: add dialog tests for same-substance different item/pack selection and dedupe.
- `src/pages/ParameterSettings.tsx`: insert new value fields at the top and add dirty-close confirmation in `ParameterDialog`.
- `src/pages/__tests__/ParameterSettings.criteria-tabs.test.tsx`: add criteria tab and dialog tests where existing mocks already cover the page shell.

---

### Task 1: Type And Row Helpers

**Files:**
- Modify: `src/lib/api.ts`
- Modify: `src/lib/parameterCriteriaRows.ts`
- Test: `src/lib/parameterCriteriaRows.test.ts`

**Interfaces:**
- Produces: `SubstanceStandard.itemNo?: string`, `packSize?: string`, `masterItemName?: string`, `masterCommonName?: string`, `masterRaw?: Record<string, unknown>`
- Produces: `SubstanceCriteriaRow.itemNo`, `packSize`, `masterItemName`, `masterCommonName`, `rawMasterText`

- [ ] **Step 1: Write the failing test**

Add to `src/lib/parameterCriteriaRows.test.ts`:

```ts
it("keeps same-substance criteria separate by master item and package size", () => {
  const rows = buildSubstanceCriteriaRows(
    [
      {
        _id: "p-item",
        name: "Active ingredient",
        scope: "qc",
        status: "active",
        applyAll: true,
        valueFields: [
          {
            label: "Purity",
            type: "number",
            unit: "%",
            substanceMode: true,
            substanceStandards: [
              {
                substance: "ABAMECTIN",
                operator: "gte",
                value: 95,
                itemNo: "RM-001",
                packSize: "100 ml",
                masterItemName: "ABAMECTIN A",
                masterCommonName: "ABAMECTIN 1.8 EC",
                masterRaw: { item_no: "RM-001", desc2: "100 ml" },
              },
              {
                substance: "ABAMECTIN",
                operator: "gte",
                value: 97,
                itemNo: "RM-002",
                packSize: "500 ml",
                masterItemName: "ABAMECTIN B",
                masterCommonName: "ABAMECTIN 1.8 EC",
                masterRaw: { item_no: "RM-002", desc2: "500 ml" },
              },
            ],
          },
        ],
      },
    ],
    "qc",
  );

  expect(rows).toHaveLength(2);
  expect(rows[0]).toMatchObject({
    rowId: "p-item:0:0:RM-001:100 ml",
    substance: "ABAMECTIN",
    itemNo: "RM-001",
    packSize: "100 ml",
    masterItemName: "ABAMECTIN A",
    masterCommonName: "ABAMECTIN 1.8 EC",
    rawMasterText: "item_no: RM-001 | desc2: 100 ml",
  });
  expect(rows[1]).toMatchObject({
    rowId: "p-item:0:1:RM-002:500 ml",
    value: 97,
    itemNo: "RM-002",
    packSize: "500 ml",
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/parameterCriteriaRows.test.ts`
Expected: FAIL because `itemNo`, `packSize`, and `rawMasterText` are missing from `SubstanceCriteriaRow`.

- [ ] **Step 3: Write minimal implementation**

Update `SubstanceStandard` in `src/lib/api.ts` with the optional fields. In `src/lib/parameterCriteriaRows.ts`, add those fields to `SubstanceCriteriaRow`, create a `rawMasterText` helper that joins the first 8 primitive `masterRaw` entries as `key: value`, append item context to `rowId`, and include item context in `searchText`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/parameterCriteriaRows.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/lib/api.ts src/lib/parameterCriteriaRows.ts src/lib/parameterCriteriaRows.test.ts
git commit -m "feat: add item-scoped substance criteria rows"
```

---

### Task 2: Criteria Tab Display

**Files:**
- Modify: `src/components/lis/ParameterCriteriaTabs.tsx`
- Test: `src/pages/__tests__/ParameterSettings.criteria-tabs.test.tsx`

**Interfaces:**
- Consumes: `SubstanceCriteriaRow.itemNo`, `packSize`, `masterItemName`, `masterCommonName`, `rawMasterText`
- Produces: visible substance table context for item code/package/raw master data.

- [ ] **Step 1: Write the failing test**

Add a `ParameterSettings.criteria-tabs` test that supplies a parameter with one item-scoped rule, opens the substance tab, asserts that `RM-001`, `100 ml`, `ABAMECTIN A`, and `item_no: RM-001` are visible, then searches for `RM-001` and verifies the row remains visible.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/__tests__/ParameterSettings.criteria-tabs.test.tsx`
Expected: FAIL because the substance tab does not render item context columns.

- [ ] **Step 3: Write minimal implementation**

In `ParameterCriteriaTabs`, add columns after `สาร`:

```tsx
<TableHead>รหัสสินค้า</TableHead>
<TableHead>ขนาดบรรจุ</TableHead>
<TableHead>Master item</TableHead>
```

Render `row.itemNo || "-"`, `row.packSize || "-"`, and a compact cell containing `row.masterItemName`, `row.masterCommonName`, and `row.rawMasterText`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/pages/__tests__/ParameterSettings.criteria-tabs.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/components/lis/ParameterCriteriaTabs.tsx src/pages/__tests__/ParameterSettings.criteria-tabs.test.tsx
git commit -m "feat: show master item context in substance criteria"
```

---

### Task 3: Substance Picker Item-Scoped Rules

**Files:**
- Modify: `src/components/lis/SubstanceStandardsDialog.tsx`
- Test: `src/components/lis/SubstanceStandardsDialog.test.tsx`

**Interfaces:**
- Consumes: `getItemNo`, `getSampleName`, `getRawCommonName`, `getPackSize`, `getTradeName` from `src/lib/masterItemFields.ts`
- Produces: `SubstanceStandard` entries populated with `itemNo`, `packSize`, `masterItemName`, `masterCommonName`, and `masterRaw`.

- [ ] **Step 1: Write the failing tests**

Add tests that mock two master rows with the same `common_name` but different item codes/package sizes. Click both options and save; expect two standards with the same substance and different `itemNo`/`packSize`. Add another test that clicks the same row twice or re-renders with an existing same key and verifies it is not duplicated.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/lis/SubstanceStandardsDialog.test.tsx`
Expected: FAIL because the dialog dedupes by substance name only and does not populate master item fields.

- [ ] **Step 3: Write minimal implementation**

Replace common-name-only option objects with master-row option objects. Build a key using `standardKey(substance)`, `standardKey(itemNo)`, and `standardKey(packSize)`. `addStandardFromRow(row)` should create:

```ts
{
  substance: pickField(row, COMMON_NAME_KEYS),
  operator: "gte",
  value: null,
  value2: null,
  itemNo: getItemNo(row),
  packSize: getPackSize(row),
  masterItemName: getSampleName(row) || getTradeName(row),
  masterCommonName: pickField(row, COMMON_NAME_KEYS),
  masterRaw: row,
}
```

Show item code/package/name under each picker option and selected row.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/lis/SubstanceStandardsDialog.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/components/lis/SubstanceStandardsDialog.tsx src/components/lis/SubstanceStandardsDialog.test.tsx
git commit -m "feat: select substance criteria per master item"
```

---

### Task 4: Parameter Dialog Field Insertion And Dirty Close

**Files:**
- Modify: `src/pages/ParameterSettings.tsx`
- Test: `src/pages/__tests__/ParameterSettings.criteria-tabs.test.tsx`

**Interfaces:**
- Produces: `addField()` inserts `emptyValueField()` at index `0`.
- Produces: dirty-close confirmation actions: save, discard, and return to edit.

- [ ] **Step 1: Write failing tests**

Add tests that open the create parameter dialog, add an existing field, type a label into it, click add field again, and assert the blank field is rendered before the older labeled field. Add dirty-close tests that change the parameter name, click cancel, assert the confirmation dialog appears, then cover "กลับไปแก้ไข" keeps the dialog open and "ไม่บันทึก" closes without `api.createParameter`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/__tests__/ParameterSettings.criteria-tabs.test.tsx`
Expected: FAIL because fields append to the bottom and cancel closes immediately.

- [ ] **Step 3: Write minimal implementation**

In `ParameterDialog`, add `baselineRef`, `pendingCloseConfirm`, and `isDirty` based on a stable JSON string of `form` and `aiPrompt`. Change `addField` to:

```ts
set("valueFields", [emptyValueField(), ...(form.valueFields ?? [])]);
```

Route dialog close and cancel through `requestClose()`. If dirty, open a nested confirmation dialog; otherwise call `onClose()`. Implement discard by closing confirm and calling `onClose()`. Implement save by calling the same submit helper used by form submit.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/pages/__tests__/ParameterSettings.criteria-tabs.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/pages/ParameterSettings.tsx src/pages/__tests__/ParameterSettings.criteria-tabs.test.tsx
git commit -m "feat: protect parameter dialog edits"
```

---

### Task 5: Focused Verification

**Files:**
- No production changes expected.

**Interfaces:**
- Consumes all earlier tasks.
- Produces verification evidence.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npx vitest run src/lib/parameterCriteriaRows.test.ts src/components/lis/SubstanceStandardsDialog.test.tsx src/pages/__tests__/ParameterSettings.criteria-tabs.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run static type check if focused tests reveal no blocker**

Run: `npx tsc --noEmit`
Expected: exit 0. Do not run `npm run build`, `vite build`, or equivalent build commands.

- [ ] **Step 3: Inspect git status**

Run: `git status --short`
Expected: only intentional files are modified or the worktree is clean after commits.

