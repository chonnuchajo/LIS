# แยกการรับตัวอย่าง Lab / QC (per-track receive)

วันที่: 2026-06-08
สถานะ: อนุมัติ design แล้ว — รอเขียน implementation plan

## ปัญหา

ปัจจุบัน `Petition` มี `status` ตัวเดียว ไหลแบบเส้นตรง:

```
deliveringQC → sampleSent → pendingReview → inProgress → success → approved/rejected
```

Endpoint `PATCH /:id/receive` (สแกนรับตัวอย่าง) เปลี่ยน `status` จาก `sampleSent → pendingReview`
ทั้งก้อนเดียวสำหรับทุกฝ่าย ผลคือ:

- พอ **Lab** สแกนรับ → status เป็น `pendingReview` → ฝั่ง **QC** เห็นว่า "รับแล้ว" ไปด้วย ทั้งที่ QC ยังไม่ได้สแกน
- กลับกัน QC สแกนก่อน Lab ก็เห็นว่ารับแล้วเช่นกัน

## เป้าหมาย

แยกสถานะ **การรับตัวอย่าง** ของ Lab กับ QC ออกจากกัน — *เฉพาะขั้นการรับ* (ไม่แยกทั้ง lifecycle):

- Lab สแกนรับ → ฝั่ง Lab เห็น "รับแล้ว"; ฝั่ง QC ยังเห็น "ยังไม่รับ" จนกว่า QC จะสแกนเอง (และในทางกลับกัน)
- **Viewer** เห็น "รับตัวอย่างแล้ว" ถ้าฝ่ายใดฝ่ายหนึ่งรับแล้ว (พฤติกรรมเดิมของ status กลาง)
- การบันทึกผล / อนุมัติ / completion / KPI "เสร็จแล้ว" ยังใช้ `status` กลางเหมือนเดิม

## ขอบเขต

แยกแค่ **การรับ** เก็บ `status` กลางไว้ ไม่แตะ lifecycle การทดสอบ/อนุมัติ

## Data model — แนวทาง A (flat fields)

เพิ่มใน `server/models/Petition.js`:

```js
labReceivedAt: Date,
labReceivedBy: String,
qcReceivedAt: Date,
qcReceivedBy: String,
```

คงไว้: `status`, `receivedAt`, `receivedBy` (= การรับครั้งแรก ใช้ backward-compat + viewer)

> ปฏิเสธแนวทาง B (`receipts: [{track, at, by}]`) เพราะมีแค่ 2 track — flat fields ง่ายและ query ตรงกว่า (YAGNI)

`track` ในระบบ = `'lab' | 'qc'`

## Backend — `PATCH /api/petitions/:id/receive`

รับ body เพิ่ม: `{ actor, track }` โดย `track ∈ {'lab','qc'}`

ตรรกะใหม่:

1. validate `track` — ถ้าไม่ใช่ `'lab'`/`'qc'` → 400
2. โหลด petition; ถ้าไม่พบ → 404
3. **block** ถ้า `status ∈ {success, approved, rejected}` → 400 ("ทดสอบเสร็จสิ้นแล้ว")
4. ถ้า track นี้รับไปแล้ว (`${track}ReceivedAt` มีค่า) → **idempotent**: ส่ง doc ปัจจุบันกลับ (ไม่ error) เพื่อให้ UI navigate ต่อได้
5. เซ็ต `${track}ReceivedAt = now`, `${track}ReceivedBy = actor`
6. ถ้า `status === 'sampleSent'` → bump `status = 'pendingReview'` + เซ็ต global `receivedAt = now`, `receivedBy = actor` (first receive → viewer เห็น "รับแล้ว")
7. บันทึก + `logAudit` ระบุ track ใน note ("สแกนรับตัวอย่าง (Lab)" / "(QC)")
8. ส่ง doc กลับ

> **เอา guard เดิม `if (status !== 'sampleSent') return badRequest(...)` ออก** — เป็นต้นเหตุที่ track ที่ 2 รับไม่ได้

## Frontend

### Type (`src/types/petition.types.ts`)

เพิ่ม `labReceivedAt?`, `labReceivedBy?`, `qcReceivedAt?`, `qcReceivedBy?` ใน `Petition`

### Helper กลาง

`isReceivedByTrack(p: Petition, track: 'lab' | 'qc'): boolean`
- `lab` → `Boolean(p.labReceivedAt)`
- `qc`  → `Boolean(p.qcReceivedAt)`

วางใน lib ที่เหมาะสม (เช่น `src/lib/petitionReceipt.ts`) พร้อม unit test

### `PetitionDashboardTable`

