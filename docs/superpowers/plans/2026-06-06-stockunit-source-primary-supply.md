# StockUnit `source` (primary / supply) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เก็บที่มา (primary / supply) ของขวดสารมาตรฐานบน `StockUnit` เป็นข้อมูลอ้างอิง ทั้งขวดที่ migrate มาแล้วและที่รับเข้าใหม่ โดยไม่โชว์ในตารางหลัก

**Architecture:** เพิ่มฟิลด์ `source` (`'primary'|'supply'|''`) บน `StockUnit`. ตรรกะ pure (validate / map tier→source / assign ตามลำดับขวด) แยกไป `server/lib/stockSource.js` ทดสอบด้วย `node:test`. รับเข้าใหม่บังคับเลือก source; ขวด working inherit จากแม่ตอน withdraw; แก้ทีหลังผ่าน PATCH/EditUnitDialog. สคริปต์ backfill เติม source ให้ขวดเก่าที่ migrate แล้วแบบ in-place ตามลำดับ insertion.

**Tech Stack:** Node + Mongoose 8 (backend), React + TS + shadcn/ui (frontend), Vitest (frontend lib tests), `node:test` (backend lib tests)

---

## File Structure

- `server/lib/stockSource.js` *(สร้าง)* — pure helpers: `RECEIVE_SOURCES`, `isValidReceiveSource`, `tierSourceFor`, `assignSealedSources`. แหล่งความจริงเดียวของตรรกะ source.
- `server/lib/stockSource.test.js` *(สร้าง)* — node:test ของ helper ข้างบน.
- `server/models/StockUnit.js` *(แก้)* — เพิ่มฟิลด์ `source`.
- `server/routes/stock.js` *(แก้)* — receive validate+แปะ source, withdraw inherit, patch รับ source.
- `server/scripts/migrate-standard-tiers-to-units.js` *(แก้)* — แปะ source ตาม tier ตอน create.
- `server/scripts/backfill-stockunit-source.js` *(สร้าง)* — เติม source ให้ขวด migration เก่าแบบ in-place.
- `src/types/stock.ts` *(แก้)* — เพิ่ม `StockUnitSource` + field บน `StockUnitItem`.
- `src/lib/api.ts` *(แก้)* — เพิ่ม `source` ใน body ของ `receiveStockUnits` / `updateStockUnit`.
- `src/components/lis/stock/ReceiveBottlesDialog.tsx` *(แก้)* — ตัวเลือก primary/supply (บังคับ).
- `src/components/lis/stock/EditUnitDialog.tsx` *(แก้)* — field แก้ source.
- `src/components/lis/stock/StandardUnitsPanel.tsx` *(แก้)* — ป้าย source ในตารางรายขวด (drawer).

---

## Task 1: Pure source helpers + tests

**Files:**
- Create: `server/lib/stockSource.js`
- Test: `server/lib/stockSource.test.js`

- [ ] **Step 1: Write the failing test**

สร้าง `server/lib/stockSource.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const {
  RECEIVE_SOURCES,
  isValidReceiveSource,
  tierSourceFor,
  assignSealedSources,
} = require('./stockSource');

test('RECEIVE_SOURCES = primary, supply', () => {
  assert.deepStrictEqual(RECEIVE_SOURCES, ['primary', 'supply']);
});

test('isValidReceiveSource accepts only primary/supply', () => {
  assert.strictEqual(isValidReceiveSource('primary'), true);
  assert.strictEqual(isValidReceiveSource('supply'), true);
  assert.strictEqual(isValidReceiveSource(''), false);
  assert.strictEqual(isValidReceiveSource('supplier'), false);
  assert.strictEqual(isValidReceiveSource(undefined), false);
});

test('tierSourceFor maps tier name to source', () => {
  assert.strictEqual(tierSourceFor('primary'), 'primary');
  assert.strictEqual(tierSourceFor('supplier'), 'supply');
  assert.strictEqual(tierSourceFor('working'), '');
});

test('assignSealedSources: first primaryQty are primary, rest supply', () => {
  assert.deepStrictEqual(assignSealedSources(5, 2), ['primary', 'primary', 'supply', 'supply', 'supply']);
  assert.deepStrictEqual(assignSealedSources(3, 0), ['supply', 'supply', 'supply']);
  assert.deepStrictEqual(assignSealedSources(2, 9), ['primary', 'primary']); // qty เกินจำนวนขวด
  assert.deepStrictEqual(assignSealedSources(0, 3), []);
});

test('assignSealedSources floors/guards primaryQty', () => {
  assert.deepStrictEqual(assignSealedSources(3, 1.9), ['primary', 'supply', 'supply']);
  assert.deepStrictEqual(assignSealedSources(2, -5), ['supply', 'supply']);
  assert.deepStrictEqual(assignSealedSources(2, NaN), ['supply', 'supply']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test server/lib/stockSource.test.js`
