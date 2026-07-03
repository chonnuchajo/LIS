# Conditional Text Output (เงื่อนไขพิเศษ → ข้อความ+สถานะ) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้ช่องตัวเลขในโหมด "เงื่อนไขพิเศษ" เลือกได้ว่าผลของกฎเป็น "เกณฑ์ตัวเลข" (เดิม) หรือ "ข้อความ + สถานะปกติ/ผิดปกติ" (ใหม่) โดยเงื่อนไขอ้างค่าตัวเองได้

**Architecture:** ต่อยอด `conditionalMode`/`conditionalStandards` เดิม — เพิ่ม discriminator ระดับ field (`conditionalResult: 'standard' | 'output'`) และ 2 ฟิลด์บนกฎ (`outputText`, `outputKind`). ผลลัพธ์ข้อความคำนวณสดตอนแสดง (ไม่เก็บใน DB) ผ่านฟังก์ชันใหม่ `resolveConditionalOutput`; abnormal มาจาก kind ของกฎที่เข้า, ไม่เข้ากฎไหน = ผิดปกติ, ยังไม่กรอก = ไม่ flag

**Tech Stack:** React 18 + TypeScript (Vite), Mongoose 8, Express, Vitest (FE), node:test (BE)

## Global Constraints

- Back-compat: `conditionalResult` default `'standard'` → ข้อมูล/พฤติกรรมเดิมไม่เปลี่ยน ไม่ต้อง migrate
- คำนวณข้อความผลลัพธ์สดตอนแสดง — ห้ามเพิ่ม field เก็บข้อความใน DB
- ข้อความผลลัพธ์ให้ผู้ตรวจ **อ่านอย่างเดียว** (auto-derived)
- Blank guard: ถ้าค่าของ field เอง (`ctx.sameParam[field.label]`) ยังว่าง → ไม่ flag (คืน null)
- No-match (กรอกแล้วตกร่อง) = ผิดปกติ (`kind:'abnormal'`), text ว่าง
- FE `src/lib/parameterValidation.ts` และ BE `server/routes/qcResults.js` (JS mirror) ต้องให้ผล abnormal ตรงกัน
- Type-check จริง: `npx tsc -p tsconfig.app.json --noEmit` (root `npx tsc --noEmit` เป็น no-op)
- Commit เฉพาะไฟล์ตัวเองด้วย explicit pathspec (มี committer อื่นในรีโป)

## File Structure

- `src/lib/api.ts` — เพิ่ม 2 ฟิลด์บน `StandardRule` + `conditionalResult` บน `ParameterValueField`
- `server/models/Parameter.js` — schema fields + validation (StandardRuleSchema, ValueFieldSchema, pre-validate)
- `src/lib/parameterValidation.ts` — `ResolvedOutput`, `resolveConditionalOutput`, `isConditionalOutputAbnormal`, wire `countAbnormalInResults`
- `src/lib/standardOperators.ts` — `describeOutputRule`
- `server/routes/qcResults.js` — `resolveConditionalOutputJS` mirror + wire `/abnormal-flags`
- `src/components/lis/ConditionalStandardsDialog.tsx` — `resultMode` prop, self source, output result row
- `src/pages/ParameterSettings.tsx` — radio "ผลของกฎ" + reset + summary describe
- `src/pages/QCTestingDetailPage.tsx` / `src/pages/LabTestingDetailPage.tsx` — TestField `outputResult` prop + renderUnit compute + count
- `src/lib/qcApprovalRows.ts` — output branch (standardText + abnormal)
- Tests: `server/models/Parameter.test.js`, `src/lib/parameterValidation.test.ts`, `src/lib/standardOperators.test.ts`

---

### Task 1: Schema + types + validation

**Files:**
- Modify: `src/lib/api.ts` (StandardRule ~879-885, ParameterValueField ~905-908)
- Modify: `server/models/Parameter.js` (StandardRuleSchema ~26-32, ValueFieldSchema ~98-99, pre-validate ~226-228)
- Test: `server/models/Parameter.test.js`

**Interfaces:**
- Produces: `StandardRule.outputText?: string`, `StandardRule.outputKind?: 'normal'|'abnormal'`, `ParameterValueField.conditionalResult?: 'standard'|'output'`

- [ ] **Step 1: Write failing tests** — append to `server/models/Parameter.test.js`:

