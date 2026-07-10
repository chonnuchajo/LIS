# Parameter Criteria Substance Sort Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the `/LIS/parameter-settings` `แยกตามสาร` criteria tab so it defaults to substance A-Z sorting and offers substance Z-A plus min/max value sorting in both directions.

**Architecture:** Keep the change localized to `ParameterCriteriaTabs.tsx` and its tests. Make sort options tab-aware, resolve an effective sort key per active tab, and extend the existing comparator helpers to sort substance rows by `substance`, `value`, and `value2`.

**Tech Stack:** React 18, TypeScript, shadcn `NativeSelect`, Vitest, Testing Library.

## Global Constraints

- Change only the criteria tabs UI and related tests.
- Keep parameter storage, API payloads, row-builder output, and abnormal calculation behavior unchanged.
- Do not touch generated build assets in `assets/` or `app.html`.
- `แยกตามสาร` must not show `ตามลำดับ Parameter` or `%สาร` sorting options.
- `แยกตามสาร` default sort is `ชื่อสาร A-Z`.
- Rows with missing numeric values sort after rows with numeric values.

---

### Task 1: Tab-Aware Substance Sort Options

**Files:**
- Modify: `src/components/lis/ParameterCriteriaTabs.test.tsx`
- Modify: `src/components/lis/ParameterCriteriaTabs.tsx`

**Interfaces:**
- Consumes: existing `ParameterCriteriaTabs` props and existing `SubstanceCriteriaRow` fields: `substance`, `value`, `value2`.
- Produces: new sort keys inside `ParameterCriteriaTabs.tsx`:
  - `substanceAsc`
  - `substanceDesc`
  - `minValueAsc`
  - `minValueDesc`
  - `maxValueAsc`
  - `maxValueDesc`

- [ ] **Step 1: Write the failing tests**

Edit `src/components/lis/ParameterCriteriaTabs.test.tsx`.

Replace the top-level `parameters` fixture with this version so the `แยกตามสาร` tab has enough rows to prove name, min, and max sorting:

```tsx
const parameters: ParameterItem[] = [
  {
    _id: "p1",
    name: "Parameter A",
    scope: "qc",
    valueFields: [
      {
        label: "Active",
        type: "number",
        substanceMode: true,
        substanceStandards: [
          {
            substance: "CYFLUTHRIN",
            operator: "between",
            value: 20,
            value2: 80,
            productTypes: ["water"],
            categories: ["RM"],
          } as any,
          {
            substance: "ABAMECTIN",
            operator: "between",
            value: 95,
            value2: 110,
            productTypes: ["water"],
            categories: ["RM"],
          } as any,
          {
            substance: "BIFENTHRIN",
            operator: "gte",
            value: 50,
            value2: null,
            productTypes: ["water"],
            categories: ["RM"],
          } as any,
        ],
      },
      {
        label: "%AI",
        type: "number",
        labelToleranceMode: true,
        labelToleranceStandards: [{ substance: "ABAMECTIN", labelPercent: 1, autoPct: 25, headPct: 15 }],
      },
    ],
  },
  {
    _id: "p2",
    name: "Parameter B",
    scope: "qc",
    valueFields: [
      {
        label: "%AI B",
        type: "number",
        labelToleranceMode: true,
        labelToleranceStandards: [{ substance: "GLYPHOSATE", labelPercent: 5, autoPct: 20, headPct: 10 }],
      },
    ],
  },
];
```

Add this helper near `renderCriteriaTabs`:

```tsx
function bodyRows() {
  return within(screen.getByRole("table")).getAllByRole("row").slice(1);
}
```

Update the existing substance table test assertion from:

```tsx
expect(within(table).getByText("ABAMECTIN")).toBeInTheDocument();
```

to:

```tsx
expect(within(table).getByText("ABAMECTIN")).toBeInTheDocument();
expect(within(table).getByText("BIFENTHRIN")).toBeInTheDocument();
expect(within(table).getByText("CYFLUTHRIN")).toBeInTheDocument();
```

