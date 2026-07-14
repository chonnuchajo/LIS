# Petition Timeline: แยกแถว "ยื่นคำขอ" ออกจาก "ส่งตัวอย่าง"

วันที่: 2026-07-14
สถานะ: approved

## ปัญหา

แถวแรกของ timeline detail (`buildMilestoneRows` ใน `src/lib/petitionTimelineDetail.ts`) ชื่อ **"ส่งตัวอย่าง"** แต่ดึงเวลาจาก `submittedBy.submittedAt ?? createdAt` ซึ่งคือเวลาที่ *กรอก/ยื่นคำขอ* ไม่ใช่เวลาที่ตัวอย่างถูกนำส่งจริง

เวลาส่งตัวอย่างจริงมีเก็บอยู่แล้วในฟิลด์ `sampleSentAt` (เขียนโดย `PATCH /petitions/:id/deliver` ตอนสแกนส่งตัวอย่าง) แต่ timeline detail ไม่เคยอ่านมันเลย ผลคือช่วงเวลา "ยื่นคำขอ → ส่งตัวอย่างถึงมือ QC" หายไปจากกราฟทั้งหมด

## เป้าหมาย

แยกเป็นสอง milestone เพื่อให้เห็นช่วงรอส่งตัวอย่างของจริง

## ขอบเขต

แก้ `buildMilestoneRows` ใน `src/lib/petitionTimelineDetail.ts` และเทสต์ `src/lib/petitionTimelineDetail.test.ts` เท่านั้น
`PetitionTimelineDetailPage.tsx` เรนเดอร์แถวจาก model อยู่แล้ว — เพิ่ม row ในโมเดลแล้วหน้าจอขึ้นเอง ไม่ต้องแก้

## แถว milestone หลังแก้ (4 → 5)

| key | label | เวลาที่ใช้ | เงื่อนไข |
| --- | --- | --- | --- |
| `submitted` | ยื่นคำขอ | `submittedBy.submittedAt ?? createdAt` | ทุกคำขอ |
| `sample-sent` | ส่งตัวอย่าง | `sampleSentAt` ?? เวลารับตัวอย่างที่เร็วสุด (`qcReceivedAt`, `receivedAt`, `labReceivedAt`) | ทุกคำขอ |
| `received-qc` | QC รับตัวอย่าง | `qcReceivedAt ?? receivedAt` | ทุกคำขอ |
| `assigned` | มอบหมายงาน Lab | `assignedTo.assignedAt` | เฉพาะคำขอที่มี Lab track |
| `received-lab` | Lab รับตัวอย่าง | `labReceivedAt` | เฉพาะคำขอที่มี Lab track |

แถว bar (`QC กำลังวิเคราะห์`, `Lab กำลังวิเคราะห์`, `Pre Result`, `Final Result`) ไม่เปลี่ยน

## พฤติกรรมของ `sample-sent`

- มี `sampleSentAt` → ใช้ค่านั้น, `done: true`
- ไม่มี `sampleSentAt` แต่รับตัวอย่างแล้ว → fallback เป็นเวลารับที่เร็วสุด (ใช้ `firstValidDate(qcReceivedAt, receivedAt, labReceivedAt)`), `done: true` — คำขอเก่า/เคสที่ข้ามการสแกนจะเห็นจุด `sample-sent` กับ `received-qc` ชิดกัน ซึ่งสื่อตรง ๆ ว่าไม่มีข้อมูลช่วงส่ง
- ไม่มีทั้ง `sampleSentAt` และเวลารับใด ๆ → `at: null`, `done: false` (จุดว่าง เหมือน milestone อื่นที่ยังไม่ถึง)

## สิ่งที่ไม่เปลี่ยน

- จุดเริ่มแกนเวลา (`timelineStartAt`) ยังเป็นเวลายื่นคำขอ (เดิมก็เป็นค่านี้อยู่แล้ว)
- `header.startAt` / `startKind` ยังนับจากเวลารับตัวอย่างเหมือนเดิม
- activities / tasks / progress ไม่แตะ

## เทสต์ (TDD)

เพิ่มใน `src/lib/petitionTimelineDetail.test.ts`

1. คำขอที่มี `sampleSentAt` → row `sample-sent` มี `at` = `sampleSentAt`, `done: true`
2. ไม่มี `sampleSentAt` แต่มี `qcReceivedAt` → row `sample-sent` fallback ไปที่ `qcReceivedAt`
3. ไม่มีทั้งคู่ → row `sample-sent` มี `at: null`, `done: false`
4. ลำดับ key ของ milestone rows = `submitted`, `sample-sent`, `received-qc`, `assigned`, `received-lab` (คำขอที่มี Lab) และ `submitted`, `sample-sent`, `received-qc` (คำขอ QC ล้วน)
5. label ของ `submitted` = "ยื่นคำขอ" (เทสต์เดิมที่คาด "ส่งตัวอย่าง" ที่ key `submitted` ต้องอัปเดต)
