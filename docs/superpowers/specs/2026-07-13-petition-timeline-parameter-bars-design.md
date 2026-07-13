# Petition Timeline — parameter bars (redesign)

วันที่: 2026-07-13
ไฟล์หลัก: `src/lib/petitionTimelineDetail.ts`, `src/pages/PetitionTimelineDetailPage.tsx`

## ปัญหาของของเดิม

การ์ด "Project Timeline" สร้างแถวตายตัว 7 แถว (`buildStages`) แล้วลากแท่งจาก **จุดเริ่ม timeline → เวลาของ stage นั้น** เสมอ ผลคือทุกแท่งเริ่มที่ศูนย์เหมือนกันหมด อ่านไม่ได้ว่างานแต่ละช่วง "ใช้เวลาเท่าไร" และไม่เห็นเลยว่า parameter ตัวไหนคือคอขวด

## เป้าหมาย

แต่ละแถวมี **start/end ของตัวเอง** และเปลี่ยนหน่วยของแถวจาก "สถานะรวม" เป็น **parameter รายตัว**

## แถวใน timeline (ตามลำดับ)

| # | แถว | ชนิด | เวลา |
|---|---|---|---|
| 1 | QC รับตัวอย่าง | milestone (จุดกลม) | `qcReceivedAt` |
| 2 | Lab รับตัวอย่าง | milestone | `labReceivedAt` — เฉพาะคำร้องที่มี Lab track |
| 3 | มอบหมายงาน Lab | milestone | `assignedTo.assignedAt` — เฉพาะมี Lab track |
| 4..n | **แถวละ parameter** | bar | start = รับตัวอย่างฝั่งตาม scope · end = เวลาที่ใส่ค่าล่าสุด |
| n+1 | ออกผล Lab | bar | `labCompletedAt` → `labApprovedAt` — เฉพาะมี Lab track |
| n+2 | Final Result / ส่งกลับแก้ไข | bar | `max(qcCompletedAt, labApprovedAt)` → `approvedAt` / `rejectedAt` |

แถวที่ถูกตัดออก: **บันทึกผล**, **QC ครบ**, **Lab ครบ** (เวลา QC ครบ / Lab ออกผล ยังใช้อยู่ — กลายเป็นจุด *เริ่ม* ของแท่ง ออกผล Lab และ Final Result)

กรณีคำร้อง **ไม่มี Lab track**: Final Result start = `qcCompletedAt` เฉย ๆ
แท่งไหนที่ขาด start หรือ end (เช่น ยังไม่ `labApprovedAt`) → **ไม่แสดงแท่ง** แถวโชว์ชื่ออย่างเดียว

## กติกาแถว parameter

- **รวมแถวต่อ `parameterId`** — คำร้องที่มีหลายตัวอย่าง (items) parameter ชื่อเดียวกันจะเป็นแถวเดียว ครอบทุกตัวอย่าง
- **start** = เวลารับตัวอย่างฝั่งที่รับผิดชอบ ตาม `parameter.scope`
  - `scope === "lab"` → `labReceivedAt`
  - อื่น ๆ (`qc`) → `qcReceivedAt`
  - ถ้าฝั่งนั้นไม่มีเวลารับตัวอย่าง → fallback ไปเวลารับตัวอย่างที่เร็วที่สุดของคำร้อง (จุดเริ่ม timeline)
- **end** = เวลาล่าสุดที่มีคน "แตะ" parameter นั้น ข้ามทุกตัวอย่าง
  - ใส่ค่าแรกก็ได้แท่งเลย ถ้ามีคนแก้ทีหลัง แท่งยืดตามไปถึงเวลาแก้ล่าสุด
- **แสดงแท่งเมื่อ "ครบทุกตัวอย่าง" เท่านั้น** — ถ้ายังมีตัวอย่างไหนที่ยังไม่เคยถูกแตะเลย แถวนั้นโชว์ชื่ออย่างเดียว ไม่มีแท่ง (ตรงกับกติกาทั่วไป: แถวที่ยังไม่จบ = ไม่แสดงแท่ง)
- แท่ง QC กับ Lab **แยกสี** ให้เห็นว่าใครเป็นคนทำ

## ที่มาของเวลา "ใส่ค่า parameter"

**แหล่งหลัก — audit log** (`usePetitionAuditLog`, โหลดอยู่แล้วในหน้านี้)
event `resultEntered` / `resultUpdated` มี `metadata.parameterId` + `metadata.itemSeq` + `createdAt` ครบ → join กับคู่ `itemSeq::parameterId` ได้ตรง ไม่ต้องแตะ backend