Add these new tests inside `describe("ParameterCriteriaTabs", () => { ... })`:

```tsx
it("defaults the substance tab to substance A-Z and hides parameter order and percent sort options", () => {
  renderCriteriaTabs({ value: "substance" });

  const sortSelect = screen.getByLabelText("เรียงลำดับ");
  const optionTexts = within(sortSelect).getAllByRole("option").map((option) => option.textContent ?? "");

  expect(sortSelect).toHaveValue("substanceAsc");
  expect(optionTexts).toEqual([
    "ชื่อสาร A-Z",
    "ชื่อสาร Z-A",
    "ค่าต่ำสุด น้อยไปมาก",
    "ค่าต่ำสุด มากไปน้อย",
    "ค่าสูงสุด น้อยไปมาก",
    "ค่าสูงสุด มากไปน้อย",
  ]);
  expect(optionTexts.some((text) => text.includes("ตามลำดับ Parameter"))).toBe(false);
  expect(optionTexts.some((text) => text.includes("%สาร"))).toBe(false);

  const rows = bodyRows();
  expect(within(rows[0]).getByText("ABAMECTIN")).toBeInTheDocument();
  expect(within(rows[1]).getByText("BIFENTHRIN")).toBeInTheDocument();
  expect(within(rows[2]).getByText("CYFLUTHRIN")).toBeInTheDocument();
});

it("sorts substance rows by substance Z-A", () => {
  renderCriteriaTabs({ value: "substance" });

  fireEvent.change(screen.getByLabelText("เรียงลำดับ"), { target: { value: "substanceDesc" } });

  const rows = bodyRows();
  expect(within(rows[0]).getByText("CYFLUTHRIN")).toBeInTheDocument();
  expect(within(rows[1]).getByText("BIFENTHRIN")).toBeInTheDocument();
  expect(within(rows[2]).getByText("ABAMECTIN")).toBeInTheDocument();
});

it("sorts substance rows by minimum value in both directions", () => {
  renderCriteriaTabs({ value: "substance" });

  fireEvent.change(screen.getByLabelText("เรียงลำดับ"), { target: { value: "minValueAsc" } });
  let rows = bodyRows();
  expect(within(rows[0]).getByText("CYFLUTHRIN")).toBeInTheDocument();
  expect(within(rows[1]).getByText("BIFENTHRIN")).toBeInTheDocument();
  expect(within(rows[2]).getByText("ABAMECTIN")).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("เรียงลำดับ"), { target: { value: "minValueDesc" } });
  rows = bodyRows();
  expect(within(rows[0]).getByText("ABAMECTIN")).toBeInTheDocument();
  expect(within(rows[1]).getByText("BIFENTHRIN")).toBeInTheDocument();
  expect(within(rows[2]).getByText("CYFLUTHRIN")).toBeInTheDocument();
});

it("sorts substance rows by maximum value in both directions with missing values last", () => {
  renderCriteriaTabs({ value: "substance" });

  fireEvent.change(screen.getByLabelText("เรียงลำดับ"), { target: { value: "maxValueAsc" } });
  let rows = bodyRows();
  expect(within(rows[0]).getByText("CYFLUTHRIN")).toBeInTheDocument();
  expect(within(rows[1]).getByText("ABAMECTIN")).toBeInTheDocument();
  expect(within(rows[2]).getByText("BIFENTHRIN")).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("เรียงลำดับ"), { target: { value: "maxValueDesc" } });
  rows = bodyRows();
  expect(within(rows[0]).getByText("ABAMECTIN")).toBeInTheDocument();
  expect(within(rows[1]).getByText("CYFLUTHRIN")).toBeInTheDocument();
  expect(within(rows[2]).getByText("BIFENTHRIN")).toBeInTheDocument();
});

it("keeps percent sort options available on the label tolerance tab", () => {
  renderCriteriaTabs({ value: "labelTolerance", canViewHeadCriteriaColumns: true });

  const optionTexts = within(screen.getByLabelText("เรียงลำดับ"))
    .getAllByRole("option")
    .map((option) => option.textContent ?? "");

  expect(optionTexts).toContain("%สาร น้อยไปมาก");
  expect(optionTexts).toContain("%สาร มากไปน้อย");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
npx vitest run src/components/lis/ParameterCriteriaTabs.test.tsx
```

