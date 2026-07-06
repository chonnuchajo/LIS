# หน้า "การเบิก stock" — Redesign

วันที่: 2026-07-06
ไฟล์หลัก: `src/pages/StockDeduction.tsx` + `src/components/lis/StockRequisitionTab.tsx` และคอมโพเนนต์ย่อยใน `src/components/lis/stock/`

## เป้าหมาย

Restyle หน้าเบิก stock ให้สะอาด ทันสมัย อ่านเร็ว ใช้งานง่าย โทนขาว/น้ำเงิน/เทาอ่อน
เน้นให้ผู้ใช้แยกออกทันทีว่าอะไรคือ **ข้อมูล** อะไรคือ **สถานะ** อะไรคือ **ปุ่มกด**
และเข้าใจได้ทันทีว่า Standard รายการใด "แจ้งทิ้ง" ได้ โดยหน้าไม่ดูน่ากลัวเหมือนกำลังลบข้อมูล

## บริบทที่เกี่ยวข้อง (ของเดิม)

- หน้า `StockDeduction.tsx` มีอยู่แล้ว: `PageHeader` (title "การเบิก stock" + desc "เบิกสารเคมีให้เครื่อง และดูประวัติการตัด stock")
  + `Tabs` 2 แท็บ `เบิก stock` / `ประวัติ` + แท็บประวัติเป็น `DataTable` filter หมวด
- `StockRequisitionTab.tsx`: ปุ่ม `+ เบิก stock` (Popover chooser สารเคมี/Standard)
  + `<ChemicalRequisitionPanel>` (สารเคมีที่เบิกวันนี้) + การ์ด "Standard ที่แบ่งวันนี้" (list จาก stock-transaction)
- "Standard ที่แบ่งวันนี้" เดิมดึงจาก `getStockTransactions({action:"withdraw", itemType:"standard"})`
  — transaction **ไม่มีสถานะ / ปริมาณคงเหลือ** ติดมา; ปุ่ม "แจ้ง/ทิ้ง" เป็น text ลอย → เปิด `PerformanceDropDialog`
- `PerformanceDropDialog.tsx` (ใช้ 2 จุด: การ์ดวันนี้ + working list ใน `StandardRequisitionDialog`):
  หัวข้อ "แจ้งประสิทธิภาพลดลง", เหตุผลเป็น `Input` free-text, มี radio scope (working นี้ / ทั้งขวด cascade)
- helper พร้อม: `workingUsability(u)` (`src/lib/stockUnit.ts`) → `active|freqDue|expired|empty|discarded`
  ; `USABILITY` map (label+สี) ปัจจุบันฝังใน `StandardRequisitionDialog.tsx`
- API: `getStockUnits({itemCode?,status?,kind?})`, `getStockUnit(qrId)`, `discardStockUnit(qrId,{reason?,cascade?})`
- `StockUnitItem` มี: `itemName`, `volume.remaining/unit`, `exp`, `frequencyDue`, `withdrawnDate`, `lotNo`, `qrId`, `status`

## การตัดสินใจ (ยืนยันกับผู้ใช้)

1. **สถานะ Standard = ของจริง** — เปลี่ยนแหล่งข้อมูล section เป็น working units ที่แบ่งวันนี้
   (ได้ badge สถานะจริง + ปริมาณคงเหลือจริงฟรี; รายการที่ทิ้งแล้วโชว์ badge "ทิ้งแล้ว")
2. **Modal แจ้งทิ้ง เก็บตัวเลือก "ทิ้งทั้งขวด" ไว้** แต่จัดใหม่ให้เรียบ (default = ทิ้งเฉพาะ working นี้)
3. **เมนู ⋮ = "ดูรายละเอียด" อย่างเดียว** (ไม่มี "แก้ไข" — รายการที่แบ่งแล้วไม่มีอะไรให้แก้จริง)
4. **ปุ่ม "ดูรายการ Standard ทั้งหมด" → แท็บ "ประวัติ" ตั้ง filter = standard**

## ดีไซน์

### โครงหน้า (StockDeduction.tsx)
- คง `PageHeader` + `Tabs` เดิม แต่ทำ `Tabs` เป็น **controlled** (`value` / `onValueChange`)
  เพื่อให้ปุ่ม "ดูทั้งหมด" สลับไปแท็บ `history` ได้ + ตั้ง `type="standard"` พร้อมกัน
