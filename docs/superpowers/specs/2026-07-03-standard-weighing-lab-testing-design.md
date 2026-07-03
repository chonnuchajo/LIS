# ชั่ง Standard ในหน้า Lab Testing + หักสต็อกอัตโนมัติ

วันที่: 2026-07-03
สถานะ: Design (รออนุมัติ)
เกี่ยวข้องกับ:
- `2026-06-01-standard-config-redesign-design.md` (Standard Config — ตัว `times`)
- `2026-06-06-standards-per-bottle-qr-stock-design.md` (StockUnit รายขวด QR + working solution)

## 1. เป้าหมาย (Goal)

เพิ่มส่วน **"ชั่ง standard"** ในหน้า `/lab-testing/:id` เพื่อให้ผู้วิเคราะห์บันทึกการชั่งสารมาตรฐานของแต่ละสารที่ทดสอบ โดย:

- **ขับด้วย Standard Config**: จำนวนครั้งที่ต้องชั่ง (`times`) มาจาก Standard Config ต่อเครื่อง (GC/HPLC) และ override รายสาร (commonName) ได้
- **หักสต็อกอัตโนมัติ**: เมื่อกด "บันทึกผล" ระบบหักปริมาณสาร (mg) ออกจากขวด StockUnit ที่สแกน QR ให้เอง พร้อม log ธุรกรรม
- **รองรับ working solution**: ถ้ามี working solution ที่ยังไม่หมดอายุ ใช้ตัวนั้นแทนการชั่งใหม่ (ไม่หัก solid)

หน้า Standard Config เดิมเขียนคำอธิบายไว้ว่า *"ใช้สำหรับตัดสต็อกในอนาคต"* — งานนี้คือการทำ "อนาคต" นั้นให้เป็นจริง

## 2. บริบทปัจจุบัน (Current State)

- **Standard Config** (`models/StandardConfig.js`, หน้า `StandardConfig.tsx`): 1 แถว = (instrument, scope, commonName?). `scope='all'` = ค่า default ต่อเครื่อง (ลบไม่ได้), `scope='substance'` = override รายสาร. field `times` = จำนวนครั้งที่ใช้ standard. ปัจจุบันมี 2 แถว: GC default = 3, HPLC default = 1. ยังไม่มี substance override.
- **StockStandard** (`models/Stock.js`): 138 รายการ, `name` = ชื่อสารออกฤทธิ์ (เช่น "Abamectin", "Atrazine") = ตรงกับ commonName ของสารที่ทดสอบ. มี tier `primary/supplier/working` (นับเป็นขวด), `usagePerUseMg` (มก./ครั้ง; บางตัวเป็น string ขึ้นกับเครื่อง เช่น `"GC = 30 , HPLC = 63"`), `frequency` (เช่น `"1/1 Week"` — รอบเปลี่ยน/อายุ working solution), `openShelfLife`.
- **StockUnit** (`models/StockUnit.js`): ขวดราย QR. `kind: 'sealed'|'working'`, `volume:{initial, remaining, unit:'ml'|'mg'|'g'}`, `status:'active'|'empty'|'discarded'`, `exp`, `lotNo`, `parentId`, `itemCode` (= StockStandard.code). ข้อมูลจริง: 216 sealed + track เป็น **mg** (เช่น 250mg, 100mg) → flow "สแกน QR แล้วหัก mg" ทำได้จริง.
- **Petition** (`models/Petition.js`): `items[].commonName/sampleName/sampleId`, `assignedMachines[]` (machineId, code, name, sampleName, commonName). สารแต่ละกลุ่ม (sampleName+commonName) ถูก assign เครื่องของตัวเอง.
- **การ resolve method (GC/HPLC) ต่อสาร**: มาจาก **simple-method ของ commonName** (positional, `parseSubstances` + `SimpleMethod` + method registry `requiresMachine`) — logic เดียวกับที่หน้า assign ใช้ (`assignMachineGrouping.ts` / `groupMachineMethods`). ไม่ได้ resolve จาก field ของเครื่องโดยตรง (Machine.type ส่วนใหญ่ว่าง).
- **หน้า lab-testing** (`LabTestingDetailPage.tsx`): ปัจจุบันบันทึกเฉพาะ "ผลพารามิเตอร์" (QCTestResult) — **ยังไม่มี**ส่วนชั่ง standard.
- **Stock deduct ปัจจุบัน**: `POST /standards/:id/deduct { tier, qty }` หักเป็น "ขวด" ระดับ tier; `POST /standards/units/:qrId/withdraw { ml }` แบ่ง working จาก sealed. ยังไม่มี endpoint หัก mg ตรงจากขวด.

## 3. ข้อกำหนด (จากการเก็บ requirement)

