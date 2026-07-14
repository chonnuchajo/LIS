# Petition Timeline — แท็บรายตัวอย่าง (item tabs)

**วันที่:** 2026-07-14
**หน้า:** `/petition-timeline/:id` (`src/pages/PetitionTimelineDetailPage.tsx`)

## ปัญหา

คำขอหนึ่งใบมีได้หลายตัวอย่าง (`petition.items[]`) แต่ละตัวอย่างคือสารคนละตัว (คนละ `commonName`, คนละ batch) ทุกวันนี้หน้า timeline ยุบทุกตัวอย่างรวมกัน:

- การ์ดสรุปคำขอ join ค่าทุก item ด้วย `,` (`summarizeItemValues`) — อ่านไม่รู้เรื่องเมื่อมีหลายตัว
- `buildParameterRows` group ด้วย `parameterId` อย่างเดียว → parameter เดียวกันของหลายตัวอย่างกลายเป็นแถวเดียว และ **แท่งจะไม่ขึ้นเลยจนกว่าจะกรอกครบทุกตัวอย่าง** ทำให้มองไม่ออกว่าตัวอย่างไหนช้า
- การ์ด Tasks ปนทุกตัวอย่างในลิสต์เดียว

## เป้าหมาย

แยกหน้าเป็นแท็บ **1 ตัวอย่าง = 1 แท็บ** ภายในคำขอเดียวกัน แท็บคุมทั้งหน้า (การ์ดสรุป + Progress + Project Timeline + Tasks) ส่วน Recent Activity และ Documents ยังเป็นระดับคำขอเหมือนเดิม

## แนวทาง

ส่ง `itemSeq` ที่เลือกอยู่เข้า pure module `buildTimelineDetailModel` แล้วให้มันคิด tasks / progress / parameter rows เฉพาะตัวอย่างนั้น หน้าเว็บเก็บ state ตัวที่เลือกแล้ว `useMemo` สร้าง model ใหม่ตอนสลับแท็บ (ราคาถูก — แค่วน items × parameters)

*แนวทางที่พิจารณาแล้วไม่เอา:* คืน view ครบทุก item ในทีเดียว (`model.itemViews[]`) — ต้องผ่า type เป็น shared/per-item กระทบผู้ใช้เดิมมากโดยได้ประโยชน์ perf ที่ไม่จำเป็น; หรือกรองในคอมโพเนนต์ — `TimelineDetailRow` ไม่มี `itemSeq` ติดมา ยังไงก็ต้องแก้ pure module อยู่ดี

## เปลี่ยนอะไรบ้าง

### 1. `src/lib/petitionTimelineDetail.ts`

**Input** เพิ่มฟิลด์เดียว:

```ts
export type TimelineDetailInput = {
  // ...ของเดิม
  itemSeq?: number | null;   // null/undefined = ทุกตัวอย่าง (พฤติกรรมเดิม)
};
```

**Output** เพิ่ม 2 ฟิลด์:

```ts
export type TimelineDetailItemTab = {
  seq: number;
  label: string;        // commonName → sampleName → "ตัวอย่างที่ N"
  commonName: string;
  batchNo: string;
  sampleName: string;
};

export type TimelineDetailModel = {
  // ...ของเดิม
  items: TimelineDetailItemTab[];           // ครบทุกตัวเสมอ ไม่ขึ้นกับ itemSeq — ใช้วาดแท็บ + เติม Metric
  overallProgress: TimelineDetailProgress;  // รวมทุกตัวอย่าง — ใช้ gate ปุ่ม Pre Report เท่านั้น
  progress: TimelineDetailProgress;         // ของตัวอย่างที่เลือก (เดิมคือทั้งคำขอ)
};
```

การทำงาน:

- `buildRequiredTasks` คิดครบทุกตัวอย่างเหมือนเดิม (task มี `itemSeq` ติดมาอยู่แล้ว) แล้วค่อยกรองเป็น `tasks` ของตัวอย่างที่เลือก — ไม่ต้องวนซ้ำสองรอบ
  - `overallProgress` = `buildRequiredProgress(tasks ทั้งหมด)` · `progress` = `buildRequiredProgress(tasks ที่กรองแล้ว)`
- `buildParameterRows` กรอง `petition.items` ด้วย `itemSeq` ก่อนวน (ถ้า `itemSeq == null` ไม่กรอง)

**ผลพลอยได้ที่ตั้งใจ:** กฎเดิม *"แท่ง parameter ไม่ขึ้นจนกว่าจะกรอกครบทุกตัวอย่าง"* หายไปเอง — เมื่อ scope เหลือตัวอย่างเดียว แท่งจะขึ้นทันทีที่ตัวอย่างนั้นกรอกเสร็จ (เทสต์เดิมที่ยืนยันกฎนั้นถูกแทนที่)

**สิ่งที่เหมือนกันทุกแท็บ (ตั้งใจ):** จุด milestone (QC รับตัวอย่าง / Lab รับตัวอย่าง / มอบหมายงาน Lab), แท่ง "ออกผล Lab" และ "Final Result", รายการแท็บวัน, Start/End time ในการ์ดสรุป — ทั้งหมดเป็นข้อมูลระดับคำขอ ไม่มี timestamp รายตัวอย่างใน DB

### 2. `src/pages/PetitionTimelineDetailPage.tsx`

**แถบแท็บ** วางเต็มความกว้าง **ใต้ `PageHeader` เหนือการ์ดสรุปคำขอ** เพื่อสื่อว่าคุมทั้งหน้า

```
[← ย้อนกลับ]                                    [รีเฟรช]
┌─────────────────────────────────────────────────────┐
│ [ ABAMECTIN 1.8% EC ] [ EMAMECTIN 1.9% EC ]         │  role="tablist" aria-label="ตัวอย่างในคำขอ"
└─────────────────────────────────────────────────────┘
┌─ การ์ดสรุปคำขอ ─────────────────────────────────────┐
│ [สถานะ] P-2607-001                                  │
│ Common name | เลข Batch | Start | End | Progress    │  3 ช่องแรก+Progress = ของตัวอย่างที่เลือก
└─────────────────────────────────────────────────────┘
┌─ Project Timeline ──────────┐ ┌─ Recent Activity ──┐
│ [13 ก.ค.] [14 ก.ค.] แท็บวัน  │ │ ทั้งคำขอ (ไม่เปลี่ยน)│
│ QC รับตัวอย่าง      ●        │ └────────────────────┘
│ param A         ▬▬▬▬        │ ┌─ Documents ────────┐
└─────────────────────────────┘ │ ทั้งคำขอ (ไม่เปลี่ยน)│
┌─ Tasks (เฉพาะตัวอย่างที่เลือก)│ └────────────────────┘
└─────────────────────────────┘
```

- state ใหม่ `activeItemSeq: number | null` — default = `model.items[0]?.seq`; reset ใน effect เดียวกับที่ reset `activeTimelineDayKey` (dep `[id]`)
- **มีตัวอย่างเดียว → ไม่แสดงแถบแท็บ** (หน้าตาเหมือนเดิมเป๊ะ) — เหมือนกฎของแท็บวันที่โผล่เฉพาะเมื่อ > 1 วัน
- ป้ายแท็บยาว → `truncate` + `title` เต็ม; สไตล์ใช้ชุดเดียวกับปุ่มแท็บวัน (active = `border-primary-500 bg-primary-50 text-primary-600`)
- **ลบ Metric "Lot" ออกจากการ์ดสรุป** เหลือ Common name / เลข Batch / Start time / End time / Progress → grid `xl:grid-cols-6` เป็น `xl:grid-cols-5`
- Metric "Common name" / "เลข Batch" อ่านจาก item ที่เลือกตรง ๆ (ไม่ join) → `summarizeItemValues` ไม่มีคนใช้แล้ว **ลบทิ้ง**
- การ์ด Tasks: บรรทัด `task.sampleName` คงไว้
- ปุ่ม Pre Report เปลี่ยนไปใช้ `model.overallProgress` แทน `model.progress`
- แท็บวัน **ไม่ reset** ตอนสลับตัวอย่าง (ช่วง startAt/endAt เป็นระดับคำขอ → รายการวันเท่ากันทุกแท็บ)

