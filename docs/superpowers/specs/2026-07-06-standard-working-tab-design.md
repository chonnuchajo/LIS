# เบิก Standard = แบ่งใหม่อย่างเดียว + แท็บ "Standard ใช้งานอยู่"

วันที่: 2026-07-06
ไฟล์หลัก: `src/pages/StockDeduction.tsx`, `src/components/lis/stock/StandardRequisitionDialog.tsx`,
คอมโพเนนต์ใหม่/แก้ใน `src/components/lis/stock/`, helper `src/lib/standardStatus.ts`

ต่อยอดจาก: `2026-07-06-stock-requisition-page-redesign-design.md` (การ์ด "Standard ที่แบ่งวันนี้")

## เป้าหมาย

แยกงาน 2 อย่างที่ตอนนี้ปนกันใน dialog "เบิก Standard" ออกจากกันให้ชัด:

1. **การแบ่ง** (สร้าง working ใหม่จากขวด sealed) — เป็นหน้าที่เดียวของ "เบิก Standard"
2. **การดูแล working** (แจ้งหมดอายุ/ประสิทธิภาพลดลง/ทิ้ง) — ย้ายไปหน้ารวมของมันเอง เพื่อให้
   ทุกคนที่ใช้ standard ตัวนั้นร่วมกันเข้ามาแจ้งสถานะได้

## บริบทปัจจุบัน

- `StandardRequisitionDialog.tsx` ทำ 2 อย่างปนกัน: (ก) list "working ที่มี" + ปุ่ม "ใช้อันนี้" (reuse) +
  "แจ้ง/ทิ้ง"; (ข) "แบ่ง working ใหม่จากขวด sealed"
- `StockDeduction.tsx` มี 2 แท็บ: `requisition` (เบิก stock) / `history` (ประวัติ) — Tabs controlled อยู่แล้ว
- การ์ด "Standard ที่แบ่งวันนี้" (`StandardDailyPanel` + `StandardDailyRow`) โชว์เฉพาะ working ที่แบ่ง**วันนี้**;
  ปุ่ม "ดูรายการ Standard ทั้งหมด" ปัจจุบันลิงก์ไปแท็บ `history` (filter standard) ผ่าน `onViewAllStandards`
- helper พร้อม: `workingUsability(u)` → `active|freqDue|expired|empty|discarded`;
  `standardStatusMeta`, `todayWorkingUnits`, `isSameLocalDay` (`src/lib/standardStatus.ts`)
- Backend `GET /units?kind=working` คืน working **ทุกตัว รวม discarded** (ไม่มี status filter default);
  `StockUnit` ไม่โดน soft-delete plugin → **ไม่ต้องแก้ backend** filter `discarded` ฝั่ง client พอ
- `PerformanceDropDialog` (แจ้งทิ้ง + เหตุผล + scope) และ `StandardUnitDetailDialog` (ดูรายละเอียด) พร้อมใช้ร่วม

## การตัดสินใจ (ยืนยันกับผู้ใช้)

1. **เบิก Standard = แบ่งใหม่อย่างเดียว** — ตัดส่วน "working ที่มี / ใช้อันนี้ (reuse)" ออกจาก dialog ทั้งหมด
2. **หน้าดูแล working = แท็บที่ 3** ในหน้า "การเบิก stock" (ไม่ใช่ nav page แยก)
3. **"แจ้ง" = ทิ้งถาวร** — reuse `PerformanceDropDialog` เดิม (ไม่เพิ่ม state สถานะใหม่)
4. **(A)** ปุ่ม "ดูรายการ Standard ทั้งหมด" ในการ์ดวันนี้ → ชี้ไป **แท็บ "Standard ใช้งานอยู่"** (แทนแท็บ history)
5. **(B)** แท็บใหม่ **เรียงตาม code** (natural numeric, ตาม convention) + ใช้ filter สถานะช่วยหาตัวที่ต้องแจ้ง

## ดีไซน์

