# เบิก Standard บนหน้า "เบิก stock" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มการเบิก Standard (สร้าง/ใช้ซ้ำ working, คุมความถี่, แจ้งประสิทธิภาพลดลง) เข้าไปในแท็บ "เบิก stock" ด้วยปุ่มเดียว chooser (สารเคมี/Standard) โดยต่อยอดกลไก `StockUnit`/withdraw/discard เดิม

**Architecture:** ฝั่ง backend เพิ่มฟิลด์ `frequencyDue` บน `StockUnit` และแยกการคำนวณอายุ working เป็น 2 ค่า (`exp` = หมดอายุจริง, `frequencyDue` = ครบกำหนดความถี่) ผ่าน pure lib ใหม่ + ขยาย discard route ให้ทิ้งแบบ cascade (ทั้งขวด). ฝั่ง frontend เพิ่ม helper `workingUsability`/`computeWorkingLifecycle` (mirror), dialog เบิก standard, dialog แจ้งประสิทธิภาพลดลง, และแท็บ chooser ที่รวมสารเคมี+standard.

**Tech Stack:** Express 4 + Mongoose 8 (BE, ทดสอบด้วย `node:test`) / React 18 + TS + Vite + TanStack Query + shadcn/ui (FE, ทดสอบด้วย Vitest) / date-fns

## Global Constraints

- **ไม่สร้าง model/endpoint ใหม่** สำหรับ standard requisition — ใช้ `StockUnit` + `POST /units/:qrId/withdraw` + `POST /units/:qrId/discard` เดิม (แนวทาง A)
- **reuse working เดิมไม่ log** — บันทึกเฉพาะตอน "แบ่งใหม่" (ผ่าน log `withdraw` ที่มีอยู่)
- **ไม่ backfill** `frequencyDue` ให้ working เก่า — working เก่าคุมด้วย `exp` อย่างเดียว
- **ไม่แตะฝั่งสารเคมี (solvent)** ในเชิงพฤติกรรม — `ChemicalRequisitionDialog`/query/endpoint เดิมทำงานเหมือนเดิม (non-regression)
- **ไม่แตะ** `DiscardDialog.tsx`, `StockUnitScanPage.tsx`, `Stock.tsx` (นอกจาก type ของ `api.discardStockUnit` ที่ต้อง backward-compatible)
- **BE test**: `node --test <file>` (มิเรอร์ pattern ของ `server/lib/chemicalRequisition.test.js` ที่ใช้ `node:test`+`node:assert`)
- **FE type-check**: `npx tsc -p tsconfig.app.json --noEmit` (root `tsc --noEmit` เป็น no-op)
- **git**: commit เฉพาะไฟล์ตัวเองด้วย explicit pathspec (มี process อื่น commit แทรกในรีโปได้)
- Path `/stock-deduction` คงเดิม, ไม่เพิ่ม permission path ใหม่

## File Structure

**สร้างใหม่:**
- `server/lib/workingLifecycle.js` — pure: `parseFrequencyInterval`, `addInterval`, `computeWorkingLifecycle`
- `server/lib/workingLifecycle.test.js` — node:test
- `server/lib/stockUnitDiscard.js` — pure: `resolveCascadeRootId`, `selectDiscardTargets`
- `server/lib/stockUnitDiscard.test.js` — node:test
- `src/components/lis/stock/PerformanceDropDialog.tsx` — dialog แจ้งประสิทธิภาพลดลง (scope working/ทั้งขวด)
- `src/components/lis/stock/StandardRequisitionDialog.tsx` — dialog เบิก standard
- `src/components/lis/StockRequisitionTab.tsx` — chooser + 2 การ์ดรายการวันนี้

**แก้ไข:**
- `server/models/StockUnit.js` — เพิ่ม `frequencyDue`
- `server/routes/stock.js` — ใช้ `computeWorkingLifecycle` ใน withdraw + createWorkingFromParent; ขยาย discard route ให้รับ `cascade`
- `src/types/stock.ts` — `StockUnitItem.frequencyDue`
- `src/lib/stockUnit.ts` — เพิ่ม `computeWorkingLifecycle`, `workingUsability`, `pickFefoSealed`
- `src/lib/stockUnit.test.ts` — เพิ่ม test 3 helper ใหม่
- `src/lib/api.ts` — `discardStockUnit` body รับ `cascade`, return type ใหม่
- `src/components/lis/ChemicalRequisitionPanel.tsx` — ถอดปุ่ม/ dialog เบิก (เหลือ list-only)
- `src/pages/StockDeduction.tsx` — แท็บ requisition render `StockRequisitionTab`

---

## Task 1: BE pure lib — คำนวณอายุ working แยก 2 ค่า

**Files:**
- Create: `server/lib/workingLifecycle.js`
- Test: `server/lib/workingLifecycle.test.js`

**Interfaces:**
- Produces:
  - `parseFrequencyInterval(str) → { count: number, unit: 'day'|'week'|'month' } | null`
  - `addInterval(from: Date, count: number, unit: string) → Date`
  - `computeWorkingLifecycle({ withdrawnAt: Date, frequency?: string, shelf: {value,unit}, parentExp?: Date|string|null }) → { exp: Date|null, frequencyDue: Date|null }`

- [ ] **Step 1: เขียน test ที่ต้อง fail**

สร้าง `server/lib/workingLifecycle.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { parseFrequencyInterval, addInterval, computeWorkingLifecycle } = require('./workingLifecycle');

test('parseFrequencyInterval reads denominator + unit', () => {
  assert.deepStrictEqual(parseFrequencyInterval('1/1 week'), { count: 1, unit: 'week' });
  assert.deepStrictEqual(parseFrequencyInterval('1/2 month'), { count: 2, unit: 'month' });
  assert.deepStrictEqual(parseFrequencyInterval('1/3 days'), { count: 3, unit: 'day' });
  assert.strictEqual(parseFrequencyInterval(''), null);
  assert.strictEqual(parseFrequencyInterval(null), null);
  assert.strictEqual(parseFrequencyInterval('weekly'), null);
});

test('addInterval adds day/week/month', () => {
  assert.deepStrictEqual(addInterval(new Date('2026-01-01'), 7, 'day'), new Date('2026-01-08'));
  assert.deepStrictEqual(addInterval(new Date('2026-01-01'), 2, 'week'), new Date('2026-01-15'));
  assert.deepStrictEqual(addInterval(new Date('2026-01-15'), 1, 'month'), new Date('2026-02-15'));
});

test('computeWorkingLifecycle: shelf + frequency, both under parent', () => {
  const { exp, frequencyDue } = computeWorkingLifecycle({
    withdrawnAt: new Date('2026-01-01'),
    frequency: '1/1 week',
    shelf: { value: 30, unit: 'day' },
    parentExp: new Date('2026-12-31'),
  });
  assert.deepStrictEqual(exp, new Date('2026-01-31'));        // +30 day
  assert.deepStrictEqual(frequencyDue, new Date('2026-01-08')); // +1 week
});

test('computeWorkingLifecycle: no frequency → frequencyDue null', () => {
  const { frequencyDue } = computeWorkingLifecycle({
    withdrawnAt: new Date('2026-01-01'), frequency: '', shelf: { value: 30, unit: 'day' }, parentExp: null,
  });
  assert.strictEqual(frequencyDue, null);
});

test('computeWorkingLifecycle: shelf 0 → exp = parentExp', () => {
  const { exp } = computeWorkingLifecycle({
    withdrawnAt: new Date('2026-01-01'), frequency: '1/1 week', shelf: { value: 0, unit: 'day' }, parentExp: new Date('2026-06-30'),
  });
  assert.deepStrictEqual(exp, new Date('2026-06-30'));
});

test('computeWorkingLifecycle: caps both at parentExp', () => {
  const { exp, frequencyDue } = computeWorkingLifecycle({
    withdrawnAt: new Date('2026-01-01'), frequency: '1/6 month', shelf: { value: 300, unit: 'day' }, parentExp: new Date('2026-02-01'),
  });
  assert.deepStrictEqual(exp, new Date('2026-02-01'));
  assert.deepStrictEqual(frequencyDue, new Date('2026-02-01'));
});
```

