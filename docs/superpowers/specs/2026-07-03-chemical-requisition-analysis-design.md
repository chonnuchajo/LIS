# เบิกสารเคมี (solvent) ให้เครื่อง — หน้า daily-check/analysis

วันที่: 2026-07-03
สถานะ: Design (อนุมัติแล้ว)
เกี่ยวข้องกับ:
- `2026-06-02-daily-check-rooms-design.md` (Daily Check hub + ห้องวิเคราะห์)
- `2026-06-05-analysis-extraction-daily-check-design.md` (RoomEquipmentCheckPage ห้อง analysis)
- `2026-06-12-stock-multi-receive-cart-design.md` (solvent = qty รวม + สติกเกอร์ QR = `_id`, ไม่เป็น StockUnit)
- `2026-07-03-standard-weighing-lab-testing-design.md` (แนวทางหักสต็อก atomic + log ธุรกรรม)

## 1. เป้าหมาย (Goal)

เพิ่มปุ่ม **"เบิกสารเคมี"** ในหน้า `/daily-check/analysis` (ห้องวิเคราะห์) เพื่อให้ผู้วิเคราะห์บันทึกว่า **เบิกตัวทำละลาย (solvent) ตัวไหนให้เครื่อง GC/HPLC เครื่องไหน** ประจำวัน โดย:

- **log**: เก็บบันทึกว่า solvent × จำนวน → เครื่องไหน, วันไหน, โดยใคร
- **ตัดสต็อก**: หัก `StockSolvent.qty` (หน่วย "ขวด") อัตโนมัติตอนบันทึก พร้อม log ธุรกรรม

ขอบเขต v1 = **solvent เท่านั้น** (ไม่แตะสารมาตรฐาน/StockUnit — สารมาตรฐานมีฟีเจอร์ "ชั่ง standard" ในหน้า lab-testing แยกอยู่แล้ว) และ **ห้อง analysis เท่านั้น** (โครง model รองรับห้องอื่นในอนาคต แต่ยังไม่เปิดปุ่ม)

## 2. บริบทปัจจุบัน (Current State)

- **หน้า analysis** = `RoomEquipmentCheckPage roomSlug="analysis"` (`src/pages/daily-check/RoomEquipmentCheckPage.tsx`) — ปัจจุบันแสดงการ์ด "เช็กการทำงานเครื่องมือ" ต่อ instrument (status + readings) เท่านั้น. Component นี้ใช้ร่วมกับ sample-prep/extraction ด้วย.
- **รายการเครื่อง** ห้อง analysis = 7 เครื่อง (GC ×3, HPLC ×4) จาก `src/lib/analysisInstruments.ts` (`getRoomCatalog("analysis").instruments` — แต่ละตัวมี `id`, `name`, `brand`, `group`).
- **StockSolvent** (`server/models/Stock.js`): `{ name, sizeLiter, qty, price, note }`. `qty` = จำนวนขวดคงคลัง. **ไม่มี** per-bottle QR (ต่างจาก StockUnit ของ standard).
- **สติกเกอร์ solvent**: `buildSolventLabelHtml({ idForQr })` (`src/lib/stockLabel.ts`) — QR encode `_id` ของ StockSolvent เป็น bare string. scanner เดิม `parseScannedQrId(text)` คืน bare id ตรง ๆ → match `solvent._id` ได้.
- **หัก solvent เดิม**: `POST /solvents/:id/deduct { qty, sampleId, note }` (`server/routes/stock.js`) — decrement `qty` (read-modify-save, ไม่ atomic) + `logTransaction` (unit `'bottle'`). ยังไม่มี field เครื่อง.
- **StockTransaction** (`server/models/StockTransaction.js`): audit log กลาง มี `note`, `sampleId`, `unitId`, `qrId` แต่ **ไม่มี** field instrument/machine.
- **Scanner**: `src/components/lis/StockQrScanner.tsx` (`onScanned(qrId)`) — เปิดกล้อง + fallback กรอกมือ, ใช้ซ้ำได้.
- **Soft delete**: convention กลาง (`server/lib/softDelete.js` plugin) — delete ทุกตัวควรใช้ soft delete.
- **seed:export**: dynamic `listCollections()` → collection ใหม่ถูก dump อัตโนมัติ ไม่ต้อง wire เพิ่ม.

## 3. ข้อกำหนด (จากการเก็บ requirement)

1. ปุ่ม "เบิกสารเคมี" ทำ **ทั้ง log และตัดสต็อก**.
2. สารที่เบิก = **solvent เท่านั้น** (StockSolvent).
3. ระบุ solvent ได้ 2 ทาง: **เลือกจาก combobox** หรือ **สแกนบาร์โค้ด** (match `_id`). เลือกอย่างเดียวก็พอ (สแกนเป็นทางลัด).
4. หน่วยที่หัก = **จำนวนขวด** (`qty`), default 1, กันเกินคงเหลือ.
5. ต้องเลือก **เครื่องปลายทาง** (1 ใน 7 เครื่องห้อง analysis).
6. แสดงผลรายการที่เบิก **ทั้งสองแบบ**: การ์ดรวมด้านบน (รายการวันนี้) + ใต้การ์ดแต่ละเครื่อง.
7. ลบ/ยกเลิกรายการที่เบิกผิดได้ → **คืน qty** กลับสต็อก.

