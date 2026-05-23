# ENUM Expected Values Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่ม `expectedValues?: string[]` บน ENUM parameter ให้ตั้ง "ค่าที่คาดหวัง" ได้หลายค่า แล้วใน QC Testing แสดง abnormal indicator เมื่อค่าที่กรอกไม่อยู่ใน expectedValues

**Architecture:** เพิ่ม optional field ใน Mongoose schema + TypeScript type, อัปเดต UI editor ใน ParameterSettings (เพิ่ม checkbox "ปกติ" ต่อ option), แยก abnormal detection logic เป็น pure function ใน lib (test ได้), แล้วใช้ใน QCTestingDetailPage แสดง border แดง + AlertTriangle icon

**Tech Stack:** React 18 + TypeScript, Mongoose (Express backend), Vitest (unit tests), shadcn/ui (Select, Checkbox), lucide-react icons, Tailwind CSS

**Spec reference:** [docs/superpowers/specs/2026-05-23-enum-expected-values-design.md](../specs/2026-05-23-enum-expected-values-design.md)

---

### Task 1: Backend — add expectedValues to Mongoose schema

**Files:**
- Modify: `server/models/Parameter.js`

- [ ] **Step 1: Add expectedValues field to ValueFieldSchema**

แก้ไฟล์ `server/models/Parameter.js` lines 3-12 เพิ่ม `expectedValues` ลงใน `ValueFieldSchema`:

```js
const ValueFieldSchema = new mongoose.Schema({
  label: { type: String, required: true, trim: true },
  type: { type: String, enum: ['text', 'number', 'float', 'enum', 'photo'], required: true },
  unit: { type: String, default: '' },
  min: { type: Number, default: null },
  max: { type: Number, default: null },
  options: { type: [String], default: [] },
  requireNoteOn: { type: [String], default: [] },
  expectedValues: { type: [String], default: [] },
  required: { type: Boolean, default: false },
}, { _id: false });
```

- [ ] **Step 2: Add pre-validate check for expectedValues**

ใน `ParameterSchema.pre('validate', ...)` (line 27-47) เพิ่ม validation block หลัง `requireNoteOn` check (หลัง line 41, ก่อน `if (f.min != null...`):

```js
    if (f.expectedValues && f.expectedValues.length > 0) {
      const opts = f.options || [];
      const invalid = f.expectedValues.filter((v) => !opts.includes(v));
      if (invalid.length > 0) {
        return next(new Error(`expectedValues ต้องอยู่ใน options ของช่อง "${f.label}" (ค่าที่ไม่ตรง: ${invalid.join(', ')})`));
      }
    }
```

- [ ] **Step 3: Verify schema loads without error**

Run: `node -e "require('./server/models/Parameter.js'); console.log('schema loaded OK')"`
Expected output: `schema loaded OK`

- [ ] **Step 4: Commit**

```bash
git add server/models/Parameter.js
git commit -m "feat(parameters): add expectedValues to schema with validation"
```

---

### Task 2: Frontend type — add expectedValues to ParameterValueField

**Files:**
- Modify: `src/lib/api.ts:221-228`

- [ ] **Step 1: Update ParameterValueField type**

แก้ไฟล์ `src/lib/api.ts` lines 221-228 เพิ่ม field `expectedValues`:

```ts
export type ParameterValueField = {
  label: string;
  type: ParameterValueFieldType;
  unit?: string;
  standardValue?: number | null;
  options?: string[];
  requireNoteOn?: string[];
  expectedValues?: string[];
  required?: boolean;
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: ไม่มี error เกี่ยวกับ ParameterValueField

(ถ้ามี error ในไฟล์อื่นที่ไม่เกี่ยวกับการแก้ไขนี้ — ปกติ, ข้ามได้)

- [ ] **Step 3: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat(parameters): add expectedValues to ParameterValueField type"
```

---

### Task 3: Helper — isEnumAbnormal pure function with unit tests

**Files:**
- Create: `src/lib/parameterValidation.ts`
- Create: `src/lib/parameterValidation.test.ts`

- [ ] **Step 1: Write the failing test**

