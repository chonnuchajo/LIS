# เปลี่ยน "การบันทึก Standard" → "การเบิก stock" (2 แท็บ) + ย้ายการเบิกสารเคมีออกจากห้องวิเคราะห์

วันที่: 2026-07-04
สถานะ: Design (อนุมัติแล้ว)
เกี่ยวข้องกับ:
- `2026-07-03-chemical-requisition-analysis-design.md` (ฟีเจอร์เบิกสารเคมี solvent ที่ถูกย้าย)
- `2026-06-02-daily-check-rooms-design.md` (Daily Check hub + ห้องวิเคราะห์)

## 1. เป้าหมาย (Goal)

1. **เปลี่ยนชื่อ** เมนู/หน้า `"การบันทึก Standard"` (path `/stock-deduction`) เป็น **`"การเบิก stock"`** และทำเป็นหน้า **2 แท็บ**:
   - **"เบิก stock"** — UI เบิกสารเคมี (solvent) ที่ย้ายมาจากห้องวิเคราะห์
   - **"ประวัติ"** — ตารางประวัติการตัด stock เดิม (ของหน้า `StockDeduction` ปัจจุบัน)
2. **ถอด** ส่วน "เบิกสารเคมี" ออกจากหน้า `/daily-check/analysis` (ห้องวิเคราะห์) ให้เหลือแค่ "เช็กการทำงานเครื่องมือ" ล้วน

เป็นงาน **ย้ายที่ + เปลี่ยนชื่อ + จัดแท็บ** เป็นหลัก — **ไม่แตะ backend/model** (`chemical-requisitions`, `StockTransaction`), ไม่ migrate ข้อมูล

## 2. บริบทปัจจุบัน (Current State)

- **Nav** (`src/lib/navItems.ts:38`): `{ icon: ClipboardList, label: "การบันทึก Standard", path: "/stock-deduction" }`.
- **หน้า `/stock-deduction`** (`src/pages/StockDeduction.tsx`): ปัจจุบันเป็น **ตารางประวัติอย่างเดียว** ("ประวัติการตัด Stock") — query `api.getStockTransactions({ action:"deduct", itemType })` + filter หมวด (standard/solvent/glassware) ผ่าน `DataTable`. ครอบด้วย `AppLayout` + `PageHeader`.
- **เบิกสารเคมี** อยู่ใน `src/pages/daily-check/RoomEquipmentCheckPage.tsx` (ใช้ร่วมหลายห้อง) gate ด้วย `isAnalysis = roomSlug === ANALYSIS_ROOM_SLUG`:
  - การ์ดบน "เบิกสารเคมีวันนี้" (บรรทัด ~222–271): ปุ่ม "เบิกสารเคมี" เปิด `ChemicalRequisitionDialog` (ไม่ preselect เครื่อง) + list รายการวันนี้ + ปุ่มลบ (คืนสต็อก).
  - บล็อกใต้การ์ดแต่ละเครื่อง "สารเคมีที่เบิกวันนี้" (บรรทัด ~410–439): ปุ่ม "เบิกให้เครื่องนี้" (preselect instrument) + mini-list.
  - state/query/mutation: `reqDialog`, query `["chemical-requisitions", roomSlug, reqTodayStr()]`, `reqByInstrument = groupRequisitionsByInstrument(...)`, `deleteReqMutation`, `onReqSaved`, และ render `<ChemicalRequisitionDialog/>` ท้ายไฟล์.
- **`ChemicalRequisitionDialog`** (`src/components/lis/daily-check/ChemicalRequisitionDialog.tsx`): props `{ roomSlug, instruments: {id,name}[], presetInstrumentId?, onClose, onSaved }` — เลือกเครื่อง + เลือก/สแกน solvent + จำนวนขวด + POST `chemical-requisitions`.
- **API** (`src/lib/api.ts`): `getChemicalRequisitions({room,date})`, `createChemicalRequisition`, `deleteChemicalRequisition`, `getStockTransactions(...)` มีครบแล้ว.
- **instrument list ห้อง analysis**: `getRoomCatalog("analysis").instruments` (`src/lib/roomEquipment.ts` / `analysisInstruments.ts`) — GC ×3, HPLC ×4 (แต่ละตัวมี `id`, `name`). `ANALYSIS_ROOM_SLUG` จาก `analysisInstruments.ts`.
- **helper** `groupRequisitionsByInstrument`, `todayStr` อยู่ใน `src/lib/chemicalRequisition.ts`.
- **Tabs primitive**: shadcn `@/components/ui/tabs` มีในโปรเจกต์.

