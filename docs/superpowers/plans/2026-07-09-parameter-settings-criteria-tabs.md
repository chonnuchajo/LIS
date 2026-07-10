# Parameter Settings Criteria Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add page-level table tabs in `/LIS/parameter-settings` for reviewing and editing `substanceMode`, `conditionalMode`, and `labelToleranceMode` criteria.

**Architecture:** Keep parameter storage and abnormal-calculation behavior unchanged. Add pure row-builder helpers under `src/lib/`, render those rows through a focused React component, then wire row edit actions back to the existing criteria dialogs and existing `api.updateParameter` save flow.

**Tech Stack:** React 18, TypeScript, Vite, TanStack React Query, shadcn/ui tabs/table/button/badge, Vitest, Testing Library.

## Global Constraints

- Scope is `/LIS/parameter-settings`.
- Do not change how abnormal detection is calculated.
- Do not change the parameter schema.
- Do not add new routes or access-control paths.
- Do not replace the existing field-level editor.
- Do not make all cells inline editable in this pass.
- Reuse `SubstanceStandardsDialog`, `ConditionalStandardsDialog`, and `LabelToleranceDialog`.
- Do not run `npm run build` during normal development; use `npx tsc --noEmit`.
- Ignore unrelated dirty build assets in `assets/`, `app.html`, and root output files unless the user explicitly requests a production build.

---

## File Structure

- Create `src/lib/parameterCriteriaRows.ts`: pure row builders for the three criteria-table views. This keeps `ParameterSettings.tsx` from absorbing more derived-data logic.
- Create `src/lib/parameterCriteriaRows.test.ts`: unit tests for row mapping and setup rows.
- Create `src/components/lis/ParameterCriteriaTabs.tsx`: presentation component for the secondary management tabs and tables.
- Create `src/components/lis/ParameterCriteriaTabs.test.tsx`: render tests for switching tabs and edit callbacks.
- Modify `src/pages/ParameterSettings.tsx`: add secondary-tab state, render the new component around the existing list, open existing dialogs from table rows, and save changed field criteria through `api.updateParameter`.

---

### Task 1: Row Builder Helpers

**Files:**
- Create: `src/lib/parameterCriteriaRows.ts`
- Test: `src/lib/parameterCriteriaRows.test.ts`

**Interfaces:**
- Consumes: `ParameterItem`, `ParameterScope`, `ParameterValueField`, `SubstanceStandard`, `StandardRule`, `LabelToleranceRule` from `src/lib/api.ts`
- Produces:
  - `type AdvancedCriteriaMode = "substance" | "conditional" | "labelTolerance"`
  - `type CriteriaRowOwner = { parameterId: string; parameterName: string; parameterScope: ParameterScope; fieldIndex: number; fieldLabel: string; field: ParameterValueField }`
  - `type SubstanceCriteriaRow = CriteriaRowOwner & { mode: "substance"; rowId: string; ruleIndex: number | null; substance: string; operator: string; value: number | null; value2: number | null; headOnly: boolean; isSetupRow: boolean }`
  - `type ConditionalCriteriaRow = CriteriaRowOwner & { mode: "conditional"; rowId: string; ruleIndex: number | null; ruleLabel: string; conditionsText: string; resultText: string; isSetupRow: boolean }`
  - `type LabelToleranceCriteriaRow = CriteriaRowOwner & { mode: "labelTolerance"; rowId: string; ruleIndex: number | null; selectorText: string; drugPercent: string; tolerancePercent: string; failLow: string; passLow: string; passHigh: string; failHigh: string; previewText: string; isSetupRow: boolean }`
  - `buildSubstanceCriteriaRows(parameters: ParameterItem[], scope: ParameterScope): SubstanceCriteriaRow[]`
  - `buildConditionalCriteriaRows(parameters: ParameterItem[], scope: ParameterScope): ConditionalCriteriaRow[]`
  - `buildLabelToleranceCriteriaRows(parameters: ParameterItem[], scope: ParameterScope): LabelToleranceCriteriaRow[]`

- [ ] **Step 1: Write the failing test**

