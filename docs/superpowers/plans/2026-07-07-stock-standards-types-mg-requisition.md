# Stock Standards — 3-type bottles + mg-per-weight requisition — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Standard stock into single-bottle records with a `type` (primary/supplier/working), make requisition deduct real mg per weighing (GC=3 / HPLC=1 default, custom), fix near-empty rules, and remove the working-split ("แบ่ง working") workflow + "Standard ใช้งานอยู่" tab.

**Architecture:** `StockUnit` (one physical bottle = one doc) becomes the single source of truth. Each bottle carries `type`; requisition subtracts `sum(weights)` mg from a chosen bottle atomically; a bottle hits `status=empty` at 0 mg. Legacy `StockStandard` tier qty stays read-only. Pure helpers (`stockStatus.ts`, `standardRequisition.ts`, `requisitionWeights.js`) hold all the math and are unit-tested; UI and routes consume them.

**Tech Stack:** React 18 + TS + Vite + TanStack Query + shadcn/ui (frontend); Express 4 + Mongoose 8 (backend); Vitest (FE tests), `node:test` (BE tests).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-07-stock-standards-types-mg-requisition-design.md`
- Bottle `type` values are exactly `'primary' | 'supplier' | 'working'` (note: `supplier`, not `supply`).
- Near-empty rules: **Standard** & **solvent** → `low` when usable count = 1, `out` at 0; **glassware** → only `out` (0) / `ok` (≥1), no `low`.
- "Usable bottle" = `status === 'active'` AND not expired (`!exp || new Date(exp) >= now`).
- Deduction is atomic (`findOneAndUpdate` with `$inc` + `'volume.remaining': { $gte: amount }`) — keep the existing guard; never introduce a read-modify-write race.
- Type-check FE with `npx tsc -p tsconfig.app.json` (root `tsc --noEmit` is a no-op — see memory). Lint: `npm run lint`. FE tests: `npm run test`. BE tests: `cd server && node --test <file>`.
- Commit per task with an explicit pathspec (`git add -- <files>`) — this repo has a concurrent auto-sync committer; never `git add -A`.
- Do NOT run `npm run build`. Do NOT hard-delete tier fields from `StockStandard`. Do NOT run the migration against prod — the user runs it (Task 16).

---

## File Structure

**New**
- `src/lib/stockStatus.ts` (+ `stockStatus.test.ts`) — near-empty/out level rules + standard bottle summary
- `src/lib/standardRequisition.ts` (+ `standardRequisition.test.ts`) — weight-count default, sum, validation (FE)
- `server/lib/requisitionWeights.js` (+ `requisitionWeights.test.js`) — sum/validate weights (BE mirror)
- `server/scripts/migrate-stockunits-source-to-type.js` — one-off source→type migration

**Modified — backend**
- `server/models/StockUnit.js` — add `type`
- `server/models/StockTransaction.js` — add `weights`, `instrumentId`, `instrumentName`
- `server/lib/stockSource.js` (+ `.test.js`) — add `type` validators
- `server/routes/stock.js` — extend `deduct-mg`; receive uses `type`; discard uses `outcome`; drop `/withdraw` + `createWorkingFromParent`

**Modified — frontend**
- `src/types/stock.ts` — `StockUnitItem.type`; transaction `weights`
- `src/lib/api.ts` — `deductStockUnitMg`; `receiveStockUnits` type; `discardStockUnit` outcome; drop `withdrawStockUnit`
- `src/lib/stockUnit.ts` — replace `summarizeUnits`/kind logic; drop working helpers
- `src/components/lis/stock/StandardRequisitionDialog.tsx` — full rewrite
- `src/components/lis/stock/StockRequisitionButton.tsx` — pass `instruments` to standard dialog
- `src/components/lis/stock/ReceiveBottlesDialog.tsx`, `ReceiveCart.tsx` — 3-type picker
- `src/components/lis/stock/PerformanceDropDialog.tsx` — per-bottle empty/discard
- `src/components/lis/stock/StandardUnitsPanel.tsx` — flat list + type + report menu
- `src/pages/Stock.tsx` — status via `stockStatus.ts`
- `src/pages/StockDeduction.tsx` — history-only
- `src/pages/StockUnitScanPage.tsx` — drop withdraw

**Deleted**
- `src/components/lis/stock/StandardWorkingPanel.tsx`, `StandardUnitList.tsx`, `StandardDailyRow.tsx`, `StandardUnitDetailDialog.tsx`, `WithdrawDialog.tsx`
- `src/lib/standardStatus.ts` (+ `standardStatus.test.ts` if any)

---

## Phase A — Foundation helpers & models (pure, testable)

### Task 1: `stockStatus.ts` — near-empty/out rules

**Files:**
- Create: `src/lib/stockStatus.ts`
- Test: `src/lib/stockStatus.test.ts`

**Interfaces:**
- Produces:
  - `type StockLevel = "out" | "low" | "ok"`
  - `isUsableBottle(u: {status: string; exp?: string|null}, now?: Date): boolean`
  - `usableBottleCount(units: {status: string; exp?: string|null}[], now?: Date): number`
  - `standardLevel(usable: number): StockLevel`
  - `solventLevel(qty: number): StockLevel`
  - `glasswareLevel(qty: number): StockLevel`
  - `interface StdSummary { usable: number; expired: number; expiringSoon: number }`
  - `summarizeStandard(units: {status:string; exp?:string|null}[], now?: Date, soonDays?: number): StdSummary`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/stockStatus.test.ts
import { describe, it, expect } from "vitest";
import {
  isUsableBottle, usableBottleCount, standardLevel, solventLevel, glasswareLevel, summarizeStandard,
} from "./stockStatus";

const now = new Date("2026-07-07T00:00:00Z");
const mk = (o: Partial<{ status: string; exp: string | null }>) => ({ status: "active", exp: null, ...o });

describe("isUsableBottle", () => {
  it("active + no exp is usable", () => expect(isUsableBottle(mk({}), now)).toBe(true));
  it("active + future exp is usable", () => expect(isUsableBottle(mk({ exp: "2026-08-01" }), now)).toBe(true));
  it("expired is not usable", () => expect(isUsableBottle(mk({ exp: "2026-06-01" }), now)).toBe(false));
  it("empty/discarded not usable", () => {
    expect(isUsableBottle(mk({ status: "empty" }), now)).toBe(false);
    expect(isUsableBottle(mk({ status: "discarded" }), now)).toBe(false);
  });
});

describe("usableBottleCount", () => {
  it("counts only usable bottles across all", () => {
    const n = usableBottleCount(
      [mk({}), mk({ status: "empty" }), mk({ exp: "2026-06-01" }), mk({ exp: "2026-09-01" })],
      now,
    );
    expect(n).toBe(2);
  });
});

describe("standardLevel", () => {
  it("0 out, 1 low, 2+ ok", () => {
    expect(standardLevel(0)).toBe("out");
    expect(standardLevel(1)).toBe("low");
    expect(standardLevel(2)).toBe("ok");
  });
});

describe("solventLevel", () => {
  it("0 out, 1 low, 2+ ok", () => {
    expect(solventLevel(0)).toBe("out");
    expect(solventLevel(1)).toBe("low");
    expect(solventLevel(5)).toBe("ok");
  });
});

describe("glasswareLevel", () => {
  it("0 out, else ok (no low)", () => {
    expect(glasswareLevel(0)).toBe("out");
    expect(glasswareLevel(1)).toBe("ok");
    expect(glasswareLevel(99)).toBe("ok");
  });
});

describe("summarizeStandard", () => {
  it("counts usable / expired / expiringSoon", () => {
    const s = summarizeStandard(
      [mk({}), mk({ exp: "2026-07-20" }), mk({ exp: "2026-06-01" }), mk({ status: "discarded" })],
      now, 30,
    );
    expect(s).toEqual({ usable: 2, expired: 1, expiringSoon: 1 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/stockStatus.test.ts`
Expected: FAIL — "Failed to resolve import ./stockStatus".

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/stockStatus.ts
// กฎระดับ stock กลาง — near-empty/out ทั้ง Standard / solvent / เครื่องแก้ว.
// "ขวดใช้ได้" = active และยังไม่หมดอายุ. Standard/solvent low ที่เหลือ 1, out ที่ 0.
// เครื่องแก้วมีแค่ out (0) / ok (≥1) — ไม่มี low.

export type StockLevel = "out" | "low" | "ok";

