# Numeric Standard Value Operators Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่ม `standardOperator` + `standardValue2` บน number/float parameter ให้รองรับ 7 operators (lt, lte, eq, gte, gt, between, tolerance) พร้อม abnormal detection ใน QC Testing ด้วย visual indicator ตัวเดียวกับ ENUM

**Architecture:** ขยาย Mongoose schema + TypeScript type, เพิ่ม helper `isNumericAbnormal` + `isFieldAbnormal` ใน `src/lib/parameterValidation.ts` (ไฟล์ที่สร้างจาก spec ก่อน), แทน block "หน่วย + ค่ามาตรฐาน" ใน ParameterSettings ด้วย operator dropdown + dynamic inputs (1 หรือ 2 ช่องตาม operator), ใช้ isFieldAbnormal แทน isEnumAbnormal ใน QCTestingDetailPage แล้วเพิ่ม abnormal styling กับ numeric Input

**Tech Stack:** React 18 + TypeScript, Mongoose (Express backend), Vitest (unit tests), shadcn/ui (Select, Input, Checkbox), lucide-react icons, Tailwind CSS

**Spec reference:** [docs/superpowers/specs/2026-05-23-numeric-standard-operators-design.md](../specs/2026-05-23-numeric-standard-operators-design.md)

**Prerequisite:** ENUM expected values plan ([2026-05-23-enum-expected-values.md](2026-05-23-enum-expected-values.md)) ต้อง implement เสร็จก่อน — งานนี้ต่อยอดจาก `src/lib/parameterValidation.ts` และ `TestField` ที่มี `isAbnormal` แล้ว

---

### Task 1: Backend — add standardOperator + standardValue2 to Mongoose schema

**Files:**
- Modify: `server/models/Parameter.js`

- [ ] **Step 1: Add fields to ValueFieldSchema**

