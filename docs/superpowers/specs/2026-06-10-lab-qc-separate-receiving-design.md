# Lab/QC แยกการรับงาน + บันทึก "รับงานโดย"

วันที่: 2026-06-10
สถานะ: design (รอ implement)

## ปัญหา

ใบคำขอ (Petition) หนึ่งใบมีได้ทั้งงาน Lab และงาน QC ปนกัน (lab item = batchNo ลงท้าย 1/6, ที่เหลือ = QC) แต่ระบบรับงานปัจจุบันใช้ field และ status ร่วมกันทั้งสองฝั่ง ทำให้:

1. **เขียนทับกัน** — `PATCH /petitions/:id/receive` เก็บ `receivedBy`/`receivedAt` ตัวเดียวบน Petition ฝั่งไหนรับทีหลังก็ทับของอีกฝั่ง แยกไม่ออกว่าใครรับฝั่งไหน
2. **บล็อกฝั่งที่สอง** — endpoint เช็ค `if (before.status !== 'sampleSent')` แล้ว error พอ Lab รับก่อน status → `pendingReview` ฝั่ง QC สแกนรับไม่ได้เลย ("ไม่สามารถรับได้: สถานะปัจจุบันคือ pendingReview")
3. **ปุ่มใช้ status ร่วม** — ทั้ง LabTestingPage และ QCTestingPage ตัดสิน "เข้าตรวจ vs รอสแกนรับ" จาก `status` ตัวเดียว (`ENTRY_STATUSES = {pendingReview, inProgress}`) → พอ Lab รับ ปุ่ม QC กลายเป็น "เข้าตรวจ" ทั้งที่ QC ยังไม่ได้รับ และไม่มีบันทึกว่าใครรับ QC

## เป้าหมาย

- การรับงานของ Lab กับ QC **แยกจากกันอิสระ** — รับฝั่งหนึ่งไม่กระทบอีกฝั่ง
- ทั้งสองฝั่งบันทึก **"รับงานโดย"** (ชื่อผู้รับ) + เวลารับ ของตัวเอง โดยไม่ทับกัน

## ขอบเขต (ตามที่ตกลง)

- เก็บ received **แยกตามฝั่ง Lab / QC** (ระดับฝั่ง ไม่ใช่ราย item)
- หน้า QC **ยังโชว์ใบคำขอทุกใบเหมือนเดิม** (ไม่เปลี่ยน list filter) — แค่เปลี่ยน gate ปุ่ม + เพิ่มผู้รับ
- คง field/พฤติกรรมเดิม (`receivedBy`/`receivedAt`, status lifecycle, print, HomeQC) ไม่ให้พัง

## การออกแบบ

### 1. Model — `server/models/Petition.js`

เพิ่ม 4 field (ทั้งหมด optional):

```js
labReceivedBy: String,
labReceivedAt: Date,
qcReceivedBy:  String,
qcReceivedAt:  Date,
```

คง `receivedBy` / `receivedAt` เดิมไว้ — เป็น "ฝั่งแรกที่รับ" (legacy/รวม) เพื่อให้ `PetitionPrintTemplate` และ `HomeQC` (อายุงานคำนวณจาก receivedAt) ทำงานต่อได้

### 2. Endpoint — `PATCH /petitions/:id/receive` (`server/routes/petitions.js`)

รับ body เพิ่ม: `side: 'lab' | 'qc'` (default `'qc'` เพื่อ backward-compat กับ caller เดิม)

logic ใหม่:

```js
const actor = req.body?.actor || 'system';
const side  = req.body?.side === 'lab' ? 'lab' : 'qc';

// block เฉพาะสถานะที่ปิดงานแล้ว
if (['success', 'approved', 'rejected'].includes(before.status)) {
  return badRequest(res, `ไม่สามารถรับได้: สถานะปัจจุบันคือ ${before.status}`);
}

const now = new Date();
const update = {
  [`${side}ReceivedBy`]: actor,
  [`${side}ReceivedAt`]: now,
};
// ฝั่งแรกที่รับ: flip status + เซ็ต legacy receivedBy/At (ไม่ทับถ้ามีแล้ว)
if (before.status === 'sampleSent') {
  update.status = 'pendingReview';
}
if (!before.receivedAt) {
  update.receivedBy = actor;
  update.receivedAt = now;
}
```

