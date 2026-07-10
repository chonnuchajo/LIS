# Design: คลิกแถวสารในแท็บ "แยกตามสาร" → ฟอร์มแก้เฉพาะสารนั้น (quick edit)

วันที่: 2026-07-10
สถานะ: อนุมัติดีไซน์แล้ว

## ปัญหา / เป้าหมาย

หน้า ตั้งค่าพารามิเตอร์ → แท็บ **"แยกตามสาร"** (`ParameterCriteriaTabs`) แสดงตาราง
เกณฑ์รายสาร (แถวละ 1 เกณฑ์) แต่ปุ่ม ✎ ของแถวเปิด `SubstanceStandardsDialog`
**ตัวเต็ม** — picker ฝั่งซ้าย + ลิสต์ฝั่งขวาโชว์ทุกสารของ field นั้น (อาจเป็นร้อย)

ผู้ใช้ต้องการ: คลิกที่แถวสาร (เช่น ABAMECTIN 1.8% W/V EC) แล้ว **ขึ้นฟอร์มของสารนั้น
ตัวเดียว** — ไม่ต้องขึ้นทุกสาร ไม่ต้องมีแถบขวา

## แนวทางที่เลือก

เพิ่ม dialog เล็กใหม่ `SubstanceStandardRowDialog` (แก้เกณฑ์ 1 รายการ) แล้วต่อสาย
`ruleIndex` ที่มีอยู่แล้วในข้อมูลแถว (`SubstanceCriteriaRow.ruleIndex` = ตำแหน่งใน
`field.substanceStandards`) ผ่าน `onEditField` → `CriteriaEditorTarget` →
เลือก render dialog เล็กแทนตัวเต็ม

Dialog ตัวเต็มไม่หายไปไหน — ยังเปิดจากปุ่ม "ตั้งเงื่อนไขรายสาร (N สาร)" ในฟอร์มแก้
parameter (ไว้เพิ่มสาร/เพิ่มทั้งกลุ่ม/ลบ/clone) และจากแถว "ยังไม่ตั้งค่า" (setup row,
`ruleIndex === null`) ที่ต้องใช้ picker

## ขอบเขต

- Create: `src/components/lis/SubstanceStandardRowDialog.tsx` + `.test.tsx`
- Modify: `src/components/lis/ParameterCriteriaTabs.tsx` + `.test.tsx`
- Modify: `src/pages/ParameterSettings.tsx`

**ไม่แตะ:** `SubstanceStandardsDialog` (คงเดิมทุกอย่าง), แท็บ เงื่อนไขพิเศษ /
ตาม %สาร (เปิดแบบเดิม), `parameterCriteriaRows.ts` (ข้อมูลมี ruleIndex ครบแล้ว),
schema / backend

## รายละเอียด

### 1. `SubstanceStandardRowDialog` (ใหม่)

Props:

```ts
type Props = {
  open: boolean;
  substance: SubstanceStandard & { headOnly?: boolean };  // เกณฑ์ตัวที่แก้
  parameterName: string;   // โชว์บรรทัดรอง
  fieldLabel: string;      // โชว์บรรทัดรอง
  unit?: string;           // suffix ท้ายช่องค่า
  onClose: () => void;
  onSave: (next: SubstanceStandard & { headOnly?: boolean }) => void;
};
```

- Dialog ขนาดเล็ก (`max-w-md`); `DialogTitle` = ชื่อสาร, `DialogDescription` =
  `{parameterName} · {fieldLabel}` (มี description จริงกัน Radix warning)
- ฟอร์ม: เงื่อนไข (`NativeSelect`, `OPERATOR_OPTIONS` ตัด `none`) + ช่องค่า
  (+ช่องที่ 2 เมื่อ `between`/`tolerance`, placeholder ชุดเดียวกับ dialog เต็ม) +
  หน่วยเป็น suffix + checkbox ข้อความเต็ม "ให้หัวหน้า QC พิจารณาเท่านั้น"
- draft state (operator/value/value2/headOnly) init จาก props ตอน `open`
- บันทึก → `onSave({ ...substance, operator, value, value2, headOnly })` แล้ว
  `onClose()` — **spread คงค่า field อื่นของเกณฑ์** (`productTypes`,
  `regulatoryTypes`, `categories`) ไม่ให้หาย; semantics ของ value2 ค้างเมื่อสลับ
  operator = เหมือน dialog เต็ม (ไม่เคลียร์ — พฤติกรรมเดิมของระบบ)
