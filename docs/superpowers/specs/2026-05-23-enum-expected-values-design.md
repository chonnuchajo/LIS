# ENUM Expected Values — Design

**Date:** 2026-05-23
**Status:** Approved
**Scope:** ParameterSettings + QC Testing abnormal detection

## Problem

ใน parameter setting ปัจจุบัน:
- ฟิลด์ชนิด `number` / `float` มี `standardValue` (schema มีอยู่แล้ว แต่ใน QC Testing ใช้แค่เป็น placeholder hint — ยังไม่มี abnormal visual indicator)
- ฟิลด์ชนิด `enum` **ไม่มี** concept ของ "ค่าที่คาดหวัง"

ความต้องการ: ENUM ต้องตั้งค่าที่คาดหวังได้ รองรับ **หลายค่า** (เช่น "ดี"/"ปานกลาง" = ปกติ, "แย่" = abnormal) และเมื่อ user กรอกค่าใน QC Testing ที่ไม่ตรงกับ expected → แสดง abnormal indicator

## Goals

- เพิ่ม field `expectedValues?: string[]` บน ENUM parameter (schema + UI ใน ParameterSettings)
- UI ใน ParameterSettings: checkbox "ปกติ" ต่อ option ใน ENUM
- QC Testing แสดง abnormal indicator (border แดง + icon เตือน) สำหรับ ENUM เมื่อ value ∉ expectedValues
- Optional — ไม่ตั้ง expectedValues ก็ใช้งานได้ (พฤติกรรมเดิม)

## Non-Goals

- **Numeric abnormal indicator (อยู่นอกขอบเขต)** — code ปัจจุบันยังไม่แสดง abnormal สำหรับ numeric ที่เกิน standardValue (มีแค่ placeholder hint) งานนี้ทำเฉพาะ ENUM; ส่วน numeric แยกเป็น follow-up เพราะต้องตัดสินใจ schema เพิ่ม (tolerance, range, min/max) ก่อน
- ไม่ผูก expectedValues กับ requireNoteOn (เป็นคนละ concept)
- ไม่เพิ่ม validation บังคับให้ ENUM ต้องมี expectedValues
- ไม่แก้ระบบ status เดิม (`densityStatus`, `physicalStatus`) ใน SampleContext ซึ่งเป็น flow อื่น

## Schema Change

ไฟล์ [src/lib/api.ts](../../../src/lib/api.ts) (lines 221-228):

```ts
export type ParameterValueField = {
  label: string;
  type: ParameterValueFieldType;
  unit?: string;
  standardValue?: number | null;
  options?: string[];
  requireNoteOn?: string[];
  expectedValues?: string[];  // NEW — subset of options[], optional, ENUM only
  required?: boolean;
};
```

**Invariants:**
- `expectedValues` มีความหมายเฉพาะเมื่อ `type === "enum"`
- ทุก string ใน `expectedValues` ต้องอยู่ใน `options[]`
- `undefined` หรือ `[]` = ไม่ตรวจ abnormal (พฤติกรรมเดิม)
- เมื่อเปลี่ยน `type` ออกจาก `"enum"` → reset `expectedValues = []`

## UI: ParameterSettings

ไฟล์ [src/pages/ParameterSettings.tsx](../../../src/pages/ParameterSettings.tsx) — `ValueFieldEditor` component (lines 378-599)

### Layout: per-option row (มีอยู่แล้ว lines 547-575)

ปัจจุบันแต่ละ option มี checkbox "ต้องการคำอธิบาย" + ปุ่มลบ
**เพิ่ม:** checkbox "ปกติ" ด้านซ้ายก่อน "ต้องการคำอธิบาย"

```
┌────────────────────────────────────────────────────────┐
│ ดี       [✓ ปกติ]  [☐ ต้องการคำอธิบาย]   [X ลบ]      │
│ ปานกลาง  [✓ ปกติ]  [☐ ต้องการคำอธิบาย]   [X ลบ]      │
│ แย่      [☐ ปกติ]  [✓ ต้องการคำอธิบาย]   [X ลบ]      │
└────────────────────────────────────────────────────────┘
```

### Helper text (ใต้ list)

- ยังไม่ติ๊ก "ปกติ" เลย → text สีเทา: `"ยังไม่ได้กำหนดค่าที่คาดหวัง — จะไม่ตรวจค่าผิดปกติ"`
- ติ๊ก "ปกติ" ครบทุก option → text สีเหลือง warning: `"ทุกค่าถูกตั้งเป็นปกติ — จะไม่มี abnormal"`
- ติ๊ก "ปกติ" บางส่วน → text สีเขียวเล็กๆ: `"ค่าที่คาดหวัง: ดี, ปานกลาง — ค่าอื่นจะถูกมาร์คผิดปกติ"`

### Helper function

เพิ่ม `toggleExpected(opt)` ขนานกับ `toggleRequireNote(opt)` ที่มีอยู่:

```ts
const toggleExpected = (opt: string) => {
  const current = field.expectedValues ?? [];
  const next = current.includes(opt)
    ? current.filter((o) => o !== opt)
    : [...current, opt];
  onChange({ ...field, expectedValues: next });
};
```

### Cleanup เมื่อลบ option

แก้ `removeOption` (lines 399-405) ให้กรอง `expectedValues` ด้วย:

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

### Cleanup เมื่อเปลี่ยน type

แก้ Select onValueChange (lines 472-481) ให้ reset:

```ts
expectedValues: v === "enum" ? field.expectedValues ?? [] : [],
```

### Default ของ `emptyValueField`

แก้ลำดับใน [ParameterSettings.tsx:147-155](../../../src/pages/ParameterSettings.tsx#L147-L155):

```ts
const emptyValueField = (): ParameterValueField => ({
  label: "",
  type: "text",
  unit: "",
  standardValue: null,
  options: [],
  requireNoteOn: [],
  expectedValues: [],  // NEW
  required: false,
});
```

## Behavior: QC Testing

ไฟล์ [src/pages/QCTestingDetailPage.tsx](../../../src/pages/QCTestingDetailPage.tsx)

### Abnormal detection rule (ENUM)

ในจุดที่ render ENUM field ปัจจุบัน:
- ถ้า `(field.expectedValues?.length ?? 0) === 0` → ไม่ตรวจ
- ถ้า `expectedValues` มีค่า และ value ที่เลือก ∉ expectedValues → flag เป็น abnormal

### Visual indicator

เนื่องจาก code ปัจจุบันไม่มี abnormal indicator มาก่อน — งานนี้สร้างใหม่:
- **SelectTrigger** ของ ENUM field ที่ abnormal → เพิ่ม class `border-red-400 ring-1 ring-red-200`
- ด้านขวาของ label → แสดง icon `<AlertTriangle className="h-3.5 w-3.5 text-red-500" />` พร้อม tooltip `"ค่าผิดปกติ — คาดหวัง: ดี, ปานกลาง"`
- ใช้ icon `AlertTriangle` จาก lucide-react (ไม่ใช้ `AlertCircle` เพราะ AlertCircle ถูกใช้แทน save error อยู่แล้วใน line 98)

### Derived helper

เพิ่ม helper ที่บนสุดของไฟล์หรือใน utility:
```ts
function isEnumAbnormal(field: ParameterValueField, value: unknown): boolean {
  if (field.type !== "enum") return false;
  const expected = field.expectedValues ?? [];
  if (expected.length === 0) return false;
  const str = value == null ? "" : String(value);
  if (str === "") return false;  // ยังไม่กรอก = ไม่ flag
  return !expected.includes(str);
}
```

### ปฏิสัมพันธ์กับ `requireNoteOn`

ไม่ผูกกัน — ยังคงเป็นคนละ concept:
- `expectedValues` ตอบคำถาม "ค่านี้ปกติไหม"
- `requireNoteOn` ตอบคำถาม "ค่านี้ต้องอธิบายไหม"

User สามารถตั้งให้ option เดียวกันเป็นทั้ง "ปกติ" และ "ต้องอธิบาย" ก็ได้ (rare case แต่ไม่ block)

## Backend / API

ไม่ต้องเปลี่ยน schema validation ฝั่ง backend อะไรพิเศษ — field `expectedValues` ถูกเก็บเป็น string array เหมือน `requireNoteOn` ที่มีอยู่แล้ว

ถ้า backend มี Mongoose schema สำหรับ Parameter ต้องเพิ่ม field ใน schema ด้วย (จะตรวจตอน writing-plans)

## Migration

ไม่ต้อง — field optional, ข้อมูลเก่าที่ไม่มี `expectedValues` ทำงานเหมือนเดิม (พฤติกรรม "ไม่ตรวจ abnormal")

## Testing

### Unit / integration
- ตั้ง expectedValues = [] → ค่าใดก็ไม่ abnormal
- ตั้ง expectedValues = ["ดี"] → "ดี" ปกติ, "แย่" abnormal
- ตั้ง expectedValues = ["ดี", "ปานกลาง"] → ทั้งสองปกติ, อื่นๆ abnormal
- ลบ option ที่อยู่ใน expectedValues → expectedValues ถูกกรองออกอัตโนมัติ
- เปลี่ยน type จาก enum → text → expectedValues = []

### Manual / UI
- เปิด ParameterSettings, สร้าง ENUM ใหม่, ติ๊ก "ปกติ" บางตัว — บันทึก, เปิดใหม่, ค่ายังอยู่
- เปิด QC Testing detail ของ sample ที่ใช้ parameter นี้, เลือกค่าที่ไม่ใช่ expected → abnormal indicator ปรากฏ
- เลือกค่าที่ตรง expected → ไม่มี indicator

## Open Questions

ไม่มี — ตกลงตามที่ user confirm แล้ว