Create `src/lib/parameterCriteriaRows.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { ParameterItem } from "./api";
import {
  buildConditionalCriteriaRows,
  buildLabelToleranceCriteriaRows,
  buildSubstanceCriteriaRows,
} from "./parameterCriteriaRows";

const parameters: ParameterItem[] = [
  {
    _id: "p-qc",
    name: "สารสำคัญ",
    scope: "qc",
    valueFields: [
      {
        label: "ปริมาณ",
        type: "number",
        unit: "%",
        substanceMode: true,
        substanceStandards: [
          { substance: "ABAMECTIN", operator: "gte", value: 95, value2: null, headOnly: true } as any,
          { substance: "IMIDACLOPRID", operator: "between", value: 90, value2: 110 },
        ],
      },
      {
        label: "น้ำหนัก",
        type: "float",
        unit: "g",
        conditionalMode: true,
        conditionalResult: "standard",
        conditionalStandards: [
          {
            label: "ก้อนใหญ่",
            conditions: [{ sourceFieldLabel: "ลักษณะ", op: "eq", value: "ก้อนใหญ่" }],
            operator: "between",
            value: 23.5,
            value2: 26,
          },
        ],
      },
      {
        label: "%AI",
        type: "number",
        unit: "%",
        labelToleranceMode: true,
        labelToleranceStandards: [
          {
            substance: "",
            labelPercent: 0.3,
            productTypes: ["sand"],
            mode: "range",
            autoPct: null,
            headPct: null,
            failLow: 0.225,
            passLow: 0.2438,
            passHigh: 0.3563,
            failHigh: 0.375,
          },
          {
            substance: "ABAMECTIN",
            labelPercent: 1,
            autoMode: "percent",
            headMode: "percent",
            autoPct: 25,
            headPct: 15,
          },
        ],
      },
    ],
  },
  {
    _id: "p-lab",
    name: "Lab only",
    scope: "lab",
    valueFields: [
      {
        label: "ค่าที่ไม่มีแถว",
        type: "number",
        substanceMode: true,
        substanceStandards: [],
      },
    ],
  },
];

describe("parameter criteria row builders", () => {
  it("buildSubstanceCriteriaRows returns one row per substance standard in scope", () => {
    const rows = buildSubstanceCriteriaRows(parameters, "qc");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      mode: "substance",
      parameterId: "p-qc",
      parameterName: "สารสำคัญ",
      fieldIndex: 0,
      fieldLabel: "ปริมาณ",
      ruleIndex: 0,
      substance: "ABAMECTIN",
      operator: "gte",
      value: 95,
      value2: null,
      headOnly: true,
      isSetupRow: false,
    });
    expect(rows[1].substance).toBe("IMIDACLOPRID");
  });

  it("buildSubstanceCriteriaRows returns a setup row when mode is enabled with no standards", () => {
    const rows = buildSubstanceCriteriaRows(parameters, "lab");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      parameterId: "p-lab",
      fieldLabel: "ค่าที่ไม่มีแถว",
      ruleIndex: null,
      isSetupRow: true,
    });
  });

  it("buildConditionalCriteriaRows formats conditions and standard result", () => {
    const rows = buildConditionalCriteriaRows(parameters, "qc");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      mode: "conditional",
      parameterId: "p-qc",
      fieldIndex: 1,
      ruleIndex: 0,
      ruleLabel: "ก้อนใหญ่",
      conditionsText: "ลักษณะ = ก้อนใหญ่",
      resultText: "23.5 - 26 g",
      isSetupRow: false,
    });
  });

  it("buildLabelToleranceCriteriaRows maps requested table columns", () => {
    const rows = buildLabelToleranceCriteriaRows(parameters, "qc");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      mode: "labelTolerance",
      selectorText: "0.3% / ทราย",
      drugPercent: "0.3",
      tolerancePercent: "-",
      failLow: "0.225",
      passLow: "0.2438",
      passHigh: "0.3563",
      failHigh: "0.375",
      isSetupRow: false,
    });
    expect(rows[1]).toMatchObject({
      selectorText: "ABAMECTIN / 1%",
      drugPercent: "1",
      tolerancePercent: "25",
      failLow: "-",
      passLow: "-",
      passHigh: "-",
      failHigh: "-",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/lib/parameterCriteriaRows.test.ts
```

Expected: FAIL because `src/lib/parameterCriteriaRows.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/parameterCriteriaRows.ts`:

