# Design: คลิกแถว Standard เปิด Drawer รายละเอียด + ปุ่มแก้ไขข้างเพิ่มขวด (หน้า /stock)

วันที่: 2026-07-10
สถานะ: อนุมัติดีไซน์แล้ว (รอ review spec)

## ปัญหา / เป้าหมาย

หน้า **Stock Management** (`/stock`) แท็บ Standards ตอนนี้:

- เปิดดูรายขวดได้ทางเดียวคือคลิกที่ **ข้อความชื่อสาร** (หรือไอคอน 📦 เล็กๆ) — คลิกส่วนอื่น
  ของแถวไม่เกิดอะไร ผู้ใช้ไม่รู้ว่ากดได้
- drawer เดิม (`UnitsDrawer`) โชว์แค่ตารางรายขวด ไม่เห็นข้อมูลสาร (ความถี่ อุณหภูมิเก็บ
  หมายเหตุ สถานะ)
- ปุ่มแก้ไข/รับเข้า เป็นไอคอนเล็ก 4 อันท้ายแถว (รับเข้า/รายขวด/แก้ไข/ลบ) หายากและรก

ผู้ใช้ต้องการ: **คลิกที่แถว/การ์ดแล้วขึ้นรายละเอียด** และใน
รายละเอียดมี **ปุ่มแก้ไขอยู่ข้างปุ่มเพิ่มขวด**

## แนวทางที่เลือก

Drawer รายละเอียดเต็มแบบ shadcn **Sheet** ฝั่งขวา (pattern เดียวกับ Detail Drawer หน้า
Master Item) แทน `UnitsDrawer` เดิม + ทำทั้งแถวคลิกได้ + คอลัมน์ Actions เหลือแค่ปุ่มลบ
(ทางเลือกที่ตัดไป: ใช้ drawer เดิมแล้วเพิ่มปุ่มอย่างเดียว = ไม่เห็นข้อมูลสาร /
dialog กลางจอ = ตารางรายขวดแคบ)

## ขอบเขต

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `src/components/lis/stock/StandardDetailDrawer.tsx` | **ใหม่** — Sheet รายละเอียดสาร |
| `src/components/lis/stock/StandardUnitsPanel.tsx` | เพิ่ม prop `onEdit?` → ปุ่มแก้ไขข้างเพิ่มขวด |
| `src/pages/Stock.tsx` (เฉพาะ `StandardsTab`) | row click, ตัดไอคอน 3 อัน, state drawer เป็น id |
| `src/components/lis/stock/UnitsDrawer.tsx` | **ลบทิ้ง** (grep ยืนยันก่อนว่าใช้แค่ใน Stock.tsx) |

**ไม่แตะ:** แท็บ สารเคมี/เครื่องแก้ว/รับเข้า(ReceiveCart)/ประวัติ, ฟอร์ม `StandardDialog`,
`ReceiveBottlesDialog`, `EditUnitDialog`, `PerformanceDropDialog`, ปุ่มสแกน QR (FAB),
backend/schema ทุกอย่าง

## รายละเอียด

### 1. แถวในตาราง Standards

- `<TableRow className="cursor-pointer" onClick={() => setDrawerId(item._id)} title="คลิกเพื่อดูรายละเอียด">`
  — idiom เดียวกับตาราง Machines/Master Items
- ชื่อสารเปลี่ยนจาก `<button>` เป็นข้อความธรรมดา (ทั้งแถวคลิกได้แล้ว)
- คอลัมน์ Actions เหลือ **ปุ่มลบ 🗑 อันเดียว** (คลิกแล้ว `stopPropagation` ไม่ให้เปิด
  drawer) — หัวคอลัมน์แคบลง (`w-40` → `w-12`, ตัดป้าย "Actions")
- ตัดไอคอน รับเข้า (ArrowDownToLine) / รายขวด (Package) / แก้ไข (Pencil) ออก —
  ทั้งหมดทำผ่าน drawer แทน; ตัด state `receiving` + `<ReceiveBottlesDialog>` ระดับ
  `StandardsTab` ออกด้วย (panel ใน drawer จัดการเองอยู่แล้ว)

