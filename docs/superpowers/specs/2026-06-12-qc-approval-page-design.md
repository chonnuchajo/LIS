# แยกหน้าอนุมัติ QC ออกเป็นหน้าเฉพาะ (`/qc-approval/:id`)

วันที่: 2026-06-12
สถานะ: อนุมัติดีไซน์แล้ว รอเขียน implementation plan

## ปัญหา

การรีวิว/อนุมัติผล QC ปัจจุบัน reuse หน้า `QCTestingDetailPage` (`/qc-testing/:id`)
แบบ context-aware: เมื่อ petition `status === 'success'` หน้าจะ lock ฟอร์มกรอกทั้งหมด
(`isLocked = status === 'success' || qcCompletedAt`) แล้วโชว์เฉพาะแผงปุ่มตัดสิน
(2 ปุ่มเมื่อผลปกติ / 3 ปุ่มเมื่อผิดปกติ).

ผลที่ผู้ใช้เจอ:
1. **หน้าตาย** — คนอนุมัติถูกโยนเข้าหน้ากรอกผลที่ทุกช่อง disabled เหลือกดได้แค่ 2 ปุ่ม
   ดูเหมือนระบบพัง และ URL ขึ้น `/qc-testing` ซึ่งความหมายผิดสำหรับการอนุมัติ
2. **หน่วง/ค้าง** — หน้า detail โหลดของหนักมาก (parameters, results, lastBatch queries,
   AI status, worklist, copy-paste detection, outlier, previous-value lookup, autosave)
   พอกดเข้าจึงดีเลย์หลายวินาที รู้สึกเหมือน "กดแล้วเงียบ"

## เป้าหมาย

หน้าอนุมัติเฉพาะที่ **เบา** และ **เป็นหน้าอนุมัติจริง** ไม่ใช่ฟอร์มกรอกที่ถูก lock —
แก้ทั้งปัญหาหน้าตายและความหน่วงพร้อมกัน

## แนวทางที่เลือก: ตารางสรุปผล read-only แบบเบา (Approach B)

โหลดเฉพาะข้อมูลที่คนอนุมัติต้องเห็น เรนเดอร์เป็นตารางสรุป read-only ไม่ดึง field
component ที่แก้ไขได้และ query หนักทั้งหลายมา

## รายละเอียดดีไซน์

### 1. Route & การนำทาง
- หน้าใหม่ `QCApprovalReviewPage` ที่ route **`/qc-approval/:id`** — lazy-load ใน `App.tsx`
- หน้า list `QCApproval` (`src/pages/QCApproval.tsx`): เปลี่ยนปลายทาง navigate จาก
  `/qc-testing/${p._id}` → **`/qc-approval/${p._id}`** ทั้งปุ่ม "ตรวจสอบ" และ `onRowClick`
- `QCTestingDetailPage`: เมื่อ petition `status === 'success'` →
  **`navigate('/qc-approval/:id', { replace: true })` ทันที** (กันคนหลงเข้าหน้าตายเดิม
  ผ่าน worklist tab strip หรือลิงก์เก่า) แล้ว **ลบบล็อกแผงอนุมัติ** (status==='success')
  + handler/state/dialog ที่ย้ายออก → หน้ากรอกผลโฟกัสเฉพาะการกรอก

### 2. โหลดข้อมูล (เบา)
โหลดเท่าที่จำเป็น:
- `usePetition(id)` — ตัวคำร้อง
- `api.getQCResults(id)` — ผลที่บันทึกไว้ (`values`, `valuesPhase2`)
- `api.getParameters()` filter `scope === 'qc'` — เพื่อรู้ field label / เกณฑ์มาตรฐาน /
  คำนวณธงผิดปกติรายช่อง
- `api.getAbnormalFlags([id])` — ธงผิดปกติระดับคำร้อง (ครอบ Lab + QC) ใช้ตัดสินว่าโชว์
  2 หรือ 3 ปุ่ม

**ตัดทิ้งทั้งหมด** (เทียบกับ `QCTestingDetailPage`): lastBatch `useQueries`, AI status/
analyze, worklist tab strip, copy-paste detection, outlier check, previous-value lookup,
autosave/debounce, phase editing controls

