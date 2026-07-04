# เบิก Standard บนหน้า "เบิก stock" (working + คุมความถี่ + แจ้งประสิทธิภาพลดลง)

วันที่: 2026-07-04
สถานะ: Design (อนุมัติแล้ว)
แนวทาง: **A — ต่อยอดกลไก `StockUnit`/withdraw/discard เดิม** (ไม่สร้าง model ใหม่)
เกี่ยวข้องกับ:
- `2026-07-04-stock-requisition-page-tabs-design.md` (หน้า "เบิก stock" 2 แท็บ — v1 เบิก solvent อย่างเดียว)
- `2026-07-04-standard-weighing-removal` (การลบฟีเจอร์ "ชั่ง Standard" — ทำให้ `createWorkingFromParent` กลายเป็น dead code)

## 1. เป้าหมาย (Goal)

หน้า **"เบิก stock"** (`/stock-deduction`, แท็บ "เบิก stock") ปัจจุบันเบิกได้แค่ **สารเคมี (solvent)**. งานนี้เพิ่มการ **เบิก Standard** เข้าไปในแท็บเดียวกัน โดย:

1. **ปุ่มเดียว "+ เบิก stock" → chooser** ให้เลือกก่อนว่าเบิก **สารเคมี** หรือ **Standard** แล้วค่อยเปิด dialog ที่ตรงหมวด
2. **เบิก Standard = ทำงานกับ working**: เลือก standard → ระบบเช็ค working ที่มี → ถ้ามีตัวที่ **ยังใช้ได้** ให้ reuse; ถ้าไม่มีก็ **แบ่ง working ใหม่** จากขวด sealed
3. **คุม "หมดความถี่"**: working แต่ละตัวดู 2 ค่าแยกกัน — **ครบกำหนดความถี่** (`frequencyDue`) และ **หมดอายุจริง** (`exp`); เกินอันใดอันหนึ่ง = ห้ามใช้
4. **แจ้งประสิทธิภาพลดลง**: ปุ่มบน working → เลือกขอบเขตทิ้ง **working ตัวนี้** หรือ **ทั้งขวด** (ขวดแม่ sealed + working ลูกทุกตัว)

## 2. บริบทปัจจุบัน (Current State)

### 2.1 หน้า / UI
- **`src/pages/StockDeduction.tsx`** — 2 แท็บ: `"requisition"` render `<ChemicalRequisitionPanel roomSlug={ANALYSIS_ROOM_SLUG} instruments={analysisInstruments} />`, `"history"` = ตารางประวัติ (`getStockTransactions`).
- **`src/components/lis/ChemicalRequisitionPanel.tsx`** — การ์ด "เบิกสารเคมีวันนี้": ปุ่ม "เบิกสารเคมี" (หัวการ์ด) เปิด `ChemicalRequisitionDialog` + list วันนี้ + ปุ่มลบ (คืนสต็อก). query `["chemical-requisitions", roomSlug, todayStr()]`.
- **`src/components/lis/stock/WithdrawDialog.tsx`** — "แบ่งใช้ → working" (รับ `qrId` ของขวด sealed, กรอก ml → `api.withdrawStockUnit` → ปริ้นลาเบล working). มี guard: sealed เท่านั้น / ไม่ discarded / ไม่ empty / ไม่ expired.
- **`src/components/lis/stock/DiscardDialog.tsx`** — "ทิ้งขวด" (รับ `qrId` + เหตุผล → `api.discardStockUnit`). ทิ้งตัวเดียว.
- **`src/pages/StockUnitScanPage.tsx`** — สแกน QR ขวด → การ์ดข้อมูล → ปุ่ม "แบ่งใช้ → working" (ถ้า sealed+active) / "ทิ้งขวด".
- **`src/components/lis/stock/StandardUnitsPanel.tsx`** — ตารางขวดรายตัวของ standard (tree: sealed=root, working=ลูก) — มีปุ่ม เพิ่มขวด/แก้/ปริ้นซ้ำ **แต่ยังไม่มี** แบ่ง/ทิ้งในตารางนี้.

