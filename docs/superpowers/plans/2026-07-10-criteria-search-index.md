# Criteria Search Index Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand `/LIS/parameter-settings` advanced criteria search so criteria rows can be found by parameter, field, and rule metadata, not only visible substance names.

**Architecture:** Keep the criteria tables visually unchanged. Build a derived `searchText` on each row in `src/lib/parameterCriteriaRows.ts`, then make `src/components/lis/ParameterCriteriaTabs.tsx` check that text during filtering. This keeps search indexing close to row construction and avoids pushing parameter-schema knowledge into the React component.

**Tech Stack:** React 18, TypeScript, Vite, TanStack React Query, Vitest, Testing Library.

## Global Constraints

- Do not change the parameter schema.
- Do not change how abnormal detection or standard resolution works.
- Do not add API endpoints.
- Do not add new table columns in this pass.
- Do not change the main parameter-list search.
- Do not run a production build for this change.
- Ignore unrelated dirty `assets/` and `app.html` build-output changes unless the user explicitly asks for a build.

---

## File Structure

- Modify `src/lib/parameterCriteriaRows.ts`: add `searchText`, token-flattening helpers, and mode-specific search tokens.
- Modify `src/lib/parameterCriteriaRows.test.ts`: assert `searchText` contains representative owner metadata and rule metadata.
- Modify `src/components/lis/ParameterCriteriaTabs.tsx`: make criteria filtering check `searchText`.
- Modify `src/components/lis/ParameterCriteriaTabs.test.tsx`: add render tests for hidden owner/apply-to metadata searches.
- Do not touch server, schema, route, or built-asset files.

---

### Task 1: Add Search Text To Criteria Rows

**Files:**
- Modify: `src/lib/parameterCriteriaRows.ts`
- Test: `src/lib/parameterCriteriaRows.test.ts`

**Interfaces:**
- Consumes: `ParameterItem`, `ParameterValueField`, `SubstanceStandard`, `StandardRule`, and `LabelToleranceRule` from `src/lib/api.ts`.
- Produces: `CriteriaRowOwner.searchText: string`.
- Produces: every returned `SubstanceCriteriaRow`, `ConditionalCriteriaRow`, and `LabelToleranceCriteriaRow` includes `searchText`.

- [ ] **Step 1: Write the failing tests**

In `src/lib/parameterCriteriaRows.test.ts`, update the first `parameters` fixture object by adding this metadata immediately after `scope: "qc",`:

```ts
    status: "active",
    note: "hidden owner note for criteria search",
    applyAll: false,
    itemNames: ["Trade Alpha"],
    commonNames: ["Hidden Common Name"],
    productTypes: ["water"],
    categories: ["FG"],
    subCategories: ["F"],
    itemGroups: ["group-hidden"],
```

Add these tests before the final `formats absolute label tolerance values with plus-minus text` test:

```ts
  it("includes parameter and field metadata in substance row searchText", () => {
    const rows = buildSubstanceCriteriaRows(parameters, "qc");
    const searchText = rows[0].searchText.toLowerCase();

    expect(searchText).toContain("qc parameter");
    expect(searchText).toContain("active");
    expect(searchText).toContain("hidden owner note");
    expect(searchText).toContain("trade alpha");
    expect(searchText).toContain("hidden common name");
    expect(searchText).toContain("water");
    expect(searchText).toContain(productTypeLabels.water.toLowerCase());
    expect(searchText).toContain("fg");
    expect(searchText).toContain("f");
    expect(searchText).toContain("group-hidden");
    expect(searchText).toContain("number");
    expect(searchText).toContain("%");
  });

  it("includes row-specific substance rule metadata in searchText", () => {
    const rows = buildSubstanceCriteriaRows(parameters, "qc");
    const first = rows[0].searchText.toLowerCase();
    const second = rows[1].searchText.toLowerCase();

    expect(first).toContain("abamectin");
    expect(first).toContain("gte");
    expect(first).toContain("95");
    expect(first).toContain("gmp");
    expect(first).toContain("bio");
    expect(first).toContain("rm");
    expect(first).toContain("headonly");
    expect(second).toContain("imidacloprid");
    expect(second).toContain("between");
    expect(second).toContain("110");
  });

  it("includes conditional and label tolerance rule metadata in searchText", () => {
    const conditionalRows = buildConditionalCriteriaRows(parameters, "qc");
    const labelRows = buildLabelToleranceCriteriaRows(parameters, "qc");

    expect(conditionalRows[0].searchText.toLowerCase()).toContain("moisture");
    expect(conditionalRows[0].searchText.toLowerCase()).toContain("between rule");
    expect(conditionalRows[2].searchText.toLowerCase()).toContain("review required");
    expect(conditionalRows[2].searchText.toLowerCase()).toContain("abnormal");
    expect(labelRows[0].searchText.toLowerCase()).toContain("0.2438");
    expect(labelRows[0].searchText.toLowerCase()).toContain(productTypeLabels.sand.toLowerCase());
    expect(labelRows[1].searchText.toLowerCase()).toContain("abamectin");
    expect(labelRows[1].searchText.toLowerCase()).toContain("25%");
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
npx vitest run src/lib/parameterCriteriaRows.test.ts
```

