# เพิ่มด่าน "หัวหน้า Lab อนุมัติ" + ส่งกลับหลายปลายทาง

วันที่: 2026-06-11
สถานะ: design (รอ user review)
ขอบเขต: backend (Petition model + petitions route) + frontend (หน้าใหม่ + 2 detail page) + nav/route/access

## ปัญหา / เป้าหมาย

ปัจจุบันมีด่านอนุมัติเดียว = **QC อนุมัติ** (success → approved โดยหัวหน้า QC) ฝั่ง Lab มีแค่ "ผู้ทดสอบกรอกผล + ยืนยันบันทึก" ไม่มีหัวหน้า Lab อนุมัติ

ต้องการเพิ่มด่าน **หัวหน้า Lab อนุมัติ** คู่กับ QC อนุมัติ โดย:
- หัวหน้า Lab เห็น/อนุมัติ **เฉพาะ parameter ฝั่ง Lab**
- หัวหน้า QC (ด่านสุดท้าย) เห็น **ทุก parameter ทั้ง Lab + QC** ในหน้าอนุมัติ QC
- QC อนุมัติได้ก็ต่อเมื่อ **Lab อนุมัติเสร็จก่อน** (บังคับลำดับ)
- ทั้งสองด่านส่งกลับให้แก้ได้ พร้อมเหตุผล และผู้ทดสอบที่ถูกส่งกลับต้องอธิบายว่า "ทำใหม่อย่างไร"

## สถานะ (status enum เดิม — ไม่เพิ่มค่าใหม่)

```
deliveringQC → sampleSent → pendingReview → inProgress → success → approved / rejected
```
("กำลังตรวจ" = `inProgress`; ด่านส่งกลับจาก success ตกกลับเป็น `inProgress`)

ด่าน Lab อนุมัติ implement ด้วย **field** (`labApprovedAt`) ไม่ใช่ status ใหม่ — เข้ากับวิธีที่ lab/qc completion ทำอยู่แล้ว (field-based) และไม่ต้องไปแก้ทุกที่ที่ map สี/label/filter สถานะ

## Field ใหม่ใน Petition (`server/models/Petition.js` + `src/types/petition.types.ts`)

| field | ชนิด | ความหมาย |
|---|---|---|
| `labApprovedAt` | Date | เวลาที่หัวหน้า Lab อนุมัติ |
| `labApprovedBy` | String | ชื่อหัวหน้า Lab ที่อนุมัติ |
| `labReturnNote` | String | เหตุผลล่าสุดที่ส่งกลับฝั่ง Lab (เคลียร์เมื่อ Lab re-confirm) |
| `qcReturnNote` | String | เหตุผลล่าสุดที่ส่งกลับฝั่ง QC (เคลียร์เมื่อ QC re-confirm) |
| `labRedoExplanation` | String | ผู้ทดสอบ Lab อธิบาย "ทำใหม่ยังไง" ตอน re-confirm หลังโดนส่งกลับ |
| `qcRedoExplanation` | String | ผู้ทดสอบ QC อธิบาย "ทำใหม่ยังไง" ตอน re-confirm หลังโดนส่งกลับ |

(field เดิมที่เกี่ยวข้องและคงไว้: `labCompletedAt/By`, `qcCompletedAt/By`, `completedAt`, `approvedAt`, `rejectedAt`, `reviewHistory`)

## Flow เต็ม

```
ผู้ทดสอบ Lab กรอก + ยืนยัน      → labCompletedAt              → เข้าคิว [Lab อนุมัติ]
หัวหน้า Lab อนุมัติ              → labApprovedAt              (track Lab เสร็จ)
ผู้ทดสอบ QC  กรอก + ยืนยัน      → qcCompletedAt
        เมื่อ (ไม่มี lab || labApprovedAt) && qcCompletedAt → status = success → เข้าคิว [QC อนุมัติ]
หัวหน้า QC (เห็นทุก param) อนุมัติ → approved                  ← ด่านสุดท้าย
```

**จุดบังคับลำดับ "QC รอ Lab":** เปลี่ยนเงื่อนไขใน `isPetitionComplete` (`server/lib/petitionStatusLog.js:238`):
```js
const labDone = !hasLabItem || !!petition.labApprovedAt;   // เดิมเช็ค labCompletedAt
```
→ คำร้องจะไม่กลายเป็น `success` (ไม่โผล่ในคิว QC อนุมัติ) จนกว่า Lab จะอนุมัติเสร็จ ไม่ต้องเช็คซ้ำที่ปุ่มอนุมัติ QC

> หมายเหตุ: `isPetitionComplete` ยังคงต้องการ `qcCompletedAt` เสมอ (พฤติกรรมเดิม) — ไม่อยู่ในขอบเขตงานนี้