## 3. ข้อกำหนด (จากการเก็บ requirement)

1. เปลี่ยน label เมนูเป็น "การเบิก stock" — **คง path `/stock-deduction` เดิม** (ไม่ให้กระทบ access-control / bookmark).
2. หน้ามี 2 แท็บ: **"เบิก stock"** (default) และ **"ประวัติ"**.
3. แท็บ "เบิก stock" = ฟีเจอร์เบิกสารเคมีเดิมที่ย้ายมา — **ยังเลือกเครื่องปลายทาง** (GC/HPLC ห้องวิเคราะห์) อยู่ (ยืนยันจากผู้ใช้).
4. แท็บ "ประวัติ" = ตารางประวัติการตัด stock เดิมทั้งชุด (ทุกหมวด).
5. ห้องวิเคราะห์ (`/daily-check/analysis`) **ไม่มี** ส่วนเบิกสารเคมีอีกต่อไป — เหลือแค่เช็กเครื่อง.
6. v1 แท็บ "เบิก stock" = **solvent (สารเคมี) อย่างเดียว** (ตามของเดิม; ไม่รวม standard/glassware).
7. ไม่แตะ backend/model/ข้อมูล — `roomSlug` ของ requisition ยังเป็น `"analysis"` เพื่อให้ข้อมูลเดิมโชว์ต่อเนื่อง.

## 4. โครงสร้างที่เสนอ

### 4.1 Component ใหม่ `ChemicalRequisitionPanel`
ไฟล์: `src/components/lis/ChemicalRequisitionPanel.tsx`
props: `{ roomSlug: string; instruments: { id: string; name: string }[] }`

รวม logic ที่เดิมอยู่ใน "การ์ดบน" ของ `RoomEquipmentCheckPage`:
- query `["chemical-requisitions", roomSlug, todayStr()]` → รายการวันนี้.
- ปุ่ม "เบิกสารเคมี" → เปิด `ChemicalRequisitionDialog` (ไม่ preselect).
- list รายการวันนี้ (เวลา · solventName × qty ขวด · → instrumentName · โดย name) + ปุ่มลบ → `deleteChemicalRequisition` + ยืนยัน + คืนสต็อก (invalidate `chemical-requisitions`, `["stock","solvents"]`, `["stock","transactions"]`).
- ว่าง → "ยังไม่มีการเบิกวันนี้".

> ไม่ยกบล็อก "per-instrument mini-list" มา (หน้า stock ไม่มีการ์ดเครื่อง) — การเลือกเครื่องทำใน dialog อยู่แล้ว.

### 4.2 หน้า `StockDeduction.tsx` → 2 แท็บ
- เก็บ `AppLayout` + `PageHeader` ด้านนอก. เปลี่ยนหัวข้อ/คำอธิบายให้เข้ากับ "การเบิก stock" (คงไอคอนเดิมได้).
- ใช้ `Tabs` (`defaultValue="requisition"`):
  - **แท็บ "เบิก stock"** (`value="requisition"`): render `<ChemicalRequisitionPanel roomSlug={ANALYSIS_ROOM_SLUG} instruments={getRoomCatalog("analysis").instruments.map(i => ({id:i.id, name:i.name}))} />`.
  - **แท็บ "ประวัติ"** (`value="history"`): ย้ายเนื้อหาตารางประวัติเดิม (state `type`, query `stock-deductions`, `DataTable` + filter หมวด) มาไว้ในแท็บนี้.
- PageHeader `actions` (filter หมวด) เดิมอยู่ระดับหน้า → ย้ายไปอยู่ในแท็บ "ประวัติ" (filter ใช้กับตารางประวัติเท่านั้น).

### 4.3 ถอดออกจาก `RoomEquipmentCheckPage.tsx`
ลบทั้งหมดที่เป็นของ requisition:
- การ์ด `isAnalysis && (...)` "เบิกสารเคมีวันนี้".
- บล็อก `isAnalysis && (...)` "สารเคมีที่เบิกวันนี้" ใต้การ์ดเครื่อง.
- state `reqDialog`, query requisitions, `reqByInstrument`, `deleteReqMutation`, `onReqSaved`, render `<ChemicalRequisitionDialog/>`.
- import ที่ไม่ใช้แล้ว: `ChemicalRequisitionDialog`, `groupRequisitionsByInstrument`, `todayStr as reqTodayStr`, `ANALYSIS_ROOM_SLUG` (ถ้าไม่เหลือที่ใช้), ไอคอน `Plus`/`X`/`FlaskConical` (เช็คก่อนลบว่าไม่มีที่อื่นใช้).
- ตัวแปร `isAnalysis` → ลบถ้าไม่เหลือที่ใช้.

