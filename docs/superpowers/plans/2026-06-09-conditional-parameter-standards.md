# Conditional Parameter Standards + Last-Batch Reference — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้ field ตัวเลขในหน้า Parameter Settings ตั้งเกณฑ์ค่าปกติแบบ "เงื่อนไขพิเศษ" (กฎ if เรียงลำดับ first-match อ้างค่าจาก field อื่น) และโชว์ "ค่าแบชล่าสุด" ของ common name เดียวกันไว้เทียบ (display-only, QC ก่อน)

**Architecture:** เพิ่ม data model `conditionalStandards[]` + `showLastBatch` บน `ParameterValueField`. Logic การ resolve เกณฑ์ตามบริบทอยู่ใน `parameterValidation.ts` (pure, มี unit test) แล้วหน้าตรวจห่อ field ผ่าน virtual-field helper เพื่อ reuse `isFieldAbnormal` เดิมโดยไม่แก้ `TestField`. Backend mirror `resolveStandard` ใน `qcResults.js` เพื่อให้ badge หน้า list ตรงกัน. Feature B denormalize `commonName` ลงผลตรวจ (client ส่ง) + endpoint ใหม่ดึงค่าล่าสุด.

**Tech Stack:** React 18 + TS + Vite, Vitest, Express + Mongoose. Type-check: `npx tsc -p tsconfig.app.json`. Tests: `npm run test`.

**Spec:** `docs/superpowers/specs/2026-06-09-conditional-parameter-standards-design.md`

**⚠️ Commit hygiene:** รีโปมี committer อื่น commit แทรกได้ — ทุก commit ใช้ explicit pathspec (`git add <ไฟล์ที่ระบุ>` เท่านั้น ห้าม `git add -A`/`git add .`).

---

## File Structure

Frontend:
- `src/lib/api.ts` — types `StandardCondition`, `StandardRule`, `StandardConditionOp`; เพิ่ม field flags; เพิ่ม endpoint `getLastBatchValues`; เพิ่ม `commonName` ใน save payload
- `src/lib/parameterValidation.ts` — `resolveStandard`, `evalCondition`, `resolveFieldStandard`, ctx-aware abnormal; แก้ `countAbnormalInResults`
- `src/lib/parameterValidation.test.ts` — tests ของข้างบน
- `src/lib/standardOperators.ts` — `describeRule`, `describeResolvedStandard`
- `src/components/lis/ConditionalStandardsDialog.tsx` — **ใหม่**: editor กฎ
- `src/pages/ParameterSettings.tsx` — โหมดเกณฑ์ 3 แบบ + dialog wiring + preview + checkbox B
- `src/pages/QCTestingDetailPage.tsx` — build ctx + apply resolved standard + live display + ค่าแบชล่าสุด
- `src/pages/LabTestingDetailPage.tsx` — build ctx + apply resolved standard + live display (A เท่านั้น)
- `src/types/petition.types.ts` — เพิ่ม `commonName` ใน `SaveQCResultPayload`

Backend:
- `server/models/QCTestResult.js` — `commonName` + index
- `server/routes/qcResults.js` — รับ `commonName` ตอน save; mirror `resolveStandard`; endpoint `last-values`

---

## Phase 0 — Data model (types)

### Task 1: เพิ่ม types บน api.ts

**Files:**
- Modify: `src/lib/api.ts` (รอบบรรทัด 611–650, บล็อก `ParameterValueField`)

- [ ] **Step 1: เพิ่ม type ใหม่ + field flags**

ใน `src/lib/api.ts` ใต้ `export type StandardOperator = ...` (รอบบรรทัด 613–621) เพิ่ม:

```ts
export type StandardConditionOp = "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "between";

export type StandardCondition = {
  sourceParameterId?: string | null;  // null/ว่าง = field พี่น้องใน parameter เดียวกัน
  sourceFieldLabel: string;
  op: StandardConditionOp;
  value: string | number;
  value2?: number | null;             // ใช้กับ between
};

export type StandardRule = {
  label?: string;                     // ป้ายชื่อกฎ เช่น "ก้อนใหญ่"
  conditions: StandardCondition[];    // AND กันทุกตัว; ว่าง = เข้าเสมอ (default row)
  operator: StandardOperator;
  value: number | null;
  value2?: number | null;
};
```

ใน `export type ParameterValueField = { ... }` (รอบบรรทัด 633–688) ใต้ `substanceStandards?: SubstanceStandard[];` เพิ่ม:

```ts
  // Conditional standards (number/float). เมื่อ conditionalMode = true
  // standardOperator/standardValue และ substance* ถูก ignore.
  conditionalMode?: boolean;
  conditionalStandards?: StandardRule[];
  // โชว์ค่า field เดียวกันจากผลตรวจครั้งก่อนของ common name เดียวกัน (display-only)
  showLastBatch?: boolean;
```

- [ ] **Step 2: type-check**

Run: `npx tsc -p tsconfig.app.json`
Expected: ไม่มี error ใหม่จากไฟล์ที่แก้ (อาจมี latent error เดิม ~12 จุดในรีโป — ไม่ใช่จากไฟล์นี้)

- [ ] **Step 3: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat(parameter): add conditional-standards + showLastBatch types"
```

---

## Phase 1 — resolve logic (pure, TDD)

### Task 2: evalCondition

**Files:**
- Modify: `src/lib/parameterValidation.ts`
- Test: `src/lib/parameterValidation.test.ts`

- [ ] **Step 1: เขียน failing test**

เพิ่มท้าย `src/lib/parameterValidation.test.ts` (import ของเดิมด้านบนไฟล์ — เพิ่มชื่อใหม่ที่ใช้):

```ts
import { evalCondition, resolveStandard, resolveFieldStandard } from "./parameterValidation";
import type { ConditionContext } from "./parameterValidation";

const ctx = (sameParam: Record<string, unknown>, otherParams: Record<string, Record<string, unknown>> = {}): ConditionContext =>
  ({ sameParam, otherParams });

describe("evalCondition", () => {
  it("eq matches enum string from sibling field", () => {
    expect(evalCondition(
      { sourceFieldLabel: "ลักษณะ", op: "eq", value: "ก้อนใหญ่" },
      ctx({ "ลักษณะ": "ก้อนใหญ่" }),
    )).toBe(true);
  });

  it("eq fails when sibling value missing", () => {
    expect(evalCondition(
      { sourceFieldLabel: "ลักษณะ", op: "eq", value: "ก้อนใหญ่" },
      ctx({}),
    )).toBe(false);
  });

  it("ne is the inverse of eq", () => {
    expect(evalCondition(
      { sourceFieldLabel: "ลักษณะ", op: "ne", value: "ก้อนเล็ก" },
      ctx({ "ลักษณะ": "ก้อนใหญ่" }),
    )).toBe(true);
  });

  it("numeric gte compares as numbers", () => {
    expect(evalCondition(
      { sourceFieldLabel: "ขนาด", op: "gte", value: 10 },
      ctx({ "ขนาด": "12" }),
    )).toBe(true);
    expect(evalCondition(
      { sourceFieldLabel: "ขนาด", op: "gte", value: 10 },
      ctx({ "ขนาด": "9" }),
    )).toBe(false);
  });

  it("between is inclusive", () => {
    const c = { sourceFieldLabel: "x", op: "between" as const, value: 5, value2: 10 };
    expect(evalCondition(c, ctx({ x: 5 }))).toBe(true);
    expect(evalCondition(c, ctx({ x: 10 }))).toBe(true);
    expect(evalCondition(c, ctx({ x: 11 }))).toBe(false);
  });

  it("reads from another parameter via sourceParameterId", () => {
    expect(evalCondition(
      { sourceParameterId: "P2", sourceFieldLabel: "สี", op: "eq", value: "แดง" },
      ctx({}, { P2: { "สี": "แดง" } }),
    )).toBe(true);
  });
});
```

- [ ] **Step 2: รัน test ให้ fail**

Run: `npm run test -- parameterValidation`
Expected: FAIL — `evalCondition is not a function`

- [ ] **Step 3: implement evalCondition**

ใน `src/lib/parameterValidation.ts` แก้ import บรรทัดบนสุดให้รวม type ใหม่:

```ts
import type { ParameterItem, ParameterValueField, TimerUnit, SubstanceStandard, StandardCondition, StandardRule, StandardOperator } from "./api";
```

เพิ่มท้ายไฟล์:

```ts
export type ConditionContext = {
  // ค่าของ field ใน parameter ที่กำลังตรวจ (key = field label)
  sameParam: Record<string, unknown>;
  // ค่าจาก parameter อื่นของ item เดียวกัน: parameterId -> (fieldLabel -> value)
  otherParams: Record<string, Record<string, unknown>>;
};

