# Petition Timeline: แถวตามด่านงาน แทนแถวราย parameter

วันที่: 2026-07-14
สถานะ: อนุมัติแล้ว (รอ implement)
ไฟล์หลัก: `src/lib/petitionTimelineDetail.ts`, `src/pages/PetitionTimelineDetailPage.tsx`

## ปัญหา

กราฟ Petition Timeline ตอนนี้วาดแท่งราย parameter (หนึ่งแถวต่อหนึ่ง parameter ที่ตรงกับตัวอย่าง) ทำให้แถวเยอะจนอ่านภาพรวมไม่ออก และไม่เห็นด่านสำคัญของงานจริง ๆ ทั้งที่รายละเอียดราย parameter มีอยู่แล้วในการ์ด Tasks ด้านล่าง

นอกจากนี้ลำดับ milestone ยังผิดจากงานจริง (Lab รับตัวอย่าง มาก่อน มอบหมายงาน Lab) และไม่มีจุด "ส่งตัวอย่าง" ซึ่งเป็นจุดเริ่มต้นของคำร้อง

## เป้าหมาย

Timeline อ่านแล้วเห็นด่านงาน 8 แถวคงที่: ส่ง → QC รับ → มอบหมาย → Lab รับ → QC วิเคราะห์ → Lab วิเคราะห์ → Pre Result → Final Result

## แถวใน Timeline (ใหม่ทั้งชุด)

ทุกแถวมาจาก timestamp ระดับคำร้อง ไม่มีแถวราย parameter อีกแล้ว

| # | key | label | kind | track | เริ่ม | จบ | เงื่อนไข |
|---|-----|-------|------|-------|------|-----|---------|
| 1 | `submitted` | ส่งตัวอย่าง | milestone | stage | `submittedBy.submittedAt` ?? `createdAt` | — | เสมอ |
| 2 | `received-qc` | QC รับตัวอย่าง | milestone | stage | `qcReceivedAt` ?? `receivedAt` | — | เสมอ |
| 3 | `assigned` | มอบหมายงาน Lab | milestone | stage | `assignedTo.assignedAt` | — | `hasLabTrack` |
| 4 | `received-lab` | Lab รับตัวอย่าง | milestone | stage | `labReceivedAt` | — | `hasLabTrack` |
| 5 | `qc-analyzing` | QC กำลังวิเคราะห์ | bar | qc | `qcReceivedAt` ?? `receivedAt` | `qcCompletedAt` ?? now | เสมอ |
| 6 | `lab-analyzing` | Lab กำลังวิเคราะห์ | bar | lab | `labReceivedAt` | `labCompletedAt` ?? now | `hasLabTrack` |
| 7 | `pre-result` | Pre Result | bar | lab | `labCompletedAt` | `labApprovedAt` | `hasLabTrack` |
| 8 | `final` | Final Result / ส่งกลับแก้ไข | bar | stage | เดิม | เดิม | เสมอ |

- แถว 3 กับ 4 สลับตำแหน่งจากของเดิม (มอบหมายก่อน แล้ว Lab ถึงรับ) ตามลำดับงานจริง
- แถว 7 คือแถว `lab-approved` เดิม เปลี่ยน key เป็น `pre-result` และ label จาก "ออกผล Lab" เป็น "Pre Result"
- แถว 8 (`final`) ตรรกะเดิมทั้งหมด: เริ่มเมื่อทั้งสองฝั่งจบ (`hasLab` ต้องรอทั้ง `qcCompletedAt` และ `labApprovedAt`), จบที่ `approvedAt` หรือ `rejectedAt`

### แท่งที่ยังไม่จบ (in-progress)

`makeBarRow` เดิมวาดแท่งเฉพาะเมื่อมีทั้งเวลาเริ่มและเวลาจบ (`done = start && end`) แถว 5 กับ 6 ต้องวาดได้ทั้งที่ยังไม่จบ:

- ไม่มีเวลาเริ่ม (ยังไม่รับตัวอย่าง) → ไม่วาดแท่ง (`startAt`/`endAt` = null, `done` = false)
- มีเวลาเริ่ม แต่ยังไม่จบ → วาดแท่งจากเวลาเริ่มถึง `now`, `done` = false
- จบแล้ว → วาดแท่งเต็มช่วง, `done` = true

`done` ยังคงความหมาย "จบแล้ว" ไม่ใช่ "มีแท่ง" — โครง `TimelineDetailRow` ไม่เพิ่ม field ใหม่

การ render (`barTrackClass` ใน `PetitionTimelineDetailPage.tsx`) แยกสามกรณี:

- แท่งจบแล้ว: สีเข้มตาม track เหมือนเดิม (`bg-primary-500` / `bg-amber-500` / `bg-grey-400`) ปลายมน
- แท่งกำลังทำ: สีอ่อนของ track เดียวกัน (`bg-primary-200` / `bg-amber-200`) และตัดปลายขวาให้ตรง (`rounded-r-none`) สื่อว่ายังไม่ปิด
- ไม่มีแท่ง: ไม่ render (เหมือนเดิม — `start`/`width` เป็น null)

