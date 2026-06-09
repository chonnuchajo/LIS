# เงื่อนไขมาตรฐานแยกรายสาร (Per-Substance Standards) — Design

วันที่: 2026-06-09
สถานะ: approved (รอ implement)

## ปัญหา / ที่มา

ในหน้า **พารามิเตอร์การตรวจสอบ** (`ParameterSettings.tsx`) แต่ละ "ค่าที่ต้องใส่"
(value field) ตั้ง **เงื่อนไขมาตรฐานได้ค่าเดียว** — operator (`<`, `≤`, `between`,
`tolerance` ฯลฯ) + ค่ามาตรฐาน 1 ชุด ใช้เหมือนกันหมดทุก item/ทุกสาร

แต่พารามิเตอร์อย่าง "ปริมาณสารสำคัญ" ต้องมีเกณฑ์ **ต่างกันในแต่ละสาร** เช่น
ผลิตภัณฑ์ที่มี 2 สาร (`A + B`) สาร A อาจต้อง `≥ 95%` ส่วนสาร B `≥ 90%`
ปัจจุบันทำไม่ได้

## เป้าหมาย

1. ช่อง number/float เปิดโหมด **"แยกเงื่อนไขตามสาร"** ได้ (toggle ราย field)
2. Config ผ่าน popup: เลือกสาร (ดึงจาก master item) → ตั้ง operator + ค่าต่อสาร
3. ตอนบันทึกผล: แตกช่องกรอก **แยกรายสาร** ตามสารจริงของ item แล้ว
   **validate อัตโนมัติ** แต่ละสารกับเกณฑ์ของตัวเอง

## ขอบเขตที่ตัดออกรอบนี้ (YAGNI)

- หน้า read-only / print template / report ที่แสดงผล — ยังไม่ render composite
  values รายสารในรอบนี้ (follow-up แยก)
- `reference` field ชี้มาที่ช่อง substanceMode — ล็อกไว้ก่อน (ชี้ได้เฉพาะช่องปกติ)
- โหมดแยกสารใช้ได้เฉพาะ `number` / `float` (ช่องชนิดอื่นไม่มี)

## บริบทเทคนิคที่พิสูจน์แล้ว

- `PetitionItem.commonName` = สตริงองค์ประกอบสาร (เช่น `"ABAMECTIN 1.8% W/V EC"`
  หรือ `"A + B"`) — **ไม่ใช่** formulation code
- `parseSubstances(commonName)` (`src/lib/substances.ts`) แตกสารด้วย `+`
  (3+ ส่วนยุบเหลือ ≤2 แบบ positional) — `PetitionAssignPage` ใช้ pattern นี้แตกสาร
  ราย item อยู่แล้ว → test-time ดึงรายสารได้ด้วยวิธีเดียวกัน
- `extractSubstanceName(raw)` ลดสตริง spec เหลือ token แรก (`"ABAMECTIN 1.8% ..." → "ABAMECTIN"`)
- `substanceKey(value)` = `trim().toLowerCase()` ใช้เป็น match key
- `result.values` เป็น `Record<string, unknown>` keyed ด้วย field label
  (flexible — เพิ่ม composite key ได้โดยไม่ต้อง migrate schema backend)
- การ validate ปัจจุบันอยู่ที่ `src/lib/parameterValidation.ts`
  (`isNumericAbnormal(field, value)` อ่าน `field.standardOperator/standardValue/standardValue2`)
- `FieldInput` render ช่องกรอกถูกเขียน **inline ซ้ำ** ใน `QCTestingDetailPage.tsx`
  และ `LabTestingDetailPage.tsx`

## Data model

เพิ่ม field ใน `ParameterValueField` (`src/lib/api.ts`):

```ts
export type SubstanceStandard = {
  substance: string;            // ชื่อสารที่เก็บ (extractSubstanceName แล้ว เช่น "ABAMECTIN")
  operator: StandardOperator;
  value: number | null;
  value2?: number | null;       // ใช้กับ between / tolerance
};

export type ParameterValueField = {
  // ...ของเดิม...
  substanceMode?: boolean;            // เปิดโหมดแยกสาร (number/float เท่านั้น)
  substanceStandards?: SubstanceStandard[];
};
```

- ของเดิม `standardOperator/standardValue/standardValue2` ยังอยู่ครบ ใช้เมื่อ
  `substanceMode` ปิด → backward compatible 100%
- เมื่อ `substanceMode = true` ค่าเดี่ยวถูก ignore (ทั้งตอน config และ validate)
- ตอน config ถ้าสลับชนิดข้อมูลออกจาก number/float → reset `substanceMode = false`,
  `substanceStandards = []`

