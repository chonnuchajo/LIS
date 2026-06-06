# Standards Per-Bottle Stock with QR/Barcode — Design

วันที่: 2026-06-06
สถานะ: รออนุมัติ spec
ขอบเขตรอบนี้: **Standards เท่านั้น** (สารเคมี/เครื่องแก้วคงระบบเดิม — ขยายทีหลังด้วยโครงเดียวกัน)

## 1. ปัญหา / เป้าหมาย

Stock เดิมเก็บ Standards เป็น *จำนวนรวมต่อ tier* (primary/supplier/working) ทุกขวดใน tier ใช้ EXP/ขนาดเดียวกัน — ไม่สามารถ:

- ระบุ **EXP รายขวด** (lot เดียวกันแต่คนละ EXP, หรือรับเข้าคนละรอบ)
- ติด **QR/Barcode รายขวด** เพื่อสแกนเบิก/ทิ้ง
- แบ่งของเหลวจากขวดใหญ่ (เช่น 100 ml ขวด → เบิก 20 ml ไปใช้) เป็นขวด working ที่มีอายุจำกัดตอนเปิดใช้
- บล็อกการใช้ขวดที่ถูกทิ้งแล้ว

เป้าหมาย: ติดตาม Standards **รายขวด** แต่ละขวดมี identity (QR), EXP, ปริมาตร, สถานะ ของตัวเอง + flow แบ่ง working + สแกนทิ้งที่ทำให้ QR ใช้ต่อไม่ได้

## 2. แนวคิดหลัก (สรุปการตัดสินใจ)

| หัวข้อ | การตัดสินใจ |
|---|---|
| สถาปัตยกรรม | **แนวทาง A** — แยก collection `StockUnit` (1 doc = 1 ขวดจริง) ผูกกับ `StockStandard` (แค็ตตาล็อก); ยอดรวมคำนวณจากการนับ unit ไม่เก็บซ้ำ |
| working คืออะไร | เบิก ml ออกจากขวด sealed → **สร้างขวดย่อยใบใหม่ + QR ใหม่** (kind=`working`) |
| EXP ของ working | `วันเบิก + openShelfLife` **cap ไม่เกิน EXP ขวดแม่** |
| ใช้งาน working | ไม่หัก ml รายครั้ง — ทั้งขวดถือว่า in-use จนหมดอายุแล้วทิ้ง |
| QR/Barcode | ระบบ **gen เอง + ปริ้นลาเบลเอง** (ต่อยอดระบบปริ้น server-side เดิม) |
| QR encode | เป็น **URL** `…/LIS/stock/scan/<qrId>` (สแกนกล้องมือถือเปิดเว็บได้) **และ** แอปดึง qrId จาก URL มาใช้ต่อได้ |
| สแกน | **กล้องมือถือ/แท็บเล็ต** ผ่านเบราว์เซอร์ (lib ฝั่ง browser) + fallback กรอก id มือ |
| ขนาดลาเบล/เครื่องปริ้น | ตั้งใน PrintConfig เอาเอง |
| QR ใช้ซ้ำไม่ได้ | `qrId` unique + `status='discarded'` → ทุก endpoint ปฏิเสธถาวร |

## 3. Data Model

### 3.1 `StockStandard` (เดิม — ปรับ)

- คงไว้เป็นแค็ตตาล็อกสาร (`code`, `name`, `storageTemp`, `usagePerUseMg`, `frequency`)
- **เพิ่ม** `openShelfLife: { value: Number, unit: 'day' | 'week' | 'month' }` — ระยะเวลาที่ขวด working อยู่ได้หลังเปิด (ใช้คำนวณ EXP working); แปลงจาก/อยู่คู่กับ `frequency` (text) เดิม
- ยอดรวม `primary`/`supplier`/`working` เดิม **เลิกแก้มือ** — API ส่ง `unitsSummary` ที่คำนวณจาก `StockUnit` แทน (ฟิลด์เดิมคงไว้ใน schema เพื่อ backward-compat แต่ไม่ใช้เป็นแหล่งความจริง)

