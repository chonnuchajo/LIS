# Petition Timeline — แต่ละสถานะเป็นช่วงเวลา (stage durations)

วันที่: 2026-07-14
สถานะ: อนุมัติดีไซน์แล้ว รอ implement

## ปัญหา

กราฟ Petition Timeline (`/petitions/:id/timeline`) วันนี้ปนกัน 2 แบบ: บางสถานะเป็น "จุด" (ยื่นคำขอ, ส่งตัวอย่าง, QC รับตัวอย่าง, มอบหมายงาน Lab, Lab รับตัวอย่าง) บางสถานะเป็น "แท่ง" (QC/Lab กำลังวิเคราะห์, Pre Result, Final Result)

ผลคือดูไม่ออกว่า **แต่ละขั้นกินเวลาไปเท่าไหร่** — เห็นแค่ว่าเกิดขึ้นตอนไหน ทั้งที่คำถามจริงของหัวหน้าคือ "ค้างอยู่ขั้นไหนนานสุด"

นอกจากนี้ "Pre Result" ปัจจุบันผูกกับการออกผลของหัวหน้า Lab (`labCompletedAt → labApprovedAt`) ซึ่งไม่ตรงกับนิยามที่ใช้งานจริง

## เป้าหมาย

ทุกสถานะเป็น **ช่วงเวลา** ที่ลากจากเวลาที่ตัวเองเกิด ไปจนถึงเวลาที่สถานะถัดไปเริ่ม — ยกเว้น Final Result ที่เป็นจุดปิดงาน

## โครงแถวใหม่

เคสมี Lab — 8 แถว

| # | `row.key` | label | kind | เริ่ม | จบ |
|---|-----------|-------|------|------|-----|
| 1 | `submitted` | ยื่นคำขอ | bar | `submittedBy.submittedAt ?? createdAt` | `sampleSentAt` |
| 2 | `sample-sent` | ส่งตัวอย่าง | bar | `sampleSentAt` | เร็วสุดของ (`qcStartAt`, `assignedAt`) |
| 3 | `assigned` | มอบหมายงาน Lab | bar | `assignedTo.assignedAt` | `labStartAt` |
| 4 | `qc-analyzing` | QC กำลังวิเคราะห์ | bar | `qcStartAt` | `qcCompletedAt` |
| 5 | `lab-analyzing` | Lab กำลังวิเคราะห์ | bar | `labStartAt` | `labCompletedAt` |
| 6 | `lab-approval` | ออกผล Lab | bar | `labCompletedAt` | `labApprovedAt` |
| 7 | `pre-result` | Pre Result | bar | `max(qcCompletedAt, labCompletedAt)` | `closedAt` |
| 8 | `final` | Final Result | **milestone** | `closedAt` | — |

เคส QC-only (`hasLabTrack(petition) === false`) — ตัดแถว 3, 5, 6 ทิ้ง เหลือ 5 แถว; แถว `sample-sent` จบที่ `qcStartAt` และ `pre-result` เริ่มที่ `qcCompletedAt`

นิยามที่อ้างถึงข้างบน:

- `qcStartAt` = `qcReceivedAt ?? receivedAt` (เวลา QC รับตัวอย่าง = เวลาเริ่มวิเคราะห์)
- `labStartAt` = `labReceivedAt`
- `closedAt` = `approvedAt ?? rejectedAt` — หัวหน้า QC ออก Final Result หรือส่งกลับแก้ไข

แถว "QC รับตัวอย่าง" (`received-qc`) และ "Lab รับตัวอย่าง" (`received-lab`) **ถูกตัดออกจากกราฟ** แต่ timestamp ยังถูกใช้เป็นจุดเริ่มของแท่งวิเคราะห์ตามตารางข้างบน

## กติกาสถานะของแท่ง

