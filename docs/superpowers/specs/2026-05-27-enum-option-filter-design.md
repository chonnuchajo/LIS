# ENUM Option Filter (Per-Option Classification Filter) — Design

**Date:** 2026-05-27
**Status:** Approved
**Scope:** ParameterSettings + Lab/QC Testing enum rendering

## Problem

ใน enum field ของ parameter ปัจจุบัน — option ทุกอันแสดงให้ทุก item ที่ parameter ถูก apply เห็นเหมือนกันหมด

ตัวอย่าง use case ที่ขาด: parameter "กายภาพ" มี option `ของเหลวใส`, `ของเหลวขุ่น`, `ของเหลวหนืด`, `ผงละเอียด`, `ผงหยาบ` — สาม option แรกเหมาะกับ item ที่เป็นน้ำเท่านั้น สอง option หลังเหมาะกับผงเท่านั้น ตอนนี้ผู้บันทึกผลเห็นปนกันหมด มีโอกาสเลือกผิด

ต้องการ: กำหนด filter "แสดงเฉพาะ item ที่..." ต่อ option ได้ — ระดับ `productType` (water/sand/powder) และ `subCategory` (เช่น ULV, EC)

## Goals

- เพิ่ม `optionFilters?: Record<string, { productTypes?: string[]; subCategories?: string[] }>` ใน enum field schema (server + client type)
- UI ใน ParameterSettings: ปุ่ม "เฉพาะ" ในก้อน option เปิด popover เลือก productType + subCategory
- Runtime: Lab/QC Testing เรนเดอร์ enum `<Select>` โดย filter options ตาม classification ของ item ที่กำลังบันทึก
- Backward-compatible — option ที่ไม่มี filter = แสดงทุก item (พฤติกรรมเดิม)

## Non-Goals

- ไม่ทำ nested enum (parent → child) — เลือกแล้วว่า flat + filter เพราะง่ายกว่าและ map กับ classification ที่มีอยู่ตรง ๆ
- ไม่ filter ระดับ `commonName` / `itemName` (3 ตัวเลือก productType + free-text subCategory พอ ตาม decision)
- ไม่แก้ filter ระดับ "parameter ใช้กับ item ไหน" (มีอยู่แล้วใน `parameterAppliesToItem`) — งานนี้เป็น filter ใหม่ในระดับ option
- ไม่ migrate ข้อมูลเดิม — เพราะ `optionFilters` undefined = behavior เดิม

## Schema Change

### Server — `server/models/Parameter.js` (ValueFieldSchema)

เพิ่มภายใน `ValueFieldSchema`:

```js
optionFilters: {
  type: Map,
  of: new mongoose.Schema({
    productTypes: { type: [String], default: [] },
    subCategories: { type: [String], default: [] },
  }, { _id: false }),
  default: undefined,  // อย่า init เป็น {} เพื่อให้ legacy doc ยังคง undefined
}
```

### Client — `src/lib/api.ts` (ParameterValueField type)

```ts
export type ParameterValueField = {
  // ...existing fields
  optionFilters?: Record<string, {
    productTypes?: string[];
    subCategories?: string[];
  }>;
};
```

### Validation (server `ParameterSchema.pre('validate')`)

- ถ้ามี `optionFilters` — keys ต้อง ⊆ `options[]` (orphan keys ที่ไม่ตรงกับ option ใด ๆ → ลบทิ้งอัตโนมัติ แทนที่จะ reject เพื่อความสะดวกตอนแก้ option)
- `optionFilters[*].productTypes` รับเฉพาะ `'water' | 'sand' | 'powder'` (อื่น → reject พร้อมข้อความระบุ field label)
- `optionFilters[*].subCategories` เป็น free string array (uppercase normalize ตอน save ก็พอ)

## UI — ParameterSettings.tsx

ไฟล์: [src/pages/ParameterSettings.tsx](../../../src/pages/ParameterSettings.tsx) — `ValueFieldEditor` component, ส่วน enum options list (ตรงที่มี toggle "ค่าปกติ" / "ขอหมายเหตุ" / "ลบ")

ใน 1 option row เพิ่ม:

1. **ปุ่ม `🎯 เฉพาะ`** (icon-only หรือ small text button) — เปิด `<Popover>`
2. **Popover content:**
   - หัวข้อ: "แสดงเฉพาะ item ที่..."
   - Section "ประเภทสินค้า" — 3 checkbox: น้ำ (water) / ทราย (sand) / ผง (powder)
   - Section "หมวดย่อย" — chip input (พิมพ์ code แล้ว Enter เพื่อเพิ่ม, click x เพื่อลบ)
   - ปุ่ม "เคลียร์" = ลบ entry ของ option นี้ออกจาก `optionFilters` → กลับสู่ default (แสดงทุก item)
3. **Badge** — ถ้า option มี filter active แสดง chip เล็กใต้ชื่อ option เช่น `🎯 น้ำ` หรือ `🎯 น้ำ · ULV, EC`

### Add/remove option side-effects

- ลบ option ออก → ต้องลบ entry ของ option นั้นใน `optionFilters` ด้วย (เพิ่มใน `removeOption` handler ที่มีอยู่)
- Rename option (ปัจจุบันไม่มี — option เป็น string ลบแล้วเพิ่มใหม่) → ไม่ต้องจัดการ

## Runtime Filtering

### Helpers — `src/lib/petitionTestItems.ts`