### 1. StandardRequisitionDialog — split-only (ข้อ 1)
เอาออก: บล็อก "working ที่มี" ทั้งก้อน, ปุ่ม "ใช้อันนี้", ปุ่ม "แจ้ง/ทิ้ง" ในนั้น, import + usage
`PerformanceDropDialog`, state `perfDropQr`, ฟังก์ชัน `reuse()`, ตัวแปร `workings`.
เหลือ: เลือก standard (Popover) → สแกน QR → "แบ่ง working ใหม่จากขวด sealed" (FEFO + list) → `WithdrawDialog`.
แก้ `DialogDescription` เป็น "เลือก standard แล้วแบ่ง working ใหม่จากขวด sealed".
(สแกนขวด sealed ยังเปิดแบ่งได้เหมือนเดิม; ตัด logic ที่เกี่ยวกับ working list ที่ไม่ใช้แล้ว)

### 2. แท็บที่ 3 "Standard ใช้งานอยู่" (ข้อ 2)
`StockDeduction.tsx`:
- เพิ่ม `TabsTrigger value="working"` ระหว่าง `requisition` กับ `history` → label **"Standard ใช้งานอยู่"**
- `TabsContent value="working"` = `<StandardWorkingPanel />`
- `viewAllStandards` เปลี่ยนเป็น `setTab("working")` (เอา `setType("standard")` ออก — ข้อ A)

`StandardWorkingPanel.tsx` (ใหม่) — body ของแท็บ:
- query `["stock","units","working"]` = `api.getStockUnits({ kind: "working" })` (แชร์ cache กับการ์ดวันนี้)
- filter: `status !== "discarded"` (working ที่ยังอยู่ในระบบ; discarded ไปดูที่ประวัติ)
- ค้นหา: `Input` ค้นชื่อ (`itemName`) / code (`itemCode`)
- filter สถานะ: `Select` — ทั้งหมด / พร้อมใช้ (`active`) / ต้องจัดการ (`expired|freqDue|empty`)
- เรียงตาม `itemCode` natural numeric (`localeCompare` + `numeric:true`)
- render ผ่าน `StandardUnitList` (ดูข้อ 3) — ไม่ตัด 5 แถว (โชว์ทั้งหมด)
- empty state: ไอคอน + "ยังไม่มี Standard ที่กำลังใช้งาน" / (เมื่อ filter ไม่เจอ) "ไม่พบรายการที่ค้นหา"
- header: จำนวนรายการ (นับหลัง filter)

### 3. แยก `StandardUnitList` (ใหม่, extracted) — reuse ทั้ง 2 ที่
ก้อน "render rows + ถือ dialog แจ้งทิ้ง/ดูรายละเอียด + refresh" ที่ตอนนี้ฝังอยู่ใน `StandardDailyPanel`
ดึงออกมาเป็นคอมโพเนนต์ร่วม กันเขียน dialog wiring ซ้ำ:
- props: `units: StockUnitItem[]`
- ภายใน: state `discardQr`/`detailQr`, map เป็น `StandardDailyRow`, ถือ `PerformanceDropDialog` +
  `StandardUnitDetailDialog`, `refresh` = invalidate `["stock","units"]` + `["stock","transactions"]`
- `StandardDailyPanel` เหลือแค่ header + count + slice 5 แถว + ปุ่ม "ดูทั้งหมด" แล้วส่ง `units={shown}` ให้ `StandardUnitList`
- `StandardWorkingPanel` ส่ง `units={filtered}` ให้ `StandardUnitList`

### 4. แก้ `StandardDailyRow` ให้ถูกในบริบทใหม่
- **ปุ่ม "แจ้งทิ้ง" โชว์ทุกสถานะที่ยังไม่ทิ้ง** — เดิมเงื่อนไข `meta.usable` (โชว์เฉพาะ `active`) ทำให้
  ตัวหมดอายุ/หมดความถี่แจ้งทิ้งไม่ได้ ซึ่งขัดกับจุดประสงค์แท็บใหม่ → เปลี่ยนเป็นโชว์เมื่อ
  `workingUsability(unit) !== "discarded"` (ทั้ง desktop + mobile-full-width)