- **มี start + มี end** → แท่งเต็ม `done = true` สีเข้ม
- **มี start แต่ end ยังไม่เกิด** → ลากถึง `now`, `done = false` → สีอ่อน + ปลายขวาตรง (`rounded-r-none`) ตามกลไกเดิมของหน้า
- **ไม่มี start** → แถวยังอยู่ในลิสต์ (เห็น label ซ้าย) แต่ไม่วาดแท่ง (`startAt`/`endAt` = `null`)
- ถ้า start มาหลัง end (ข้อมูลเพี้ยน) → ยุบเป็นแท่งสั้นที่ end ตามพฤติกรรม `makeBarRow()` เดิม

จุด `final`: `done = !!closedAt` — ยังไม่ปิดงาน = ไม่มีเวลาให้วางจุด จึงไม่วาดจุดเลย (เห็นแค่ label ซ้าย) ไม่ใช่จุดเทา

## เคสถูกส่งกลับแก้ไข (rejected)

- `pre-result` จบที่ `rejectedAt` (ผ่าน `closedAt`)
- จุด `final` เปลี่ยน label เป็น "ส่งกลับแก้ไข" และใช้สีแดง (`bg-red-500`) — ตรรกะเดิมใน `timelineBarClass`/`timelineDotClass` ต้องรองรับ rejected สำหรับ **จุด** ด้วย ไม่ใช่แค่แท่ง

## ข้อมูลเก่าที่ timestamp มีรู (คง fallback เดิม)

คำร้องในระบบจริงมี timestamp ขาดเป็นช่วง ๆ (สแกนรับตัวอย่างไม่ครบ ฯลฯ) ถ้าไม่ fallback แท่งจะหายทั้งที่งานทำจริง กติกาเดิมที่ต้องรักษาไว้:

- `sampleSentAt` ว่าง → ถอยไปใช้เวลารับตัวอย่างที่เร็วสุด (`qcReceivedAt`/`receivedAt`/`labReceivedAt`)
- `qcStartAt` ว่าง **แต่มี** `qcCompletedAt` → ถอยไปใช้จุดเริ่มกราฟ (`timelineStartAt`)
- `labStartAt` ว่าง **แต่มี** `labCompletedAt` → ถอยไปใช้ `assignedTo.assignedAt` แล้วค่อยจุดเริ่มกราฟ
- ยังไม่จบ + ยังไม่มีเวลารับตัวอย่าง = ยังไม่เริ่มจริง → **ห้าม** fallback (ปล่อยไม่มีแท่ง)

## สีประจำแถว

อัปเดต `ROW_COLORS` ใน `src/lib/petitionTimelineColors.ts`: ตัด key `received-qc` / `received-lab`, เพิ่ม `lab-approval`

| `row.key` | solid | soft |
|-----------|-------|------|
| `submitted` | `bg-violet-500` | `bg-violet-200` |
| `sample-sent` | `bg-orange-500` | `bg-orange-200` |
| `assigned` | `bg-rose-500` | `bg-rose-200` |
| `qc-analyzing` | `bg-primary-500` | `bg-primary-200` |
| `lab-analyzing` | `bg-amber-500` | `bg-amber-200` |
| `lab-approval` | `bg-lime-600` | `bg-lime-200` |
| `pre-result` | `bg-cyan-500` | `bg-cyan-200` |
| `final` | `bg-emerald-500` | `bg-emerald-200` |

ข้อจำกัด Tailwind (จาก spec สีเดิม): `tailwind.config.ts` override `red`/`green`/`yellow` ให้เหลือแค่เฉด `50`/`500` → ห้ามใช้ `red-200`/`green-200`/`yellow-200`; class ต้องเขียนเป็น literal เต็ม ห้ามประกอบด้วย template string

`timelineDotClass(rowKey, { done, rejected })` ต้องคืน `bg-red-500` เมื่อ `rowKey === "final" && rejected && done` (ของเดิมเช็ค rejected เฉพาะใน `timelineBarClass`)

## โครงสร้างโค้ด