```js
test('persists conditionalResult=output with outputText/outputKind', async () => {
  const doc = new Parameter({
    name: 'ทดสอบ output',
    valueFields: [{
      label: 'ขนาดก้อน', type: 'number', unit: 'mm',
      conditionalMode: true, conditionalResult: 'output',
      conditionalStandards: [
        { label: 'เล็ก', conditions: [{ sourceFieldLabel: 'ขนาดก้อน', op: 'between', value: 5.5, value2: 6.5 }], outputText: 'ก้อนเล็ก', outputKind: 'normal' },
        { label: 'ใหญ่', conditions: [{ sourceFieldLabel: 'ขนาดก้อน', op: 'between', value: 23.5, value2: 26 }], outputText: 'ก้อนใหญ่', outputKind: 'abnormal' },
      ],
    }],
  });
  await doc.validate();
  assert.strictEqual(doc.valueFields[0].conditionalResult, 'output');
  assert.strictEqual(doc.valueFields[0].conditionalStandards[0].outputText, 'ก้อนเล็ก');
  assert.strictEqual(doc.valueFields[0].conditionalStandards[1].outputKind, 'abnormal');
});

test('defaults conditionalResult to standard', async () => {
  const doc = new Parameter({
    name: 'ทดสอบ default',
    valueFields: [{ label: 'ค่า', type: 'number', unit: '%', conditionalMode: true, conditionalStandards: [] }],
  });
  await doc.validate();
  assert.strictEqual(doc.valueFields[0].conditionalResult, 'standard');
});

test('rejects output rule with no text and no label', async () => {
  const doc = new Parameter({
    name: 'ทดสอบ blank',
    valueFields: [{
      label: 'ค่า', type: 'number', unit: '%',
      conditionalMode: true, conditionalResult: 'output',
      conditionalStandards: [{ label: '', conditions: [], outputText: '', outputKind: 'normal' }],
    }],
  });
  await assert.rejects(() => doc.validate(), /ข้อความผลลัพธ์/);
});

test('rejects output mode combined with multiple', async () => {
  const doc = new Parameter({
    name: 'ทดสอบ multiple',
    valueFields: [{
      label: 'ค่า', type: 'number', unit: '%', multiple: true,
      conditionalMode: true, conditionalResult: 'output',
      conditionalStandards: [{ label: 'ok', conditions: [], outputText: 'ok', outputKind: 'normal' }],
    }],
  });
  await assert.rejects(() => doc.validate(), /กรอกหลายค่า/);
});
```

- [ ] **Step 2: Run tests, verify FAIL**

Run: `node --test server/models/Parameter.test.js`
Expected: FAIL (conditionalResult undefined / no validation error thrown)

- [ ] **Step 3: Add schema fields** in `server/models/Parameter.js`.

In `StandardRuleSchema` (after `value2` line ~31) add:
```js
  outputText: { type: String, default: '' },
  outputKind: { type: String, enum: ['normal', 'abnormal'], default: 'normal' },
```

In `ValueFieldSchema` (after `conditionalStandards` line ~99) add:
```js
  conditionalResult: { type: String, enum: ['standard', 'output'], default: 'standard' },
```

- [ ] **Step 4: Add validation** in `Parameter.js` pre-validate, right after the `substanceMode && conditionalMode` check (~228):

```js
    if (f.conditionalMode && f.conditionalResult === 'output') {
      if (f.multiple) {
        return next(new Error(`ช่อง "${f.label}": โหมดข้อความผลลัพธ์ใช้ร่วมกับ "กรอกหลายค่า" ไม่ได้`));
      }
      for (const rule of f.conditionalStandards || []) {
        const hasText = (rule.outputText && String(rule.outputText).trim()) || (rule.label && String(rule.label).trim());
        if (!hasText) {
          return next(new Error(`ช่อง "${f.label}": ต้องระบุข้อความผลลัพธ์ของกฎ (โหมดข้อความ)`));
        }
      }
    }
```

- [ ] **Step 5: Add TS types** in `src/lib/api.ts`.

In `StandardRule` (after `value2?` line ~884) add:
```ts
  outputText?: string;                 // ข้อความผลลัพธ์ (โหมด output); ว่าง = fallback ไป label
  outputKind?: "normal" | "abnormal";  // default 'normal'
```

In `ParameterValueField` (after `conditionalStandards?` line ~908) add:
```ts
  // ชนิดผลของกฎ conditional: 'standard' (เกณฑ์ตัวเลข เดิม) | 'output' (ข้อความ+สถานะ). default 'standard'
  conditionalResult?: "standard" | "output";
```

- [ ] **Step 6: Run tests + typecheck, verify PASS**

Run: `node --test server/models/Parameter.test.js`
Expected: PASS (all tests incl. 3 new)
Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่จากไฟล์ที่แก้

- [ ] **Step 7: Commit**

```bash
git add -- src/lib/api.ts server/models/Parameter.js server/models/Parameter.test.js
git commit -m "feat(param): schema+types for conditional text-output rules"
```

---