```ts
import type {
  LabelToleranceRule,
  ParameterItem,
  ParameterScope,
  ParameterValueField,
  StandardRule,
  SubstanceStandard,
} from "./api";
import { productTypeLabels } from "./productClassification";

export type AdvancedCriteriaMode = "substance" | "conditional" | "labelTolerance";

export type CriteriaRowOwner = {
  parameterId: string;
  parameterName: string;
  parameterScope: ParameterScope;
  fieldIndex: number;
  fieldLabel: string;
  field: ParameterValueField;
};

export type SubstanceCriteriaRow = CriteriaRowOwner & {
  mode: "substance";
  rowId: string;
  ruleIndex: number | null;
  substance: string;
  operator: string;
  value: number | null;
  value2: number | null;
  headOnly: boolean;
  isSetupRow: boolean;
};

export type ConditionalCriteriaRow = CriteriaRowOwner & {
  mode: "conditional";
  rowId: string;
  ruleIndex: number | null;
  ruleLabel: string;
  conditionsText: string;
  resultText: string;
  isSetupRow: boolean;
};

export type LabelToleranceCriteriaRow = CriteriaRowOwner & {
  mode: "labelTolerance";
  rowId: string;
  ruleIndex: number | null;
  selectorText: string;
  drugPercent: string;
  tolerancePercent: string;
  failLow: string;
  passLow: string;
  passHigh: string;
  failHigh: string;
  previewText: string;
  isSetupRow: boolean;
};

const isNumericField = (field: ParameterValueField) =>
  field.type === "number" || field.type === "float";

const scoped = (parameters: ParameterItem[], scope: ParameterScope) =>
  parameters.filter((parameter) => (parameter.scope ?? "qc") === scope);

const owner = (
  parameter: ParameterItem,
  field: ParameterValueField,
  fieldIndex: number,
): CriteriaRowOwner | null => {
  if (!parameter._id) return null;
  return {
    parameterId: parameter._id,
    parameterName: parameter.name,
    parameterScope: (parameter.scope ?? "qc") as ParameterScope,
    fieldIndex,
    fieldLabel: field.label,
    field,
  };
};

const displayValue = (value: number | null | undefined) =>
  value == null || !Number.isFinite(Number(value)) ? "-" : String(value);

const conditionOpLabel = {
  eq: "=",
  ne: "!=",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
  between: "ช่วง",
} as const;

const standardText = (rule: Pick<StandardRule, "operator" | "value" | "value2">, unit?: string) => {
  if (!rule.operator || rule.value == null) return "-";
  const suffix = unit ? ` ${unit}` : "";
  if (rule.operator === "between") {
    return rule.value2 == null ? "-" : `${rule.value} - ${rule.value2}${suffix}`;
  }
  if (rule.operator === "tolerance") {
    return rule.value2 == null ? "-" : `${rule.value} +/- ${rule.value2}%${suffix}`;
  }
  return `${rule.operator} ${rule.value}${suffix}`;
};

const conditionsText = (rule: StandardRule) => {
  if (!rule.conditions?.length) return "default";
  return rule.conditions
    .map((condition) => {
      const value2 = condition.op === "between" && condition.value2 != null ? `-${condition.value2}` : "";
      return `${condition.sourceFieldLabel} ${conditionOpLabel[condition.op]} ${condition.value}${value2}`;
    })
    .join(" และ ");
};

const selectorText = (rule: LabelToleranceRule) => {
  const parts = [
    rule.substance?.trim() || "",
    rule.labelPercent != null ? `${rule.labelPercent}%` : "",
    (rule.productTypes ?? []).map((value) => productTypeLabels[value] ?? value).join("/"),
  ].filter(Boolean);
  return parts.length ? parts.join(" / ") : "ทุกสาร";
};

const tolerancePercent = (rule: LabelToleranceRule) => {
  if ((rule.mode ?? "percent") === "range") return "-";
  if (rule.autoMode && rule.autoMode !== "percent") return "-";
  return displayValue(rule.autoPct);
};

export function buildSubstanceCriteriaRows(
  parameters: ParameterItem[],
  scope: ParameterScope,
): SubstanceCriteriaRow[] {
  const rows: SubstanceCriteriaRow[] = [];
  for (const parameter of scoped(parameters, scope)) {
    for (const [fieldIndex, field] of (parameter.valueFields ?? []).entries()) {
      if (!isNumericField(field) || !field.substanceMode) continue;
      const base = owner(parameter, field, fieldIndex);
      if (!base) continue;
      const standards = field.substanceStandards ?? [];
      if (standards.length === 0) {
        rows.push({
          ...base,
          mode: "substance",
          rowId: `${base.parameterId}:${fieldIndex}:setup`,
          ruleIndex: null,
          substance: "-",
          operator: "-",
          value: null,
          value2: null,
          headOnly: false,
          isSetupRow: true,
        });
        continue;
      }
      standards.forEach((standard: SubstanceStandard & { headOnly?: boolean }, ruleIndex) => {
        rows.push({
          ...base,
          mode: "substance",
          rowId: `${base.parameterId}:${fieldIndex}:${ruleIndex}`,
          ruleIndex,
          substance: standard.substance,
          operator: standard.operator,
          value: standard.value,
          value2: standard.value2 ?? null,
          headOnly: standard.headOnly === true,
          isSetupRow: false,
        });
      });
    }
  }
  return rows;
}

export function buildConditionalCriteriaRows(
  parameters: ParameterItem[],
  scope: ParameterScope,
): ConditionalCriteriaRow[] {
  const rows: ConditionalCriteriaRow[] = [];
  for (const parameter of scoped(parameters, scope)) {
    for (const [fieldIndex, field] of (parameter.valueFields ?? []).entries()) {
      if (!isNumericField(field) || !field.conditionalMode) continue;
      const base = owner(parameter, field, fieldIndex);
      if (!base) continue;
      const rules = field.conditionalStandards ?? [];
      if (rules.length === 0) {
        rows.push({
          ...base,
          mode: "conditional",
          rowId: `${base.parameterId}:${fieldIndex}:setup`,
          ruleIndex: null,
          ruleLabel: "-",
          conditionsText: "-",
          resultText: "-",
          isSetupRow: true,
        });
        continue;
      }
      rules.forEach((rule, ruleIndex) => {
        rows.push({
          ...base,
          mode: "conditional",
          rowId: `${base.parameterId}:${fieldIndex}:${ruleIndex}`,
          ruleIndex,
          ruleLabel: rule.label?.trim() || "-",
          conditionsText: conditionsText(rule),
          resultText:
            (field.conditionalResult ?? "standard") === "output"
              ? `${rule.outputText?.trim() || rule.label || "-"} (${rule.outputKind === "abnormal" ? "ผิดปกติ" : "ปกติ"})`
              : standardText(rule, field.unit),
          isSetupRow: false,
        });
      });
    }
  }
  return rows;
}

export function buildLabelToleranceCriteriaRows(
  parameters: ParameterItem[],
  scope: ParameterScope,
): LabelToleranceCriteriaRow[] {
  const rows: LabelToleranceCriteriaRow[] = [];
  for (const parameter of scoped(parameters, scope)) {
    for (const [fieldIndex, field] of (parameter.valueFields ?? []).entries()) {
      if (!isNumericField(field) || !field.labelToleranceMode) continue;
      const base = owner(parameter, field, fieldIndex);
      if (!base) continue;
      const rules = field.labelToleranceStandards ?? [];
      if (rules.length === 0) {
        rows.push({
          ...base,
          mode: "labelTolerance",
          rowId: `${base.parameterId}:${fieldIndex}:setup`,
          ruleIndex: null,
          selectorText: "-",
          drugPercent: "-",
          tolerancePercent: "-",
          failLow: "-",
          passLow: "-",
          passHigh: "-",
          failHigh: "-",
          previewText: "-",
          isSetupRow: true,
        });
        continue;
      }
      rules.forEach((rule, ruleIndex) => {
        rows.push({
          ...base,
          mode: "labelTolerance",
          rowId: `${base.parameterId}:${fieldIndex}:${ruleIndex}`,
          ruleIndex,
          selectorText: selectorText(rule),
          drugPercent: displayValue(rule.labelPercent),
          tolerancePercent: tolerancePercent(rule),
          failLow: displayValue(rule.failLow),
          passLow: displayValue(rule.passLow),
          passHigh: displayValue(rule.passHigh),
          failHigh: displayValue(rule.failHigh),
          previewText: selectorText(rule),
          isSetupRow: false,
        });
      });
    }
  }
  return rows;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run src/lib/parameterCriteriaRows.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -- src/lib/parameterCriteriaRows.ts src/lib/parameterCriteriaRows.test.ts
git commit -m "feat(param): build criteria table rows"
```