interface BottleLike { status: string; exp?: string | null }

export function isUsableBottle(u: BottleLike, now: Date = new Date()): boolean {
  if (u.status !== "active") return false;
  if (u.exp && new Date(u.exp).getTime() < now.getTime()) return false;
  return true;
}

export function usableBottleCount(units: BottleLike[], now: Date = new Date()): number {
  return units.reduce((n, u) => (isUsableBottle(u, now) ? n + 1 : n), 0);
}

/** 0 → out, 1 → low (ใกล้หมด), ≥2 → ok */
function levelFromCount(n: number): StockLevel {
  if (n <= 0) return "out";
  if (n === 1) return "low";
  return "ok";
}

export const standardLevel = levelFromCount;
export const solventLevel = levelFromCount;

/** เครื่องแก้ว: ไม่มี near-empty — 0 → out, ≥1 → ok */
export function glasswareLevel(qty: number): StockLevel {
  return qty <= 0 ? "out" : "ok";
}

export interface StdSummary { usable: number; expired: number; expiringSoon: number }

/** สรุปขวดของสาร: usable (นับ level), expired (active แต่หมดอายุ), expiringSoon (usable + exp ภายใน soonDays) */
export function summarizeStandard(
  units: BottleLike[],
  now: Date = new Date(),
  soonDays = 30,
): StdSummary {
  const soonMs = soonDays * 24 * 60 * 60 * 1000;
  let usable = 0, expired = 0, expiringSoon = 0;
  for (const u of units) {
    if (u.status === "discarded" || u.status === "empty") continue;
    const isExpired = !!(u.exp && new Date(u.exp).getTime() < now.getTime());
    if (isExpired) { expired++; continue; }
    usable++;
    if (u.exp && new Date(u.exp).getTime() - now.getTime() <= soonMs) expiringSoon++;
  }
  return { usable, expired, expiringSoon };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/stockStatus.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add -- src/lib/stockStatus.ts src/lib/stockStatus.test.ts
git commit -m "feat(stock): stockStatus helper — near-empty/out rules for std/solvent/glassware"
```

---

### Task 2: `standardRequisition.ts` — weight defaults & validation (FE)

**Files:**
- Create: `src/lib/standardRequisition.ts`
- Test: `src/lib/standardRequisition.test.ts`

**Interfaces:**
- Produces:
  - `defaultWeightCount(group?: string): number` — `"gc"` → 3, else → 1
  - `sumWeights(weights: number[]): number` — sum, non-finite treated as 0
  - `validateWeights(weights: number[], remainingMg: number): string` — `""` ok else Thai error

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/standardRequisition.test.ts
import { describe, it, expect } from "vitest";
import { defaultWeightCount, sumWeights, validateWeights } from "./standardRequisition";

describe("defaultWeightCount", () => {
  it("gc → 3, hplc → 1, unknown → 1", () => {
    expect(defaultWeightCount("gc")).toBe(3);
    expect(defaultWeightCount("hplc")).toBe(1);
    expect(defaultWeightCount(undefined)).toBe(1);
  });
});

describe("sumWeights", () => {
  it("sums, ignoring NaN", () => {
    expect(sumWeights([9.8, 10.3, 10.1])).toBeCloseTo(30.2);
    expect(sumWeights([Number.NaN, 5])).toBe(5);
    expect(sumWeights([])).toBe(0);
  });
});

describe("validateWeights", () => {
  it("all weights must be > 0", () => {
    expect(validateWeights([0, 5], 100)).toBe("กรุณากรอก mg ทุกน้ำหนักให้มากกว่า 0");
    expect(validateWeights([], 100)).toBe("กรุณากรอก mg ทุกน้ำหนักให้มากกว่า 0");
  });
  it("total must not exceed remaining", () => {
    expect(validateWeights([60, 60], 100)).toBe("mg รวมเกินปริมาณคงเหลือของขวด");
  });
  it("ok returns empty string", () => {
    expect(validateWeights([10, 10, 10], 100)).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/standardRequisition.test.ts`
Expected: FAIL — cannot resolve `./standardRequisition`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/standardRequisition.ts
// ตรรกะเบิก Standard: จำนวนน้ำหนัก default ตามเครื่อง + รวม/ตรวจ mg รายน้ำหนัก.

/** default จำนวนน้ำหนัก: GC = 3, อื่นๆ (HPLC ฯลฯ) = 1 */
export function defaultWeightCount(group?: string): number {
  return group === "gc" ? 3 : 1;
}

/** ผลรวม mg — ข้ามค่าที่ไม่ใช่ตัวเลข */
export function sumWeights(weights: number[]): number {
  return weights.reduce((s, w) => (Number.isFinite(w) ? s + w : s), 0);
}

/** "" = ผ่าน; ไม่งั้นข้อความ error ภาษาไทย */
export function validateWeights(weights: number[], remainingMg: number): string {
  if (weights.length === 0 || weights.some((w) => !Number.isFinite(w) || w <= 0)) {
    return "กรุณากรอก mg ทุกน้ำหนักให้มากกว่า 0";
  }
  if (sumWeights(weights) > remainingMg) return "mg รวมเกินปริมาณคงเหลือของขวด";
  return "";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/standardRequisition.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -- src/lib/standardRequisition.ts src/lib/standardRequisition.test.ts
git commit -m "feat(stock): standardRequisition helper — weight defaults + mg validation"
```

---

### Task 3: `stockSource.js` — add `type` validators (BE)

**Files:**
- Modify: `server/lib/stockSource.js`
- Test: `server/lib/stockSource.test.js`

**Interfaces:**
- Produces: `RECEIVE_TYPES`, `UNIT_TYPES`, `isValidReceiveType(v)`, `isValidUnitType(v)` (keep existing source exports for migration compat).

- [ ] **Step 1: Add failing tests** (append to `server/lib/stockSource.test.js`)

```js
const {
  RECEIVE_TYPES, UNIT_TYPES, isValidReceiveType, isValidUnitType,
} = require('./stockSource');

test('RECEIVE_TYPES = primary, supplier, working', () => {
  assert.deepStrictEqual(RECEIVE_TYPES, ['primary', 'supplier', 'working']);
});

test('UNIT_TYPES adds blank', () => {
  assert.deepStrictEqual(UNIT_TYPES, ['primary', 'supplier', 'working', '']);
});

test('isValidReceiveType rejects blank + junk', () => {
  assert.strictEqual(isValidReceiveType('working'), true);
  assert.strictEqual(isValidReceiveType('supplier'), true);
  assert.strictEqual(isValidReceiveType(''), false);
  assert.strictEqual(isValidReceiveType('supply'), false);
});

test('isValidUnitType accepts blank, rejects junk', () => {
  assert.strictEqual(isValidUnitType(''), true);
  assert.strictEqual(isValidUnitType('working'), true);
  assert.strictEqual(isValidUnitType('supply'), false);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd server && node --test lib/stockSource.test.js`
Expected: FAIL — `isValidReceiveType is not a function`.

- [ ] **Step 3: Implement** (edit `server/lib/stockSource.js`)

Add after the existing `UNIT_SOURCES` block:

```js
// ประเภทขวด standard ใหม่ (แทน source เดิม): primary / supplier / working
const RECEIVE_TYPES = Object.freeze(['primary', 'supplier', 'working']);
const UNIT_TYPES = Object.freeze(['primary', 'supplier', 'working', '']);

function isValidReceiveType(v) {
  return RECEIVE_TYPES.includes(v);
}
function isValidUnitType(v) {
  return UNIT_TYPES.includes(v);
}
```

And extend `module.exports`:

```js
module.exports = {
  RECEIVE_SOURCES, UNIT_SOURCES, isValidReceiveSource, isValidUnitSource, tierSourceFor, assignSealedSources,
  RECEIVE_TYPES, UNIT_TYPES, isValidReceiveType, isValidUnitType,
};
```

- [ ] **Step 4: Run to verify pass**

Run: `cd server && node --test lib/stockSource.test.js`
Expected: PASS (old + new tests).

- [ ] **Step 5: Commit**

```bash
git add -- server/lib/stockSource.js server/lib/stockSource.test.js
git commit -m "feat(stock): add primary/supplier/working type validators"
```

---

### Task 4: Model fields — `StockUnit.type`, transaction `weights`/instrument

**Files:**
- Modify: `server/models/StockUnit.js`
- Modify: `server/models/StockTransaction.js`

**Interfaces:**
- Produces: `StockUnit.type` (enum incl. `''`), `StockTransaction.weights: [Number]`, `.instrumentId`, `.instrumentName`. `syncIndexes()` runs on boot (`ensureCollections()`), so no manual index step.

- [ ] **Step 1: Add `type` to StockUnit** — edit `server/models/StockUnit.js`, after the `source` line (line 19):

```js
  source: { type: String, enum: ['primary', 'supply', ''], default: '' }, // deprecated → type
  type: { type: String, enum: ['primary', 'supplier', 'working', ''], default: '', index: true },
```

- [ ] **Step 2: Add fields to StockTransaction** — edit `server/models/StockTransaction.js`, after the `volumeUnit` line (line 19):

```js
  volumeUnit: String,
  weights: { type: [Number], default: undefined },
  instrumentId: String,
  instrumentName: String,
```

- [ ] **Step 3: Verify models load (no DB needed)**

Run: `cd server && node -e "require('./models/StockUnit'); require('./models/StockTransaction'); console.log('ok')"`
Expected: prints `ok` (no schema error).

- [ ] **Step 4: Commit**

```bash
git add -- server/models/StockUnit.js server/models/StockTransaction.js
git commit -m "feat(stock): StockUnit.type + transaction weights/instrument fields"
```

---

## Phase B — Backend endpoints

### Task 5: `requisitionWeights.js` + extend `deduct-mg` (weights, instrument)

**Files:**
- Create: `server/lib/requisitionWeights.js`
- Test: `server/lib/requisitionWeights.test.js`
- Modify: `server/routes/stock.js` (the `deductMgFromUnit` helper + `POST /units/:qrId/deduct-mg`)

**Interfaces:**
- Consumes: `planDeductMg` (existing), `logTransaction` (existing).
- Produces: `sumWeights(weights)`, `validateWeights(weights, remainingMg)` (BE); `deduct-mg` now accepts `{ mg?, weights?, instrumentId?, instrumentName?, sampleId?, petitionNo?, note? }` and records `weights`/instrument on the transaction. `mg = weights ? sum(weights) : mg`.

- [ ] **Step 1: Write failing BE helper test**

```js
// server/lib/requisitionWeights.test.js
const test = require('node:test');
const assert = require('node:assert');
const { sumWeights, validateWeights } = require('./requisitionWeights');

test('sumWeights ignores non-numbers', () => {
  assert.strictEqual(Math.round(sumWeights([9.8, 10.3, 10.1]) * 10) / 10, 30.2);
  assert.strictEqual(sumWeights(['x', 5]), 5);
  assert.strictEqual(sumWeights([]), 0);
});

test('validateWeights: all > 0', () => {
  assert.strictEqual(validateWeights([0, 5], 100), 'จำนวน mg ไม่ถูกต้อง');
  assert.strictEqual(validateWeights([], 100), 'จำนวน mg ไม่ถูกต้อง');
});

test('validateWeights: not exceed remaining', () => {
  assert.strictEqual(validateWeights([60, 60], 100), 'ปริมาณคงเหลือไม่พอ');
});

test('validateWeights: ok → empty', () => {
  assert.strictEqual(validateWeights([10, 10, 10], 100), '');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd server && node --test lib/requisitionWeights.test.js`
Expected: FAIL — cannot find module `./requisitionWeights`.

- [ ] **Step 3: Implement the pure helper**

```js
// server/lib/requisitionWeights.js
'use strict';
// รวม/ตรวจ mg รายน้ำหนัก (mirror ของ FE src/lib/standardRequisition.ts)

function sumWeights(weights) {
  if (!Array.isArray(weights)) return 0;
  return weights.reduce((s, w) => {
    const n = Number(w);
    return Number.isFinite(n) ? s + n : s;
  }, 0);
}

// '' = ผ่าน; ไม่งั้นข้อความ error (คงคำเดียวกับ planDeductMg เพื่อ UX สม่ำเสมอ)
function validateWeights(weights, remainingMg) {
  if (!Array.isArray(weights) || weights.length === 0) return 'จำนวน mg ไม่ถูกต้อง';
  for (const w of weights) {
    const n = Number(w);
    if (!Number.isFinite(n) || n <= 0) return 'จำนวน mg ไม่ถูกต้อง';
  }
  if (sumWeights(weights) > Number(remainingMg)) return 'ปริมาณคงเหลือไม่พอ';
  return '';
}

module.exports = { sumWeights, validateWeights };
```

- [ ] **Step 4: Run to verify pass**

Run: `cd server && node --test lib/requisitionWeights.test.js`
Expected: PASS.

- [ ] **Step 5: Wire into the route** — edit `server/routes/stock.js`.

Add near the top imports (after line 9):

```js
const { sumWeights } = require('../lib/requisitionWeights');
```

Change `deductMgFromUnit(qrId, mg, meta = {})` signature to accept an options bag for weights/instrument. Replace the existing `deductMgFromUnit` function body's `logTransaction` call to also write `weights`/instrument, and add params. Concretely, update the function signature and log call:

```js
async function deductMgFromUnit(qrId, mg, meta = {}) {
  const amount = Number(mg);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('จำนวน mg ไม่ถูกต้อง');
  const unit = await StockUnit.findOne({ qrId });
  if (!unit) throw new Error('ไม่พบขวด (QR)');
  const plan = planDeductMg(unit, amount);
  if (!plan.ok) throw new Error(plan.reason);
  const updated = await StockUnit.findOneAndUpdate(
    { qrId, status: 'active', 'volume.remaining': { $gte: amount } },
    { $inc: { 'volume.remaining': -amount } },
    { new: true },
  );
  if (!updated) throw new Error('ปริมาณคงเหลือไม่พอ');
  const before = updated.volume.remaining + amount;
  if (updated.volume.remaining <= 0) { updated.status = 'empty'; await updated.save(); }
  const std = await StockStandard.findOne({ code: updated.itemCode });
  await logTransaction({
    itemType: 'standard',
    itemId: std ? std._id.toString() : updated.itemCode,
    itemCode: updated.itemCode,
    itemName: updated.itemName,
    action: 'deduct',
    unitId: updated._id.toString(),
    qrId,
    volumeDelta: -amount,
    volumeUnit: 'mg',
    unit: 'mg',
    beforeQty: before,
    afterQty: updated.volume.remaining,
    weights: meta.weights,
    instrumentId: meta.instrumentId,
    instrumentName: meta.instrumentName,
    sampleId: meta.sampleId,
    note: meta.note,
    userEmail: meta.userEmail,
    userName: meta.userName,
  });
  return { unit: updated, before, after: updated.volume.remaining };
}
```

Replace the `POST /units/:qrId/deduct-mg` handler (lines 264-273) with:

```js
// หัก mg จากขวดตรงๆ: { mg?, weights?[], instrumentId?, instrumentName?, sampleId?, petitionNo?, note? }
router.post('/units/:qrId/deduct-mg', async (req, res) => {
  try {
    const { mg, weights, instrumentId, instrumentName, sampleId, petitionNo, note } = req.body || {};
    const amount = Array.isArray(weights) && weights.length ? sumWeights(weights) : mg;
    const meta = {
      weights: Array.isArray(weights) ? weights.map(Number) : undefined,
      instrumentId, instrumentName, sampleId,
      note: [petitionNo, note].filter(Boolean).join(' · '),
      ...userMeta(req),
    };
    const result = await deductMgFromUnit(req.params.qrId, amount, meta);
    res.json(result.unit);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
```

- [ ] **Step 6: Smoke-check the route file parses**

Run: `cd server && node -e "require('./routes/stock'); console.log('route ok')"`
Expected: prints `route ok`.

- [ ] **Step 7: Commit**

```bash
git add -- server/lib/requisitionWeights.js server/lib/requisitionWeights.test.js server/routes/stock.js
git commit -m "feat(stock): deduct-mg accepts weights[] + instrument, records breakdown"
```

---

### Task 6: Receive uses `type`; discard uses `outcome`; drop `/withdraw`

**Files:**
- Modify: `server/routes/stock.js`

**Interfaces:**
- Produces: `POST /standards/:id/units/receive` accepts `type` (`primary|supplier|working`) instead of `source`; `POST /units/:qrId/discard` accepts `{ reason?, outcome? }` where `outcome: 'empty' | 'discard'` (default `discard`); `/units/:qrId/withdraw` and `createWorkingFromParent` removed.

- [ ] **Step 1: Receive — swap source→type.** In `POST /standards/:id/units/receive` (lines 314-363):
  - Change the import usage: replace `isValidReceiveSource(source)` guard with type.
  - Update destructure and the guard + the created unit:

```js
    const { lotNo = '', sizeMl, unit = 'ml', bottles, type, note } = req.body || {};
    const size = Number(sizeMl);
    if (!Number.isFinite(size) || size <= 0) return res.status(400).json({ error: 'ขนาด/ขวดไม่ถูกต้อง' });
    if (!Array.isArray(bottles) || bottles.length === 0) return res.status(400).json({ error: 'ต้องระบุอย่างน้อย 1 ขวด' });
    if (!isValidReceiveType(type)) return res.status(400).json({ error: 'ต้องเลือกประเภท (primary, supplier หรือ working)' });
```

  And in `StockUnit.create({...})` replace `kind: 'sealed', source,` with:

```js
        kind: 'sealed',
        type,
```

  Update the import line 7 to include the type validator:

```js
const { isValidReceiveType, isValidUnitType } = require('../lib/stockSource');
```

  (Remove now-unused `isValidReceiveSource, isValidUnitSource` from that import.)

- [ ] **Step 2: PATCH unit — allow `type`.** In `PATCH /units/:qrId` (lines 484-513), replace the `source` handling:

```js
    const { lotNo, exp, volume, type } = req.body || {};
    if (lotNo !== undefined) unit.lotNo = String(lotNo);
    if (exp !== undefined) unit.exp = exp ? new Date(exp) : null;
    if (type !== undefined && isValidUnitType(type)) unit.type = type;
```

- [ ] **Step 3: Discard — outcome empty|discard.** Replace `POST /units/:qrId/discard` (lines 438-481) with:

```js
// แจ้งสถานะขวด: POST /units/:qrId/discard { reason?, outcome? }
// outcome='empty' → หมด (status=empty); ไม่งั้น → discarded + เหตุผล
router.post('/units/:qrId/discard', async (req, res) => {
  try {
    const unit = await StockUnit.findOne({ qrId: req.params.qrId });
    if (!unit) return res.status(404).json({ error: 'ไม่พบขวด' });
    if (unit.status === 'discarded') return res.status(400).json({ error: 'ขวดนี้ถูกทิ้งแล้ว' });

    const reason = (req.body && req.body.reason) || '';
    const outcome = (req.body && req.body.outcome) === 'empty' ? 'empty' : 'discard';
    const std = await StockStandard.findOne({ code: unit.itemCode });

    if (outcome === 'empty') {
      unit.status = 'empty';
      await unit.save();
      await logTransaction({
        itemType: 'standard', itemId: std ? std._id.toString() : unit.itemCode,
        itemCode: unit.itemCode, itemName: unit.itemName, action: 'update',
        unitId: unit._id.toString(), qrId: unit.qrId, note: reason || 'แจ้งหมด', ...userMeta(req),
      });
      return res.json({ status: 'empty', qrId: unit.qrId });
    }

    unit.status = 'discarded';
    unit.discardedAt = new Date();
    unit.discardedBy = personOf(req);
    unit.discardReason = reason;
    await unit.save();
    await logTransaction({
      itemType: 'standard', itemId: std ? std._id.toString() : unit.itemCode,
      itemCode: unit.itemCode, itemName: unit.itemName, action: 'discard',
      unitId: unit._id.toString(), qrId: unit.qrId, note: reason, ...userMeta(req),
    });
    res.json({ status: 'discarded', qrId: unit.qrId });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
```

  Remove the now-unused import of `resolveCascadeRootId, selectDiscardTargets` (line 9) if nothing else uses them (grep `selectDiscardTargets` in `server/routes/stock.js` — if only this handler used it, drop the require).

- [ ] **Step 4: Remove `/withdraw` + `createWorkingFromParent`.**
  - Delete the whole `POST /units/:qrId/withdraw` handler (lines 366-433).
  - Delete the `createWorkingFromParent` function (lines 99-137) and the `computeWorkingLifecycle` require (line 8) if unused elsewhere in the file (grep to confirm).
  - Remove `router.createWorkingFromParent = createWorkingFromParent;` (bottom of file).

- [ ] **Step 5: Confirm no remaining references in this file**

Run: `cd server && grep -n "createWorkingFromParent\|/withdraw\|isValidReceiveSource\|selectDiscardTargets\|computeWorkingLifecycle" routes/stock.js`
Expected: no matches (empty output).

Run: `cd server && node -e "require('./routes/stock'); console.log('route ok')"`
Expected: `route ok`.

> **Caveat:** `createWorkingFromParent` / `deductMgFromUnit` may be imported by the lab-completion settle path. Run `grep -rn "createWorkingFromParent" server/` first — if another module imports it, keep the export and only remove the requisition/withdraw usage. Report the finding before deleting.

- [ ] **Step 6: Commit**

```bash
git add -- server/routes/stock.js
git commit -m "feat(stock): receive by type, discard outcome empty|discard, drop withdraw/working-split"
```

---

## Phase C — API layer (frontend)

### Task 7: `api.ts` + `types/stock.ts` — type field, deduct-mg, receive/discard

**Files:**
- Modify: `src/types/stock.ts`
- Modify: `src/lib/api.ts`

**Interfaces:**
- Produces:
  - `StockUnitItem.type?: 'primary'|'supplier'|'working'|''`
  - `StockTransactionItem.weights?: number[]`, `.instrumentId?`, `.instrumentName?`
  - `api.deductStockUnitMg(qrId, { weights?: number[]; mg?: number; instrumentId?; instrumentName?; sampleId?; petitionNo?; note? })`
  - `api.receiveStockUnits(id, { ...; type: 'primary'|'supplier'|'working' })` (was `source`)
  - `api.discardStockUnit(qrId, { reason?; outcome?: 'empty'|'discard' })` (was `cascade`)
  - `api.withdrawStockUnit` removed.

- [ ] **Step 1: Types.** In `src/types/stock.ts`:
  - Add to `StockUnitItem` (after `source?`): `type?: "primary" | "supplier" | "working" | "";`
  - Add to `StockTransactionItem` (after `volumeDelta?`): `weights?: number[]; instrumentId?: string; instrumentName?: string;`

- [ ] **Step 2: api.ts — receive/discard/deduct-mg.** In `src/lib/api.ts`:

Replace `receiveStockUnits` body `source` type:

```ts
  receiveStockUnits: (
    standardId: string,
    body: { lotNo?: string; sizeMl: number; unit?: string; type: "primary" | "supplier" | "working"; bottles: { exp?: string }[]; note?: string },
  ) =>
    request<StockUnitItem[]>(`/stock/standards/${standardId}/units/receive`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
```

Delete the `withdrawStockUnit` wrapper (lines ~342-346).

Replace `discardStockUnit`:

```ts
  discardStockUnit: (qrId: string, body: { reason?: string; outcome?: "empty" | "discard" }) =>
    request<{ status: string; qrId: string }>(`/stock/units/${encodeURIComponent(qrId)}/discard`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
```

Add a new `deductStockUnitMg` wrapper right after `getStockUnit`:

```ts
  deductStockUnitMg: (
    qrId: string,
    body: { weights?: number[]; mg?: number; instrumentId?: string; instrumentName?: string; sampleId?: string; petitionNo?: string; note?: string },
  ) =>
    request<StockUnitItem>(`/stock/units/${encodeURIComponent(qrId)}/deduct-mg`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -p tsconfig.app.json`
Expected: existing consumers of `receiveStockUnits`/`discardStockUnit`/`withdrawStockUnit` will now error (ReceiveBottlesDialog, PerformanceDropDialog, StandardRequisitionDialog, StockUnitScanPage, Stock.tsx). **These are fixed in Tasks 8–15.** Note the error list; do not fix here.

- [ ] **Step 4: Commit**

```bash
git add -- src/types/stock.ts src/lib/api.ts
git commit -m "feat(stock): api — type field, deductStockUnitMg, receive by type, discard outcome"
```

---

## Phase D — Requisition dialog rewrite

### Task 8: Rewrite `StandardRequisitionDialog` + pass instruments

**Files:**
- Rewrite: `src/components/lis/stock/StandardRequisitionDialog.tsx`
- Modify: `src/components/lis/stock/StockRequisitionButton.tsx`

**Interfaces:**
- Consumes: `api.getStandards`, `api.getStockUnits`, `api.deductStockUnitMg`; `isUsableBottle` (Task 1); `defaultWeightCount`, `sumWeights`, `validateWeights` (Task 2).
- Produces: `StandardRequisitionDialog({ instruments, onClose, onSaved })` where `instruments: { id: string; name: string; group?: string }[]`.

- [ ] **Step 1: Widen `instruments` type + pass through.** In `StockRequisitionButton.tsx`:
  - Change `Props.instruments` to `{ id: string; name: string; group?: string }[]`.
  - In the `<StandardRequisitionDialog ... />` render, pass `instruments={instruments}`.
  - In `StockDeduction.tsx` the `analysisInstruments` map currently drops `group`. Update it to keep group:

```ts
const analysisInstruments =
  getRoomCatalog(ANALYSIS_ROOM_SLUG)?.instruments.map((i) => ({ id: i.id, name: i.name, group: i.group })) ?? [];
```

- [ ] **Step 2: Rewrite the dialog.** Replace the entire file with:

```tsx
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronsUpDown, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { isUsableBottle, usableBottleCount } from "@/lib/stockStatus";
import { defaultWeightCount, sumWeights, validateWeights } from "@/lib/standardRequisition";
import { cn } from "@/lib/utils";
import type { StockUnitItem } from "@/types/stock";

type Instrument = { id: string; name: string; group?: string };
const TYPES = ["primary", "working", "supplier"] as const;
type BottleType = (typeof TYPES)[number];

interface Props {
  instruments: Instrument[];
  onClose: () => void;
  onSaved: () => void;
}

export default function StandardRequisitionDialog({ instruments, onClose, onSaved }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [instrumentId, setInstrumentId] = useState("");
  const [code, setCode] = useState("");
  const [pickOpen, setPickOpen] = useState(false);
  const [bottleType, setBottleType] = useState<BottleType>("primary");
  const [qrId, setQrId] = useState("");
  const [weights, setWeights] = useState<string[]>([""]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: standards = [] } = useQuery({ queryKey: ["stock", "standards"], queryFn: api.getStandards });
  const { data: allUnits = [] } = useQuery({ queryKey: ["stock", "units"], queryFn: () => api.getStockUnits() });

  const instrument = instruments.find((i) => i.id === instrumentId);

  // สารที่มีขวดใช้ได้จริง ≥ 1 (ทุก type) — "เปลี่ยน code เป็น stock ที่มี"
  const usableByCode = useMemo(() => {
    const m = new Map<string, StockUnitItem[]>();
    for (const u of allUnits) {
      if (!isUsableBottle(u)) continue;
      (m.get(u.itemCode) ?? m.set(u.itemCode, []).get(u.itemCode)!).push(u);
    }
    return m;
  }, [allUnits]);

  const inStock = useMemo(
    () => standards.filter((s) => (usableByCode.get(s.code)?.length ?? 0) > 0),
    [standards, usableByCode],
  );
  const standard = standards.find((s) => s.code === code) ?? null;

  const bottlesOfType = useMemo(
    () => (usableByCode.get(code) ?? []).filter((u) => (u.type || "primary") === bottleType)
      .sort((a, b) => (a.exp ? +new Date(a.exp) : Infinity) - (b.exp ? +new Date(b.exp) : Infinity)),
    [usableByCode, code, bottleType],
  );
  const typeCounts = useMemo(() => {
    const c: Record<BottleType, number> = { primary: 0, working: 0, supplier: 0 };
    for (const u of usableByCode.get(code) ?? []) c[((u.type || "primary") as BottleType)] += 1;
    return c;
  }, [usableByCode, code]);

  const bottle = bottlesOfType.find((b) => b.qrId === qrId) ?? bottlesOfType[0] ?? null;
  const remainingMg = bottle?.volume?.remaining ?? 0;
  const nums = weights.map((w) => Number(w));
  const total = sumWeights(nums);
  const weightError = bottle ? validateWeights(nums, remainingMg) : "";
  const canSave = !!(instrumentId && bottle && !weightError && user?.name);

  // เปลี่ยนเครื่อง → ตั้งจำนวนช่องน้ำหนักตาม default (gc=3/hplc=1)
  const pickInstrument = (id: string) => {
    setInstrumentId(id);
    const g = instruments.find((i) => i.id === id)?.group;
    setWeights(Array.from({ length: defaultWeightCount(g) }, () => ""));
  };
  const pickStandard = (c: string) => {
    setCode(c); setPickOpen(false); setQrId("");
    const counts = { primary: 0, working: 0, supplier: 0 } as Record<BottleType, number>;
    for (const u of usableByCode.get(c) ?? []) counts[((u.type || "primary") as BottleType)] += 1;
    const first = TYPES.find((t) => counts[t] > 0) ?? "primary";
    setBottleType(first);
  };
  const setWeightAt = (i: number, v: string) => setWeights((prev) => { const x = [...prev]; x[i] = v; return x; });
  const setCount = (n: number) => setWeights((prev) => {
    const x = prev.slice(0, Math.max(1, n));
    while (x.length < n) x.push("");
    return x;
  });

  const submit = async () => {
    if (!bottle) return;
    setBusy(true);
    try {
      await api.deductStockUnitMg(bottle.qrId, {
        weights: nums,
        instrumentId,
        instrumentName: instrument?.name,
        note: note || undefined,
      });
      toast.success(`เบิก ${standard?.name ?? "standard"} ${nums.length} น้ำหนัก (${total} mg)`);
      qc.invalidateQueries({ queryKey: ["stock", "units"] });
      qc.invalidateQueries({ queryKey: ["stock", "transactions"] });
      onSaved(); onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>เบิก Standard</DialogTitle>
          <DialogDescription>เลือกเครื่อง สาร ประเภทขวด แล้วกรอก mg แต่ละน้ำหนัก</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* เครื่อง */}
          <div>
            <Label className="mb-1.5 block">เครื่อง</Label>
            <div className="flex flex-wrap gap-1.5">
              {instruments.map((i) => (
                <Button key={i.id} type="button" size="sm" variant={instrumentId === i.id ? "default" : "outline"}
                  className="h-8 text-xs" onClick={() => pickInstrument(i.id)}>{i.name}</Button>
              ))}
            </div>
          </div>

          {/* สาร (เฉพาะที่มีขวด) */}
          <div>
            <Label className="mb-1.5 block">Standard (มีของในสต็อก)</Label>
            <Popover open={pickOpen} onOpenChange={setPickOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" role="combobox" className="w-full justify-between font-normal">
                  <span className="truncate">{standard ? `${standard.name} (${standard.code})` : "เลือก standard..."}</span>
                  <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <Command>
                  <CommandInput placeholder="ค้นหาชื่อ/code" />
                  <CommandList>
                    <CommandEmpty>ไม่มีสารที่มีขวดใช้ได้</CommandEmpty>
                    {inStock.map((s) => (
                      <CommandItem key={s.code} value={`${s.name} ${s.code}`} onSelect={() => pickStandard(s.code)}>
                        <Check className={cn("mr-2 h-4 w-4", code === s.code ? "opacity-100" : "opacity-0")} />
                        <span className="flex-1">{s.name}</span>
                        <span className="text-xs text-muted-foreground">{usableByCode.get(s.code)?.length ?? 0} ขวด</span>
                      </CommandItem>
                    ))}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {code && (
            <>
              {/* ประเภทขวด */}
              <div>
                <Label className="mb-1.5 block">ประเภทขวด</Label>
                <div className="flex gap-1.5">
                  {TYPES.map((t) => (
                    <Button key={t} type="button" size="sm" disabled={typeCounts[t] === 0}
                      variant={bottleType === t ? "default" : "outline"} className="h-8 text-xs"
                      onClick={() => { setBottleType(t); setQrId(""); }}>
                      {t} ({typeCounts[t]})
                    </Button>
                  ))}
                </div>
              </div>

              {/* ขวด */}
              <div>
                <Label className="mb-1.5 block">ขวด (EXP ใกล้สุดก่อน)</Label>
                {bottlesOfType.length === 0 ? (
                  <p className="text-sm text-muted-foreground">ไม่มีขวดประเภทนี้</p>
                ) : (
                  <div className="space-y-1.5">
                    {bottlesOfType.map((u) => (
                      <label key={u.qrId} className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm",
                        (bottle?.qrId === u.qrId) ? "border-primary bg-primary/5" : "hover:bg-muted/50")}>
                        <input type="radio" name="bottle" checked={bottle?.qrId === u.qrId} onChange={() => setQrId(u.qrId)} />
                        <span className="text-xs text-muted-foreground">
                          Lot {u.lotNo || "-"} · เหลือ {u.volume?.remaining} {u.volume?.unit} · EXP {u.exp ? new Date(u.exp).toLocaleDateString("th-TH") : "-"}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* จำนวนน้ำหนัก + mg */}
              {bottle && (
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <Label>จำนวนน้ำหนัก</Label>
                    <Input type="number" min={1} value={weights.length} className="h-8 w-20"
                      onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))} />
                  </div>
                  <div className="space-y-1.5">
                    {weights.map((w, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-16 text-xs text-muted-foreground">น้ำหนัก {i + 1}</span>
                        <Input type="number" step="0.0001" min="0" placeholder="mg" value={w}
                          onChange={(e) => setWeightAt(i, e.target.value)} />
                      </div>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    รวม {total} mg · คงเหลือหลังหัก {Math.max(0, remainingMg - total)} mg
                  </p>
                  {weightError && <p className="mt-1 text-sm text-destructive">{weightError}</p>}
                </div>
              )}

              <div>
                <Label className="mb-1.5 block">หมายเหตุ</Label>
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button type="button" disabled={!canSave || busy} onClick={submit}>
            {busy ? "กำลังบันทึก..." : "เบิก"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Type-check + lint**

Run: `npx tsc -p tsconfig.app.json && npm run lint`
Expected: `StandardRequisitionDialog` + `StockRequisitionButton` clean. (Remaining errors only in ReceiveBottlesDialog / PerformanceDropDialog / StockUnitScanPage / Stock.tsx — fixed later.)

- [ ] **Step 4: Manual smoke (dev server running)**

Open `/LIS/stock-deduction` → เบิก stock → Standard. Verify: pick GC → 3 weight rows; HPLC → 1 row; standard list shows only in-stock; type buttons disabled when count 0; submit deducts mg (check remaining drops on Stock page).

- [ ] **Step 5: Commit**

```bash
git add -- src/components/lis/stock/StandardRequisitionDialog.tsx src/components/lis/stock/StockRequisitionButton.tsx src/pages/StockDeduction.tsx
git commit -m "feat(stock): rewrite Standard requisition — instrument→type→bottle→mg per weight"
```

---

## Phase E — Status wiring + receive/report UI

### Task 9: `stockUnit.ts` — drop kind-based summary

**Files:**
- Modify: `src/lib/stockUnit.ts`
- Modify: `src/lib/stockUnit.test.ts`

**Interfaces:**
- Produces: `visibleBottles(units, now?)` — non-discarded bottles sorted by receivedDate/createdAt asc (flat, replaces `buildUnitTree` for panels). `summarizeUnits` removed (callers moved to `summarizeStandard` in Task 10/13). Working helpers (`workingUsability`, `computeWorkingLifecycle`, `pickFefoSealed`, `buildUnitTree`, `addShelfLife`, `computeWorkingExp`, `workingExpForWithdraw`, `nextMidnight`, `addInterval`) removed **only if unused** — verify by grep.

- [ ] **Step 1: Add `visibleBottles` + its test.** Append to `src/lib/stockUnit.test.ts` imports and add:

```ts
import { visibleBottles } from "./stockUnit";

describe("visibleBottles", () => {
  it("drops discarded, keeps order by receivedDate", () => {
    const rows = visibleBottles([
      { _id: "b", status: "active", receivedDate: "2026-02-01" } as any,
      { _id: "a", status: "active", receivedDate: "2026-01-01" } as any,
      { _id: "d", status: "discarded", receivedDate: "2026-01-15" } as any,
    ]);
    expect(rows.map((u) => u._id)).toEqual(["a", "b"]);
  });
});
```

Add to `src/lib/stockUnit.ts`:

```ts
/** ขวดที่ยังไม่ทิ้ง เรียงตามวันรับเข้า (flat) — ใช้แทน buildUnitTree หลังเลิก parent-child */
export function visibleBottles(units: StockUnitItem[], now: Date = new Date()): StockUnitItem[] {
  const timeOf = (u: StockUnitItem) => new Date(u.receivedDate || u.createdAt || 0).getTime();
  return units
    .filter((u) => unitDerivedStatus(u, now) !== "discarded")
    .sort((a, b) => timeOf(a) - timeOf(b));
}
```

- [ ] **Step 2: Run test**

Run: `npm run test -- src/lib/stockUnit.test.ts`
Expected: PASS (new test green; existing still green — no removals yet).

- [ ] **Step 3: Commit**

```bash
git add -- src/lib/stockUnit.ts src/lib/stockUnit.test.ts
git commit -m "feat(stock): visibleBottles flat helper (post parent-child)"
```

> Removal of dead working helpers happens in Task 15 after all consumers are migrated.

---

### Task 10: `Stock.tsx` — status via `stockStatus.ts`

**Files:**
- Modify: `src/pages/Stock.tsx`

**Interfaces:**
- Consumes: `summarizeStandard`, `standardLevel`, `solventLevel`, `glasswareLevel`, `usableBottleCount` (Task 1).

- [ ] **Step 1: Swap standards summary.** Replace the import `import { summarizeUnits } from "@/lib/stockUnit";` (line 23) with:

```ts
import { summarizeStandard, standardLevel, solventLevel, glasswareLevel } from "@/lib/stockStatus";
```

- [ ] **Step 2: Standards tab.** Replace every `summarizeUnits(unitsByCode.get(...) ?? [], ...)` call with `summarizeStandard(...)`, and change the derived fields:
  - `sumOf` (line 90): `const sumOf = (s) => summarizeStandard(unitsByCode.get(s.code) ?? [], new Date(now));`
  - Status filter (lines 96-104): use `const sum = summarizeStandard(...)`, `const usable = sum.usable;` then `standardLevel(usable)`:

```ts
      const sum = summarizeStandard(unitsByCode.get(s.code) ?? [], new Date(now));
      const level = standardLevel(sum.usable);
      const eOk = sum.expired === 0 && sum.expiringSoon === 0;
      if (statusFilter === "ok") return level === "ok" && eOk;
      if (statusFilter === "out") return level === "out";
      if (statusFilter === "low") return level === "low";
      if (statusFilter === "expired") return sum.expired > 0;
      if (statusFilter === "soon") return sum.expiringSoon > 0;
```

  - `lowList` (line 109): `const lowList = data.filter(s => standardLevel(summarizeStandard(unitsByCode.get(s.code) ?? []).usable) === "low");`
  - In the alert + badges (lines 131, 204-224) replace `sum.sealed + sum.working` / `totalActive` with `sum.usable`, and the "ปกติ" badge condition `sum.sealed + sum.working > 0 && ...` with `sum.usable > 0 && sum.expired === 0 && sum.expiringSoon === 0`.
  - Add a **type breakdown** in the standards row using `usableByCode` counts (optional but part of spec §4-step-2 UX): show `primary/working/supplier` counts. Minimal: append to the row a small muted line computed from `unitsByCode.get(item.code)` filtered by `isUsableBottle` grouped by `type`.

- [ ] **Step 3: Solvent tab.** Replace `LOW_SOL_QTY` usage:
  - Delete `const LOW_SOL_QTY = 3;` (line 42).
  - `lowList` (line 284): `const lowList = data.filter(s => solventLevel(s.qty) === "low");`
  - Badge (line 338): `className={solventLevel(item.qty) === "ok" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`

- [ ] **Step 4: Glassware tab.** Replace `LOW_GLASS_QTY` usage:
  - Delete `const LOW_GLASS_QTY = 5;` (line 43).
  - Badge (line 471): `className={glasswareLevel(item.qty) === "out" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`
  - Glassware has no low-list alert — if one references `LOW_GLASS_QTY`, drop it (out-only).

- [ ] **Step 5: Keep `LOW_STD_QTY`?** It's now unused (replaced by `standardLevel`). Delete `const LOW_STD_QTY = 1;` (line 41) and any remaining reference.

- [ ] **Step 6: Type-check + lint + manual**

Run: `npx tsc -p tsconfig.app.json && npm run lint`
Expected: Stock.tsx clean (WithdrawDialog import still errors — fixed Task 15; leave it).
Manual: solvent qty=1 shows near-empty; glassware qty=1 shows normal (not near-empty); standard with 1 usable bottle shows near-empty.

- [ ] **Step 7: Commit**

```bash
git add -- src/pages/Stock.tsx
git commit -m "feat(stock): Stock page status via stockStatus (solvent low=1, glassware out-only)"
```

---

### Task 11: Receive dialogs — 3-type picker

**Files:**
- Modify: `src/components/lis/stock/ReceiveBottlesDialog.tsx`
- Modify: `src/components/lis/stock/ReceiveCart.tsx`

**Interfaces:**
- Consumes: `api.receiveStockUnits({ ..., type })` (Task 7).

- [ ] **Step 1: ReceiveBottlesDialog.** 
  - Change state: `const [type, setType] = useState<"primary" | "supplier" | "working">("primary");` (replace `source`).
  - Replace the "ที่มา" block (lines 86-94) with a 3-button "ประเภท" picker:

```tsx
            <div>
              <Label>ประเภท</Label>
              <div className="flex gap-2 mt-1">
                {(["primary", "working", "supplier"] as const).map((t) => (
                  <Button key={t} type="button" variant={type === t ? "default" : "outline"} size="sm"
                    onClick={() => setType(t)}>{t}</Button>
                ))}
              </div>
            </div>
```

  - In `api.receiveStockUnits(...)` (line 63) replace `source,` with `type,`.

- [ ] **Step 2: ReceiveCart.** Grep for `source` in `ReceiveCart.tsx`; apply the same rename (`source`→`type`, values `primary|supplier|working`, default `primary`) wherever it builds the receive payload and renders the picker. Show the code snippet you change in the commit.

- [ ] **Step 3: Type-check + lint + manual**

Run: `npx tsc -p tsconfig.app.json && npm run lint`
Manual: receive a bottle as `working` → appears with type=working on the standard's bottle list.

- [ ] **Step 4: Commit**

```bash
git add -- src/components/lis/stock/ReceiveBottlesDialog.tsx src/components/lis/stock/ReceiveCart.tsx
git commit -m "feat(stock): receive bottles pick type (primary/working/supplier)"
```

---

### Task 12: `PerformanceDropDialog` — per-bottle empty/discard

**Files:**
- Modify: `src/components/lis/stock/PerformanceDropDialog.tsx`

**Interfaces:**
- Consumes: `api.discardStockUnit(qrId, { reason?, outcome })` (Task 7).

- [ ] **Step 1: Replace scope with outcome.** Change state:

```tsx
  const [outcome, setOutcome] = useState<"empty" | "discard">("discard");
```

  Remove `scope`/`isWorking` usage. Replace the submit call:

```tsx
      const res = await api.discardStockUnit(qrId, { reason, outcome });
      toast.success(outcome === "empty" ? "แจ้งหมดแล้ว" : "แจ้งปัญหา/ทิ้งขวดแล้ว");
```

  When `outcome === "empty"`, reason is optional (hide the reason Select or keep it optional). Replace the "ขอบเขต" radio block (lines 106-126) with an "การแจ้ง" radio:

```tsx
            <div>
              <Label className="mb-1.5 block">การแจ้ง</Label>
              <div className="space-y-2">
                {([
                  { v: "empty", label: "แจ้งหมด (ขวดนี้ใช้หมดแล้ว)" },
                  { v: "discard", label: "แจ้งปัญหา / ทิ้งขวด (ระบุเหตุผล)" },
                ] as const).map((opt) => (
                  <label key={opt.v} className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm transition-colors",
                    outcome === opt.v ? "border-primary bg-primary/5" : "hover:bg-muted/50")}>
                    <input type="radio" name="outcome" checked={outcome === opt.v} onChange={() => setOutcome(opt.v)} />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
```

  Gate the reason Select to `outcome === "discard"`. Update the title/button copy to "แจ้งสถานะขวด" / "ยืนยัน".

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc -p tsconfig.app.json && npm run lint`
Expected: PerformanceDropDialog clean.

- [ ] **Step 3: Commit**

```bash
git add -- src/components/lis/stock/PerformanceDropDialog.tsx
git commit -m "feat(stock): report bottle status — empty vs discard(problem) per bottle"
```

---

### Task 13: `StandardUnitsPanel` — flat list + type + report menu

**Files:**
- Modify: `src/components/lis/stock/StandardUnitsPanel.tsx`

**Interfaces:**
- Consumes: `visibleBottles` (Task 9), `PerformanceDropDialog` (Task 12).

- [ ] **Step 1: Flatten + type column + report action.**
  - Replace import `import { unitDerivedStatus, buildUnitTree } from "@/lib/stockUnit";` with `import { unitDerivedStatus, visibleBottles } from "@/lib/stockUnit";`.
  - Add `import PerformanceDropDialog from "./PerformanceDropDialog";` and state `const [reportQr, setReportQr] = useState<string | null>(null);`.
  - Replace `const rows = buildUnitTree(data);` with `const rows = visibleBottles(data);`.
  - Remove the expand/collapse tree machinery (`expanded`, `toggle`, chevrons, `row.depth`, `row.rootId`, child hiding). Render one `<TableRow>` per bottle with a running index `i + 1`.
  - Replace the "ชนิด" cell (`u.kind === "working" ? ...`) and "ที่มา" cell (`u.source ...`) with a single **ประเภท** cell: `<Badge variant="outline">{u.type || "primary"}</Badge>`.
  - In the actions cell add a report button (only when `st !== "discarded" && st !== "empty"`):

```tsx
                      <Button type="button" size="icon" variant="ghost" title="แจ้งหมด/ปัญหา" onClick={() => setReportQr(u.qrId)}>
                        <TriangleAlert className="w-4 h-4" />
                      </Button>
```

    (import `TriangleAlert` from `lucide-react`.)
  - Before the closing `</div>`, render: `{reportQr && <PerformanceDropDialog qrId={reportQr} onClose={() => setReportQr(null)} onSaved={() => { setReportQr(null); refresh(); }} />}`.
  - Update the table header: drop "ชนิด"/"ที่มา", add "ประเภท" (colSpan on loading/empty rows → 7).

- [ ] **Step 2: Type-check + lint + manual**

Run: `npx tsc -p tsconfig.app.json && npm run lint`
Manual: open a standard's bottle drawer → flat list, type badge, ⚠ opens report → "แจ้งหมด" sets empty, "แจ้งปัญหา" discards.

- [ ] **Step 3: Commit**

```bash
git add -- src/components/lis/stock/StandardUnitsPanel.tsx
git commit -m "feat(stock): bottle panel — flat list, type badge, report empty/problem"
```

---

## Phase F — Removals

### Task 14: StockDeduction — history-only (drop working tab)

**Files:**
- Modify: `src/pages/StockDeduction.tsx`

- [ ] **Step 1: Remove the working tab.**
  - Delete `import StandardWorkingPanel from "@/components/lis/stock/StandardWorkingPanel";`.
  - Remove `<TabsTrigger value="working">Standard ใช้งานอยู่</TabsTrigger>` and the `<TabsContent value="working">…</TabsContent>` block.
  - Since only "history" remains, simplify: drop the `Tabs` wrapper and render the history filter + `DataTable` directly (keep `tab` state removal). Keep the "Tier" column in history (legacy transactions still have it).

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc -p tsconfig.app.json && npm run lint`
Expected: StockDeduction clean.

- [ ] **Step 3: Commit**

```bash
git add -- src/pages/StockDeduction.tsx
git commit -m "refactor(stock): stock-deduction history-only (remove 'ใช้งานอยู่' tab)"
```

---

### Task 15: Remove withdraw flow + dead working helpers

**Files:**
- Modify: `src/pages/StockUnitScanPage.tsx`
- Modify: `src/pages/Stock.tsx`
- Modify: `src/lib/stockUnit.ts`, `src/lib/stockUnit.test.ts`
- Delete: `WithdrawDialog.tsx`, `StandardWorkingPanel.tsx`, `StandardUnitList.tsx`, `StandardDailyRow.tsx`, `StandardUnitDetailDialog.tsx`, `src/lib/standardStatus.ts` (+ its test if present)

- [ ] **Step 1: Confirm the removal set has no other consumers.**

Run: `npx tsc -p tsconfig.app.json` after each delete, OR grep first:
```bash
grep -rn "WithdrawDialog\|StandardWorkingPanel\|StandardUnitList\|StandardDailyRow\|StandardUnitDetailDialog\|standardStatus\|workingUsability\|computeWorkingLifecycle\|buildUnitTree\|pickFefoSealed\|summarizeUnits\|standardStatusMeta\|splitTimeLabel\|activeWorkingUnits\|todayWorkingUnits" src/
```
Expected consumers to fix: `StockUnitScanPage.tsx`, `Stock.tsx` (WithdrawDialog), and the files being deleted (mutually referencing). Anything else → migrate it before deleting.

- [ ] **Step 2: StockUnitScanPage — drop withdraw.**
  - Remove `import WithdrawDialog ...` and `import { unitDerivedStatus } from "@/lib/stockUnit";` stays.
  - Change `useState<"withdraw" | "discard" | null>` → `useState<"discard" | null>`.
  - Remove the `unit.kind === "sealed" && st === "active" && <Button ...แบ่งใช้...>` button and the `{action === "withdraw" && <WithdrawDialog .../>}` render.
  - Replace the "คงคลัง/working" badge (`unit.kind === "working" ? ...`) with `<Badge variant="outline">{unit.type || "primary"}</Badge>`.

- [ ] **Step 3: Stock.tsx — drop scanned withdraw.**
  - Remove `import WithdrawDialog ...` (line 33) and the `<WithdrawDialog qrId={scannedQr} .../>` render (line ~1048). If a QR scan opened `WithdrawDialog`, route the scan to open the bottle drawer or a discard/report path instead; if the scanned-withdraw entry point is now dead, remove the `scannedQr` withdraw branch and keep only navigation to the unit. Show the exact removed lines in the commit.

- [ ] **Step 4: Delete the files.**

```bash
git rm -- \
  src/components/lis/stock/WithdrawDialog.tsx \
  src/components/lis/stock/StandardWorkingPanel.tsx \
  src/components/lis/stock/StandardUnitList.tsx \
  src/components/lis/stock/StandardDailyRow.tsx \
  src/components/lis/stock/StandardUnitDetailDialog.tsx \
  src/lib/standardStatus.ts
```
(If `src/lib/standardStatus.test.ts` exists, `git rm` it too.)

- [ ] **Step 5: Prune dead helpers in `stockUnit.ts`.**
  - Remove exports no longer referenced (verify each with grep from Step 1 after deletions): `workingUsability`, `computeWorkingLifecycle`, `buildUnitTree`, `pickFefoSealed`, `summarizeUnits`, `computeWorkingExp`, `workingExpForWithdraw`, `nextMidnight`, `addShelfLife`, `addInterval`, `WorkingUsability`/`OpenShelfLife`/`UnitsSummary`/`UnitTreeRow` types if unused.
  - Keep: `parseScannedQrId`, `unitDerivedStatus`, `visibleBottles`, `UnitDerivedStatus`.
  - In `src/lib/stockUnit.test.ts` remove the `describe` blocks for the deleted helpers (`summarizeUnits`, `buildUnitTree`, `computeWorkingLifecycle`, `workingUsability`, `pickFefoSealed`), keep `visibleBottles` + any surviving.

- [ ] **Step 6: Full verify.**

Run: `npx tsc -p tsconfig.app.json && npm run lint && npm run test`
Expected: 0 type errors, lint clean, all vitest green.

Run: `cd server && grep -rn "createWorkingFromParent\|/withdraw" routes/ && echo "CHECK" || echo "clean"`
Expected: `clean` (withdraw already removed in Task 6).

- [ ] **Step 7: Commit**

```bash
git add -- src/pages/StockUnitScanPage.tsx src/pages/Stock.tsx src/lib/stockUnit.ts src/lib/stockUnit.test.ts
git commit -m "refactor(stock): remove withdraw flow + dead working/parent-child helpers"
```

---

## Phase G — Migration

### Task 16: `source`→`type` migration script (user runs on prod)

**Files:**
- Create: `server/scripts/migrate-stockunits-source-to-type.js`

**Interfaces:**
- Consumes: `StockUnit` model, `MONGODB_URI` from `server/.env`.
- Behavior: dry-run by default; `--commit` writes. Maps `source: 'primary'→type:'primary'`, `'supply'→'supplier'`; blank/other `source` and legacy `kind:'working'` bottles → `type:'primary'` with a WARN listing each so the user can correct. Idempotent (skips units that already have a non-empty `type`).

- [ ] **Step 1: Verify live data shape first (read-only).** Before writing, inspect the real collection (user runs locally, or you run against a read replica if permitted):

```bash
cd server && node -e "require('dotenv').config(); const m=require('mongoose'); const U=require('./models/StockUnit'); m.connect(process.env.MONGODB_URI).then(async()=>{ console.log('total', await U.countDocuments()); console.log('by source', await U.aggregate([{$group:{_id:'$source',n:{$sum:1}}}])); console.log('by kind', await U.aggregate([{$group:{_id:'$kind',n:{$sum:1}}}])); console.log('already typed', await U.countDocuments({type:{$nin:['',null]}})); await m.disconnect(); });"
```
Record counts in the commit message. If there are many `kind:'working'` bottles, decide with the user whether to collapse (default) or archive.

- [ ] **Step 2: Write the script** (mirror the dry-run/`--commit` pattern of `server/scripts/migrate-standard-tiers-to-units.js`):

```js
// server/scripts/migrate-stockunits-source-to-type.js
// Map StockUnit.source (primary/supply) → StockUnit.type (primary/supplier/working).
// Dry-run by default; pass --commit to write. Idempotent (skips units already typed).
require('dotenv').config();
const mongoose = require('mongoose');
const StockUnit = require('../models/StockUnit');

const COMMIT = process.argv.includes('--commit');
const SRC_TO_TYPE = { primary: 'primary', supply: 'supplier' };

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/LIS-DB');
  const units = await StockUnit.find({ $or: [{ type: { $in: ['', null] } }, { type: { $exists: false } }] });
  let planned = 0;
  const warns = [];
  for (const u of units) {
    let type = SRC_TO_TYPE[u.source];
    if (!type) { type = 'primary'; warns.push(`${u.qrId} (${u.itemCode}) source='${u.source||''}' kind='${u.kind||''}' → primary [ตรวจสอบ]`); }
    planned++;
    if (COMMIT) { u.type = type; await u.save(); }
  }
  console.log(`${COMMIT ? 'COMMITTED' : 'DRY-RUN'}: ${planned} units → type`);
  if (warns.length) { console.log(`WARN (${warns.length}) ต้องยืนยันประเภท:`); warns.forEach((w) => console.log('  - ' + w)); }
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Commit the script (do NOT run against prod yourself).**

```bash
git add -- server/scripts/migrate-stockunits-source-to-type.js
git commit -m "chore(stock): migration script source→type (dry-run/--commit)"
```

- [ ] **Step 4: Hand-off note to user.** In the completion summary, instruct:
  1. `cd server && node scripts/migrate-stockunits-source-to-type.js` (dry-run) — review WARN list, fix any bottle's type by hand if needed.
  2. `node scripts/migrate-stockunits-source-to-type.js --commit`
  3. `npm run seed:export` and commit `server/seed-data/` (recoverable backup).

---

## Self-Review (author checklist — done)

**Spec coverage:**
- §2 model (type, deprecate kind) → Tasks 4, 6, 7. Tier read-only → untouched (no task = correct).
- §3 near-empty (std/solvent/glassware) → Task 1 + Task 10.
- §4 requisition (instrument→standard-with-stock→type→bottle→N weights→mg) → Tasks 2, 5, 8. `usagePerUseMg` as placeholder only → dialog uses `placeholder="mg"` (no prefill).
- §5 report empty/problem per bottle → Tasks 6, 12, 13.
- §6 removals (working tab, withdraw flow) → Tasks 14, 15.
- §7 migration → Task 16.

**Placeholder scan:** No TBD/TODO. The only deferred judgment (kind:working collapse) is gated on a real data check (Task 16 Step 1) with an explicit default — acceptable.

**Type consistency:** `type` values `primary|supplier|working` everywhere; `deductStockUnitMg` signature identical in Tasks 7 & 8; `outcome: 'empty'|'discard'` identical in Tasks 6, 7, 12; `summarizeStandard`/`standardLevel` names consistent Tasks 1 & 10; `visibleBottles` consistent Tasks 9 & 13.

**Known cross-task compile windows:** Task 7 intentionally leaves consumers broken until Tasks 8–15. Each task states which errors are expected and deferred. Final green gate is Task 15 Step 6.