## Match key (config ↔ test-time)

ฟังก์ชันกลางใหม่ใน `src/lib/substances.ts`:

```ts
// key สำหรับจับคู่สาร ใช้ทั้งฝั่ง config และ test-time
export function matchSubstanceKey(name: string): string {
  return substanceKey(extractSubstanceName(name));
}
```

- ฝั่ง config: เก็บ `substance` = `extractSubstanceName(picked)`
- ฝั่ง test-time: ของแต่ละสารจาก `parseSubstances(item.commonName)` →
  `matchSubstanceKey(parsed)` แล้วหาใน `substanceStandards` ด้วย
  `matchSubstanceKey(s.substance)`
- ไม่เจอ match = render ช่องกรอกได้ แต่ไม่ validate (ถือว่าไม่มีมาตรฐาน)
- ขอบเขตรู้ตัว: สารที่ `parseSubstances` ยุบรวม (`"A + B"`) จะ extract เหลือ token
  แรก — acceptable (ผลิตภัณฑ์ส่วนใหญ่ ≤2 สาร) ระบุไว้เป็น known limitation

## เก็บค่าตอนทดสอบ — composite key

helper ใหม่ (วางใน `parameterValidation.ts` หรือ `substances.ts`):

```ts
export function substanceFieldKey(label: string, substance: string): string {
  return `${label}::${matchSubstanceKey(substance)}`;
}
```

- ช่อง substanceMode เก็บค่าใต้ `values[k][substanceFieldKey(field.label, substanceName)]`
- ช่องปกติยังเก็บใต้ `values[k][field.label]` เหมือนเดิม
- ตัวคั่น `::` เลือกเพราะไม่ชนกับ label ปกติและ `noteLabelFor` (ช่องสารเป็นตัวเลข
  ไม่มี note)

## Validation (`src/lib/parameterValidation.ts`)

เพิ่ม helper, reuse logic เดิม:

```ts
// สร้าง virtual field จาก SubstanceStandard แล้วเช็คด้วย isNumericAbnormal เดิม
export function isSubstanceAbnormal(
  field: ParameterValueField,
  std: SubstanceStandard | undefined,
  value: unknown,
): boolean {
  if (!std || !std.operator || std.value == null) return false;
  return isNumericAbnormal(
    { ...field, standardOperator: std.operator, standardValue: std.value, standardValue2: std.value2 ?? null },
    value,
  );
}

// หา SubstanceStandard ของสารหนึ่งจาก field
export function findSubstanceStandard(
  field: ParameterValueField,
  substanceName: string,
): SubstanceStandard | undefined { /* match ด้วย matchSubstanceKey */ }
```

`countAbnormalInResults` ปรับ: เมื่อ `field.substanceMode` ให้ iterate
`substanceStandards` (วนตามสารที่กรอกค่าไว้ใน values) แทนการอ่าน `values[field.label]`
ช่องเดียว

## Config UI — `ParameterSettings.tsx`

ในตัวแก้ value field (บล็อก number/float ปัจจุบัน):

- เพิ่ม toggle/checkbox **"แยกเงื่อนไขตามสาร"** (เห็นเฉพาะ number/float)
- เมื่อปิด: คงบล็อก operator/ค่ามาตรฐานเดิมทุกอย่าง (ไม่เปลี่ยน)
- เมื่อเปิด: ซ่อนบล็อก operator/ค่าเดี่ยว → แสดงปุ่ม
  **"ตั้งเงื่อนไขรายสาร (N สาร)"** เปิด `SubstanceStandardsDialog`
- `StandardPreview` (มีอยู่แล้ว): เมื่อ substanceMode แสดงสรุปรายการสาร + เกณฑ์
  ย่อ ๆ (เช่น `ABAMECTIN ≥95 · IMIDACLOPRID ≥90`); ถ้ายังไม่ตั้งสารเลยโชว์ hint

## Popup ใหม่ — `SubstanceStandardsDialog`

ไฟล์: `src/components/lis/SubstanceStandardsDialog.tsx`

Props: `{ open, field, onClose, onSave(next: SubstanceStandard[]) }`

โครงสร้าง 2 ฝั่ง:

**ฝั่งเลือกสาร (source/browser):**
- ดึง master items: `useQuery(["master-items"], () => api.get("/master-items"))`
  (เหมือน `MasterItems.tsx` / `PetitionAssignPage.tsx`)
- โหมดเลือกหลายแบบ (tab หรือ segmented): **commonName / ชื่อ item / กลุ่ม (itemGroup)**
  + ช่องค้นหา
