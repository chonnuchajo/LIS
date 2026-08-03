# แท็บ "กำลังใช้งานอยู่" ในหน้า /stock-deduction

วันที่: 2026-08-03

## 1. ปัญหา / เป้าหมาย

Standard ที่เบิกไปเตรียมเป็นสารละลายแล้ว มีอายุการใช้งานตาม **"ความถี่/1 ครั้ง"** (`StockStandard.frequency`
เช่น `1/1 Week` = เตรียมใหม่ทุก 1 สัปดาห์) แต่ระบบไม่มีที่ให้ดูว่า "ตอนนี้มีอะไรเตรียมไว้ใช้งานอยู่บ้าง
และตัวไหนครบกำหนดแล้ว" — คนใช้ต้องจำเอง

เป้าหมาย: เพิ่มแท็บ **"กำลังใช้งานอยู่"** ที่ `/stock-deduction` แสดงของที่เบิกไปแล้วยังไม่ปิด
พร้อมนาฬิกาตามความถี่ และแจ้งเตือนทุกคนเมื่อใกล้ครบ/ครบกำหนด

## 2. ความต้องการ

| # | ข้อกำหนด | ที่มา |
|---|---|---|
| R1 | แท็บเก็บเฉพาะ **Standard** (ไม่รวม solvent / เครื่องแก้ว) | ผู้ใช้เลือก |
| R2 | อายุของแต่ละแถว = เวลาที่เบิก + ช่วง `frequency` ของสารนั้น | ผู้ใช้ |
| R3 | แถวหลุดจากแท็บเมื่อ **กดรับทราบ** (ตอนหมดอายุ) หรือ **กด "ใช้หมด/ทิ้ง"** เอง (เลิกใช้ก่อนหมดอายุก็ได้) | ผู้ใช้เลือก |
| R4 | แจ้งเตือน**ทุกคน** แต่ **กดรับทราบได้เฉพาะคนที่เบิก** — กดแล้วหายจากกระดิ่งของทุกคน | ผู้ใช้เลือก |
| R5 | สารที่ยังไม่ได้ตั้ง `frequency` (43/138 ตัว) → เข้าแท็บปกติ ขึ้นสถานะ "ยังไม่ได้ตั้งความถี่" ไม่มีวันครบกำหนด ไม่เตือน | ผู้ใช้เลือก |
| R6 | เตือน 2 จังหวะ: **ล่วงหน้า 1 วัน** และ **ตอนครบกำหนด** | ผู้ใช้เลือก |

## 3. สิ่งที่มีอยู่แล้ว (ต่อยอด ไม่สร้างใหม่)

- **`StockTransaction`** — การเบิก standard = `action: 'deduct'`, `itemType: 'standard'`, มี `qrId`, `weights`,
  `instrumentGroup`, `userEmail/userName`, `createdAt`
- **`deductionResolution`** (`{ reason, note, resolvedAt, resolvedBy }`) — deduct ที่ **ยังไม่มี** ฟิลด์นี้
  คือ "ยังไม่ปิด" อยู่แล้ว; `buildPendingDeductionFilter()` (`server/lib/deductionResolution.js`) คือ filter นั้น
  และ `StandardRequisitionDialog` บังคับให้แจ้งปิดของเดิมตอนเบิกซ้ำ
- **`server/lib/workingLifecycle.js`** — `parseFrequencyInterval` / `addInterval` (regex `/i` รองรับ `1/1 Week` ตัวใหญ่)
- **`DeductionResolutionDialog` + `DeductionDetailSheet`** — UI ปิดรายการ ("แจ้งหมด/ปัญหา") มีครบแล้วในหน้าเดิม
- **`useAccessibleTabs` + `src/lib/tabRegistry.ts`** — deny-model คุมสิทธิ์แท็บรายหน้า
- **`NotificationContext` + `PetitionFlowWatcher`** — กระดิ่ง client-side + แพตเทิร์น watcher ที่ poll แล้ว push

**หลักการ: ไม่สร้าง model ใหม่** — "กำลังใช้งานอยู่" = pending deduction ที่มีอยู่แล้ว บวกนาฬิกาความถี่

## 4. สถาปัตยกรรม

### 4.1 นิยามแถว