Expected: FAIL because the current component still defaults to `parameterOrder`, lacks `substanceAsc`, and still renders `%สาร` options in the `แยกตามสาร` tab.

- [ ] **Step 3: Implement tab-aware sort options**

Edit `src/components/lis/ParameterCriteriaTabs.tsx`.

Replace the current `CriteriaSortKey` type:

```tsx
type CriteriaSortKey = "parameterOrder" | "parameterName" | "drugPercentAsc" | "drugPercentDesc";
```

with:

```tsx
type CriteriaSortKey =
  | "parameterOrder"
  | "parameterName"
  | "substanceAsc"
  | "substanceDesc"
  | "minValueAsc"
  | "minValueDesc"
  | "maxValueAsc"
  | "maxValueDesc"
  | "drugPercentAsc"
  | "drugPercentDesc";
```

Replace `SortableCriteriaRow` with:

```tsx
type SortableCriteriaRow = {
  parameterId: string;
  parameterName: string;
  fieldIndex: number;
  fieldLabel: string;
  ruleIndex: number | null;
  substance?: string;
  value?: number | null;
  value2?: number | null;
  drugPercent?: string;
};
```

Add these constants below `SEARCHABLE_ROW_KEYS`:

```tsx
const SUBSTANCE_SORT_OPTIONS: Array<{ value: CriteriaSortKey; label: string }> = [
  { value: "substanceAsc", label: "ชื่อสาร A-Z" },
  { value: "substanceDesc", label: "ชื่อสาร Z-A" },
  { value: "minValueAsc", label: "ค่าต่ำสุด น้อยไปมาก" },
  { value: "minValueDesc", label: "ค่าต่ำสุด มากไปน้อย" },
  { value: "maxValueAsc", label: "ค่าสูงสุด น้อยไปมาก" },
  { value: "maxValueDesc", label: "ค่าสูงสุด มากไปน้อย" },
];

const DEFAULT_SORT_OPTIONS: Array<{ value: CriteriaSortKey; label: string }> = [
  { value: "parameterOrder", label: "ตามลำดับ Parameter" },
  { value: "parameterName", label: "ชื่อ Parameter" },
];

const LABEL_TOLERANCE_SORT_OPTIONS: Array<{ value: CriteriaSortKey; label: string }> = [
  ...DEFAULT_SORT_OPTIONS,
  { value: "drugPercentAsc", label: "%สาร น้อยไปมาก" },
  { value: "drugPercentDesc", label: "%สาร มากไปน้อย" },
];
```

In `ParameterCriteriaTabs`, replace:

```tsx
const [sortKey, setSortKey] = useState<CriteriaSortKey>("parameterOrder");
```

with:

```tsx
const [sortKeyByTab, setSortKeyByTab] = useState<Record<Exclude<ParameterCriteriaTab, "list">, CriteriaSortKey>>({
  substance: "substanceAsc",
  conditional: "parameterOrder",
  labelTolerance: "parameterOrder",
});
```

Add these derived values after `showHeadCriteriaColumns`:

```tsx
const activeCriteriaTab = value === "list" ? "substance" : value;
const sortOptions =
  activeCriteriaTab === "substance"
    ? SUBSTANCE_SORT_OPTIONS
    : activeCriteriaTab === "labelTolerance"
      ? LABEL_TOLERANCE_SORT_OPTIONS
      : DEFAULT_SORT_OPTIONS;
const sortKey = sortKeyByTab[activeCriteriaTab];
```

Replace the sort `<NativeSelect>` `onChange` and children:

```tsx
onChange={(event) => setSortKey(event.target.value as CriteriaSortKey)}
>
  <option value="parameterOrder">ตามลำดับ Parameter</option>
  <option value="parameterName">ชื่อ Parameter</option>
  <option value="drugPercentAsc">%สาร น้อยไปมาก</option>
  <option value="drugPercentDesc">%สาร มากไปน้อย</option>
</NativeSelect>
```

with:

```tsx
onChange={(event) =>
  setSortKeyByTab((current) => ({
    ...current,
    [activeCriteriaTab]: event.target.value as CriteriaSortKey,
  }))
}
>
  {sortOptions.map((option) => (
    <option key={option.value} value={option.value}>
      {option.label}
    </option>
  ))}
</NativeSelect>
```

- [ ] **Step 4: Implement substance comparators**

Still in `src/components/lis/ParameterCriteriaTabs.tsx`, update `compareCriteriaRows`.

Insert these branches before the `drugPercentAsc` branch:

```tsx
if (sortKey === "substanceAsc" || sortKey === "substanceDesc") {
  return compareSubstance(a, b, sortKey === "substanceAsc" ? "asc" : "desc") || defaultCompare(a, b);
}
if (sortKey === "minValueAsc" || sortKey === "minValueDesc") {
  return compareNullableNumber(a.value, b.value, sortKey === "minValueAsc" ? "asc" : "desc") || defaultCompare(a, b);
}
if (sortKey === "maxValueAsc" || sortKey === "maxValueDesc") {
  return compareNullableNumber(a.value2, b.value2, sortKey === "maxValueAsc" ? "asc" : "desc") || defaultCompare(a, b);
}
```

Add these helper functions above `compareDrugPercent`:

```tsx
function compareSubstance<T extends SortableCriteriaRow>(a: T, b: T, direction: "asc" | "desc") {
  const result = criteriaCollator.compare(a.substance ?? "", b.substance ?? "");
  return direction === "asc" ? result : -result;
}

function compareNullableNumber(
  aValue: number | null | undefined,
  bValue: number | null | undefined,
  direction: "asc" | "desc",
) {
  const aNumber = Number(aValue);
  const bNumber = Number(bValue);
  const aValid = Number.isFinite(aNumber);
  const bValid = Number.isFinite(bNumber);
  if (!aValid && !bValid) return 0;
  if (!aValid) return 1;
  if (!bValid) return -1;
  return direction === "asc" ? aNumber - bNumber : bNumber - aNumber;
}
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
npx vitest run src/components/lis/ParameterCriteriaTabs.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Run related tests**

Run:

```bash
npx vitest run src/components/lis/ParameterCriteriaTabs.test.tsx src/pages/__tests__/ParameterSettings.criteria-tabs.test.tsx src/lib/parameterCriteriaRows.test.ts
```

Expected: PASS.

- [ ] **Step 7: Type-check touched app code**

Run:

```bash
npx tsc -p tsconfig.app.json --noEmit
```

Expected: no TypeScript errors in `src/components/lis/ParameterCriteriaTabs.tsx` or `src/components/lis/ParameterCriteriaTabs.test.tsx`. If the repo reports pre-existing errors elsewhere, record them and confirm none are introduced in the touched files.

- [ ] **Step 8: Review diff**

Run:

```bash
git diff -- src/components/lis/ParameterCriteriaTabs.tsx src/components/lis/ParameterCriteriaTabs.test.tsx
```

Expected: diff only contains tab-aware sort behavior and tests. No generated assets should be included.

- [ ] **Step 9: Commit**

Run:

```bash
git add -- src/components/lis/ParameterCriteriaTabs.tsx src/components/lis/ParameterCriteriaTabs.test.tsx
git commit -m "feat(parameter-settings): sort substance criteria rows" -- src/components/lis/ParameterCriteriaTabs.tsx src/components/lis/ParameterCriteriaTabs.test.tsx
```