1. `times` = **จำนวนครั้งที่ต้องชั่ง standard ต่อการทดสอบ 1 ครั้ง** (GC=3, HPLC=1, หรือ override รายสาร). แต่ถ้ามี working solution ที่ยังใช้ได้ ให้ใช้ตัวนั้นแทน — ไม่ต้องชั่งใหม่.
2. resolve `times`: ใช้ **default ต่อเครื่อง (scope=all)** ยกเว้นสารนั้นมี **Standard Config แยก (scope=substance)** → ใช้ค่านั้นแทน.
3. จับคู่ตัวสารที่จะหัก: ผู้วิเคราะห์ **สแกน QR ของขวด** เพื่อระบุ StockUnit (ระบบ suggest ขวดจาก commonName↔name ได้ แต่ตัวจริงมาจาก QR ที่สแกน).
4. ผู้วิเคราะห์ **กรอกน้ำหนักที่ชั่งได้ N ช่อง** (N = times) + toggle **"ชั่งใหม่" / "ใช้ working เดิม"**.
5. หน่วยการหัก = **มิลลิกรัม (mg)**: รวม mg จากทุกช่องที่ชั่ง → หักจาก `volume.remaining` ของ StockUnit ที่สแกน.
6. **จังหวะหัก = อัตโนมัติตอนกด "บันทึกผล"**.
7. **บล็อกการบันทึกผล** ถ้าสาร (ที่ต้องใช้ standard) ยังไม่ตั้ง Standard Config / หา StockStandard ไม่เจอ / กรอกชั่งไม่ครบ / สต็อกไม่พอ / ขวดหมดอายุ.
8. ชั่งใหม่สำเร็จ → **สร้าง working StockUnit ใหม่อัตโนมัติ** (exp ตาม frequency) เพื่อให้รอบถัดไปเลือก "ใช้ working เดิม" ได้.
9. ขอบเขต = **lab-testing เท่านั้น** (QC testing ไม่แตะ).

## 4. Logic การ resolve งานชั่ง (ต่อ petition)

สร้างรายการ "งานชั่ง" (weigh task) ต่อ **(สาร commonName × instrument ที่เป็น machine-backed)**:

```
for each substance group (sampleName+commonName) ใน petition.items:
  methodCodes = machine-backed method codes ของ commonName        # simple-method positional, requiresMachine
  for each instrument in methodCodes (GC/HPLC):
    times      = StandardConfig(instrument, scope=substance, commonName)?.times
                 ?? StandardConfig(instrument, scope=all)?.times      # default
    stockStd   = StockStandard where name == commonName (case-insensitive)   # สำหรับ suggest ขวด
    → weigh task { sampleId, commonName, instrument, times, stockStd? }
```

- ถ้าสารไม่ใช่ GC/HPLC (bench/ไม่มี machine-backed method) → **ไม่มีการ์ดชั่ง** (ไม่ต้องใช้ standard).
- สารที่มีทั้ง GC และ HPLC → มี 2 การ์ด (คนละ instrument, คนละ times).
- เงื่อนไขบล็อก (ข้อ 7) เช็คเฉพาะ weigh task ที่ถูกสร้างขึ้น.

## 5. Data Model — `StandardWeighing` (ใหม่)

collection แยก + `softDeletePlugin` (ตาม convention). 1 doc = 1 weigh task.

```js
{
  petitionId:  ObjectId (ref Petition, index),
  petitionNo:  String,
  sampleId:    String,        // ระบุ substance group
  commonName:  String,
  instrument:  String,        // 'GC' | 'HPLC'
  times:       Number,        // snapshot ของ times ตอนบันทึก
  mode:        String,        // 'fresh' | 'working'
  masses:      [Number],      // น้ำหนัก mg ที่ชั่ง (ยาว = times เมื่อ mode='fresh')
  totalMg:     Number,        // ผลรวมที่หัก (mode='fresh')
  bottleQrId:  String,        // StockUnit sealed ที่สแกน (mode='fresh')
  workingQrId: String,        // StockUnit working ที่เลือก (mode='working') หรือที่สร้างใหม่ (mode='fresh')
  deductedAt:  Date,          // null = ยังไม่หัก; ตั้งค่า = หักแล้ว (idempotent guard)
  deductedBy:  { email, name },
  note:        String,
}
```

- **unique index** `{ petitionId, sampleId, instrument, deletedAt }` → 1 งานชั่ง 1 doc, upsert ได้.
- `deductedAt != null` = หักไปแล้ว → บันทึกซ้ำไม่หักซ้ำ.

## 6. Backend

### 6.1 หัก mg จากขวด — `POST /standards/units/:qrId/deduct-mg`
body `{ mg, sampleId?, petitionNo?, note? }`

