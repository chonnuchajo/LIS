# Post-Test Approval Flow — Design

วันที่: 2026-06-12
สาขา: develop

## ปัญหา

Flow หลังการตรวจ (ด่านหัวหน้า QC) ปัจจุบันแสดงปุ่มตัดสินใจชุดเดียวกันทุกกรณี
(อนุมัติ + ส่งกลับ 3 ทาง) ไม่แยกตาม "ผลปกติ / ผลไม่ปกติ" และยังขาดหน้า
ประวัติผลวิเคราะห์ ทำให้ flow ทำงานไม่ตรงกับกระบวนการจริงของแล็บ

## เป้าหมาย

ปุ่มตัดสินใจของหัวหน้า QC ต้องเปลี่ยนตามผลว่าปกติหรือไม่ปกติ และคำร้องที่จบ
กระบวนการต้องไปรวมอยู่ในหน้า "ผลวิเคราะห์" เป็นประวัติ

## บริบทของ flow ปัจจุบัน (ไม่แก้)

- หลัง assign → เจ้าหน้าที่รับงาน → ทดสอบ → เจ้าหน้าที่ Lab ใส่ค่า+ยืนยันผล (`labCompletedAt`)
- คำร้องยืนยันจาก Lab → คิว "อนุมัติผล Lab" → หัวหน้า Lab อนุมัติ (`labApprovedAt`)
- Gate: `isPetitionComplete()` ต้องการ `qcCompletedAt` **และ** `labApprovedAt`
  (ถ้ามี lab item) ก่อนคำร้องจะขึ้น status `success` เข้าคิวอนุมัติ QC
  → ถ้า QC ยังไม่บันทึกผล จะยังไม่ไปอนุมัติ QC (ถูกต้องอยู่แล้ว)

## โมเดลสถานะ — ส่วนที่เปลี่ยน

ใช้ status เดิมต่อ (`approved` / `rejected` = terminal, `inProgress` = ส่งกลับทดสอบ)
เพิ่มฟิลด์บน `Petition`:

- `conclusion: enum('pass' | 'accepted-oos' | 'returned-to-requester')`
  ผลสรุปสุดท้าย ไว้แสดงในหน้าผลวิเคราะห์
- `conclusionNote: String` — เหตุผล/คำแนะนำ (ตอนยอมรับผลไม่ปกติ หรือตอนส่งคืนผู้ส่ง)

แม็ปสถานะ:

| การตัดสิน | status | conclusion |
|-----------|--------|------------|
| ผลถูกต้อง (ปกติ) | approved | pass |
| ยอมรับผล (ไม่ปกติ) | approved | accepted-oos |
| ส่งคืนผู้ส่งแก้ product | rejected | returned-to-requester |
| ผลไม่ถูกต้อง / ทดสอบใหม่ | inProgress | (ไม่ตั้ง — ยังไม่จบ) |

retest target รองรับค่าใหม่ `both` (เดิมมีแค่ `lab` / `qc`):
- `lab` → reset `labCompletedAt` / `labApprovedAt`
- `qc` → reset `qcCompletedAt`
- `both` → reset ทั้งสอง track
ทุกกรณีกลับ status `inProgress` + เก็บ note ในฟิลด์ return note เดิม

## ปุ่มตัดสินใจหน้าอนุมัติ QC (context-aware)

หน้า `QCTestingDetailPage` ตอน `status==='success'` เช็คก่อนว่าคำร้องมีผลไม่ปกติไหม
(ทั้ง Lab และ QC) แล้วแสดงปุ่มต่างชุด:

### กรณี A — ผลปกติทุกอย่าง (ไม่มี abnormal)
- **ผลถูกต้อง** → `approve('pass')` → status `approved`
- **ผลไม่ถูกต้อง** → dialog เลือก Lab/QC/ทั้งคู่ + หมายเหตุ → `sendRetest(target, note)`
  → status `inProgress` (ไม่ยุ่งผู้ส่ง)