- ฝั่งที่สองรับได้แล้ว (ไม่ error ตอน status เป็น pendingReview/inProgress) — แก้บั๊กบล็อก
- audit note แยกฝั่ง: `สแกนรับงาน Lab` / `สแกนรับงาน QC`
- กรณี side เดิมรับซ้ำ: อัปเดต field ฝั่งนั้นทับด้วยคนล่าสุด (ยอมรับได้ — ถือเป็นแก้ไขผู้รับ)

### 3. Frontend

**Types** — `src/types/petition.types.ts`: เพิ่ม `labReceivedBy/At`, `qcReceivedBy/At` (optional)

**Modals** (ส่ง side):
- `src/components/petition/LabScanAcceptModal.tsx` → `api.patch(..., { actor, side: 'lab' })`
- `src/components/petition/QrReceiveModal.tsx` → `api.patch(..., { actor, side: 'qc' })`

**LabTestingPage** (`src/pages/LabTestingPage.tsx`):
- gate ปุ่ม "เข้าตรวจ vs รอสแกนรับ" จาก `!!p.labReceivedAt` แทน `ENTRY_STATUSES.has(p.status)`
- onRowClick / abnormal-flag gating ใช้ `labReceivedAt` ด้วย
- แสดง "รับโดย {p.labReceivedBy}" ในคอลัมน์คำร้อง (ถ้ามี)

**QCTestingPage** (`src/pages/QCTestingPage.tsx`):
- gate ปุ่มจาก `!!p.qcReceivedAt` แทน status (list ยังโชว์ทุกใบเหมือนเดิม)
- แสดง "รับโดย {p.qcReceivedBy}" ในคอลัมน์คำร้อง (ถ้ามี)

**Detail / Print**:
- `src/pages/QCTestingDetailPage.tsx:1047` — เปลี่ยน `petition.receivedBy` → `petition.qcReceivedBy ?? petition.receivedBy`
- `src/pages/LabTestingDetailPage.tsx` — เพิ่มบรรทัด "ผู้รับงาน: {labReceivedBy}" (ถ้ายังไม่มี)
- `PetitionPrintTemplate.tsx` — คงใช้ `receivedBy` (ฝั่งแรก) ตามเดิม; ปรับเป็น side-specific ภายหลังถ้าต้องการ (นอกขอบเขตรอบนี้)

## Backward compatibility / migration

- ใบเก่าที่รับไปแล้ว: มีแต่ `receivedBy`/`receivedAt` (ไม่มี side fields)
  - หน้า list อ่าน side field → ใบเก่าจะขึ้น "รอสแกนรับ" ทั้งที่รับแล้ว → **ทางแก้**: fallback gate เป็น `p.labReceivedAt || (p.status !== 'sampleSent')` ก็ได้ แต่จะทำให้บั๊ก "ทั้งสองฝั่งเปิดพร้อมกัน" กลับมาในใบเก่า
  - **ตัดสิน**: ใบที่ค้างอยู่ตอน deploy มีน้อย (งานรายวัน) → ยอมให้ใบเก่าต้องสแกนรับใหม่ฝั่งละครั้ง ไม่ทำ migration backfill
- ไม่มี breaking change ฝั่ง DB (เพิ่ม field เฉยๆ)

## Testing

- unit (vitest): logic gate `labReceivedAt`/`qcReceivedAt` ถ้าแยกเป็น helper
- backend: ทดสอบ `/receive` ด้วย side สองครั้งบนใบเดียว → ทั้งสอง field ถูกเซ็ต, ไม่ทับกัน, status คง pendingReview, ฝั่งสองไม่ error
- manual / playwright: ใบ mixed → Lab สแกนรับ → QC ปุ่มยัง "รอสแกนรับ" → QC สแกนรับ → ทั้งสองโชว์ผู้รับถูกคน

## Out of scope

- เปลี่ยน list filter ของหน้า QC (คงโชว์ทุกใบ)
- เก็บ received ราย item
- แยก status lifecycle ราย side (ใช้ status รวมตามเดิม)
- ปรับ print template เป็น side-specific
