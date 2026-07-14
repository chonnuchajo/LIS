# Petition Timeline — Hover Crosshair (เส้นตั้งบอกวันเวลา)

วันที่: 2026-07-14
สถานะ: approved (รอ implement)

## ปัญหา

การ์ด **Petition Timeline** ในหน้า `/petition-timeline/:id` (`PetitionTimelineDetailPage.tsx`) วาดแท่ง (bar) และจุด (milestone) บนแกนเวลา แต่ผู้ใช้อ่าน "เวลา" ได้จาก tick ที่ห่างกันเป็นชั่วโมง/วันเท่านั้น — ชี้ไปตรงกลางแท่งแล้วบอกไม่ได้ว่านั่นคือเวลาไหน และเทียบข้ามด่านไม่ได้ว่า ณ เวลาหนึ่ง ๆ ด่านไหนกำลังวิ่งอยู่บ้าง

## สิ่งที่จะทำ

เพิ่ม **hover crosshair**: เอาเมาส์เข้าไปในคอลัมน์กราฟ → เส้นตั้งพาดทุกแถว + ป้ายวันเวลาเกาะเมาส์

### พฤติกรรม

- **โซน hover** = คอลัมน์กราฟ ตั้งแต่แถบ tick ด้านบนลงมาถึงแถวล่างสุด (ไม่รวมคอลัมน์ชื่อด่านฝั่งซ้าย ซึ่งไม่ใช่แกนเวลา)
- **เส้นตั้ง** 1px สีจาง ลากเต็มความสูงของกราฟ พาดทุกแถว วิ่งตามเมาส์แกน x
- **ป้ายเวลา** เกาะเมาส์ (ตามทั้งแกน x และ y) ห่างประมาณ 12px เขียนรูปแบบ `15 ก.ค. 10:47` — **วัน + เวลาเสมอ ทุกแท็บ**
- ป้ายชนขอบขวาของพื้นที่กราฟ → สลับไปโผล่ฝั่งซ้ายของเมาส์
- เมาส์ออกจากพื้นที่กราฟ → เส้นและป้ายหายทันที
- ทำงานทุกแท็บ (ภาพรวม / รายวัน) โดยอ่านสเกลจากแกนของแท็บที่กำลังดู (`activeTimelineDay.startAt` → `activeTimelineDay.endAt`) ซึ่งเป็นเชิงเส้นอยู่แล้ว — ค่าที่ได้จึงตรงกับตำแหน่งแท่งบนจอเสมอ
- **เมาส์อย่างเดียว** ไม่รองรับ touch (บนจอสัมผัสไม่มี hover จริง แตะแล้วจะได้เส้นค้าง)
- ไม่แตะของเดิม: `title="ต่อเนื่องข้ามวัน"` บนแท่ง และ `aria-label` ของแท่ง/จุด ยังทำงานเหมือนเดิม เพราะ overlay เป็น `pointer-events-none` ทั้งชั้น

### นอกขอบเขต (YAGNI)

- ไม่ snap เข้าหา event ที่ใกล้ที่สุด — เวลาเป็นค่าต่อเนื่องตามพิกเซล
- ไม่โชว์ชื่อด่าน/ช่วงเริ่ม-จบของแถวที่เมาส์ทาบ (พิจารณาแล้วตัดออก — ป้ายเอาแค่วันเวลา)
- ไม่มี tooltip ราย bar/จุด, ไม่มี click, ไม่แตะการพิมพ์

## โครงสร้าง

### ตรรกะล้วน — ไฟล์ใหม่ `src/lib/petitionTimelineCrosshair.ts`

```ts
export type CrosshairPoint = { percent: number; at: Date };

// แปลงตำแหน่งเมาส์บน "ราง" (แถบ tick) เป็นเวลาบนแกน
// คืน null ถ้าแกนเสีย (end <= start / วันที่ไม่ valid), รางกว้าง 0, หรือเมาส์อยู่นอกราง
export function crosshairAt(
  clientX: number,
  trackRect: { left: number; width: number },
  startAt: string,
  endAt: string,
): CrosshairPoint | null;

// "15 ก.ค. 10:47"
export function formatCrosshairTime(at: Date): string;
```