---

### Task 2: Criteria Tabs Presentation Component

**Files:**
- Create: `src/components/lis/ParameterCriteriaTabs.tsx`
- Test: `src/components/lis/ParameterCriteriaTabs.test.tsx`

**Interfaces:**
- Consumes row-builder functions and row types from `src/lib/parameterCriteriaRows.ts`
- Produces:
  - `type ParameterCriteriaTab = "list" | AdvancedCriteriaMode`
  - `type ParameterCriteriaTabsProps = { value: ParameterCriteriaTab; onValueChange: (value: ParameterCriteriaTab) => void; parameters: ParameterItem[]; scope: ParameterScope; children: React.ReactNode; onEditField: (mode: AdvancedCriteriaMode, parameterId: string, fieldIndex: number) => void }`

- [ ] **Step 1: Write the failing test**

Create `src/components/lis/ParameterCriteriaTabs.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ParameterItem } from "@/lib/api";
import { ParameterCriteriaTabs } from "./ParameterCriteriaTabs";

const parameters: ParameterItem[] = [
  {
    _id: "p1",
    name: "สารสำคัญ",
    scope: "qc",
    valueFields: [
      {
        label: "ปริมาณ",
        type: "number",
        substanceMode: true,
        substanceStandards: [{ substance: "ABAMECTIN", operator: "gte", value: 95 }],
      },
      {
        label: "%AI",
        type: "number",
        labelToleranceMode: true,
        labelToleranceStandards: [{ substance: "ABAMECTIN", labelPercent: 1, autoPct: 25, headPct: 15 }],
      },
    ],
  },
];

describe("ParameterCriteriaTabs", () => {
  it("renders the existing list content in the list tab", () => {
    render(
      <ParameterCriteriaTabs
        value="list"
        onValueChange={() => undefined}
        parameters={parameters}
        scope="qc"
        onEditField={() => undefined}
      >
        <div>original parameter list</div>
      </ParameterCriteriaTabs>,
    );

    expect(screen.getByText("original parameter list")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /แยกตามสาร/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /ตาม %สาร/ })).toBeInTheDocument();
  });

  it("renders substance table rows and calls edit callback", () => {
    const onEditField = vi.fn();
    const onValueChange = vi.fn();
    render(
      <ParameterCriteriaTabs
        value="substance"
        onValueChange={onValueChange}
        parameters={parameters}
        scope="qc"
        onEditField={onEditField}
      >
        <div>original parameter list</div>
      </ParameterCriteriaTabs>,
    );

    expect(screen.getByText("ABAMECTIN")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "แก้ไข แยกตามสาร ปริมาณ" }));
    expect(onEditField).toHaveBeenCalledWith("substance", "p1", 0);
  });

  it("renders an empty state for a tab with no rows", () => {
    render(
      <ParameterCriteriaTabs
        value="conditional"
        onValueChange={() => undefined}
        parameters={parameters}
        scope="qc"
        onEditField={() => undefined}
      >
        <div>original parameter list</div>
      </ParameterCriteriaTabs>,
    );

    expect(screen.getByText("ยังไม่มีข้อมูลในมุมมองนี้")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/components/lis/ParameterCriteriaTabs.test.tsx
```