**`src/lib/petitionTimelineDetail.ts`**

ยุบ `buildMilestoneRows()` + `buildAnalyzingRows()` + `buildClosingRows()` เหลือ **`buildStageRows(petition, now, fallbackStartAt): TimelineDetailRow[]`** ตัวเดียว — แถวทั้งหมดเป็นลำดับต่อเนื่องที่ end ของแถวหนึ่งคือ start ของแถวถัดไป การแยกเป็น 3 ฟังก์ชันทำให้ต้องส่งเวลาข้ามฟังก์ชันไปมา

ฟิลด์ `track` ในโมเดล (`"qc" | "lab" | "stage"`) คงไว้ — ยังใช้ระบุสายงานในที่อื่น; `lab-approval` = track `lab`, `pre-result`/`final`/`submitted`/`sample-sent` = track `stage`

**`src/pages/PetitionTimelineDetailPage.tsx`**

- ลบ `barTrackClass()`
- จุด: `timelineDotClass(row.key, { done: row.done, rejected: petition.status === "rejected" })`
- แท่ง: `timelineBarClass(row.key, { done: row.done, rejected: petition.status === "rejected" })`

`buildTimelineDays()` / `clipRowToDay()` / progress / tasks / activities — **ไม่แตะ** โครงแถวใหม่ยังเป็น `TimelineDetailRow` ชุดเดิม การตัดข้ามวันทำงานได้อยู่แล้ว

## เทสต์

`src/lib/petitionTimelineDetail.test.ts`

1. เคสมี Lab ครบทุก timestamp → ได้ 8 แถวตามลำดับ key ที่กำหนด และ end ของแต่ละแถวตรงกับ start ของแถวถัดไป
2. เคส QC-only → 5 แถว ไม่มี `assigned` / `lab-analyzing` / `lab-approval`
3. ไม่มีแถว `received-qc` / `received-lab` อีกแล้ว
4. `sample-sent` จบที่ค่าที่เร็วกว่าระหว่าง `qcReceivedAt` กับ `assignedAt` (ทดสอบทั้งสองทิศ)
5. `pre-result` เริ่มที่ `max(qcCompletedAt, labCompletedAt)` (ทดสอบทั้งกรณี Lab จบก่อนและ QC จบก่อน)
6. `pre-result` ที่ยังไม่ปิดงาน → `endAt ≈ now`, `done === false`
7. `final` เป็น `kind: "milestone"` ที่ `at === approvedAt`; ยังไม่ปิด → `done === false`
8. rejected → `pre-result` จบที่ `rejectedAt`, `final.label === "ส่งกลับแก้ไข"`
9. fallback ข้อมูลเก่า: มี `qcCompletedAt` แต่ไม่มี `qcReceivedAt` → แท่ง `qc-analyzing` ยังโผล่; ยังไม่จบ + ไม่มี receive → ไม่มีแท่ง

`src/lib/petitionTimelineColors.test.ts` — อัปเดต key set (8 key, solid ไม่ซ้ำ), เพิ่มเคส `final` + rejected สำหรับ `timelineDotClass`

`src/pages/PetitionTimelineDetailPage.test.tsx` — เทสต์ที่อ้าง label "QC รับตัวอย่าง"/"Lab รับตัวอย่าง" ในกราฟต้องถูกลบ/แก้ (label เดิมยังโผล่ในฝั่ง Activity log ได้ ระวังอย่าไปแก้ผิดที่)

## นอกขอบเขต

- `PetitionStatusTimeline` (คนละคอมโพเนนต์ ใช้ในหน้า Detail) ไม่แตะ
- Audit log / Activity feed ไม่แตะ — "QC รับตัวอย่าง" ยังเป็น event ใน log ตามเดิม
- progress bar และตาราง Parameter ด้านล่างกราฟ ไม่แตะ
- backend ไม่แตะ — ไม่มี field ใหม่