## ส่งกลับ (reject routing)

| ผู้ส่งกลับ | ปลายทาง | ผลที่เกิด |
|---|---|---|
| หัวหน้า Lab (ด่าน Lab อนุมัติ) | **Lab** | เคลียร์ `labCompletedAt`, set `labReturnNote`, status คง `กำลังตรวจ`, ปลดล็อกผู้ทดสอบ Lab ให้แก้ |
| หัวหน้า QC (ด่านสุดท้าย) | **Lab** | เคลียร์ `labCompletedAt` + `labApprovedAt`, set `labReturnNote`, ถ้า `success` → ตกกลับ `กำลังตรวจ` |
| หัวหน้า QC | **QC** | เคลียร์ `qcCompletedAt`, set `qcReturnNote`, ถ้า `success` → ตกกลับ `กำลังตรวจ` |
| หัวหน้า QC | **ผู้ส่งคำขอ** | `status = rejected` + `revisionNote` (= flow เดิม, revision chain ไม่เปลี่ยน) |

**Redo explanation:** เมื่อ track ไหนถูกส่งกลับ (มี `labReturnNote`/`qcReturnNote` ค้างอยู่) ผู้ทดสอบฝั่งนั้น **ต้องกรอก** `labRedoExplanation`/`qcRedoExplanation` ตอน re-confirm (ครั้งแรกที่ยังไม่เคยโดนส่งกลับ → ไม่บังคับ) ค่านี้โชว์ให้หัวหน้าเห็นตอนรีวิวรอบถัดไป

## Backend (`server/routes/petitions.js`)

### endpoint ใหม่
- **`POST /:id/lab-approve`** `{ actor }`
  - guard: ต้องมี `labCompletedAt` และยังไม่มี `labApprovedAt`, status ต้องไม่ใช่ `success/approved/rejected`
  - set `labApprovedAt`, `labApprovedBy`, push `reviewHistory {action:'lab-approve'}`, audit `statusChanged`/`updated`
  - เรียก `isPetitionComplete` → ถ้าครบ ตั้ง `success` + `completedAt`
- **`POST /:id/lab-reject`** `{ actor, note }`
  - guard: ต้องมี `labCompletedAt`, status ไม่ใช่ `approved/rejected`; ต้องมี `note`
  - เคลียร์ `labCompletedAt` (และ `labApprovedAt` ถ้ามี), set `labReturnNote`, audit `updated` (`note: ส่งกลับ Lab: …`)
  - หมายเหตุ enum `reviewHistory.action` ปัจจุบัน = `['note','approve','reject','startTesting']` → ต้องเพิ่ม `'lab-approve','lab-reject'` (หรือ reuse `approve/reject` + แยกด้วย note) ระบุตอนเขียน plan

### ขยาย reject ของ QC
ปัจจุบัน `PATCH /:id` `{status:'rejected', revisionNote}` → ผู้ส่งคำขอ (success→rejected)
เพิ่ม body `target: 'requester' | 'lab' | 'qc'` (default `'requester'`):
- `requester` → path เดิม (status=rejected, revision chain)
- `lab` → เคลียร์ `labCompletedAt` + `labApprovedAt`, set `labReturnNote = revisionNote`, status `success → กำลังตรวจ`, audit
- `qc` → เคลียร์ `qcCompletedAt`, set `qcReturnNote = revisionNote`, status `success → กำลังตรวจ`, audit

### redo explanation ใน complete
`POST /:id/complete` (เดิม) รับเพิ่ม `redoExplanation`:
- side=lab → ถ้ามี `labReturnNote` ค้าง: ต้องมี `redoExplanation` (ไม่งั้น 400), set `labRedoExplanation`, เคลียร์ `labReturnNote`
- side=qc → เช่นเดียวกันกับ `qcReturnNote`/`qcRedoExplanation`

### คิว Lab อนุมัติ
`GET /petitions` เพิ่ม query `awaitingLabApproval=true` →
```js
q.labCompletedAt = { $ne: null };
q.labApprovedAt = null;
q.status = 'inProgress';
```
(labCompletedAt ถูก set เฉพาะคำร้องที่มี lab item อยู่แล้ว จึงไม่ต้องกรอง hasLabItem ซ้ำ)

## Frontend

### หน้าใหม่ `/lab-approval` — "อนุมัติผล Lab"
- clone โครง `src/pages/QCApproval.tsx` (ตัดส่วน AI draft note ออกได้ ถ้าไม่ต้องการในเฟสแรก)
- ดึงคิวด้วย `awaitingLabApproval=true` แทน `status:'success'`
- คอลัมน์: เลขคำร้อง / แผนก / ผู้นำส่ง / ผู้ทดสอบ Lab / จำนวนรายการ / สถานะ / ปุ่ม "ตรวจสอบ" → `/lab-testing/:id`
- เพิ่ม route ใน `src/App.tsx` + nav item ใน `src/lib/navItems.ts` (label "อนุมัติผล Lab", path `/lab-approval`)
- access: path-based เดิม — หัวหน้า Lab = ให้สิทธิ์ path `/lab-approval` (ไม่สร้าง role ใหม่)