Expected: FAIL — `Cannot find module './stockSource'`

- [ ] **Step 3: Write minimal implementation**

สร้าง `server/lib/stockSource.js`:

```js
'use strict';

// แหล่งความจริงเดียวของตรรกะ "ที่มาของขวด" (primary / supply)
// '' = ไม่ทราบ/ยังไม่ระบุ (เช่น ขวด working tier เก่าที่ migrate มาตรงๆ)

const RECEIVE_SOURCES = ['primary', 'supply'];

function isValidReceiveSource(v) {
  return RECEIVE_SOURCES.includes(v);
}

// map ชื่อ tier เดิม (StockStandard) → source ของขวด
function tierSourceFor(tierName) {
  if (tierName === 'primary') return 'primary';
  if (tierName === 'supplier') return 'supply';
  return ''; // working หรืออื่นๆ = ไม่ทราบ
}

// ขวด sealed ที่เรียงตามลำดับ insertion เดิม (primary ก่อน แล้ว supplier):
// ตัวแรก primaryQty ใบ → 'primary', ที่เหลือ → 'supply'
function assignSealedSources(sealedCount, primaryQty) {
  const p = Math.max(0, Math.floor(Number(primaryQty) || 0));
  return Array.from({ length: sealedCount }, (_, i) => (i < p ? 'primary' : 'supply'));
}

module.exports = { RECEIVE_SOURCES, isValidReceiveSource, tierSourceFor, assignSealedSources };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test server/lib/stockSource.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add server/lib/stockSource.js server/lib/stockSource.test.js
git commit -m "feat(stock): pure source helpers (primary/supply) + tests"
```

---

## Task 2: Add `source` field to model + frontend type

**Files:**
- Modify: `server/models/StockUnit.js`
- Modify: `src/types/stock.ts`

- [ ] **Step 1: Add field to Mongoose schema**

ใน `server/models/StockUnit.js` เพิ่มหลังบรรทัด `kind` (บรรทัด 18):

```js
  source: { type: String, enum: ['primary', 'supply', ''], default: '' },
```

- [ ] **Step 2: Add type to frontend**

ใน `src/types/stock.ts` หลังบรรทัด `export type StockUnitKind = ...` (บรรทัด 82) เพิ่ม:

```ts
export type StockUnitSource = "primary" | "supply" | "";
```

แล้วใน `interface StockUnitItem` เพิ่มหลัง `kind: StockUnitKind;` (บรรทัด 96):

```ts
  source?: StockUnitSource;
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่จากไฟล์ที่แก้ (อาจมี latent error เดิม ~12 รายการ — ไม่เกี่ยว)

- [ ] **Step 4: Commit**

```bash
git add server/models/StockUnit.js src/types/stock.ts
git commit -m "feat(stock): StockUnit.source field (primary/supply) + FE type"
```

---

## Task 3: Receive endpoint + dialog — เลือก primary/supply (บังคับ)

**Files:**
- Modify: `server/routes/stock.js:219-267`
- Modify: `src/lib/api.ts:207-214`
- Modify: `src/components/lis/stock/ReceiveBottlesDialog.tsx`

- [ ] **Step 1: Require + stamp source in receive route**

ใน `server/routes/stock.js` บนสุดของไฟล์ เพิ่ม require (ใกล้ require อื่นๆ ด้านบน):

```js
const { isValidReceiveSource } = require('../lib/stockSource');
```

ในเส้นทาง `POST '/standards/:id/units/receive'` แก้บรรทัด destructure (เดิมบรรทัด 225):

```js
    const { lotNo = '', sizeMl, unit = 'ml', bottles, source, note } = req.body || {};