- แต่ละ master item → `parseSubstances(common_name)` → `extractSubstanceName` →
  dedupe เป็นรายชื่อสาร
- กดเลือกสาร → เพิ่มเข้า list ฝั่งขวา; พิมพ์เพิ่มเอง (manual) ได้

**ฝั่งรายการที่เลือก (editor):**
- แต่ละสาร: ชื่อสาร + Select operator (reuse `OPERATOR_OPTIONS`) + ช่องค่า
  - between → 2 ช่อง (ตั้งแต่/ถึง)
  - tolerance → 2 ช่อง (ค่ามาตรฐาน/±%)
  - อื่น ๆ → 1 ช่อง (ค่ามาตรฐาน)
  - ปุ่มลบสาร
- ปุ่ม **บันทึก** → `onSave(list)` เขียนกลับ `field.substanceStandards`

> reuse logic preview เกณฑ์จาก `describeStandard` / `StandardPreview` เท่าที่ทำได้
> เพื่อความสอดคล้องกับช่องปกติ

## Test-time UI — `QCTestingDetailPage.tsx` + `LabTestingDetailPage.tsx`

`FieldInput` (inline ทั้งสองหน้า): เมื่อ `field.substanceMode && (number|float)`:

- คำนวณรายสาร: `parseSubstances(item.commonName)` (ถ้า commonName ว่าง → fallback
  ช่องเดียวแบบไม่มีเกณฑ์ หรือ hint "ไม่มีข้อมูลสาร")
- render **หนึ่งช่องกรอกต่อสาร**:
  - label = `"<ชื่อช่อง> — <ชื่อสาร>"` + หน่วย
  - value ผูกกับ `values[k][substanceFieldKey(field.label, substanceName)]`
  - placeholder = มาตรฐานของสารนั้น (`describeStandard` virtual) ถ้ามี
  - ไฮไลต์ผิดปกติด้วย `isSubstanceAbnormal` เฉพาะสารที่มีเกณฑ์; สารไม่มีเกณฑ์ =
    ไม่ไฮไลต์ (อาจมี hint จาง ๆ "ไม่มีเกณฑ์")
- `onChange` เขียนกลับ composite key เดิม (debounce/save เหมือนช่องปกติ —
  reuse กลไก save state เดิม โดยใช้ composite key เป็น field-key)

`validate()` (required check) ในแต่ละหน้า: เมื่อ substanceMode และ `field.required`
→ ทุกสารที่ render ต้องมีค่า (ใช้ composite key); `countAbnormal()` ในหน้า →
iterate รายสารด้วย `isSubstanceAbnormal`

> หมายเหตุ: มีโอกาส extract `FieldInput` เป็น component ร่วม (ลด duplication
> ระหว่าง QC/Lab) — ทำถ้าคุ้ม แต่ไม่บังคับ ขอให้ behavior สองหน้าตรงกันเป็นหลัก

## Data flow สรุป

```
Config:
  ParameterSettings → toggle substanceMode → SubstanceStandardsDialog
    → (master items → parseSubstances → extractSubstanceName) เลือกสาร + ตั้งเกณฑ์
    → field.substanceStandards[]  → save parameter (เดิม)

Test-time:
  TestingDetail → item.commonName → parseSubstances → ราย substance
    → match substanceStandards (matchSubstanceKey)
    → render N ช่อง (composite key) → กรอกค่า
    → isSubstanceAbnormal ไฮไลต์ → save result.values[composite key]
```

## Testing

- `substances.test.ts`: `matchSubstanceKey`, `substanceFieldKey` (รวม edge: ว่าง,
  spec ยาว, ยุบรวม `A + B`)
- `parameterValidation.test.ts`: `isSubstanceAbnormal` ทุก operator + ไม่มี std →
  false; `findSubstanceStandard` match/ไม่ match; `countAbnormalInResults` กรณี
  substanceMode
- (ถ้าทำ) component test ของ `SubstanceStandardsDialog` add/remove/edit/save
- รัน `npx tsc -p tsconfig.app.json` ตรวจ type (ตาม memory — `tsc --noEmit` เป็น
  no-op)

## Backward compatibility / migration

- ไม่ต้อง migrate DB: field ใหม่ optional, ค่าผลเก็บ key ใหม่ payload เดิมไม่กระทบ
- พารามิเตอร์เดิมทั้งหมด `substanceMode` undefined → ทำงานเหมือนเดิมเป๊ะ
- หลัง implement: รัน `npm run seed:export` + commit (ตาม memory seed-data backup)