Expected: FAIL because `ParameterCriteriaTabs.tsx` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/lis/ParameterCriteriaTabs.tsx`:

```tsx
import type { ReactNode } from "react";
import { Pencil } from "lucide-react";
import type { ParameterItem, ParameterScope } from "@/lib/api";
import {
  type AdvancedCriteriaMode,
  buildConditionalCriteriaRows,
  buildLabelToleranceCriteriaRows,
  buildSubstanceCriteriaRows,
} from "@/lib/parameterCriteriaRows";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type ParameterCriteriaTab = "list" | AdvancedCriteriaMode;

type ParameterCriteriaTabsProps = {
  value: ParameterCriteriaTab;
  onValueChange: (value: ParameterCriteriaTab) => void;
  parameters: ParameterItem[];
  scope: ParameterScope;
  children: ReactNode;
  onEditField: (mode: AdvancedCriteriaMode, parameterId: string, fieldIndex: number) => void;
};

export function ParameterCriteriaTabs({
  value,
  onValueChange,
  parameters,
  scope,
  children,
  onEditField,
}: ParameterCriteriaTabsProps) {
  const substanceRows = buildSubstanceCriteriaRows(parameters, scope);
  const conditionalRows = buildConditionalCriteriaRows(parameters, scope);
  const labelRows = buildLabelToleranceCriteriaRows(parameters, scope);

  return (
    <Tabs value={value} onValueChange={(next) => onValueChange(next as ParameterCriteriaTab)}>
      <TabsList className="mb-4 grid w-full grid-cols-2 lg:inline-grid lg:w-auto lg:grid-cols-4">
        <TabsTrigger value="list">รายการพารามิเตอร์</TabsTrigger>
        <TabsTrigger value="substance">แยกตามสาร</TabsTrigger>
        <TabsTrigger value="conditional">เงื่อนไขพิเศษ</TabsTrigger>
        <TabsTrigger value="labelTolerance">ตาม %สาร</TabsTrigger>
      </TabsList>

      <TabsContent value="list" className="mt-0">
        {children}
      </TabsContent>

      <TabsContent value="substance" className="mt-0">
        <TableShell empty={substanceRows.length === 0}>
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead>Parameter</TableHead>
                <TableHead>Field</TableHead>
                <TableHead>สาร</TableHead>
                <TableHead>เงื่อนไข</TableHead>
                <TableHead>ค่า</TableHead>
                <TableHead>ค่า 2</TableHead>
                <TableHead>หัวหน้า QC</TableHead>
                <TableHead className="text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {substanceRows.map((row) => (
                <TableRow key={row.rowId}>
                  <TableCell className="font-medium">{row.parameterName}</TableCell>
                  <TableCell>{row.fieldLabel}</TableCell>
                  <TableCell>{row.substance}</TableCell>
                  <TableCell>{row.operator}</TableCell>
                  <TableCell>{row.value ?? "-"}</TableCell>
                  <TableCell>{row.value2 ?? "-"}</TableCell>
                  <TableCell>{row.headOnly ? <Badge variant="secondary">ใช่</Badge> : "-"}</TableCell>
                  <TableCell className="text-right">
                    <EditButton
                      label={`แก้ไข แยกตามสาร ${row.fieldLabel}`}
                      onClick={() => onEditField("substance", row.parameterId, row.fieldIndex)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableShell>
      </TabsContent>

      <TabsContent value="conditional" className="mt-0">
        <TableShell empty={conditionalRows.length === 0}>
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead>Parameter</TableHead>
                <TableHead>Field</TableHead>
                <TableHead>ลำดับ</TableHead>
                <TableHead>ชื่อกฎ</TableHead>
                <TableHead>เงื่อนไข</TableHead>
                <TableHead>ผลลัพธ์/เกณฑ์</TableHead>
                <TableHead className="text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {conditionalRows.map((row) => (
                <TableRow key={row.rowId}>
                  <TableCell className="font-medium">{row.parameterName}</TableCell>
                  <TableCell>{row.fieldLabel}</TableCell>
                  <TableCell>{row.ruleIndex == null ? "-" : row.ruleIndex + 1}</TableCell>
                  <TableCell>{row.ruleLabel}</TableCell>
                  <TableCell>{row.conditionsText}</TableCell>
                  <TableCell>{row.resultText}</TableCell>
                  <TableCell className="text-right">
                    <EditButton
                      label={`แก้ไข เงื่อนไขพิเศษ ${row.fieldLabel}`}
                      onClick={() => onEditField("conditional", row.parameterId, row.fieldIndex)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableShell>
      </TabsContent>

      <TabsContent value="labelTolerance" className="mt-0">
        <TableShell empty={labelRows.length === 0}>
          <Table className="min-w-[1100px]">
            <TableHeader>
              <TableRow>
                <TableHead>Parameter</TableHead>
                <TableHead>Field</TableHead>
                <TableHead>สาร/ตัวเลือก</TableHead>
                <TableHead>% ยา</TableHead>
                <TableHead>เกณฑ์คลาดเคลื่อน%</TableHead>
                <TableHead>ค่าต่ำสุด</TableHead>
                <TableHead>25% ล่าง</TableHead>
                <TableHead>25% บน</TableHead>
                <TableHead>ค่าสูงสุด</TableHead>
                <TableHead className="text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {labelRows.map((row) => (
                <TableRow key={row.rowId}>
                  <TableCell className="font-medium">{row.parameterName}</TableCell>
                  <TableCell>{row.fieldLabel}</TableCell>
                  <TableCell>{row.selectorText}</TableCell>
                  <TableCell>{row.drugPercent}</TableCell>
                  <TableCell>{row.tolerancePercent}</TableCell>
                  <TableCell>{row.failLow}</TableCell>
                  <TableCell>{row.passLow}</TableCell>
                  <TableCell>{row.passHigh}</TableCell>
                  <TableCell>{row.failHigh}</TableCell>
                  <TableCell className="text-right">
                    <EditButton
                      label={`แก้ไข ตาม %สาร ${row.fieldLabel}`}
                      onClick={() => onEditField("labelTolerance", row.parameterId, row.fieldIndex)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableShell>
      </TabsContent>
    </Tabs>
  );
}

function TableShell({ empty, children }: { empty: boolean; children: ReactNode }) {
  if (empty) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        ยังไม่มีข้อมูลในมุมมองนี้
      </div>
    );
  }
  return <div className="overflow-x-auto rounded-md border">{children}</div>;
}

function EditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="icon" aria-label={label} title={label} onClick={onClick}>
      <Pencil className="h-4 w-4" />
    </Button>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run src/components/lis/ParameterCriteriaTabs.test.tsx src/lib/parameterCriteriaRows.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -- src/components/lis/ParameterCriteriaTabs.tsx src/components/lis/ParameterCriteriaTabs.test.tsx
git commit -m "feat(param): add criteria table tabs"
```

---

### Task 3: Wire Criteria Tabs Into ParameterSettings

**Files:**
- Modify: `src/pages/ParameterSettings.tsx`

**Interfaces:**
- Consumes: `ParameterCriteriaTabs`, `ParameterCriteriaTab` from `src/components/lis/ParameterCriteriaTabs.tsx`
- Consumes: `AdvancedCriteriaMode` from `src/lib/parameterCriteriaRows.ts`
- Produces local editor state:
  - `type CriteriaEditorTarget = { mode: AdvancedCriteriaMode; parameterId: string; fieldIndex: number }`
  - `handleEditCriteriaField(mode: AdvancedCriteriaMode, parameterId: string, fieldIndex: number): void`
  - `handleSaveCriteriaField(nextField: ParameterValueField): Promise<void>`

- [ ] **Step 1: Write the failing test**

Add this test file `src/pages/__tests__/ParameterSettings.criteria-tabs.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ParameterSettings from "../ParameterSettings";

const getParameters = vi.fn();
const updateParameter = vi.fn();

vi.mock("@/components/lis/AppLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/lis/PageHeader", () => ({
  default: ({ title, actions }: { title: React.ReactNode; actions?: React.ReactNode }) => (
    <header>
      <h1>{title}</h1>
      {actions}
    </header>
  ),
}));

vi.mock("@/components/lis/SubstanceStandardsDialog", () => ({
  SubstanceStandardsDialog: ({ open, field, onSave }: any) =>
    open ? (
      <button type="button" onClick={() => onSave([...(field.substanceStandards ?? []), { substance: "NEW", operator: "gte", value: 1 }])}>
        save substance dialog
      </button>
    ) : null,
}));

vi.mock("@/components/lis/ConditionalStandardsDialog", () => ({
  ConditionalStandardsDialog: ({ open }: any) =>
    open ? <div>conditional dialog open</div> : null,
}));

vi.mock("@/components/lis/LabelToleranceDialog", () => ({
  LabelToleranceDialog: ({ open }: any) =>
    open ? <div>label tolerance dialog open</div> : null,
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: {
      getParameters,
      updateParameter,
      createParameter: vi.fn(),
      deleteParameter: vi.fn(),
      get: vi.fn().mockResolvedValue({ data: { data: [] } }),
    },
  };
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ParameterSettings />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("ParameterSettings criteria tabs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getParameters.mockResolvedValue([
      {
        _id: "p1",
        name: "สารสำคัญ",
        scope: "qc",
        status: "active",
        applyAll: true,
        valueFields: [
          {
            label: "ปริมาณ",
            type: "number",
            substanceMode: true,
            substanceStandards: [{ substance: "ABAMECTIN", operator: "gte", value: 95 }],
          },
        ],
      },
    ]);
    updateParameter.mockResolvedValue({});
  });

  it("shows criteria tabs and saves through existing parameter update flow", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("tab", { name: "แยกตามสาร" }));
    expect(await screen.findByText("ABAMECTIN")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "แก้ไข แยกตามสาร ปริมาณ" }));
    fireEvent.click(screen.getByText("save substance dialog"));

    await waitFor(() => expect(updateParameter).toHaveBeenCalledTimes(1));
    expect(updateParameter.mock.calls[0][0]).toBe("p1");
    expect(updateParameter.mock.calls[0][1].valueFields[0].substanceStandards).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/pages/__tests__/ParameterSettings.criteria-tabs.test.tsx