### Task 2: resolveConditionalOutput + abnormal (FE)

**Files:**
- Modify: `src/lib/parameterValidation.ts` (add after `resolveFieldStandard` ~389; wire `countAbnormalInResults` ~228-230)
- Test: `src/lib/parameterValidation.test.ts`

**Interfaces:**
- Consumes: `ConditionContext`, `evalCondition`, `StandardRule` (Task 1 fields)
- Produces:
  - `type ResolvedOutput = { text: string; kind: 'normal'|'abnormal'; matchedRuleLabel?: string }`
  - `resolveConditionalOutput(field: ParameterValueField, ctx: ConditionContext): ResolvedOutput | null`
  - `isConditionalOutputAbnormal(field: ParameterValueField, ctx: ConditionContext): boolean`

- [ ] **Step 1: Write failing tests** — in `src/lib/parameterValidation.test.ts`, first add `resolveConditionalOutput, isConditionalOutputAbnormal` to the existing top import block from `"./parameterValidation"`, and ensure `import type { ParameterValueField } from "./api";` is present at the top (add if missing). Then **append the describe block below at the end** of the file (no `import` lines mid-file — imports must stay at the top):

```ts
const outField: ParameterValueField = {
  label: "ขนาดก้อน", type: "number", unit: "mm",
  conditionalMode: true, conditionalResult: "output",
  conditionalStandards: [
    { label: "เล็ก", conditions: [{ sourceFieldLabel: "ขนาดก้อน", op: "between", value: 5.5, value2: 6.5 }], outputText: "ก้อนเล็ก", outputKind: "normal", operator: "between", value: null, value2: null },
    { label: "ใหญ่", conditions: [{ sourceFieldLabel: "ขนาดก้อน", op: "between", value: 23.5, value2: 26 }], outputText: "", outputKind: "abnormal", operator: "between", value: null, value2: null },
  ],
};
const ctxWith = (v: unknown) => ({ sameParam: { "ขนาดก้อน": v }, otherParams: {} });

describe("resolveConditionalOutput", () => {
  it("first-match returns rule text+kind", () => {
    expect(resolveConditionalOutput(outField, ctxWith(6))).toEqual({ text: "ก้อนเล็ก", kind: "normal", matchedRuleLabel: "เล็ก" });
  });
  it("falls back to label when outputText blank", () => {
    expect(resolveConditionalOutput(outField, ctxWith(24))).toEqual({ text: "ใหญ่", kind: "abnormal", matchedRuleLabel: "ใหญ่" });
  });
  it("no-match (in a gap) → abnormal, empty text", () => {
    expect(resolveConditionalOutput(outField, ctxWith(10))).toEqual({ text: "", kind: "abnormal" });
  });
  it("blank self value → null (not flagged yet)", () => {
    expect(resolveConditionalOutput(outField, ctxWith(""))).toBeNull();
  });
  it("returns null when not output mode", () => {
    expect(resolveConditionalOutput({ ...outField, conditionalResult: "standard" }, ctxWith(6))).toBeNull();
  });
  it("isConditionalOutputAbnormal true on no-match", () => {
    expect(isConditionalOutputAbnormal(outField, ctxWith(10))).toBe(true);
    expect(isConditionalOutputAbnormal(outField, ctxWith(6))).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests, verify FAIL**

Run: `npx vitest run src/lib/parameterValidation.test.ts`
Expected: FAIL ("resolveConditionalOutput is not a function")

- [ ] **Step 3: Implement** — in `src/lib/parameterValidation.ts`, add after `resolveFieldStandard` (~389):

```ts
export type ResolvedOutput = {
  text: string;
  kind: "normal" | "abnormal";
  matchedRuleLabel?: string;
};

// โหมด output ของ conditionalMode: ไล่กฎบนลงล่าง เจอกฎแรกที่เข้า → { ข้อความ, สถานะ }.
// ค่า self ยังว่าง → null (ไม่ flag). กรอกแล้วไม่เข้ากฎไหน → abnormal.
export function resolveConditionalOutput(
  field: ParameterValueField,
  ctx: ConditionContext,
): ResolvedOutput | null {
  if (!field.conditionalMode || field.conditionalResult !== "output") return null;
  const selfVal = ctx.sameParam[field.label];
  if (selfVal === null || selfVal === undefined || selfVal === "") return null;
  for (const rule of field.conditionalStandards ?? []) {
    if ((rule.conditions ?? []).every((c) => evalCondition(c, ctx))) {
      return {
        text: (rule.outputText && rule.outputText.trim()) || rule.label || "",
        kind: rule.outputKind ?? "normal",
        matchedRuleLabel: rule.label || undefined,
      };
    }
  }
  return { text: "", kind: "abnormal" };
}

