# Stock Standards — 3 ประเภทขวด + เบิกแบบหัก mg รายน้ำหนัก

**วันที่:** 2026-07-07
**สถานะ:** design (approved for spec review)
**ขอบเขต:** หน้า `Stock` (Standards/สารเคมี/เครื่องแก้ว) + หน้า `stock-deduction` + โมเดล `StockUnit` / `StockStandard` + route `server/routes/stock.js`

---

## 1. ที่มา / ปัญหา

ระบบ Standard ปัจจุบันมี **2 โมเดลซ้อนกัน** ทำให้สับสน:

1. **Tier เก่า** — `StockStandard` เก็บ `primary.qty / supplier.qty / working.qty` เป็นตัวเลขจำนวนขวด, deduct ผ่าน `POST /standards/:id/deduct { tier, qty }`
2. **ราย-ขวด (StockUnit)** — ขวดจริง 1 ใบ = 1 doc มี `kind: sealed|working`, `source: primary|supply`; เบิก = "แบ่ง" ขวด sealed → สร้างขวดลูก `working` (parent-child) → โผล่แท็บ "Standard ใช้งานอยู่" → แจ้งทิ้งได้

เป้าหมาย redesign:
- Standard มี **3 ประเภทขวด**: `primary` / `supplier` / `working` (เป็น type ของขวดจริง ไม่ใช่ tier ตัวเลข)
- **เลิก parent-child** — ทุกขวดเป็นขวดเดี่ยว, เลือก type ตอนรับเข้า
- **เบิก = หัก mg จริงจากขวด** — เลือกจำนวนน้ำหนัก (GC→3, HPLC→1, custom ได้) กรอก mg จริงทีละน้ำหนัก → หัก mg รวมออกจากขวด
- ปรับกฎ near-empty ให้ตรงตามที่ต้องการ
- ลบแท็บ "Standard ใช้งานอยู่" + ถอด flow "แบ่ง working"
- แจ้งหมด / แจ้งปัญหา (ประสิทธิภาพลดลง) ราย-ขวด

---

## 2. Data model

### 2.1 `StockUnit` (source of truth ราย-ขวด)

**เพิ่ม:**
- `type: 'primary' | 'supplier' | 'working'` — เลือกตอนรับเข้า

**Deprecate (คงฟิลด์ไว้ ไม่ใช้ตรรกะเดิม):**
- `kind` (`sealed`/`working`) — ไม่แบ่ง working แล้ว ทุกขวดปฏิบัติเป็นขวดเดี่ยว
- `parentId` — เลิก parent-child
- `frequencyDue` — ผูกกับ working aliquot เดิม
- `source` (`primary`/`supply`) — ถูกแทนด้วย `type`

**คงไว้ใช้งาน:** `qrId`, `itemCode`, `itemName`, `lotNo`, `exp`, `volume {initial, remaining, unit}` (mg), `status: active|empty|discarded`, `receivedDate`, `discardedAt/By`, `discardReason`, `createdBy`

> **การตัดสินใจ:** repurpose `source`→`type` และ deprecate `kind`/`parentId` แทนการรื้อ schema ใหม่ทั้งหมด — กระทบ migration น้อย, backward-compatible กับ doc เดิม

### 2.2 `StockStandard` (config ต่อสาร)

- **Tier เก่า** (`primary`/`supplier`/`working` แบบ qty) → **เก็บไว้ read-only เป็นอ้างอิง** (ไม่ลบ schema, ไม่มี deduct/receive ผ่าน tier แล้ว, ซ่อนจาก UI ที่ใช้งาน แสดงเป็น "ข้อมูลอ้างอิงเดิม" ได้)
- ใช้งานต่อ: `code`, `name`, `usagePerUseMg` (default mg ต่อน้ำหนัก), `exp`, `storageTemp`, `openShelfLife`

---

## 3. กฎสถานะ / near-empty

ย้ายตรรกะไป helper กลางใหม่ `src/lib/stockStatus.ts` (+ unit test co-located):

| หมวด | out (หมด) | near-empty (ใกล้หมด) | ปกติ |
|---|---|---|---|
| **Standard** | ขวดใช้ได้ = 0 | ขวดใช้ได้ = **1** (ทุก type รวมกัน) | ≥ 2 |
| **สารเคมี (solvent)** | `qty` = 0 | `qty` = **1** | ≥ 2 |
| **เครื่องแก้ว (glassware)** | `qty` = 0 | **ไม่มี** | `qty` ≥ 1 |

- "ขวดใช้ได้" = `status === 'active'` และยังไม่หมดอายุ (`!exp || exp >= now`)
- คงค่า `LOW_STD_QTY = 1`; แก้ตรรกะ solvent ให้ near-empty ที่ `qty === 1` (ปัจจุบัน `< 3`); เอา near-empty ของ glassware ออก (เหลือ out/not-out)
- Standard near-empty นับ **รวมทุก type** (ไม่แยก primary/supplier/working)