### 2. `StandardDetailDrawer` (ใหม่)

Sheet `side="right"` กว้าง `w-full sm:max-w-2xl` (ตารางรายขวดต้องการที่กว้าง),
เนื้อหา scroll แนวตั้ง:

- **หัว**: ชื่อสาร (ใหญ่) + code + badge สถานะชุดเดียวกับแถวตาราง (หมด/หมดอายุ N/
  ใกล้หมดอายุ N/ปกติ — คำนวณจาก `summarizeStandard(units)` เหมือนเดิม) +
  คงคลังรวม X ขวด และ breakdown `primary N · working N · supplier N` (เฉพาะ tier ที่มี)
- **ข้อมูลสาร** (grid 2 คอลัมน์ label/value): ความถี่/1 ครั้ง · อุณหภูมิที่เก็บ ·
  อัตราการใช้/ครั้ง (mg) · หมายเหตุ (field `status`) — ค่าว่างแสดง "-";
  ไม่โชว์ข้อมูล tier เก่า (ยังซ่อนใน `<details>` ของฟอร์มแก้ไขเหมือนเดิม)
- **รายขวด**: `<StandardUnitsPanel standard={item} onEdit={...} />` — ตารางรายขวด +
  ปุ่มทั้งหมด reuse ของเดิม
- ข้อมูล units ใช้ query `["stock","units",code]` ที่ panel มีอยู่แล้ว; ส่วน badge
  สรุปที่หัว drawer ใช้ `unitsByCode` ที่ `StandardsTab` มีอยู่แล้ว (ส่ง units เข้าไป
  เป็น prop) — ไม่ยิง query ซ้ำ

### 3. ปุ่มแก้ไขข้างเพิ่มขวด (`StandardUnitsPanel`)

- เพิ่ม prop `onEdit?: () => void`
- ถ้าส่งมา: แถว toolbar บนขวาของ panel render `[✎ แก้ไข] [+ เพิ่มขวด (รับเข้า)]`
  คู่กัน (ปุ่มแก้ไข `type="button" variant="outline"` เหมือนปุ่มเพิ่มขวด)
- ถ้าไม่ส่ง (ตอนฝังในฟอร์มแก้ไข `StandardDialog`): เหมือนเดิมทุกอย่าง — ไม่มีปุ่มแก้ไขซ้อน

### 4. ความสดของข้อมูล (สำคัญ)

- state ใน `StandardsTab` เปลี่ยนจาก `drawer: StockStandardItem | null` เป็น
  `drawerId: string | null` แล้ว derive ตัวจริงทุก render:
  `const drawerItem = data.find(s => s._id === drawerId)`
- กดแก้ไขใน drawer → `setEditing(drawerItem)` เปิด `StandardDialog` ทับ Sheet
  (Radix portal ตัวหลังอยู่บนสุด — drawer ค้างอยู่ข้างหลัง) → บันทึกแล้ว invalidate
  query เดิม → drawer แสดงข้อมูลใหม่ทันที ไม่ค้าง snapshot
- ถ้า `drawerId` มีค่าแต่หาไม่เจอในลิสต์ (โดนลบ/ถูกกรองจาก server) → render null
  และเคลียร์ `drawerId` (ปิด drawer เงียบๆ)

## Testing

- งานนี้เป็น UI wiring ล้วน ไม่มี logic/helper ใหม่ → ไม่เพิ่ม unit test
- type-check: `npx tsc -p tsconfig.app.json --noEmit` (root tsconfig เป็น no-op)
- verify จริงบน browser (Playwright/Brave): คลิกแถว → drawer ขึ้นครบ (หัว+ข้อมูล+รายขวด),
  กดแก้ไขจาก drawer → บันทึก → หัว drawer อัปเดต, กดเพิ่มขวดจาก drawer → ขวดโผล่,
  ปุ่มลบในแถวไม่เปิด drawer, ฟอร์มแก้ไขเดิม (จากที่อื่น) ไม่มีปุ่มแก้ไขซ้อน
