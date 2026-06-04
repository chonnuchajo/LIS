# Master Item — Override commonname (✎ inline) — Design

**Date:** 2026-06-04
**Status:** Draft (pending user review)
**Author:** prompiriya-ICP + Claude

## Problem

หน้า **Master Item** โชว์ `commonname` (สารออกฤทธิ์) ดิบจาก ERP ตรง ๆ แก้ไม่ได้ ถ้าค่าจาก ERP เขียนผิดรูปแบบ ผู้ใช้ต้องไปแก้ที่หน้า **Simple Method** (ปุ่ม ✎ "ตั้งชื่อมาตรฐาน") เท่านั้น

ต้องการให้แก้ `commonname` ได้ตรง ๆ จากหน้า Master Item ด้วย แบบเดียวกับ ✎ ของ Simple Method

## Goal / Non-goals

**Goal:** เพิ่มปุ่ม ✎ inline ข้างคอลัมน์ commonname ในตาราง Master Item ให้ override `commonname` ได้ โดย**ใช้ override layer เดียวกับ Simple Method** (`CommonNameOverride`, คีย์ด้วย raw string → canonical) และโชว์ค่า canonical ในตารางทันที

**Non-goals (YAGNI):**
- ไม่แตะ backend — route `/common-name-overrides` + helper `commonNameOverride.ts` มีครบแล้ว
- ไม่ทำปุ่ม revert/delete override แยก, ไม่ทำ badge ใหญ่ — ให้ match กับ Simple Method ที่ implement จริง (มีแค่ ✎ → dialog → set canonical)
- ไม่ทำ per-item override (ผู้ใช้เลือก shared layer)

## Key decisions (จากผู้ใช้ 2026-06-04)

1. **Shared layer** — ใช้ `CommonNameOverride` ตัวเดียวกับ Simple Method (raw→canonical map ตาม string). แก้ที่ Master Item = ไปโผล่ที่ Simple Method ด้วยอัตโนมัติ และทุก item ที่ raw common_name เดียวกันเปลี่ยนพร้อมกัน
2. **✎ inline** ข้างคอลัมน์ commonname → เปิด dialog ตั้งชื่อมาตรฐาน (เหมือน Simple Method)

## Design (frontend-only — `src/pages/MasterItems.tsx`)

### 1. โหลด override layer เข้า `MasterItems()` component
```ts
const { data: cnOverrides = [] } = useQuery({
  queryKey: ["common-name-overrides"],
  queryFn: async () => {
    const res = await api.get<CommonNameOverrideRow[]>("/common-name-overrides");
    return Array.isArray(res.data.data) ? res.data.data : [];
  },
});
const cnMap = useMemo(() => buildOverrideMap(cnOverrides), [cnOverrides]);
```
(query/พาเทิร์นก๊อปจาก `SimpleMethodPage` เป๊ะ — import `buildOverrideMap` มีอยู่แล้วในไฟล์)

### 2. `enrichedItems` — เพิ่ม raw + canonical commonname ต่อแถว
ใน map ปัจจุบัน (อ่านจาก **item ดิบ ก่อน `applyOverride`** เพื่อให้ key ตรงกับ Simple Method ซึ่ง key ด้วย raw common_name จาก `commonNameKeys`):
```ts
const enrichedItems = useMemo(
  () => items.map((item) => {
    const originalItemNo = String(firstValue(item, codeKeys)).trim();
    const override = overrideMap[originalItemNo];
    const rawCommonName = String(firstValue(item, commonNameKeys)).trim(); // จาก item ดิบ
    return {
      item: applyOverride(item, override),
      originalItemNo,
      override,
      rawCommonName,
      displayCommonName: normalizeCommonName(rawCommonName, cnMap),
    };
  }),
  [items, overrideMap, cnMap],
);
```
> หมายเหตุ key ต้องเป็น raw จาก `commonNameKeys` (ก่อน applyOverride) — เพราะถ้ามี MasterItemMeta `itemType` override อยู่ มันจะเขียนทับ `common_name` ด้วยโค้ด classification (typeKeys ⊃ common_name) ทำให้ key เพี้ยนไม่ตรงกับ Simple Method