- [ ] **Step 2: รัน test ให้เห็นว่า fail**

Run: `node --test server/lib/workingLifecycle.test.js`
Expected: FAIL — `Cannot find module './workingLifecycle'`

- [ ] **Step 3: เขียน implementation**

สร้าง `server/lib/workingLifecycle.js`:

```js
// อายุ working ของ standard แยก 2 ค่า:
//  - exp (หมดอายุจริง)  = วันแบ่ง + openShelfLife ; shelf value<=0 → parentExp
//  - frequencyDue (ครบกำหนดความถี่) = วันแบ่ง + ช่วง frequency ; ไม่มี/parse ไม่ได้ → null
//  ทั้งคู่ cap ที่ EXP ขวดแม่. mirror ของ src/lib/stockUnit.ts (computeWorkingLifecycle)

const FREQ_RE = /^\s*\d+\s*\/\s*(\d+)\s*(day|week|month)s?\s*$/i;

function parseFrequencyInterval(str) {
  const m = FREQ_RE.exec(String(str == null ? '' : str));
  if (!m) return null;
  const count = Number(m[1]);
  if (!Number.isFinite(count) || count < 1) return null;
  return { count, unit: m[2].toLowerCase() };
}

function addInterval(from, count, unit) {
  const v = Math.max(0, Math.floor(Number(count) || 0));
  const d = new Date(from);
  if (unit === 'week') d.setDate(d.getDate() + v * 7);
  else if (unit === 'month') d.setMonth(d.getMonth() + v);
  else d.setDate(d.getDate() + v);
  return d;
}

function capAtParent(date, parentExp) {
  if (!date) return date;
  if (parentExp && date.getTime() > new Date(parentExp).getTime()) return new Date(parentExp);
  return date;
}

function computeWorkingLifecycle({ withdrawnAt, frequency, shelf, parentExp }) {
  const parent = parentExp ? new Date(parentExp) : null;
  const shelfVal = Math.max(0, Math.floor(Number(shelf && shelf.value) || 0));
  const exp = shelfVal <= 0
    ? parent
    : capAtParent(addInterval(withdrawnAt, shelfVal, (shelf && shelf.unit) || 'day'), parent);
  const fi = parseFrequencyInterval(frequency);
  const frequencyDue = fi ? capAtParent(addInterval(withdrawnAt, fi.count, fi.unit), parent) : null;
  return { exp, frequencyDue };
}

module.exports = { parseFrequencyInterval, addInterval, computeWorkingLifecycle };
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `node --test server/lib/workingLifecycle.test.js`
Expected: PASS ทุก test

- [ ] **Step 5: Commit**

```bash
git add server/lib/workingLifecycle.js server/lib/workingLifecycle.test.js
git commit -m "feat(stock): pure lib คำนวณอายุ working แยก exp/frequencyDue

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- server/lib/workingLifecycle.js server/lib/workingLifecycle.test.js
```

---

## Task 2: BE wiring — เก็บ frequencyDue ตอนแบ่ง working

**Files:**
- Modify: `server/models/StockUnit.js` (เพิ่มฟิลด์)
- Modify: `server/routes/stock.js` (require lib + 2 call sites + ลบ inline ที่ตาย)

**Interfaces:**
- Consumes: `computeWorkingLifecycle` (Task 1)
- Produces: working ที่สร้างจาก `POST /units/:qrId/withdraw` มีฟิลด์ `frequencyDue: Date|null`

- [ ] **Step 1: เพิ่มฟิลด์ใน model**

ใน `server/models/StockUnit.js` เพิ่มบรรทัดถัดจาก `exp` (บรรทัด 22):

```js
  exp: { type: Date, default: null },
  frequencyDue: { type: Date, default: null },
```

- [ ] **Step 2: require lib + แทนที่ call site ใน withdraw route**

บนหัวไฟล์ `server/routes/stock.js` ถัดจาก require เดิม (บรรทัด 7) เพิ่ม:

```js
const { computeWorkingLifecycle } = require('../lib/workingLifecycle');
```

ใน `POST /units/:qrId/withdraw` แทนบล็อก (บรรทัด ~414-417):

```js
    const std = await StockStandard.findOne({ code: parent.itemCode });
    const shelf = (std && std.openShelfLife) || { value: 0, unit: 'day' };
    const now = new Date();
    const exp = workingExpForWithdraw(now, std && std.frequency, shelf, parent.exp || null);
```

ด้วย:

```js
    const std = await StockStandard.findOne({ code: parent.itemCode });
    const shelf = (std && std.openShelfLife) || { value: 0, unit: 'day' };
    const now = new Date();
    const { exp, frequencyDue } = computeWorkingLifecycle({
      withdrawnAt: now, frequency: std && std.frequency, shelf, parentExp: parent.exp || null,
    });
```

แล้วใน `StockUnit.create({...})` ของ working (บรรทัด ~420-433) เพิ่ม `frequencyDue,` ถัดจาก `exp,`:

```js
      lotNo: parent.lotNo,
      exp,
      frequencyDue,
      volume: { initial: ml, remaining: ml, unit: parent.volume.unit },
```

- [ ] **Step 3: แทนที่ call site ใน createWorkingFromParent (ให้สม่ำเสมอ)**

ใน `createWorkingFromParent` (บรรทัด ~127-145) แทน:

```js
  const std = await StockStandard.findOne({ code: parentUnit.itemCode });
  const shelf = (std && std.openShelfLife) || { value: 0, unit: 'day' };
  const now = new Date();
  const exp = workingExpForWithdraw(now, std && std.frequency, shelf, parentUnit.exp || null);
```

ด้วย:

```js
  const std = await StockStandard.findOne({ code: parentUnit.itemCode });
  const shelf = (std && std.openShelfLife) || { value: 0, unit: 'day' };
  const now = new Date();
  const { exp, frequencyDue } = computeWorkingLifecycle({
    withdrawnAt: now, frequency: std && std.frequency, shelf, parentExp: parentUnit.exp || null,
  });
```

แล้วเพิ่ม `frequencyDue,` ถัดจาก `exp,` ใน `StockUnit.create({...})` (บรรทัด ~140):

```js
    lotNo: parentUnit.lotNo,
    exp,
    frequencyDue,
    volume: { initial: 0, remaining: 0, unit: 'mg' },