### 2.2 Model
- **`server/models/StockUnit.js`** — `kind: 'sealed'|'working'`, `source`, `parentId`, `lotNo`, `exp: Date`, `volume {initial,remaining,unit}`, `status: 'active'|'empty'|'discarded'`, `withdrawnDate`, `discardedAt/By`, `discardReason`, `createdBy`. **ยังไม่มี `frequencyDue`**.
- **`server/models/Stock.js` → `StockStandard`** — `code`, `name`, tiers `primary/supplier/working`, `frequency: String` (เช่น `"1/1 week"`), `openShelfLife: {value, unit}`, `usagePerUseMg`, ฯลฯ.
- **`src/types/stock.ts` → `StockUnitItem`** — mirror ของ model ฝั่ง FE (ยังไม่มี `frequencyDue`).

### 2.3 Backend routes (`server/routes/stock.js`)
- `POST /units/:qrId/withdraw { ml, note? }` (บรรทัด 390) — หัก `volume.remaining` ของ sealed แบบ atomic (กัน race), สร้าง working (`exp = workingExpForWithdraw(now, std.frequency, shelf, parent.exp)`), log `action:'withdraw'` itemType `standard`, คืน `{parent, working}`.
- `POST /units/:qrId/discard { reason? }` (บรรทัด 457) — set `status='discarded'` + discardedAt/By/Reason, log `action:'discard'`. **ทิ้งตัวเดียว ไม่ cascade**.
- `GET /units?itemCode=&status=&kind=` — list units.
- `GET /units/:qrId`, `PATCH /units/:qrId`, `POST /units/:qrId/reprint` ฯลฯ.
- **`workingExpForWithdraw(withdrawnAt, frequency, shelf, parentExp)`** (บรรทัด 40) — ปัจจุบัน: มี frequency → `withdraw + openShelfLife`; ไม่มี → เที่ยงคืนวันถัดไป; cap ที่ EXP ขวดแม่. **frequency เป็นแค่สวิตช์เปิด/ปิด ไม่ได้ใช้ค่าช่วงจริง** → นี่คือจุดที่ต้องแยก.
- **`createWorkingFromParent(parentUnit, meta, req)`** (บรรทัด 126) + `router.createWorkingFromParent = ...` (บรรทัด 826) — **dead code**: ผู้เรียกเดียวคือฟีเจอร์ "ชั่ง Standard" ที่ถูกลบไปแล้ว (grep เจอแค่ definition/export + doc เก่า).

### 2.4 Frontend helper (`src/lib/stockUnit.ts`)
- `workingExpForWithdraw(...)` — mirror ของฝั่ง server (ตาม comment "mirror ของ ...").
- `unitDerivedStatus(u, now)` → `'active'|'empty'|'discarded'|'expired'` (expired เมื่อ `exp < now`).
- `buildUnitTree`, `summarizeUnits` ฯลฯ.

### 2.5 helper ความถี่ (`src/lib/standardFrequency.ts`)
- `parseFrequency("1/2 month")` → `{count: 2, unit: 'month'}` (**denominator = ช่วง**; "1/2 month" = ทุก 2 เดือน). `FREQUENCY_UNITS = ['day','week','month']`.

## 3. ข้อกำหนด (จากการเก็บ requirement)

| # | ข้อกำหนด | ที่มา |
|---|----------|-------|
| R1 | หน้า "เบิก stock" มีปุ่มเดียว "+ เบิก stock" → chooser (สารเคมี / Standard) → dialog ที่ตรงหมวด | ผู้ใช้เลือก "ปุ่มเดียว → เลือกทีหลัง" |
| R2 | เบิก standard: เลือก standard → เช็ค working ที่มี → **reuse** ตัวที่ยังใช้ได้ หรือ **แบ่ง working ใหม่** จากขวด sealed | ผู้ใช้เลือก "เช็ค working ก่อน → reuse/แบ่งใหม่" |
| R3 | **บันทึกเฉพาะตอนแบ่งใหม่** (reuse working เดิมไม่สร้าง record ใหม่ — ใช้ log `withdraw` เดิม) | ผู้ใช้เลือก "บันทึกเฉพาะตอนแบ่งใหม่" |
| R4 | "หมดความถี่/ห้ามใช้" แยก **2 ค่า**: `frequencyDue` (ครบกำหนดเติมความถี่) + `exp` (หมดอายุจริง); เกินอันใดอันหนึ่ง = ห้ามใช้ | ผู้ใช้เลือก "แยก 2 ค่า" |
| R5 | "แจ้งประสิทธิภาพลดลง" ให้เลือกขอบเขต: **working นี้** หรือ **ทั้งขวด** (ขวดแม่ + working ลูกทุกตัว) + เหตุผล | ผู้ใช้เลือก "เลือกได้: working / ทั้งขวด" |
| R6 | ฝั่งสารเคมี (solvent) ต้องทำงานเหมือนเดิมทุกอย่าง | non-regression |

