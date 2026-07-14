# Petition Timeline — สีประจำแถว (9 สี)

วันที่: 2026-07-14
สถานะ: อนุมัติดีไซน์แล้ว รอ implement

## ปัญหา

กราฟ Petition Timeline (`/petitions/:id/timeline`) ระบายสีแท่ง/จุดจาก `row.track` (`qc` | `lab` | `stage`) ผ่าน `barTrackClass()` ใน `src/pages/PetitionTimelineDetailPage.tsx` ผลคือ

- "Lab กำลังวิเคราะห์" กับ "Pre Result" สีเดียวกัน (amber) เพราะอยู่ track เดียวกัน
- "Final Result" เป็น `grey-400` จืดจนไม่เหมือนแถวสำคัญ
- จุด milestone ทั้ง 5 จุดเป็นน้ำเงิน (`primary-600`) เหมือนกันหมด

แยกแถวออกจากกันด้วยสายตาไม่ได้ ต้องอ่าน label ซ้าย

## เป้าหมาย

ทุกแถวในกราฟ (5 จุด milestone + 4 แท่ง = 9 แถว) มีสีประจำตัวไม่ซ้ำกัน โดยยังคงสื่อสถานะ (ยังไม่เริ่ม / กำลังทำ / เสร็จ) ได้เหมือนเดิม

## ข้อจำกัดที่ต้องรู้

`tailwind.config.ts` **override** `red`, `green`, `yellow` ให้เหลือแค่เฉด `50` และ `500` → `red-200`, `green-200`, `yellow-200` **ไม่มีอยู่จริง** สีที่ไม่ได้ override (violet, sky, cyan, teal, amber, orange, rose, lime, emerald, ...) ยังได้เฉดครบจาก palette default ของ Tailwind

ดีไซน์นี้จึงเลี่ยง `green`/`yellow` (ใช้ `emerald`/`amber` แทน) และใช้ `red-500` เฉพาะกรณีที่ไม่ต้องการเฉดอ่อน

Tailwind JIT scan class จาก source แบบ literal → ชื่อ class ต้องเขียนเต็มเป็น string ห้ามประกอบด้วย template string

## สีประจำแถว

map ตาม `row.key` (ไม่ใช่ `track`) เรียงให้แถวที่อยู่ติดกันมี hue ห่างกัน

| # | row.key | label | solid (เสร็จ) | soft (กำลังทำ) |
|---|---------|-------|---------------|----------------|
| 1 | `submitted` | ยื่นคำขอ | `bg-violet-500` | `bg-violet-200` |
| 2 | `sample-sent` | ส่งตัวอย่าง | `bg-orange-500` | `bg-orange-200` |
| 3 | `received-qc` | QC รับตัวอย่าง | `bg-sky-500` | `bg-sky-200` |
| 4 | `assigned` | มอบหมายงาน Lab | `bg-rose-500` | `bg-rose-200` |
| 5 | `received-lab` | Lab รับตัวอย่าง | `bg-lime-600` | `bg-lime-200` |
| 6 | `qc-analyzing` | QC กำลังวิเคราะห์ | `bg-primary-500` | `bg-primary-200` |
| 7 | `lab-analyzing` | Lab กำลังวิเคราะห์ | `bg-amber-500` | `bg-amber-200` |
| 8 | `pre-result` | Pre Result | `bg-cyan-500` | `bg-cyan-200` |
| 9 | `final` | Final Result | `bg-emerald-500` | `bg-emerald-200` |

ข้อยกเว้น: แถว `final` ตอนคำร้องถูก reject (label เปลี่ยนเป็น "ส่งกลับแก้ไข") ใช้ `bg-red-500` — เป็นแท่งที่ render เฉพาะตอน done จึงไม่ต้องมีเฉดอ่อน

แท่ง QC (น้ำเงิน) และ Lab (เหลือง) คงสีเดิมที่ผู้ใช้คุ้นอยู่แล้ว

## กติกาสถานะ (คงกลไกเดิม)

- **จุด milestone**: ยังไม่ถึง (`done === false`) → `bg-grey-300`; ถึงแล้ว → solid ของแถวนั้น
- **แท่ง**: กำลังทำ (`done === false`) → soft ของแถวนั้น + ปลายขวาตรง (`rounded-r-none` เดิม); เสร็จ → solid
- แท่งที่ข้ามวัน ยังตัดมุมซ้าย (`rounded-l-none`) ตามเดิม

หมายเหตุ: ตามโค้ดปัจจุบัน `makeBarRow()` จะให้ `startAt`/`endAt` เป็น `null` ถ้าไม่มีปลายทั้งสองข้าง แท่ง `pre-result` และ `final` จึง render ก็ต่อเมื่อ done แล้วเท่านั้น — เฉดอ่อนถูกใช้จริงแค่ 2 แท่งวิเคราะห์ แต่ยังนิยาม soft ให้ครบทุกแถวเพื่อความสม่ำเสมอและกันโมเดลเปลี่ยนในอนาคต

## โครงสร้างโค้ด

**ไฟล์ใหม่ `src/lib/petitionTimelineColors.ts`** (pure, unit-tested)

```ts
export type TimelineRowColorState = { done: boolean; rejected?: boolean };
export function timelineDotClass(rowKey: string, state: TimelineRowColorState): string;
export function timelineBarClass(rowKey: string, state: TimelineRowColorState): string;
```

- ภายในเก็บ `Record<string, { solid: string; soft: string }>` เป็น class literal ครบ 9 key
- `timelineDotClass`: `done ? solid : "bg-grey-300"`
- `timelineBarClass`: `done ? solid : soft`; ถ้า `rowKey === "final" && rejected` → `bg-red-500`
- key ที่ไม่รู้จัก → fallback `bg-grey-400` (solid) / `bg-grey-200` (soft) เพื่อไม่ให้แถวหายไปถ้ามีการเพิ่ม row ใหม่โดยลืมใส่สี

**แก้ `src/pages/PetitionTimelineDetailPage.tsx`**

- ลบ `barTrackClass()`
- จุด milestone: `cn("absolute top-1 h-4 w-4 ...", timelineDotClass(row.key, { done: row.done }))`
- แท่ง: `cn("absolute top-2 h-2 rounded-full", timelineBarClass(row.key, { done: row.done, rejected: petition.status === "rejected" }), ...)`
- ฟิลด์ `track` ในโมเดล (`petitionTimelineDetail.ts`) คงไว้ ไม่แตะ (ยังใช้อธิบายสายงาน)

## เทสต์

`src/lib/petitionTimelineColors.test.ts`

1. ทั้ง 9 key ให้ solid ไม่ซ้ำกันเลย
2. จุดที่ยังไม่ถึง → `bg-grey-300` ทุก key
3. แท่งที่ยังทำอยู่ → soft ของ key นั้น (เช็ค `qc-analyzing` → `bg-primary-200`, `lab-analyzing` → `bg-amber-200`)
4. `final` + `rejected` → `bg-red-500`; `final` ปกติ → `bg-emerald-500`
5. key ที่ไม่รู้จัก → fallback เทา

`src/pages/PetitionTimelineDetailPage.test.tsx` — อัปเดต assertion ถ้ามีการเช็ค class สีเดิม

## นอกขอบเขต

- `PetitionStatusTimeline` (คนละคอมโพเนนต์) ไม่แตะ
- ไม่เพิ่ม legend — แต่ละแถวมี label กำกับซ้ายอยู่แล้ว
- ไม่แตะ progress bar ด้านบนการ์ด และตาราง Parameter