### 3. คอลัมน์ commonname: โชว์ canonical + ปุ่ม ✎
- เปลี่ยน cell จาก `displayValue(firstValue(item, typeKeys))` → โชว์ `displayCommonName` (เห็นผล override ทันที)
- เพิ่มปุ่มดินสอเล็กข้างค่า (รูปแบบเดียวกับ ✎ ของ `SimpleMethodTab` row): `stopPropagation` กันเปิด detail dialog → `setEditingCommonName({ rawCommonName, currentCanonical: displayCommonName })`
- ถ้า `displayCommonName !== rawCommonName` → ใส่ `title={rawCommonName}` ให้ hover เห็นค่าเดิม (เบา ๆ ไม่ทำ badge)

### 4. Refactor `CommonNameOverrideDialog` ให้ generic
ปัจจุบันรับ `row: SimpleMethodRow` → เปลี่ยนเป็น props กลาง:
```ts
function CommonNameOverrideDialog({
  rawCommonNames,      // string[] — raw ทั้งหมดที่จะ map ไป canonical เดียวกัน
  initialCanonical,    // string — ค่าเริ่มต้นในช่องกรอก
  onClose,
  onSaved,
}: {
  rawCommonNames: string[];
  initialCanonical: string;
  onClose: () => void;
  onSaved: () => void;
})
```
- ภายใน: `useState(initialCanonical)`, loop POST `/common-name-overrides` ทุก raw ใน `rawCommonNames` (logic เดิม)
- **Call site 1 (SimpleMethodPage):** `rawCommonNames={editingRow.rawCommonNames}` `initialCanonical={editingRow.commonName}` — พฤติกรรมเดิมไม่เปลี่ยน
- **Call site 2 (MasterItems):** `rawCommonNames={[editingCommonName.rawCommonName]}` `initialCanonical={editingCommonName.currentCanonical}`
- ทั้ง 2 component อยู่ไฟล์เดียวกัน → refactor ตรง ๆ ไม่ต้องย้ายไฟล์

### 5. State + invalidate ใน `MasterItems()`
- เพิ่ม state: `const [editingCommonName, setEditingCommonName] = useState<{ rawCommonName: string; currentCanonical: string } | null>(null)`
- render dialog เมื่อ `editingCommonName` ไม่ null
- `onSaved` → `queryClient.invalidateQueries({ queryKey: ["common-name-overrides"] })` → cnMap rebuild → ตารางอัปเดตเอง

## ผลข้างเคียงที่ตั้งใจ (shared layer)
แก้ commonname จาก item เดียว = set override ของ raw string นั้น → กระทบทุก item ที่ raw เดียวกัน **และ Simple Method** dialog โชว์ raw ที่กำลัง remap อยู่แล้ว ผู้ใช้เห็นชัดว่ากำลังแก้ string ไหน

## Testing
- **tsc:** `npx tsc --noEmit` ผ่าน (refactor props ของ dialog → เช็ค call site ทั้ง 2)
- **Unit:** helper `normalizeCommonName`/`buildOverrideMap` มี `commonNameOverride.test.ts` ครอบแล้ว — ไม่ต้องเพิ่ม
- **Regression:** `npm run test` ผ่านทั้งหมด (โดยเฉพาะ `buildSimpleMethodRows.test.ts` — ยืนยัน refactor ไม่กระทบ Simple Method)
- **Manual:** ตั้ง override ผ่าน ✎ ในหน้า Master Item → คอลัมน์ commonname อัปเดต + ไปโผล่ที่ Simple Method ด้วย; เปิดหน้า Simple Method ✎ → ยังทำงานเหมือนเดิม

## Rollout
1. Refactor `CommonNameOverrideDialog` props + แก้ call site SimpleMethodPage
2. เพิ่ม query/cnMap/enrichedItems fields/✎ button/state ใน Master Item
3. `npx tsc --noEmit` + `npm run test`
4. commit (override data อยู่ใน seed-data อยู่แล้ว — ไม่มี data ใหม่จาก feature นี้)
