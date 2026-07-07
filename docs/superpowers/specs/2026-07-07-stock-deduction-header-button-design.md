# Redesign หน้า `/stock-deduction` — ปุ่มเบิก stock persistent + ประวัติเป็นหน้าหลัก

**วันที่:** 2026-07-07
**ไฟล์หลัก:** `src/pages/StockDeduction.tsx`

## เป้าหมาย

ผู้ใช้ต้องการให้หน้า "การเบิก stock" (`/stock-deduction`):
1. ปุ่ม **"เบิก stock"** เดิมฝังอยู่ในแท็บเดียว → ย้ายให้เห็นได้ทุกแท็บ (persistent)
2. แท็บ **ประวัติ** ขึ้นเป็นหน้าหลัก (default)
3. **ลบแท็บ "เบิก stock"** (การ์ด "การเบิกวันนี้") ทิ้ง

## สภาพปัจจุบัน

3 แท็บใน `StockDeduction.tsx`:

| tab value | label | render | หมายเหตุ |
|-----------|-------|--------|----------|
| `requisition` (default) | เบิก stock | `StockRequisitionTab` | ปุ่ม "เบิก stock" (Popover chooser สารเคมี/Standard → dialog) + การ์ด "สารเคมีที่เบิกวันนี้" (`ChemicalRequisitionPanel`) + การ์ด "Standard ที่แบ่งวันนี้" (`StandardDailyPanel`) |
| `working` | Standard ใช้งานอยู่ | `StandardWorkingPanel` | รายการ working standard ทั้งหมด + ค้นหา + filter + **แจ้งทิ้ง/จัดการ** |
| `history` | ประวัติ | ตาราง `getStockTransactions({action:"deduct"})` | filter หมวด |

**ข้อเท็จจริงที่ตรวจแล้ว:**
- ฟีเจอร์ **แจ้งทิ้ง/จัดการ standard** อยู่ในแท็บ `working` (ผ่าน `StandardUnitList`) อยู่แล้ว → ลบแท็บ `requisition` ไม่กระทบ
- `StockRequisitionTab`, `StandardDailyPanel`, `ChemicalRequisitionPanel` ถูกใช้แค่ในโฟลว์ของหน้านี้เท่านั้น (grep ยืนยัน) → กลายเป็น dead code หลังลบแท็บ
- `PageHeader` มี `actions` slot มุมขวาบนพร้อมใช้
- ปุ่มเบิก stock ปัจจุบันถือ state เอง (`chooser` popover + `which` dialog) ภายใน `StockRequisitionTab`

## การตัดสินใจที่ผู้ใช้ยืนยัน

- ปุ่ม "ยกเลิก/คืนสต็อก" ของรายการเบิกสารเคมีวันนี้ (ใน `ChemicalRequisitionPanel`) **ยอมให้หายไปพร้อมแท็บ** — ลบทิ้งทั้งหมดตามที่สั่ง ไม่ย้ายไปที่อื่น

## ดีไซน์ใหม่

### Layout
- `PageHeader` เพิ่ม `actions={<StockRequisitionButton .../>}` → ปุ่ม "เบิก stock" อยู่มุมขวาบน เห็นทุกแท็บ
- เหลือ **2 แท็บ**: `history` (ประวัติ, **default**) | `working` (Standard ใช้งานอยู่)
- ตัดแท็บ `requisition` (trigger + content) ออก

### Component
- **ใหม่ `src/components/lis/stock/StockRequisitionButton.tsx`** — ยกส่วนปุ่ม+Popover chooser+2 dialog ออกจาก `StockRequisitionTab` มาเป็น component เดี่ยว
  - Props: `{ roomSlug: string; instruments: { id: string; name: string }[] }`
  - ถือ state `chooser` (popover) + `which` (`"chemical" | "standard" | null`) เอง
  - render `<Button><Plus/> เบิก stock</Button>` + Popover chooser + `ChemicalRequisitionDialog` / `StandardRequisitionDialog` (logic + `queryClient.invalidateQueries` ยกมาเดิมทั้งก้อน ไม่เปลี่ยนพฤติกรรม)
- **แก้ `src/pages/StockDeduction.tsx`**
  - default `tab` = `"history"`
  - วาง `<StockRequisitionButton roomSlug={ANALYSIS_ROOM_SLUG} instruments={analysisInstruments} />` ใน `PageHeader actions`
  - `TabsList` เหลือ `history` + `working`; ลบ `TabsContent value="requisition"`
  - ลบ import `StockRequisitionTab` + helper `viewAllStandards`/`onViewAllStandards` ที่ไม่ใช้แล้ว
- **ลบไฟล์ dead code:**
  - `src/components/lis/StockRequisitionTab.tsx`
  - `src/components/lis/stock/StandardDailyPanel.tsx`
  - `src/components/lis/ChemicalRequisitionPanel.tsx`
  - เช็ค `ChemicalRequisitionDialog` / `StandardRequisitionDialog` ยังถูก `StockRequisitionButton` ใช้ต่อ (ไม่ลบ)
  - ปรับ comment ใน `src/lib/standardStatus.ts` ที่อ้าง `StandardDailyPanel` ถ้าจำเป็น (ไม่บังคับ)

### สิ่งที่ไม่แตะ
- `StandardWorkingPanel` (แท็บ working), `StandardUnitList`, dialog เบิกทั้งสอง, ตารางประวัติ, route/PrivateRoute, schema/API

## Non-goals
- ไม่แตะฝั่ง server / API / model
- ไม่เปลี่ยน UX ภายใน dialog เบิก
- ไม่ทำ empty-state / summary ทดแทนการ์ด "วันนี้" ที่ลบไป

## Verify
- `npx tsc -p tsconfig.app.json --noEmit` — ไม่มี error ใหม่ที่ชี้มายังไฟล์ที่แก้/ลบ
- `npm run test` (Vitest) เขียว
- Browser: เข้าหน้า → เห็นแท็บ ประวัติ เป็นค่าเริ่มต้น + ปุ่ม "เบิก stock" มุมขวาบน; สลับไปแท็บ Standard ใช้งานอยู่ → ปุ่มยังอยู่; กดปุ่ม → chooser → เปิด dialog เบิกได้ทั้งสองแบบ

## หมายเหตุ commit
- repo มี process อื่น commit แทรกเป็นครั้งคราว + auto-sync → **commit ด้วย explicit pathspec เฉพาะไฟล์ตัวเอง** เท่านั้น