```

Expected: FAIL because `ParameterSettings` does not render `ParameterCriteriaTabs` yet.

- [ ] **Step 3: Write minimal implementation**

Modify imports near the top of `src/pages/ParameterSettings.tsx`:

```ts
import { ParameterCriteriaTabs, type ParameterCriteriaTab } from "@/components/lis/ParameterCriteriaTabs";
import type { AdvancedCriteriaMode } from "@/lib/parameterCriteriaRows";
```

Add local type near other page-level types:

```ts
type CriteriaEditorTarget = {
  mode: AdvancedCriteriaMode;
  parameterId: string;
  fieldIndex: number;
};
```

Inside `ParameterSettings()`, add state after the existing `scopeTab` state:

```ts
const [criteriaTab, setCriteriaTab] = useState<ParameterCriteriaTab>("list");
const [criteriaEditor, setCriteriaEditor] = useState<CriteriaEditorTarget | null>(null);
const [criteriaSaveBusy, setCriteriaSaveBusy] = useState(false);
```

Add derived target and handlers before `return`:

```ts
const criteriaParameter = useMemo(
  () => parameters.find((parameter) => parameter._id === criteriaEditor?.parameterId),
  [criteriaEditor?.parameterId, parameters],
);

const criteriaField = criteriaParameter && criteriaEditor
  ? criteriaParameter.valueFields?.[criteriaEditor.fieldIndex]
  : undefined;