## 4. Data Model — `ChemicalRequisition` (ใหม่)

collection แยก + `softDeletePlugin` + timestamps. 1 doc = 1 ครั้งการเบิก (solvent × qty → 1 เครื่อง).

```js
{
  date:           String,   // "YYYY-MM-DD" (local) — group/query รายวัน (เหมือน equipment-check todayStr)
  roomSlug:       String,   // "analysis" (index; เผื่อห้องอื่นในอนาคต)
  instrumentId:   String,   // "LD-004"
  instrumentName: String,   // "GC 8890"
  itemType:       String,   // "solvent" (fix ไว้ก่อน; เผื่อขยาย)
  solventId:      String,   // StockSolvent._id (index)
  solventName:    String,
  qty:            Number,    // จำนวนขวดที่เบิก/หัก
  unit:           String,    // "bottle"
  note:           String,
  requestedBy:    { email: String, name: String },
}
```

- index: `{ roomSlug: 1, date: 1 }` (query หน้า), `{ solventId: 1 }`.
- ไม่มี unique constraint — เบิกซ้ำ solvent เดิม/เครื่องเดิมได้หลายครั้งต่อวัน (แต่ละครั้งเป็นคนละ doc).

## 5. Backend — routes `/chemical-requisitions`

mount แบบ dual (`/api/*` + `/LIS/api/*`) ตาม `mountApi()` เดิม. ไฟล์ `server/routes/chemical-requisitions.js`, register ใน `server/index.js`.

### 5.1 `GET /chemical-requisitions?room=&date=`
- คืนรายการ (soft-delete กรองอัตโนมัติ) `find({ roomSlug: room, date }).sort({ createdAt: -1 })` (ใหม่ก่อน).
- ทั้ง `room` และ `date` optional — ไม่ส่งก็คืนทั้งหมด (แต่หน้าใช้ทั้งคู่เสมอ).

### 5.2 `POST /chemical-requisitions`
body `{ roomSlug, date, instrumentId, instrumentName, solventId, qty, note? }`
1. validate: `qty` เป็นเลข > 0; `solventId`, `instrumentId` ไม่ว่าง.
2. หา StockSolvent ตาม `solventId` → ไม่เจอ = 404.
3. **หัก atomic** (กัน race): `findOneAndUpdate({ _id: solventId, qty: { $gte: amount } }, { $inc: { qty: -amount } }, { new: true })`. คืน null → 400 `"จำนวน stock ไม่พอ"`.
4. `logTransaction({ itemType:'solvent', itemId, itemName, action:'deduct', beforeQty, afterQty, delta:-amount, unit:'bottle', note: "เบิกให้ <instrumentName>" + (note?), ...userMeta(req) })`.
5. สร้าง `ChemicalRequisition` doc (snapshot `solventName`, `instrumentName`, `requestedBy` จาก `userMeta`).
6. คืน `{ requisition, solvent }` (solvent เพื่อ refresh qty ฝั่งหน้า).

> `date` ส่งจาก client (local `todayStr()`) เพื่อให้ตรง timezone เครื่องผู้ใช้; ถ้าไม่ส่ง backend fallback เป็นวันที่ server.

### 5.3 `DELETE /chemical-requisitions/:id`
- หา doc (ที่ยังไม่ soft-deleted) → ไม่เจอ = 404.
- **คืน qty**: `StockSolvent.findByIdAndUpdate(solventId, { $inc: { qty: +doc.qty } })` (ถ้าขวดยังอยู่; ถ้าถูกลบไปแล้วก็ข้ามการคืน แต่ยังลบ record ได้).
- `logTransaction({ action:'receive', delta:+doc.qty, unit:'bottle', note:"ยกเลิกเบิก <instrumentName>", ... })`.
- soft-delete doc (`doc.softDelete?.()` / set `deletedAt` ตาม plugin).
- คืน `{ ok: true }`.

## 6. Frontend

### 6.1 gate เฉพาะ analysis
`RoomEquipmentCheckPage` ใช้ร่วมหลายห้อง → เปิดส่วนเบิกสารเคมีเมื่อ `roomSlug === ANALYSIS_ROOM_SLUG` เท่านั้น (import จาก `analysisInstruments.ts`).

### 6.2 การ์ดรวมด้านบน "เบิกสารเคมีวันนี้"
วางเหนือ grid การ์ดเครื่อง:
- หัวการ์ด + ปุ่ม **"เบิกสารเคมี"** (เปิด dialog แบบไม่ preselect เครื่อง).
- ลิสต์รายการวันนี้ (จาก `GET ?room=analysis&date=todayStr()`): แต่ละแถว `เวลา · solventName × qty ขวด · → instrumentName · โดย requestedBy.name` + ปุ่มลบ (x) → `DELETE` + ยืนยัน.
- ว่าง → ข้อความ "ยังไม่มีการเบิกวันนี้".

