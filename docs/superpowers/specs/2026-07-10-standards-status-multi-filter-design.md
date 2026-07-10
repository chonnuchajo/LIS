# Standards status filter — multi-select

**Date:** 2026-07-10
**Status:** Approved
**Scope:** Standards tab ใน `src/pages/Stock.tsx` เท่านั้น (ไม่แตะ backend, แท็บอื่น, การ sort)

## ปัญหา

filter สถานะของตาราง Standards (สาร Standard) เป็น `Select` เลือกได้ค่าเดียว
(ทุกสถานะ / ปกติ / หมด / ใกล้หมด / หมดอายุ / ใกล้หมดอายุ) ผู้ใช้ต้องการเลือกดูหลาย
สถานะพร้อมกัน เช่น "หมดอายุ" + "ใกล้หมดอายุ" ในคราวเดียว

## Design

### UI

- แทนที่ `Select` เดิม (บรรทัด ~194 ใน `Stock.tsx`) ด้วยปุ่ม `DropdownMenu` +
  `DropdownMenuCheckboxItem` (shadcn primitive ที่มีอยู่แล้วใน
  `src/components/ui/dropdown-menu.tsx`)
- รายการติ๊กมี 5 สถานะ: ปกติ / หมด / ใกล้หมด / หมดอายุ / ใกล้หมดอายุ —
  **ตัดตัวเลือก "ทุกสถานะ" ออก** เพราะสถานะว่าง (ไม่ติ๊กอะไรเลย) = โชว์ทั้งหมด
- ป้ายบนปุ่ม trigger:
  - ไม่เลือกเลย → "ทุกสถานะ"
  - เลือก 1 ค่า → ชื่อสถานะนั้น (เช่น "หมดอายุ")
  - เลือก ≥2 ค่า → "สถานะ (n)"
- ติ๊กแล้วเมนู**ไม่ปิด** — ใส่ `onSelect={e => e.preventDefault()}` บนแต่ละ
  `DropdownMenuCheckboxItem` เพื่อให้ติ๊กหลายค่าได้รวดเดียว
- ขนาด/ตำแหน่งปุ่มคงเดิม (`h-9 w-full sm:w-40` ข้างช่องค้นหา)

### State & filter logic

- state เปลี่ยนจาก `statusFilter: StandardStatusFilter` (ค่าเดียว) เป็น
  `statusFilters: Set<StandardStatus>` โดย `StandardStatus = "ok" | "out" |
  "low" | "expired" | "soon"` (type เดิมตัด `"all"` ออก)
- semantic การกรอง: **OR (union)** — รายการโชว์ถ้าตรงกับสถานะใดสถานะหนึ่งที่เลือก;
  set ว่าง = ผ่านทุกรายการ
- เงื่อนไขต่อสถานะใช้ของเดิมเป๊ะ:
  - `ok` → `standardLevel(usable) === "ok"` และ `expired === 0` และ `expiringSoon === 0`
  - `out` → `standardLevel(usable) === "out"`
  - `low` → `standardLevel(usable) === "low"`
  - `expired` → `expired > 0`
  - `soon` → `expiringSoon > 0`

### Pure helper (testable)

- เพิ่มใน `src/lib/stockStatus.ts`:

  ```ts
  export type StandardStatus = "ok" | "out" | "low" | "expired" | "soon";

  /** true ถ้า summary ตรงกับสถานะใดสถานะหนึ่งใน statuses; set ว่าง = ผ่านเสมอ */
  export function standardMatchesStatuses(
    sum: StdSummary,
    statuses: ReadonlySet<StandardStatus>,
  ): boolean;
  ```

- `Stock.tsx` เรียก helper นี้แทน if-chain เดิมใน `useMemo` ของ `filtered`
- unit test ใน `src/lib/stockStatus.test.ts` (ไฟล์เดิม): ครอบ set ว่าง,
  ทีละสถานะทั้ง 5, union หลายสถานะ, และเคส `ok` ที่มี expiringSoon > 0
  (ต้องไม่ผ่าน `ok` แต่ผ่าน `soon`)

## สิ่งที่ไม่เปลี่ยน

- การ sort ตาราง (เรียงตาม code natural numeric เหมือนเดิม)
- การกรองด้วยช่องค้นหา (AND กับ status filter เหมือนเดิม)
- การ์ดแจ้งเตือน Standard, badge สถานะในแถวตาราง
- แท็บ Solvents / Glassware / History และ backend ทั้งหมด

## Testing

- unit: `standardMatchesStatuses` ใน `stockStatus.test.ts` (Vitest)
- type-check: `npx tsc -p tsconfig.app.json --noEmit`
- manual E2E: เปิดแท็บ Standards → ติ๊กหลายสถานะ → รายการรวมตาม OR,
  ป้ายปุ่มอัปเดต, เมนูไม่ปิดตอนติ๊ก, ไม่ติ๊กเลย = เห็นทั้งหมด