```
แถว 1 แถว = StockTransaction { action: 'deduct', itemType: 'standard', deductionResolution: ไม่มี }
dueAt      = createdAt + parseFrequencyInterval(standard.frequency)   // ไม่มี/parse ไม่ได้ → null
```

- สารเดียวกันเบิกให้ GC และ HPLC = คนละแถว (แยกตาม transaction ตามธรรมชาติ)
- **ไม่** cap `dueAt` ด้วย EXP ขวดแม่ — ใช้ความถี่ล้วน ๆ (R2)

### 4.2 Backend

**`server/lib/workingLifecycle.js`** — เพิ่ม pure helper
```js
dueAtFor(withdrawnAt, frequency) → Date | null   // ใช้ parseFrequencyInterval + addInterval ที่มีอยู่
```

**`server/lib/deductionResolution.js`** — `VALID_REASONS` เพิ่ม `'expired'`
- `expired` **ไม่ต้อง**กรอกโน้ต (เหมือน `empty`); `ineffective`/`other` ยังบังคับโน้ตเหมือนเดิม

**`server/models/StockTransaction.js`** — `DeductionResolutionSchema.reason` enum เพิ่ม `'expired'`

**Endpoint ใหม่ `GET /stock/standards/in-use`**
```json
{ "serverTime": "...", "items": [{
  "_id", "itemCode", "itemName", "qrId", "weights", "totalMg", "instrumentGroup",
  "note", "withdrawnAt", "frequency", "dueAt", "userEmail", "userName" }] }
```
- filter = `buildPendingDeductionFilter({ itemType: 'standard' })`, sort `createdAt: -1`, limit 500
- join `StockStandard.find({ code: { $in: [...itemCodes] } })` ครั้งเดียว → map `frequency` → เติม `dueAt`
- `totalMg` = ผลรวม `weights` (หรือ `-volumeDelta` ถ้าไม่มี weights)
- ส่ง `dueAt` เท่านั้น — **ไม่ส่งสถานะ** (ดู 4.3)

**`POST /transactions/:id/resolve-deduction`** — เพิ่ม guard
- `reason === 'expired'` → อีเมลผู้กด (`userMeta(req)`) ต้องตรง `tx.userEmail` (เทียบแบบ trim + lowercase)
  ไม่ตรง → `403 { error: 'รับทราบได้เฉพาะคนที่เบิก' }`; `tx.userEmail` ว่าง → 403 เช่นกัน
- reason อื่นคงพฤติกรรมเดิมทุกอย่าง (ใครก็แจ้งปิดได้ — flow เบิกซ้ำต้องพึ่ง)

### 4.3 สถานะ — คำนวณที่ FE ที่เดียว

`src/lib/standardInUse.ts` (pure + test) — BE ส่ง `dueAt` กับ `serverTime` เท่านั้น เพื่อไม่ให้เกิด logic 2 สำเนา
ที่ต้องคอย sync กันเอง (บทเรียนจาก `isEnumAbnormal`)

```ts
export type InUseStatus = "expired" | "dueSoon" | "active" | "noFrequency";

inUseStatus(row, now, soonMs = 24*60*60*1000): InUseStatus
// ลำดับ: ไม่มี dueAt → noFrequency ; now >= dueAt → expired ;
//        dueAt - now <= soonMs → dueSoon ; นอกนั้น active

sortInUse(rows, now): rows        // หมดอายุ(เกินกำหนดนานสุดก่อน) → ใกล้ครบ → ปกติ → noFrequency(ท้ายสุด)
canAcknowledge(row, user): boolean // status === 'expired' && email ตรง row.userEmail (trim+lowercase)
```

### 4.4 Frontend — หน้า `/stock-deduction`

- `src/lib/tabRegistry.ts` เพิ่ม
  `"/stock-deduction": [{ key: "in-use", label: "กำลังใช้งานอยู่" }, { key: "history", label: "ประวัติการตัด stock" }]`
- `StockDeduction.tsx` ครอบด้วย Radix `Tabs` + `useAccessibleTabs("/stock-deduction")`
  (แท็บแรกเป็นค่าเริ่มต้น; ถ้าถูก deny จะ fallback ไปแท็บที่เห็นได้ตามที่ hook คืน `defaultKey`)