export function isConditionalOutputAbnormal(
  field: ParameterValueField,
  ctx: ConditionContext,
): boolean {
  return resolveConditionalOutput(field, ctx)?.kind === "abnormal";
}
```

- [ ] **Step 4: Wire `countAbnormalInResults`** — in the same file, inside the field loop (~228), replace:

```ts
        const vf = field.conditionalMode && isNumeric
          ? resolveFieldStandard(field, { sameParam: values, otherParams: valuesByItem.get(itemKey) ?? {} })
          : field;
```
with:
```ts
        if (field.conditionalMode && field.conditionalResult === "output" && isNumeric) {
          if (isConditionalOutputAbnormal(field, { sameParam: values, otherParams: valuesByItem.get(itemKey) ?? {} })) count += 1;
          continue;
        }
        const vf = field.conditionalMode && isNumeric
          ? resolveFieldStandard(field, { sameParam: values, otherParams: valuesByItem.get(itemKey) ?? {} })
          : field;
```

- [ ] **Step 5: Run tests, verify PASS**

Run: `npx vitest run src/lib/parameterValidation.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add -- src/lib/parameterValidation.ts src/lib/parameterValidation.test.ts
git commit -m "feat(param): resolveConditionalOutput + output abnormal (FE)"
```

---

### Task 3: describeOutputRule helper

**Files:**
- Modify: `src/lib/standardOperators.ts` (add after `describeRule` ~64)
- Test: `src/lib/standardOperators.test.ts` (create if absent)

**Interfaces:**
- Consumes: `StandardRule` (Task 1), module-private `COND_OP_LABEL`
- Produces: `describeOutputRule(rule: StandardRule): string`

- [ ] **Step 1: Write failing test** — create/append `src/lib/standardOperators.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { describeOutputRule } from "./standardOperators";
import type { StandardRule } from "./api";

const rule = (over: Partial<StandardRule>): StandardRule => ({
  label: "", conditions: [], operator: "between", value: null, value2: null, ...over,
});

describe("describeOutputRule", () => {
  it("describes a conditional output rule", () => {
    const r = rule({
      label: "เล็ก",
      conditions: [{ sourceFieldLabel: "ขนาดก้อน", op: "between", value: 5.5, value2: 6.5 }],
      outputText: "ก้อนเล็ก", outputKind: "normal",
    });
    expect(describeOutputRule(r)).toBe('เล็ก: ถ้า ขนาดก้อน ช่วง 5.5–6.5 → "ก้อนเล็ก" (ปกติ)');
  });
  it("describes a default (no-condition) abnormal row and falls back to label text", () => {
    const r = rule({ label: "อื่นๆ", conditions: [], outputText: "", outputKind: "abnormal" });
    expect(describeOutputRule(r)).toBe('อื่นๆ: default → "อื่นๆ" (ผิดปกติ)');
  });
});
```

- [ ] **Step 2: Run test, verify FAIL**

Run: `npx vitest run src/lib/standardOperators.test.ts`
Expected: FAIL ("describeOutputRule is not a function")

- [ ] **Step 3: Implement** — add after `describeRule` (~64) in `src/lib/standardOperators.ts`:

```ts
export function describeOutputRule(rule: StandardRule): string {
  const label = rule.label?.trim() ? `${rule.label}: ` : "";
  const text = (rule.outputText && rule.outputText.trim()) || rule.label || "(ไม่ระบุข้อความ)";
  const kind = rule.outputKind === "abnormal" ? "ผิดปกติ" : "ปกติ";
  const out = `→ "${text}" (${kind})`;
  if (rule.conditions.length === 0) return `${label}default ${out}`;
  const conds = rule.conditions
    .map((c) => `${c.sourceFieldLabel} ${COND_OP_LABEL[c.op]} ${c.value}${c.op === "between" && c.value2 != null ? `–${c.value2}` : ""}`)
    .join(" และ ");
  return `${label}ถ้า ${conds} ${out}`;
}
```

- [ ] **Step 4: Run test, verify PASS**

Run: `npx vitest run src/lib/standardOperators.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -- src/lib/standardOperators.ts src/lib/standardOperators.test.ts
git commit -m "feat(param): describeOutputRule helper"
```

---

### Task 4: BE mirror — output abnormal in /abnormal-flags

**Files:**
- Modify: `server/routes/qcResults.js` (add `resolveConditionalOutputJS` after `resolveFieldStandardJS` ~86; wire loop ~228-230)

**Interfaces:**
- Consumes: `evalConditionJS` (existing ~51)
- Produces (module-local): `resolveConditionalOutputJS(field, ctx) → { text, kind } | null`

> หมายเหตุ: helper JS ในไฟล์นี้ (evalConditionJS/resolveFieldStandardJS) เดิม**ไม่มี unit test** (inline ใน route) — task นี้ทำตาม pattern เดิม: implement + verify ด้วย manual E2E (Task 9). ตรรกะต้อง mirror `resolveConditionalOutput` ของ FE เป๊ะ

- [ ] **Step 1: Implement mirror** — add after `resolveFieldStandardJS` (~86) in `server/routes/qcResults.js`:

```js
// mirror of src/lib/parameterValidation.ts resolveConditionalOutput — keep in sync
function resolveConditionalOutputJS(field, ctx) {
  if (!field.conditionalMode || field.conditionalResult !== "output") return null;
  const selfVal = ctx.sameParam[field.label];
  if (selfVal === null || selfVal === undefined || selfVal === "") return null;
  for (const rule of field.conditionalStandards || []) {
    if ((rule.conditions || []).every((c) => evalConditionJS(c, ctx))) {
      return {
        text: (rule.outputText && String(rule.outputText).trim()) || rule.label || "",
        kind: rule.outputKind || "normal",
      };
    }
  }
  return { text: "", kind: "abnormal" };
}
```

- [ ] **Step 2: Wire into the loop** — in the `/abnormal-flags` field loop (~228), replace:

```js
          const vf = field.conditionalMode && isNumeric
            ? resolveFieldStandardJS(field, { sameParam: values, otherParams: ctxBucket })
            : field;
          for (const v of fieldValueListJS(values, field)) {
            if (isFieldAbnormal(vf, v)) { flagged = true; break; }
          }
          if (flagged) break;
