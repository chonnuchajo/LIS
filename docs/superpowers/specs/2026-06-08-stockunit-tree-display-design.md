# StockUnit ตารางขวดแบบ Tree (ref → working ลูก)

วันที่: 2026-06-08
สถานะ: design approved, รอ implement

## ปัญหา

ตอนแบ่ง working จากขวด sealed (ref) ใบที่ 1 ฝั่ง backend สร้าง `StockUnit`
ใหม่ที่ผูก `parentId = parent._id` อยู่แล้ว (`server/routes/stock.js`) แต่ฝั่ง
display (`StandardUnitsPanel`) เรนเดอร์ขวดทุกใบเป็นแถวแบนในตารางเดียว แล้วเลข
`#` เป็น running number (`idx + 1`) ตามลำดับแถว ขวด working ที่แบ่งออกมาเลย
โผล่เป็น "ขวดใหม่" ลำดับถัดไป แทนที่จะเป็นลูกของ ref ใบที่แบ่งมา

ผู้ใช้ต้องการ: ขวด ref ใบ 1 เป็นแถวหลักที่กดกาง (`>`) แล้วเห็นลูก working เป็น
`1.1`, `1.2` ใต้มัน — ไม่ใช่ขวดใหม่แยกออกมา และขวด ref ต้องยังเหลืออยู่
(ปริมาณคงเหลือถูกหักไปตามที่แบ่ง)

## ขอบเขต

- **แก้ฝั่ง frontend อย่างเดียว** — data model มี `parentId` ครบแล้ว
- ไม่แตะ backend / model / withdraw endpoint / label
- จุดเดียวที่เรนเดอร์รายขวดคือ `StandardUnitsPanel` (ใช้ทั้งใน `UnitsDrawer`
  และฝังในฟอร์มแก้ Standard) — `Stock.tsx` ใช้ units แค่ทำ summary ไม่เรนเดอร์
  ตารางรายขวด

## ดีไซน์

### 1. Helper `buildUnitTree(units)` — `src/lib/stockUnit.ts` (+ co-located test)

Pure function รับ `StockUnitItem[]` คืน flat list สำหรับเรนเดอร์:

```ts
type UnitTreeRow = {
  unit: StockUnitItem;
  label: string;      // "1", "1.1", "2", ...
  depth: number;      // 0 = root, 1 = child
  hasChildren: boolean;
  rootId: string;     // _id ของ root (ใช้ track expand/collapse)
};
buildUnitTree(units: StockUnitItem[]): UnitTreeRow[]
```

ตรรกะ:
1. กรองขวดที่ `unitDerivedStatus(u) === "discarded"` ออกก่อน (ตามพฤติกรรมเดิม)
2. **roots** = ขวด `kind === "sealed"` ที่เหลือ เรียงตามลำดับ input เดิม →
   label `"1"`, `"2"`, `"3"` (index + 1)
3. **children** = ขวด `kind === "working"` ที่ `parentId` ตรงกับ `_id` ของ root
   ตัวใดตัวหนึ่ง จัดกลุ่มไว้ใต้ root นั้น เรียงตามเวลาแบ่ง
   (`withdrawnDate` หรือ `createdAt`) → label `"<rootLabel>.1"`, `".2"`
4. **orphan** = ขวด working ที่ `parentId` ไม่ตรงกับ root ที่มองเห็นได้ (พ่อโดน
   ทิ้ง / หมด / หาไม่เจอ) → ยกขึ้นเป็น root ต่อท้าย เรียงตามลำดับ input → label
   เป็นเลขจำนวนเต็มถัดจาก root ปกติ; ถือว่า `depth = 0`, `hasChildren = false`
5. ลำดับ output: root → children ของ root นั้นทันที → root ถัดไป (DFS) เพื่อให้
   เรนเดอร์เรียงตรง

หมายเหตุ: ลูก working ของ orphan ไม่เกิดในทางปฏิบัติ (working แบ่งจาก sealed
เท่านั้น ตาม withdraw endpoint) จึงไม่ต้องรองรับ working-of-working

### 2. `StandardUnitsPanel` — เรนเดอร์เป็น tree

- เปลี่ยนจาก `visible.map((u, idx) => ...)` เป็น `buildUnitTree(data).map(row => ...)`
- คอลัมน์ `#` แสดง `row.label` แทน `idx + 1`
- expand state: `useState<Set<string>>` เก็บ `rootId` ที่ถูกกาง — **เริ่มต้นพับ
  ทั้งหมด** (set ว่าง)
- แถว root (`depth === 0`):
  - ถ้า `hasChildren` → ปุ่ม chevron `▶` (พับ) / `▼` (กาง) toggle rootId ใน set
  - ถ้าไม่มีลูก → เว้น spacer กว้างเท่า chevron ให้เลขตรงคอลัมน์
- แถว child (`depth === 1`): เรนเดอร์เฉพาะเมื่อ `expanded.has(row.rootId)`; เยื้อง
  เลข/ชนิดเข้าไปเล็กน้อยให้เห็นว่าเป็นลูก
- ปุ่มจัดการ (แบ่ง working / แก้ / ปริ้นซ้ำ / ทิ้ง) คงตรรกะเดิมทุกอย่าง
  (`canWithdraw` = sealed + active, ฯลฯ)
- คอลัมน์ "คงเหลือ" ของ ref = `unit.volume.remaining` (ถูกหักตอนแบ่งแล้ว)

## Edge cases

- ref ถูกทิ้ง (discarded) → ซ่อน ref; ลูก working ที่ยัง active กลายเป็น orphan
  → โผล่เป็น root ต่อท้าย (ไม่หาย)
- ref หมด (empty) แต่ไม่ถูกทิ้ง → ยังเป็น root แสดง badge "หมด" พร้อมลูกใต้มัน
- ขวดที่ไม่มีลูกเลย → ไม่มี chevron, เลขจำนวนเต็มตามปกติ

## Testing

- Unit test `buildUnitTree`:
  - sealed ล้วน ไม่มี working → label 1,2,3 depth 0 hasChildren false
  - sealed + working ลูก → root 1 hasChildren true, ลูก 1.1/1.2 depth 1 เรียงตามเวลาแบ่ง
  - working ที่พ่อถูกกรองออก (discarded) → orphan ขึ้นเป็น root ต่อท้าย
  - discarded ถูกกรองออกหมด
- ตรวจ `npx tsc -p tsconfig.app.json` และ vitest ผ่าน

## ไม่ทำ (YAGNI)

- ไม่เพิ่ม persistent expand state (จำว่ากางอันไหนข้าม session)
- ไม่ทำ working-of-working / tree ลึกเกิน 1 ชั้น
- ไม่แก้เลข label ที่ฝัง DB (label เป็น display-only คำนวณ runtime)