- **ป้ายเวลา**: เดิม hardcode "แบ่งวันนี้ เวลา HH:mm" — เปลี่ยนเป็น: ถ้าแบ่งวันนี้ → "แบ่งวันนี้ เวลา HH:mm"
  (คงเดิม), ถ้าไม่ใช่วันนี้ → "แบ่งเมื่อ D MMM YY" (ใช้ `isSameLocalDay` ตัดสิน) — การ์ดวันนี้ส่งแต่ของวันนี้
  พฤติกรรมจึงไม่เปลี่ยน

### 5. helper (`src/lib/standardStatus.ts`)
- เพิ่ม `activeWorkingUnits(units, opts?)`: filter `kind==="working" && status!=="discarded"`,
  รองรับ `search` (ชื่อ/code) + `statusFilter` ("all"|"usable"|"attention"), เรียงตาม `itemCode` natural numeric
  — logic ทั้งหมดของแท็บใหม่อยู่ที่นี่ (pure, test ได้)
- (ทางเลือก) export `workingUsability` re-export หรือใช้ตรงจาก `stockUnit.ts` ตามที่มีอยู่

## เปลี่ยนอะไรบ้าง

| ไฟล์ | สถานะ | บทบาท |
|---|---|---|
| `pages/StockDeduction.tsx` | แก้ | เพิ่มแท็บ "Standard ใช้งานอยู่"; `viewAllStandards`→`setTab("working")` |
| `components/lis/stock/StandardWorkingPanel.tsx` | ใหม่ | แท็บใหม่: ค้นหา + filter สถานะ + list ทั้งหมด |
| `components/lis/stock/StandardUnitList.tsx` | ใหม่ | render rows + 2 dialog + refresh (ใช้ร่วม 2 panel) |
| `components/lis/stock/StandardDailyPanel.tsx` | แก้ | ใช้ `StandardUnitList` กับ slice 5 แถว |
| `components/lis/stock/StandardDailyRow.tsx` | แก้ | แจ้งทิ้งทุกสถานะที่ไม่ทิ้ง + ป้ายวันที่แบ่ง (ไม่ใช่วันนี้) |
| `components/lis/stock/StandardRequisitionDialog.tsx` | แก้ | ตัด reuse working → split-only |
| `lib/standardStatus.ts` | แก้ | เพิ่ม `activeWorkingUnits` (filter/search/sort) |

## นอกขอบเขต
- ไม่แตะ backend (`GET /units` คืน working ครบอยู่แล้ว; discard/withdraw เดิม)
- ไม่เพิ่มสถานะ/สถานะ flag ใหม่ให้ working (แจ้ง = ทิ้ง เท่านั้น)
- ไม่แตะแท็บ history และ flow เบิกสารเคมี (solvent)
- ไม่ทำ pagination ในแท็บใหม่ (list สั้น; ค้นหา/filter พอ) — ถ้าโตค่อยเพิ่มภายหลัง

## การทดสอบ
- Unit (`standardStatus.test.ts`): `activeWorkingUnits` — กรอง discarded ออก, search ชื่อ/code,
  statusFilter usable/attention, เรียง code natural numeric; ป้ายวันที่ (วันนี้ vs ไม่ใช่วันนี้)
- Manual E2E (เครื่อง user):
  - เบิก Standard → dialog มีแต่ "แบ่งใหม่" (ไม่มี working list/ใช้อันนี้) → แบ่งได้ปกติ
  - แท็บ "Standard ใช้งานอยู่": เห็น working ทุกตัวที่ยังไม่ทิ้ง จากหลาย standard, เรียงตาม code
  - ค้นหา/filter สถานะ (พร้อมใช้ / ต้องจัดการ) ทำงาน
  - แจ้งทิ้งตัวหมดอายุ/หมดความถี่ได้ (ไม่ใช่แค่ active) → หายจากแท็บ (ไป discarded)
  - ดูรายละเอียด working
  - การ์ด "แบ่งวันนี้" ปุ่ม "ดูทั้งหมด" → เด้งไปแท็บ "Standard ใช้งานอยู่"
  - responsive mobile (ปุ่มแจ้งทิ้งเต็มกว้าง)