```
with:
```js
          if (field.conditionalMode && field.conditionalResult === "output" && isNumeric) {
            const out = resolveConditionalOutputJS(field, { sameParam: values, otherParams: ctxBucket });
            if (out && out.kind === "abnormal") { flagged = true; break; }
            continue;
          }
          const vf = field.conditionalMode && isNumeric
            ? resolveFieldStandardJS(field, { sameParam: values, otherParams: ctxBucket })
            : field;
          for (const v of fieldValueListJS(values, field)) {
            if (isFieldAbnormal(vf, v)) { flagged = true; break; }
          }
          if (flagged) break;
```

- [ ] **Step 3: Smoke-check syntax**

Run: `node --check server/routes/qcResults.js`
Expected: ไม่มี output (syntax OK)

- [ ] **Step 4: Commit**

```bash
git add -- server/routes/qcResults.js
git commit -m "feat(param): mirror output abnormal in /abnormal-flags (BE)"
```

---

### Task 5: ConditionalStandardsDialog — output result row + self source

**Files:**
- Modify: `src/components/lis/ConditionalStandardsDialog.tsx`

**Interfaces:**
- Consumes: `describeOutputRule` (Task 3), `ResolvedOutput` types not needed here
- Produces: new prop `resultMode: 'standard' | 'output'` on `ConditionalStandardsDialog`

- [ ] **Step 1: Add prop + import.** Add to imports (top): `import { OPERATOR_OPTIONS, describeRule, describeOutputRule } from "@/lib/standardOperators";` (replace existing standardOperators import line). Add to `Props` type: `resultMode: "standard" | "output";`. Add `resultMode` to the destructured params of `ConditionalStandardsDialog({ ... })`.

- [ ] **Step 2: Add current field as a selectable source.** Replace the `sources` array (~51-58) with:

```tsx
  const sources: SourceOption[] = [
    { paramId: null, label: field.label, display: `${field.label} (ช่องนี้)`, field },
    ...siblingFields.map((f) => ({ paramId: null, label: f.label, display: `${f.label} (พารามฯ นี้)`, field: f })),
    ...allParameters
      .filter((p) => String(p._id) !== String(currentParameterId))
      .flatMap((p) => (p.valueFields ?? []).map((f) => ({
        paramId: String(p._id), label: f.label, display: `${p.name} › ${f.label}`, field: f,
      }))),
  ];
```

- [ ] **Step 3: Default new conditions/rules for output.** Replace `addRule` (~74-79) and `addCond` (~85-88) with:

```tsx
  const defaultCondOp = resultMode === "output" ? "between" : "eq";
  const addRule = (withCondition: boolean) =>
    setRules((prev) => [...prev, {
      label: "",
      conditions: withCondition ? [{ sourceFieldLabel: sources[0]?.label ?? "", op: defaultCondOp, value: "" }] : [],
      operator: "between", value: null, value2: null,
      ...(resultMode === "output" ? { outputText: "", outputKind: "normal" as const } : {}),
    }]);