## 4. โครงสร้างที่เสนอ

### 4.1 หน้า/แท็บ — chooser (R1)

**ใหม่ `src/components/lis/StockRequisitionTab.tsx`** — แทน `<ChemicalRequisitionPanel/>` ในแท็บ "requisition" ของ `StockDeduction.tsx`:
- **ด้านบน**: ปุ่มเดียว **"+ เบิก stock"** → เปิด chooser (Popover หรือ Dialog เล็ก 2 ตัวเลือก **สารเคมี** / **Standard**):
  - เลือก "สารเคมี" → เปิด `ChemicalRequisitionDialog` (props เดิม: `roomSlug`, `instruments`).
  - เลือก "Standard" → เปิด `StandardRequisitionDialog` (ใหม่).
- **ด้านล่าง**: 2 การ์ดรายการวันนี้ (stack):
  - **"สารเคมีที่เบิกวันนี้"** — ย้าย list/ลบ ของ `ChemicalRequisitionPanel` มา (ดู 4.1.1).
  - **"Standard ที่แบ่งวันนี้"** — working ที่ `kind='working'` และ `withdrawnDate` = วันนี้ (query `getStockUnits` แล้ว filter ฝั่ง client ด้วย `todayStr`, หรือกรองจาก transactions `action:'withdraw'` itemType `standard` วันนี้). แต่ละแถวโชว์: เวลา · standard name · lotNo · ml · โดยใคร · ปุ่ม "แจ้งประสิทธิภาพลดลง/ทิ้ง".

#### 4.1.1 ปรับ `ChemicalRequisitionPanel`
- **ถอดปุ่ม "เบิกสารเคมี" ที่หัวการ์ดออก** (ปุ่มเบิกย้ายไป chooser ระดับ `StockRequisitionTab`). เหลือแค่หัวข้อ + list + ปุ่มลบ (คืนสต็อก).
- เปิด dialog เบิกสารเคมีจาก `StockRequisitionTab` ผ่าน chooser แทน. `ChemicalRequisitionDialog` เดิมไม่แตะ.
- (ทางเลือกเทียบเท่า: คง `ChemicalRequisitionPanel` ไว้ทั้งก้อนแล้วซ่อนปุ่มด้วย prop `hideAddButton` — implementation plan เลือกวิธีที่ diff เล็กสุด.)

### 4.2 `StandardRequisitionDialog` (R2, R3) — `src/components/lis/stock/StandardRequisitionDialog.tsx`

**State/flow**:
1. **เลือก standard** — combobox จาก `api.getStandards()` (แสดง `name` + `code`, ค้นหาได้) + ปุ่ม **สแกน QR** ขวด (`StockQrScanner` → `parseScannedQrId` → `getStockUnit(qrId)` → resolve `itemCode` → preselect standard นั้น + จำ qrId ไว้ preselect ขวด sealed ตอนแบ่ง).
2. เมื่อเลือก standard แล้ว → query `["stock","units", code]` (`api.getStockUnits({itemCode: code})`) แล้วแบ่งเป็น:
   - **working list** (`kind='working'`, ไม่ discarded) — แต่ละตัวคำนวณ `workingUsability` (ดู 4.3):
     - `active` (ยังไม่ครบความถี่ & ยังไม่ EXP) → badge เขียว + ปุ่ม **"ใช้อันนี้"**.
     - `freqDue` → badge เหลือง "หมดความถี่" (ใช้ไม่ได้) + ปุ่ม "แจ้งประสิทธิภาพลดลง/ทิ้ง".
     - `expired` → badge ส้ม "หมดอายุ" (ใช้ไม่ได้) + ปุ่มทิ้ง.
   - **sealed list** (`kind='sealed'`, `active`, ไม่ expired) — ใช้ตอน "แบ่งใหม่".