- เพิ่ม prop `track?: 'lab' | 'qc'`
- `goToPetition`: เกณฑ์ "ยังไม่รับ" เปลี่ยนจาก `petition.status === 'sampleSent'`
  → `unreceivedListPath && track && !isReceivedByTrack(petition, track)`
  - ยังไม่รับ → `navigate(unreceivedListPath, { state: { flashId } })` (เด้งไป list + flash row เดิม)
  - รับแล้ว → เข้า detail + flash หน้า (เดิม)

### Lab / QC Dashboard

เปลี่ยน bucket ของ KPI ให้คิดแบบ per-track (track = `lab` ใน LabDashboard, `qc` ใน QCDashboard):

- **รอรับเข้าระบบ (waiting)** = ยังอยู่ใน queue และ track นี้ **ยังไม่รับ** (`!isReceivedByTrack`)
- **กำลังดำเนินการ (inProgress)** = track นี้ **รับแล้ว** และ `status !== 'success'`
- **เสร็จแล้ว (completed)** = `status === 'success'` (เหมือนเดิม)

ส่ง `track` ลง `PetitionDashboardTable` (`track="lab"` / `track="qc"`)

> ดึงตรรกะ bucket ออกมาเป็น helper เพื่อ test ได้ (เช่น `splitPetitionsByTrack(petitions, track)`)

### Lab / QC TestingPage (list)

- คอลัมน์ action + `onRowClick` + badge สถานะ ใช้ per-track:
  - track รับแล้ว → badge สถานะทดสอบจริง + ปุ่ม "เข้าตรวจ" (เข้า detail ได้)
  - track ยังไม่รับ → badge "รอรับเข้าระบบ" + ข้อความ "รอสแกนรับ" (เข้า detail ไม่ได้)
- เกณฑ์เดิม `ENTRY_STATUSES.has(p.status)` แทนด้วย `isReceivedByTrack(p, track) && p.status !== 'success'`

### Scan modals

- `LabScanAcceptModal` → ส่ง `track: 'lab'` ตอน `PATCH /receive`; เช็ค "รับแล้ว→navigate ตรง" จาก `labReceivedAt` แทน `status === pendingReview/inProgress`
- `QrReceiveModal` (QC) → ส่ง `track: 'qc'` ตอน `PATCH /receive`; เช็คจาก `qcReceivedAt`
- ทั้งคู่: อนุญาตรับแม้ status ขยับไปแล้ว (ตราบใดที่ track ตัวเองยังไม่รับ และ status ไม่ใช่ success/approved/rejected)

### Viewer

ไม่แตะ — `status` กลาง flip เป็น `pendingReview` ตอน first receive → เห็น "รับตัวอย่างแล้ว" ถ้าฝ่ายใดฝ่ายหนึ่งรับ ✅

## Migration

`server/scripts/backfill-track-received.js` (รองรับ dry-run เป็น default + `--commit`):

- คำร้องที่ status เลย `sampleSent` แล้ว (`pendingReview | inProgress | success | approved | rejected`)
  → เซ็ต `labReceivedAt = qcReceivedAt = receivedAt เดิม` (fallback `updatedAt` ถ้าไม่มี),
    `labReceivedBy = qcReceivedBy = receivedBy เดิม` — ถือว่ารับทั้งสองฝั่ง
- คำร้อง `sampleSent | deliveringQC` → ปล่อยว่าง
- dry-run รายงานจำนวนที่จะแก้ + WARN ที่ไม่มี `receivedAt`
- หลัง `--commit` → รัน `npm run seed:export` + commit (ตามแพทเทิร์น repo)

## Tests

- `isReceivedByTrack` — lab/qc, มี/ไม่มีค่า
- `splitPetitionsByTrack` — เคส: neither received, lab-only received, qc-only received, success
- (ถ้าฝั่ง backend มี test harness) receive endpoint: รับ track ที่ 2 ได้, idempotent, block success

## ไฟล์ที่เกี่ยวข้อง

- `server/models/Petition.js` — fields ใหม่
- `server/routes/petitions.js` — `/receive` รับ `track`
- `server/scripts/backfill-track-received.js` — ใหม่
- `src/types/petition.types.ts` — type
- `src/lib/petitionReceipt.ts` (+ test) — helper ใหม่
- `src/components/lis/PetitionDashboardTable.tsx` — prop `track`
- `src/pages/LabDashboard.tsx`, `src/pages/QCDashboard.tsx` — bucket per-track
- `src/pages/LabTestingPage.tsx`, `src/pages/QCTestingPage.tsx` — action/badge per-track
- `src/components/petition/LabScanAcceptModal.tsx`, `src/components/petition/QrReceiveModal.tsx` — ส่ง track