สร้าง `src/lib/parameterValidation.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isEnumAbnormal } from "./parameterValidation";
import type { ParameterValueField } from "./api";

const makeField = (overrides: Partial<ParameterValueField>): ParameterValueField => ({
  label: "test",
  type: "enum",
  options: ["ดี", "ปานกลาง", "แย่"],
  expectedValues: [],
  ...overrides,
});

describe("isEnumAbnormal", () => {
  it("returns false for non-enum field types", () => {
    const field = makeField({ type: "text", expectedValues: ["x"] });
    expect(isEnumAbnormal(field, "anything")).toBe(false);
  });

  it("returns false when expectedValues is empty (no check configured)", () => {
    const field = makeField({ expectedValues: [] });
    expect(isEnumAbnormal(field, "แย่")).toBe(false);
  });

  it("returns false when expectedValues is undefined", () => {
    const field = makeField({ expectedValues: undefined });
    expect(isEnumAbnormal(field, "แย่")).toBe(false);
  });

  it("returns false for empty/null value (not entered yet)", () => {
    const field = makeField({ expectedValues: ["ดี"] });
    expect(isEnumAbnormal(field, "")).toBe(false);
    expect(isEnumAbnormal(field, null)).toBe(false);
    expect(isEnumAbnormal(field, undefined)).toBe(false);
  });

  it("returns false when value is in expectedValues (single)", () => {
    const field = makeField({ expectedValues: ["ดี"] });
    expect(isEnumAbnormal(field, "ดี")).toBe(false);
  });

  it("returns true when value is NOT in expectedValues (single)", () => {
    const field = makeField({ expectedValues: ["ดี"] });
    expect(isEnumAbnormal(field, "แย่")).toBe(true);
  });

  it("returns false when value matches any expectedValue (multi)", () => {
    const field = makeField({ expectedValues: ["ดี", "ปานกลาง"] });
    expect(isEnumAbnormal(field, "ดี")).toBe(false);
    expect(isEnumAbnormal(field, "ปานกลาง")).toBe(false);
  });

  it("returns true when value matches none of expectedValues (multi)", () => {
    const field = makeField({ expectedValues: ["ดี", "ปานกลาง"] });
    expect(isEnumAbnormal(field, "แย่")).toBe(true);
  });

  it("coerces non-string values to string for comparison", () => {
    const field = makeField({ options: ["1", "2"], expectedValues: ["1"] });
    expect(isEnumAbnormal(field, 1)).toBe(false);
    expect(isEnumAbnormal(field, 2)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/parameterValidation.test.ts`
Expected: FAIL — module not found / `isEnumAbnormal is not defined`

- [ ] **Step 3: Write minimal implementation**

สร้าง `src/lib/parameterValidation.ts`:

```ts
import type { ParameterValueField } from "./api";

export function isEnumAbnormal(
  field: ParameterValueField,
  value: unknown,
): boolean {
  if (field.type !== "enum") return false;
  const expected = field.expectedValues ?? [];
  if (expected.length === 0) return false;
  if (value === null || value === undefined) return false;
  const str = String(value);
  if (str === "") return false;
  return !expected.includes(str);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/parameterValidation.test.ts`
Expected: PASS — 9 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/lib/parameterValidation.ts src/lib/parameterValidation.test.ts
git commit -m "feat(parameters): add isEnumAbnormal helper with unit tests"
```

---

### Task 4: ParameterSettings — emptyValueField + Select onValueChange reset

**Files:**
- Modify: `src/pages/ParameterSettings.tsx`

- [ ] **Step 1: Update emptyValueField to include expectedValues**

แก้ `src/pages/ParameterSettings.tsx` lines 147-155:

```ts
const emptyValueField = (): ParameterValueField => ({
  label: "",
  type: "text",
  unit: "",
  standardValue: null,
  options: [],
  requireNoteOn: [],
  expectedValues: [],
  required: false,
});
```

- [ ] **Step 2: Update type-change Select to reset expectedValues**

แก้ `src/pages/ParameterSettings.tsx` lines 472-481 (Select onValueChange ของ field type) — เพิ่ม `expectedValues`:

```tsx
                onValueChange={(v) =>
                  onChange({
                    ...field,
                    type: v as ParameterValueFieldType,
                    unit: v === "number" || v === "float" ? field.unit ?? "" : "",
                    options: v === "enum" ? field.options ?? [] : [],
                    requireNoteOn: v === "enum" ? field.requireNoteOn ?? [] : [],
                    expectedValues: v === "enum" ? field.expectedValues ?? [] : [],
                    standardValue: v === "number" || v === "float" ? field.standardValue : null,
                  })
                }
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: ไม่มี error ที่เกี่ยวกับ ParameterSettings.tsx

- [ ] **Step 4: Commit**

```bash
git add src/pages/ParameterSettings.tsx
git commit -m "feat(parameters): init expectedValues in form defaults"
```

