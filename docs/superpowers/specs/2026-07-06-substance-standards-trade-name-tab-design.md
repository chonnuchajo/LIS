# Design: แท็บ "trade name" ใน SubstanceStandardsDialog

วันที่: 2026-07-06
สถานะ: อนุมัติดีไซน์แล้ว (รอ review spec)

## ปัญหา / เป้าหมาย

Dialog **"ตั้งเงื่อนไขรายสาร"** (`SubstanceStandardsDialog`) ให้ผู้ใช้ตั้งเกณฑ์มาตรฐานราย
สาร (`SubstanceStandard[]`) โดยปัจจุบันเลือกสารได้ 2 ทาง:

1. แท็บ **commonName** — คลิก common name → parse เป็นสาร (`parseSubstances`) → เติมทุกสาร
2. แท็บ **กลุ่ม** — คลิกกลุ่ม → เติมสารจากทุก commonName ในกลุ่ม

ผู้ใช้ต้องการทางเลือกที่ 3: **เลือกสารผ่าน trade name (ชื่อการค้า)** เพราะบางครั้งจำ/รู้จัก
สินค้าจากชื่อการค้ามากกว่า common name

## แนวทางที่เลือก

เพิ่มแท็บที่ 3 เป็น **substance-picker อีกทางหนึ่ง** — trade name เป็นเพียงทางลัดในการ
ค้นหาสาร ไม่ใช่หน่วยเก็บเกณฑ์ **data model คงเดิม** (เกณฑ์ยัง key ด้วยชื่อสารเสมอ)

resolution path: `trade name → master item → common name → parseSubstances → สาร`

เหตุผลที่เลือกแนวนี้ (แทนการตั้งเกณฑ์แยกราย trade name จริง): ไม่ต้องแตะ `SubstanceStandard`
schema, ไม่ต้องแก้ logic ตรวจ abnormal ทั้ง FE/BE, และสอดคล้องกับสถาปัตยกรรมเดิมที่เกณฑ์
เป็น per-substance เสมอ

## ขอบเขต

แก้ไฟล์เดียว: `src/components/lis/SubstanceStandardsDialog.tsx`

**ไม่แตะ:** `SubstanceStandard` schema (`src/lib/api.ts`), backend, logic ตรวจ abnormal
(`parameterValidation.ts` / `server/lib/abnormal.js`), แท็บ commonName/กลุ่ม เดิม

## รายละเอียด

### 1. UI — แท็บที่ 3

- `TabsList` เปลี่ยนจาก `grid-cols-2` → `grid-cols-3`: `commonName | กลุ่ม | trade name`
- `TabsContent value="trade"` ใช้ `filterBox` (ช่องค้นหาเดิม) + list ใหม่
- แต่ละแถวแสดง **ชื่อ trade name** (ตัวหนา) + บรรทัดย่อย **"สาร: X, Y"** ที่ resolve ได้
  — โครงเดียวกับ `commonNameList` เป๊ะ (reuse pattern เดิม)

### 2. Data — `tradeNameOptions`

useMemo ที่ derive จาก `safeRows` (query `["master-items"]` เดิม — มี `trade_name` ครบ
อยู่แล้ว ไม่ยิง request เพิ่ม):

```
row → { tradeName: pickField(row, tradeNameKeys), commonName: pickField(row, COMMON_NAME_KEYS) }
  → กรองเฉพาะ row ที่ tradeName ไม่ว่าง
  → group ตาม tradeName → รวม commonName ทั้งหมดของ group นั้น
  → substances = buildSubstances(commonNames ของ group)
  → กรองด้วย search (tradeName.toLowerCase().includes(q))
  → sort ตาม tradeName (localeCompare ["th","en"])
```

ผลลัพธ์: `{ tradeName: string, substances: string[] }[]`

trade name ที่ซ้ำ (เช่น สินค้าต่างขนาดบรรจุใช้ชื่อการค้าเดียวกัน) จะถูก dedupe และ union
สารจากทุก item ที่ใช้ชื่อนั้น

### 3. Behavior — คลิกเติมสาร

- คลิกแถว trade name → `substances.forEach(addSubstance)`
- reuse `addSubstance` เดิม ซึ่ง dedupe ด้วย `matchSubstanceKey` → สารที่อยู่ในคอลัมน์เกณฑ์
  แล้วจะไม่ถูกเติมซ้ำ
- ปุ่ม disable เมื่อ `substances.length === 0` (resolve ไม่ได้) หรือเติมครบทุกสารแล้ว
  (`substances.every(n => selectedKeys.has(matchSubstanceKey(n)))`) — logic เดียวกับ
  `commonNameList`

### 4. รายละเอียดเล็กน้อย

- import `tradeNameKeys` จาก `@/lib/masterItemFields` (มีอยู่แล้ว) แทนการ hardcode สำเนาที่ 3
  — ลด sync point
- ใช้ helper เดิมทั้งหมด: `pickField`, `buildSubstances`, `addSubstance`, `matchSubstanceKey`,
  `selectedKeys`, `filterBox`

## Testing

- Manual (browser): เปิด dialog → แท็บ trade name → ค้นหา → คลิก 1 รายการ → สารถูกเติมใน
  คอลัมน์เกณฑ์ / คลิกซ้ำแล้วไม่ซ้ำสาร / trade name ที่ resolve 0 สาร ปุ่ม disable
- `npx tsc -p tsconfig.app.json --noEmit` ต้องผ่าน (type-check จริงตาม convention repo)
- ไม่มี unit test ใหม่ (เป็น derive/render ตาม pattern เดิมล้วน; helper หลักมี test แล้ว)

## นอกขอบเขต (YAGNI)

- ไม่เก็บว่าเลือกสารมาจาก trade name ไหน (เก็บแค่ผลลัพธ์เป็นสาร)
- ไม่เพิ่ม endpoint / field ใหม่
- ไม่รองรับตั้งเกณฑ์ราย trade name โดยตรง