- **แท็บ history** = ตารางเดิม + ตัวกรองหมวดเดิม ย้ายมาทั้งดุ้น ไม่แก้พฤติกรรม
- **แท็บ in-use** = `DataTable` ใหม่ (`src/components/lis/stock/StandardsInUseTable.tsx`)

| คอลัมน์ | เนื้อหา |
|---|---|
| สาร | `itemName` + code |
| เครื่อง | `instrumentGroup` (GC/HPLC) หรือ `-` |
| เบิกเมื่อ | `withdrawnAt` แบบไทย |
| ครบกำหนด | วันที่ + ระยะ ("อีก 2 วัน" / "เกิน 3 วัน") หรือ `-` |
| สถานะ | badge: `กำลังใช้งาน` เทา · `ใกล้ครบกำหนด` เหลือง · `หมดอายุ` แดง · `ยังไม่ได้ตั้งความถี่` เทาจาง |
| ผู้เบิก | `userName || userEmail` |
| (ท้ายแถว) | ปุ่ม **"รับทราบ"** เมื่อ `canAcknowledge` เป็นจริง; ถ้าหมดอายุแต่ไม่ใช่คนเบิก → ข้อความ "รอ <ชื่อ> รับทราบ" |

- คลิกแถว → `DeductionDetailSheet` เดิม (มีปุ่ม "แจ้งหมด/ปัญหา" → `DeductionResolutionDialog` = ทาง "ใช้หมด/ทิ้ง" ของ R3)
- กดรับทราบสำเร็จ → `invalidateQueries(["stock", "in-use"])` + `["stock-deductions"]`

### 4.5 แจ้งเตือน

`src/components/lis/StandardExpiryWatcher.tsx` mount ใน `App.tsx` ข้าง `PetitionFlowWatcher`

- `useQuery({ queryKey: ["stock", "in-use"], refetchInterval: 60_000 })` — คีย์เดียวกับหน้า in-use → เปิดหน้าอยู่ก็ไม่ยิงซ้ำ
- ทุกรอบที่ได้ data:
  - แถว `dueSoon` → `push({ id: 'std-inuse:<txId>:soon', level: 'warning', ... })`
  - แถว `expired` → `push({ id: 'std-inuse:<txId>:expired', level: 'error', ... })`
  - ทั้งคู่ `persistent: true`, `group: 'standard-expiry'`, `link: '/stock-deduction'`
  - ข้อความ: title `ใกล้ครบกำหนด: <ชื่อสาร>` / `หมดอายุแล้ว: <ชื่อสาร>` ·
    message `เบิกโดย <ผู้เบิก> เมื่อ <วันที่> · ครบกำหนด <วันที่>`
  - **reconcile**: `notifications` ตัวไหนที่ id ขึ้นต้น `std-inuse:` แต่ไม่อยู่ในชุด id ที่คำนวณได้รอบนี้ → `dismiss(id)`
  - แถวหนึ่งอยู่ในชุด id เดียวเสมอ (สถานะเดียว) — พอ `dueSoon` กลายเป็น `expired`
    รอบถัดไปชุดจะมีแค่ `:expired` แล้ว reconcile จะลบ `:soon` ทิ้งเอง ไม่ค้างซ้อนกัน
- ผลลัพธ์: คนเบิกกดรับทราบ → แถวหลุดจาก endpoint → **กระดิ่งของทุกคนหายเองภายใน 1 นาที** (R4)
  โดยไม่ต้องเก็บ read-state รายคนที่ server และไม่ต้องแก้ `NotificationContext`
- ไม่กรองแผนก/สิทธิ์ — แจ้งทุกคนที่ล็อกอิน (R4)

### 4.6 Data flow

```
เบิก standard (StandardRequisitionDialog)
   └─ POST /units/:qrId/deduct-mg → StockTransaction{action:deduct, itemType:standard}   ← แถวเกิดตรงนี้
                                          │
        GET /stock/standards/in-use ──────┤ join StockStandard.frequency → dueAt
                 │                        │
      ┌──────────┴───────────┐            │
      ▼                      ▼            │
 แท็บ "กำลังใช้งานอยู่"   StandardExpiryWatcher → กระดิ่ง (push + reconcile)
      │
      ├─ ปุ่ม "รับทราบ" (เฉพาะคนเบิก)  → resolve-deduction { reason: 'expired' } ─┐
      └─ ปุ่ม "ใช้หมด/ทิ้ง" (ใครก็ได้) → resolve-deduction { empty|other|... } ──┤
                                                                                 ▼
                                                            แถวหลุดจาก endpoint → กระดิ่งทุกคนหาย
```