- ไม่มีปุ่มลบ (ลบใน dialog ตัวเต็ม)

### 2. `ParameterCriteriaTabs` — ส่ง ruleIndex + คลิกทั้งแถว

- `onEditField` เพิ่มพารามิเตอร์ตัวที่ 4: `ruleIndex?: number | null`
- เฉพาะแท็บ substance: `TableRow` คลิกได้ทั้งแถว (`cursor-pointer` +
  `onClick={() => onEditField("substance", row.parameterId, row.fieldIndex, row.ruleIndex)}`)
  และปุ่ม ✎ ส่งอาร์กิวเมนต์ชุดเดียวกัน
- `EditButton` (shared) ใส่ `event.stopPropagation()` ก่อนเรียก `onClick` —
  กันคลิกปุ่มแล้ว bubble ไปแถวจนยิงซ้ำ (แท็บอื่นไม่มี row onClick จึงไม่กระทบ)
- แท็บ conditional / labelTolerance เรียกแบบเดิม (3 อาร์กิวเมนต์) — ไม่เปลี่ยน
- ⚠️ test เดิม `toHaveBeenCalledWith("substance", "p1", 0)` ต้องอัปเดตเป็น
  `("substance", "p1", 0, 1)` — แถวแรกหลัง sort A-Z คือ ABAMECTIN ซึ่งเป็น
  index 1 ใน `substanceStandards` (เคสนี้พิสูจน์ว่า ruleIndex มาจากข้อมูล
  ไม่ใช่ลำดับแสดงผล)

### 3. `ParameterSettings` — เลือก dialog ตาม ruleIndex

- `CriteriaEditorTarget` เพิ่ม `ruleIndex: number | null`
- `handleEditCriteriaField(mode, parameterId, fieldIndex, ruleIndex = null)` เก็บลง state
- จุด render (`criteriaEditor.mode === "substance"`):
  - derive `criteriaRowStandard = ruleIndex != null ? criteriaField?.substanceStandards?.[ruleIndex] : undefined`
  - มี `criteriaRowStandard` → `SubstanceStandardRowDialog`; `onSave` แทนที่เฉพาะ
    ตำแหน่ง `ruleIndex` ใน array แล้วส่งเข้า `handleSaveCriteriaField` (path บันทึก
    เดิม PATCH parameter ทั้งตัว)
  - ไม่มี (`ruleIndex` null หรือ index หลุด เช่น ข้อมูลเปลี่ยนระหว่างเปิด) →
    fallback เปิด `SubstanceStandardsDialog` ตัวเต็มแบบเดิม

## Testing

- ใหม่ `SubstanceStandardRowDialog.test.tsx`: render ชื่อสาร+บรรทัดรอง+ค่า prefill /
  operator `between` โชว์ 2 ช่อง / สลับเป็น `tolerance` ช่องที่ 2 ยังอยู่ / แก้ค่า+ติ๊ก
  หัวหน้า→บันทึก ได้ object ที่ merge ถูกและ**คง productTypes เดิม** / ยกเลิกไม่เรียก onSave
- แก้/เพิ่มใน `ParameterCriteriaTabs.test.tsx`: อัปเดต assert เดิมเป็น 4 args /
  คลิกทั้งแถวยิง onEditField args เดียวกัน / คลิกปุ่ม ✎ ยิงครั้งเดียว (stopPropagation) /
  setup row ส่ง `ruleIndex: null` / แท็บ conditional+labelTolerance ยัง 3 args เดิม
- `npx tsc -p tsconfig.app.json --noEmit` ไม่มี error ใหม่ + full suite เขียว
- Manual (user): แท็บ แยกตามสาร → คลิกแถว → ฟอร์มเดี่ยว → แก้ → บันทึก → ค่าในตาราง
  อัปเดต; แถวยังไม่ตั้งค่า → dialog เต็ม; ปุ่มในฟอร์ม parameter → dialog เต็ม

## นอกขอบเขต (YAGNI)

- ไม่ทำ quick-edit ให้แท็บ เงื่อนไขพิเศษ / ตาม %สาร (ถ้าถูกใจค่อยทำตาม)
- ไม่มีลบ/clone ใน dialog เล็ก
- ไม่แตะพฤติกรรม `SubstanceStandardsDialog` ตัวเต็ม