แยก logic จาก `parameterAppliesToItem` เป็น helpers ที่ reuse ได้:

```ts
export function getItemProductType(item: PetitionItem): string {
  return (
    getClassification(item.sampleName)?.group ??
    getClassification(item.commonName)?.group ??
    ''
  );
}

export function getItemSubCategory(item: PetitionItem): string {
  return extractItemNoPrefix(item.sampleId);  // logic เดิม
}

export function visibleEnumOptions(
  field: ParameterValueField,
  item: PetitionItem,
): string[] {
  const options = field.options ?? [];
  const filters = field.optionFilters;
  if (!filters) return options;

  const itemProductType = getItemProductType(item);
  const itemSubCat = getItemSubCategory(item);

  return options.filter((opt) => {
    const f = filters[opt];
    if (!f) return true;  // no filter set = แสดง
    const pts = f.productTypes ?? [];
    const scs = f.subCategories ?? [];
    const ptOK = pts.length === 0 || (itemProductType && pts.includes(itemProductType));
    const scOK = scs.length === 0 || (itemSubCat && scs.includes(itemSubCat));
    return ptOK && scOK;  // AND ระหว่างมิติ, OR ภายในแต่ละมิติ
  });
}
```

### Apply ใน pages

- [src/pages/LabTestingDetailPage.tsx](../../../src/pages/LabTestingDetailPage.tsx) — ตอน render enum `<Select>` ภายในวงรอบ field × item ให้ใช้ `visibleEnumOptions(field, item)` แทน `field.options ?? []`
- [src/pages/QCTestingDetailPage.tsx](../../../src/pages/QCTestingDetailPage.tsx) — เหมือนกัน

### Saved value โดน filter ทิ้ง (edge case)

เกิดเมื่อ item ถูก reclassify (เปลี่ยน `commonName` / `sampleId`) หลังบันทึกผลแล้ว → option ที่บันทึกไว้อาจไม่อยู่ใน `visibleEnumOptions` อีกต่อไป

**Handling:** ใน `<Select>` ถ้า `currentValue` ไม่อยู่ใน visible list ให้ append เป็น item พิเศษพร้อม label `"<value> (นอกเงื่อนไข — ค่าเดิม)"` — read-able แต่ disabled ไม่ให้เลือกใหม่ ผู้ใช้ตัดสินใจเอง

## Files Affected

| ไฟล์ | สิ่งที่ทำ |
|------|---------|
| `server/models/Parameter.js` | เพิ่ม `optionFilters` ใน ValueFieldSchema + validation |
| `src/lib/api.ts` | ขยาย type `ParameterValueField` |
| `src/pages/ParameterSettings.tsx` | UI popover ใน option row + badge + cleanup ตอนลบ option |
| `src/lib/petitionTestItems.ts` | helpers `getItemProductType` / `getItemSubCategory` / `visibleEnumOptions` (refactor logic จาก `parameterAppliesToItem` มา reuse) |
| `src/pages/LabTestingDetailPage.tsx` | ใช้ `visibleEnumOptions` ตอน render enum + handle saved-but-filtered |
| `src/pages/QCTestingDetailPage.tsx` | เหมือน Lab page |
| `src/lib/qcProgress.ts` | ตรวจสอบ: ถ้าใช้ `field.options` คำนวณ progress / completeness → ใช้ `visibleEnumOptions` แทน (เพื่อ count แค่ option ที่ใช้งานได้จริงต่อ item) |

## Testing

### Unit (`src/lib/__tests__/petitionTestItems.test.ts` — เพิ่ม / สร้างใหม่)

`visibleEnumOptions`:
- ไม่มี `optionFilters` → คืน options ทั้งหมด
- มี filter `productTypes:['water']`, item เป็น water → คืน option นั้น
- มี filter `productTypes:['water']`, item เป็น powder → ไม่คืน option นั้น
- Filter ทั้ง productTypes + subCategories — ต้องผ่าน AND ถึงจะคืน
- ภายใน productTypes มีหลายค่า — ตรง 1 ค่าก็พอ (OR)

### Manual (ไม่ทำ npm run build — ใช้ `npx tsc --noEmit`)

1. เปิด ParameterSettings → สร้าง / แก้ parameter "กายภาพ" ที่มี enum field
2. เพิ่ม option `ของเหลวใส` → click 🎯 → ติ๊ก "น้ำ" → save
3. ดูที่ Lab/QC Testing ของ petition item ที่ classify เป็น `EW` (water) → ต้องเห็น `ของเหลวใส`
4. ดูที่ item ที่ classify เป็น `WP` (powder) → ต้องไม่เห็น `ของเหลวใส`
5. ลบ option `ของเหลวใส` ออกจาก parameter → reload → entry ใน optionFilters ต้องหายไป (ตรวจผ่าน API GET parameter)

## Migration

ไม่ต้อง — เพราะ:
- `optionFilters` undefined = พฤติกรรมเดิม (แสดงทุก option)
- เอกสาร MongoDB ที่ไม่มี field นี้ → `field.optionFilters === undefined` → `visibleEnumOptions` คืน options ทั้งหมด
- UI ฝั่ง ParameterSettings เริ่มต้นว่าง = ไม่ทำ filter

## Open Questions

ไม่มี — design ตัดสินใจครบตามคำตอบที่ user เลือก (Flat + filter, ระดับ productType + subCategory)