- validate `mg` เป็นเลข > 0.
- หา StockUnit ตาม qrId; ต้อง `status='active'`, ไม่หมดอายุ, ไม่ discarded.
- **atomic**: `findOneAndUpdate({ qrId, status:'active', 'volume.remaining': { $gte: mg } }, { $inc: { 'volume.remaining': -mg } })` (กัน race เหมือน withdraw). ไม่พอ → 400 `"ปริมาณคงเหลือไม่พอ"`.
- ถ้า `remaining <= 0` → set `status='empty'`.
- `logTransaction({ itemType:'standard', action:'deduct', qrId, volumeDelta:-mg, volumeUnit:'mg', unit:'mg', sampleId, petitionNo→note, ... })`.

### 6.2 สร้าง working unit อัตโนมัติ (mode='fresh')
ใช้ helper ร่วมกับ `workingExpForWithdraw(now, std.frequency, std.openShelfLife, parent.exp)`:
- สร้าง StockUnit `{ kind:'working', itemCode, itemName, source, parentId=sealed._id, lotNo, exp, volume:{ unit:'mg', initial:0, remaining:0 }, status:'active', withdrawnDate:now, createdBy }`.
- คืน `workingQrId` เก็บใน StandardWeighing.
- หมายเหตุ: v1 ไม่ track ปริมาตร working (initial/remaining=0) — จุดประสงค์คือ "มี working ที่ยัง valid ให้เลือกรอบหน้า" ตัดสินด้วย `exp` เท่านั้น. การหักปริมาตร working เมื่อ "ใช้ working เดิม" อยู่นอกขอบเขต v1.

### 6.3 StandardWeighing routes — `/standard-weighings`
- `GET /standard-weighings?petitionId=` → รายการงานชั่งของ petition (สำหรับ prefill).
- `PUT /standard-weighings` (upsert รายตัวตาม `{petitionId, sampleId, instrument}`) → บันทึก mode/masses/bottleQrId ระหว่างกรอก (ยังไม่หัก, `deductedAt=null`).
- การ**หักจริง**ไม่ทำที่ endpoint นี้โดยตรง แต่ทำตอน "บันทึกผล" (ดู 6.4).

### 6.4 จุดหักสต็อก — ต่อยอด flow "บันทึกผล" ของ lab
เมื่อ lab กด "บันทึกผล" (track completion ของ Lab):
1. โหลด weigh task ทั้งหมดของ petition + StandardWeighing ที่บันทึกไว้.
2. **ตรวจก่อนหัก (บล็อก)** — ถ้าเจอข้อใดข้อหนึ่ง → ตอบ error ไม่ทำ completion:
   - มี weigh task ที่ยังไม่มี StandardWeighing / mode='fresh' แต่กรอก masses ไม่ครบ N ช่อง / ไม่ได้สแกนขวด.
   - mode='fresh' แต่ขวดที่สแกน `remaining < Σmasses` หรือ ขวดหมดอายุ/discarded/empty.
   - resolve times ไม่ได้ (ไม่มี Standard Config ของ instrument นั้น).
   - หา StockStandard (name==commonName) ไม่เจอ.
3. **หัก** ทีละ weigh task ที่ mode='fresh' และ `deductedAt=null`:
   - เรียก logic 6.1 (หัก mg จากขวด) → ถ้าสำเร็จเรียก 6.2 (สร้าง working) → set `deductedAt/deductedBy` บน StandardWeighing.
   - mode='working' → ไม่หัก solid เพียงบันทึก workingQrId ที่เลือก.
4. หักครบทุกงาน → เดินหน้า completion เดิมต่อ.

> idempotency: ถ้า `deductedAt` มีค่าแล้ว (บันทึกซ้ำ/ส่งกลับแล้วกดใหม่) → ข้าม ไม่หักซ้ำ. การส่งกลับ (reject) ไม่คืนสต็อก — ถือว่าของถูกใช้จริงไปแล้ว (นอกขอบเขต v1; log ธุรกรรมมีให้ตรวจย้อนได้).

## 7. Frontend (`LabTestingDetailPage.tsx`)

### 7.1 ส่วน "ชั่ง Standard" (การ์ดต่อ weigh task)
วางเป็น section เหนือ/ใต้ส่วนกรอกผล (ก่อนปุ่มบันทึกผล). แต่ละการ์ด:
- **หัว**: `commonName · [GC|HPLC] · ชั่ง {times} ครั้ง` + badge สถานะ (ยังไม่กรอก / ครบ / หักแล้ว).
- **Toggle โหมด**: `ชั่งใหม่` | `ใช้ working เดิม`
  - เปิด "ใช้ working เดิม" เฉพาะเมื่อมี working unit ที่ valid ของสารนั้น (exp ยังไม่เกิน).
