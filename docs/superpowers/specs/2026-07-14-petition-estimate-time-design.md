# Petition Timeline — Estimate Time

วันที่: 2026-07-14
สถานะ: อนุมัติดีไซน์แล้ว (รอ implement)

## ปัญหา

การ์ดหัวหน้า Petition Timeline แสดง Metric **"End time"** ซึ่งปัจจุบันหมายถึง:

- ปิดงานแล้ว → เวลาจริง (`actual`)
- เปิดหน้าในวันเดียวกับที่รับตัวอย่าง → 17:00 ของวันนั้น (`estimated`)
- นอกนั้น → "ตอนนี้" (`ongoing`)

ค่านี้ไม่ได้ตอบคำถามที่ผู้ใช้อยากรู้จริง ๆ คือ **"ผลจะออกเมื่อไหร่"** — โดยเฉพาะกรณี `ongoing` ที่แสดงเวลาปัจจุบัน ซึ่งไม่ใช่ข้อมูลอะไรเลย

## เป้าหมาย

เปลี่ยน Metric เป็น **"Estimate Time"** ที่คำนวณเวลาคาดการณ์ผลออกจากข้อมูลจริงในระบบ:

- ยังไม่รับงาน → บอกเป็นช่วงกว้าง "คาดว่าผลจะออก 1-2 วัน"
- รับงานแล้ว → คำนวณจาก standard time (Lab) และจำนวน parameter (QC) — เอาฝั่งที่นานที่สุด

## ขอบเขต

- **แก้**: `src/lib/petitionTimelineDetail.ts` (header + แกนเวลา), `src/pages/PetitionTimelineDetailPage.tsx` (Metric)
- **เพิ่ม**: `src/lib/petitionEstimate.ts` + `src/lib/petitionEstimate.test.ts`
- **ไม่แตะ**: backend (ข้อมูลที่ต้องใช้มีครบแล้ว), หน้าอื่น ๆ ที่ใช้ `buildTimelineDetailModel`

## ข้อมูลที่ใช้ (มีอยู่แล้ว ไม่ต้องเพิ่ม API)

| ข้อมูล | ที่มา |
|---|---|
| เวลารับงาน QC | `petition.qcReceivedAt` (fallback `petition.receivedAt`) |
| เวลารับงาน Lab | `petition.labReceivedAt` |
| standard time ของ Lab | `petition.assignedMachines[].estimatedMinutes` — ถูกเติมตอน assign โดย `matchStandardTime()` ใน `server/routes/petitions.js` จากคอลเลกชัน `StandardTime` |
| จำนวนงาน QC | `buildRequiredTasks()` ใน `petitionTimelineDetail.ts` → 1 task = 1 parameter × 1 ตัวอย่าง (parameter ทั้งหมดในโมเดลนี้เป็นงาน QC — งาน Lab แยกไปทาง `assignedMachines`/LabRequest) |
| คำขอมีฝั่ง Lab ไหม | `hasLabTrack(petition)` |

## นิยามเวลาทำการ

- ชั่วโมงทำงาน **08:00–17:00** = 9 ชม./วัน (ค่าเดิม `WORK_START_HOUR` / `WORK_END_HOUR`)
- วันทำงาน **จันทร์–เสาร์** — ข้ามเฉพาะ **วันอาทิตย์**
- ไม่รองรับวันหยุดนักขัตฤกษ์ (ไม่มีข้อมูลในระบบ — YAGNI)

## โมดูลใหม่: `src/lib/petitionEstimate.ts`

Pure functions ทั้งหมด รับ `now` เป็นพารามิเตอร์ (เทสต์ได้แบบ deterministic)

### `addWorkingMinutes(from: Date, minutes: number): Date`

1. ดัน `from` เข้าหน้าต่างทำงานก่อน:
   - วันอาทิตย์ หรือ ≥ 17:00 → 08:00 ของวันทำการถัดไป
   - < 08:00 → 08:00 ของวันเดียวกัน
   - อยู่ในช่วง 08:00–17:00 → คงเดิม