### 3.2 `StockUnit` (ใหม่) — `server/models/StockUnit.js`

| field | type | หมายเหตุ |
|---|---|---|
| `qrId` | String, **unique index**, required | payload ใน QR (opaque short id เช่น `u_8f3k2p`) |
| `itemCode` | String, index, required | อ้าง `StockStandard.code` |
| `itemName` | String | denormalize ไว้แสดงผล |
| `kind` | String enum `['sealed','working']`, required | |
| `parentId` | ObjectId ref StockUnit, default null | เฉพาะ working = ขวดแม่ |
| `lotNo` | String | lot ผู้ผลิต |
| `exp` | Date | **EXP รายขวด** |
| `volume` | `{ initial: Number, remaining: Number, unit: String('ml'\|'mg'\|'g') }` | |
| `status` | String enum `['active','empty','discarded']`, default `active` | expired = คำนวณจาก `exp < now` ไม่เก็บ |
| `receivedDate` | Date | ขวด sealed |
| `withdrawnDate` | Date | ขวด working |
| `discardedAt` | Date | |
| `discardedBy` | `{ email, name }` | |
| `discardReason` | String | |
| `createdBy` | `{ email, name }` | |
| timestamps | | createdAt / updatedAt |

Index: `qrId` (unique), `itemCode`, `status`, `exp`.

### 3.3 `StockTransaction` (เดิม — เพิ่ม)

- `action` enum เพิ่ม: `'withdraw'`, `'discard'`
- field เพิ่ม: `unitId` (String), `qrId` (String), `volumeDelta` (Number), `volumeUnit` (String)
- `itemType` ใช้ `'standard'` เหมือนเดิม

## 4. Lifecycle & Workflows

### 4.1 รับเข้า (Receive)
- เลือกสาร → กรอก จำนวนขวด + ขนาด/ขวด (ml) + lotNo + EXP
- EXP กรอกรายขวด; มีปุ่ม "EXP เท่ากันทุกขวด" เพื่อกรอกทีเดียวทั้ง lot
- ระบบสร้าง `StockUnit` kind=`sealed` ทีละขวด (`volume.initial = volume.remaining = ขนาด`, `qrId` gen) → คิว print label
- log `receive` ต่อขวด

### 4.2 แบ่งใช้ → working (Withdraw)
- สแกน QR ขวด sealed (หรือเลือกจากลิสต์) → กรอก ml ที่แบ่ง
- ตรวจ (backend): ขวด `active` + ไม่ expired + `remaining ≥ ml`
- สร้าง `StockUnit` kind=`working`, `parentId`=แม่, `volume.initial/remaining = ml`, `withdrawnDate = วันนี้`
- `exp` = `วันนี้ + openShelfLife`, **cap ไม่เกิน exp ขวดแม่**
- หัก `remaining` ขวดแม่ (atomic) → ถ้า 0 → `status='empty'`
- print label working + log `withdraw`

### 4.3 ใช้งาน working
- ไม่หัก ml รายครั้ง — ทั้งขวด in-use จนหมดอายุแล้วทิ้ง

### 4.4 ทิ้ง (Discard)
- สแกน QR → ยืนยัน + เหตุผล → `status='discarded'`, `discardedAt/By`, QR ตายถาวร
- ทิ้งได้ทั้ง sealed และ working
- log `discard`

### 4.5 หมดอายุ (Expired)
- ไม่ลบอัตโนมัติ — `exp < now` → แสดงป้าย "หมดอายุ" แดง + บล็อกแบ่ง/ใช้ (สแกนทิ้งได้อย่างเดียว)

## 5. QR & การปริ้นลาเบล

- gen `qrId` (unique) ตอนสร้าง unit
- QR encode URL `…/LIS/stock/scan/<qrId>`; แอปรองรับ parse ทั้ง URL เต็มและ id เปล่า
- ใช้ lib `qrcode` ฝั่ง server gen เป็น dataURL ฝังในลาเบล
- เพิ่ม docType `stock-label` ใน PrintConfig (ตั้งเครื่องปริ้น/ขนาดกระดาษแยก เช่นเครื่องสติกเกอร์)
- เนื้อลาเบล: QR + ชื่อสาร + code + lotNo + ขนาด(ml) + EXP รายขวด + ป้าย kind (SEALED/WORKING)
- ปริ้นได้ตอนรับเข้า (หลายขวดรวด) และ reprint รายขวด