## 5. เคสขอบ

- **สารไม่มี `frequency`** → `dueAt = null` → `noFrequency`, ไม่ถูก push แจ้งเตือน, เรียงท้ายสุด (R5)
- **`frequency` มีแต่ parse ไม่ได้** (ค่าแปลก) → ปฏิบัติเหมือนไม่มีความถี่ (`noFrequency`) ไม่พังหน้า
- **transaction ที่หา `StockStandard` จาก `itemCode` ไม่เจอ** (สารถูกลบ) → `frequency: ''` → `noFrequency`
- **`userEmail` ว่างในของเก่า** → ไม่มีใครกดรับทราบได้ → ต้องใช้ปุ่ม "ใช้หมด/ทิ้ง" ปิดแทน (ตั้งใจ)
- **เบิกซ้ำสารเดิมกลุ่มเครื่องเดิม** → flow เดิมบังคับปิดของเก่าอยู่แล้ว จึงไม่เกิด 2 แถวซ้อน
- **ของค้างเก่าก่อนเปิดฟีเจอร์** — pending deduct เก่าจะขึ้นแดงหมดวันแรกและกระดิ่งเด้งรัว
  → `server/scripts/close-stale-standard-deductions.js` (dry-run เป็นค่าเริ่มต้น, ต้อง `--commit` ถึงเขียนจริง)
  ปิด pending ที่ `createdAt` เก่ากว่าวันเปิดใช้ ด้วย `reason: 'other'` + note "ปิดยอดค้างก่อนเปิดแท็บกำลังใช้งาน"
  — **ผู้ใช้ต้องรันเองบน prod**; seed-data ในรีโปเก่าตั้งแต่ 13 มิ.ย. จึงประเมินจำนวนล่วงหน้าไม่ได้
- **นาฬิกาเครื่องผู้ใช้เพี้ยน** → ใช้ `serverTime` ที่ endpoint ส่งมาเป็นฐานเวลาในการตัดสินสถานะ

## 6. เทสต์

- `src/lib/standardInUse.test.ts` — 4 สถานะ, เส้นแบ่ง 24 ชม.เป๊ะ (`dueAt - now === soonMs` → `dueSoon`),
  `now === dueAt` → `expired`, ลำดับ `sortInUse`, `canAcknowledge` (ตรง/ไม่ตรง/อีเมลว่าง/ยังไม่หมดอายุ)
- `server/lib/workingLifecycle.test.js` — `dueAtFor`: `1/1 Week` ตัวใหญ่, `1/2 month`, ค่าว่าง → null, ค่าแปลก → null
- `server/lib/deductionResolution.test.js` — `expired` ผ่านโดยไม่มีโน้ต; reason นอก enum ยัง error เหมือนเดิม
- `src/components/lis/__tests__/StandardExpiryWatcher.test.tsx` — 2 แถว → push 2; รอบถัดไปเหลือ 1 → `dismiss`
  เฉพาะอันที่หาย และไม่แตะ notification กลุ่มอื่น
- ทั้งชุด: `npm run test`, `npx tsc -p tsconfig.app.json --noEmit`, `node --test server/lib/*.test.js`

## 7. ไม่อยู่ในขอบเขต

- solvent / เครื่องแก้ว ในแท็บนี้ (R1)
- แจ้งเตือนทาง LINE (เฉพาะกระดิ่งในเว็บ)
- แก้ `frequency` ของสารจากหน้านี้ — ยังไปตั้งที่หน้า Stock เหมือนเดิม
- backfill `frequency` ให้ 43 สารที่ยังว่าง (งานกรอกข้อมูลของผู้ใช้)
- เก็บสถานะ "อ่านแล้ว" รายคนที่ server — ใช้ reconcile ผ่าน endpoint แทน