```

- [ ] **Step 4: ลบ inline helper ที่ตายแล้ว (หลังยืนยันไม่มีที่อื่นใช้)**

Run: `grep -n "workingExpForWithdraw\|computeWorkingExp\|nextMidnight\|addShelfLife" server/routes/stock.js`
Expected: เจอเฉพาะที่ definition (บรรทัด 18-46) — ไม่มี call site เหลือ (ทั้ง 2 ถูกแทนแล้ว)

ลบฟังก์ชัน `addShelfLife`, `computeWorkingExp`, `nextMidnight`, `workingExpForWithdraw` (บรรทัด 18-46) ออกทั้งบล็อก (comment "mirror ของ addShelfLife..." ด้วย)

> ถ้า grep เจอ call site อื่นนอกเหนือจาก 2 จุดข้างบน — **อย่าลบ** ตัวที่ยังถูกใช้; แจ้ง reviewer.

- [ ] **Step 5: type-check ฝั่ง server รันได้ (smoke)**

Run: `cd server && node -e "require('./routes/stock'); console.log('ok')"`
Expected: พิมพ์ `ok` (ไฟล์ require ได้ ไม่มี syntax/reference error)

- [ ] **Step 6: Commit**

```bash
git add server/models/StockUnit.js server/routes/stock.js
git commit -m "feat(stock): เก็บ frequencyDue ตอนแบ่ง working + ใช้ computeWorkingLifecycle

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- server/models/StockUnit.js server/routes/stock.js
```

---

## Task 3: BE cascade discard — ทิ้งทั้งขวด

**Files:**
- Create: `server/lib/stockUnitDiscard.js`
- Test: `server/lib/stockUnitDiscard.test.js`
- Modify: `server/routes/stock.js` (discard route)

**Interfaces:**
- Produces:
  - `resolveCascadeRootId(unit) → ObjectId|string` (parentId ถ้าเป็น working+มี parent, ไม่งั้น _id)
  - `selectDiscardTargets({ root, children }) → StockUnit[]` (root + children ที่ status !== 'discarded')
  - `POST /units/:qrId/discard { reason?, cascade? }` → `{ discarded: string[], count: number }`

- [ ] **Step 1: เขียน test ที่ต้อง fail**

สร้าง `server/lib/stockUnitDiscard.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { resolveCascadeRootId, selectDiscardTargets } = require('./stockUnitDiscard');

test('resolveCascadeRootId: working → parentId', () => {
  assert.strictEqual(resolveCascadeRootId({ _id: 'w1', kind: 'working', parentId: 'p1' }), 'p1');
});
test('resolveCascadeRootId: sealed → own _id', () => {
  assert.strictEqual(resolveCascadeRootId({ _id: 's1', kind: 'sealed', parentId: null }), 's1');
});
test('resolveCascadeRootId: working ไม่มี parent → own _id', () => {
  assert.strictEqual(resolveCascadeRootId({ _id: 'w9', kind: 'working', parentId: null }), 'w9');
});

test('selectDiscardTargets: root + children ที่ยังไม่ทิ้ง', () => {
  const root = { _id: 'p1', status: 'active', qrId: 'a' };
  const children = [
    { _id: 'w1', status: 'active', qrId: 'b' },
    { _id: 'w2', status: 'discarded', qrId: 'c' },
    { _id: 'w3', status: 'empty', qrId: 'd' },
  ];
  const out = selectDiscardTargets({ root, children });
  assert.deepStrictEqual(out.map((u) => u.qrId), ['a', 'b', 'd']); // ตัด discarded ออก
});

test('selectDiscardTargets: root null (ถูกทิ้งไปแล้ว) → เฉพาะ children', () => {
  const out = selectDiscardTargets({ root: { _id: 'p', status: 'discarded', qrId: 'x' }, children: [{ _id: 'w', status: 'active', qrId: 'y' }] });
  assert.deepStrictEqual(out.map((u) => u.qrId), ['y']);
});
```

- [ ] **Step 2: รัน test ให้ fail**

Run: `node --test server/lib/stockUnitDiscard.test.js`
Expected: FAIL — `Cannot find module './stockUnitDiscard'`

- [ ] **Step 3: เขียน implementation**

สร้าง `server/lib/stockUnitDiscard.js`:

```js
// helper สำหรับทิ้งขวดแบบ cascade (ทั้งขวด = ขวดแม่ + working ลูกทุกตัว)
function resolveCascadeRootId(unit) {
  return unit.kind === 'working' && unit.parentId ? unit.parentId : unit._id;
}

// คืน root + children ที่ยังไม่ถูกทิ้ง (idempotent: ข้ามตัว status 'discarded')
function selectDiscardTargets({ root, children }) {
  return [root, ...(children || [])].filter(Boolean).filter((u) => u.status !== 'discarded');
}

module.exports = { resolveCascadeRootId, selectDiscardTargets };
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `node --test server/lib/stockUnitDiscard.test.js`
Expected: PASS

- [ ] **Step 5: ขยาย discard route**

ใน `server/routes/stock.js` หัวไฟล์เพิ่ม require:

```js
const { resolveCascadeRootId, selectDiscardTargets } = require('../lib/stockUnitDiscard');
```

แทน handler `POST /units/:qrId/discard` ทั้งก้อน (บรรทัด ~457-485) ด้วย:

```js
// ทิ้งขวด: POST /units/:qrId/discard { reason?, cascade? }
// cascade=true → ทิ้งทั้งขวด (ขวดแม่ + working ลูกทุกตัวที่ยังไม่ถูกทิ้ง)
router.post('/units/:qrId/discard', async (req, res) => {
  try {
    const unit = await StockUnit.findOne({ qrId: req.params.qrId });
    if (!unit) return res.status(404).json({ error: 'ไม่พบขวด' });
    const cascade = !!(req.body && req.body.cascade);
    const reason = (req.body && req.body.reason) || '';

    let targets;
    if (cascade) {
      const rootId = resolveCascadeRootId(unit);
      const root = await StockUnit.findById(rootId);
      const children = await StockUnit.find({ parentId: rootId });
      targets = selectDiscardTargets({ root, children });
    } else {
      if (unit.status === 'discarded') return res.status(400).json({ error: 'ขวดนี้ถูกทิ้งแล้ว' });
      targets = [unit];
    }

    const discarded = [];
    for (const t of targets) {
      t.status = 'discarded';
      t.discardedAt = new Date();
      t.discardedBy = personOf(req);
      t.discardReason = reason;
      await t.save();
      const std = await StockStandard.findOne({ code: t.itemCode });
      await logTransaction({
        itemType: 'standard',
        itemId: std ? std._id.toString() : t.itemCode,
        itemCode: t.itemCode,
        itemName: t.itemName,
        action: 'discard',
        unitId: t._id.toString(),
        qrId: t.qrId,
        note: reason,
        ...userMeta(req),
      });
      discarded.push(t.qrId);
    }
    res.json({ discarded, count: discarded.length });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
```

- [ ] **Step 6: smoke require**

Run: `cd server && node -e "require('./routes/stock'); console.log('ok')"`
Expected: `ok`

- [ ] **Step 7: Commit**

```bash
git add server/lib/stockUnitDiscard.js server/lib/stockUnitDiscard.test.js server/routes/stock.js
git commit -m "feat(stock): ทิ้งขวดแบบ cascade (ทั้งขวด) ผ่าน discard route flag

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- server/lib/stockUnitDiscard.js server/lib/stockUnitDiscard.test.js server/routes/stock.js
```

---

## Task 4: FE lib + types — mirror lifecycle + workingUsability + FEFO

**Files:**
- Modify: `src/types/stock.ts` (เพิ่ม `frequencyDue`)
- Modify: `src/lib/stockUnit.ts` (เพิ่ม 3 helper)
- Modify: `src/lib/stockUnit.test.ts` (เพิ่ม test)
- Modify: `src/lib/api.ts` (`discardStockUnit` รับ `cascade`)