2. ไล่หัก `minutes` ทีละวัน: เหลือเวลาในวันนั้นพอ → บวกแล้วจบ; ไม่พอ → หักเท่าที่เหลือแล้วเลื่อนไป 08:00 วันทำการถัดไป
3. `minutes <= 0` → คืนค่าหลังขั้นตอนที่ 1

### `endOfNextWorkingDay(from: Date): Date`

17:00 ของ **วันทำการถัดไป** จาก `from` (ข้ามอาทิตย์) — ใช้เป็นปลายแกนกรณียังไม่รับงาน และเป็น fallback

### `estimatePetitionEnd(input): { at: string; kind: "unreceived" | "estimated" }`

```ts
type EstimateInput = {
  petition: Petition;
  qcTaskCount: number;   // จำนวน task ทั้งหมด (parameter × ตัวอย่าง)
  now: Date;
};
```

**กติกา** (ใช้เฉพาะคำขอที่ยังไม่ปิด — คำขอที่ปิดแล้วใช้เวลาจริง ไม่เรียกฟังก์ชันนี้):

1. **ยังไม่รับงานเลย** — ไม่มีทั้ง `qcReceivedAt`/`receivedAt` และ `labReceivedAt`
   → `kind: "unreceived"`, `at = endOfNextWorkingDay(sampleSentAt ?? submittedAt)`

2. **รับงานแล้ว** — คำนวณเฉพาะฝั่งที่ **รับแล้วจริง** เท่านั้น (ฝั่งที่ยังไม่รับ ไม่ต้องเดา)
   - **QC** (มี `qcReceivedAt ?? receivedAt` และ `qcTaskCount > 0`):
     `addWorkingMinutes(qcReceivedAt, qcTaskCount × 60)` — mock 1 parameter = 1 ชม.
   - **Lab** (มี `labReceivedAt` และ `hasLabTrack`):
     `labMinutes = max(machine.estimatedMinutes ?? 240)` ทุกเครื่องใน `assignedMachines`
     (เครื่องที่จับคู่ standard time ไม่ได้ นับเป็น 4 ชม.; ไม่มีเครื่องเลย → 240)
     → `addWorkingMinutes(labReceivedAt, labMinutes)`
   - `at = max(ผู้สมัครทั้งหมด)`, `kind: "estimated"`
   - **ไม่มีผู้สมัครเลย** (รับงานแล้วแต่ 0 parameter และไม่มีฝั่ง Lab)
     → `at = endOfNextWorkingDay(เวลารับงานที่เร็วสุด)`, `kind: "estimated"`

> เหตุผลที่ Lab เอา `max` ไม่ใช่ผลรวม: เครื่องรันคู่ขนานกันได้
> เหตุผลที่ QC คูณจำนวนตัวอย่าง: ต้องตรวจทุกตัวอย่างจริง ๆ

## เปลี่ยน `petitionTimelineDetail.ts`

### Type

```ts
export type TimelineDetailHeader = {
  startAt: string;
  startKind: "received" | "submitted";
  endAt: string;
  endKind: "actual" | "estimated" | "unreceived";   // เลิกใช้ "ongoing"
  overdue: boolean;                                  // endKind === "estimated" && endAt < now
};
```

`"ongoing"` หายไปเพราะทุกคำขอที่ยังไม่ปิดมีค่าคาดการณ์เสมอแล้ว

### `buildHeaderTiming()`

- ปิดงานแล้ว + มี `actualEndAt` → `{ endAt: actualEndAt, endKind: "actual", overdue: false }` (เหมือนเดิม)
- นอกนั้น → เรียก `estimatePetitionEnd()` → `{ endAt: at, endKind: kind, overdue: kind === "estimated" && at < now }`

ต้องส่ง `qcTaskCount` เข้ามา — ใน `buildTimelineDetailModel()` ย้ายการเรียก `buildRequiredTasks()` ขึ้นก่อน `buildHeaderTiming()` แล้วส่ง `allTasks.length`