### กรณี B — มีผลไม่ปกติอย่างน้อย 1 ค่า
- **ยอมรับผล** → บังคับใส่เหตุผล → `approve('accepted-oos', note)` → status `approved`
- **ส่งคืนผู้ส่งแก้ product** → บังคับใส่คำแนะนำ → `returnToRequester(note)`
  → status `rejected`, conclusion `returned-to-requester`
- **ทดสอบใหม่** → dialog เลือก Lab/QC/ทั้งคู่ + หมายเหตุ → `sendRetest(target, note)`
  → status `inProgress`

### action ใต้ปุ่ม (มี 3 อย่างจริง)
- `approve(conclusion, note?)` — ผลถูกต้อง / ยอมรับผล
- `returnToRequester(note)` — ส่งคืนผู้ส่ง
- `sendRetest(target, note)` — ผลไม่ถูกต้อง / ทดสอบใหม่ (target = lab|qc|both)

> "ผลไม่ถูกต้อง" และ "ทดสอบใหม่" เป็น action เดียวกัน (`sendRetest`) ป้ายต่างตามบริบท

### การตัดสิน ปกติ/ไม่ปกติ
ใช้ตัวเช็ค abnormal ที่มีอยู่ (`GET /api/qc-results/abnormal-flags`) แต่ต้องครอบคลุม
**ทั้ง Lab และ QC**. ตอนทำ plan ต้อง verify ว่าฝั่ง Lab (physical-results) มี abnormal
detection ครบหรือไม่ ถ้าขาดต้องเติมให้การตัดสิน "ปกติทุกอย่าง" ถูกต้อง

## หน้า "ผลวิเคราะห์" (ประวัติ)

หน้าใหม่ route `/analysis-results` — ประวัติคำร้องที่จบกระบวนการแล้ว

- แสดงคำร้องที่ terminal: status ∈ {`approved`, `rejected`} ที่มี `conclusion`
- ตาราง: เลขคำร้อง / แผนก / ผู้ส่ง / ผู้ทดสอบ / วันที่จบ / ผลสรุป (badge ตาม conclusion):
  - ผ่าน (`pass`) — เขียว
  - ยอมรับผลไม่ปกติ (`accepted-oos`) — เหลือง
  - ส่งคืนผู้ส่ง (`returned-to-requester`) — ส้ม
- ค้นหา/กรอง: แผนก, ผลสรุป, ช่วงวันที่
- คลิกแถว → ดูรายละเอียดผล (read-only) + `conclusionNote`
- Backend: ใช้ `GET /api/petitions` เดิม เพิ่ม filter terminal + `conclusion`
  (verify ตอน plan ว่า list เดิมรับ filter พวกนี้ได้ ถ้าไม่ได้ค่อยเติม)
- Nav: เพิ่มเมนู "ผลวิเคราะห์" ใน `src/lib/navItems.ts` + สิทธิ์ path `/analysis-results`

## สรุปงานที่ต้องทำ

| # | งาน | ชนิด |
|---|-----|------|
| 1 | เพิ่มฟิลด์ `conclusion` + `conclusionNote` ใน Petition model | backend |
| 2 | รองรับ retest target = `both` (reset ทั้งสอง track) | backend |
| 3 | endpoint อนุมัติ/ส่งคืน/ส่ง-retest set `conclusion` ให้ถูก | backend |
| 4 | verify abnormal detection ครอบทั้ง Lab + QC | backend |
| 5 | ปุ่ม context-aware (ปกติ/ไม่ปกติ) ใน QCTestingDetailPage | frontend |
| 6 | dialog เลือก Lab/QC/ทั้งคู่ + หมายเหตุ สำหรับ sendRetest | frontend |
| 7 | หน้า `/analysis-results` + nav + สิทธิ์ | frontend |

## นอกขอบเขต (YAGNI)

- ไม่สร้าง endpoint ใหม่ถ้า list เดิมรองรับ filter ได้
- ไม่แตะ flow ก่อนด่านหัวหน้า QC (assign / รับงาน / ทดสอบ / อนุมัติ Lab)
- การส่งคืนผู้ส่ง = ปิดงานคำร้องนี้ (ผู้ส่งยื่นใหม่เองถ้าจะทดสอบซ้ำ) ไม่สร้างคำร้องใหม่อัตโนมัติ