---

## 4. หน้า stock-deduction — ฟอร์มเบิก Standard (หัวใจ)

รื้อ `StandardRequisitionDialog` เป็น flow ใหม่ (เลิกเรียก `WithdrawDialog`):

1. **เลือกเครื่อง** — ปุ่ม GC/HPLC (รับ `instruments` ที่มี `group` อยู่แล้วจาก `ANALYSIS_INSTRUMENTS`) → กำหนด default จำนวนน้ำหนัก: `group === 'gc' ? 3 : 1`
2. **เลือก Standard** — ช่องค้นหาแสดง **เฉพาะสารที่มีขวดใช้ได้จริง ≥ 1** (ซ่อนตัวที่ 0 ขวด) แต่ละแถวโชว์ชื่อ + จำนวนขวดต่อ type เช่น `primary 2 · working 1` ← "เปลี่ยน code เป็น stock ที่มี"
3. **เลือกประเภทขวด** — segmented `primary / working / supplier` (เปิดเฉพาะ type ที่มีขวดใช้ได้)
4. **เลือกขวด** ของ type นั้น — default ขวด exp ใกล้สุด (FEFO), เลือกใบอื่นได้; แสดง mg คงเหลือ + exp + lot
5. **จำนวนน้ำหนัก** — default ตามเครื่อง, ปรับจำนวนได้ (custom) → render ช่องกรอก mg จำนวน N ช่อง
6. **กรอก mg จริงแต่ละน้ำหนัก** (N ช่อง เช่น 9.8 / 10.3 / 10.1) → แสดง mg รวม + mg คงเหลือหลังหัก
   - `usagePerUseMg` ของ standard ใช้เป็น **placeholder/hint** ในช่อง mg เท่านั้น (ไม่ prefill ค่าจริง, ผู้ใช้กรอกเอง) — ค่าที่หักคือ mg ที่กรอกจริง
7. **validate** — mg รวม ≤ mg คงเหลือของขวด, ทุกช่อง > 0, ขวด active + ยังไม่ exp
8. **บันทึก** → หัก mg รวม (atomic กัน race) → mg คงเหลือ ≤ 0 → ขวด `status=empty`
9. **log transaction** — mg รวม + breakdown รายน้ำหนัก + เครื่อง + sampleId/หมายเหตุ + ผู้เบิก

### Backend
Extend `POST /units/:qrId/deduct-mg`:
- รับเพิ่ม `weights: number[]` (หัก `sum(weights)`), `instrumentId`, `instrumentName`
- เก็บ breakdown ลง `StockTransaction` (ฟิลด์ใหม่ `weights: [Number]` optional + `instrumentId/Name`) เพื่อ audit/report
- ตรรกะหัก atomic เดิม (`$inc` + `$gte`) คงไว้; ยัง compat กับ payload `{ mg }` แบบเก่า

---

## 5. แจ้งหมด / ขวดมีปัญหา

Reuse `PerformanceDropDialog` แต่ทำงานระดับ **ขวด** (ไม่ใช่ working child):
- Endpoint: ขยาย `POST /units/:qrId/discard` ให้รับ `outcome: 'empty' | 'discard'` (แทน `cascade` ที่ถอดออก)
- **แจ้งหมด** (`outcome: 'empty'`) → `status = empty` + log `action: deduct`/`update` note "แจ้งหมด"
- **แจ้งปัญหา** (`outcome: 'discard'`, ประสิทธิภาพลดลง / ปนเปื้อน / ใช้งานไม่ได้ / อื่นๆ) → `status = discarded` + `discardReason` + log `action: discard`
- เข้าถึงจากเมนู ⋮ ของแต่ละขวดในหน้า Stock (`StandardUnitsPanel` / `UnitsDrawer`)
- ตัด radio "ขอบเขต unit/whole" (parent-child หายแล้ว) — เหลือแค่ขวดใบนั้น

---

## 6. สิ่งที่ลบ/ถอด

- แท็บ **"Standard ใช้งานอยู่"** — ลบ `StandardWorkingPanel`, `StandardUnitList`, `StandardDailyRow`, helper working ใน `standardStatus.ts` (`activeWorkingUnits`, `todayWorkingUnits`) และ `workingUsability` ที่ไม่ใช้แล้ว
- **flow "แบ่ง working"** — ลบ `WithdrawDialog`, `createWorkingFromParent`, `POST /units/:qrId/withdraw`, `computeWorkingLifecycle` (ถ้าไม่มีที่อื่นใช้)
- หน้า `stock-deduction` เหลือ **แท็บเดียว = ประวัติ** (+ ปุ่ม "เบิก stock" ที่ header เดิม)
- Popover เลือก "สารเคมี / Standard" ใน `StockRequisitionButton` คงไว้ (2 path); solvent ยัง qty-only ไม่มี type