```
```tsx
  const addCond = (ri: number) =>
    setRules((prev) => prev.map((r, idx) => idx !== ri ? r : {
      ...r, conditions: [...r.conditions, { sourceFieldLabel: sources[0]?.label ?? "", op: defaultCondOp, value: "" }],
    }));
```

- [ ] **Step 4: Swap the result row by mode.** Replace the whole `{/* resulting standard */}` block (~198-226) with:

```tsx
              {/* resulting standard OR text output */}
              {resultMode === "output" ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">→ ผลลัพธ์:</span>
                  <Input
                    value={rule.outputText ?? ""}
                    onChange={(e) => patchRule(ri, { outputText: e.target.value })}
                    placeholder="ข้อความ เช่น ก้อนเล็ก"
                    className="h-8 w-44"
                  />
                  <Select value={rule.outputKind ?? "normal"} onValueChange={(v) => patchRule(ri, { outputKind: v as "normal" | "abnormal" })}>
                    <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">ปกติ</SelectItem>
                      <SelectItem value="abnormal">ผิดปกติ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
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
              )}

              <p className="text-xs text-emerald-700">
                {resultMode === "output" ? describeOutputRule(rule) : describeRule(rule, unit)}
              </p>
```

- [ ] **Step 5: Update header hint (optional clarity).** In `DialogTitle`/`<p>` block (~100-103) leave title as-is; no change required.

- [ ] **Step 6: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: error `resultMode` missing at the call site in ParameterSettings — **นี่คือสิ่งที่คาดไว้** (แก้ใน Task 6). error อื่นจากไฟล์นี้ต้องไม่มี

- [ ] **Step 7: Commit**

```bash
git add -- src/components/lis/ConditionalStandardsDialog.tsx
git commit -m "feat(param): output result row + self source in ConditionalStandardsDialog"
```

---

### Task 6: ParameterSettings — "ผลของกฎ" radio + wiring

**Files:**
- Modify: `src/pages/ParameterSettings.tsx` (setMode ~1300-1310; conditional block ~1324-1359; summary preview ~479-486; import)

**Interfaces:**
- Consumes: `ConditionalStandardsDialog` prop `resultMode` (Task 5), `describeOutputRule` (Task 3)

- [ ] **Step 1: Import describeOutputRule.** Find the import of `describeRule` from `@/lib/standardOperators` and add `describeOutputRule` to it.

- [ ] **Step 2: Reset conditionalResult in setMode.** In `setMode` (~1300), add to the object passed to `onChange`:
```ts
                    conditionalResult: m === "conditional" ? (field.conditionalResult ?? "standard") : "standard",