- ส่ง callback `onViewAllStandards` ลงไปยัง `StockRequisitionTab` → `StandardDailyPanel`
- แท็บ `history` (DataTable) คงเดิม

### แหล่งข้อมูล section "Standard ที่แบ่งวันนี้"
- `getStockUnits({ kind: "working" })` แล้ว filter client-side: `withdrawnDate` (fallback `createdAt`) = วันนี้ (local)
- **ต้องรวม status `discarded`** เพื่อโชว์ badge "ทิ้งแล้ว" — ถ้า default query ของ backend กรอง discarded ออก
  ให้ปรับ query/endpoint ตอน implement (เช็คก่อน) ; เรียง badge ที่ใช้ได้ก่อน แล้วตามด้วยที่ทิ้ง/หมด
- สถานะแต่ละแถวคำนวณด้วย `workingUsability(u)`

### คอมโพเนนต์ (แยกให้ isolate + อ่านง่าย)
| ไฟล์ | บทบาท |
|---|---|
| `pages/StockDeduction.tsx` (แก้) | Tabs controlled + deep-link "ดูทั้งหมด" |
| `components/lis/StockRequisitionTab.tsx` (แก้) | ปุ่มหลัก + วาง 2 panel + ส่ง callback |
| `components/lis/ChemicalRequisitionPanel.tsx` (แก้) | Empty state ใหม่กระชับ |
| `components/lis/stock/StandardDailyPanel.tsx` (ใหม่) | การ์ด header+count+list+ปุ่มดูทั้งหมด+empty |
| `components/lis/stock/StandardDailyRow.tsx` (ใหม่) | 1 แถว standard (data/status/actions) |
| `components/lis/stock/PerformanceDropDialog.tsx` (แก้) | Modal แจ้งทิ้ง (reason dropdown + scope เรียบ) |
| `components/lis/stock/StandardUnitDetailDialog.tsx` (ใหม่) | เมนู ⋮ "ดูรายละเอียด" |
| `lib/standardStatus.ts` (ใหม่) | ย้าย `USABILITY` map (label+สี+usable) มาใช้ร่วม (กันซ้ำกับ StandardRequisitionDialog) |

### แถว Standard (StandardDailyRow) — anatomy
```
┌──────────────────────────────────────────────────────────────┐  rounded-xl (12px)
│ 🧪  2,4-D Acid                          [🟢 พร้อมใช้งาน]       │  border เทาอ่อน + shadow-sm
│     10 ml · แบ่งวันนี้ เวลา 08:10        [🗑 แจ้งทิ้ง]  [⋮]    │
└──────────────────────────────────────────────────────────────┘
```
- **ข้อมูล**: ชื่อ standard (เข้ม, ตัวหนา) · ปริมาณคงเหลือ (`10 ml`) · เวลา (`แบ่งวันนี้ เวลา 08:10`) เทากลาง
- **สถานะ** = `Badge` สีตาม `standardStatus`: พร้อมใช้งาน=เขียว, หมดความถี่=เหลือง, หมดอายุ=ส้ม, หมด=เทา, ทิ้งแล้ว=แดงจาง
- **ปุ่ม "แจ้งทิ้ง"** = `variant="outline"` **เส้นขอบ+ตัวอักษรแดง** + ไอคอน `Trash2` (ไม่ใช่แดงทึบ),
  hover พื้นแดงจาง (`hover:bg-destructive/5`) ; ซ่อนปุ่มเมื่อสถานะ = ทิ้งแล้ว/หมด
- **เมนู ⋮** (`DropdownMenu`) = "ดูรายละเอียด" → `StandardUnitDetailDialog`
- **Responsive**:
  - Desktop/Tablet: ข้อมูลซ้าย, badge+ปุ่ม+⋮ ขวา บรรทัดเดียว/สองบรรทัดในกล่องเดียว
  - **Mobile: ปุ่ม "แจ้งทิ้ง" ตกลงล่างเต็มความกว้าง** (`w-full`), ⋮ มุมขวาบน, badge ใต้ชื่อ

### StandardDailyPanel
- หัวข้อ "Standard ที่แบ่งวันนี้" (ไอคอน `Package`) + **จำนวนรายการชิดขวา** (`Badge`/ตัวเลขเทา)
- Empty state: ไอคอน + "ยังไม่มีการแบ่งวันนี้" (กระชับ ไม่สูงเกิน)
- แสดง **5 แถวแรก**; ถ้าเกิน → ปุ่ม **"ดูรายการ Standard ทั้งหมด (N)"** (ghost/link) → `onViewAllStandards()`
- list เรียงเป็น stack `gap-2`

