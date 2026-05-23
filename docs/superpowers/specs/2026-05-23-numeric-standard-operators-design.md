# Numeric Standard Value Operators — Design

**Date:** 2026-05-23
**Status:** Approved
**Scope:** ParameterSettings + QC Testing abnormal detection สำหรับ `number` / `float` parameters

## Problem

ใน parameter setting ปัจจุบัน:
- ฟิลด์ `number` / `float` มี `standardValue: number | null` แต่ไม่มี **operator** ใช้แค่เป็น placeholder hint บน input — ตรวจ abnormal ไม่ได้
- ENUM มี `expectedValues[]` แล้ว (จาก spec ก่อนหน้า [2026-05-23-enum-expected-values-design](2026-05-23-enum-expected-values-design.md)) แต่ numeric ยังไม่มี

ความต้องการ: ค่ามาตรฐานต้องระบุ **เงื่อนไข** ได้ เช่น น้อยกว่า, มากกว่า, เท่ากับ, น้อยกว่าหรือเท่ากับ, มากกว่าหรือเท่ากับ, ระหว่าง, และ tolerance ± %

## Goals

- เพิ่ม `standardOperator` และ `standardValue2` บน `ParameterValueField`
- รองรับ 7 operator: `lt`, `lte`, `eq`, `gte`, `gt`, `between`, `tolerance`
- UI ใน ParameterSettings: dropdown เลือก operator + input ค่าตามจำนวนที่ต้องการ + preview text
- QC Testing แสดง abnormal indicator (border แดง + AlertTriangle icon) เมื่อค่าผิดเงื่อนไข
- ใช้ visual indicator ตัวเดียวกับ ENUM ที่เพิ่งทำในรอบก่อน
- Backward compatible — legacy data ไม่มี operator → ไม่ตรวจ abnormal (พฤติกรรมเดิม)

## Non-Goals

- ไม่ตั้ง default operator ให้ field ใหม่อัตโนมัติ (user เลือกเอง)
- ไม่ migrate legacy data ที่มีแค่ standardValue (ปล่อยไว้ — user ต้องไปเซ็ต operator ทีหลังถึงจะเริ่มตรวจ)
- ไม่เพิ่ม **tolerance แบบ absolute** (เช่น ± 0.5) — ใช้ `between` แทนได้
- ไม่ผูกกับ `requireNoteOn` (ENUM only concept)
- ไม่แก้ระบบ status เดิม (`densityStatus`, `physicalStatus`) ใน SampleContext ซึ่งเป็น flow อื่น

## Schema Change

### Frontend ([src/lib/api.ts](../../../src/lib/api.ts))

เพิ่ม type ใหม่และขยาย `ParameterValueField`:

```ts
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

### Backend ([server/models/Parameter.js](../../../server/models/Parameter.js))

ใน `ValueFieldSchema` เพิ่ม:

```js
standardValue: { type: Number, default: null },
standardOperator: {
  type: String,
  enum: ['lt', 'lte', 'eq', 'gte', 'gt', 'between', 'tolerance', null],
  default: null,
},
standardValue2: { type: Number, default: null },
```

ใน `ParameterSchema.pre('validate', ...)` เพิ่ม block:

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

## Operator Semantics

| op | label (Thai) | abnormal when | requires |
|---|---|---|---|
| `lt` | น้อยกว่า | value ≥ standardValue | standardValue |
| `lte` | น้อยกว่าหรือเท่ากับ | value > standardValue | standardValue |
| `eq` | เท่ากับ | value ≠ standardValue | standardValue |
| `gte` | มากกว่าหรือเท่ากับ | value < standardValue | standardValue |
| `gt` | มากกว่า | value ≤ standardValue | standardValue |
| `between` | ระหว่าง | value < standardValue OR value > standardValue2 | standardValue + standardValue2 (≤) |
| `tolerance` | ± % | \|value − standardValue\| > standardValue × (standardValue2 / 100) | standardValue + standardValue2 (>0) |

**Edge cases:**
- value ที่ว่าง / null / undefined → ไม่ถือว่า abnormal (ยังไม่กรอก)
- operator undefined / null → ไม่ตรวจ (พฤติกรรมเดิม, แสดง placeholder hint ตามที่มี)
- `between` ใช้ inclusive ทั้งสองข้าง (≥ start และ ≤ end)
- `tolerance` คำนวณจาก absolute value of `standardValue` ดังนั้น standardValue = 0 + tolerance > 0 → range = [0, 0] (เฉพาะค่า 0 จะปกติ); ไม่ block แต่ user อาจไม่ต้องการ — ปล่อยไป (YAGNI)

## UI: ParameterSettings

ไฟล์ [src/pages/ParameterSettings.tsx](../../../src/pages/ParameterSettings.tsx), function `ValueFieldEditor`

### Layout ปัจจุบัน (lines 497-523)

```
หน่วย *    | ค่ามาตรฐาน *
[%]        | [5.0]
```

### Layout ใหม่

```
หน่วย *    | เงื่อนไข          | ค่ามาตรฐาน *
[%]        | [≥ ▼]              | [5.0]

(เมื่อ op = between:)
หน่วย *    | เงื่อนไข          | ตั้งแต่ *  | ถึง *
[%]        | [ระหว่าง ▼]        | [4.5]     | [5.5]