```

เพิ่ม validate หลังบล็อกเช็ค `bottles` (หลังบรรทัด 228 เดิม):

```js
    if (!isValidReceiveSource(source)) return res.status(400).json({ error: 'ต้องเลือกที่มา (primary หรือ supply)' });
```

เพิ่ม `source` ลงใน `StockUnit.create({...})` (หลัง `kind: 'sealed',` บรรทัด 238 เดิม):

```js
        source,
```

- [ ] **Step 2: Add source to api.ts body type**

ใน `src/lib/api.ts` แก้ signature ของ `receiveStockUnits` (บรรทัด 207-209):

```ts
  receiveStockUnits: (
    standardId: string,
    body: { lotNo?: string; sizeMl: number; unit?: string; source: "primary" | "supply"; bottles: { exp?: string }[]; note?: string },
  ) =>
```

- [ ] **Step 3: Add primary/supply picker to ReceiveBottlesDialog**

ใน `src/components/lis/stock/ReceiveBottlesDialog.tsx`:

เพิ่ม state หลังบรรทัด `const [lotNo, setLotNo] = useState("");` (บรรทัด 21):

```tsx
  const [source, setSource] = useState<"primary" | "supply">("primary");
```

ส่ง `source` ลงใน `api.receiveStockUnits` (แก้ object ที่บรรทัด 62-64):

```tsx
      const created = await api.receiveStockUnits(standard._id, {
        lotNo, sizeMl: size, unit: "ml", source, bottles,
      });
```

เพิ่ม UI เลือก source — วางเป็น block แรกใน `<div className="space-y-3 py-4">` (ก่อน grid `Lot No` บรรทัด 85):

```tsx
            <div>
              <Label>ที่มา</Label>
              <div className="flex gap-2 mt-1">
                <Button type="button" variant={source === "primary" ? "default" : "outline"} size="sm"
                  onClick={() => setSource("primary")}>primary</Button>
                <Button type="button" variant={source === "supply" ? "default" : "outline"} size="sm"
                  onClick={() => setSource("supply")}>supply</Button>
              </div>
            </div>
```

- [ ] **Step 4: Manual verify**

เปิด dev (frontend + `cd server && npm run dev`) → tab Standards → เปิดขวดของสารหนึ่ง → กด "เพิ่มขวด (รับเข้า)" → เห็นปุ่ม primary/supply, เลือกได้, รับเข้า 1 ขวดสำเร็จ. ลองยิง API ตรงโดยไม่ส่ง source ควรได้ 400.

Run (สมมติมีสารหนึ่ง id ใน DB ที่ดึงจาก list): ตรวจผ่าน UI พอ — ไม่มี integration test runner สำหรับ route นี้.

- [ ] **Step 5: Commit**

```bash
git add server/routes/stock.js src/lib/api.ts src/components/lis/stock/ReceiveBottlesDialog.tsx
git commit -m "feat(stock): receive requires + stamps source (primary/supply)"
```

---

## Task 4: Withdraw — ขวด working inherit source จากแม่

**Files:**
- Modify: `server/routes/stock.js:300-312`

- [ ] **Step 1: Inherit parent source on working unit**

ใน `server/routes/stock.js` เส้นทาง withdraw, ใน `StockUnit.create({...})` ของขวด working (หลัง `kind: 'working',` บรรทัด 304 เดิม) เพิ่ม:

```js
      source: parent.source || '',