**Interfaces:**
- Produces:
  - `computeWorkingLifecycle({ withdrawnAt: Date, frequency?: string|null, shelf: OpenShelfLife, parentExp: Date|null }) → { exp: Date|null, frequencyDue: Date|null }`
  - `type WorkingUsability = "active"|"freqDue"|"expired"|"empty"|"discarded"`
  - `workingUsability(u: { status: string; exp?: string|null; frequencyDue?: string|null }, now?: Date) → WorkingUsability`
  - `pickFefoSealed(units: StockUnitItem[], now?: Date) → StockUnitItem | null`
  - `api.discardStockUnit(qrId, { reason?, cascade? }) → { discarded: string[]; count: number }`

- [ ] **Step 1: เพิ่มฟิลด์ใน type**

ใน `src/types/stock.ts` `StockUnitItem` เพิ่มถัดจาก `exp?` (บรรทัด 101):

```ts
  exp?: string | null;
  frequencyDue?: string | null;
```

- [ ] **Step 2: เขียน test ที่ต้อง fail** (`src/lib/stockUnit.test.ts`)

เพิ่ม import ที่บล็อก import (บรรทัด 2-11):

```ts
import {
  addShelfLife,
  computeWorkingExp,
  nextMidnight,
  workingExpForWithdraw,
  parseScannedQrId,
  unitDerivedStatus,
  summarizeUnits,
  buildUnitTree,
  computeWorkingLifecycle,
  workingUsability,
  pickFefoSealed,
} from "./stockUnit";
```

เพิ่ม describe block ท้ายไฟล์:

```ts
describe("computeWorkingLifecycle", () => {
  it("exp = withdraw + shelf, frequencyDue = withdraw + frequency", () => {
    const r = computeWorkingLifecycle({
      withdrawnAt: new Date("2026-01-01"), frequency: "1/1 week",
      shelf: { value: 30, unit: "day" }, parentExp: new Date("2026-12-31"),
    });
    expect(r.exp).toEqual(new Date("2026-01-31"));
    expect(r.frequencyDue).toEqual(new Date("2026-01-08"));
  });
  it("no frequency → frequencyDue null", () => {
    const r = computeWorkingLifecycle({
      withdrawnAt: new Date("2026-01-01"), frequency: "", shelf: { value: 30, unit: "day" }, parentExp: null,
    });
    expect(r.frequencyDue).toBeNull();
  });
  it("shelf 0 → exp = parentExp", () => {
    const r = computeWorkingLifecycle({
      withdrawnAt: new Date("2026-01-01"), frequency: "1/1 week", shelf: { value: 0, unit: "day" }, parentExp: new Date("2026-06-30"),
    });
    expect(r.exp).toEqual(new Date("2026-06-30"));
  });
});

describe("workingUsability", () => {
  const now = new Date("2026-06-15");
  it("active when before both", () => {
    expect(workingUsability({ status: "active", exp: "2026-07-01", frequencyDue: "2026-06-20" }, now)).toBe("active");
  });
  it("freqDue when past frequencyDue but before exp", () => {
    expect(workingUsability({ status: "active", exp: "2026-07-01", frequencyDue: "2026-06-10" }, now)).toBe("freqDue");
  });
  it("expired takes priority over freqDue", () => {
    expect(workingUsability({ status: "active", exp: "2026-06-01", frequencyDue: "2026-06-10" }, now)).toBe("expired");
  });
  it("no frequencyDue → governed by exp only", () => {
    expect(workingUsability({ status: "active", exp: "2026-07-01", frequencyDue: null }, now)).toBe("active");
  });
  it("discarded/empty short-circuit", () => {
    expect(workingUsability({ status: "discarded" }, now)).toBe("discarded");
    expect(workingUsability({ status: "empty" }, now)).toBe("empty");
  });
});

describe("pickFefoSealed", () => {
  it("picks earliest-exp active sealed, ignores working/expired/discarded", () => {
    const units = [
      mk({ _id: "s1", kind: "sealed", exp: "2026-12-31" }),
      mk({ _id: "s2", kind: "sealed", exp: "2026-03-01" }),
      mk({ _id: "w1", kind: "working", exp: "2026-01-01" }),
      mk({ _id: "s3", kind: "sealed", status: "discarded", exp: "2026-02-01" }),
    ];
    expect(pickFefoSealed(units, new Date("2026-01-01"))?._id).toBe("s2");
  });
  it("returns null when no active sealed", () => {
    expect(pickFefoSealed([mk({ _id: "w1", kind: "working" })], new Date("2026-01-01"))).toBeNull();
  });
});
```

- [ ] **Step 3: รัน test ให้ fail**

Run: `npm run test -- stockUnit`
Expected: FAIL — `computeWorkingLifecycle is not a function` (หรือ import error)

- [ ] **Step 4: เขียน implementation** (`src/lib/stockUnit.ts`)

เพิ่ม import ที่หัวไฟล์ (ถัดจากบรรทัด 1-2):

```ts
import { addDays, addWeeks, addMonths } from "date-fns";
import type { StockUnitItem } from "@/types/stock";
import { parseFrequency, type FrequencyUnit } from "./standardFrequency";
```

เพิ่มฟังก์ชันท้ายไฟล์:

```ts
function addInterval(from: Date, count: number, unit: FrequencyUnit): Date {
  const v = Math.max(0, Math.floor(count || 0));
  if (unit === "week") return addWeeks(from, v);
  if (unit === "month") return addMonths(from, v);
  return addDays(from, v);
}

/** อายุ working แยก 2 ค่า — mirror ของ server/lib/workingLifecycle.js */
export function computeWorkingLifecycle(opts: {
  withdrawnAt: Date;
  frequency?: string | null;
  shelf: OpenShelfLife;
  parentExp: Date | null;
}): { exp: Date | null; frequencyDue: Date | null } {
  const { withdrawnAt, frequency, shelf, parentExp } = opts;
  const cap = (d: Date | null): Date | null =>
    d && parentExp && d.getTime() > parentExp.getTime() ? parentExp : d;
  const shelfVal = Math.max(0, Math.floor(Number(shelf?.value) || 0));
  const exp = shelfVal <= 0 ? parentExp : cap(addShelfLife(withdrawnAt, shelf));
  const fi = parseFrequency(frequency);
  const frequencyDue = fi ? cap(addInterval(withdrawnAt, fi.count, fi.unit)) : null;
  return { exp, frequencyDue };
}

export type WorkingUsability = "active" | "freqDue" | "expired" | "empty" | "discarded";

/** สถานะการใช้งาน working ของ standard: หมดอายุ (exp) มาก่อนหมดความถี่ (frequencyDue) */
export function workingUsability(
  u: { status: string; exp?: string | null; frequencyDue?: string | null },
  now: Date = new Date(),
): WorkingUsability {
  if (u.status === "discarded") return "discarded";
  if (u.status === "empty") return "empty";
  if (u.exp && new Date(u.exp).getTime() <= now.getTime()) return "expired";
  if (u.frequencyDue && new Date(u.frequencyDue).getTime() <= now.getTime()) return "freqDue";
  return "active";
}

/** เลือกขวด sealed ที่ EXP ใกล้สุด (FEFO) และยัง active */
export function pickFefoSealed(units: StockUnitItem[], now: Date = new Date()): StockUnitItem | null {
  const usable = units.filter((u) => u.kind === "sealed" && unitDerivedStatus(u, now) === "active");
  if (!usable.length) return null;
  return usable.slice().sort((a, b) => {
    const ax = a.exp ? new Date(a.exp).getTime() : Infinity;
    const bx = b.exp ? new Date(b.exp).getTime() : Infinity;
    return ax - bx;
  })[0];
}
```