(เมื่อ op = tolerance:)
หน่วย *    | เงื่อนไข          | ค่ามาตรฐาน *  | ± (%) *
[%]        | [± % ▼]            | [5.0]          | [5]
```

### Operator dropdown options

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

(เลือก `"none"` → set `standardOperator = undefined`)

### Preview text ใต้ row

แสดงด้วยฟอนต์เล็กสีเทา/เขียวอ่อน:

- `lt` 5.0 → `"ค่าปกติ: < 5.0 %"`
- `lte` 5.0 → `"ค่าปกติ: ≤ 5.0 %"`
- `eq` 5.0 → `"ค่าปกติ: = 5.0 %"`
- `gte` 5.0 → `"ค่าปกติ: ≥ 5.0 %"`
- `gt` 5.0 → `"ค่าปกติ: > 5.0 %"`
- `between` 4.5–5.5 → `"ค่าปกติ: 4.5 - 5.5 %"`
- `tolerance` 5.0 ± 5% → `"ค่าปกติ: 5.0 ± 5% (4.75 - 5.25) %"`
- operator = none/undefined → `"ยังไม่ได้กำหนดเงื่อนไข — จะไม่ตรวจค่าผิดปกติ"`

### Validation (frontend `validate()`)

แทนที่ check เดิม (line 678) `f.standardValue == null` ด้วย:

```ts
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
  // ถ้าไม่มี operator — ไม่บังคับ standardValue (เปลี่ยนจากเดิมที่บังคับเสมอ)
}
```

### Cleanup logic

เมื่อเปลี่ยน `type` ออกจาก `number/float` → reset `standardOperator = undefined, standardValue2 = null` (ในส่วน Select onValueChange ที่ทำกับ standardValue อยู่แล้ว — เพิ่ม 2 field นี้)

เมื่อเปลี่ยน `standardOperator` ออกจาก `between`/`tolerance` → reset `standardValue2 = null`

## Behavior: QC Testing

ไฟล์ [src/pages/QCTestingDetailPage.tsx](../../../src/pages/QCTestingDetailPage.tsx), function `TestField`

### Derived flag

เพิ่ม `isNumericAbnormal()` ใน [src/lib/parameterValidation.ts](../../../src/lib/parameterValidation.ts) (ไฟล์ที่สร้างจาก spec ก่อนหน้า):

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
```

### Combined abnormal check

เพิ่มอีก helper ไว้ใช้สะดวก:

```ts
export function isFieldAbnormal(field: ParameterValueField, value: unknown): boolean {
  return isEnumAbnormal(field, value) || isNumericAbnormal(field, value);
}
```

ใน `TestField` เปลี่ยน:
```ts
const isAbnormal = isEnumAbnormal(field, value);
```
เป็น:
```ts
const isAbnormal = isFieldAbnormal(field, value);
```

### Visual indicator

ใช้ pattern เดียวกับ ENUM ที่ทำในรอบก่อน:
- **Input** (number/float) → เพิ่ม class `border-red-400 ring-1 ring-red-200` เมื่อ abnormal (เหมือนที่ทำกับ SelectTrigger)
- AlertTriangle icon ข้าง label พร้อม tooltip บอกเงื่อนไข

### Tooltip text สำหรับ numeric

แสดงเงื่อนไขแทน `expectedValues`:

```ts
function describeStandard(field: ParameterValueField): string {
  const op = field.standardOperator;
  const v1 = field.standardValue;
  const v2 = field.standardValue2;
  const unit = field.unit ? ` ${field.unit}` : "";
  switch (op) {
    case "lt": return `< ${v1}${unit}`;
    case "lte": return `≤ ${v1}${unit}`;
    case "eq": return `= ${v1}${unit}`;
    case "gte": return `≥ ${v1}${unit}`;
    case "gt": return `> ${v1}${unit}`;
    case "between": return `${v1} - ${v2}${unit}`;
    case "tolerance": return `${v1} ± ${v2}%${unit}`;
    default: return "";
  }
}
```

Tooltip:
- ENUM: `"ค่าผิดปกติ — คาดหวัง: ดี, ปานกลาง"`
- numeric: `"ค่าผิดปกติ — คาดหวัง: ≥ 5.0 %"`

(แยก template ตาม field.type ใน `TestField`)

## Migration

ไม่ต้อง — fields optional, ข้อมูลเก่าที่มีแค่ `standardValue` (operator/value2 = null) ทำงานเหมือนเดิม (placeholder hint, no abnormal detection)

## Testing

### Unit tests (`src/lib/parameterValidation.test.ts`)

เพิ่ม describe block `isNumericAbnormal`:
- ค่าเป็น string / undefined / empty / NaN → false ทั้งหมด
- type ≠ number/float → false
- operator = undefined → false
- standardValue = null + operator set → false
- แต่ละ operator (lt, lte, eq, gte, gt) — case ผ่าน + case ไม่ผ่าน + case ขอบ
- between: value ในช่วง / value < lower / value > upper / standardValue2 = null → ไม่ตรวจ
- tolerance: value ในช่วง / value นอกช่วง / standardValue = 0 / standardValue2 ≤ 0 → ไม่ตรวจ
- coercion: numeric string "5" ทำงานเหมือน number 5

เพิ่ม describe block `isFieldAbnormal`:
- ENUM ที่ abnormal → true
- numeric ที่ abnormal → true
- ทั้งคู่ไม่ abnormal → false

### Manual / E2E

- Parameter Settings: สร้าง field number พร้อม operator ต่างๆ → บันทึก, refresh, เปิดใหม่ ค่ายังอยู่
- เปลี่ยน operator → ช่อง standardValue2 ปรากฏ/หายตามที่ควร
- เปลี่ยน type ออกจาก number → standardOperator/Value2 reset
- QC Testing: กรอกค่า → border แดง + tooltip ปรากฏเมื่อผิดเงื่อนไข
- legacy field (มี standardValue ไม่มี operator) → ไม่มี indicator (พฤติกรรมเดิม)

## Open Questions

ไม่มี — ตกลงครบในรอบ brainstorm