function conditionSourceValue(cond: StandardCondition, ctx: ConditionContext): unknown {
  if (cond.sourceParameterId) {
    return ctx.otherParams[cond.sourceParameterId]?.[cond.sourceFieldLabel];
  }
  return ctx.sameParam[cond.sourceFieldLabel];
}

export function evalCondition(cond: StandardCondition, ctx: ConditionContext): boolean {
  const raw = conditionSourceValue(cond, ctx);
  if (raw === null || raw === undefined || raw === "") return false;
  const target = cond.value;

  switch (cond.op) {
    case "eq":
    case "ne": {
      const targetNum = typeof target === "number" ? target : Number(target);
      const rawNum = Number(raw);
      const numericPair =
        target !== "" && !Number.isNaN(targetNum) && raw !== "" && !Number.isNaN(rawNum);
      const equal = numericPair ? rawNum === targetNum : String(raw) === String(target);
      return cond.op === "eq" ? equal : !equal;
    }
    case "gt":
    case "gte":
    case "lt":
    case "lte":
    case "between": {
      const n = Number(raw);
      const t = typeof target === "number" ? target : Number(target);
      if (Number.isNaN(n) || Number.isNaN(t)) return false;
      if (cond.op === "gt") return n > t;
      if (cond.op === "gte") return n >= t;
      if (cond.op === "lt") return n < t;
      if (cond.op === "lte") return n <= t;
      const t2 = cond.value2 == null ? NaN : Number(cond.value2);
      if (Number.isNaN(t2)) return false;
      return n >= t && n <= t2;
    }
    default:
      return false;
  }
}
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `npm run test -- parameterValidation`
Expected: PASS (evalCondition block เขียว)

- [ ] **Step 5: Commit**

```bash
git add src/lib/parameterValidation.ts src/lib/parameterValidation.test.ts
git commit -m "feat(validation): evalCondition for conditional standards"
```

### Task 3: resolveStandard + resolveFieldStandard

**Files:**
- Modify: `src/lib/parameterValidation.ts`
- Test: `src/lib/parameterValidation.test.ts`

- [ ] **Step 1: เขียน failing test**

เพิ่มใน `src/lib/parameterValidation.test.ts`:

```ts
const condField = (rules): ParameterValueField => ({
  label: "น้ำหนัก", type: "number", unit: "ก.",
  conditionalMode: true, conditionalStandards: rules,
});

describe("resolveStandard", () => {
  const rules = [
    { label: "ก้อนใหญ่", conditions: [{ sourceFieldLabel: "ลักษณะ", op: "eq", value: "ก้อนใหญ่" }], operator: "between", value: 23.5, value2: 26 },
    { label: "ก้อนเล็ก", conditions: [{ sourceFieldLabel: "ลักษณะ", op: "eq", value: "ก้อนเล็ก" }], operator: "between", value: 5.5, value2: 5.6 },
  ];

  it("returns the first matching rule's standard", () => {
    const r = resolveStandard(condField(rules), ctx({ "ลักษณะ": "ก้อนใหญ่" }));
    expect(r).toMatchObject({ operator: "between", value: 23.5, value2: 26, matchedRuleLabel: "ก้อนใหญ่" });
  });

  it("returns null when no rule matches", () => {
    expect(resolveStandard(condField(rules), ctx({}))).toBeNull();
  });

  it("empty-conditions rule acts as default (always matches, placed last)", () => {
    const withDefault = [...rules, { conditions: [], operator: "between" as const, value: 0, value2: 100 }];
    const r = resolveStandard(condField(withDefault), ctx({ "ลักษณะ": "อื่นๆ" }));
    expect(r).toMatchObject({ operator: "between", value: 0, value2: 100 });
  });

  it("non-conditional field falls back to single standard", () => {
    const f: ParameterValueField = { label: "x", type: "number", standardOperator: "lt", standardValue: 5 };
    expect(resolveStandard(f, ctx({}))).toMatchObject({ operator: "lt", value: 5, value2: null });
  });

  it("resolveFieldStandard injects resolved standard so isFieldAbnormal works", () => {
    const vf = resolveFieldStandard(condField(rules), ctx({ "ลักษณะ": "ก้อนใหญ่" }));
    expect(vf.conditionalMode).toBe(false);
    expect(isFieldAbnormal(vf, 30)).toBe(true);   // 30 อยู่นอก 23.5–26
    expect(isFieldAbnormal(vf, 24)).toBe(false);
  });

  it("resolveFieldStandard with no match → no abnormal check", () => {
    const vf = resolveFieldStandard(condField(rules), ctx({}));
    expect(isFieldAbnormal(vf, 9999)).toBe(false);
  });
});
```

- [ ] **Step 2: รัน test ให้ fail**

Run: `npm run test -- parameterValidation`
Expected: FAIL — `resolveStandard is not a function`

- [ ] **Step 3: implement**

เพิ่มใน `src/lib/parameterValidation.ts` (ใต้ `evalCondition`):

```ts
export type ResolvedStandard = {
  operator: StandardOperator;
  value: number | null;
  value2: number | null;
  matchedRuleLabel?: string;
} | null;

export function resolveStandard(
  field: ParameterValueField,
  ctx: ConditionContext,
): ResolvedStandard {
  if (!field.conditionalMode) {
    if (!field.standardOperator || field.standardValue == null) return null;
    return {
      operator: field.standardOperator,
      value: field.standardValue,
      value2: field.standardValue2 ?? null,
    };
  }
  for (const rule of field.conditionalStandards ?? []) {
    const matched = (rule.conditions ?? []).every((c) => evalCondition(c, ctx));
    if (matched) {
      return {
        operator: rule.operator,
        value: rule.value,
        value2: rule.value2 ?? null,
        matchedRuleLabel: rule.label,
      };
    }
  }
  return null;
}

// คืน virtual field ที่ฉีดเกณฑ์ที่ resolve ได้ลงไป (conditionalMode ปิด)
// เพื่อให้ isFieldAbnormal / describeStandard เดิมทำงานได้ตรงๆ
export function resolveFieldStandard(
  field: ParameterValueField,
  ctx: ConditionContext,
): ParameterValueField {
  if (!field.conditionalMode) return field;
  const r = resolveStandard(field, ctx);
  return {
    ...field,
    conditionalMode: false,
    standardOperator: r?.operator,
    standardValue: r?.value ?? null,
    standardValue2: r?.value2 ?? null,
  };
}
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `npm run test -- parameterValidation`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/parameterValidation.ts src/lib/parameterValidation.test.ts
git commit -m "feat(validation): resolveStandard + resolveFieldStandard"
```

### Task 4: countAbnormalInResults รองรับ conditionalMode