> หมายเหตุ: ถ้าไฟล์มี `import type { StockUnitItem }` อยู่แล้ว (บรรทัด 2) ไม่ต้อง import ซ้ำ — รวม `addDays/addWeeks/addMonths` เข้ากับ import date-fns เดิม (บรรทัด 1) และเพิ่มเฉพาะ `parseFrequency, type FrequencyUnit`.

- [ ] **Step 5: รัน test ให้ผ่าน**

Run: `npm run test -- stockUnit`
Expected: PASS ทุก test (รวมของเดิม)

- [ ] **Step 6: ขยาย type ของ discardStockUnit** (`src/lib/api.ts` บรรทัด 348-352)

แทน:

```ts
  discardStockUnit: (qrId: string, body: { reason?: string; cascade?: boolean }) =>
    request<{ discarded: string[]; count: number }>(`/stock/units/${encodeURIComponent(qrId)}/discard`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
```

- [ ] **Step 7: type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่

- [ ] **Step 8: Commit**

```bash
git add src/types/stock.ts src/lib/stockUnit.ts src/lib/stockUnit.test.ts src/lib/api.ts
git commit -m "feat(stock): FE helper computeWorkingLifecycle/workingUsability/pickFefoSealed + cascade type

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- src/types/stock.ts src/lib/stockUnit.ts src/lib/stockUnit.test.ts src/lib/api.ts
```

---

## Task 5: FE `PerformanceDropDialog` — แจ้งประสิทธิภาพลดลง (scope working/ทั้งขวด)

**Files:**
- Create: `src/components/lis/stock/PerformanceDropDialog.tsx`

**Interfaces:**
- Consumes: `api.getStockUnit`, `api.discardStockUnit({ reason, cascade })` (Task 4)
- Produces: `<PerformanceDropDialog qrId={string} onClose={()=>void} onSaved={()=>void} />`

- [ ] **Step 1: เขียน component**

สร้าง `src/components/lis/stock/PerformanceDropDialog.tsx`:

```tsx
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import type { StockUnitItem } from "@/types/stock";

interface Props {
  qrId: string;
  onClose: () => void;
  onSaved: () => void;
}

/** แจ้งประสิทธิภาพลดลง → ทิ้ง working ตัวเดียว หรือทั้งขวด (ขวดแม่ + working ทุกตัว) */
export default function PerformanceDropDialog({ qrId, onClose, onSaved }: Props) {
  const [unit, setUnit] = useState<StockUnitItem | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [scope, setScope] = useState<"unit" | "whole">("unit");
  const [reason, setReason] = useState("ประสิทธิภาพลดลง");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let on = true;
    api.getStockUnit(qrId)
      .then((u) => { if (on) setUnit(u); })
      .catch((e) => { if (on) setLoadErr((e as Error).message); });
    return () => { on = false; };
  }, [qrId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.discardStockUnit(qrId, { reason: reason || undefined, cascade: scope === "whole" });
      toast.success(scope === "whole" ? `ทิ้งทั้งขวดแล้ว (${res.count} รายการ)` : "ทิ้ง working แล้ว");
      onSaved();
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>แจ้งประสิทธิภาพลดลง</DialogTitle>
            <DialogDescription>{qrId}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {loadErr && <p className="text-sm text-destructive">{loadErr}</p>}
            {unit && (
              <div className="text-sm text-muted-foreground">
                {unit.itemName} ({unit.itemCode}) · {unit.kind === "working" ? "working" : "คงคลัง"} · Lot {unit.lotNo || "-"}
              </div>
            )}
            <div>
              <Label className="mb-1.5 block">ขอบเขตการทิ้ง</Label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="scope" checked={scope === "unit"} onChange={() => setScope("unit")} />
                  ทิ้งเฉพาะ{unit?.kind === "working" ? " working นี้" : "ขวดนี้"}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="scope" checked={scope === "whole"} onChange={() => setScope("whole")} />
                  ทิ้งทั้งขวด (ขวดแม่ + working ลูกทุกตัว)
                </label>
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block">เหตุผล</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">เมื่อทิ้งแล้ว QR ที่ทิ้งจะใช้งานต่อไม่ได้ถาวร</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
            <Button type="submit" variant="destructive" disabled={busy || !unit}>
              {busy ? "กำลังบันทึก..." : "ยืนยันทิ้ง"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่

- [ ] **Step 3: Commit**

```bash
git add src/components/lis/stock/PerformanceDropDialog.tsx
git commit -m "feat(stock): PerformanceDropDialog แจ้งประสิทธิภาพลดลง (scope working/ทั้งขวด)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- src/components/lis/stock/PerformanceDropDialog.tsx
```

---

## Task 6: FE `StandardRequisitionDialog` — เบิก standard (reuse/แบ่งใหม่)

**Files:**
- Create: `src/components/lis/stock/StandardRequisitionDialog.tsx`

**Interfaces:**
- Consumes: `api.getStandards`, `api.getStockUnits`, `api.getStockUnit`, `workingUsability`, `pickFefoSealed`, `unitDerivedStatus`, `buildUnitTree`, `WithdrawDialog`, `PerformanceDropDialog`, `StockQrScanner`, `parseScannedQrId`
- Produces: `<StandardRequisitionDialog onClose={()=>void} onSaved={()=>void} />`

- [ ] **Step 1: เขียน component**

สร้าง `src/components/lis/stock/StandardRequisitionDialog.tsx`:

```tsx
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, QrCode } from "lucide-react";
import { toast } from "sonner";

import StockQrScanner from "@/components/lis/StockQrScanner";
import WithdrawDialog from "@/components/lis/stock/WithdrawDialog";
import PerformanceDropDialog from "@/components/lis/stock/PerformanceDropDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/api";
import { buildUnitTree, parseScannedQrId, pickFefoSealed, unitDerivedStatus, workingUsability } from "@/lib/stockUnit";
import { cn } from "@/lib/utils";
import type { StockStandardItem, StockUnitItem } from "@/types/stock";

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

const USABILITY: Record<string, { label: string; cls: string; usable: boolean }> = {
  active: { label: "ยังใช้ได้", cls: "bg-emerald-100 text-emerald-700", usable: true },
  freqDue: { label: "หมดความถี่", cls: "bg-amber-100 text-amber-700", usable: false },
  expired: { label: "หมดอายุ", cls: "bg-orange-100 text-orange-700", usable: false },
  empty: { label: "หมด", cls: "bg-slate-100 text-slate-600", usable: false },
  discarded: { label: "ทิ้งแล้ว", cls: "bg-destructive/15 text-destructive", usable: false },
};

