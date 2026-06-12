# Lab Approval Review Page — ทำหน้าอนุมัติ Lab ให้เหมือน QC

วันที่: 2026-06-12
สถานะ: design (approved approach A)
สาขา: develop

## เป้าหมาย

ทำให้ประสบการณ์ "อนุมัติผล Lab" ของหัวหน้า Lab เหมือนด่าน QC: มีหน้า review เฉพาะแบบ
read-only พร้อมแผงตัดสินล่างจอ แทนที่จะโยนหัวหน้า Lab เข้าหน้า `/lab-testing/:id`
(หน้ากรอกผลเต็ม) แล้วอนุมัติผ่านกล่อง inline

## สภาพปัจจุบัน (ก่อนแก้)

- `LabApproval.tsx` (list `/lab-approval`): ตารางเรียบ ไม่มี flag/priority/AI กดปุ่ม
  "ตรวจสอบ" → `navigate('/lab-testing/:id')`
- หัวหน้า Lab อนุมัติในหน้า `LabTestingDetailPage` ผ่านกล่อง amber inline:
  ปุ่ม `อนุมัติผล Lab` (`labApprovePetition`) / `ส่งกลับให้แก้` (`labRejectPetition` +
  `RevisionRequestDialog`) — แสดงเมื่อ `canApproveLab = canAccessPath('/lab-approval')`
- ฝั่ง QC มี `QCApprovalReviewPage` (`/qc-approval/:id`) อยู่แล้วเป็นต้นแบบ

## ข้อเท็จจริงทางเทคนิคที่ยืนยันแล้ว

- ผล Lab เก็บใน QCTestResult store เดียวกัน → อ่านด้วย `api.getQCResults(id)` ได้เหมือน QC
- พารามิเตอร์ฝั่ง Lab = `scope === 'lab' || (scope === 'qc' && shareWithLab === true)`
  (ตรงกับ filter ใน `LabTestingDetailPage`)
- `buildApprovalGroups(petition, params, results, groupMembership)` ไม่ผูก scope —
  ส่ง params lab-scoped เข้าไปได้เลย
- `api.getAbnormalFlags([id])` ครอบทั้ง Lab+QC → ใช้ indicator/flag ได้
- `api.getReturnedFlags([id])` อิง `revisionOf` (petition-level) → ใช้ flag revision ได้
- `streamDraftNote(petitionId)` รับแค่ petitionId → reuse ได้
- Backend ครบแล้ว: `POST /:id/lab-approve`, `POST /:id/lab-reject`,
  `GET /abnormal-flags`, `GET /returned-flags`, `usePetitionList({awaitingLabApproval})`
  — **ไม่ต้องแตะ backend**

## ขอบเขต (จากที่ user เลือก)

เอา: หน้า review เฉพาะ `/lab-approval/:id` + flag ในหน้า list + AI draft หมายเหตุ
ไม่เอา: ปุ่มตัดสินหลายแบบตามผลปกติ/ผิดปกติ (ด่าน Lab ยังไม่มีผล QC จึงไม่มี
"ยอมรับผล/ส่งคืนผู้ส่ง/แยกปลายทาง Lab/QC" — ใช้ 2 ปุ่มเดิมพอ)

## แนวทางที่เลือก: A — หน้าใหม่ clone QC ตรงๆ

เลือก A แทน B (แยก component กลางใช้ร่วม QC+Lab) เพราะ:
- "เป็นเหมือน QC" = ลอกหน้าเดิมได้ตรงๆ เสี่ยงต่ำ ไม่แตะหน้า QC ที่ใช้งานจริง
- แผงตัดสิน Lab ง่ายกว่า (2 ปุ่มคงที่) — abstraction ตอนนี้จะทำให้ props บวมโดยไม่คุ้ม
- B เก็บไว้เป็น refactor อนาคตถ้ามีด่านอนุมัติแบบที่ 3

## รายละเอียดการเปลี่ยนแปลง

### 1. หน้าใหม่ `src/pages/LabApprovalReviewPage.tsx`

Clone โครงจาก `QCApprovalReviewPage.tsx` แล้วปรับ:

- **โหลดข้อมูล**:
  - `api.getParameters()` → filter `p.scope === 'lab' || (p.scope === 'qc' && p.shareWithLab === true)`
  - `api.getQCResults(id)` → results
  - `api.getAbnormalFlags([id])` → indicator ผิดปกติ/ปกติ
  - `usePetition(id)`, `useItemGroupMembership()` เหมือน QC
- **ส่วนแสดงผล (read-only)**:
  - PageHeader `onBack={() => navigate('/lab-approval')}` หัวข้อ "อนุมัติผล Lab {petitionNo}"
    ไอคอน `FlaskConical` สีฟ้า (sky) ให้เข้าชุด Lab
  - แถบ badge: dept, ผู้รับงาน Lab (`labReceivedBy(petition)`), indicator มีค่าผิดปกติ/ปกติทุกรายการ
  - กล่อง violet "คำอธิบายการทำใหม่" แสดง `petition.labRedoExplanation` (ถ้ามี)
  - การ์ดต่อ sample จาก `buildApprovalGroups(...)` — ตารางช่อง/ค่าที่บันทึก/เกณฑ์/สถานะ/หมายเหตุ
    (โครง JSX เดียวกับ QC ทุกประการ)