Expected: FAIL because returned rows do not have `searchText` yet.

- [ ] **Step 3: Add search-text helpers and owner metadata**

In `src/lib/parameterCriteriaRows.ts`, update `CriteriaRowOwner`:

```ts
export type CriteriaRowOwner = {
  parameterId: string;
  parameterName: string;
  parameterScope: ParameterScope;
  fieldIndex: number;
  fieldLabel: string;
  field: ParameterValueField;
  searchText: string;
};
```

Add these helpers after `displayValue`:

```ts
const flattenSearchTokens = (value: unknown): string[] => {
  if (value == null) return [];
  if (Array.isArray(value)) return value.flatMap(flattenSearchTokens);
  if (typeof value === "object") return Object.values(value).flatMap(flattenSearchTokens);
  const text = String(value).trim();
  return text ? [text] : [];
};

const productTypeSearchTokens = (values: string[] | undefined) =>
  (values ?? []).flatMap((value) => [value, productTypeLabels[value] ?? ""]);

const buildSearchText = (...tokens: unknown[]) =>
  flattenSearchTokens(tokens).join(" ");

const appendSearchText = (base: CriteriaRowOwner, ...tokens: unknown[]) =>
  buildSearchText(base.searchText, tokens);
```

In the `owner` helper, replace the existing return block with:

```ts
  const scope = (parameter.scope ?? "qc") as ParameterScope;
  return {
    parameterId: parameter._id,
    parameterName: parameter.name,
    parameterScope: scope,
    fieldIndex,
    fieldLabel: field.label,
    field,
    searchText: buildSearchText(
      parameter.name,
      scope,
      parameter.status,
      parameter.note,
      parameter.applyAll ? ["applyAll", "all"] : "",
      parameter.itemNames,
      parameter.commonNames,
      productTypeSearchTokens(parameter.productTypes),
      parameter.categories,
      parameter.subCategories,
      parameter.itemGroups,
      field.label,
      field.type,
      field.unit,
      field.options,
      field.requireNoteOn,
      field.expectedValues,
      field.allowedFileTypes,
      field.optionOutputs,
      field.optionFilters,
    ),
  };
```

- [ ] **Step 4: Append substance-mode search tokens**

In the substance setup row object, add:

```ts
          searchText: appendSearchText(base, "substance", "setup"),
```

In the `standards.forEach` callback inside `buildSubstanceCriteriaRows`, add these constants before `rows.push`:

```ts
        const productText = regulatoryTypeText(standard.regulatoryTypes) || productTypeText(standard.productTypes);
        const catText = categoryText(standard.categories);
```

In the non-setup substance row object, replace the existing direct `productTypeText` and `categoryText` values with the computed values and add `searchText`:

```ts
          productTypeText: productText,
          categoryText: catText,
          headOnly: standard.headOnly === true,
          searchText: appendSearchText(
            base,
            "substance",
            standard.substance,
            standard.operator,
            standard.value,
            standard.value2,
            productTypeSearchTokens(standard.productTypes),
            standard.regulatoryTypes,
            standard.categories,
            productText,
            catText,
            standard.headOnly === true ? ["headOnly", "head only"] : "",
          ),
```

Keep `mode`, `rowId`, `ruleIndex`, `substance`, `operator`, `value`, `value2`, and `isSetupRow` unchanged.

- [ ] **Step 5: Append conditional-mode search tokens**

In the conditional setup row object, add:

```ts
          searchText: appendSearchText(base, "conditional", "setup"),
```

In the `rules.forEach` callback inside `buildConditionalCriteriaRows`, replace the current inline result text calculation with these constants before `rows.push`:

```ts
        const isOutput = (field.conditionalResult ?? "standard") === "output";
        const conditionSummary = conditionsText(rule);
        const resultSummary = isOutput
          ? outputResultText(rule)
          : standardResultText(rule, field.unit || "");
```