### 6.3 ใต้การ์ดแต่ละเครื่อง
ใน card ของ instrument (ในลูป `groups.map`): เพิ่มบล็อกเล็กแสดง solvent ที่เบิกให้เครื่องนั้นวันนี้ (filter `req.instrumentId === instrument.id`) + ปุ่มเล็ก **"เบิกให้เครื่องนี้"** → เปิด dialog พร้อม preselect `instrument`.

### 6.4 `ChemicalRequisitionDialog` (component ใหม่)
props: `{ roomSlug, instruments, presetInstrumentId?, onClose, onSaved }`
- **เลือกเครื่อง**: dropdown/combobox จาก `instruments` (preselect ถ้ามี `presetInstrumentId`).
- **เลือก solvent**: combobox (`GET /solvents`) แสดง `name` + qty คงเหลือ; + ปุ่ม **"สแกน"** เปิด `StockQrScanner` → `onScanned(id)` → หา `solvent._id === id` → set ให้; ไม่เจอ → toast "ไม่พบสารเคมีจาก QR นี้".
- **จำนวน (ขวด)**: Input number, default 1, min 1, เตือน/disable ถ้าเกิน qty คงเหลือ.
- **หมายเหตุ**: optional.
- ปุ่มบันทึก → `POST /chemical-requisitions` → toast สำเร็จ → `invalidateQueries(["chemical-requisitions"], ["stock","solvents"], ["stock","transactions"])` → ปิด dialog.
- read-only/disabled ระหว่าง pending.

### 6.5 API layer (`src/lib/api.ts`)
เพิ่ม: `getChemicalRequisitions({room, date})`, `createChemicalRequisition(body)`, `deleteChemicalRequisition(id)`.

## 7. Logic แยก (pure, unit-test ได้)
`src/lib/chemicalRequisition.ts`:
- `todayStr()` (reuse pattern เดิม — หรือ import จาก util กลางถ้ามี).
- `groupRequisitionsByInstrument(reqs): Record<instrumentId, Requisition[]>` — สำหรับ 6.3.
- `sumQtyBySolvent(reqs)` (optional, เผื่อสรุป) — v1 อาจยังไม่ใช้.

## 8. Edge cases
- **สแกนขวด standard (ไม่ใช่ solvent)** → id ไม่ match solvent list → toast แจ้ง ไม่เลือกให้.
- **สต็อกไม่พอ** → backend 400 (server-authoritative) + client ปิดปุ่มเมื่อ qty > คงเหลือ.
- **race 2 คนเบิกพร้อมกัน** → atomic `$inc` เงื่อนไข `$gte` กันติดลบ.
- **ลบรายการหลัง solvent ถูกลบ (soft-deleted)** → ข้ามการคืน qty แต่ยังลบ record ได้ (ไม่ error).
- **qty คงเหลือ = 0** → solvent ยังเลือกได้แต่กรอก qty ไม่ได้ (ปุ่มบันทึก disabled) + แสดง "คงเหลือ 0".
- **เปลี่ยนวัน (ข้ามเที่ยงคืน)** → `date` ยึด local ตอนกดเปิด/บันทึก; รายการเมื่อวานไม่โผล่วันนี้.

## 9. Permissions
- โรลที่เข้า `/daily-check/*` ได้ (Lab) ต้องเรียก `GET /solvents`, `/chemical-requisitions` (GET/POST/DELETE) ได้. ตรวจ path/สิทธิ์โรล Lab — ถ้าไม่ครอบ เพิ่ม path ให้ (backend routes เปิดตาม auth กลางเหมือน route stock อื่น).

## 10. Testing
- **Vitest**: `groupRequisitionsByInstrument` (group ถูกกลุ่ม, instrument ไม่มีรายการ → ว่าง); validate qty (≤0 invalid, > คงเหลือ = เตือน).
- **Backend**: POST หัก atomic (afterQty ถูก, ไม่พอ → 400, สร้าง requisition + tx log); DELETE คืน qty + soft-delete + tx log `receive`; GET filter room+date.
- **Manual E2E** (เครื่อง user): เปิด analysis → เบิก solvent A ×2 ให้ GC 8890 → qty solvent ลด 2 + โผล่ทั้งการ์ดรวมและใต้การ์ด GC 8890 + tx log; ลบรายการ → qty คืน; สแกนบาร์โค้ด solvent → เลือกให้อัตโนมัติ; เบิกเกินคงเหลือ → บล็อก.

## 11. Non-goals / ข้อสมมติ
- solvent ไม่ track ปริมาตรรายขวด — หักเป็น "ขวด" เท่านั้น (ตามที่ตกลง).
- ไม่แตะสารมาตรฐาน/StockUnit/QC.
- ห้องอื่น (sample-prep/extraction) ยังไม่เปิดปุ่ม (model + endpoint รองรับด้วย `roomSlug` แล้ว).
- ไม่ผูกกับ petition/sample (เป็น log เซ็ตเครื่องประจำวัน ไม่ใช่การทดสอบรายตัวอย่าง).
- ไม่ปริ้นลาเบล/เอกสารจากการเบิก (เป็นแค่ log + ตัดสต็อก).