```

- [ ] **Step 3: Add the "ผลของกฎ" radio.** Inside `{field.conditionalMode ? (` block, immediately after `<div className="space-y-2">` (~1325), insert:

```tsx
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className="text-muted-foreground">ผลของกฎ:</span>
                    {([["standard", "เกณฑ์ตัวเลข"], ["output", "ข้อความ + สถานะ"]] as const).map(([r, lbl]) => (
                      <label key={r} className="flex cursor-pointer items-center gap-1.5">
                        <input
                          type="radio"
                          checked={(field.conditionalResult ?? "standard") === r}
                          onChange={() => onChange({ ...field, conditionalResult: r })}
                          className="h-3.5 w-3.5"
                        />
                        {lbl}
                      </label>
                    ))}
                  </div>
```

- [ ] **Step 4: Pass resultMode + fix summary describe.** In the same block:

Replace the rule-summary map (~1346-1348):
```tsx
                      {(field.conditionalStandards ?? []).map((r, i) => (
                        <p key={i} className="text-xs text-emerald-700">{describeRule(r, field.unit ?? "")}</p>
                      ))}
```
with:
```tsx
                      {(field.conditionalStandards ?? []).map((r, i) => (
                        <p key={i} className="text-xs text-emerald-700">
                          {(field.conditionalResult ?? "standard") === "output" ? describeOutputRule(r) : describeRule(r, field.unit ?? "")}
                        </p>
                      ))}
```

Add `resultMode` prop to `<ConditionalStandardsDialog ... />` (~1351):
```tsx
                    resultMode={field.conditionalResult ?? "standard"}
```

- [ ] **Step 5: Fix the read-only preview list (~479-486).** Replace:
```tsx
        {rules.map((r, i) => <p key={i} className="text-xs text-emerald-700">{describeRule(r, field.unit ?? "")}</p>)}
```
with:
```tsx
        {rules.map((r, i) => (
          <p key={i} className="text-xs text-emerald-700">
            {(field.conditionalResult ?? "standard") === "output" ? describeOutputRule(r) : describeRule(r, field.unit ?? "")}
          </p>
        ))}
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่ (Task 5 + 6 ครบคู่กัน)

- [ ] **Step 7: Commit**

```bash
git add -- src/pages/ParameterSettings.tsx
git commit -m "feat(param): result-mode radio + wiring in ParameterSettings"
```

---

### Task 7: Testing pages — derived text + abnormal (QC + Lab)

**Files:**
- Modify: `src/pages/QCTestingDetailPage.tsx` (TestFieldProps + TestField ~100-235; renderUnit ~1208-1224; countAbnormalInValues ~845-863)
- Modify: `src/pages/LabTestingDetailPage.tsx` (TestFieldProps ~112-150; TestField body ~155-289; TWO renderUnit blocks ~1044 & ~1316; countAbnormalInValues ~691-705)

**Interfaces:**
- Consumes: `resolveConditionalOutput`, `ResolvedOutput`, `isConditionalOutputAbnormal` (Task 2)

- [ ] **Step 1: QC — import.** In `src/pages/QCTestingDetailPage.tsx` line 13 import, add `resolveConditionalOutput` and (type) `ResolvedOutput`, `isConditionalOutputAbnormal`:
```ts
import { isFieldAbnormal, expandFieldForItem, resolveFieldStandard, resolveStandard, getEntryValues, optionOutputText, enumNormalValues, resolveConditionalOutput, isConditionalOutputAbnormal } from '@/lib/parameterValidation';
import type { ConditionContext, ResolvedOutput } from '@/lib/parameterValidation';
```
(merge with the existing `import type { ConditionContext }` line 14 — keep a single type import line.)

- [ ] **Step 2: QC — TestField prop.** In `TestFieldProps` add `outputResult?: ResolvedOutput | null;`. Add `outputResult` to the destructured props of `TestField({ ... })` (~100-109).

- [ ] **Step 3: QC — use outputResult in TestField.** Replace `const isAbnormal = isFieldAbnormal(field, value);` (~114) with:
```ts
  const isAbnormal = outputResult ? outputResult.kind === 'abnormal' : isFieldAbnormal(field, value);
```
Update the AlertTriangle `title` (~128-132) to:
```tsx
            title={
              field.type === 'enum'
                ? `ค่าผิดปกติ — คาดหวัง: ${enumNormalValues(field).join(', ')}`
                : outputResult
                  ? 'ค่าผิดปกติ — ไม่เข้าเกณฑ์ที่กำหนด'
                  : `ค่าผิดปกติ — คาดหวัง: ${describeStandard(field)}`
            }
```
After the `{customText && (...)}` block (~219-221) add:
```tsx
      {outputResult && outputResult.text && (
        <p className={cn('text-[11px]', outputResult.kind === 'abnormal' ? 'text-red-600' : 'text-emerald-700')}>
          ผลลัพธ์: {outputResult.text}
        </p>
      )}
```

- [ ] **Step 4: QC — compute in renderUnit + pass down.** In `renderUnit` after the `resolved` const (~1215) add:
```ts
                    const isOutputMode = unit.field.conditionalMode && unit.field.conditionalResult === 'output';
                    const outputResult = isOutputMode ? resolveConditionalOutput(unit.field, condCtx) : null;
```
Find the scalar `<TestField ... />` render (the non-multiple path, where `resolvedStandardText={resolvedStandardText}` is passed) and add prop `outputResult={outputResult}`. For output mode also suppress the numeric criterion line: pass `resolvedStandardText={isOutputMode ? undefined : resolvedStandardText}`.

- [ ] **Step 5: QC — count.** In `countAbnormalInValues` (~851-860) replace the body of the `expandFieldForItem(...).forEach((unit) => {...})` with:
```ts
      expandFieldForItem(field, item.commonName).forEach((unit) => {
        if (unit.field.conditionalMode && unit.field.conditionalResult === 'output') {
          if (isConditionalOutputAbnormal(unit.field, { sameParam: src, otherParams: {} })) count += 1;
          return;
        }
        if (unit.field.multiple) {
          readMultiple(src, unit.key).forEach((v) => {
            if (isFieldAbnormal(unit.field, v)) count += 1;
          });
        } else if (isFieldAbnormal(unit.field, src[unit.key])) {
          count += 1;
        }
      });
```

- [ ] **Step 6: Lab — mirror Steps 1-5** in `src/pages/LabTestingDetailPage.tsx`:
  - Import (line 26): add `resolveConditionalOutput, isConditionalOutputAbnormal` + type `ResolvedOutput`.
  - `TestFieldProps` (~112-125): add `outputResult?: ResolvedOutput | null;`; destructure in `TestField` (~133-150).
  - `isAbnormal` (~155), AlertTriangle title, and derived-text `<p>` — same edits as Steps 3.
  - BOTH renderUnit blocks (~1044 and ~1316): add the `isOutputMode`/`outputResult` consts (using the local `condCtx` in each block) and pass `outputResult={outputResult}` + `resolvedStandardText={isOutputMode ? undefined : resolvedStandardText}` to their scalar `<TestField />` (~1126/1161 and ~1355/1368).
  - `countAbnormalInValues` (~691-705): same output branch as Step 5.

- [ ] **Step 7: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่จาก 2 ไฟล์นี้

- [ ] **Step 8: Commit**

```bash
git add -- src/pages/QCTestingDetailPage.tsx src/pages/LabTestingDetailPage.tsx
git commit -m "feat(param): derived output text + abnormal on QC/Lab testing pages"
```

---

### Task 8: Approval rows — output branch

**Files:**
- Modify: `src/lib/qcApprovalRows.ts` (import ~4-13; row build ~110-139)

**Interfaces:**
- Consumes: `resolveConditionalOutput` (Task 2), `ConditionContext` (already imported)

- [ ] **Step 1: Import.** Add `resolveConditionalOutput` to the `@/lib/parameterValidation` import block (~4-12).

- [ ] **Step 2: Compute output per unit.** In the `expandFieldForItem(...).forEach((unit) => {` body, after the `const resolved = ...` (~114-116) add:
```ts
              const isOutputMode = unit.field.conditionalMode && unit.field.conditionalResult === "output";
              const outputRes = isOutputMode
                ? resolveConditionalOutput(unit.field, { sameParam: entryValues, otherParams: ctx.otherParams })
                : null;
```

- [ ] **Step 3: Use it in the pushed row.** In the `rows.push({ ... })` (~129-138) replace the `standardText` and `abnormal` lines with:
```ts
                  standardText: isOutputMode ? (outputRes?.text || (outputRes?.kind === "abnormal" ? "ตกเกณฑ์" : "")) : standardText,
                  abnormal: isOutputMode ? outputRes?.kind === "abnormal" : isFieldAbnormal(effectiveField, raw),
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่

- [ ] **Step 5: Commit**

```bash
git add -- src/lib/qcApprovalRows.ts
git commit -m "feat(param): output text + status in approval rows"
```

---

### Task 9: Full-suite check + manual E2E

**Files:** none (verification only)

- [ ] **Step 1: Run all automated tests**

Run: `npx vitest run`
Expected: PASS (รวมเทสต์ใหม่ Task 2/3)
Run: `node --test server/models/Parameter.test.js`
Expected: PASS

- [ ] **Step 2: Typecheck the whole app**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่จากงานนี้ (repo มี latent error เดิม ~12 ตัว — เทียบกับ baseline ก่อนเริ่ม)

- [ ] **Step 3: Manual E2E (ต้องรัน frontend+backend).** สร้าง Parameter ตัวเลข → เลือกโหมด "เงื่อนไขพิเศษ" → "ผลของกฎ: ข้อความ + สถานะ" → ตั้ง 2 กฎ (this ช่วง 5.5–6.5 → "ก้อนเล็ก" ปกติ / 23.5–26 → "ก้อนใหญ่" ผิดปกติ). ตรวจ:
  - **ยังไม่กรอก** → ไม่มีไฮไลต์แดง, ไม่มีบรรทัดผลลัพธ์
  - กรอก **6** → โชว์ "ผลลัพธ์: ก้อนเล็ก", ไม่แดง
  - กรอก **24** → โชว์ "ผลลัพธ์: ก้อนใหญ่", แดง + สามเหลี่ยมเตือน
  - กรอก **10** (ตกร่อง) → แดง (ผิดปกติ), ไม่มีข้อความ
  - หน้า **อนุมัติ QC**: แถวโชว์ค่าดิบ + คอลัมน์ผลลัพธ์ = ข้อความ, abnormal ตรง
  - รายการ petition ที่มีค่า 24/10 → badge abnormal ขึ้น (endpoint `/abnormal-flags` ฝั่ง BE)
  - โหมด "เกณฑ์ตัวเลข" เดิม → ทำงานเหมือนเดิมทุกอย่าง (regression)

- [ ] **Step 4: Update seed-data (ถ้ามีการสร้าง/แก้ Parameter จริงบนเครื่อง)**

Run: `cd server && npm run seed:export`
แล้ว commit `server/seed-data/` (ถ้า diff มีเฉพาะไฟล์ของงานนี้)

- [ ] **Step 5: Final note.** สรุปผล manual E2E ให้ผู้ใช้ + ถามเรื่อง push origin/develop (งานนี้ไม่ push อัตโนมัติ)