Use those values in the non-setup conditional row object and add `searchText`:

```ts
          conditionsText: conditionSummary,
          resultText: resultSummary,
          searchText: appendSearchText(
            base,
            "conditional",
            rule.label,
            conditionSummary,
            resultSummary,
            rule.conditions?.map((condition) => [
              condition.sourceParameterId,
              condition.sourceFieldLabel,
              condition.op,
              condition.value,
              condition.value2,
            ]),
            rule.operator,
            rule.value,
            rule.value2,
            rule.outputText,
            rule.outputKind,
          ),
```

Keep `mode`, `rowId`, `ruleIndex`, `ruleLabel`, and `isSetupRow` unchanged.

- [ ] **Step 6: Append label-tolerance search tokens**

In the label-tolerance setup row object, add:

```ts
          searchText: appendSearchText(base, "labelTolerance", "setup"),
```

In the `rules.forEach` callback inside `buildLabelToleranceCriteriaRows`, compute display strings before `rows.push`:

```ts
        const selector = selectorText(rule);
        const summary = describeLabelTolerance(rule, field.unit || "");
        const autoText = tolerancePercent(rule);
        const headText = headTolerance(rule);
```

Use those values in the non-setup label-tolerance row object and add `searchText`:

```ts
          selectorText: selector,
          tolerancePercent: autoText,
          headTolerance: headText,
          previewText: summary ? `${selector} | ${summary}` : selector,
          searchText: appendSearchText(
            base,
            "labelTolerance",
            selector,
            summary,
            rule.substance,
            rule.labelPercent,
            productTypeSearchTokens(rule.productTypes),
            rule.autoPct,
            rule.headPct,
            rule.autoAbs,
            rule.headAbs,
            rule.failLow,
            rule.passLow,
            rule.passHigh,
            rule.failHigh,
            autoText,
            headText,
          ),
```

Keep `mode`, `rowId`, `ruleIndex`, `drugPercent`, `failLow`, `passLow`, `passHigh`, `failHigh`, and `isSetupRow` unchanged.

- [ ] **Step 7: Run the tests to verify they pass**

Run:

```bash
npx vitest run src/lib/parameterCriteriaRows.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add -- src/lib/parameterCriteriaRows.ts src/lib/parameterCriteriaRows.test.ts
git commit -m "feat(param): index criteria row search metadata"
```

---

### Task 2: Filter Criteria Rows By Search Text

**Files:**
- Modify: `src/components/lis/ParameterCriteriaTabs.tsx`
- Test: `src/components/lis/ParameterCriteriaTabs.test.tsx`

**Interfaces:**
- Consumes: `row.searchText: string` from Task 1.
- Produces: `matchesCriteriaSearch(row, searchQuery)` returns true when `searchQuery` is found in `row.searchText` or existing explicit row fields.

- [ ] **Step 1: Write the failing render tests**

In `src/components/lis/ParameterCriteriaTabs.test.tsx`, add this fixture after the existing `parameters` constant:

```ts
const metadataParameters: ParameterItem[] = [
  {
    _id: "p-meta",
    name: "Metadata Parameter",
    scope: "qc",
    status: "active",
    note: "Hidden owner note",
    itemNames: ["Trade Alpha"],
    commonNames: ["Hidden Common Name"],
    productTypes: ["water"],
    categories: ["FG"],
    subCategories: ["F"],
    itemGroups: ["group-hidden"],
    valueFields: [
      {
        label: "Hidden Field Label",
        type: "number",
        unit: "%",
        substanceMode: true,
        substanceStandards: [{ substance: "CYPERMETHRIN", operator: "gte", value: 90 }],
      },
    ],
  },
  {
    _id: "p-other",
    name: "Other Parameter",
    scope: "qc",
    valueFields: [
      {
        label: "Other Field",
        type: "number",
        substanceMode: true,
        substanceStandards: [{ substance: "ABAMECTIN", operator: "gte", value: 95 }],
      },
    ],
  },
];
```

Add this helper after `renderCriteriaTabs`:

```ts
function criteriaSearchInput() {
  return screen.getAllByRole("textbox")[0];
}
```

Add these tests before `filters criteria rows by substance search text`:

```tsx
  it("filters criteria rows by hidden parameter metadata", () => {
    renderCriteriaTabs({ value: "substance", parameters: metadataParameters });

    fireEvent.change(criteriaSearchInput(), {
      target: { value: "hidden owner note" },
    });

    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).getByText("Metadata Parameter")).toBeInTheDocument();
    expect(within(rows[0]).getByText("CYPERMETHRIN")).toBeInTheDocument();
    expect(screen.queryByText("Other Parameter")).not.toBeInTheDocument();
  });

  it("filters criteria rows by apply-to metadata and hidden field label", () => {
    renderCriteriaTabs({ value: "substance", parameters: metadataParameters });

    fireEvent.change(criteriaSearchInput(), {
      target: { value: "Trade Alpha" },
    });
    expect(within(screen.getByRole("table")).getAllByRole("row").slice(1)).toHaveLength(1);
    expect(screen.getByText("Metadata Parameter")).toBeInTheDocument();

    fireEvent.change(criteriaSearchInput(), {
      target: { value: "Hidden Field Label" },
    });
    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).getByText("Metadata Parameter")).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
npx vitest run src/components/lis/ParameterCriteriaTabs.test.tsx
```

Expected: FAIL because the component does not yet check `row.searchText`.

- [ ] **Step 3: Include `searchText` in row filtering**

In `src/components/lis/ParameterCriteriaTabs.tsx`, update `SortableCriteriaRow`:

```ts
type SortableCriteriaRow = {
  parameterId: string;
  parameterName: string;
  fieldIndex: number;
  fieldLabel: string;
  ruleIndex: number | null;
  searchText: string;
  drugPercent?: string;
};
```

Replace `matchesCriteriaSearch` with:

```ts
function matchesCriteriaSearch(row: SortableCriteriaRow, searchQuery: string) {
  if (!searchQuery) return true;
  const searchable = row as unknown as Record<string, unknown>;
  const rowSearchText = String(searchable.searchText ?? "").toLowerCase();
  if (rowSearchText.includes(searchQuery)) return true;
  return SEARCHABLE_ROW_KEYS.some((key) => {
    const value = searchable[key];
    if (value == null) return false;
    if (Array.isArray(value)) {
      return value.some((item) => String(item).toLowerCase().includes(searchQuery));
    }
    return String(value).toLowerCase().includes(searchQuery);
  });
}
```

Do not add new visible columns.

- [ ] **Step 4: Run focused tests**

Run:

```bash
npx vitest run src/components/lis/ParameterCriteriaTabs.test.tsx src/lib/parameterCriteriaRows.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add -- src/components/lis/ParameterCriteriaTabs.tsx src/components/lis/ParameterCriteriaTabs.test.tsx
git commit -m "feat(param): search criteria rows by owner metadata"
```

---

### Task 3: Verify Page Integration And Types

**Files:**
- Verify: `src/pages/__tests__/ParameterSettings.criteria-tabs.test.tsx`
- Verify: `src/lib/parameterCriteriaRows.test.ts`
- Verify: `src/components/lis/ParameterCriteriaTabs.test.tsx`
- Verify: TypeScript project

**Interfaces:**
- Consumes: completed source changes from Tasks 1 and 2.
- Produces: passing focused tests and type-check.

- [ ] **Step 1: Run criteria-focused tests**

Run:

```bash
npx vitest run src/lib/parameterCriteriaRows.test.ts src/components/lis/ParameterCriteriaTabs.test.tsx src/pages/__tests__/ParameterSettings.criteria-tabs.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run parameter validation regression tests**

Run:

```bash
npx vitest run src/lib/parameterValidation.test.ts
```

Expected: PASS. This confirms the search-index change did not require changing abnormal-detection logic.

- [ ] **Step 3: Run TypeScript check**

Run:

```bash
npx tsc --noEmit
```

Expected: exit code 0. If this reports pre-existing errors outside the touched files, record exact file names and confirm whether they are unrelated before deciding whether to fix them.

- [ ] **Step 4: Review source diff only**

Run:

```bash
git diff -- src/lib/parameterCriteriaRows.ts src/lib/parameterCriteriaRows.test.ts src/components/lis/ParameterCriteriaTabs.tsx src/components/lis/ParameterCriteriaTabs.test.tsx
```

Expected: diff contains only search-index changes and tests. It should not include `assets/`, `app.html`, server files, schema files, or API-route files.

- [ ] **Step 5: Commit verification fixes if needed**

If Steps 1-4 required fixes, commit only the touched source/test files:

```bash
git add -- src/lib/parameterCriteriaRows.ts src/lib/parameterCriteriaRows.test.ts src/components/lis/ParameterCriteriaTabs.tsx src/components/lis/ParameterCriteriaTabs.test.tsx
git commit -m "fix(param): verify criteria search index"
```

If no fixes were needed after Task 2, do not create an empty commit.