- `percent` = 0–100 (ตำแหน่งซ้ายของเส้น เทียบกับราง)
- เมาส์นอกราง (ซ้ายกว่า `left` หรือขวากว่า `left + width`) → `null` ไม่ใช่หนีบขอบ — เพราะโซนซ้ายคือคอลัมน์ชื่อด่าน ค่าที่ได้จะไม่มีความหมาย

มี `petitionTimelineCrosshair.test.ts` คู่ (Vitest) ตามแพทเทิร์นของ `petitionTimelineDetail.ts` / `petitionTimelineColors.ts`

### UI — แก้ `src/pages/PetitionTimelineDetailPage.tsx` ไฟล์เดียว

1. ห่อ "แถบ tick + แถวทั้งหมด" (`<div className="space-y-3">` ที่มีอยู่) ด้วย container ที่ `relative` + `onMouseMove` / `onMouseLeave`
2. `ref` ชี้ที่ **div ของแถบ tick** (คอลัมน์ที่สองของ grid หัวตาราง) ใช้เป็น "ราง" วัด `getBoundingClientRect()` → ได้ขอบซ้าย/ความกว้างของแกนเวลาจริง
   - ทุกแถวใช้ grid template เดียวกัน (`minmax(5.75rem,7rem)_minmax(0,1fr)` / `sm:9rem_minmax(0,1fr)`) คอลัมน์เวลาจึงเริ่มที่ x เดียวกันหมด — วัดจากแถบ tick แถวเดียวพอ
   - วัดจาก DOM แทนคำนวณจาก grid เพราะความกว้างเป็น `minmax()` + breakpoint ที่เปลี่ยนตามจอ
3. state เดียว: `crosshair: { percent: number; label: string; x: number; y: number } | null` โดย `x`/`y` เป็นพิกัด**เทียบกับ container** (ไม่ใช่ clientX/Y) เพื่อวางป้ายด้วย `absolute`
4. overlay `absolute inset-0 pointer-events-none` ภายใน container ประกอบด้วยสองชิ้น:
   - **เส้นตั้ง**: อยู่ใน grid template เดียวกับแถวอื่น (คอลัมน์แรกว่าง คอลัมน์สอง `relative` เต็มความสูง) แล้ววางเส้นด้วย `left: ${percent}%` — พิกัดจึง align กับรางเองโดยไม่ต้องแปลงหน่วย
   - **ป้าย**: วางด้วย `left: ${x}px; top: ${y}px` เทียบ container ตรง ๆ (บวก offset 12px, สลับไปฝั่งซ้ายเมื่อชนขอบขวา)
5. เมาส์ออก (`onMouseLeave`) → `setCrosshair(null)`
6. เปลี่ยนแท็บวัน/แท็บตัวอย่าง → crosshair คำนวณจาก `activeTimelineDay` ปัจจุบันเสมอ ไม่ต้องล้าง state (mousemove ครั้งถัดไปทับค่าเอง)

## เทสต์

**Unit — `src/lib/petitionTimelineCrosshair.test.ts`**
- กลางราง → กึ่งกลางช่วงเวลา (percent 50)
- ซ้ายสุด/ขวาสุดของราง → `startAt` / `endAt` พอดี
- เมาส์นอกราง (ซ้าย/ขวา) → `null`
- แกนกลับหัวหรือ invalid (`end <= start`, วันที่พัง) → `null`
- รางกว้าง 0 → `null`
- `formatCrosshairTime` → `"15 ก.ค. 10:47"` (locale `th-TH`)

**Component — เพิ่มใน `src/pages/PetitionTimelineDetailPage.test.tsx`**
- mock `getBoundingClientRect()` ของรางให้มีความกว้างจริง (jsdom คืน 0 ทั้งหมด)
- `mouseMove` ในโซนกราฟ → เห็น element เส้น + ป้ายที่มีข้อความเวลา
- `mouseLeave` → เส้นและป้ายหาย