**Fallback — `QCTestResult`** (`api.getQCResults(petitionId)`)
คำร้องเก่าที่บันทึกผลไว้ *ก่อน* ระบบมี audit log ระดับ field จะไม่มี timestamp ให้วางแท่ง หน้านี้จึงต้องโหลด `qcResults` มาตั้งแต่แรก (เดิมโหลดแบบ lazy ตอนกดพิมพ์เอกสาร) แล้วใช้ `updatedAt ?? enteredAt` ของ doc คู่ `itemSeq::parameterId` เป็น end เมื่อ audit log ไม่มีข้อมูลของคู่นั้น

ผลพลอยได้: การ์ด Documents ไม่ต้องรอโหลดตอนกดปุ่มอีก (`documentDataLoaded` จริงตั้งแต่หน้าโหลดเสร็จ)

## แท็บรายวัน (day tabs) — ข้อจำกัดที่เพิ่มเข้ามา

ระหว่างเขียนสเปกนี้ มีงานอีกชุด (`2026-07-13-project-timeline-1700-tabs`) แก้ไฟล์เดียวกันไปแล้ว: timeline จบ 17:00 และ**แบ่งเป็นแท็บรายวัน** (`TimelineDetailDay[]`) ดีไซน์นี้ต่อยอดบน working tree ชุดนั้น

ของเดิมแต่ละแถวเป็น "จุด" จึงแค่เช็คว่าจุดตกวันไหน แต่แท่งกินข้ามวันได้ (รับตัวอย่างวันจันทร์ ใส่ค่าวันพุธ) กติกาคือ **ตัดแท่งตามหน้าต่างของวัน (clip) แล้วบอกว่าต่อเนื่อง**:

- แถวทั้งหมดโผล่ครบทุกแท็บ ลำดับเท่ากันเสมอ — ต่างกันแค่ "วันนี้วาดอะไร"
- milestone: เห็นเฉพาะแท็บวันที่จุดนั้นตกอยู่
- bar: เห็นในทุกวันที่ช่วงเวลาทับกับหน้าต่างวัน (08:00–17:00) โดยตัดหัว/ท้ายให้พอดีวัน
- `continuesBefore` / `continuesAfter` → ขอบแท่งด้านนั้นตัดตรง (ไม่มน) บอกว่าต่อจากวันก่อน / ต่อไปวันถัดไป
- วันที่แท่งกินทั้งวัน → แท่งเต็มความกว้าง ตัดตรงทั้งสองข้าง

## โครงสร้างข้อมูล (`petitionTimelineDetail.ts`)

แทนที่ `TimelineDetailStage` ด้วย row เดียวที่รองรับทั้งสองชนิด:

```ts
export type TimelineDetailRowKind = "milestone" | "bar";
export type TimelineDetailRowTrack = "qc" | "lab" | "stage";

export type TimelineDetailRow = {
  key: string;                 // "received-qc" | "param::<parameterId>" | "final" ...
  label: string;
  kind: TimelineDetailRowKind;
  track: TimelineDetailRowTrack;   // ใช้เลือกสีแท่ง
  at: string | null;               // milestone เท่านั้น
  startAt: string | null;          // bar เท่านั้น — null = ไม่มีแท่ง
  endAt: string | null;            // bar เท่านั้น — null = ไม่มีแท่ง
  done: boolean;
};

// row ที่ตัดเข้าหน้าต่างของวันแล้ว (ใช้ใน day tab)
export type TimelineDetailDayRow = TimelineDetailRow & {
  visible: boolean;                // วันนี้มีอะไรให้วาดไหม
  segmentStartAt: string | null;   // bar ที่ตัดเข้าวันแล้ว
  segmentEndAt: string | null;
  continuesBefore: boolean;
  continuesAfter: boolean;
};
```

- `TimelineDetailStage` → เลิกใช้ แทนด้วย `TimelineDetailRow`
- `TimelineDetailModel.timeline.stages` → `rows: TimelineDetailRow[]` (ยังไม่ตัดวัน)
- `TimelineDetailDay.stages` → `rows: TimelineDetailDayRow[]` (ตัดวันแล้ว, ครบทุกแถวเสมอ)
- ส่วนอื่นของ model (`header`, `progress`, `tasks`, `activities`, `ticks`, `days`) **ไม่เปลี่ยน**