---

### Task 5: ParameterSettings — toggleExpected + removeOption cleanup

**Files:**
- Modify: `src/pages/ParameterSettings.tsx`

- [ ] **Step 1: Update removeOption to filter expectedValues**

แก้ `src/pages/ParameterSettings.tsx` lines 399-405 (function `removeOption` ใน `ValueFieldEditor`):

```ts
  const removeOption = (opt: string) => {
    onChange({
      ...field,
      options: (field.options ?? []).filter((o) => o !== opt),
      requireNoteOn: (field.requireNoteOn ?? []).filter((o) => o !== opt),
      expectedValues: (field.expectedValues ?? []).filter((o) => o !== opt),
    });
  };
```

- [ ] **Step 2: Add toggleExpected handler**

แก้ `src/pages/ParameterSettings.tsx` หลัง function `toggleRequireNote` (หลัง line 413) — เพิ่ม:

```ts
  const toggleExpected = (opt: string) => {
    const current = field.expectedValues ?? [];
    const next = current.includes(opt)
      ? current.filter((o) => o !== opt)
      : [...current, opt];
    onChange({ ...field, expectedValues: next });
  };
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: ไม่มี error ที่เกี่ยวกับ ParameterSettings.tsx (toggleExpected ยังไม่ถูกใช้ — เตรียมไว้ task ถัดไป)

- [ ] **Step 4: Commit**

```bash
git add src/pages/ParameterSettings.tsx
git commit -m "feat(parameters): add toggleExpected handler and cleanup on remove"
```

---

### Task 6: ParameterSettings — "ปกติ" checkbox per option + helper text

**Files:**
- Modify: `src/pages/ParameterSettings.tsx`

- [ ] **Step 1: Add "ปกติ" checkbox in option row**

แก้ `src/pages/ParameterSettings.tsx` lines 545-575 (ส่วน render รายการ options ใน enum block) — แทนที่ทั้ง block (ตั้งแต่ `(field.options ?? []).length > 0 ? (` จนถึงปิด `)`) ด้วย:

```tsx
              {(field.options ?? []).length > 0 ? (
                <div className="mt-2 space-y-1">
                  {(field.options ?? []).map((opt) => {
                    const needsNote = (field.requireNoteOn ?? []).includes(opt);
                    const isExpected = (field.expectedValues ?? []).includes(opt);
                    return (
                      <div
                        key={opt}
                        className="flex items-center justify-between gap-2 rounded border bg-background px-2 py-1 text-xs"
                      >
                        <span className="font-medium">{opt}</span>
                        <div className="flex items-center gap-3">
                          <label className="flex cursor-pointer items-center gap-1 text-emerald-700">
                            <Checkbox
                              checked={isExpected}
                              onCheckedChange={() => toggleExpected(opt)}
                              className="h-3.5 w-3.5"
                            />
                            ปกติ
                          </label>
                          <label className="flex cursor-pointer items-center gap-1 text-muted-foreground">
                            <Checkbox
                              checked={needsNote}
                              onCheckedChange={() => toggleRequireNote(opt)}
                              className="h-3.5 w-3.5"
                            />
                            ต้องการคำอธิบาย
                          </label>
                          <button
                            type="button"
                            onClick={() => removeOption(opt)}
                            className="rounded p-0.5 text-destructive hover:bg-destructive/10"
                            title="ลบตัวเลือก"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  ยังไม่มีตัวเลือก — ต้องมีอย่างน้อย 1 ตัว
                </p>
              )}
```

- [ ] **Step 2: Add helper text below options list**

หลัง closing `)` ของ option list (หลัง block ที่แก้ใน step 1) แต่ก่อน `</div>` ของ `{isEnum ? (...)}` block — เพิ่ม helper text:

หา `</div>` ที่ปิด `<div className="space-y-1.5">` ของ enum block (ใกล้บรรทัด ~582 หลังการแก้) แล้วเพิ่มก่อนปิดดังนี้:

```tsx
              {(field.options ?? []).length > 0 ? (() => {
                const expected = field.expectedValues ?? [];
                const opts = field.options ?? [];
                if (expected.length === 0) {
                  return (
                    <p className="mt-1 text-xs text-muted-foreground">
                      ยังไม่ได้กำหนดค่าที่คาดหวัง — จะไม่ตรวจค่าผิดปกติ
                    </p>
                  );
                }
                if (expected.length === opts.length) {
                  return (
                    <p className="mt-1 text-xs text-amber-700">
                      ทุกค่าถูกตั้งเป็นปกติ — จะไม่มี abnormal
                    </p>
                  );
                }
                return (
                  <p className="mt-1 text-xs text-emerald-700">
                    ค่าที่คาดหวัง: {expected.join(", ")} — ค่าอื่นจะถูกมาร์คผิดปกติ
                  </p>
                );
              })() : null}
```

- [ ] **Step 3: Manual smoke test (dev server)**

Note: dev server อาจกำลังรันอยู่แล้ว (ดู memory feedback_no_npm_run_build) — ไม่ต้อง run `npm run build`

หาก dev server ไม่ได้รัน: `npm run dev`

เปิด browser ที่ Parameter Settings → สร้าง ENUM ใหม่:
- เพิ่ม 3 options: "ดี", "ปานกลาง", "แย่"
- คาดหวัง: แต่ละ option row มี checkbox "ปกติ" และ "ต้องการคำอธิบาย"
- ยังไม่ติ๊ก "ปกติ" → helper text: "ยังไม่ได้กำหนดค่าที่คาดหวัง — จะไม่ตรวจค่าผิดปกติ"
- ติ๊ก "ปกติ" บน "ดี" → helper text: "ค่าที่คาดหวัง: ดี — ค่าอื่นจะถูกมาร์คผิดปกติ"
- ติ๊ก "ปกติ" ทั้ง 3 → helper text: "ทุกค่าถูกตั้งเป็นปกติ — จะไม่มี abnormal"
- ลบ option "ดี" → expectedValues หาย "ดี" ออกอัตโนมัติ
- บันทึก, refresh, เปิดใหม่ → ค่ายังอยู่

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: ไม่มี error ที่เกี่ยวกับ ParameterSettings.tsx

- [ ] **Step 5: Commit**

```bash
git add src/pages/ParameterSettings.tsx
git commit -m "feat(parameters): add 'ปกติ' checkbox per option + helper text"
```

---

### Task 7: QC Testing — abnormal indicator on ENUM SelectTrigger

**Files:**
- Modify: `src/pages/QCTestingDetailPage.tsx:68-128`

- [ ] **Step 1: Add import for isEnumAbnormal + AlertTriangle**

หา block import ของ `QCTestingDetailPage.tsx` ด้านบนสุด:
- เพิ่ม `AlertTriangle` ใน import จาก `lucide-react` (ถ้ายังไม่มี — ถ้ามี `AlertCircle` อยู่แล้ว เพิ่มชื่อต่อ)
- เพิ่ม import ใหม่: `import { isEnumAbnormal } from "@/lib/parameterValidation";`

ตัวอย่าง (ปรับตามสภาพ import ปัจจุบัน — เปิดไฟล์ดูก่อนแก้):

```ts
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { isEnumAbnormal } from "@/lib/parameterValidation";
```

(ถ้าไฟล์ import แบบอื่นอยู่แล้ว เช่น `import * as Icons` — ปรับให้เข้ากับ pattern เดิม)

- [ ] **Step 2: Compute abnormal flag inside TestField**

แก้ `src/pages/QCTestingDetailPage.tsx` ที่ function `TestField` (lines 68-172) — เพิ่ม const ใต้ `const showNote = ...` (หลัง line 80):

```ts
  const isAbnormal = isEnumAbnormal(field, value);
```

- [ ] **Step 3: Apply abnormal styling to SelectTrigger and label**

แก้ `src/pages/QCTestingDetailPage.tsx` lines 103-114 — replace ENUM render block:

```tsx
      {field.type === 'enum' ? (
        <Select value={strVal || '__none__'} onValueChange={(v) => onChange(v === '__none__' ? '' : v)}>
          <SelectTrigger
            className={cn(
              "h-8 text-sm",
              isAbnormal && "border-red-400 ring-1 ring-red-200",
            )}
          >
            <SelectValue placeholder="เลือกค่า..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— เลือก —</SelectItem>
            {field.options?.map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : field.type === 'photo' ? (
```

หมายเหตุ: ต้อง import `cn` ถ้ายังไม่มี — `import { cn } from "@/lib/utils";`

- [ ] **Step 4: Add AlertTriangle icon next to label when abnormal**

แก้ `src/pages/QCTestingDetailPage.tsx` lines 84-100 (ส่วน flex container ที่มี label + save state icons) — เพิ่ม AlertTriangle หลัง label:

```tsx
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-grey-700">
          {field.label}
          {field.unit && <span className="text-grey-400 font-normal ml-1">({field.unit})</span>}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {isAbnormal && (
          <span
            className="inline-flex items-center"
            title={`ค่าผิดปกติ — คาดหวัง: ${(field.expectedValues ?? []).join(", ")}`}
          >
            <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
          </span>
        )}
        {/* save state indicator */}
        {saveInfo?.state === 'saving' && (
          <Loader2 className="h-3 w-3 animate-spin text-grey-400" />
        )}
        {saveInfo?.state === 'saved' && (
          <CheckCircle2 className="h-3 w-3 text-green-500" />
        )}
        {saveInfo?.state === 'error' && (
          <AlertCircle className="h-3 w-3 text-red-400" />
        )}
      </div>
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: ไม่มี error ที่เกี่ยวกับ QCTestingDetailPage.tsx

- [ ] **Step 6: Manual smoke test**

(ถ้า dev server ไม่ได้รัน: `npm run dev`)

1. สร้างหรือเลือก parameter ENUM ที่มี expectedValues (จาก Task 6) — เช่น options=[ดี/ปานกลาง/แย่], expectedValues=[ดี]
2. เข้าหน้า QC Testing detail ของ sample ที่ใช้ parameter นี้
3. เลือก "ดี" → ไม่ควรมี border แดง, ไม่มี icon AlertTriangle
4. เปลี่ยนเป็น "แย่" → SelectTrigger มี border แดง, ข้างชื่อ field มี icon เตือนสีแดง, hover แล้วเห็น tooltip "ค่าผิดปกติ — คาดหวัง: ดี"
5. parameter ที่ไม่ตั้ง expectedValues → ไม่มี indicator เลย (พฤติกรรมเดิม)

- [ ] **Step 7: Commit**

```bash
git add src/pages/QCTestingDetailPage.tsx
git commit -m "feat(qc-testing): show abnormal indicator for enum values outside expectedValues"
```

---

### Task 8: Regression check — existing E2E tests still pass

**Files:**
- N/A (run existing tests)

- [ ] **Step 1: Run vitest suite**

Run: `npm run test`
Expected: ทุก test PASS (รวมทั้ง parameterValidation.test.ts ใหม่)

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: ไม่มี new error/warning จากไฟล์ที่แก้ (warning เดิมๆ ที่ไม่เกี่ยวข้องข้ามได้)

- [ ] **Step 3: Update e2e test if needed**

ถ้า `tests/e2e/qc-testing.spec.ts` มี assertion ที่กระทบกับการแก้ ENUM field (เช่น snapshot screenshot ของ SelectTrigger) — อัปเดต screenshot ตามจริง:

Run: `npx playwright test tests/e2e/qc-testing.spec.ts`

ถ้า fail เพราะ snapshot — ตรวจว่าสาเหตุคือ UI ใหม่ที่ตั้งใจ (ไม่ใช่ regression) แล้ว update snapshot:

Run: `npx playwright test tests/e2e/qc-testing.spec.ts --update-snapshots`

- [ ] **Step 4: Commit (ถ้ามี snapshot update)**

```bash
git add tests/e2e/
git commit -m "test(qc-testing): update snapshots for expectedValues abnormal indicator"
```

ถ้าไม่มีอะไรเปลี่ยน — ข้าม

---

## Self-Review

**Spec coverage:**
- ✓ Schema เพิ่ม `expectedValues?: string[]` → Task 1 (backend) + Task 2 (frontend type)
- ✓ Invariant: subset of options + reset on type change → Task 1 (pre-validate), Task 4 (Select reset), Task 5 (removeOption cleanup)
- ✓ UI checkbox "ปกติ" ต่อ option → Task 6 step 1
- ✓ Helper text 3 states → Task 6 step 2
- ✓ Cleanup logic on remove option / type change → Task 4 + 5
- ✓ Default ใน emptyValueField → Task 4 step 1
- ✓ QC Testing abnormal indicator (border แดง + AlertTriangle + tooltip) → Task 7
- ✓ Helper `isEnumAbnormal` → Task 3
- ✓ Migration ไม่ต้อง — field optional, backward compatible (no task needed)
- ✓ Testing → Task 3 (unit) + Task 6 step 3 + Task 7 step 6 (manual) + Task 8 (regression)

**Placeholder scan:** ไม่มี TBD/TODO, code ครบทุก step ที่ต้องเขียน code, ไม่มี "implement later"

**Type consistency:** `expectedValues: string[]`, `isEnumAbnormal(field, value)` — ใช้ชื่อเดียวกันทุก task