**Files:**
- Modify: `src/lib/parameterValidation.ts` (ฟังก์ชัน `countAbnormalInResults`, รอบบรรทัด 120–152)
- Test: `src/lib/parameterValidation.test.ts`

- [ ] **Step 1: เขียน failing test**

```ts
describe("countAbnormalInResults with conditional standards", () => {
  it("counts a conditional field as abnormal using sibling value in same result", () => {
    const param: ParameterItem = {
      _id: "P1", name: "ทดสอบ", scope: "qc",
      valueFields: [
        { label: "ลักษณะ", type: "enum", options: ["ก้อนเล็ก", "ก้อนใหญ่"] },
        { label: "น้ำหนัก", type: "number", unit: "ก.", conditionalMode: true, conditionalStandards: [
          { label: "ก้อนใหญ่", conditions: [{ sourceFieldLabel: "ลักษณะ", op: "eq", value: "ก้อนใหญ่" }], operator: "between", value: 23.5, value2: 26 },
        ] },
      ],
    } as ParameterItem;
    const results = [
      { parameterId: "P1", petitionId: "X", itemSeq: 1, values: { "ลักษณะ": "ก้อนใหญ่", "น้ำหนัก": 30 } },
    ] as any;
    expect(countAbnormalInResults(results, [param])).toBe(1);
  });
});
```

- [ ] **Step 2: รัน test ให้ fail**

Run: `npm run test -- parameterValidation`
Expected: FAIL — count = 0 (ยังไม่รองรับ conditionalMode)

- [ ] **Step 3: implement**

ในฟังก์ชัน `countAbnormalInResults` (`src/lib/parameterValidation.ts`):

1. ก่อน loop `for (const r of results)` ให้ build map ของค่าทุก parameter ต่อ (petitionId,itemSeq) เพื่อใช้เป็น `otherParams`:

```ts
  // group result.values ตาม item เพื่อใช้ทำ ctx ข้าม parameter
  const valuesByItem = new Map<string, Record<string, Record<string, unknown>>>();
  for (const r of results) {
    const itemKey = `${r.petitionId}__${r.itemSeq}`;
    let bucket = valuesByItem.get(itemKey);
    if (!bucket) { bucket = {}; valuesByItem.set(itemKey, bucket); }
    bucket[String(r.parameterId)] = (r.values ?? {}) as Record<string, unknown>;
  }
```

2. ใน loop ของแต่ละ `field` ก่อนบรรทัด `if (isFieldAbnormal(field, values[field.label])) count += 1;` เพิ่มเคส conditionalMode (วางไว้หลังบล็อก `if (field.substanceMode && isNumeric)`):

```ts
      if (field.conditionalMode && isNumeric) {
        const itemKey = `${r.petitionId}__${r.itemSeq}`;
        const ctx: ConditionContext = {
          sameParam: values,
          otherParams: valuesByItem.get(itemKey) ?? {},
        };
        const vf = resolveFieldStandard(field, ctx);
        if (isFieldAbnormal(vf, values[field.label])) count += 1;
        continue;
      }
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `npm run test -- parameterValidation`
Expected: PASS (รวมทั้งไฟล์ — เทสต์เดิมต้องไม่พัง)

- [ ] **Step 5: Commit**

```bash
git add src/lib/parameterValidation.ts src/lib/parameterValidation.test.ts
git commit -m "feat(validation): count conditional-standard abnormals"
```

---

## Phase 2 — describe helpers

### Task 5: describeRule + describeResolvedStandard

**Files:**
- Modify: `src/lib/standardOperators.ts`
- Test: `src/lib/standardOperators.test.ts` (สร้างใหม่ถ้ายังไม่มี)

- [ ] **Step 1: เขียน failing test**

สร้าง/แก้ `src/lib/standardOperators.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { describeRule, describeResolvedStandard } from "./standardOperators";

describe("describeResolvedStandard", () => {
  it("formats a between standard with unit", () => {
    expect(describeResolvedStandard({ operator: "between", value: 23.5, value2: 26 }, "ก.")).toBe("23.5 - 26ก.");
  });
  it("returns empty for null", () => {
    expect(describeResolvedStandard(null, "ก.")).toBe("");
  });
});

describe("describeRule", () => {
  it("summarizes label + standard", () => {
    const s = describeRule(
      { label: "ก้อนใหญ่", conditions: [{ sourceFieldLabel: "ลักษณะ", op: "eq", value: "ก้อนใหญ่" }], operator: "between", value: 23.5, value2: 26 },
      "ก.",
    );
    expect(s).toContain("ก้อนใหญ่");
    expect(s).toContain("23.5 - 26");
  });
});
```

- [ ] **Step 2: รัน test ให้ fail**

Run: `npm run test -- standardOperators`
Expected: FAIL — functions not exported

- [ ] **Step 3: implement**

ใน `src/lib/standardOperators.ts` แก้ import บนสุด + เพิ่มฟังก์ชัน:

```ts
import type { StandardOperator, SubstanceStandard, StandardRule, StandardConditionOp } from "./api";
import type { ResolvedStandard } from "./parameterValidation";

export function describeResolvedStandard(r: ResolvedStandard, unit: string): string {
  if (!r || r.value == null) return "";
  const u = unit || "";
  switch (r.operator) {
    case "lt": return `< ${r.value}${u}`;
    case "lte": return `≤ ${r.value}${u}`;
    case "eq": return `= ${r.value}${u}`;
    case "gte": return `≥ ${r.value}${u}`;
    case "gt": return `> ${r.value}${u}`;
    case "between": return r.value2 == null ? "" : `${r.value} - ${r.value2}${u}`;
    case "tolerance": return r.value2 == null ? "" : `${r.value} ± ${r.value2}%${u}`;
    default: return "";
  }
}

const COND_OP_LABEL: Record<StandardConditionOp, string> = {
  eq: "=", ne: "≠", gt: ">", gte: "≥", lt: "<", lte: "≤", between: "ช่วง",
};

export function describeRule(rule: StandardRule, unit: string): string {
  const std = describeResolvedStandard(
    { operator: rule.operator, value: rule.value, value2: rule.value2 ?? null },
    unit,
  );
  const label = rule.label?.trim() ? `${rule.label}: ` : "";
  if (rule.conditions.length === 0) {
    return `${label}default → ${std}`;
  }
  const conds = rule.conditions
    .map((c) => `${c.sourceFieldLabel} ${COND_OP_LABEL[c.op]} ${c.value}${c.op === "between" && c.value2 != null ? `–${c.value2}` : ""}`)
    .join(" และ ");
  return `${label}ถ้า ${conds} → ${std}`;
}
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `npm run test -- standardOperators`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/standardOperators.ts src/lib/standardOperators.test.ts
git commit -m "feat(standards): describeRule + describeResolvedStandard"
```

---

## Phase 3 — Editor dialog

### Task 6: ConditionalStandardsDialog (component ใหม่)

**Files:**
- Create: `src/components/lis/ConditionalStandardsDialog.tsx`

- [ ] **Step 1: สร้าง component**

สร้าง `src/components/lis/ConditionalStandardsDialog.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import type {
  ParameterItem, ParameterValueField, StandardRule, StandardCondition,
  StandardConditionOp, StandardOperator,
} from "@/lib/api";
import { OPERATOR_OPTIONS, describeRule } from "@/lib/standardOperators";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const COND_OPS: { value: StandardConditionOp; label: string }[] = [
  { value: "eq", label: "= เท่ากับ" },
  { value: "ne", label: "≠ ไม่เท่ากับ" },
  { value: "gt", label: "> มากกว่า" },
  { value: "gte", label: "≥ มากกว่าหรือเท่ากับ" },
  { value: "lt", label: "< น้อยกว่า" },
  { value: "lte", label: "≤ น้อยกว่าหรือเท่ากับ" },
  { value: "between", label: "ช่วง (between)" },
];