`buildStages()` → แทนด้วย `buildRows()` ที่ประกอบจาก 3 ตัวช่วยซึ่ง unit-test แยกกันได้:

1. `buildMilestoneRows(petition)` — QC รับ / Lab รับ / มอบหมาย
2. `buildParameterRows(petition, parameters, auditLogs, qcResults, itemGroupIds, fallbackStartAt)` — แถว parameter
3. `buildClosingRows(petition)` — ออกผล Lab / Final Result

พร้อม `clipRowToDay(row, dayStartAt, dayEndAt)` สำหรับตัดแถวเข้าหน้าต่างวัน

**`TimelineDetailInput` เพิ่ม field `qcResults: QCTestResult[]`**

## การเปลี่ยนแปลงฝั่ง UI (`PetitionTimelineDetailPage.tsx`)

- โหลด `api.getQCResults(petition._id)` **ตั้งแต่หน้าโหลด** (ไม่ต้องรอกดปุ่มพิมพ์) แต่ **ไม่ block การ render** — แยกจาก `Promise.all` ของ parameters/progress เพื่อไม่ให้หน้าค้างถ้า endpoint นี้ช้า
- ตัวโหลดเอกสารเดิม (`loadDocumentData`) เปลี่ยนเป็น **dedupe ด้วย promise ref**: ถ้ามี request ค้างอยู่ให้ `await` ตัวเดิมแทนที่จะยิงซ้ำหรือคืน `false` — ทำให้กดปุ่มพิมพ์ระหว่างโหลดแล้วรอเปิดได้เอง และยิง API แค่ครั้งเดียวต่อคำร้อง
- render `activeTimelineDay.rows` (ตัดวันแล้ว):
  - `kind === "milestone"` → จุดกลมอย่างเดียว ณ ตำแหน่ง `at` (ไม่มีเส้นลากยาว)
  - `kind === "bar"` → แท่งจาก `segmentStartAt` ถึง `segmentEndAt`; `visible === false` → แถวว่าง (ชื่ออย่างเดียว)
  - `continuesBefore` / `continuesAfter` → ขอบด้านนั้นตัดตรง (`rounded-l-none` / `rounded-r-none`)
  - สีตาม `track`: qc = primary, lab = amber, stage = grey
- ความกว้างคอลัมน์ชื่อแถวขยายเป็น 180px (ตัดด้วย truncate + `title`)
- การ์ด **Tasks คงเดิม** ทุกอย่าง (แสดง filled/total ต่อคู่ item×parameter + สถานะ) — มันตอบคนละคำถามกับ timeline

## Error handling

ไม่เพิ่ม error path ใหม่ — `getQCResults` ล้มเหลวรวมเข้า `taskError` เดิม (มีปุ่ม "ลองใหม่" อยู่แล้ว) และหน้ายัง render timeline ได้ด้วย audit log อย่างเดียว

## Testing

`src/lib/petitionTimelineDetail.test.ts` (Vitest, pure) — เพิ่มเคส:

- milestone: QC/Lab รับตัวอย่าง เป็น `kind: "milestone"` และไม่มี `startAt`/`endAt`
- คำร้องไม่มี Lab track → ไม่มีแถว Lab รับตัวอย่าง / มอบหมาย / ออกผล Lab
- parameter row: start ตาม scope (qc → qcReceivedAt, lab → labReceivedAt)
- parameter row: end = audit ล่าสุด (`resultUpdated` หลัง `resultEntered` → ยืดแท่ง)
- parameter row: หลาย items — แตะไม่ครบทุก item → ไม่มีแท่ง; ครบแล้ว → end = เวลาล่าสุดข้าม item
- parameter row: ไม่มี audit → fallback `QCTestResult.updatedAt ?? enteredAt`
- ออกผล Lab: `labCompletedAt` → `labApprovedAt`; ยังไม่อนุมัติ → ไม่มีแท่ง
- Final Result: start = `max(qcCompletedAt, labApprovedAt)`, end = `approvedAt`; สถานะ rejected → label "ส่งกลับแก้ไข", end = `rejectedAt`
- แถวเดิมที่ถูกตัด (บันทึกผล / QC ครบ / Lab ครบ) ต้องไม่มีใน `rows`

`src/pages/PetitionTimelineDetailPage.test.tsx` — อัปเดต mock ให้มี `getQCResults` และยืนยันว่า render แถว parameter + ไม่มีแถว "QC ครบ" / "Lab ครบ"