```

- [ ] **Step 2: Manual verify**

ใน UI: เลือกขวด sealed ที่ source='primary' → กดแบ่ง working → ขวด working ที่ได้ควรมี source='primary' (ตรวจผ่าน badge ที่จะเพิ่มใน Task 8 หรือผ่าน DB/`GET /units`).

- [ ] **Step 3: Commit**

```bash
git add server/routes/stock.js
git commit -m "feat(stock): withdrawn working bottle inherits parent source"
```

---

## Task 5: PATCH endpoint + EditUnitDialog — แก้ source ได้

**Files:**
- Modify: `server/routes/stock.js:366-385`
- Modify: `src/lib/api.ts:225-228`
- Modify: `src/components/lis/stock/EditUnitDialog.tsx`

- [ ] **Step 1: Accept source in PATCH route**

ใน `server/routes/stock.js` เส้นทาง `PATCH '/units/:qrId'`, แก้ destructure (เดิมบรรทัด 373):

```js
    const { lotNo, exp, volume, source } = req.body || {};
```

เพิ่มหลังบล็อกเซ็ต `lotNo`/`exp` (หลังบรรทัด 375 เดิม):

```js
    if (source !== undefined && ['primary', 'supply', ''].includes(source)) unit.source = source;
```

- [ ] **Step 2: Add source to api.ts updateStockUnit body**

ใน `src/lib/api.ts` แก้ signature `updateStockUnit` (บรรทัด 225-228):

```ts
  updateStockUnit: (
    qrId: string,
    body: { lotNo?: string; exp?: string | null; source?: "primary" | "supply" | ""; volume?: { initial?: number; remaining?: number; unit?: string } },
  ) =>
```

- [ ] **Step 3: Add source select to EditUnitDialog**

ใน `src/components/lis/stock/EditUnitDialog.tsx`:

เพิ่ม state หลัง `const [lotNo, ...]` (บรรทัด 27):

```tsx
  const [source, setSource] = useState<"primary" | "supply" | "">(unit.source ?? "");
```

ส่ง `source` ใน `api.updateStockUnit` (แก้ object บรรทัด 42-46):

```tsx
      await api.updateStockUnit(unit.qrId, {
        lotNo,
        exp: exp || null,
        source,
        volume: { initial: init, remaining: rem },
      });
```

เพิ่ม UI หลัง field `Lot No` (หลัง `</div>` ปิด block Lot No บรรทัด 69):

```tsx
            <div>
              <Label>ที่มา</Label>
              <div className="flex gap-2 mt-1">
                <Button type="button" variant={source === "primary" ? "default" : "outline"} size="sm"
                  onClick={() => setSource("primary")}>primary</Button>
                <Button type="button" variant={source === "supply" ? "default" : "outline"} size="sm"
                  onClick={() => setSource("supply")}>supply</Button>
                <Button type="button" variant={source === "" ? "default" : "outline"} size="sm"
                  onClick={() => setSource("")}>ไม่ระบุ</Button>
              </div>
            </div>
```

เพิ่ม import `Button` ถ้ายังไม่มี — ไฟล์นี้ import `Button` อยู่แล้ว (บรรทัด 6) ไม่ต้องเพิ่ม.

- [ ] **Step 4: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่

- [ ] **Step 5: Manual verify**

ใน UI: กดแก้ไขขวด working เก่า (source ว่าง) → เลือก primary → บันทึก → เปิดใหม่ source คงเป็น primary.

- [ ] **Step 6: Commit**

```bash
git add server/routes/stock.js src/lib/api.ts src/components/lis/stock/EditUnitDialog.tsx
git commit -m "feat(stock): edit unit source via PATCH + EditUnitDialog"
```

---

## Task 6: อัปเดต migration script ให้แปะ source

**Files:**
- Modify: `server/scripts/migrate-standard-tiers-to-units.js`

- [ ] **Step 1: Use tierSourceFor when building bottles**

ใน `server/scripts/migrate-standard-tiers-to-units.js`:

เพิ่ม require ใต้ require เดิม (หลังบรรทัด 21):

```js
const { tierSourceFor } = require('../lib/stockSource');
```

แก้ฟังก์ชัน `tierBottles` (บรรทัด 41-54) ให้แนบ source:

```js
function tierBottles(std) {
  const out = [];
  const push = (tier, kind, tierName) => {
    if (!tier) return;
    const count = Math.max(0, Math.floor(Number(tier.qty) || 0));
    const size = Number(tier.sizeMg) || 0;
    const exp = parseExp(tier.exp);
    const source = tierSourceFor(tierName);
    for (let i = 0; i < count; i++) out.push({ kind, size, exp, source });
  };
  push(std.primary, 'sealed', 'primary');
  push(std.supplier, 'sealed', 'supplier');
  push(std.working, 'working', 'working');
  return out;
}
```

แก้ `StockUnit.create({...})` (บรรทัด 84-95) เพิ่ม `source: b.source,` หลัง `kind: b.kind,`:

```js
        await StockUnit.create({
          qrId,
          itemCode: std.code,
          itemName: std.name,
          kind: b.kind,
          source: b.source,
          lotNo: '',
          exp: b.exp,
          volume: { initial: b.size, remaining: b.size, unit: 'mg' },
          status: 'active',
          receivedDate: now,
          createdBy,
        });