- **โหมดชั่งใหม่**:
  - ปุ่ม **สแกน QR ขวด** (ใช้ scanner เดิมของระบบ stock) → แสดง `lot / exp / คงเหลือ mg`. ระบบ suggest ขวดที่ตรง commonName; ถ้าสแกนขวดคนละสาร → เตือน.
  - **N ช่องกรอกน้ำหนัก (mg)** (N = times) → แสดง **ผลรวม mg ที่จะหัก** + เตือนถ้าเกินคงเหลือ.
- **โหมดใช้ working เดิม**:
  - เลือก/สแกน working unit ที่ valid → แสดง lot/exp. ไม่มีช่องน้ำหนัก, ไม่หัก solid.
- autosave ค่าที่กรอก (mode/masses/bottleQrId) ผ่าน `PUT /standard-weighings` (debounce) แบบเดียวกับการกรอกผลพารามิเตอร์.

### 7.2 การบล็อกปุ่มบันทึกผล
- ปุ่ม "บันทึกผล" disabled + ข้อความ ถ้ามี weigh task ที่ยังไม่ครบเงื่อนไข (client-side pre-check mirror ของ 6.4 ข้อ 2).
- ตอนกดบันทึกจริง backend เป็นด่านตัดสิน (server-authoritative): ถ้า backend บล็อก → toast error ชี้การ์ดที่มีปัญหา.
- ถ้า petition อยู่ในสถานะ locked/read-only เดิม → section ชั่งเป็น read-only เช่นกัน (mirror gate ที่มีอยู่).

## 8. Edge cases

- **สารไม่มี machine-backed method** → ไม่มีการ์ด, ไม่บล็อก.
- **usagePerUseMg เป็น string ("GC = 30, HPLC = 63")** → ใช้เป็นแค่ค่าช่วย prefill/แนะนำต่อ instrument (parse ได้ก็ prefill, parse ไม่ได้ก็ปล่อยว่างให้กรอกเอง). ค่าที่หักจริงมาจากน้ำหนักที่ผู้ใช้กรอกเสมอ.
- **สแกนขวดผิดสาร** (itemCode ไม่ตรง StockStandard ของ commonName) → เตือน + ไม่ให้ผูก.
- **หลายขวดของสารเดียว** → ผู้ใช้สแกนขวดที่ต้องการเอง (ไม่ auto-pick).
- **ส่งกลับแล้วแก้** → weigh ที่ `deductedAt` แล้วไม่หักซ้ำ; ถ้าเปลี่ยนขวด/น้ำหนักหลังหักไปแล้ว = นอกขอบเขต v1 (แจ้งเตือน "หักไปแล้ว แก้ไม่ได้").
- **race 2 คน**: การหัก mg เป็น atomic `$inc` เงื่อนไข `$gte` — คนหลังที่ทำให้ติดลบจะโดน 400.

## 9. Permissions

- ผู้ทดสอบ Lab ต้องมีสิทธิ์อ่าน `stock-standards`/`stock units` + เรียก `deduct-mg` + `standard-weighings`. ตรวจว่า path/สิทธิ์ปัจจุบันของโรล Lab ครอบคลุม (ถ้าไม่ครอบ เพิ่ม path ให้).

## 10. Testing

- **Unit (Vitest)**: 
  - resolver `times` (substance override > instrument default; ไม่มี config → null/บล็อก).
  - สร้าง weigh task จาก petition (กรอง machine-backed; แยกต่อ instrument).
  - รวม mg + เช็คคงเหลือ (client pre-check).
- **Backend**: `deduct-mg` (atomic, ไม่พอ→400, empty เมื่อ ≤0, log tx); upsert StandardWeighing; flow บันทึกผล (บล็อกครบทุกเงื่อนไข, idempotent ไม่หักซ้ำ, สร้าง working).
- **Manual E2E** (บนเครื่อง user): petition GC 1 สาร → ชั่ง 3 ช่อง → สแกนขวด → บันทึกผล → คงเหลือขวดลด + มี working unit ใหม่ + tx log; กดบันทึกซ้ำไม่ลดอีก; กรณีใช้ working เดิม; กรณีบล็อก (ไม่สแกน/สต็อกไม่พอ).

## 11. Non-goals / ข้อสมมติ

- QC testing ไม่แตะ (lab-testing เท่านั้น).
- "ใช้ working เดิม" ไม่หักปริมาตร working ใน v1.
- ไม่คืนสต็อกเมื่อ reject/ส่งกลับ.
- จำกัด instrument = GC/HPLC (ตามที่ Standard Config รองรับ).
- สมมติขวด standard ถูกลงทะเบียนเป็น StockUnit หน่วย mg แล้ว (ข้อมูลจริงมี 216 sealed) — สารที่ยังไม่มีขวดลงทะเบียนจะสแกนไม่ได้ → เข้าเงื่อนไขบล็อก.