- **แผงตัดสิน fixed ล่างจอ** (แสดงเมื่อ `canAccessPath('/lab-approval')` เท่านั้น):
  - **2 ปุ่มคงที่เสมอ** (ไม่แยกตามผลปกติ/ผิดปกติ):
    - `อนุมัติผล Lab` (primary, `CheckCircle2`) → `confirm` → `api.labApprovePetition(id, actor)`
      → toast → `navigate('/lab-approval')`
    - `ส่งกลับให้แก้` (outline, `RotateCcw`) → เปิด `RevisionRequestDialog`
      (recipientLabel "ผู้ทดสอบ Lab") → `api.labRejectPetition(id, actor, note)`
      → toast → `navigate('/lab-approval')`
  - ใช้ `useConfirm()` + `toast` + `submitting` state แบบ QC
- ผู้ที่ไม่มีสิทธิ์ `/lab-approval` เปิดหน้าได้แต่เห็นเฉพาะตารางผล ไม่มีปุ่มตัดสิน

### 2. `src/pages/LabApproval.tsx` (list) — เพิ่มให้เหมือน QCApproval

- เพิ่ม state + โหลด `getAbnormalFlags` / `getReturnedFlags` ตามรายการในหน้า
- คอลัมน์ "เลขที่คำร้อง": เพิ่มไอคอน `AlertTriangle` (ผิดปกติ) / `RotateCcw` (revision)
  + badge เล็ก "ผิดปกติ" / "🔄 Revision" / "⏰ เกิน 24h" (mirror QC; ใช้ `labCompletedAt` เทียบ 24h)
- priority sort: ผิดปกติ > overdue > revision > dept (มิเรอร์ `priorityScore` ของ QC)
- ปุ่ม "Draft หมายเหตุ (AI)" ในคอลัมน์การดำเนินการ เมื่อ `getAiStatus().available`
  (เหมือน QC: `streamDraftNote` + textarea)
- เปลี่ยน `navigate('/lab-testing/:id')` → `navigate('/lab-approval/:id')` ทั้ง onRowClick และปุ่ม

### 3. `src/App.tsx`

เพิ่ม route `/lab-approval/:id` (React.lazy เหมือน route อื่น) ภายใต้ `PrivateRoute`
ตัวเดียวกับ `/lab-approval` (path-based access control เดิมครอบ `/lab-approval/*` ได้)

### 4. `src/pages/LabTestingDetailPage.tsx`

เอาปุ่ม approve/reject ในกล่อง amber inline (`รอหัวหน้า Lab อนุมัติ`) ออก — เหลือเป็น
banner สถานะเฉยๆ เพื่อให้ทางอนุมัติมีจุดเดียว = หน้า review ใหม่ (กัน double-path)
- ลบบล็อก `{canApproveLab && (...)}` (ปุ่มสองปุ่ม)
- `handleLabApprove` / `handleLabReject` / state `labRejectOpen` / `RevisionRequestDialog`
  ที่เหลือใช้เฉพาะ approval → ลบออกจากหน้านี้ (ย้ายไป review page)
- คง banner "บันทึกผลแล้ว — รอหัวหน้า Lab อนุมัติ" + banner "Lab อนุมัติแล้ว" ไว้

## ส่วนที่ไม่แตะ

- Backend routes / models ทั้งหมด
- หน้า QC (`QCApproval`, `QCApprovalReviewPage`) — ห้ามแตะ
- `buildApprovalGroups`, `getAbnormalFlags`, `getReturnedFlags`, `streamDraftNote`

## เกณฑ์ความสำเร็จ

1. หัวหน้า Lab กด "ตรวจสอบ" ในหน้า `/lab-approval` → เข้า `/lab-approval/:id` (ไม่ใช่ lab-testing)
2. หน้า review แสดงตารางผล Lab read-only จัดกลุ่มตาม sample + indicator ผิดปกติ
3. กด "อนุมัติผล Lab" → petition ได้ `labApprovedAt` (และ success เมื่อครบทุก track) → กลับ list
4. กด "ส่งกลับให้แก้" + เหตุผล → petition ถูกส่งกลับผู้ทดสอบ Lab → กลับ list
5. หน้า list แสดง flag ผิดปกติ/revision/overdue + เรียงตาม priority + ปุ่ม AI draft (ถ้ามี ollama)
6. หน้า `lab-testing/:id` ไม่มีปุ่มอนุมัติ Lab อีก (เหลือแต่ banner สถานะ)
7. `tsc -p tsconfig.app.json` ผ่าน (ไม่เพิ่ม error ใหม่)

## ความเสี่ยง / หมายเหตุ

- ไม่ atomic / ไม่มี backend ใหม่ → ความเสี่ยงต่ำ ส่วนใหญ่เป็น UI
- ต้อง manual E2E (ตามแนวทางด่าน Lab/QC เดิม) — ครอบ happy path + reject
- type-check จริงต้องใช้ `tsc -p tsconfig.app.json` (root `tsc --noEmit` เป็น no-op)