export default function StandardRequisitionDialog({ onClose, onSaved }: Props) {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [pickOpen, setPickOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [withdrawQr, setWithdrawQr] = useState("");        // sealed qrId ที่จะแบ่ง → เปิด WithdrawDialog
  const [perfDropQr, setPerfDropQr] = useState("");        // working qrId ที่จะแจ้ง/ทิ้ง

  const { data: standards = [] } = useQuery({
    queryKey: ["stock", "standards"],
    queryFn: api.getStandards,
  });
  const standard = useMemo(() => standards.find((s) => s.code === code) ?? null, [standards, code]);

  const { data: units = [] } = useQuery({
    queryKey: ["stock", "units", code],
    queryFn: () => api.getStockUnits({ itemCode: code }),
    enabled: !!code,
  });

  const workings = units.filter((u) => u.kind === "working" && u.status !== "discarded");
  const sealed = units
    .filter((u) => u.kind === "sealed" && unitDerivedStatus(u) === "active")
    .sort((a, b) => (a.exp ? +new Date(a.exp) : Infinity) - (b.exp ? +new Date(b.exp) : Infinity));
  const labelOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of buildUnitTree(units)) map.set(r.unit._id, r.label);
    return map;
  }, [units]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["stock", "units", code] });
    qc.invalidateQueries({ queryKey: ["stock", "units"] });
    qc.invalidateQueries({ queryKey: ["stock", "transactions"] });
  };

  const onScanned = async (raw: string) => {
    setScanOpen(false);
    const qrId = parseScannedQrId(raw);
    try {
      const u = await api.getStockUnit(qrId);
      setCode(u.itemCode);
      if (u.kind === "sealed") setWithdrawQr(u.qrId); // สแกนขวด sealed → เปิดแบ่งเลย
    } catch {
      toast.error("ไม่พบขวดจาก QR นี้");
    }
  };

  const startWithdrawFefo = () => {
    const fefo = pickFefoSealed(units);
    if (!fefo) { toast.error("ไม่มีขวด sealed ที่แบ่งได้ — ไปเพิ่มขวดที่หน้า Stock"); return; }
    setWithdrawQr(fefo.qrId);
  };

  const reuse = (u: StockUnitItem) => {
    toast.success(`ใช้ working ${labelOf.get(u._id) ?? u.qrId} (ยังใช้ได้ — ไม่ต้องแบ่งใหม่)`);
    onSaved();
    onClose();
  };

  return (
    <>
      <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>เบิก Standard</DialogTitle>
            <DialogDescription>เลือก standard แล้วใช้ working เดิม หรือแบ่ง working ใหม่จากขวด sealed</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="mb-1.5 block">Standard</Label>
              <div className="flex gap-2">
                <Popover open={pickOpen} onOpenChange={setPickOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" role="combobox" className="flex-1 justify-between font-normal">
                      <span className="truncate">{standard ? `${standard.name} (${standard.code})` : "เลือก standard..."}</span>
                      <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="start">
                    <Command>
                      <CommandInput placeholder="ค้นหาชื่อ/code" />
                      <CommandList>
                        <CommandEmpty>ไม่พบรายการ</CommandEmpty>
                        {standards.map((s) => (
                          <CommandItem key={s.code} value={`${s.name} ${s.code}`} onSelect={() => { setCode(s.code); setPickOpen(false); }}>
                            <Check className={cn("mr-2 h-4 w-4", code === s.code ? "opacity-100" : "opacity-0")} />
                            <span className="flex-1">{s.name}</span>
                            <span className="text-xs text-muted-foreground">{s.code}</span>
                          </CommandItem>
                        ))}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Button type="button" variant="outline" size="icon" title="สแกน QR ขวด" onClick={() => setScanOpen(true)}>
                  <QrCode className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {code && (
              <>
                <div>
                  <Label className="mb-1.5 block">working ที่มี</Label>
                  {workings.length === 0 ? (
                    <p className="text-sm text-muted-foreground">ยังไม่มี working — แบ่งใหม่ด้านล่าง</p>
                  ) : (
                    <ul className="divide-y rounded border">
                      {workings.map((u) => {
                        const st = workingUsability(u);
                        const meta = USABILITY[st] ?? USABILITY.active;
                        return (
                          <li key={u._id} className="flex items-center gap-2 p-2 text-sm">
                            <span className="w-10 text-xs text-muted-foreground">{labelOf.get(u._id) ?? "-"}</span>
                            <Badge className={cn("text-xs", meta.cls)}>{meta.label}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {u.volume?.remaining ?? "-"} {u.volume?.unit} · EXP {u.exp ? new Date(u.exp).toLocaleDateString("th-TH") : "-"}
                            </span>
                            <span className="ml-auto flex gap-1">
                              {meta.usable && <Button type="button" size="sm" onClick={() => reuse(u)}>ใช้อันนี้</Button>}
                              <Button type="button" size="sm" variant="outline" className="text-destructive" onClick={() => setPerfDropQr(u.qrId)}>
                                แจ้ง/ทิ้ง
                              </Button>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div>
                  <Label className="mb-1.5 block">แบ่ง working ใหม่จากขวด sealed</Label>
                  {sealed.length === 0 ? (
                    <p className="text-sm text-muted-foreground">ไม่มีขวด sealed ที่แบ่งได้</p>
                  ) : (
                    <div className="space-y-2">
                      <Button type="button" variant="secondary" onClick={startWithdrawFefo}>
                        + แบ่งจากขวด EXP ใกล้สุด ({labelOf.get(sealed[0]._id) ?? "1"} · EXP {sealed[0].exp ? new Date(sealed[0].exp).toLocaleDateString("th-TH") : "-"})
                      </Button>
                      {sealed.length > 1 && (
                        <ul className="divide-y rounded border">
                          {sealed.map((u) => (
                            <li key={u._id} className="flex items-center gap-2 p-2 text-sm">
                              <span className="w-10 text-xs text-muted-foreground">{labelOf.get(u._id) ?? "-"}</span>
                              <span className="text-xs text-muted-foreground">
                                Lot {u.lotNo || "-"} · เหลือ {u.volume?.remaining} {u.volume?.unit} · EXP {u.exp ? new Date(u.exp).toLocaleDateString("th-TH") : "-"}
                              </span>
                              <Button type="button" size="sm" variant="outline" className="ml-auto" onClick={() => setWithdrawQr(u.qrId)}>แบ่ง</Button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>ปิด</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <StockQrScanner open={scanOpen} title="สแกน QR ขวด standard" onClose={() => setScanOpen(false)} onScanned={onScanned} />

      {withdrawQr && (
        <WithdrawDialog
          qrId={withdrawQr}
          onClose={() => setWithdrawQr("")}
          onSaved={() => { refresh(); onSaved(); onClose(); }}
        />
      )}
      {perfDropQr && (
        <PerformanceDropDialog
          qrId={perfDropQr}
          onClose={() => setPerfDropQr("")}
          onSaved={() => { refresh(); onSaved(); }}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: ไม่มี error ใหม่ (ถ้าเจอ `StockStandardItem` ไม่มี field ที่อ้าง — ใช้เฉพาะ `.name`/`.code` ซึ่งมีแน่นอน)

- [ ] **Step 3: Commit**

```bash
git add src/components/lis/stock/StandardRequisitionDialog.tsx
git commit -m "feat(stock): StandardRequisitionDialog เบิก standard (reuse working / แบ่งใหม่ FEFO)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- src/components/lis/stock/StandardRequisitionDialog.tsx
```

---

## Task 7: FE chooser tab — รวมสารเคมี + standard ในปุ่มเดียว

**Files:**
- Create: `src/components/lis/StockRequisitionTab.tsx`
- Modify: `src/components/lis/ChemicalRequisitionPanel.tsx` (list-only)
- Modify: `src/pages/StockDeduction.tsx` (render StockRequisitionTab)

**Interfaces:**
- Consumes: `ChemicalRequisitionPanel` (list-only), `ChemicalRequisitionDialog`, `StandardRequisitionDialog`, `PerformanceDropDialog`, `api.getStockTransactions`
- Produces: `<StockRequisitionTab roomSlug={string} instruments={{id,name}[]} />`

- [ ] **Step 1: ถอดปุ่ม/dialog เบิกออกจาก `ChemicalRequisitionPanel` (เหลือ list + ลบ)**

ใน `src/components/lis/ChemicalRequisitionPanel.tsx`:
- ลบ `import ChemicalRequisitionDialog ...` (บรรทัด 9), ลบ `Plus` จาก import lucide (บรรทัด 6 → เหลือ `FlaskConical, X`), ลบ `import { Button }` ถ้าไม่เหลือที่ใช้ (เช็ค: หลังลบปุ่มหัวการ์ด ไม่มี `<Button>` เหลือ → ลบ import Button ด้วย)
- ลบ state `const [dialogOpen, setDialogOpen] = useState(false);` (บรรทัด 25) และ import `useState` ถ้าไม่เหลือที่ใช้
- ลบปุ่มใน `CardHeader` (บรรทัด 55-58 `<Button size="sm" onClick={() => setDialogOpen(true)}>...`) — เหลือแค่ `<CardTitle>`
- ลบบล็อก render dialog ท้าย (บรรทัด 95-102 `{dialogOpen && (<ChemicalRequisitionDialog .../>)}`)
- ลบ prop `instruments` ออกจาก `Props`/signature ถ้าไม่เหลือที่ใช้ (มันถูกใช้แค่ส่งให้ dialog) — **แต่คง `roomSlug`** (ยังใช้ใน query)

ผลลัพธ์ (ไฟล์เต็มหลังแก้):

```tsx
// src/components/lis/ChemicalRequisitionPanel.tsx
// การ์ดแสดงรายการเบิกสารเคมี (solvent) วันนี้ + ยกเลิก/คืนสต็อก (list-only — ปุ่มเบิกอยู่ที่ StockRequisitionTab)
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FlaskConical, X } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { todayStr } from "@/lib/chemicalRequisition";

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

interface Props {
  roomSlug: string;
}

export default function ChemicalRequisitionPanel({ roomSlug }: Props) {
  const queryClient = useQueryClient();

  const { data: requisitions = [] } = useQuery({
    queryKey: ["chemical-requisitions", roomSlug, todayStr()],
    queryFn: () => api.getChemicalRequisitions({ room: roomSlug, date: todayStr() }),
    refetchOnWindowFocus: true,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["chemical-requisitions"] });
    queryClient.invalidateQueries({ queryKey: ["stock", "solvents"] });
    queryClient.invalidateQueries({ queryKey: ["stock", "transactions"] });
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteChemicalRequisition(id),
    onSuccess: () => { toast.success("ยกเลิกการเบิกแล้ว (คืนสต็อก)"); invalidate(); },
    onError: (err: Error) => toast.error(err.message || "ยกเลิกไม่สำเร็จ"),
  });

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FlaskConical className="h-4 w-4 text-primary" />
          สารเคมีที่เบิกวันนี้
        </CardTitle>
      </CardHeader>
      <CardContent>
        {requisitions.length === 0 ? (
          <p className="text-sm text-muted-foreground">ยังไม่มีการเบิกวันนี้</p>
        ) : (
          <ul className="divide-y">
            {requisitions.map((req) => (
              <li key={req._id} className="flex items-center gap-2 py-1.5 text-sm">
                <span className="w-12 text-xs tabular-nums text-muted-foreground">
                  {req.createdAt ? fmtTime(req.createdAt) : ""}
                </span>
                <span className="font-medium">{req.solventName}</span>
                <span className="text-muted-foreground">× {req.qty} ขวด</span>
                <span className="text-muted-foreground">→ {req.instrumentName}</span>
                {req.requestedBy?.name && (
                  <span className="text-xs text-muted-foreground">โดย {req.requestedBy.name}</span>
                )}
                <button
                  type="button"
                  className="ml-auto text-muted-foreground hover:text-destructive"
                  title="ยกเลิกการเบิก (คืนสต็อก)"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (window.confirm(`ยกเลิกการเบิก ${req.solventName} x ${req.qty} ขวด และคืนสต็อก?`)) {
                      deleteMutation.mutate(req._id);
                    }
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: สร้าง `StockRequisitionTab`**

สร้าง `src/components/lis/StockRequisitionTab.tsx`:

```tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FlaskConical, Package, Plus } from "lucide-react";

import ChemicalRequisitionDialog from "@/components/lis/daily-check/ChemicalRequisitionDialog";
import ChemicalRequisitionPanel from "@/components/lis/ChemicalRequisitionPanel";
import StandardRequisitionDialog from "@/components/lis/stock/StandardRequisitionDialog";
import PerformanceDropDialog from "@/components/lis/stock/PerformanceDropDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/api";
import { todayStr } from "@/lib/chemicalRequisition";
import type { StockTransactionItem } from "@/types/stock";

interface Props {
  roomSlug: string;
  instruments: { id: string; name: string }[];
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

export default function StockRequisitionTab({ roomSlug, instruments }: Props) {
  const [chooser, setChooser] = useState(false);
  const [which, setWhich] = useState<"chemical" | "standard" | null>(null);
  const [perfDropQr, setPerfDropQr] = useState("");

  const { data: stdTx = [], refetch } = useQuery({
    queryKey: ["stock", "transactions", "standard-withdraw"],
    queryFn: () => api.getStockTransactions({ action: "withdraw", itemType: "standard", limit: 100 }),
  });
  const today = todayStr();
  const todayStd = stdTx.filter((t) => t.createdAt && new Date(t.createdAt).toLocaleDateString("sv-SE") === today);

  return (
    <div className="space-y-4">
      <Popover open={chooser} onOpenChange={setChooser}>
        <PopoverTrigger asChild>
          <Button><Plus className="mr-1 h-4 w-4" /> เบิก stock</Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="start">
          <p className="mb-2 px-1 text-xs text-muted-foreground">เบิกอะไร?</p>
          <div className="grid gap-1">
            <Button variant="ghost" className="justify-start" onClick={() => { setWhich("chemical"); setChooser(false); }}>
              <FlaskConical className="mr-2 h-4 w-4" /> สารเคมี (solvent)
            </Button>
            <Button variant="ghost" className="justify-start" onClick={() => { setWhich("standard"); setChooser(false); }}>
              <Package className="mr-2 h-4 w-4" /> Standard
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <ChemicalRequisitionPanel roomSlug={roomSlug} />

      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4 text-primary" /> Standard ที่แบ่งวันนี้
          </CardTitle>
        </CardHeader>
        <CardContent>
          {todayStd.length === 0 ? (
            <p className="text-sm text-muted-foreground">ยังไม่มีการแบ่งวันนี้</p>
          ) : (
            <ul className="divide-y">
              {todayStd.map((t) => (
                <li key={t._id} className="flex items-center gap-2 py-1.5 text-sm">
                  <span className="w-12 text-xs tabular-nums text-muted-foreground">{t.createdAt ? fmtTime(t.createdAt) : ""}</span>
                  <span className="font-medium">{t.itemName}</span>
                  {(t.volumeDelta ?? t.delta) != null && (
                    <span className="text-muted-foreground">{Math.abs((t.volumeDelta ?? t.delta)!)} {t.unit}</span>
                  )}
                  {(t.userName || t.userEmail) && <span className="text-xs text-muted-foreground">โดย {t.userName || t.userEmail}</span>}
                  {t.qrId && (
                    <button type="button" className="ml-auto text-xs text-destructive hover:underline" onClick={() => setPerfDropQr(t.qrId!)}>
                      แจ้ง/ทิ้ง
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {which === "chemical" && (
        <ChemicalRequisitionDialog
          roomSlug={roomSlug}
          instruments={instruments}
          onClose={() => setWhich(null)}
          onSaved={() => { /* panel query invalidate เองผ่าน dialog */ }}
        />
      )}
      {which === "standard" && (
        <StandardRequisitionDialog onClose={() => setWhich(null)} onSaved={() => refetch()} />
      )}
      {perfDropQr && (
        <PerformanceDropDialog qrId={perfDropQr} onClose={() => setPerfDropQr("")} onSaved={() => refetch()} />
      )}
    </div>
  );
}
```

> **ต้องทำก่อน (ยืนยันจากโค้ดแล้ว)**: `StockTransactionItem` (`src/types/stock.ts` บรรทัด 57-74) **ยังไม่มี** `qrId` และ `volumeDelta` — แต่ withdraw log ฝั่ง server เก็บ `qrId` + `volumeDelta: -ml` (ไม่ใช่ `delta`) และ `StockTransaction` model มี field ทั้งคู่. เพิ่มใน `StockTransactionItem` ถัดจาก `delta?` (บรรทัด 67):
> ```ts
>   delta?: number | null;
>   volumeDelta?: number | null;
>   qrId?: string;
> ```
> (การ์ด "Standard ที่แบ่งวันนี้" โชว์ปริมาณจาก `volumeDelta` เป็นหลัก fallback `delta`.)

- [ ] **Step 3: wire เข้า `StockDeduction.tsx`**

ใน `src/pages/StockDeduction.tsx`:
- แทน import (บรรทัด 11) `import ChemicalRequisitionPanel ...` ด้วย `import StockRequisitionTab from "@/components/lis/StockRequisitionTab";`
- แทนเนื้อในแท็บ requisition (บรรทัด 96-98):

```tsx
        <TabsContent value="requisition">
          <StockRequisitionTab roomSlug={ANALYSIS_ROOM_SLUG} instruments={analysisInstruments} />
        </TabsContent>
```

- [ ] **Step 4: type-check + lint**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run lint`
Expected: ไม่มี error ใหม่

- [ ] **Step 5: รัน test ทั้งชุด (non-regression)**

Run: `npm run test`
Expected: PASS ทั้งหมด (รวม stockUnit.test.ts ใหม่)

- [ ] **Step 6: Commit**

```bash
git add src/components/lis/StockRequisitionTab.tsx src/components/lis/ChemicalRequisitionPanel.tsx src/pages/StockDeduction.tsx src/types/stock.ts
git commit -m "feat(stock): ปุ่มเดียว 'เบิก stock' chooser สารเคมี/Standard + รายการแบ่ง standard วันนี้

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- src/components/lis/StockRequisitionTab.tsx src/components/lis/ChemicalRequisitionPanel.tsx src/pages/StockDeduction.tsx src/types/stock.ts
```

---

## Task 8: Manual E2E + verify (บนเครื่อง user)

**Files:** ไม่มี (verification)

- [ ] **Step 1: รัน BE tests ทั้งหมด**

Run: `node --test server/lib/workingLifecycle.test.js server/lib/stockUnitDiscard.test.js`
Expected: PASS

- [ ] **Step 2: เปิด dev (frontend + backend) แล้วเดินตาม scenario**

รัน `npm run dev` (root) + `cd server && npm run dev`. ที่หน้า `/stock-deduction` แท็บ "เบิก stock":
1. กด "+ เบิก stock" → เห็น chooser 2 ตัวเลือก (สารเคมี / Standard).
2. **สารเคมี** → เบิก solvent ได้เหมือนเดิม → โผล่ใน "สารเคมีที่เบิกวันนี้" + แท็บ "ประวัติ" + กด X คืนสต็อกได้.
3. **Standard X** (ยังไม่มี working) → "แบ่งจากขวด EXP ใกล้สุด" → กรอก ml → working ใหม่ + ปริ้นลาเบล + โผล่ใน "Standard ที่แบ่งวันนี้".
4. เปิด "เบิก stock → Standard X" อีกครั้ง → working เมื่อกี้เป็น badge **"ยังใช้ได้"** + ปุ่ม "ใช้อันนี้" (กด → toast, ไม่มีแถวใหม่ใน "ประวัติ").
5. ตั้ง standard ที่ frequency สั้น / แก้ `frequencyDue` ใน DB ให้เป็นอดีต → working เป็น **"หมดความถี่"** ไม่มีปุ่ม "ใช้อันนี้".
6. "แจ้ง/ทิ้ง" บน working → scope **working นี้** → หายเฉพาะตัวนั้น; ทำใหม่กับ scope **ทั้งขวด** → ขวดแม่ + working ทุกตัวหาย (ยืนยันที่หน้า Stock / `StandardUnitsPanel`).
7. แท็บ "ประวัติ" เห็น `withdraw` (แบ่งใหม่) + `discard` — ไม่มี event ตอน "ใช้อันนี้".

- [ ] **Step 3: อัปเดต seed-data (ถ้ามีการเพิ่ม field ที่ต้อง export)**

Run: `cd server && npm run seed:export`
(แล้ว commit `server/seed-data/` ถ้ามี diff — `frequencyDue` เป็น field ใหม่ที่จะโผล่ใน StockUnit dump)

- [ ] **Step 4: Commit seed-data (ถ้ามี diff)**

```bash
git add server/seed-data
git commit -m "chore: seed-data refresh (StockUnit.frequencyDue)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- server/seed-data
```

---

## Self-Review

**Spec coverage:**
- R1 (ปุ่มเดียว chooser) → Task 7 ✅
- R2 (เลือก standard → reuse/แบ่งใหม่) → Task 6 ✅
- R3 (บันทึกเฉพาะแบ่งใหม่ / reuse ไม่ log) → Task 6 `reuse()` ไม่เรียก API ✅; แบ่งใหม่ผ่าน WithdrawDialog (log withdraw เดิม) ✅
- R4 (แยก frequencyDue/exp) → Task 1 (BE lib) + Task 2 (wiring) + Task 4 (FE mirror + workingUsability) ✅
- R5 (แจ้งประสิทธิภาพลดลง scope working/ทั้งขวด) → Task 3 (cascade BE) + Task 5 (PerformanceDropDialog) ✅
- R6 (สารเคมีไม่ regress) → Task 7 คง `ChemicalRequisitionDialog`/query เดิม + Task 8 scenario 2 ✅

**Placeholder scan:** ไม่มี TBD/TODO; ทุก step ที่แก้โค้ดมี code block เต็ม ✅

**Type consistency:**
- `computeWorkingLifecycle` — BE (`{withdrawnAt,frequency,shelf,parentExp}→{exp,frequencyDue}`) = FE signature ✅
- `workingUsability` return `"active"|"freqDue"|"expired"|"empty"|"discarded"` ใช้ตรงกันใน Task 4 test + Task 6 `USABILITY` map ✅
- `api.discardStockUnit(qrId,{reason?,cascade?})→{discarded,count}` (Task 4) ใช้ใน Task 5 `res.count` ✅
- `pickFefoSealed(units,now?)→StockUnitItem|null` (Task 4) ใช้ใน Task 6 `startWithdrawFefo` ✅
- BE discard return `{discarded,count}` (Task 3) = FE type (Task 4) ✅

**หมายเหตุความเสี่ยงที่ผู้ทำต้องระวัง:**
- Task 2 Step 4 (ลบ inline helper): ต้อง grep ยืนยันไม่มี call site อื่นก่อนลบ — ถ้าเจอให้หยุดถาม
- Task 6/7 Step type-check: ถ้า `StockTransactionItem.qrId` ไม่มีใน type → เพิ่มตาม note (server log มี qrId อยู่แล้ว)
- พฤติกรรมเปลี่ยน (ตั้งใจ): working ที่ "ไม่มี frequency และ shelf=0" เดิม EXP=เที่ยงคืนวันถัดไป ตอนนี้ EXP=EXP ขวดแม่ — เป็นไปตาม spec R4/§6