ผลลัพธ์: `RoomEquipmentCheckPage` กลับมาเป็นหน้าเช็กเครื่องล้วน ใช้ได้ทุกห้องเท่าเทียมกัน.

### 4.4 Nav
`src/lib/navItems.ts:38`: label `"การบันทึก Standard"` → `"การเบิก stock"`. path/icon เดิม.

## 5. Permissions
- เดิมคนเบิกสารเคมีเข้าผ่าน `/daily-check/*` (โรล Lab). พอย้าย UI มา `/stock-deduction` → โรลที่ต้อง "เบิก stock" ได้ต้องมีสิทธิ์ path `/stock-deduction`.
- **ต้องตรวจ**: โรล Lab (และโรลที่ควรเบิกได้) มี `/stock-deduction` ใน permissions หรือยัง — ถ้าไม่มีให้เพิ่ม (ผ่าน Access Control / seed). Endpoint `chemical-requisitions` เปิดตาม auth กลางเดิม ไม่ต้องแก้.
- admin bypass อยู่แล้ว.

## 6. Edge cases
- **ข้อมูล requisition เดิม** (roomSlug `"analysis"`) → ยังโชว์ในแท็บ "เบิก stock" ปกติ (query เดิม key เดิม).
- **แท็บ "ประวัติ"** ครอบคลุม solvent อยู่แล้ว (itemType filter) → เบิกจากแท็บใหม่ก็ยังเห็นใน "ประวัติ".
- **ไอคอน/ปุ่มที่แชร์** — ก่อนลบ import ต้อง grep ยืนยันไม่มีที่อื่นใช้ในไฟล์.
- **โรลที่เข้า `/stock-deduction` แต่ไม่ควรเบิก** — ถ้ามี ให้พิจารณา (v1 ถือว่าใครเข้าหน้านี้ได้ = เบิกได้ ตาม endpoint เปิด).

## 7. Testing
- **Vitest**: ไม่มี logic ใหม่ (ใช้ helper เดิม `groupRequisitionsByInstrument`/`todayStr` ที่มี test แล้ว). ถ้าแยก panel ไม่มี pure-logic ใหม่ → ไม่ต้องเพิ่ม unit test; ยัน `npm run test` เดิมยังเขียว.
- **type-check**: `npx tsc -p tsconfig.app.json --noEmit` ต้องไม่มี error ใหม่ (ตาม memory: root `tsc --noEmit` เป็น no-op).
- **Manual E2E** (เครื่อง user):
  1. เมนูขึ้น "การเบิก stock"; เปิดหน้า → เห็น 2 แท็บ.
  2. แท็บ "เบิก stock": เบิก solvent A ×2 ให้ GC 8890 → qty ลด + โผล่ในรายการวันนี้ + เห็นใน tab "ประวัติ"; ลบ → คืนสต็อก.
  3. รายการที่เคยเบิกไว้ (ก่อนย้าย) ยังโชว์.
  4. แท็บ "ประวัติ": ตาราง + filter หมวด ทำงานเหมือนเดิม.
  5. `/daily-check/analysis`: ไม่มีส่วนเบิกสารเคมีแล้ว เหลือแค่เช็กเครื่อง; ห้องอื่น (sample-prep/extraction/balance) ปกติ.
  6. โรล Lab เข้า `/stock-deduction` ได้ (หลังเพิ่มสิทธิ์ถ้าจำเป็น).

## 8. Non-goals / ข้อสมมติ
- ไม่แตะ backend/model/endpoint ของ `chemical-requisitions` หรือ `StockTransaction`.
- ไม่ migrate ข้อมูล (roomSlug คงเป็น `"analysis"`).
- v1 เบิกได้เฉพาะ solvent (ไม่รวม standard/glassware ในแท็บ "เบิก stock").
- ไม่แตะฟีเจอร์ "ชั่ง Standard" ในหน้า lab-testing (คนละส่วน).
- path `/stock-deduction` คงเดิม (ไม่ rename route).