> ก่อนลบแต่ละ helper: grep ยืนยันไม่มี consumer อื่น (เช่น dashboard/print) ก่อนถอด

---

## 7. Migration & compatibility

- Script `server/scripts/migrate-stockunits-source-to-type.js` (dry-run + `--commit`):
  - `source: 'primary'` → `type: 'primary'`
  - `source: 'supply'` → `type: 'supplier'`
  - `source: ''`/ว่าง → ตั้ง `type` ตามข้อมูลจริง (default `primary` หรือรอ user เติม)
  - ขวด `kind: 'working'` เดิม (aliquot) → **ตัดสินจากข้อมูลจริง**: ถ้ามีน้อย/ไม่สำคัญ ให้ยุบเป็นขวดเดี่ยว (`type` ตาม parent) หรือ archive
- **ต้องตรวจสภาพ `stockunits` จริงก่อนเขียน migration** (จำนวนขวด, มี `kind:working` ไหม, ค่า `source` ที่มี) — DB จริงอยู่ remote, ตรวจตอนทำ plan/implementation
- tier fields บน `StockStandard` คงไว้ (read-only) — ไม่มี migration
- รัน `npm run seed:export` หลัง migrate เพื่อ backup (กู้คืนได้)

---

## 8. ไฟล์ที่คาดว่าจะแตะ

**Backend**
- `server/models/StockUnit.js` — เพิ่ม `type` enum
- `server/models/StockTransaction.js` — เพิ่ม `weights: [Number]`, `instrumentId/Name` (optional)
- `server/routes/stock.js` — extend `deduct-mg`; ปรับ receive units ให้รับ `type`; ถอด `/withdraw`, `createWorkingFromParent`
- `server/lib/stockSource.js` — เพิ่ม/แทนด้วย validator `type` (primary/supplier/working)
- `server/scripts/migrate-stockunits-source-to-type.js` (ใหม่)

**Frontend**
- `src/types/stock.ts` — `StockUnitItem.type`, ปรับ `StockUnitSource`/`kind` เป็น deprecated
- `src/lib/stockStatus.ts` (ใหม่) — กฎ near-empty/out ทั้ง 3 หมวด + test
- `src/lib/stockUnit.ts` — ตัด logic working/parent-child; `summarizeUnits` นับขวดใช้ได้แบบไม่พึ่ง kind
- `src/components/lis/stock/StandardRequisitionDialog.tsx` — รื้อเป็น flow เบิกน้ำหนัก/mg ใหม่
- `src/components/lis/stock/PerformanceDropDialog.tsx` — ระดับขวด, ตัด scope whole
- `src/components/lis/stock/ReceiveBottlesDialog.tsx` / `ReceiveCart.tsx` — เลือก `type` (3 ค่า) แทน source
- `src/pages/Stock.tsx` — ใช้ `stockStatus.ts`, near-empty solvent = 1, glassware ตัด near-empty, แสดง type ต่อขวด
- `src/pages/StockDeduction.tsx` — เหลือแท็บ history
- `src/lib/api.ts` — `deductMgFromUnit` รับ `weights/instrument`; receive units ส่ง `type`
- **ลบ:** `StandardWorkingPanel.tsx`, `StandardUnitList.tsx`, `StandardDailyRow.tsx`, `WithdrawDialog.tsx` (+ helper working ใน `standardStatus.ts`)

---

## 9. Test plan

- **Unit (Vitest):**
  - `stockStatus.ts` — out/near-empty/ปกติ ทั้ง std (0/1/≥2 ขวด), solvent (0/1/≥2), glassware (0/≥1)
  - default จำนวนน้ำหนักตาม instrument group (gc=3, hplc=1)
  - รวม mg = `sum(weights)`, validate ≤ คงเหลือ
- **Backend (node test):** `deduct-mg` หัก sum ถูก, atomic กัน over-deduct, เก็บ weights breakdown, ขวด→empty ที่ 0
- **Manual E2E (Brave/Playwright):** รับเข้าขวด 3 type → เบิก GC 3 น้ำหนัก → mg คงเหลือลด → เบิกจนหมด→empty→near-empty/out badge → แจ้งปัญหา→discarded → ยืนยันแท็บ "ใช้งานอยู่" หายไป
- `npx tsc -p server` / `tsc -p tsconfig.app.json` + `npm run lint`

---

## 10. Out of scope

- ไม่แตะ solvent/glassware model (ยัง qty-only) นอกจากกฎ near-empty
- ไม่ทำ "เตรียม working จาก primary" (ยกออกตามที่ตกลง — working รับเข้าตรงๆ)
- ไม่แตะ QR label / print pipeline (ใช้ของเดิม)
- ไม่ลบ tier fields ออกจาก DB (read-only reference)