const handleEditCriteriaField = (
  mode: AdvancedCriteriaMode,
  parameterId: string,
  fieldIndex: number,
) => {
  const parameter = parameters.find((item) => item._id === parameterId);
  const field = parameter?.valueFields?.[fieldIndex];
  if (!parameter || !field) {
    toast.error("ไม่พบ parameter หรือ field ที่ต้องการแก้ไข");
    return;
  }
  setCriteriaEditor({ mode, parameterId, fieldIndex });
};

const handleSaveCriteriaField = async (nextField: ParameterValueField) => {
  if (!criteriaEditor || !criteriaParameter?._id) {
    toast.error("ไม่พบ parameter หรือ field ที่ต้องการบันทึก");
    return;
  }
  const nextFields = [...(criteriaParameter.valueFields ?? [])];
  nextFields[criteriaEditor.fieldIndex] = nextField;
  const payload: ParameterItem = { ...criteriaParameter, valueFields: nextFields };
  setCriteriaSaveBusy(true);
  try {
    await api.updateParameter(criteriaParameter._id, payload);
    toast.success("บันทึกเกณฑ์สำเร็จ");
    setCriteriaEditor(null);
    queryClient.invalidateQueries({ queryKey: ["parameters"] });
  } catch (err) {
    toast.error((err as Error).message || "บันทึกเกณฑ์ไม่สำเร็จ");
  } finally {
    setCriteriaSaveBusy(false);
  }
};
```

Wrap the existing parameter list `Card` with `ParameterCriteriaTabs`. The existing `Card` must remain unchanged as the `children` for the `list` tab:

```tsx
<ParameterCriteriaTabs
  value={criteriaTab}
  onValueChange={setCriteriaTab}
  parameters={parameters}
  scope={scopeTab}
  onEditField={handleEditCriteriaField}