แก้ `server/models/Parameter.js` lines 3-13 (`ValueFieldSchema`) — เพิ่ม 2 fields หลัง `expectedValues`:

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
  standardValue: { type: Number, default: null },
  standardOperator: {
    type: String,
    enum: ['lt', 'lte', 'eq', 'gte', 'gt', 'between', 'tolerance', null],
    default: null,
  },
  standardValue2: { type: Number, default: null },
  required: { type: Boolean, default: false },
}, { _id: false });
```

(หมายเหตุ: เพิ่ม `standardValue` ลงใน schema ด้วย — เดิมไม่มี เพราะ schema เก่ามีแต่ `min`/`max`; frontend type มี standardValue อยู่แล้ว ดังนั้นเก็บไว้ตอนนี้ก็ดี ค่อยทำความสะอาด `min`/`max` แยก scope)

- [ ] **Step 2: Add pre-validate block for operator constraints**

แก้ `server/models/Parameter.js` ใน `ParameterSchema.pre('validate', ...)` (lines 27-47) — เพิ่ม block หลัง `expectedValues` validation block (หลัง block ที่ถูกเพิ่มใน plan ก่อน) และก่อน `if (f.min != null && f.max != null...`:

```js
    if (['number', 'float'].includes(f.type) && f.standardOperator) {
      if (f.standardValue == null) {
        return next(new Error(`ช่อง "${f.label}": ต้องระบุค่ามาตรฐานเมื่อมี standardOperator`));
      }
      if (f.standardOperator === 'between') {
        if (f.standardValue2 == null) {
          return next(new Error(`ช่อง "${f.label}": ต้องระบุค่าสิ้นสุดของช่วง (between)`));
        }
        if (f.standardValue > f.standardValue2) {
          return next(new Error(`ช่อง "${f.label}": ค่าเริ่มต้นต้องน้อยกว่าหรือเท่ากับค่าสิ้นสุด (between)`));
        }
      }
      if (f.standardOperator === 'tolerance') {
        if (f.standardValue2 == null || f.standardValue2 <= 0) {
          return next(new Error(`ช่อง "${f.label}": tolerance % ต้องมากกว่า 0`));
        }
      }
    }
```

- [ ] **Step 3: Verify schema loads**

Run: `node -e "require('./server/models/Parameter.js'); console.log('schema loaded OK')"`
Expected output: `schema loaded OK`

- [ ] **Step 4: Commit**

```bash
git add server/models/Parameter.js
git commit -m "feat(parameters): add standardOperator and standardValue2 to schema with validation"
```

---

### Task 2: Frontend type — add StandardOperator + extend ParameterValueField

**Files:**
- Modify: `src/lib/api.ts:219-230`

- [ ] **Step 1: Add StandardOperator type and extend ParameterValueField**

แก้ `src/lib/api.ts` lines 219-230 — เพิ่ม type `StandardOperator` ก่อน `ParameterValueField` และเพิ่ม 2 fields ลงใน `ParameterValueField`:

```ts
export type ParameterValueFieldType = "text" | "number" | "float" | "enum" | "photo" | "timer";

export type StandardOperator =
  | "lt"
  | "lte"
  | "eq"
  | "gte"
  | "gt"
  | "between"
  | "tolerance";

export type ParameterValueField = {
  label: string;
  type: ParameterValueFieldType;
  unit?: string;
  standardValue?: number | null;
  standardOperator?: StandardOperator;
  standardValue2?: number | null;
  options?: string[];
  requireNoteOn?: string[];
  expectedValues?: string[];
  required?: boolean;
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: ไม่มี error เกี่ยวกับ ParameterValueField หรือ StandardOperator

- [ ] **Step 3: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat(parameters): add StandardOperator type and extend ParameterValueField"
```

---

### Task 3: Helper — isNumericAbnormal + isFieldAbnormal with unit tests (TDD)

**Files:**
- Modify: `src/lib/parameterValidation.ts`
- Modify: `src/lib/parameterValidation.test.ts`

- [ ] **Step 1: Write failing tests for isNumericAbnormal**

เพิ่มที่ท้ายไฟล์ `src/lib/parameterValidation.test.ts` (หลัง describe block `isEnumAbnormal`):

```ts
import { isNumericAbnormal, isFieldAbnormal } from "./parameterValidation";

const makeNum = (overrides: Partial<ParameterValueField>): ParameterValueField => ({
  label: "ph",
  type: "number",
  unit: "%",
  standardValue: 5,
  standardOperator: undefined,
  standardValue2: null,
  ...overrides,
});

describe("isNumericAbnormal", () => {
  it("returns false for non-numeric types", () => {
    const field: ParameterValueField = {
      label: "x", type: "enum", standardValue: 5, standardOperator: "eq",
    };
    expect(isNumericAbnormal(field, 10)).toBe(false);
  });

  it("returns false when operator is undefined (no check)", () => {
    const field = makeNum({ standardOperator: undefined });
    expect(isNumericAbnormal(field, 999)).toBe(false);
  });

  it("returns false when standardValue is null", () => {
    const field = makeNum({ standardOperator: "eq", standardValue: null });
    expect(isNumericAbnormal(field, 5)).toBe(false);
  });

  it("returns false for empty/null/undefined value", () => {
    const field = makeNum({ standardOperator: "eq", standardValue: 5 });
    expect(isNumericAbnormal(field, "")).toBe(false);
    expect(isNumericAbnormal(field, null)).toBe(false);
    expect(isNumericAbnormal(field, undefined)).toBe(false);
  });

  it("returns false for NaN value", () => {
    const field = makeNum({ standardOperator: "eq", standardValue: 5 });
    expect(isNumericAbnormal(field, "abc")).toBe(false);
  });

  it("coerces numeric string to number", () => {
    const field = makeNum({ standardOperator: "eq", standardValue: 5 });
    expect(isNumericAbnormal(field, "5")).toBe(false);
    expect(isNumericAbnormal(field, "6")).toBe(true);
  });

  describe("operator: lt (<)", () => {
    const field = makeNum({ standardOperator: "lt", standardValue: 5 });
    it("normal when value < standard", () => expect(isNumericAbnormal(field, 4)).toBe(false));
    it("abnormal when value == standard", () => expect(isNumericAbnormal(field, 5)).toBe(true));
    it("abnormal when value > standard", () => expect(isNumericAbnormal(field, 6)).toBe(true));
  });

  describe("operator: lte (<=)", () => {
    const field = makeNum({ standardOperator: "lte", standardValue: 5 });
    it("normal when value < standard", () => expect(isNumericAbnormal(field, 4)).toBe(false));
    it("normal when value == standard", () => expect(isNumericAbnormal(field, 5)).toBe(false));
    it("abnormal when value > standard", () => expect(isNumericAbnormal(field, 6)).toBe(true));
  });

  describe("operator: eq (=)", () => {
    const field = makeNum({ standardOperator: "eq", standardValue: 5 });
    it("normal when value == standard", () => expect(isNumericAbnormal(field, 5)).toBe(false));
    it("abnormal when value < standard", () => expect(isNumericAbnormal(field, 4)).toBe(true));
    it("abnormal when value > standard", () => expect(isNumericAbnormal(field, 6)).toBe(true));
  });

  describe("operator: gte (>=)", () => {
    const field = makeNum({ standardOperator: "gte", standardValue: 5 });
    it("abnormal when value < standard", () => expect(isNumericAbnormal(field, 4)).toBe(true));
    it("normal when value == standard", () => expect(isNumericAbnormal(field, 5)).toBe(false));
    it("normal when value > standard", () => expect(isNumericAbnormal(field, 6)).toBe(false));
  });

  describe("operator: gt (>)", () => {
    const field = makeNum({ standardOperator: "gt", standardValue: 5 });
    it("abnormal when value < standard", () => expect(isNumericAbnormal(field, 4)).toBe(true));
    it("abnormal when value == standard", () => expect(isNumericAbnormal(field, 5)).toBe(true));
    it("normal when value > standard", () => expect(isNumericAbnormal(field, 6)).toBe(false));
  });

  describe("operator: between", () => {
    const field = makeNum({
      standardOperator: "between", standardValue: 4, standardValue2: 6,
    });
    it("normal at lower bound", () => expect(isNumericAbnormal(field, 4)).toBe(false));
    it("normal in range", () => expect(isNumericAbnormal(field, 5)).toBe(false));
    it("normal at upper bound", () => expect(isNumericAbnormal(field, 6)).toBe(false));
    it("abnormal below lower", () => expect(isNumericAbnormal(field, 3.99)).toBe(true));
    it("abnormal above upper", () => expect(isNumericAbnormal(field, 6.01)).toBe(true));
    it("returns false when standardValue2 missing", () => {
      const bad = makeNum({ standardOperator: "between", standardValue: 4, standardValue2: null });
      expect(isNumericAbnormal(bad, 10)).toBe(false);
    });
  });

  describe("operator: tolerance", () => {
    const field = makeNum({
      standardOperator: "tolerance", standardValue: 100, standardValue2: 5,
    });
    it("normal at center", () => expect(isNumericAbnormal(field, 100)).toBe(false));
    it("normal at +5% boundary", () => expect(isNumericAbnormal(field, 105)).toBe(false));
    it("normal at -5% boundary", () => expect(isNumericAbnormal(field, 95)).toBe(false));
    it("abnormal above tolerance", () => expect(isNumericAbnormal(field, 105.01)).toBe(true));
    it("abnormal below tolerance", () => expect(isNumericAbnormal(field, 94.99)).toBe(true));
    it("returns false when standardValue2 missing", () => {
      const bad = makeNum({ standardOperator: "tolerance", standardValue: 100, standardValue2: null });
      expect(isNumericAbnormal(bad, 200)).toBe(false);
    });
    it("returns false when standardValue2 <= 0", () => {
      const bad = makeNum({ standardOperator: "tolerance", standardValue: 100, standardValue2: 0 });
      expect(isNumericAbnormal(bad, 200)).toBe(false);
    });
    it("uses absolute value of center for tolerance calc (negative center)", () => {
      const neg = makeNum({ standardOperator: "tolerance", standardValue: -10, standardValue2: 10 });
      expect(isNumericAbnormal(neg, -10)).toBe(false);
      expect(isNumericAbnormal(neg, -9)).toBe(false);
      expect(isNumericAbnormal(neg, -8.99)).toBe(true);
    });
  });
});

describe("isFieldAbnormal", () => {
  it("returns true when enum is abnormal", () => {
    const field: ParameterValueField = {
      label: "e", type: "enum",
      options: ["ดี", "แย่"], expectedValues: ["ดี"],
    };
    expect(isFieldAbnormal(field, "แย่")).toBe(true);
    expect(isFieldAbnormal(field, "ดี")).toBe(false);
  });

  it("returns true when numeric is abnormal", () => {
    const field = makeNum({ standardOperator: "lte", standardValue: 5 });
    expect(isFieldAbnormal(field, 6)).toBe(true);
    expect(isFieldAbnormal(field, 4)).toBe(false);
  });

  it("returns false for text fields", () => {
    const field: ParameterValueField = { label: "t", type: "text" };
    expect(isFieldAbnormal(field, "anything")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- src/lib/parameterValidation.test.ts`
Expected: FAIL — `isNumericAbnormal is not exported` and/or `isFieldAbnormal is not exported`

- [ ] **Step 3: Add implementations to parameterValidation.ts**

แก้ `src/lib/parameterValidation.ts` — เพิ่มต่อท้าย (หลัง `isEnumAbnormal`):

```ts
export function isNumericAbnormal(
  field: ParameterValueField,
  value: unknown,
): boolean {
  if (field.type !== "number" && field.type !== "float") return false;
  if (!field.standardOperator) return false;
  if (field.standardValue == null) return false;
  if (value === null || value === undefined || value === "") return false;
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return false;

  const v1 = field.standardValue;
  const v2 = field.standardValue2;

  switch (field.standardOperator) {
    case "lt": return num >= v1;
    case "lte": return num > v1;
    case "eq": return num !== v1;
    case "gte": return num < v1;
    case "gt": return num <= v1;
    case "between":
      if (v2 == null) return false;
      return num < v1 || num > v2;
    case "tolerance":
      if (v2 == null || v2 <= 0) return false;
      return Math.abs(num - v1) > Math.abs(v1) * (v2 / 100);
    default:
      return false;
  }
}

export function isFieldAbnormal(
  field: ParameterValueField,
  value: unknown,
): boolean {
  return isEnumAbnormal(field, value) || isNumericAbnormal(field, value);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- src/lib/parameterValidation.test.ts`
Expected: PASS — ทั้งหมด (9 เดิม + ใหม่ ~30 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/parameterValidation.ts src/lib/parameterValidation.test.ts
git commit -m "feat(parameters): add isNumericAbnormal and isFieldAbnormal helpers"
```

---

### Task 4: ParameterSettings — emptyValueField + type-change reset + validate()

**Files:**
- Modify: `src/pages/ParameterSettings.tsx`

- [ ] **Step 1: Update emptyValueField**

แก้ `src/pages/ParameterSettings.tsx` (`emptyValueField` function) — เพิ่ม 2 fields:

```ts
const emptyValueField = (): ParameterValueField => ({
  label: "",
  type: "text",
  unit: "",
  standardValue: null,
  standardOperator: undefined,
  standardValue2: null,
  options: [],
  requireNoteOn: [],
  expectedValues: [],
  required: false,
});
```

- [ ] **Step 2: Update type-change Select onValueChange to reset new fields**

แก้ `src/pages/ParameterSettings.tsx` ใน `ValueFieldEditor` ที่ `Select onValueChange` ของ field type (ส่วนที่เพิ่ม `expectedValues` ในงานก่อน) — เพิ่ม reset 2 fields ใหม่:

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
                    standardOperator: v === "number" || v === "float" ? field.standardOperator : undefined,
                    standardValue2: v === "number" || v === "float" ? field.standardValue2 ?? null : null,
                  })
                }
```

- [ ] **Step 3: Update validate() for new operator constraints**

แก้ `src/pages/ParameterSettings.tsx` (function `validate`, lines ~714-728) — แทนที่ block check standardValue เดิม:

```ts
    const fields = form.valueFields ?? [];
    for (let i = 0; i < fields.length; i += 1) {
      const f = fields[i];
      if (!f.label?.trim()) return `ช่องที่ ${i + 1}: กรุณากรอกชื่อช่อง`;
      if ((f.type === "number" || f.type === "float") && !f.unit?.trim()) {
        return `ช่อง "${f.label}": ต้องระบุหน่วย`;
      }
      if (f.type === "number" || f.type === "float") {
        if (f.standardOperator) {
          if (f.standardValue == null) {
            return `ช่อง "${f.label}": ต้องระบุค่ามาตรฐาน`;
          }
          if (f.standardOperator === "between") {
            if (f.standardValue2 == null) {
              return `ช่อง "${f.label}": ต้องระบุค่าสิ้นสุดของช่วง`;
            }
            if (f.standardValue > f.standardValue2) {
              return `ช่อง "${f.label}": ค่าเริ่มต้นต้องน้อยกว่าหรือเท่ากับค่าสิ้นสุด`;
            }
          }
          if (f.standardOperator === "tolerance") {
            if (f.standardValue2 == null || f.standardValue2 <= 0) {
              return `ช่อง "${f.label}": tolerance % ต้องมากกว่า 0`;
            }
          }
        }
      }
      if (f.type === "enum" && (!f.options || f.options.length === 0)) {
        return `ช่อง "${f.label}": ต้องมีตัวเลือกอย่างน้อย 1 ตัว`;
      }
    }
    return null;
```

(หมายเหตุ: เปลี่ยนจาก "บังคับ standardValue เสมอ" → "บังคับเฉพาะเมื่อมี operator" — backward compatible)

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: ไม่มี error

- [ ] **Step 5: Commit**

```bash
git add src/pages/ParameterSettings.tsx
git commit -m "feat(parameters): init operator fields and update validation"
```

---

### Task 5: ParameterSettings — operator dropdown + dynamic value inputs + preview

**Files:**
- Modify: `src/pages/ParameterSettings.tsx`

- [ ] **Step 1: Add OPERATOR_OPTIONS constant**

แก้ `src/pages/ParameterSettings.tsx` — เพิ่มหลัง `VALUE_TYPE_OPTIONS` (ใกล้ๆ บรรทัด 63-70):

```ts
import {
  api,
  type ParameterItem,
  type ParameterValueField,
  type ParameterValueFieldType,
  type StandardOperator,
} from "@/lib/api";
```

แก้ import ตรงท้ายให้เพิ่ม `StandardOperator` type (อยู่บรรทัดประมาณ 50-56)

แล้วเพิ่ม constant ใต้ `VALUE_TYPE_OPTIONS`:

```ts
const OPERATOR_OPTIONS: { value: StandardOperator | "none"; label: string }[] = [
  { value: "none", label: "ไม่ตรวจค่าผิดปกติ" },
  { value: "lt", label: "< น้อยกว่า" },
  { value: "lte", label: "≤ น้อยกว่าหรือเท่ากับ" },
  { value: "eq", label: "= เท่ากับ" },
  { value: "gte", label: "≥ มากกว่าหรือเท่ากับ" },
  { value: "gt", label: "> มากกว่า" },
  { value: "between", label: "ระหว่าง (range)" },
  { value: "tolerance", label: "± % (tolerance)" },
];
```

- [ ] **Step 2: Replace the requiresUnit block with operator UI**

แก้ `src/pages/ParameterSettings.tsx` (function `ValueFieldEditor`, `requiresUnit` block — ปัจจุบันคือ "หน่วย + ค่ามาตรฐาน" 4-col + 8-col layout) — แทนที่ทั้ง block ด้วย:

ค้นหา block ที่ขึ้นต้นด้วย:
```tsx
          {requiresUnit ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
              <div className="sm:col-span-4 space-y-1.5">
                <Label className="text-sm">หน่วย *</Label>
                <Input
                  value={field.unit ?? ""}
```

แทนที่ทั้งบล็อกตั้งแต่ `{requiresUnit ? (` จนถึง `) : null}` ที่ปิด requiresUnit (ก่อน `{isEnum ? (`) ด้วย:

```tsx
          {requiresUnit ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                <div className="sm:col-span-3 space-y-1.5">
                  <Label className="text-sm">หน่วย *</Label>
                  <Input
                    value={field.unit ?? ""}
                    onChange={(e) => onChange({ ...field, unit: e.target.value })}
                    placeholder="เช่น %, mg/L, cP"
                    className="h-10"
                  />
                </div>
                <div className="sm:col-span-4 space-y-1.5">
                  <Label className="text-sm">เงื่อนไข</Label>
                  <Select
                    value={field.standardOperator ?? "none"}
                    onValueChange={(v) => {
                      const op = v === "none" ? undefined : (v as StandardOperator);
                      onChange({
                        ...field,
                        standardOperator: op,
                        standardValue2:
                          op === "between" || op === "tolerance" ? field.standardValue2 ?? null : null,
                      });
                    }}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATOR_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {field.standardOperator === "between" ? (
                  <>
                    <div className="sm:col-span-2.5 space-y-1.5">
                      <Label className="text-sm">ตั้งแต่ *</Label>
                      <Input
                        type="number"
                        value={field.standardValue ?? ""}
                        onChange={(e) =>
                          onChange({
                            ...field,
                            standardValue: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        className="h-10"
                      />
                    </div>
                    <div className="sm:col-span-2.5 space-y-1.5">
                      <Label className="text-sm">ถึง *</Label>
                      <Input
                        type="number"
                        value={field.standardValue2 ?? ""}
                        onChange={(e) =>
                          onChange({
                            ...field,
                            standardValue2: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        className="h-10"
                      />
                    </div>
                  </>
                ) : field.standardOperator === "tolerance" ? (
                  <>
                    <div className="sm:col-span-2.5 space-y-1.5">
                      <Label className="text-sm">ค่ามาตรฐาน *</Label>
                      <Input
                        type="number"
                        value={field.standardValue ?? ""}
                        onChange={(e) =>
                          onChange({
                            ...field,
                            standardValue: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        className="h-10"
                      />
                    </div>
                    <div className="sm:col-span-2.5 space-y-1.5">
                      <Label className="text-sm">± (%) *</Label>
                      <Input
                        type="number"
                        value={field.standardValue2 ?? ""}
                        onChange={(e) =>
                          onChange({
                            ...field,
                            standardValue2: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        className="h-10"
                      />
                    </div>
                  </>
                ) : field.standardOperator ? (
                  <div className="sm:col-span-5 space-y-1.5">
                    <Label className="text-sm">ค่ามาตรฐาน *</Label>
                    <Input
                      type="number"
                      value={field.standardValue ?? ""}
                      onChange={(e) =>
                        onChange({
                          ...field,
                          standardValue: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                      className="h-10"
                    />
                  </div>
                ) : null}
              </div>
              <StandardPreview field={field} />
            </div>
          ) : null}
```

หมายเหตุ: ใช้ `sm:col-span-2.5` ซึ่งไม่ใช่ Tailwind class มาตรฐาน — เปลี่ยนเป็น `sm:col-span-3` (รวมก็จะเกิน 12 — ใช้แทนด้วย wrap) หรือใช้ flexbox แทน grid

**Cleanup hint:** ใช้ grid 12 columns: หน่วย=3, เงื่อนไข=4, ค่ามาตรฐาน เดี่ยว=5 (ครบ 12); เมื่อ between/tolerance ใช้ 2 ช่องช่องละ 2 หรือ 3 columns — ถ้าเกิน 12 ใช้ wrap จาก grid (`grid grid-cols-12 ...` จะ wrap auto)

**แก้ใหม่ — ใช้ col-span-3 และ col-span-2 แทน:**

แทนที่ `sm:col-span-2.5` ทั้ง 4 จุดด้วย `sm:col-span-3`:
- `between` ตั้งแต่ → `sm:col-span-3`, ถึง → `sm:col-span-2` (= 3+4+3+2=12 ✓)
- `tolerance` ค่ามาตรฐาน → `sm:col-span-3`, ± (%) → `sm:col-span-2` (= 12 ✓)

- [ ] **Step 3: Add StandardPreview component**

แก้ `src/pages/ParameterSettings.tsx` — เพิ่ม component ใหม่ก่อน `ValueFieldEditor` (ใกล้บรรทัด 369-377 ช่วงก่อน `type ValueFieldEditorProps`):

```tsx
function StandardPreview({ field }: { field: ParameterValueField }) {
  const op = field.standardOperator;
  const v1 = field.standardValue;
  const v2 = field.standardValue2;
  const unit = field.unit ? ` ${field.unit}` : "";

  if (!op) {
    return (
      <p className="text-xs text-muted-foreground">
        ยังไม่ได้กำหนดเงื่อนไข — จะไม่ตรวจค่าผิดปกติ
      </p>
    );
  }
  if (v1 == null) {
    return (
      <p className="text-xs text-muted-foreground">
        ยังไม่ได้กรอกค่ามาตรฐาน
      </p>
    );
  }

  let text = "";
  switch (op) {
    case "lt": text = `ค่าปกติ: < ${v1}${unit}`; break;
    case "lte": text = `ค่าปกติ: ≤ ${v1}${unit}`; break;
    case "eq": text = `ค่าปกติ: = ${v1}${unit}`; break;
    case "gte": text = `ค่าปกติ: ≥ ${v1}${unit}`; break;
    case "gt": text = `ค่าปกติ: > ${v1}${unit}`; break;
    case "between":
      if (v2 == null) return <p className="text-xs text-muted-foreground">ยังไม่ได้กรอกค่าสิ้นสุดของช่วง</p>;
      text = `ค่าปกติ: ${v1} - ${v2}${unit}`;
      break;
    case "tolerance":
      if (v2 == null || v2 <= 0) return <p className="text-xs text-muted-foreground">ยังไม่ได้กรอก tolerance %</p>;
      {
        const low = v1 - Math.abs(v1) * (v2 / 100);
        const high = v1 + Math.abs(v1) * (v2 / 100);
        text = `ค่าปกติ: ${v1} ± ${v2}% (${low} - ${high})${unit}`;
      }
      break;
  }
  return <p className="text-xs text-emerald-700">{text}</p>;
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: ไม่มี error

- [ ] **Step 5: Manual smoke test (dev server)**

Note: dev server น่าจะรันอยู่แล้ว — ไม่ต้อง `npm run build` ([memory: no_npm_run_build](../../../../C:/Users/it6ic/.claude/projects/c--Project-LIS/memory/feedback_no_npm_run_build.md))

เปิด Parameter Settings → สร้าง field ใหม่ type = `จำนวนเต็ม` หรือ `ทศนิยม`:
- Operator dropdown default = `ไม่ตรวจค่าผิดปกติ` → preview: "ยังไม่ได้กำหนดเงื่อนไข..."
- เลือก `< น้อยกว่า` → ปรากฏ input `ค่ามาตรฐาน *` 1 ช่อง
- เลือก `ระหว่าง` → ปรากฏ 2 input (`ตั้งแต่`, `ถึง`)
- เลือก `± % (tolerance)` → ปรากฏ 2 input (`ค่ามาตรฐาน`, `± (%)`)
- กรอกค่า → preview text update
- เปลี่ยน operator → standardValue2 reset ตาม
- บันทึก → refresh → เปิดใหม่ — ค่ายังอยู่ครบ

- [ ] **Step 6: Commit**

```bash
git add src/pages/ParameterSettings.tsx
git commit -m "feat(parameters): replace standardValue input with operator dropdown + dynamic inputs"
```

---

### Task 6: QC Testing — apply abnormal indicator to numeric Input

**Files:**
- Modify: `src/pages/QCTestingDetailPage.tsx`

- [ ] **Step 1: Replace isEnumAbnormal import with isFieldAbnormal**

แก้ `src/pages/QCTestingDetailPage.tsx` ส่วน import:

```ts
import { isFieldAbnormal } from '@/lib/parameterValidation';
```

(เปลี่ยนจาก `isEnumAbnormal` ที่เพิ่มในงานก่อนหน้า)

- [ ] **Step 2: Update isAbnormal in TestField to use isFieldAbnormal**

แก้ `src/pages/QCTestingDetailPage.tsx` ใน `TestField`:

```ts
  const isAbnormal = isFieldAbnormal(field, value);
```

(เปลี่ยนจาก `isEnumAbnormal(field, value)`)

- [ ] **Step 3: Add describeStandard helper inside TestField scope or at top**

แก้ `src/pages/QCTestingDetailPage.tsx` — เพิ่ม helper function ก่อน `TestField` component หรือใกล้ๆ:

```ts
function describeStandard(field: ParameterValueField): string {
  const op = field.standardOperator;
  const v1 = field.standardValue;
  const v2 = field.standardValue2;
  const unit = field.unit ? ` ${field.unit}` : '';
  switch (op) {
    case 'lt': return `< ${v1}${unit}`;
    case 'lte': return `≤ ${v1}${unit}`;
    case 'eq': return `= ${v1}${unit}`;
    case 'gte': return `≥ ${v1}${unit}`;
    case 'gt': return `> ${v1}${unit}`;
    case 'between': return `${v1} - ${v2}${unit}`;
    case 'tolerance': return `${v1} ± ${v2}%${unit}`;
    default: return '';
  }
}
```

- [ ] **Step 4: Update tooltip on AlertTriangle to handle both enum + numeric**

แก้ block `{isAbnormal && (...)}` ใน `TestField` — ปัจจุบัน tooltip hard-code expectedValues. แทนด้วย:

```tsx
        {isAbnormal && (
          <span
            className="inline-flex items-center"
            title={
              field.type === 'enum'
                ? `ค่าผิดปกติ — คาดหวัง: ${(field.expectedValues ?? []).join(', ')}`
                : `ค่าผิดปกติ — คาดหวัง: ${describeStandard(field)}`
            }
          >
            <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
          </span>
        )}
```

- [ ] **Step 5: Apply abnormal styling to numeric Input**

แก้ `src/pages/QCTestingDetailPage.tsx` ใน `TestField` ส่วน render Input (เฉพาะ number/float — ตอนนี้รวม text/timer ด้วย) — เพิ่ม `cn` กับ className:

ค้นหา block:
```tsx
      ) : (
        <Input
          type={field.type === 'number' || field.type === 'float' || field.type === 'timer' ? 'number' : 'text'}
          step={field.type === 'float' ? 'any' : undefined}
          min={field.type !== 'text' ? (field as any).min : undefined}
          max={field.type !== 'text' ? (field as any).max : undefined}
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 text-sm"
          placeholder={field.standardValue != null ? `มาตรฐาน: ${field.standardValue}` : undefined}
        />
      )}
```

แทนด้วย:

```tsx
      ) : (
        <Input
          type={field.type === 'number' || field.type === 'float' || field.type === 'timer' ? 'number' : 'text'}
          step={field.type === 'float' ? 'any' : undefined}
          min={field.type !== 'text' ? (field as any).min : undefined}
          max={field.type !== 'text' ? (field as any).max : undefined}
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'h-8 text-sm',
            isAbnormal && 'border-red-400 ring-1 ring-red-200',
          )}
          placeholder={
            field.standardOperator
              ? `มาตรฐาน: ${describeStandard(field)}`
              : field.standardValue != null
                ? `มาตรฐาน: ${field.standardValue}`
                : undefined
          }
        />
      )}
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: ไม่มี error

- [ ] **Step 7: Manual smoke test**

(ถ้า dev server ไม่ได้รัน: `npm run dev`)

1. ใน Parameter Settings สร้าง field number ที่:
   - operator = `≥`, standardValue = 5, unit = "%"
2. เข้า QC Testing detail ของ sample ที่ใช้ parameter นั้น
3. กรอกค่า 4 → Input มี border แดง, AlertTriangle icon, tooltip: "ค่าผิดปกติ — คาดหวัง: ≥ 5 %"
4. กรอกค่า 5 → ไม่มี indicator
5. ลองเปลี่ยน parameter เป็น operator `ระหว่าง` 4-6 → ค่า 7 abnormal, ค่า 5 ปกติ
6. ลอง `tolerance` 100 ± 5% → ค่า 96 ปกติ, ค่า 94 abnormal
7. parameter ที่ไม่มี operator (legacy) → ไม่มี indicator (พฤติกรรมเดิม)

- [ ] **Step 8: Commit**

```bash
git add src/pages/QCTestingDetailPage.tsx
git commit -m "feat(qc-testing): show abnormal indicator for numeric values per standardOperator"
```

---

### Task 7: Regression check

**Files:**
- N/A (run existing checks)

- [ ] **Step 1: Run vitest suite**

Run: `npm run test`
Expected: ทุก test PASS (รวม parameterValidation tests ทั้งเก่าและใหม่)

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: ไม่มี new error/warning จาก ParameterSettings.tsx, QCTestingDetailPage.tsx, parameterValidation.ts ที่เพิ่งแก้ (lint errors เดิม เช่น `Unexpected any` ที่ line 137-138 ของ QCTestingDetailPage มาก่อนงานนี้ ข้ามได้)

- [ ] **Step 3: Update e2e snapshot ถ้ากระทบ**

ถ้า `tests/e2e/qc-testing.spec.ts` มี snapshot ที่เปลี่ยนเพราะ Input style ใหม่:

Run: `npx playwright test tests/e2e/qc-testing.spec.ts`

ถ้า fail เพราะ snapshot (ไม่ใช่ logic regression) — update:

Run: `npx playwright test tests/e2e/qc-testing.spec.ts --update-snapshots`

Commit (ถ้ามี snapshot update):

```bash
git add tests/e2e/
git commit -m "test(qc-testing): update snapshots for numeric abnormal indicator"
```

ถ้าไม่มี snapshot กระทบ — ข้าม

---

## Self-Review

**Spec coverage:**
- ✓ Schema 2 fields (operator + value2) → Task 1 (backend) + Task 2 (frontend)
- ✓ 7 operators with semantics → Task 3 (isNumericAbnormal switch)
- ✓ Backend pre-validate (between needs value2 + start ≤ end, tolerance > 0) → Task 1 step 2
- ✓ Frontend validate() updated → Task 4 step 3
- ✓ Operator dropdown + dynamic inputs → Task 5 step 2
- ✓ Preview text for each operator (StandardPreview component) → Task 5 step 3
- ✓ Cleanup on type change → Task 4 step 2
- ✓ Cleanup on operator change → Task 5 step 2 (onValueChange resets standardValue2 conditionally)
- ✓ isNumericAbnormal + isFieldAbnormal helpers → Task 3
- ✓ describeStandard + tooltip update → Task 6 step 3-4
- ✓ Apply abnormal styling to numeric Input → Task 6 step 5
- ✓ Backward compat (no operator → no check) → Task 1, 3, 4, 6 (ทุก code path มี early return)
- ✓ Unit tests for all operators + edge cases → Task 3 step 1

**Placeholder scan:** ไม่มี TBD/TODO. Code ครบทุก step. `npm run dev` mentioned with note about user's memory feedback.

**Type consistency:**
- `StandardOperator` type used consistently in Tasks 2, 3, 4, 5, 6
- `isNumericAbnormal(field, value)` signature matches across declaration (Task 3) and usage (`isFieldAbnormal` Task 3, `TestField` Task 6 via isFieldAbnormal)
- `describeStandard(field)` declared and used in Task 6
- Backend `standardOperator` enum string list matches frontend `StandardOperator` union exactly
