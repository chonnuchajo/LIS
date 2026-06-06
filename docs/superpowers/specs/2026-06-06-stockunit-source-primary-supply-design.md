# StockUnit `source` (primary / supply) — Design

วันที่: 2026-06-06
สถานะ: approved (รอ review สเปค)

## ปัญหา

Stock เดิมเก็บสารมาตรฐานเป็นยอดรวมต่อ tier: `primary`, `supplier`, `working` (บน `StockStandard`).
โมเดลใหม่รายขวด `StockUnit` มีแค่ `kind: sealed | working` และตอน migrate สคริปต์
`migrate-standard-tiers-to-units.js` ยุบ **primary + supplier → `sealed`** เหมือนกันหมด →
ข้อมูลว่าขวดนี้มาจาก primary หรือ supplier (supply) **หายไป**.

ต้องการเก็บที่มา (primary / supply) ไว้บนขวดเป็นข้อมูล**อ้างอิง** — ไม่ต้องโชว์ในตารางหลัก
แต่ต้องมีบันทึกไว้ ทั้งของเก่าที่ migrate แล้วและของที่รับเข้าใหม่.

## การตัดสินใจที่เคลียร์แล้ว

- **ขอบเขต**: มีผลทั้งขวดเก่า (migrate) และขวดรับเข้าใหม่.
- **`supply` = tier `supplier` เดิม**.
- **ขวด working**: ต้องมี source ด้วย — ขวด working ที่เกิดใหม่จาก Withdraw จะ **inherit จากขวด sealed แม่**;
  ขวด working tier เก่าที่ migrate มาตรงๆ (ไม่มีแม่ให้สืบ) → ปล่อย `''` (unknown) ให้ lab มาเติมทีหลังได้.
- **Backfill ของเก่า**: ใช้วิธี in-place ตามลำดับ insertion (ไม่ลบ-ไม่ re-migrate) เพื่อไม่ทำลาย edit ที่ lab ทำไปแล้ว.

## ขอบเขตงาน

### 1. โมเดล — `server/models/StockUnit.js`

เพิ่มฟิลด์:
```js
source: { type: String, enum: ['primary', 'supply', ''], default: '' },
```
ค่า `''` = ไม่ทราบ/ยังไม่ระบุ. ไม่ index (ใช้เป็นข้อมูลอ้างอิงรายขวด ไม่ query กรอง).

ฝั่ง frontend type ของ StockUnit (ที่ใดที่ประกาศไว้) เพิ่ม `source?: 'primary' | 'supply' | ''`.

### 2. รับเข้าใหม่ — `POST /standards/:id/units/receive`

- body เพิ่ม `source` (`'primary' | 'supply'`). validate: ต้องเป็นหนึ่งในสองค่านี้ (รับเข้าใหม่ **บังคับเลือก**, ไม่รับ `''`).
- แปะ `source` ลงทุกขวด sealed ที่สร้างใน loop.
- `ReceiveBottlesDialog.tsx`: เพิ่มตัวเลือก primary / supply (radio/select) — บังคับเลือกก่อนกดรับเข้า.

### 3. เบิก working — `POST /units/:qrId/withdraw`

- ตอนสร้างขวด working ลูก ใส่ `source: parent.source` (inherit ตรงๆ รวมกรณี `''`).
- ไม่ถามผู้ใช้ ไม่มี UI เพิ่ม.

### 4. แก้รายขวด — `PATCH /units/:qrId` + `EditUnitDialog.tsx`

- endpoint: รับ `source` เพิ่ม; ถ้า `source !== undefined` และอยู่ใน `['primary','supply','']` → เซ็ตค่า.
- `EditUnitDialog`: เพิ่ม field เลือก source (primary / supply / —ว่าง—) เพื่อให้ lab เติม source ให้ขวด working เก่าที่ปล่อยว่างได้.

### 5. Backfill ของเก่า (สคริปต์ใหม่)

ไฟล์: `server/scripts/backfill-stockunit-source.js` (dry-run default, `--commit` เขียนจริง).

ตรรกะ ต่อ `StockStandard` 1 ตัว:
1. ดึงขวด sealed ที่ `itemCode === std.code`, `createdBy.email === 'migration'`, `source === ''` (หรือ field ยังไม่มี) เรียงตาม `_id` จากน้อยไปมาก (= ลำดับที่ถูก create ใน migration loop: primary ก่อน แล้ว supplier).
2. `primaryCount = floor(std.primary.qty)`. ขวด sealed ลำดับที่ `0 .. primaryCount-1` → `source='primary'`, ที่เหลือ → `source='supply'`.
3. ขวด `kind='working'` ของ migration → ปล่อย `''` (ไม่แตะ).
4. นับสรุปต่อสาร + รวมทั้งหมด; ปิดท้ายเตือน `npm run seed:export`.

หมายเหตุความถูกต้อง: migration loop เดิม push `primary` ก่อน `supplier` แล้วจึง `working`
(ดู `tierBottles()` ใน `migrate-standard-tiers-to-units.js`) และ create ตามลำดับ →
`_id` (ObjectId) คงลำดับ insertion จึง match กลับได้ตรง. แตะเฉพาะขวด `createdBy.email='migration'`
ที่ `source` ยังว่าง → ขวดที่ lab รับเข้าใหม่/แก้ไปแล้วไม่โดน, และรันซ้ำได้ปลอดภัย (idempotent).

### 6. อัปเดต migration script — `migrate-standard-tiers-to-units.js`

ให้ `tierBottles()` แนบ source ไปกับแต่ละขวด: `primary→'primary'`, `supplier→'supply'`, `working→''`
แล้ว `StockUnit.create({... source})`. เผื่อ fresh DB จาก seed หรือสารที่ยังไม่เคย migrate
จะได้ source ถูกตั้งแต่แรกโดยไม่ต้องพึ่ง backfill.

### 7. การแสดงผล

- **ไม่** แสดงใน tab Standards ตารางหลัก (`Stock.tsx`).
- แสดงเป็นป้าย/ฟิลด์เล็กๆ ต่อขวด **เฉพาะใน** `UnitsDrawer` (รายการขวด) และ `EditUnitDialog`.
- ป้าย: `primary` / `supply` / (ว่าง = ไม่แสดงป้าย).

## เทสต์

- backend: receive validate source (reject ค่าผิด/ว่างตอนรับเข้าใหม่), withdraw inherit source จากแม่,
  patch เซ็ต source ได้.
- migration: tierBottles แนบ source ถูกต่อ tier.
- backfill: เคส primary.qty + supplier.qty คละกัน → แบ่ง primary/supply ตามลำดับถูก; idempotent
  (รันซ้ำไม่เปลี่ยนค่าที่ตั้งแล้ว); working migration ไม่โดนแตะ.

## ออกนอกขอบเขต (YAGNI)

- ไม่ทำ filter/รายงานแยกตาม source.
- ไม่ migrate/แตะ tier solvent / glassware.
- ไม่เดา source ให้ขวด working เก่าอัตโนมัติ (ปล่อย lab เติมเอง).