type SourceOption = { paramId: string | null; label: string; display: string; field: ParameterValueField };

type Props = {
  open: boolean;
  field: ParameterValueField;
  allParameters: ParameterItem[];
  currentParameterId?: string;
  siblingFields: ParameterValueField[];   // field อื่นใน parameter เดียวกัน (ตัดตัวเอง)
  onClose: () => void;
  onSave: (next: StandardRule[]) => void;
};

export function ConditionalStandardsDialog({
  open, field, allParameters, currentParameterId, siblingFields, onClose, onSave,
}: Props) {
  const unit = field.unit ?? "";
  const [rules, setRules] = useState<StandardRule[]>(field.conditionalStandards ?? []);

  useEffect(() => {
    if (open) setRules(field.conditionalStandards ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ตัวเลือก field ต้นทาง: พี่น้อง (paramId=null) + field ของ parameter อื่น
  const sources: SourceOption[] = [
    ...siblingFields.map((f) => ({ paramId: null, label: f.label, display: `${f.label} (พารามฯ นี้)`, field: f })),
    ...allParameters
      .filter((p) => String(p._id) !== String(currentParameterId))
      .flatMap((p) => (p.valueFields ?? []).map((f) => ({
        paramId: String(p._id), label: f.label, display: `${p.name} › ${f.label}`, field: f,
      }))),
  ];
  const sourceKey = (paramId: string | null, label: string) => `${paramId ?? ""}::${label}`;
  const findSource = (c: StandardCondition) =>
    sources.find((s) => sourceKey(s.paramId, s.label) === sourceKey(c.sourceParameterId ?? null, c.sourceFieldLabel));

  const patchRule = (i: number, patch: Partial<StandardRule>) =>
    setRules((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const moveRule = (i: number, dir: -1 | 1) =>
    setRules((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const removeRule = (i: number) => setRules((prev) => prev.filter((_, idx) => idx !== i));
  const addRule = (withCondition: boolean) =>
    setRules((prev) => [...prev, {
      label: "",
      conditions: withCondition ? [{ sourceFieldLabel: siblingFields[0]?.label ?? "", op: "eq", value: "" }] : [],
      operator: "between", value: null, value2: null,
    }]);

  const patchCond = (ri: number, ci: number, patch: Partial<StandardCondition>) =>
    setRules((prev) => prev.map((r, idx) => idx !== ri ? r : {
      ...r, conditions: r.conditions.map((c, k) => (k === ci ? { ...c, ...patch } : c)),
    }));
  const addCond = (ri: number) =>
    setRules((prev) => prev.map((r, idx) => idx !== ri ? r : {
      ...r, conditions: [...r.conditions, { sourceFieldLabel: siblingFields[0]?.label ?? "", op: "eq", value: "" }],
    }));
  const removeCond = (ri: number, ci: number) =>
    setRules((prev) => prev.map((r, idx) => idx !== ri ? r : {
      ...r, conditions: r.conditions.filter((_, k) => k !== ci),
    }));

  const needsValue2 = (op: StandardOperator) => op === "between" || op === "tolerance";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>เงื่อนไขพิเศษ — {field.label}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            ไล่จากบนลงล่าง เจอกฎแรกที่เข้าเงื่อนไข (AND ทุกข้อ) จะใช้เกณฑ์นั้น — อยาก OR ให้เพิ่มเป็นอีกกฎ
          </p>
        </DialogHeader>

        <div className="space-y-3">
          {rules.length === 0 && (
            <p className="text-xs text-muted-foreground">ยังไม่มีกฎ — กดเพิ่มกฎด้านล่าง</p>
          )}
          {rules.map((rule, ri) => (
            <div key={ri} className="rounded-lg border p-3 space-y-2 bg-muted/30">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground">#{ri + 1}</span>
                <Input
                  value={rule.label ?? ""}
                  onChange={(e) => patchRule(ri, { label: e.target.value })}
                  placeholder="ป้ายชื่อกฎ เช่น ก้อนใหญ่"
                  className="h-8 flex-1"
                />
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" disabled={ri === 0} onClick={() => moveRule(ri, -1)}>
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" disabled={ri === rules.length - 1} onClick={() => moveRule(ri, 1)}>
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeRule(ri)}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>

              {/* conditions (AND) */}
              <div className="space-y-1.5 pl-2 border-l-2 border-emerald-200">
                {rule.conditions.length === 0 ? (
                  <p className="text-xs text-amber-700">ไม่มีเงื่อนไข = แถว default (เข้าเสมอ) — ควรอยู่ล่างสุด</p>
                ) : rule.conditions.map((cond, ci) => {
                  const src = findSource(cond);
                  const srcIsEnum = src?.field.type === "enum";
                  return (
                    <div key={ci} className="flex flex-wrap items-center gap-1.5">
                      {ci > 0 && <span className="text-[10px] text-muted-foreground">และ</span>}
                      <Select
                        value={src ? sourceKey(src.paramId, src.label) : ""}
                        onValueChange={(v) => {
                          const s = sources.find((o) => sourceKey(o.paramId, o.label) === v);
                          if (s) patchCond(ri, ci, { sourceParameterId: s.paramId, sourceFieldLabel: s.label, value: "" });
                        }}
                      >
                        <SelectTrigger className="h-8 w-52"><SelectValue placeholder="field ต้นทาง" /></SelectTrigger>
                        <SelectContent>
                          {sources.map((s) => (
                            <SelectItem key={sourceKey(s.paramId, s.label)} value={sourceKey(s.paramId, s.label)}>
                              {s.display}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={cond.op} onValueChange={(v) => patchCond(ri, ci, { op: v as StandardConditionOp })}>
                        <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {COND_OPS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {srcIsEnum && (cond.op === "eq" || cond.op === "ne") ? (
                        <Select value={String(cond.value ?? "")} onValueChange={(v) => patchCond(ri, ci, { value: v })}>
                          <SelectTrigger className="h-8 w-40"><SelectValue placeholder="ค่า" /></SelectTrigger>
                          <SelectContent>
                            {(src?.field.options ?? []).map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={String(cond.value ?? "")}
                          onChange={(e) => patchCond(ri, ci, { value: e.target.value })}
                          placeholder="ค่า"
                          className="h-8 w-28"
                        />
                      )}
                      {cond.op === "between" && (
                        <Input
                          type="number"
                          value={cond.value2 ?? ""}
                          onChange={(e) => patchCond(ri, ci, { value2: e.target.value === "" ? null : Number(e.target.value) })}
                          placeholder="ถึง"
                          className="h-8 w-24"
                        />
                      )}
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeCond(ri, ci)}>
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  );
                })}
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => addCond(ri)}>
                  <Plus className="h-3 w-3 mr-1" /> เพิ่มเงื่อนไข
                </Button>
              </div>

              {/* resulting standard */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">→ เกณฑ์:</span>
                <Select value={rule.operator} onValueChange={(v) => patchRule(ri, { operator: v as StandardOperator })}>
                  <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OPERATOR_OPTIONS.filter((o) => o.value !== "none").map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  value={rule.value ?? ""}
                  onChange={(e) => patchRule(ri, { value: e.target.value === "" ? null : Number(e.target.value) })}
                  placeholder={rule.operator === "tolerance" ? "ค่ามาตรฐาน" : rule.operator === "between" ? "ตั้งแต่" : "ค่า"}
                  className="h-8 w-28"
                />
                {needsValue2(rule.operator) && (
                  <Input
                    type="number"
                    value={rule.value2 ?? ""}
                    onChange={(e) => patchRule(ri, { value2: e.target.value === "" ? null : Number(e.target.value) })}
                    placeholder={rule.operator === "tolerance" ? "± %" : "ถึง"}
                    className="h-8 w-24"
                  />
                )}
                {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
              </div>

              <p className="text-xs text-emerald-700">{describeRule(rule, unit)}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => addRule(true)}>
            <Plus className="h-4 w-4 mr-1" /> เพิ่มกฎ
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => addRule(false)}>
            <Plus className="h-4 w-4 mr-1" /> เพิ่มแถว default
          </Button>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button type="button" variant="primary" onClick={() => { onSave(rules); onClose(); }}>บันทึก</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: type-check**

Run: `npx tsc -p tsconfig.app.json`
Expected: ไม่มี error ใหม่จากไฟล์นี้

- [ ] **Step 3: Commit**

```bash
git add src/components/lis/ConditionalStandardsDialog.tsx
git commit -m "feat(parameter): ConditionalStandardsDialog rule editor"
```

---

## Phase 4 — Parameter Settings wiring

### Task 7: โหมดเกณฑ์ 3 แบบ + เปิด dialog + preview + checkbox B

**Files:**
- Modify: `src/pages/ParameterSettings.tsx`

- [ ] **Step 1: import + state**

ใน `src/pages/ParameterSettings.tsx`:

1. เพิ่ม import ใต้บรรทัด import `SubstanceStandardsDialog` (บรรทัด 29):

```ts
import { ConditionalStandardsDialog } from "@/components/lis/ConditionalStandardsDialog";
import { describeRule } from "@/lib/standardOperators";
```

2. ใน `ValueFieldEditor` ใต้ `const [substanceDialogOpen, setSubstanceDialogOpen] = useState(false);` (บรรทัด 963) เพิ่ม:

```ts
  const [conditionalDialogOpen, setConditionalDialogOpen] = useState(false);
```

3. ใน `emptyValueField()` (รอบบรรทัด 205) เพิ่ม default keys ใต้ `refPhase: 1,`:

```ts
  conditionalMode: false,
  conditionalStandards: [],
  showLastBatch: false,
```

- [ ] **Step 2: แทนที่ toggle เดียวด้วยตัวเลือกโหมด 3 แบบ**

ในบล็อก `requiresUnit ? (...)` (รอบบรรทัด 1222–1240) แทน `<label>...แยกเงื่อนไขตามสาร</label>` ด้วย radio 3 แบบ. หา `mode` จาก field:

```tsx
              {/* โหมดเกณฑ์ */}
              {(() => {
                const mode: "single" | "substance" | "conditional" =
                  field.conditionalMode ? "conditional" : field.substanceMode ? "substance" : "single";
                const setMode = (m: "single" | "substance" | "conditional") =>
                  onChange({
                    ...field,
                    substanceMode: m === "substance",
                    conditionalMode: m === "conditional",
                    substanceStandards: m === "substance" ? field.substanceStandards ?? [] : field.substanceStandards,
                    conditionalStandards: m === "conditional" ? field.conditionalStandards ?? [] : field.conditionalStandards,
                    // เคลียร์เกณฑ์ค่าเดียวเมื่อออกจาก single
                    standardOperator: m === "single" ? field.standardOperator : undefined,
                    standardValue: m === "single" ? field.standardValue : null,
                    standardValue2: m === "single" ? field.standardValue2 : null,
                  });
                return (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className="text-muted-foreground">โหมดเกณฑ์:</span>
                    {([["single", "ค่าเดียว"], ["substance", "แยกตามสาร"], ["conditional", "เงื่อนไขพิเศษ"]] as const).map(([m, lbl]) => (
                      <label key={m} className="flex cursor-pointer items-center gap-1.5">
                        <input type="radio" checked={mode === m} onChange={() => setMode(m)} className="h-3.5 w-3.5" />
                        {lbl}
                      </label>
                    ))}
                  </div>
                );
              })()}
```

หมายเหตุ: ลบ `<label>...แยกเงื่อนไขตามสาร</label>` (Checkbox `substanceMode`) เดิมออก. เงื่อนไขแสดงผลด้านล่างเปลี่ยนจาก `field.substanceMode ? (...) : (...)` เป็น 3 ทาง:

- `field.conditionalMode` → บล็อกใหม่ (ปุ่มเปิด dialog + preview)
- `field.substanceMode` → บล็อกเดิม (หน่วย + ปุ่มตั้งเงื่อนไขรายสาร)
- else → บล็อกเดิม (หน่วย + operator + standardValue)

- [ ] **Step 3: เพิ่มบล็อก conditional**

ก่อนบรรทัด `{field.substanceMode ? (` (รอบ 1242) ครอบด้วย conditional ก่อน. โครงใหม่:

```tsx
              {field.conditionalMode ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                    <div className="sm:col-span-3 space-y-1.5">
                      <Label className="text-sm">หน่วย *</Label>
                      <Input
                        value={field.unit ?? ""}
                        onChange={(e) => onChange({ ...field, unit: e.target.value })}
                        placeholder="เช่น %, ก., cP"
                        className="h-10"
                      />
                    </div>
                    <div className="sm:col-span-9 flex items-end">
                      <Button type="button" variant="outline" className="h-10" onClick={() => setConditionalDialogOpen(true)}>
                        ตั้งกฎ ({(field.conditionalStandards ?? []).length} กฎ)
                      </Button>
                    </div>
                  </div>
                  {(field.conditionalStandards ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">ยังไม่ได้ตั้งกฎ</p>
                  ) : (
                    <div className="space-y-0.5">
                      {(field.conditionalStandards ?? []).map((r, i) => (
                        <p key={i} className="text-xs text-emerald-700">{describeRule(r, field.unit ?? "")}</p>
                      ))}
                    </div>
                  )}
                  <ConditionalStandardsDialog
                    open={conditionalDialogOpen}
                    field={field}
                    allParameters={allParameters}
                    currentParameterId={currentParameterId}
                    siblingFields={(allParameters.find((p) => String(p._id) === String(currentParameterId))?.valueFields ?? [])
                      .filter((f) => f.label !== field.label)}
                    onClose={() => setConditionalDialogOpen(false)}
                    onSave={(next) => onChange({ ...field, conditionalStandards: next })}
                  />
                </div>
              ) : field.substanceMode ? (
```

> หมายเหตุ siblingFields: ในหน้าตั้งค่า ฟอร์มที่แก้อยู่อาจยังไม่ commit ลง `allParameters`. ถ้า `currentParameterId` หาไม่เจอใน `allParameters` (parameter ใหม่) ให้ fallback ใช้ valueFields จากฟอร์มปัจจุบัน. ดู Step 4.

- [ ] **Step 4: ส่ง siblingFields ให้ถูกต้อง (รวม field ที่ยังไม่เซฟ)**

`ValueFieldEditor` รับเฉพาะ field เดียว ไม่เห็นพี่น้องในฟอร์มเดียวกัน. แก้ props: เพิ่ม `siblingFields?: ParameterValueField[]` ใน `ValueFieldEditorProps` (รอบบรรทัด 729) และส่งจากจุดที่ render `<ValueFieldEditor .../>` (หา `valueFields.map(`). ที่จุด render ส่ง:

```tsx
                  siblingFields={(form.valueFields ?? []).filter((_, i) => i !== idx)}
```

(ใช้ `form` = state ของ parameter ที่กำลังแก้, `idx` = index ของ field ใน map). แล้วในบล็อก Step 3 เปลี่ยน prop `siblingFields={...allParameters.find...}` เป็น `siblingFields={siblingFields}`.

- [ ] **Step 5: checkbox B (showLastBatch)**

ในแถว checkbox บนสุดของ body (รอบบรรทัด 1122–1130, ที่มี "บังคับกรอก") เพิ่มถัดจาก "บังคับกรอก" — แสดงเฉพาะ type ที่รองรับ:

```tsx
            {(field.type === "number" || field.type === "float" || field.type === "enum" || field.type === "text") && (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground" title="โชว์ค่าช่องนี้จากผลตรวจครั้งก่อนของ common name เดียวกัน (เฉยๆ ไม่ตรวจ)">
                <Checkbox
                  checked={!!field.showLastBatch}
                  onCheckedChange={(v) => onChange({ ...field, showLastBatch: v === true })}
                  className="h-3.5 w-3.5"
                />
                โชว์ค่าแบชล่าสุด
              </label>
            )}
```

- [ ] **Step 6: summarizeField + StandardPreview รองรับ conditional**

ใน `summarizeField` (รอบ 669) ใน `case "number"/"float"` ก่อนเช็ค operator เพิ่มบนสุดของเคส:

```ts
      if (field.conditionalMode) {
        const n = (field.conditionalStandards ?? []).length;
        return n > 0 ? `เงื่อนไขพิเศษ ${n} กฎ` : "เงื่อนไขพิเศษ (ยังไม่ตั้งกฎ)";
      }
```

ใน `StandardPreview` (รอบ 455) ใต้ `if (field.substanceMode) {...}` เพิ่ม:

```tsx
  if (field.conditionalMode) {
    const rules = field.conditionalStandards ?? [];
    if (rules.length === 0) return <p className="text-xs text-muted-foreground">ยังไม่ได้ตั้งกฎ</p>;
    return (
      <div className="space-y-0.5">
        {rules.map((r, i) => <p key={i} className="text-xs text-emerald-700">{describeRule(r, field.unit ?? "")}</p>)}
      </div>
    );
  }
```

- [ ] **Step 7: type-check + lint**

Run: `npx tsc -p tsconfig.app.json && npm run lint`
Expected: ไม่มี error ใหม่จาก ParameterSettings.tsx

- [ ] **Step 8: Commit**

```bash
git add src/pages/ParameterSettings.tsx
git commit -m "feat(parameter-settings): conditional-standard mode + showLastBatch toggle"
```

---

## Phase 5 — Entry-page wiring (Feature A: QC + Lab)

### Task 8: QCTestingDetailPage — apply resolved standard + live display

**Files:**
- Modify: `src/pages/QCTestingDetailPage.tsx`

หลักการ: หน้านี้โหลดผลทุก parameter ของ item อยู่แล้ว. สร้าง `ConditionContext` ต่อ (item, parameter) แล้วใช้ `resolveFieldStandard` ห่อ field ก่อนส่งเข้า `TestField` — `isFieldAbnormal` กับ placeholder เดิมจะทำงานบนเกณฑ์ที่ resolve แล้วทันที.

- [ ] **Step 1: import**

แก้ import (บรรทัด 12):

```ts
import { isFieldAbnormal, expandFieldForItem, resolveFieldStandard, resolveStandard } from '@/lib/parameterValidation';
import type { ConditionContext } from '@/lib/parameterValidation';
import { describeResolvedStandard } from '@/lib/standardOperators';
```

- [ ] **Step 2: สร้าง ctx ต่อ item + ห่อ field ตอน render**

หา loop ที่ render field ต่อ parameter (รอบบรรทัด 591 และ 857 ที่เรียก `expandFieldForItem(field, item.commonName)`). ก่อน map fields ของ parameter ให้ build ctx:

```ts
// ค่าทุก field ของ parameter อื่นใน item เดียวกัน (สำหรับเงื่อนไขข้าม parameter)
const otherParamsValues: Record<string, Record<string, unknown>> = {};
for (const r of resultsForItem) {                 // ผลทุก parameter ของ item นี้
  otherParamsValues[String(r.parameterId)] = (r.values ?? {}) as Record<string, unknown>;
}
const ctx: ConditionContext = {
  sameParam: currentParamValues,                  // values ของ parameter ที่กำลัง render
  otherParams: otherParamsValues,
};
```

> `resultsForItem` / `currentParamValues`: ใช้ตัวแปรผลลัพธ์ที่หน้านี้มีอยู่แล้ว (ค่าที่ผูกกับ `value={...}` ใน TestField). ถ้ายังไม่มี map รวม ให้ derive จาก state ผล (`results`) ที่กรองด้วย `itemSeq` เดียวกัน. ดูบริบทตัวแปรจริงตอน implement.

แล้วเปลี่ยนการสร้าง unit/field ที่ส่งให้ `TestField`:

```ts
const effectiveField = field.conditionalMode ? resolveFieldStandard(field, ctx) : field;
// ใช้ effectiveField แทน field ใน expandFieldForItem(...) และ <TestField field={effectiveField} .../>
```

- [ ] **Step 3: โชว์เกณฑ์ที่ resolve ได้ใต้ช่อง (conditional)**

ใน `TestField` ใต้ block input (หลัง `)}` ของ input types รอบบรรทัด 205) เพิ่มแถบบอกเกณฑ์ — แต่ TestField รับ `field` ที่ถูก resolve แล้ว (single standard). เพื่อบอก "รอกรอกตัวกำหนด" ให้ส่ง prop เสริม `conditionalPending?: boolean` + `resolvedLabel?: string`:

ใน `TestFieldProps` เพิ่ม:

```ts
  conditionalPending?: boolean;   // conditionalMode แต่ยังไม่เข้ากฎไหน
  resolvedStandardText?: string;  // ข้อความเกณฑ์ที่ resolve ได้ (มี label)
```

ใน body ของ TestField ใต้ input เพิ่ม:

```tsx
      {conditionalPending ? (
        <p className="text-[11px] text-amber-600">ยังกำหนดเกณฑ์ไม่ได้ — รอกรอกช่องเงื่อนไข</p>
      ) : resolvedStandardText ? (
        <p className="text-[11px] text-emerald-600">เกณฑ์: {resolvedStandardText}</p>
      ) : null}
```

ตอน render ส่ง props (คำนวณจาก `field` ต้นฉบับ + ctx):

```tsx
const resolved = field.conditionalMode ? resolveStandard(field, ctx) : null;
// ...
<TestField
  field={effectiveField}
  conditionalPending={!!field.conditionalMode && !resolved}
  resolvedStandardText={resolved ? `${describeResolvedStandard(resolved, field.unit ?? "")}${resolved.matchedRuleLabel ? ` (${resolved.matchedRuleLabel})` : ""}` : undefined}
  /* ...props เดิม... */
/>
```

- [ ] **Step 4: type-check**

Run: `npx tsc -p tsconfig.app.json`
Expected: ไม่มี error ใหม่จากไฟล์นี้

- [ ] **Step 5: Commit**

```bash
git add src/pages/QCTestingDetailPage.tsx
git commit -m "feat(qc-testing): resolve conditional standards live + show resolved criterion"
```

### Task 9: LabTestingDetailPage — เหมือน QC (Feature A)

**Files:**
- Modify: `src/pages/LabTestingDetailPage.tsx`

- [ ] **Step 1: ทำซ้ำ logic ของ Task 8 บนหน้า Lab**

หน้านี้ใช้ `isFieldAbnormal` / `expandFieldForItem` เช่นกัน (ยืนยันด้วย grep). ทำตาม Task 8 Step 1–3 แบบเดียวกัน:
- import `resolveFieldStandard`, `resolveStandard`, `ConditionContext`, `describeResolvedStandard`
- build `ctx` จากผลทุก parameter ของ item
- ห่อด้วย `effectiveField = field.conditionalMode ? resolveFieldStandard(field, ctx) : field`
- ถ้าหน้า Lab มี component แสดงช่องของตัวเอง (ไม่ใช่ TestField ตัวเดียวกับ QC) ให้เพิ่มข้อความ "เกณฑ์: ..." / "รอกรอกช่องเงื่อนไข" แบบเดียวกัน

> ถ้า Lab ใช้ TestField จาก QC ร่วมกัน (import ข้ามไฟล์) ก็ส่ง props ชุดเดียวกัน. ตรวจ ณ ตอน implement ว่าใช้ component ร่วมหรือแยก.

- [ ] **Step 2: type-check**

Run: `npx tsc -p tsconfig.app.json`
Expected: ไม่มี error ใหม่

- [ ] **Step 3: Commit**

```bash
git add src/pages/LabTestingDetailPage.tsx
git commit -m "feat(lab-testing): resolve conditional standards live"
```

---

## Phase 6 — Backend mirror (abnormal-flags parity)

### Task 10: mirror resolveStandard ใน qcResults.js + ใช้ใน abnormal-flags

**Files:**
- Modify: `server/routes/qcResults.js`

- [ ] **Step 1: เพิ่ม JS mirror ของ evalCondition + resolveStandard**

ใน `server/routes/qcResults.js` ใต้ `isSubstanceAbnormalJS` (รอบบรรทัด 61) เพิ่ม:

```js
// mirror of src/lib/parameterValidation.ts evalCondition / resolveStandard — keep in sync
function conditionSourceValueJS(cond, ctx) {
  if (cond.sourceParameterId) {
    return (ctx.otherParams[String(cond.sourceParameterId)] || {})[cond.sourceFieldLabel];
  }
  return ctx.sameParam[cond.sourceFieldLabel];
}

function evalConditionJS(cond, ctx) {
  const raw = conditionSourceValueJS(cond, ctx);
  if (raw === null || raw === undefined || raw === "") return false;
  const target = cond.value;
  if (cond.op === "eq" || cond.op === "ne") {
    const tNum = typeof target === "number" ? target : Number(target);
    const rNum = Number(raw);
    const numericPair = target !== "" && !Number.isNaN(tNum) && raw !== "" && !Number.isNaN(rNum);
    const equal = numericPair ? rNum === tNum : String(raw) === String(target);
    return cond.op === "eq" ? equal : !equal;
  }
  const n = Number(raw);
  const t = typeof target === "number" ? target : Number(target);
  if (Number.isNaN(n) || Number.isNaN(t)) return false;
  if (cond.op === "gt") return n > t;
  if (cond.op === "gte") return n >= t;
  if (cond.op === "lt") return n < t;
  if (cond.op === "lte") return n <= t;
  if (cond.op === "between") {
    const t2 = cond.value2 == null ? NaN : Number(cond.value2);
    if (Number.isNaN(t2)) return false;
    return n >= t && n <= t2;
  }
  return false;
}

function resolveFieldStandardJS(field, ctx) {
  if (!field.conditionalMode) return field;
  for (const rule of field.conditionalStandards || []) {
    const matched = (rule.conditions || []).every((c) => evalConditionJS(c, ctx));
    if (matched) {
      return { ...field, conditionalMode: false, standardOperator: rule.operator, standardValue: rule.value, standardValue2: rule.value2 == null ? null : rule.value2 };
    }
  }
  return { ...field, conditionalMode: false, standardOperator: undefined, standardValue: null, standardValue2: null };
}
```

- [ ] **Step 2: ใช้ใน /abnormal-flags**

ในroute `/abnormal-flags` ปัจจุบัน loop ต่อ doc แล้วต่อ field. ต้อง build `otherParams` ต่อ (petitionId,itemSeq). แก้:

1. หลังโหลด `docs` เพิ่ม group values ต่อ item:

```js
    const valuesByItem = {};   // `${petitionId}__${itemSeq}` -> { [parameterId]: values }
    for (const d of docs) {
      const key = `${d.petitionId}__${d.itemSeq}`;
      if (!valuesByItem[key]) valuesByItem[key] = {};
      valuesByItem[key][String(d.parameterId)] = d.values || {};
    }
```

2. ในloop field ใต้บล็อก `if (field.substanceMode && isNumeric) {...}` เพิ่มก่อน `if (isFieldAbnormal(field, values[field.label]))`:

```js
        if (field.conditionalMode && isNumeric) {
          const ctx = { sameParam: values, otherParams: valuesByItem[`${d.petitionId}__${d.itemSeq}`] || {} };
          const vf = resolveFieldStandardJS(field, ctx);
          if (isFieldAbnormal(vf, values[field.label])) { map[d.petitionId] = true; break; }
          continue;
        }
```

> หมายเหตุ: route นี้ select เฉพาะ `{ petitionId, parameterId, values }` — ต้องเพิ่ม `itemSeq: 1` ใน projection ของ `QCTestResult.find(...)` ใน abnormal-flags เพื่อ group ต่อ item ได้.

- [ ] **Step 3: ทดสอบ manual**

Run backend: `cd server && npm run dev`
ยิง: เปิดหน้า QC list ของ petition ที่มี parameter conditionalMode + ค่าผิดเกณฑ์ → ต้องเห็น badge abnormal. (หรือ `curl "http://localhost:3001/api/qc-results/abnormal-flags?petitionIds=<id>"`)
Expected: petition ที่มีค่า conditional หลุดเกณฑ์ → `true`

- [ ] **Step 4: Commit**

```bash
git add server/routes/qcResults.js
git commit -m "feat(qc-results): mirror conditional-standard resolution in abnormal-flags"
```

---

## Phase 7 — Feature B backend (QC last-batch)

### Task 11: QCTestResult.commonName + save + last-values endpoint

**Files:**
- Modify: `server/models/QCTestResult.js`
- Modify: `server/routes/qcResults.js`
- Modify: `src/types/petition.types.ts`
- Modify: `src/lib/api.ts`
- Modify: `src/pages/QCTestingDetailPage.tsx` (ส่ง commonName ตอน save)

- [ ] **Step 1: เพิ่ม field + index ใน model**

ใน `server/models/QCTestResult.js` เพิ่มใน schema ใต้ `sampleName: { type: String },`:

```js
    commonName:    { type: String },
```

ใต้ index เดิม (`{ petitionId, itemSeq, parameterId }`) เพิ่ม:

```js
qcTestResultSchema.index({ commonName: 1, parameterId: 1, enteredAt: -1 });
```

> `ensureCollections()` รัน `syncIndexes()` ตอน boot — index ใหม่จะถูกสร้างเอง.

- [ ] **Step 2: รับ commonName ตอน save (PUT /)**

ในroute `PUT /` (รอบบรรทัด 203) เพิ่ม `commonName` ใน destructure ของ `req.body` และใส่ลง `$set`:

```js
    const { petitionId, petitionNo, itemSeq, sampleId, sampleName, commonName,
      parameterId, parameterName, fieldLabel, value, enteredBy, phase } = req.body;
```

ใน `update.$set` เพิ่ม `commonName,` (ถัดจาก `sampleName,`).

- [ ] **Step 3: endpoint last-values**

เพิ่ม route **ก่อน** `router.get("/:petitionId", ...)` (เพราะ `/:petitionId` จับทุกอย่าง — ต้องมาก่อน):

```js
// GET /api/qc-results/last-values?commonName=&parameterId=&excludePetitionId=
// คืนผลตรวจล่าสุดก่อนหน้าของ common name + parameter เดียวกัน (ไม่รวม petition ปัจจุบัน)
router.get("/last-values", async (req, res) => {
  try {
    const commonName = String(req.query.commonName || "").trim();
    const parameterId = String(req.query.parameterId || "").trim();
    const excludePetitionId = String(req.query.excludePetitionId || "").trim();
    if (!commonName || !parameterId) return res.json({});

    const filter = { commonName, parameterId };
    if (excludePetitionId) filter.petitionId = { $ne: excludePetitionId };

    const doc = await QCTestResult.findOne(filter)
      .sort({ enteredAt: -1, updatedAt: -1 })
      .lean();

    if (!doc) return res.json({});
    res.json({ petitionNo: doc.petitionNo, enteredAt: doc.enteredAt, values: doc.values || {} });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 4: type ฝั่ง client + api wrapper**

ใน `src/types/petition.types.ts` หา `SaveQCResultPayload` เพิ่ม `commonName?: string;`

ใน `src/lib/api.ts` ใต้ `getAbnormalFlags` เพิ่ม:

```ts
  getLastBatchValues: (commonName: string, parameterId: string, excludePetitionId: string) => {
    const qs = new URLSearchParams({ commonName, parameterId, excludePetitionId }).toString();
    return request<{ petitionNo?: string; enteredAt?: string; values?: Record<string, unknown> }>(`/qc-results/last-values?${qs}`);
  },
```

- [ ] **Step 5: ส่ง commonName ตอน save ในหน้า QC**

ใน `src/pages/QCTestingDetailPage.tsx` หาจุดเรียก `api.saveQCResult({...})` แล้วเพิ่ม `commonName: item.commonName,` ใน payload.

- [ ] **Step 6: type-check + manual**

Run: `npx tsc -p tsconfig.app.json`
Backend: `cd server && npm run dev` แล้วบันทึกผล 1 ช่อง → `curl "http://localhost:3001/api/qc-results/last-values?commonName=<cn>&parameterId=<pid>&excludePetitionId=zzz"` ต้องคืน `{ values: {...} }`
Expected: คืนค่าผลล่าสุดของ common name นั้น

- [ ] **Step 7: Commit**

```bash
git add server/models/QCTestResult.js server/routes/qcResults.js src/types/petition.types.ts src/lib/api.ts src/pages/QCTestingDetailPage.tsx
git commit -m "feat(qc-results): denormalize commonName + last-values endpoint"
```

---

## Phase 8 — Feature B frontend (โชว์ค่าแบชล่าสุด)

### Task 12: ดึง + แสดงค่าแบชล่าสุดในหน้า QC

**Files:**
- Modify: `src/pages/QCTestingDetailPage.tsx`

- [ ] **Step 1: query ค่าแบชล่าสุดต่อ (item, parameter)**

ในหน้า QC ที่ render parameter ของ item — ถ้า parameter มี field ใดเปิด `showLastBatch` และ `item.commonName` ไม่ว่าง ให้ดึงค่าครั้งเดียวด้วย React Query:

```ts
const hasLastBatch = (param.valueFields ?? []).some((f) => f.showLastBatch);
const { data: lastBatch } = useQuery({
  queryKey: ["qc-last-values", item.commonName, param._id, petitionId],
  queryFn: () => api.getLastBatchValues(item.commonName ?? "", String(param._id), petitionId),
  enabled: hasLastBatch && !!item.commonName,
  staleTime: 5 * 60 * 1000,
});
```

> ถ้า render parameter อยู่ใน sub-component อยู่แล้ว ให้วาง hook ใน sub-component นั้น (hook ห้ามอยู่ใน loop/condition). ถ้า render แบบ inline ใน map ให้แยก component ย่อย `ParameterCard` ก่อนเพื่อให้ใช้ hook ได้ — เป็น refactor เล็กที่จำเป็น.

- [ ] **Step 2: ส่งค่าเข้า TestField + แสดง**

ใน `TestFieldProps` เพิ่ม `lastBatchValue?: unknown;` และ `lastBatchLabel?: string;`. ใต้ input ของ TestField (ถัดจากบล็อกเกณฑ์ conditional) เพิ่ม:

```tsx
      {field.showLastBatch && lastBatchValue != null && String(lastBatchValue) !== "" && (
        <p className="text-[11px] text-sky-600">
          แบชก่อน{lastBatchLabel ? ` (${lastBatchLabel})` : ""}: {String(lastBatchValue)}{field.unit ? ` ${field.unit}` : ""}
        </p>
      )}
```

ตอน render ส่ง:

```tsx
lastBatchValue={field.showLastBatch ? lastBatch?.values?.[field.label] : undefined}
lastBatchLabel={lastBatch?.petitionNo}
```

- [ ] **Step 3: type-check + manual**

Run: `npx tsc -p tsconfig.app.json`
Manual: ตรวจ item ที่มีผลเก่าของ common name เดียวกัน + field เปิด showLastBatch → เห็น "แบชก่อน: X"
Expected: โชว์ค่าครั้งก่อน, ไม่กระทบ abnormal/progress

- [ ] **Step 4: Commit**

```bash
git add src/pages/QCTestingDetailPage.tsx
git commit -m "feat(qc-testing): show last-batch reference value (display-only)"
```

---

## Final verification

- [ ] **Step 1: รัน test ทั้งหมด**

Run: `npm run test`
Expected: ผ่านทั้งหมด (รวม parameterValidation + standardOperators ใหม่)

- [ ] **Step 2: type-check จริง**

Run: `npx tsc -p tsconfig.app.json`
Expected: ไม่มี error ใหม่จากงานนี้ (latent ~12 เดิมไม่นับ — เทียบกับ baseline ก่อนเริ่ม)

- [ ] **Step 3: lint**

Run: `npm run lint`
Expected: ไม่มี error ใหม่

- [ ] **Step 4: smoke test ครบลูป (manual)**

1. หน้า Parameter Settings: สร้าง field ตัวเลข → โหมด "เงื่อนไขพิเศษ" → ตั้ง 2 กฎ (ก้อนเล็ก/ก้อนใหญ่ อ้าง field enum พี่น้อง) → เปิด showLastBatch → บันทึก
2. หน้า QC ตรวจ: กรอก enum "ก้อนใหญ่" → ใต้ช่องน้ำหนักขึ้น "เกณฑ์: 23.5–26 (ก้อนใหญ่)"; กรอก 30 → ขึ้น abnormal; ยังไม่กรอก enum → "รอกรอกช่องเงื่อนไข"
3. มีผลเก่า common name เดียวกัน → เห็น "แบชก่อน: ..."
4. หน้า QC list → badge abnormal ตรงกับ detail

- [ ] **Step 5: seed:export (มี model/field ใหม่)**

Run: `cd server && npm run seed:export`
แล้ว commit `server/seed-data/` ที่เปลี่ยน (ดู memory: seed-data ต้องตรงกับ DB)

```bash
git add server/seed-data
git commit -m "chore(seed): export after conditional-standards schema change"
```

---

## Self-review notes (ผู้เขียนแผนตรวจแล้ว)

- **Spec coverage:** A (rule engine) = Task 1–10; B (last-batch, QC) = Task 11–12. ครบทุกหัวข้อ spec
- **นอกขอบเขต v1 (ตาม spec):** Lab สำหรับ B, conditional+substance พร้อมกัน, OR/nested, backfill — ไม่อยู่ในแผน (ถูกต้อง)
- **Type consistency:** `resolveFieldStandard`/`resolveStandard`/`evalCondition`/`ConditionContext`/`ResolvedStandard` ใช้ชื่อตรงกันทุก task; `StandardCondition.op` ตรงกับ `StandardConditionOp`; backend mirror ใช้ logic เดียวกับ frontend
- **ความเสี่ยงที่ต้องดูตอน implement (ไม่ใช่ placeholder แต่ต้องยืนยันบริบท):**
  - Task 8/9/12: ชื่อตัวแปรผล (`resultsForItem`, `currentParamValues`) — ต้อง map กับ state จริงของหน้า (หน้าใหญ่ ~900 บรรทัด)
  - Task 12: อาจต้องแยก `ParameterCard` sub-component เพื่อใช้ useQuery (hook rules)
  - Task 4/10: ผล QC ต้องมี `itemSeq` ใน projection ของ abnormal-flags (เพิ่มแล้วใน Task 10 Step 2)