### 3. หน้าตา (read-only summary)
- ส่วนหัวคำร้อง: เลขที่ / แผนก / ผู้นำส่ง / ผู้รับงาน QC (`qcReceivedBy`) / ธงผิดปกติรวม
- ต่อรายการ (`item`) → ต่อพารามิเตอร์ (`matchParametersForItem`) → ตาราง read-only:
  **ช่อง | ค่าที่บันทึก | เกณฑ์มาตรฐาน | สถานะ (ปกติ / ⚠️ ผิดปกติ ไฮไลต์แดง) | หมายเหตุ**
- รองรับ param ที่ `hasPhases` → แสดงค่าทั้ง phase 1 และ phase 2
- กล่อง "คำอธิบายการทำใหม่" จาก `labRedoExplanation` / `qcRedoExplanation` ถ้ามี
- ใช้ helper ที่มีอยู่ล้วน: `matchParametersForItem`, `expandFieldForItem`,
  `isFieldAbnormal`, `describeStandard`, `useItemGroupMembership`

### 4. แผงตัดสิน (ยกตรรกะเดิมจาก `QCTestingDetailPage` มา ไม่เปลี่ยนพฤติกรรม)
- ผลปกติ (`!petitionHasAbnormal`) → 2 ปุ่ม:
  - **ผลถูกต้อง** → `api.approvePetition(id, actor, 'pass')`
  - **ผลไม่ถูกต้อง** → เปิด RevisionRequestDialog (retest ตาม target ที่เลือก)
- ผลผิดปกติ → 3 ปุ่ม:
  - **ยอมรับผล** → `api.approvePetition(id, actor, 'accepted-oos', note)` (ต้องมีเหตุผล)
  - **ส่งคืนผู้ส่ง** → `api.rejectPetition(id, actor, note, 'requester')`
  - **ทดสอบใหม่** → `api.rejectPetition(id, actor, note, retestTarget)`
- radio เลือกปลายทาง retest (`lab` / `qc` / `both`) + RevisionRequestDialog 3 ตัวเหมือนเดิม
- ทำเสร็จทุกปุ่ม → `toast` + `navigate('/qc-approval')`

### 5. สิทธิ์เข้าถึง
- เพิ่ม route `/qc-approval/:id` ใต้ `PrivateRoute`
- ต้องมั่นใจว่า role ที่เข้า `/qc-approval` ได้ ครอบ `/qc-approval/*` หรือ `/qc-approval/:id`
  ด้วย (access control เป็น path-based รองรับ wildcard/`:param`) — **flag ไว้เช็คตอน
  manual E2E** (เทียบเคสที่เคยเจอกับ `/lab-approval` ที่ต้องเพิ่ม path สิทธิ์)

## นอกสโคป

- `refetchInterval: 10000` global ใน `App.tsx` queryClient ที่ทำให้ทุก query ทั้งแอป
  refetch ทุก 10 วิ (ทำให้เกิดอาการ "เงียบ/ค้าง" ในหน้าอื่นด้วย) — แยกเป็นงานต่างหาก
- การแก้ bundle/code-splitting (ทำไปแล้วในรอบก่อน) ไม่เกี่ยวกับสเปคนี้

## เกณฑ์ผ่าน

- คลิกคำร้องในหน้า `/qc-approval` → ไป `/qc-approval/:id` ไม่ใช่ `/qc-testing/:id`
- หน้าอนุมัติโหลดเร็ว (ไม่มี query หนัก) แสดงค่าผล + ธงผิดปกติ + เกณฑ์ครบ
- ปุ่มตัดสินทำงานเหมือนเดิมทุกเส้นทาง (pass / oos / requester / retest lab,qc,both)
- เปิด `/qc-testing/:id` ของคำร้อง status=success → เด้งไป `/qc-approval/:id` อัตโนมัติ
- ไม่มี regression ในหน้ากรอกผล QC (`/qc-testing/:id` สำหรับ pendingReview/inProgress)