## 6. การสแกนด้วยกล้อง (ในแอป)

- component `<QrScanner>` ใช้ lib ฝั่ง browser (`html5-qrcode` หรือ `@zxing/browser`) เปิดกล้องหลัง
- ปุ่ม "สแกน" ลอยในหน้า Stock → dialog กล้อง → อ่าน QR → ดึง `qrId` → เปิดหน้า/dialog จัดการขวด (โชว์ปุ่ม action ตามสถานะ)
- **ข้อจำกัด:** กล้องเปิดได้เฉพาะ HTTPS/localhost → ตรวจว่า prod `/LIS/` เสิร์ฟผ่าน https; fallback กรอก qrId มือ / เลือกจากลิสต์
- หน้า `/stock/scan/:qrId` = ปลายทาง QR (เปิดจากกล้องมือถือนอกแอปได้); ถ้า `discarded` → แดง "ขวดนี้ถูกทิ้งแล้ว ใช้งานต่อไม่ได้" + ซ่อนปุ่ม

## 7. UI / หน้าเพจ

- **tab Standards** (ใน `Stock.tsx`): แต่ละแถวแสดง summary จากนับ unit — `คงคลัง(sealed) N` / `working M` + ป้าย `ใกล้หมดอายุ / หมดอายุ X`
- คลิกแถว → **drawer รายขวด**: ตาราง unit ทุกขวด (qrId ย่อ, kind, lotNo, ml เหลือ, EXP, สถานะ) + ปุ่ม reprint/ทิ้งรายขวด
- โมเดลรายขวดยุบ primary/supplier เดิมรวมเป็น **sealed (คงคลัง)** + **working**
- Component ใหม่: `ReceiveBottlesDialog`, `WithdrawDialog`, `DiscardDialog`, `QrScanner`, ปุ่ม "สแกน" ลอย, หน้า `/stock/scan/:qrId`

## 8. Backend / API

- model `StockUnit.js` + extend `StockTransaction`
- `routes/stock.js` เพิ่ม: `GET units` (filter by itemCode/status), `POST receive` (bulk), `POST withdraw`, `POST discard`, `GET by qrId`, `POST reprint`
- `src/lib/api.ts` + `src/types/stock.ts` เพิ่ม endpoint/type
- เพิ่ม docType `stock-label` ในระบบปริ้นเดิม

## 9. Error Handling & Edge Cases

- แบ่ง/ทิ้งขวด `discarded`/`expired` → ปฏิเสธที่ **backend** (ไม่ใช่แค่ UI)
- แบ่ง ml > remaining → reject
- แบ่งพร้อมกัน 2 คน → `findOneAndUpdate` แบบ atomic เช็ค `remaining` กันแข่ง (race)
- working exp ไม่เกิน exp ขวดแม่ (cap)
- `qrId` ชนกัน → gen ใหม่อัตโนมัติ (retry)
- กล้องเปิดไม่ได้ (ไม่ใช่ https) → fallback กรอก id มือ

## 10. Testing

- **Vitest**: คำนวณ working EXP จาก `openShelfLife` + cap ขวดแม่; หัก remaining + เปลี่ยน status เป็น `empty`; guard discarded/expired
- ปริ้น/กล้อง = manual test (ไม่ทำ e2e กล้อง)

## 11. seed-data

`StockUnit` เป็น collection ใหม่ → `seed:export` แบบ dynamic เก็บอัตโนมัติ; commit `seed-data/` ตามปกติ

## 12. นอกขอบเขตรอบนี้ (YAGNI)

- per-bottle/QR สำหรับ สารเคมี (Solvents) และ เครื่องแก้ว (Glassware)
- การหัก ml รายครั้งของขวด working
- รายงาน/สถิติการใช้ Standards เชิงลึก