### `src/pages/LabTestingDetailPage.tsx`
โซนล่าง (ปัจจุบัน: ปุ่มบันทึก + กล่อง success) เปลี่ยนเป็น 3 สถานะ:
1. **กำลังกรอก** (`!labCompletedAt`): ปุ่ม `บันทึกแบบร่าง`/`บันทึก` เดิม
   - ถ้ามี `labReturnNote` ค้าง → โชว์ banner เหตุผลส่งกลับ + ช่องบังคับกรอก `labRedoExplanation` ก่อนกด `บันทึก`
2. **รอหัวหน้า Lab อนุมัติ** (`labCompletedAt && !labApprovedAt`): กล่อง "รอหัวหน้า Lab อนุมัติ" + (เฉพาะผู้มีสิทธิ์ `/lab-approval`) ปุ่ม **อนุมัติ** / **ส่งกลับ** (dialog ใส่เหตุผล) — mirror โครงปุ่มของ QC detail (`QCTestingDetailPage.tsx:1156-1196`)
3. **Lab อนุมัติแล้ว** (`labApprovedAt`): badge "Lab อนุมัติแล้ว"

### `src/pages/QCTestingDetailPage.tsx` (หน้าอนุมัติ QC — ด่านสุดท้าย)
- เพิ่ม **กล่องสรุปผล Lab อ่านอย่างเดียว** (physical results ของ lab item) เพื่อให้หัวหน้า QC เห็นทุก param ทั้ง Lab + QC
- โชว์ `labRedoExplanation`/`qcRedoExplanation` ถ้ามี
- dialog "ส่งให้แก้ไข" เพิ่มตัวเลือกปลายทาง **3 แบบ: ผู้ส่งคำขอ / Lab / QC** (radio) ก่อนกรอกเหตุผล → ส่ง `target` ไป backend

### `src/lib/api.ts`
เพิ่ม: `labApprovePetition(id, actor)`, `labRejectPetition(id, actor, note)`, ขยาย `rejectPetition` ให้รับ `target`, ขยาย `completePetitionTrack` ให้รับ `redoExplanation`, และตัวดึงคิว `awaitingLabApproval`

## สิ่งที่ไม่เปลี่ยน
- status enum, revision chain เดิม (ผู้ส่งคำขอ), auto-save รายช่อง, ระบบ Phase 1/2, การ lock หน้าหลังยืนยัน, dual-track gating หลัก
- คิว QC อนุมัติยังกรอง `status:'success'` เหมือนเดิม (แต่ตอนนี้ success การันตีว่า Lab อนุมัติแล้ว)

## Verification
- backend: ทดสอบ endpoint ใหม่ (lab-approve / lab-reject / reject target=lab|qc / complete มี redoExplanation) + อัปเดต `petitionStatusLog.test.js` สำหรับ `isPetitionComplete` ที่เช็ค `labApprovedAt`
- `npx tsc -p tsconfig.app.json --noEmit` ผ่าน, `npm run lint` ผ่าน
- manual: ผู้ทดสอบ Lab ยืนยัน → คำร้องเข้าคิว Lab อนุมัติ (ยังไม่เข้าคิว QC) → หัวหน้า Lab อนุมัติ + QC กรอกครบ → เข้าคิว QC อนุมัติ → หัวหน้า QC เห็นผล Lab+QC → ทดสอบส่งกลับทั้ง 3 ปลายทาง + redo explanation บังคับกรอก
- `npm run seed:export` หลังแก้ schema (field ใหม่)

## ไฟล์ที่แตะ
- `server/models/Petition.js` — field ใหม่
- `server/lib/petitionStatusLog.js` (+ `.test.js`) — `isPetitionComplete` เช็ค `labApprovedAt`
- `server/routes/petitions.js` — lab-approve / lab-reject / reject target / complete redoExplanation / awaitingLabApproval filter
- `src/types/petition.types.ts` — field ใหม่
- `src/lib/api.ts` — api helpers
- `src/pages/LabApproval.tsx` (ใหม่)
- `src/pages/LabTestingDetailPage.tsx` — โซน 3 สถานะ + อนุมัติ/ส่งกลับ + redo
- `src/pages/QCTestingDetailPage.tsx` — กล่องผล Lab อ่านอย่างเดียว + reject 3 ปลายทาง
- `src/App.tsx`, `src/lib/navItems.ts` — route + nav