3. **"ใช้อันนี้"** (reuse) → ปิด dialog + toast `ใช้ working <label> (ยังไม่ครบความถี่)`. **ไม่มี DB write** (R3). onSaved() ไม่ต้อง invalidate อะไร (แต่เรียกได้ไม่เสียหาย).
4. **"+ แบ่ง working ใหม่"** → เลือกขวด sealed (default = EXP ใกล้สุด/**FEFO** จาก sealed list; เลือกเองได้) → กรอก ml → `api.withdrawStockUnit(sealedQrId, {ml, note})` → ปริ้นลาเบล working (reuse logic จาก `WithdrawDialog`: `buildStockLabelHtml` + `printDocument`) → toast + `onSaved` (invalidate `["stock","units",code]`, `["stock","transactions"]`) → refresh working list (อยู่ใน dialog ต่อ หรือปิด — ปิดหลังแบ่งสำเร็จ).
   - **หมายเหตุ reuse กลไก**: อาจ mount `WithdrawDialog` ซ้อน (ส่ง `qrId` ของ sealed ที่เลือก) แทนเขียน form แบ่งใหม่เอง — ลด duplication. Implementation plan ตัดสิน.
5. ปุ่ม **"แจ้งประสิทธิภาพลดลง"** บน working row → เปิด `PerformanceDropDialog` (4.4).

> **ไม่มี valid working และไม่มี sealed ที่แบ่งได้** → ข้อความ "ไม่มีขวด standard นี้ที่แบ่งได้ — ไปเพิ่มขวดที่หน้า Stock" (ไม่ auto-fix).

### 4.3 โมเดล: แยก `frequencyDue` ออกจาก `exp` (R4)

#### 4.3.1 Schema
- **`server/models/StockUnit.js`**: เพิ่ม `frequencyDue: { type: Date, default: null }`.
- **`src/types/stock.ts` → `StockUnitItem`**: เพิ่ม `frequencyDue?: string | null`.

#### 4.3.2 คำนวณตอนแบ่ง (server + FE mirror)
แทน `workingExpForWithdraw` (คืนค่าเดียว) ด้วยฟังก์ชันที่คืน **2 ค่า** — เสนอชื่อ **`computeWorkingLifecycle({ withdrawnAt, frequency, shelf, parentExp })` → `{ exp, frequencyDue }`**:
- **`exp` (หมดอายุจริง)** = `withdrawnAt + openShelfLife`, cap ที่ `parentExp`. ถ้า `openShelfLife.value <= 0` (ไม่ตั้ง) → `exp = parentExp` (working ไม่อยู่เกินขวดแม่; ไม่มี hard-exp แยก).
- **`frequencyDue` (ครบกำหนดความถี่)** = `withdrawnAt + ช่วง frequency` (`parseFrequency(frequency)` → `addInterval(count, unit)`), cap ที่ `parentExp`. ถ้า parse ไม่ได้/ไม่มี frequency → `null` (ไม่มีข้อจำกัดความถี่).
- ทำ **ทั้ง 2 ฝั่งให้ตรงกัน**: `server/routes/stock.js` + `src/lib/stockUnit.ts` (คง comment "mirror").
- **withdraw route** (บรรทัด 390): set ทั้ง `exp` และ `frequencyDue` บน working ที่สร้าง.
- **`createWorkingFromParent`** (dead code): อัปเดตให้ set `frequencyDue` ด้วยเพื่อความสม่ำเสมอ **หรือ** ลบทิ้ง (มันตายแล้ว) — implementation plan เลือก; ถ้าเก็บไว้ต้องไม่ให้ค่า `exp` เพี้ยนจากเดิมโดยไม่ได้ตั้งใจ.

#### 4.3.3 สถานะการใช้งาน `workingUsability` (FE, `src/lib/stockUnit.ts`)
ฟังก์ชันใหม่ (pure, มี test):
```
workingUsability(u: {status; exp?; frequencyDue?}, now = new Date())
  : 'active' | 'freqDue' | 'expired' | 'empty' | 'discarded'
```
ลำดับ: `discarded` → `empty` → (`exp && now >= exp` → `expired`) → (`frequencyDue && now >= frequencyDue` → `freqDue`) → `active`.
- **ไม่แก้ `unitDerivedStatus` เดิม** (กันกระทบ solvent/sealed/ตารางอื่น) — `workingUsability` เป็นฟังก์ชันเสริม ใช้เฉพาะจุดที่โชว์ working ของ standard.
- เพิ่ม badge/สี ของ `freqDue` (เหลือง "หมดความถี่") ในที่ที่ render working ของ standard (dialog + ถ้าเผื่อใน `StandardUnitsPanel`).

### 4.4 ทิ้ง / แจ้งประสิทธิภาพลดลง — cascade (R5)

#### 4.4.1 Backend
ขยาย `POST /units/:qrId/discard` รับ body เพิ่ม **`cascade?: boolean`**:
- `cascade` ไม่ set / false → พฤติกรรมเดิม (ทิ้งตัวเดียว).
- `cascade = true` → หา **root**: ถ้า unit เป็น `working` และมี `parentId` → root = ขวดแม่; ไม่งั้น root = ตัวเอง. แล้วทิ้ง **root + working ลูกทุกตัว** (`StockUnit.find({ parentId: root._id })`) ที่ยังไม่ `discarded`. set discardedAt/By/Reason ให้ทุกตัว + log `action:'discard'` ต่อตัว (reason เดียวกัน).
- คืน `{ discarded: [qrId...] }` หรือ unit ราก (ให้ FE invalidate).
- **atomicity**: ลูปทิ้งทีละตัว (ยอมรับ non-atomic แบบเดียวกับที่ระบบใช้ที่อื่น เช่น receive-cart); ถ้าล้มกลางคันแจ้ง error พร้อมรายการที่ทิ้งไปแล้ว.

#### 4.4.2 Frontend — `src/components/lis/stock/PerformanceDropDialog.tsx`
- props `{ unit: StockUnitItem, onClose, onSaved }`.
- radio **ขอบเขต**: `"unit"` (ทิ้งเฉพาะ working นี้) / `"whole"` (ทั้งขวด — ขวดแม่ + working ทุกตัว).
- ช่อง **เหตุผล** prefill `"ประสิทธิภาพลดลง"` (แก้ได้).
- เรียก `api.discardStockUnit(unit.qrId, { reason, cascade: scope === 'whole' })` → toast → `onSaved`.
- **ไม่แตะ `DiscardDialog` เดิม** (ยังใช้ที่ `Stock.tsx`/`StockUnitScanPage.tsx` แบบทิ้งตัวเดียว).
- `api.discardStockUnit` (`src/lib/api.ts`) — ขยาย type body เป็น `{ reason?: string; cascade?: boolean }`.

## 5. Data flow สรุป

```
[+ เบิก stock] ──chooser──> สารเคมี → ChemicalRequisitionDialog (เดิม)
                            Standard → StandardRequisitionDialog
                                         ├─ เลือก standard → getStockUnits(itemCode)
                                         │    ├─ working active → [ใช้อันนี้] (ไม่ log)
                                         │    ├─ working freqDue/expired → ⚠ + [แจ้งประสิทธิภาพลดลง]
                                         │    └─ [+ แบ่ง working ใหม่] → เลือก sealed (FEFO)
                                         │           → withdrawStockUnit → working ใหม่
                                         │             (set exp + frequencyDue) + log + ปริ้นลาเบล
                                         └─ [แจ้งประสิทธิภาพลดลง] → PerformanceDropDialog
                                                → discard {cascade} → (working เดียว | ทั้งขวด)
```

## 6. Edge cases
- **working เก่า (ก่อนฟีเจอร์นี้)** ไม่มี `frequencyDue` → `workingUsability` คุมด้วย `exp` อย่างเดียว (ไม่ freqDue). ยอมรับได้ (ไม่ backfill).
- **standard ไม่มี `frequency`** → working ที่แบ่งใหม่ `frequencyDue = null` → ไม่มีสถานะ freqDue (คุมด้วย exp เท่านั้น) — ตรงกับ "ไม่มีความถี่".
- **`openShelfLife` = 0/ไม่ตั้ง** → `exp = parentExp` (working หมดอายุพร้อมขวดแม่).
- **`frequencyDue > exp`** (ความถี่ยาวกว่าอายุ) → เจอ `expired` ก่อน (ลำดับใน `workingUsability` เช็ค exp ก่อน) — ถูกต้อง.
- **แบ่งจากขวด sealed ที่ EXP < now** → withdraw route มี guard อยู่แล้ว (บรรทัด 400) block.
- **cascade บน working ที่ parent ถูกทิ้งไปแล้ว** → root (parent) `discarded` แล้ว → ข้ามตัวที่ discarded, ทิ้งเฉพาะที่ยังไม่ทิ้ง (idempotent-ish).
- **สแกน QR ที่เป็น working (ไม่ใช่ sealed)** ใน StandardRequisitionDialog → resolve standard ได้ แต่ preselect ขวดแบ่งไม่ได้ (แบ่งจาก sealed เท่านั้น) → แค่โชว์ working list ตามปกติ.
- **ฝั่งสารเคมี** — path เดิม, dialog เดิม, query เดิม → ต้องไม่ regress (R6).

## 7. Testing

### 7.1 Vitest (pure helper ใหม่ — `src/lib/stockUnit.test.ts`)
- `computeWorkingLifecycle`: มี frequency+shelf → exp & frequencyDue ถูก, cap ที่ parentExp, ไม่มี frequency → frequencyDue null, shelf 0 → exp = parentExp.
- `workingUsability`: active / freqDue (เกิน frequencyDue แต่ยังไม่ exp) / expired (เกิน exp) / discarded / empty; ลำดับ exp มาก่อน freqDue.
- (ถ้าแยก) `resolveCascadeRoot` / target list — resolve parent ของ working, list ลูกที่ยังไม่ discarded.
- ต้องมี test ฝั่ง server mirror ถ้ามี helper JS แยก (`server/routes/stock.js` inline — อาจ extract ไป `server/lib/` เพื่อ test ได้ หรือทดสอบผ่าน route).

### 7.2 Type-check
- `npx tsc -p tsconfig.app.json --noEmit` (ตาม memory: root `tsc --noEmit` เป็น no-op) — ต้องไม่มี error ใหม่.

### 7.3 Lint
- `npm run lint` เขียว.

### 7.4 Manual E2E (เครื่อง user)
1. หน้า "เบิก stock" → ปุ่ม "+ เบิก stock" → chooser 2 ตัวเลือกขึ้น.
2. เลือก **สารเคมี** → เบิก solvent ได้เหมือนเดิม + โผล่ใน "สารเคมีที่เบิกวันนี้" + "ประวัติ" + ลบคืนสต็อกได้ (R6).
3. เลือก **Standard X** (ยังไม่มี working) → "+ แบ่ง working ใหม่" → เลือกขวด sealed (FEFO) → ml → working ใหม่ + ปริ้นลาเบล + โผล่ใน "Standard ที่แบ่งวันนี้".
4. เปิดเบิก Standard X อีกครั้ง → เห็น working เมื่อกี้เป็น **"ยังใช้ได้"** + ปุ่ม "ใช้อันนี้" (กดแล้วปิด + toast, ไม่มี record ใหม่ใน "ประวัติ").
5. ตั้ง frequency สั้น (เช่นเลื่อนเวลา/ทดสอบ) → working กลายเป็น **⚠ หมดความถี่**, ไม่มีปุ่ม "ใช้อันนี้".
6. **แจ้งประสิทธิภาพลดลง** บน working → scope "working นี้" → ทิ้งเฉพาะตัวนั้น (ขวดแม่ยังอยู่); scope "ทั้งขวด" → ขวดแม่ + working ทุกตัวหาย (เช็คในตาราง `StandardUnitsPanel`/units).
7. แท็บ "ประวัติ" เห็น `withdraw` (ตอนแบ่งใหม่) และ `discard` — ไม่เห็น event ตอน "ใช้อันนี้".

## 8. Non-goals / ข้อสมมติ
- **ไม่สร้าง model/endpoint ใหม่** สำหรับ standard requisition — ใช้ `StockUnit` + withdraw/discard เดิม (แนวทาง A).
- **ไม่ backfill** `frequencyDue` ให้ working เก่า.
- **reuse working ไม่ log** (R3) — ไม่มีการนับ "จำนวนครั้งใช้/usesPerBottle" ในงานนี้.
- ไม่ผูกการเบิก standard กับ sample/petition/instrument (ต่างจากฝั่งสารเคมีที่เลือกเครื่อง) — เบิกระดับ standard ล้วน.
- ไม่แตะแท็บ "ประวัติ" (โชว์ทุก transaction อยู่แล้ว รวม standard withdraw/discard).
- ไม่ rename path `/stock-deduction`.
- ไม่แก้หน้า `StockUnitScanPage`/`Stock.tsx`/`DiscardDialog` เดิม (นอกจาก `api.discardStockUnit` type ที่ backward-compatible).