```

- [ ] **Step 2: Dry-run sanity (ต้อง idempotent — ข้ามสารที่มีขวดแล้ว)**

Run: `cd server && node scripts/migrate-standard-tiers-to-units.js`
Expected: รายงาน "ข้าม (มีขวดอยู่แล้ว): N" สำหรับสารที่ migrate ไปแล้ว — ไม่สร้างซ้ำ (DB ปัจจุบันมี 218 ขวดอยู่แล้ว จึงควรข้ามเกือบหมด). ไม่ต้อง `--commit`.

- [ ] **Step 3: Commit**

```bash
git add server/scripts/migrate-standard-tiers-to-units.js
git commit -m "feat(stock): migration tags unit source per tier"
```

---

## Task 7: สคริปต์ backfill source ให้ขวดเก่าที่ migrate แล้ว

**Files:**
- Create: `server/scripts/backfill-stockunit-source.js`

- [ ] **Step 1: Write the backfill script**

สร้าง `server/scripts/backfill-stockunit-source.js`:

```js
// เติม source (primary/supply) ให้ขวด sealed ที่ migrate มาก่อนมีฟิลด์ source
// (createdBy.email='migration', source ว่าง) แบบ in-place ตามลำดับ insertion เดิม:
// migration loop สร้าง primary ก่อน แล้ว supplier → เรียงตาม _id แล้วตัวแรก
// primary.qty ใบ = 'primary', ที่เหลือ = 'supply'. ขวด working migration ปล่อยว่าง.
//
// Idempotent: แตะเฉพาะขวด createdBy.email='migration' & kind='sealed' & source ว่าง.
//
// Usage:
//   node scripts/backfill-stockunit-source.js          # dry-run
//   node scripts/backfill-stockunit-source.js --commit  # เขียนจริง
'use strict';

const mongoose = require('mongoose');
const { StockStandard } = require('../models/Stock');
const StockUnit = require('../models/StockUnit');
const { assignSealedSources } = require('../lib/stockSource');

const COMMIT = process.argv.includes('--commit');
const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/LIS-DB';