หมายเหตุ: `rounded-r-none` ของแท่ง in-progress ต้องไม่ชนกับ `continuesBefore`/`continuesAfter` ที่ใช้ตัดขอบแท่งข้ามวันอยู่แล้ว — ทั้งสองใช้ class เดียวกันได้ ไม่ขัดกัน

## ช่วงเวลาของ timeline

- `timelineStartAt` = เวลาที่เก่าสุดระหว่างวันส่งตัวอย่างกับวันรับตัวอย่าง → ใช้เป็นจุดเริ่มของ `timeline.startAt`, `ticks` และ `days` (ยังปัดลงไป 08:00 ของวันนั้นเหมือนเดิม)
- `header` **ไม่เปลี่ยน**: `startAt`/`startKind` ยังเป็นเวลารับตัวอย่าง (ถอยไปใช้เวลาส่งเมื่อยังไม่มีใครรับ) เพื่อให้ Metric "Start time" บนการ์ดคงความหมายเดิม
- `header.endAt` ยังเป็นปลายของ timeline เหมือนเดิม

ผลข้างเคียงที่ยอมรับ: ถ้าส่งตัวอย่างคนละวันกับวันรับ จะมีแท็บวันเพิ่มมาที่มีแค่จุดส่งตัวอย่าง

## โค้ดที่ลบออก

- `buildParameterRows` และ `buildParameterTouches` ใน `petitionTimelineDetail.ts` (ราว 65 บรรทัด)
- input `qcResults` ของ `TimelineDetailInput` (มีแต่สองฟังก์ชันข้างบนใช้) และ import `QCTestResult` — หน้าเพจยังโหลด `qcResults` ไว้ให้เอกสาร print ต่อไป แค่เลิกส่งเข้า `buildTimelineDetailModel`
- helper `latestValidDate` ยังใช้ต่อ (แถว `final`), `matchParametersForItem` ยังใช้ต่อ (การ์ด Tasks)

## สิ่งที่ไม่แตะ

- การ์ด Tasks (ลิสต์ราย parameter + ความคืบหน้า) และ `buildRequiredTasks` คงเดิมทั้งหมด
- การ์ด Recent Activity, Documents, ปุ่ม print ทั้งหมด
- `progress` / `overallProgress` และการกรองตาม `itemSeq` คงเดิม

## ผลกับแท็บตัวอย่าง

แท็บตัวอย่างจะไม่เปลี่ยนกราฟ timeline อีกแล้ว เพราะทุกแถวมาจาก timestamp ระดับคำร้อง เหลือคุมแค่การ์ด Tasks กับ Metric/Progress — เป็นผลที่ยอมรับตามสเปกนี้ `itemSeq` ยังคงเป็น input ของ model ต่อไป (ใช้กรอง tasks)

## เทสต์

ลบเทสต์แท่ง parameter ใน `src/lib/petitionTimelineDetail.test.ts` (เคส "ลากแท่ง parameter…", "ยืดแท่ง parameter…", "แถว parameter ฝั่ง Lab…", "รวมหลายตัวอย่างเป็นแถวเดียว…", "ใช้เวลาจาก QCTestResult…", "ใช้เวลาจาก audit log เป็นหลัก…", "วาดแท่ง parameter ของตัวอย่างที่เลือก…") และเคส "วาดแท่ง parameter จากผลที่บันทึกไว้ใน QCTestResult ของคำร้องเก่า" ใน `src/pages/PetitionTimelineDetailPage.test.tsx` พร้อมปรับเคสที่ยืนยันลำดับแถว/การกรองตามตัวอย่างให้ตรงชุดแถวใหม่

เทสต์ใหม่ที่ต้องมี:

1. ลำดับแถวครบ 8 แถวตามตาราง สำหรับคำร้องที่มี Lab
2. คำร้องไม่มี Lab เหลือ 4 แถว (ส่งตัวอย่าง, QC รับตัวอย่าง, QC กำลังวิเคราะห์, Final Result)
3. จุดส่งตัวอย่างขยายช่วง timeline ให้เริ่มก่อนวันรับตัวอย่าง แต่ `header.startAt` ยังเป็นเวลารับ
4. แท่ง QC/Lab กำลังวิเคราะห์ที่ยังไม่จบ ลากถึง `now` และ `done` = false
5. แท่ง QC/Lab กำลังวิเคราะห์ที่จบแล้ว จบที่ `qcCompletedAt` / `labCompletedAt` และ `done` = true
6. ยังไม่รับตัวอย่าง → ไม่วาดแท่งวิเคราะห์ของฝั่งนั้น
7. แถว Pre Result ลากจาก `labCompletedAt` ถึง `labApprovedAt`
8. หน้าเพจ: แท่ง in-progress ได้ class สีอ่อนและปลายขวาตรง