## เคสขอบ

| เคส | พฤติกรรม |
|---|---|
| คำขอมี item เดียว | ไม่แสดงแถบแท็บ — หน้าตาเหมือนเดิม |
| คำขอไม่มี item เลย | `model.items = []`, `itemSeq = null` → คิดแบบเดิม (ไม่มีแท่ง parameter อยู่แล้ว) |
| `itemSeq` ไม่ตรงกับ item ไหน (เช่นรีเฟรชแล้ว item หาย) | หน้าเว็บ fallback ไปตัวแรก: `model.items.find(...) ?? model.items[0]` |
| หลาย item มี commonName ซ้ำกัน | ป้ายแท็บซ้ำได้ (React key ใช้ `seq`) — ไม่เติม batch ต่อท้าย |
| item ไม่มี commonName | ป้าย fallback: `sampleName` → `"ตัวอย่างที่ N"` |
| user ฝั่ง Lab | ยังกรองด้วย `visibleParameters` เหมือนเดิม — แท็บโผล่ครบทุก item แต่แถว/tasks ในแท็บอาจว่างถ้าไม่มี parameter ที่ตัวเองเห็น |

## แผนเทสต์

**`src/lib/petitionTimelineDetail.test.ts`**

1. `model.items` คืนครบทุก item พร้อม `label` = commonName (+ เคส fallback ไป sampleName และ `"ตัวอย่างที่ N"`)
2. ส่ง `itemSeq: 2` → `tasks` และ `timeline.rows` มีเฉพาะ parameter ของ item 2
3. แท่ง parameter ขึ้นทันทีที่ item ที่เลือกกรอกเสร็จ แม้ item อื่นยังไม่กรอก (แทนเทสต์เดิม `"รวมหลายตัวอย่างเป็นแถวเดียว และไม่วาดแท่งจนกว่าจะใส่ค่าครบทุกตัวอย่าง"`)
4. `progress` = ของ item ที่เลือก, `overallProgress` = รวมทุก item — ค่าต่างกันได้
5. milestone rows / "ออกผล Lab" / "Final Result" / `days` เหมือนกันทุกค่า `itemSeq`
6. ไม่ส่ง `itemSeq` → ผลลัพธ์เท่าเดิมทุกประการ (backward compat)

**`src/pages/PetitionTimelineDetailPage.test.tsx`**

7. คำขอ 2 items → เห็นแท็บ 2 ปุ่มชื่อ commonName; คำขอ 1 item → ไม่มี tablist ชื่อ `"ตัวอย่างในคำขอ"`
8. กดแท็บที่สอง → Metric "Common name" / "เลข Batch" เปลี่ยนตาม และการ์ด Tasks เหลือของ item นั้น
9. ปุ่ม Pre Report ยังไม่โผล่เมื่อ item ที่เลือกกรอกครบแต่ item อื่นยังไม่ครบ

## ข้อจำกัดของงานนี้

- ไม่แตะ backend และไม่เพิ่ม API ใหม่ — ข้อมูลที่ต้องใช้ (`petition.items`, audit log, `QCTestResult`) โหลดอยู่แล้ว
- ไม่แยกสารย่อยภายในตัวอย่างเดียว (`parseSubstances` split `"+"`) — แท็บระดับ item เท่านั้น
- ไม่ผูกแท็บกับ URL (ไม่มี query param) — สลับแท็บเป็น state ในหน้า