async function main() {
  await mongoose.connect(URI);
  const stds = await StockStandard.find().lean();

  let stdsTouched = 0;
  let bottlesPrimary = 0;
  let bottlesSupply = 0;

  for (const std of stds) {
    // ขวด sealed จาก migration ที่ source ยังว่าง เรียงตามลำดับสร้าง (primary→supplier)
    const sealed = await StockUnit.find({
      itemCode: std.code,
      kind: 'sealed',
      'createdBy.email': 'migration',
      $or: [{ source: '' }, { source: { $exists: false } }],
    }).sort({ _id: 1 });

    if (sealed.length === 0) continue;

    const sources = assignSealedSources(sealed.length, std.primary && std.primary.qty);
    stdsTouched += 1;
    const p = sources.filter((s) => s === 'primary').length;
    bottlesPrimary += p;
    bottlesSupply += sources.length - p;
    console.log(`  ${std.code} ${std.name} → primary ${p}, supply ${sources.length - p}`);

    if (COMMIT) {
      for (let i = 0; i < sealed.length; i++) {
        sealed[i].source = sources[i];
        await sealed[i].save();
      }
    }
  }

  console.log(`\nสารที่แตะ: ${stdsTouched} | ขวด primary: ${bottlesPrimary} | ขวด supply: ${bottlesSupply}`);
  if (!COMMIT) {
    console.log('DRY-RUN — ยังไม่เขียน. รันซ้ำด้วย --commit เพื่อเขียนจริง');
  } else {
    console.log('เขียนเรียบร้อย. รัน `npm run seed:export` เพื่อ backup ลง git');
  }
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Dry-run และอ่านผลให้สมเหตุสมผล**

Run: `cd server && node scripts/backfill-stockunit-source.js`
Expected: ลิสต์สารพร้อมจำนวน primary/supply ต่อสาร; ยอดรวม `ขวด primary + ขวด supply` ต่อสาร ควรเท่ากับจำนวนขวด sealed ของ migration เดิม. ไม่เขียน DB.

ตรวจ spot-check 1 สารกับ tier เดิม: `primary` count ที่รายงาน ควร = `floor(std.primary.qty)` (เทียบกับข้อมูลใน tab Standards / DB).

- [ ] **Step 3: Commit จริง (เขียน DB) + backup**

```bash
cd server && node scripts/backfill-stockunit-source.js --commit && npm run seed:export
```
Expected: "เขียนเรียบร้อย"; `seed-data/*.json` อัปเดต.

- [ ] **Step 4: รันซ้ำ ตรวจ idempotent**

Run: `cd server && node scripts/backfill-stockunit-source.js`
Expected: "สารที่แตะ: 0" (ทุกขวดมี source แล้ว → ไม่เข้าเงื่อนไข source ว่าง).

- [ ] **Step 5: Commit**

```bash
git add server/scripts/backfill-stockunit-source.js server/seed-data
git commit -m "feat(stock): backfill source for migrated bottles + reseed"
```

---

## Task 8: แสดงป้าย source ในตารางรายขวด (drawer)

**Files:**
- Modify: `src/components/lis/stock/StandardUnitsPanel.tsx`

- [ ] **Step 1: เพิ่มคอลัมน์ "ที่มา" ในตาราง**

ใน `src/components/lis/stock/StandardUnitsPanel.tsx`:

ใน `<TableHeader>` เพิ่ม `<TableHead>` หลังคอลัมน์ "ชนิด" (หลังบรรทัด 70 `<TableHead>ชนิด</TableHead>`):

```tsx
              <TableHead>ที่มา</TableHead>
```

ใน body แถวข้อมูล เพิ่ม cell หลัง cell ชนิด (หลังบรรทัด 90):

```tsx
                  <TableCell className="text-xs">
                    {u.source === "primary" ? "primary" : u.source === "supply" ? "supply" : "-"}
                  </TableCell>
```

แก้ `colSpan` ของแถว loading/empty จาก `7` เป็น `8` (บรรทัด 80 และ 82):

```tsx
              <TableRow><TableCell colSpan={8} className="text-center py-6">กำลังโหลด...</TableCell></TableRow>
```
```tsx
              <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">ยังไม่มีขวด — กดเพิ่มขวด</TableCell></TableRow>
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่

- [ ] **Step 3: Manual verify**

ใน UI drawer รายขวด: เห็นคอลัมน์ "ที่มา" แสดง primary/supply/-; ตาราง Standards หลัก (Stock.tsx) **ไม่** มี source.

- [ ] **Step 4: Commit**

```bash
git add src/components/lis/stock/StandardUnitsPanel.tsx
git commit -m "feat(stock): show source column in per-bottle drawer"
```

---

## Final verification

- [ ] Run `npx vitest run` → frontend lib tests ผ่านเท่าเดิม (ไม่ได้แตะ lib ที่มีเทสต์)
- [ ] Run `node --test server/lib/stockSource.test.js` → ผ่าน
- [ ] Run `npx tsc -p tsconfig.app.json --noEmit` → ไม่มี error ใหม่
- [ ] ยืนยันใน UI: รับเข้าใหม่บังคับเลือก source; working inherit; แก้ source ได้; drawer โชว์ source; ตารางหลักไม่โชว์