### ChemicalRequisitionPanel — Empty state ใหม่
- แทน `<p>ยังไม่มีการเบิกวันนี้</p>` ด้วย empty state กระชับ: ไอคอน `FlaskConical` (เทาจาง) กลาง
  + ข้อความ **"ยังไม่มีรายการเบิกวันนี้"** ; padding ไม่สูงเกินจำเป็น (การ์ดไม่บวม)
- ส่วน list (เมื่อมีข้อมูล) คงพฤติกรรมเดิม (ยกเลิก/คืนสต็อก) — restyle เล็กน้อยให้เข้าชุด

### Modal แจ้งทิ้ง (PerformanceDropDialog redesign)
- หัวข้อ **"แจ้งทิ้ง Standard"**
- โชว์ **ชื่อ + ปริมาณคงเหลือ** เด่น (เช่น `2,4-D Acid · เหลือ 8 ml · Lot ... · working`)
- **Dropdown เหตุผล** (`Select`): ประสิทธิภาพลดลง / หมดอายุ / ปนเปื้อน / ใช้งานไม่ได้ / อื่นๆ
  - เลือก "อื่นๆ" → โผล่ `Input` ให้พิมพ์เหตุผลเอง (ค่าที่ส่ง = ข้อความที่พิมพ์)
- **ขอบเขต** (คงไว้ จัดเรียบ): default = "ทิ้งเฉพาะ working นี้"; option รอง = "ทิ้งทั้งขวด (ขวดแม่ + working ลูกทุกตัว)"
  (map เป็น `cascade: scope === "whole"` เหมือนเดิม)
- บรรทัดเตือนเล็ก: "เมื่อทิ้งแล้ว QR นี้ใช้งานต่อไม่ได้ถาวร"
- ปุ่ม: **"ยกเลิก"** (`outline`) + **"ยืนยันแจ้งทิ้ง"** (`variant="destructive"` แดงทึบ)
- ใช้ร่วมทั้ง 2 จุดเดิม (การ์ดวันนี้ + working list ใน StandardRequisitionDialog) → ดีไซน์เดียวกัน

### StandardUnitDetailDialog (ใหม่)
- Dialog อ่านอย่างเดียว: ชื่อ + code, kind (working), Lot, EXP, frequencyDue, ปริมาณ initial→remaining,
  วันแบ่ง (withdrawnDate), ผู้แบ่ง (createdBy) — ดึงจาก `getStockUnit(qrId)`
- ปุ่ม "ปิด"

### UI tone (ทั้งหน้า)
- ขาว/น้ำเงิน/เทาอ่อน — ปุ่มหลัก `+ เบิก stock` = น้ำเงิน (`Button` default primary)
- การ์ด/แถว: `rounded-xl` (12px) · `shadow-sm` · `border` เทาอ่อน
- padding/gap สม่ำเสมอ (`p-3`, `gap-2`) · ลดพื้นที่ว่าง (empty state ไม่บวม)
- badge สีบอกสถานะชัด, ปุ่มแยกกลุ่มจากข้อมูลชัดเจน

## นอกขอบเขต (ไม่ทำรอบนี้)
- ไม่แตะ logic แท็บ "ประวัติ" (นอกจากรับ deep-link)
- ไม่เพิ่ม "แก้ไขปริมาณ" (ไม่มีในเมนู ⋮)
- ไม่แตะ backend discard/withdraw logic (นอกจากเช็ค query discarded ถ้าจำเป็น)
- ไม่แตะ flow เบิกสารเคมี/Standard (Popover chooser + dialog เบิก) นอกจาก restyle empty state

## การทดสอบ
- Unit: `standardStatus.ts` (map สถานะ→label/สี/usable), helper filter "แบ่งวันนี้"
- Manual E2E (บนเครื่อง user): แบ่ง standard → เห็นแถวใหม่ + badge พร้อมใช้งาน; แจ้งทิ้ง (เหตุผล dropdown + อื่นๆ)
  → badge เปลี่ยนเป็นทิ้งแล้ว/รายการหาย; ทิ้งทั้งขวด; ดูรายละเอียด; ดูทั้งหมด → แท็บประวัติ filter standard;
  responsive mobile (ปุ่มแจ้งทิ้งเต็มกว้าง); empty state สารเคมี/standard
