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
```

`TimelineDetailModel.timeline.stages` → เปลี่ยนชื่อเป็น `rows` (ชนิด `TimelineDetailRow[]`)
ส่วนอื่นของ model (`header`, `progress`, `tasks`, `activities`, `ticks`) **ไม่เปลี่ยน**

`buildStages()` → แทนด้วย `buildRows()` ซึ่งประกอบจาก 3 ตัวช่วยแยก unit-test ได้อิสระ:

1. `buildMilestoneRows(petition)` — QC รับ / Lab รับ / มอบหมาย
2. `buildParameterRows(petition, parameters, auditLogs, qcResults, itemGroupIds)` — แถว parameter
3. `buildClosingRows(petition, now)` — ออกผล Lab / Final Result

**`TimelineDetailInput` เพิ่ม field `qcResults: QCTestResult[]`**

## การเปลี่ยนแปลงฝั่ง UI (`PetitionTimelineDetailPage.tsx`)

- โหลด `api.getQCResults(petition._id)` พร้อมกับ `getParameters()` / `getQCProgress()` ใน effect เดิม (ยิงขนานกัน ไม่เพิ่ม waterfall) แล้วส่งเข้า `buildTimelineDetailModel`
- render `model.timeline.rows`:
  - `kind === "milestone"` → จุดกลมอย่างเดียว ณ ตำแหน่ง `at` (ไม่มีเส้นลากยาว)
  - `kind === "bar"` → แท่งจาก `startAt` ถึง `endAt`; ถ้า `startAt`/`endAt` เป็น null → แถวว่าง (ชื่ออย่างเดียว)
  - สีตาม `track`: qc = primary, lab = สีที่สอง, stage = neutral
- ความกว้างคอลัมน์ชื่อแถวขยายพอสำหรับชื่อ parameter (ตัดด้วย truncate + `title`)
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