>
  <Card>
    {/* existing CardHeader and CardContent table stay here unchanged */}
  </Card>
</ParameterCriteriaTabs>
```

Add dialog rendering after `ParameterDialog` and before the delete confirmation dialog:

```tsx
{criteriaEditor && criteriaField ? (
  criteriaEditor.mode === "substance" ? (
    <SubstanceStandardsDialog
      open
      field={criteriaField}
      onClose={() => !criteriaSaveBusy && setCriteriaEditor(null)}
      onSave={(next) => handleSaveCriteriaField({ ...criteriaField, substanceStandards: next })}
    />
  ) : criteriaEditor.mode === "conditional" ? (
    <ConditionalStandardsDialog
      open
      field={criteriaField}
      allParameters={parameters}
      currentParameterId={criteriaParameter?._id}
      siblingFields={(criteriaParameter?.valueFields ?? []).filter((_, index) => index !== criteriaEditor.fieldIndex)}
      resultMode={criteriaField.conditionalResult ?? "standard"}
      onClose={() => !criteriaSaveBusy && setCriteriaEditor(null)}
      onSave={(next) => handleSaveCriteriaField({ ...criteriaField, conditionalStandards: next })}
    />
  ) : (
    <LabelToleranceDialog
      open
      field={criteriaField}
      onClose={() => !criteriaSaveBusy && setCriteriaEditor(null)}
      onSave={(next) => handleSaveCriteriaField({ ...criteriaField, labelToleranceStandards: next })}
    />
  )
) : null}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run src/pages/__tests__/ParameterSettings.criteria-tabs.test.tsx src/components/lis/ParameterCriteriaTabs.test.tsx src/lib/parameterCriteriaRows.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -- src/pages/ParameterSettings.tsx src/pages/__tests__/ParameterSettings.criteria-tabs.test.tsx
git commit -m "feat(param): wire criteria tables to settings"
```

---

### Task 4: Verification And Cleanup

**Files:**
- Modify only files touched by Tasks 1-3 if verification exposes defects.

**Interfaces:**
- Consumes the completed source/test changes.
- Produces passing focused tests and TypeScript verification.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npx vitest run src/lib/parameterCriteriaRows.test.ts src/components/lis/ParameterCriteriaTabs.test.tsx src/pages/__tests__/ParameterSettings.criteria-tabs.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run relevant existing tests**

Run:

```bash
npx vitest run src/lib/parameterValidation.test.ts
```

Expected: PASS. This confirms the new management view did not require changes to existing abnormal logic.

- [ ] **Step 3: Type-check**

Run:

```bash
npx tsc --noEmit
```

Expected: exits 0. If TypeScript reports errors in the new files, fix the exact types and rerun this command.

- [ ] **Step 4: Review git diff**

Run:

```bash
git diff -- src/lib/parameterCriteriaRows.ts src/lib/parameterCriteriaRows.test.ts src/components/lis/ParameterCriteriaTabs.tsx src/components/lis/ParameterCriteriaTabs.test.tsx src/pages/ParameterSettings.tsx src/pages/__tests__/ParameterSettings.criteria-tabs.test.tsx
```

Expected: diff only contains the helper, tests, component, and `ParameterSettings` integration. No `assets/`, `app.html`, or build output files should be staged.

- [ ] **Step 5: Commit verification cleanup**

If Step 1-4 required fixes, commit them:

```bash
git add -- src/lib/parameterCriteriaRows.ts src/lib/parameterCriteriaRows.test.ts src/components/lis/ParameterCriteriaTabs.tsx src/components/lis/ParameterCriteriaTabs.test.tsx src/pages/ParameterSettings.tsx src/pages/__tests__/ParameterSettings.criteria-tabs.test.tsx
git commit -m "fix(param): verify criteria settings tabs"
```

If Step 1-4 required no fixes, do not create an empty commit.