### แกนเวลา

```ts
const timelineEndAt = header.endKind === "actual"
  ? header.endAt
  : latestValidDate(header.endAt, now.toISOString())!;
```

`timeline.endAt` / `buildTicks()` / `buildTimelineDays()` ใช้ `timelineEndAt` (ไม่ใช่ `header.endAt` ตรง ๆ)

**เหตุผล**: แท่งที่ยังทำอยู่ลากถึง "ตอนนี้" — ถ้างานเลยกำหนดแล้ว (`overdue`) แล้วแกนจบที่ค่าคาดการณ์ในอดีต แท่งจะทะลุขอบขวา
**เหตุผลที่ยกเว้น `actual`**: คำขอที่ปิดไปแล้วต้องจบแกนที่เวลาจริง — ถ้า clamp ด้วย `now` ด้วย กราฟของงานที่ปิดไปเมื่อเดือนก่อนจะถูกลากมาถึงวันนี้
**ผลข้างเคียงที่ยอมรับ**: แท็บวันในอนาคต (ที่ยังไม่มีกิจกรรม) จะโผล่มา — ตั้งใจให้เห็นเป้าหมายบนกราฟ

## UI — `PetitionTimelineDetailPage.tsx` (Metric ปัจจุบันบรรทัด 410)

| `endKind` | label | value | hint |
|---|---|---|---|
| `actual` | `End time` | `formatDateTime(endAt)` | `เวลาจริง` |
| `estimated` | `Estimate Time` | `formatDateTime(endAt)` | `ค่าประมาณ` / `เลยกำหนด` เมื่อ `overdue` |
| `unreceived` | `Estimate Time` | `คาดว่าผลจะออก 1-2 วัน` | `ยังไม่รับงาน` |

label สลับตาม `endKind` แบบเดียวกับที่ Start time สลับตาม `startKind` อยู่แล้ว

## เทสต์

### `petitionEstimate.test.ts` (ใหม่)

- `addWorkingMinutes`: บวกในวันเดียวกัน / ข้ามคืน (16:00 + 3 ชม. → 10:00 วันถัดไป) / เริ่มนอกเวลางาน (19:00 + 1 ชม. → 09:00 วันถัดไป) / ข้ามอาทิตย์ (เสาร์ 16:00 + 2 ชม. → จันทร์ 09:00) / เสาร์นับเป็นวันทำงาน / `minutes = 0`
- `endOfNextWorkingDay`: ธรรมดา / เสาร์ → จันทร์ 17:00
- `estimatePetitionEnd`: ยังไม่รับ / QC อย่างเดียว / Lab อย่างเดียว / รับครบสองฝั่ง เอา max / QC รับ Lab ไม่รับ (ใช้ QC อย่างเดียว) / เครื่องไม่มี standard time → 240 / หลายเครื่อง → max / 0 parameter → fallback

### `petitionTimelineDetail.test.ts` (แก้ของเดิม)

- เคสที่ยืนยัน `endKind: "ongoing"` → เปลี่ยนเป็น `"estimated"` / `"unreceived"` ตามข้อมูล
- เพิ่ม: `timeline.endAt` ≥ `now` เสมอ (เคส overdue)
- เพิ่ม: `header.overdue` เป็น `true` เมื่อค่าคาดการณ์อยู่ในอดีต

## สิ่งที่ไม่ทำ (YAGNI)

- ไม่เก็บค่าคาดการณ์ลง DB (คำนวณสด ๆ ฝั่ง client)
- ไม่รองรับวันหยุดนักขัตฤกษ์
- ไม่เดาเวลาฝั่งที่ยังไม่รับงาน (ผู้ใช้เลือกแล้วว่าให้ใช้เฉพาะฝั่งที่รับแล้ว)
- ไม่แตะ `estimatedMinutes` ฝั่ง backend / ไม่เพิ่ม endpoint
