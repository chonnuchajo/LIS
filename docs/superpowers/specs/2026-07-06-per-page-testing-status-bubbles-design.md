# แยก status bubble ต่อหน้า (Lab / QC testing)

วันที่: 2026-07-06 · branch: develop

## ปัญหา

หน้า `/lab-testing` และ `/qc-testing` แสดง "สถานะ" ในตารางด้วย 2 องค์ประกอบ:

1. **Badge หลัก** (pill เดียว)
2. **Timeline** (`PetitionStatusTimeline` — แถวเม็ดกลม/bubble ต่อ step)

`PetitionStatusTimeline` ตอนนี้ render จาก `petitionStatusSteps(petition)` ซึ่งเป็น **flow รวมทั้งใบ** — รับตัวอย่าง → Assign → QC → (Lab → อนุมัติ Lab) → อนุมัติ QC — จึงเหมือนกันเป๊ะทั้ง 2 หน้า และปน track QC กับ Lab เข้าด้วยกัน

ฝั่ง Badge: หน้า Lab ใช้ `labTrackStatusBadge` (เป็น track Lab อยู่แล้ว) แต่หน้า QC ใช้ `petitionStatusBadge` ซึ่งเป็นสถานะรวม (เช่น "QC ตรวจครบ · รอส่วนอื่น", "Lab อนุมัติแล้ว · รอ QC") ไม่ใช่ track QC ล้วน

ต้องการให้ bubble ที่แสดงสถานะ (ทั้ง timeline + badge) **แยกเป็นของแต่ละหน้า** — หน้า Lab เห็นเฉพาะ track Lab, หน้า QC เห็นเฉพาะ track QC

## ขอบเขต

แก้เฉพาะ 2 หน้า `/lab-testing` และ `/qc-testing` เท่านั้น

**ไม่กระทบ** หน้าอื่นที่ใช้ `PetitionStatusTimeline` / `petitionStatusBadge` แบบรวม (คงเจตนา "เห็นภาพรวมทั้งใบ"): petition list, petition detail, dashboard, assign, lab-approval, qc-approval

## การออกแบบ

### 1. Timeline — เพิ่ม prop `track` แบบ opt-in

เพิ่ม step builder 2 ตัวใน `src/lib/receiveStatus.ts` (โมดูล per-side/track อยู่แล้ว มี `labTrackStatusBadge` + helper รับตัวอย่าง; วางที่นี่เลี่ยง circular import กับ `statusBadge.ts`):

- `labTrackStatusSteps(petition)` → รับตัวอย่าง (`labReceivedAt`) → Assign (`assignedTo`) → Lab (`labCompletedAt`) → อนุมัติ Lab (`labApprovedAt`)
- `qcTrackStatusSteps(petition)` → รับตัวอย่าง (`qcReceivedAt`) → Assign (`assignedTo`) → QC (`qcCompletedAt`) → อนุมัติ QC (`status === 'approved'`)

ทั้งคู่ (ยึด semantics เดียวกับ `petitionStatusSteps` เดิม):
- ใช้ helper `labReceivedAt`/`qcReceivedAt` (มี legacy fallback อยู่แล้ว) เป็นตัวตัดสิน step "รับตัวอย่าง"
- `closed = status ∈ {success, approved, rejected}` — step กลาง (รับตัวอย่าง/Assign/QC/Lab) นับ done เมื่อ field ตัวเองมี **หรือ** closed
- **step อนุมัติปลายทาง** ผูกกับ field ตัวเองล้วน (ไม่พึ่ง closed): "อนุมัติ Lab" done = `!!labApprovedAt`; "อนุมัติ QC" done = `status === 'approved'` — ตรงกับที่ `petitionStatusSteps` ทำ (ใบ rejected จึงไม่โชว์ bubble อนุมัติเป็นเขียว)
- `current` = step แรกที่ยังไม่ done

`src/components/lis/PetitionStatusTimeline.tsx` เพิ่ม prop `track?: 'lab' | 'qc'`:
- ไม่ส่ง track → `petitionStatusSteps(petition)` (timeline รวมเดิม — caller อื่นไม่ต้องแก้)
- `track='lab'` → `labTrackStatusSteps`, `track='qc'` → `qcTrackStatusSteps`

หน้า `LabTestingPage` ส่ง `<PetitionStatusTimeline petition={p} compact track="lab" />`
หน้า `QCTestingPage` ส่ง `<PetitionStatusTimeline petition={p} compact track="qc" />`

### 2. Badge หลัก

- **QC page**: เพิ่ม `qcTrackStatusBadge(p)` ใน `receiveStatus.ts` คู่ขนานกับ `labTrackStatusBadge`:
  - `!qcReceivedAt(p)` → warning "รอรับ"
  - status ∈ `success/approved/rejected` → `statusBadge(status)` (label ตาม config)
  - `qcCompletedAt` → warning "QC ตรวจครบ · รออนุมัติ"
  - status `inProgress` → info "QC กำลังตรวจ"
  - อื่นๆ → `statusBadge(status)`

  `QCTestingPage` เปลี่ยนจาก `petitionStatusBadge(p)` → `qcTrackStatusBadge(p)`

- **Lab page**: `labTrackStatusBadge` **คงเดิมทั้งหมด** — รวม "Lab อนุมัติแล้ว · รอ QC" (ผู้ใช้ต้องการเก็บ hint ว่าค้างที่ QC ไว้)

### 3. Test

เพิ่ม unit test ใน `src/lib/receiveStatus.test.ts`:
- `qcTrackStatusBadge`: รอรับ / QC กำลังตรวจ / QC ตรวจครบ · รออนุมัติ / approved
- `labTrackStatusSteps` + `qcTrackStatusSteps`: จำนวน step, done/current ตาม field, กรณี status ปิด

## ไฟล์ที่แตะ

| ไฟล์ | เปลี่ยน |
|---|---|
| `src/lib/receiveStatus.ts` | เพิ่ม `qcTrackStatusBadge`, `labTrackStatusSteps`, `qcTrackStatusSteps` |
| `src/components/lis/PetitionStatusTimeline.tsx` | เพิ่ม prop `track?: 'lab' \| 'qc'` |
| `src/pages/LabTestingPage.tsx` | ส่ง `track="lab"` |
| `src/pages/QCTestingPage.tsx` | ใช้ `qcTrackStatusBadge` + ส่ง `track="qc"` |
| `src/lib/receiveStatus.test.ts` | เพิ่ม test |

## ยืนยันไม่กระทบที่อื่น

`grep` แล้ว caller ของ `PetitionStatusTimeline` (ไม่ส่ง track) และ `petitionStatusBadge` ที่หน้าอื่นทั้งหมดคงพฤติกรรมเดิม เพราะ prop เป็น opt-in และไม่ได้แก้ signature/logic ของ `petitionStatusSteps`/`petitionStatusBadge`
