# Standard Weighing in Lab Testing + Auto Stock Deduction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มส่วน "ชั่ง standard" ในหน้า `/lab-testing/:id` ที่ขับด้วย Standard Config, ให้กรอกน้ำหนักที่ชั่ง, แล้วหัก mg จากขวด StockUnit ที่สแกน QR อัตโนมัติตอนกด "บันทึกผล".

**Architecture:** Client resolver (pure, unit-tested) สร้าง "weigh task" ต่อ (สาร × เครื่อง GC/HPLC) จาก `petition.assignedMachines` + `parseSubstances` + Standard Config. UI การ์ดต่อ task ให้สแกนขวด + กรอกน้ำหนัก, autosave ลง model ใหม่ `StandardWeighing`. ตอนบันทึกผล (`POST /petitions/:id/complete` side=lab) server เป็นด่านตัดสิน: validate ครบ → หัก mg จากขวด (atomic) → สร้าง working unit → ปั๊ม `deductedAt` (idempotent) → ถึงจะ set `labCompletedAt`.

**Tech Stack:** React 18 + TS + Vite + TanStack Query + Vitest (frontend); Express 4 + Mongoose 8 (backend); `html5-qrcode` (มี `StockQrScanner` อยู่แล้ว).

## Global Constraints

- **หน่วยหัก = มิลลิกรัม (mg)**; หักจาก `StockUnit.volume.remaining` ของขวดที่สแกน. หน่วยขวดต้องเป็น `mg`.
- **จังหวะหัก = ตอนบันทึกผลเท่านั้น** (`POST /petitions/:id/complete`, `side='lab'`), server-authoritative. Autosave (`PUT`) ไม่หัก.
- **Idempotent**: `deductedAt != null` = หักแล้ว ห้ามหักซ้ำ.
- **บล็อกการบันทึกผล** ถ้ามี weigh task ที่: กรอกไม่ครบ (fresh: masses ครบ N + สแกนขวดแล้ว / working: เลือก working unit แล้ว), resolve times ไม่ได้, ขวดหมดอายุ/discarded/empty, หรือ `remaining < Σmasses`.
- **ขอบเขต lab-testing เท่านั้น** — ห้ามแตะ flow QC.
- **instrument ที่รองรับ = machine-backed methods (GC/HPLC)** เท่านั้น. สารที่ไม่ได้ assign เครื่อง GC/HPLC → ไม่มีการ์ด, ไม่บล็อก.
- Backend mount route ทั้ง `/api/*` และ `/LIS/api/*` ผ่าน `mountApi()` — เพิ่ม route ใหม่ผ่าน `mountApi` เท่านั้น.
- ทุก model ใหม่ใช้ `softDeletePlugin`.
- ห้ามรัน `npm run build`; type-check ด้วย `npx tsc -p tsconfig.app.json --noEmit`; test ด้วย `npm run test`.
- commit ด้วย explicit pathspec (มี process อื่น commit แทรกในรีโปได้).

## Implementation decisions (v1 — ยึดตาม spec + ปรับรายละเอียดให้ implement ได้)

1. **instrument มาจาก `assignedMachines`** (classify จากชื่อเครื่อง GC/HPLC) ไม่ re-resolve จาก SimpleMethod ซ้ำ — เร็วและพอสำหรับเคสจริง (สารเดี่ยว 1 เครื่อง).
2. **weigh task ราย (commonName × substance token × instrument) ระดับ petition** (ชั่ง 1 ครั้งต่อสารต่อเครื่อง ไม่ซ้ำตาม batch). `substance` = `parseSubstances(commonName)[i]`.
3. **required-set มาจาก client** (ส่งใน complete request); server enforce การหัก mg แบบ atomic เป็น hard guarantee. เป็น simplification ที่ยอมรับได้สำหรับ internal tool.
4. **"ใช้ working เดิม" ไม่หัก solid** ใน v1; แค่ผูก `workingQrId` ที่เลือก.
5. **StockStandard pre-match ไม่บังคับ** — การจับคู่จริงมาจาก QR ที่สแกน (StockUnit.itemName เทียบ substance เพื่อเตือน).

---

## Task 1: Client resolver `standardWeighing.ts` (pure + tests)

**Files:**
- Create: `src/lib/standardWeighing.ts`
- Test: `src/lib/standardWeighing.test.ts`

**Interfaces:**
- Consumes: `parseSubstances` จาก `@/lib/substances`; `StandardConfigDoc` จาก `@/lib/standardConfig`; `Petition` จาก `@/types/petition.types`.
- Produces:
  - `type WeighTask = { key: string; sampleId: string; commonName: string; substance: string; instrument: 'GC' | 'HPLC'; times: number | null }`
  - `classifyInstrument(machineName: string): 'GC' | 'HPLC' | null`
  - `resolveTimes(instrument: string, substance: string, configs: StandardConfigDoc[]): number | null`
  - `buildWeighTasks(petition: Petition, configs: StandardConfigDoc[]): WeighTask[]`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/standardWeighing.test.ts
import { describe, it, expect } from "vitest";
import { classifyInstrument, resolveTimes, buildWeighTasks } from "./standardWeighing";
import type { StandardConfigDoc } from "./standardConfig";

const cfg = (p: Partial<StandardConfigDoc>): StandardConfigDoc => ({
  _id: Math.random().toString(36).slice(2),
  instrument: "GC", scope: "all", commonName: null, commonNameLower: null,
  times: 1, isDefault: false, note: "", ...p,
});

const GC_DEFAULT = cfg({ instrument: "GC", scope: "all", times: 3, isDefault: true });
const HPLC_DEFAULT = cfg({ instrument: "HPLC", scope: "all", times: 1, isDefault: true });

describe("classifyInstrument", () => {
  it("reads GC / HPLC from machine name", () => {
    expect(classifyInstrument("GC 7890A")).toBe("GC");
    expect(classifyInstrument("HPLC 1260 1")).toBe("HPLC");
    expect(classifyInstrument("เครื่องชั่งดิจิตอล")).toBeNull();
  });
});

describe("resolveTimes", () => {
  it("uses instrument default when no substance override", () => {
    expect(resolveTimes("GC", "Abamectin", [GC_DEFAULT, HPLC_DEFAULT])).toBe(3);
  });
  it("substance override beats default (case-insensitive)", () => {
    const override = cfg({ instrument: "GC", scope: "substance", commonName: "Abamectin", commonNameLower: "abamectin", times: 5 });
    expect(resolveTimes("GC", "abamectin", [GC_DEFAULT, override])).toBe(5);
  });
  it("returns null when no config for the instrument", () => {
    expect(resolveTimes("GC", "Abamectin", [])).toBeNull();
  });
});

describe("buildWeighTasks", () => {
  const petition: any = {
    _id: "p1", petitionNo: "P-1",
    items: [{ seq: 1, sampleName: "S1", commonName: "Abamectin", batchNo: "B1", sampleId: "P-1-1" }],
    assignedMachines: [{ machineId: "m1", code: "LD-003", name: "GC 7890A", sampleName: "S1", commonName: "Abamectin" }],
  };

  it("builds one task per substance x instrument with resolved times", () => {
    const tasks = buildWeighTasks(petition, [GC_DEFAULT, HPLC_DEFAULT]);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ commonName: "Abamectin", substance: "Abamectin", instrument: "GC", times: 3, sampleId: "P-1-1" });
    expect(tasks[0].key).toBe("Abamectin|Abamectin|GC");
  });

  it("splits a combo commonName into per-substance tasks on the assigned instrument", () => {
    const p2: any = {
      _id: "p2", petitionNo: "P-2",
      items: [{ seq: 1, sampleName: "S", commonName: "2,4-D + Butachlor", batchNo: "B", sampleId: "P-2-1" }],
      assignedMachines: [{ machineId: "m", code: "LD-003", name: "GC 7890A", sampleName: "S", commonName: "2,4-D + Butachlor" }],
    };
    const tasks = buildWeighTasks(p2, [GC_DEFAULT, HPLC_DEFAULT]);
    expect(tasks.map((t) => t.substance)).toEqual(["2,4-D", "Butachlor"]);
    expect(tasks.every((t) => t.instrument === "GC" && t.times === 3)).toBe(true);
  });

  it("ignores substances with no GC/HPLC machine assigned", () => {
    const p3: any = { _id: "p3", petitionNo: "P-3",
      items: [{ seq: 1, sampleName: "S", commonName: "Water", batchNo: "B", sampleId: "P-3-1" }],
      assignedMachines: [] };
    expect(buildWeighTasks(p3, [GC_DEFAULT, HPLC_DEFAULT])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/standardWeighing.test.ts`
Expected: FAIL — "Failed to resolve import ./standardWeighing" / functions undefined.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/standardWeighing.ts
import { parseSubstances } from "@/lib/substances";
import type { StandardConfigDoc } from "@/lib/standardConfig";
import type { Petition } from "@/types/petition.types";

export type WeighInstrument = "GC" | "HPLC";

export type WeighTask = {
  key: string;            // `${commonName}|${substance}|${instrument}` — unique per petition
  sampleId: string;       // representative sampleId of the substance group
  commonName: string;     // group commonName (may be a combo "A + B")
  substance: string;      // one parseSubstances() token
  instrument: WeighInstrument;
  times: number | null;   // null → not configured → blocks completion
};

/** Classify a machine by its name; only GC/HPLC consume a standard. */
export function classifyInstrument(machineName: string): WeighInstrument | null {
  const n = String(machineName || "").toUpperCase();
  if (/\bHPLC\b/.test(n)) return "HPLC";
  if (/\bGC\b/.test(n)) return "GC";
  return null;
}

/** Substance override (scope='substance') beats the instrument default (scope='all'). */
export function resolveTimes(
  instrument: string,
  substance: string,
  configs: StandardConfigDoc[],
): number | null {
  const inst = String(instrument || "").toUpperCase();
  const key = String(substance || "").trim().toLowerCase();
  const override = configs.find(
    (c) => c.scope === "substance" && String(c.instrument).toUpperCase() === inst && (c.commonNameLower ?? "") === key,
  );
  if (override) return override.times;
  const def = configs.find((c) => c.scope === "all" && String(c.instrument).toUpperCase() === inst);
  return def ? def.times : null;
}

/**
 * One task per (substance token × distinct GC/HPLC instrument assigned to its group).
 * Groups are keyed by sampleName+commonName; the instrument comes from the machines
 * assigned to that group in petition.assignedMachines. Weigh once per substance per
 * instrument per petition (not per batch), so tasks are de-duplicated by key.
 */
export function buildWeighTasks(petition: Petition, configs: StandardConfigDoc[]): WeighTask[] {
  const items = petition.items ?? [];
  const machines = petition.assignedMachines ?? [];
  const sampleIdOf = (sampleName?: string, commonName?: string): string => {
    const it = items.find((i) => (i.sampleName ?? "") === (sampleName ?? "") && (i.commonName ?? "") === (commonName ?? ""));
    return it?.sampleId || (it ? `${petition.petitionNo}-${it.seq}` : "");
  };

  const seen = new Set<string>();
  const tasks: WeighTask[] = [];
  for (const m of machines) {
    const instrument = classifyInstrument(m.name);
    if (!instrument) continue;
    const commonName = (m.commonName ?? "").trim();
    if (!commonName) continue;
    const substances = parseSubstances(commonName);
    for (const substance of substances) {
      const key = `${commonName}|${substance}|${instrument}`;
      if (seen.has(key)) continue;
      seen.add(key);
      tasks.push({
        key,
        sampleId: sampleIdOf(m.sampleName, m.commonName),
        commonName,
        substance,
        instrument,
        times: resolveTimes(instrument, substance, configs),
      });
    }
  }
  return tasks;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- src/lib/standardWeighing.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Type-check + commit**

```bash
npx tsc -p tsconfig.app.json --noEmit
git add src/lib/standardWeighing.ts src/lib/standardWeighing.test.ts
git commit -m "feat(lab): standard weighing task resolver (pure)"
```

---

## Task 2: `StandardWeighing` model (server)

**Files:**
- Create: `server/models/StandardWeighing.js`

**Interfaces:**
- Produces: mongoose model `StandardWeighing` with fields:
  `petitionId, petitionNo, sampleId, commonName, substance, instrument, times, mode('fresh'|'working'), masses[Number], totalMg, bottleQrId, workingQrId, deductedAt, deductedBy{email,name}, note` + soft-delete + unique index `{ petitionId, commonName, substance, instrument, deletedAt }`.

- [ ] **Step 1: Write the model**

```js
// server/models/StandardWeighing.js
const mongoose = require('mongoose');
const { softDeletePlugin } = require('../lib/softDelete');

const PersonSchema = new mongoose.Schema(
  { email: { type: String, default: '' }, name: { type: String, default: '' } },
  { _id: false },
);

const StandardWeighingSchema = new mongoose.Schema(
  {
    petitionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Petition', required: true, index: true },
    petitionNo: { type: String, default: '' },
    sampleId: { type: String, default: '' },
    commonName: { type: String, required: true },
    substance: { type: String, required: true },
    instrument: { type: String, required: true }, // 'GC' | 'HPLC'
    times: { type: Number, default: null },        // snapshot at save time
    mode: { type: String, enum: ['fresh', 'working'], default: 'fresh' },
    masses: { type: [Number], default: [] },       // mg per weigh (mode='fresh')
    totalMg: { type: Number, default: 0 },
    bottleQrId: { type: String, default: '' },     // sealed unit scanned (mode='fresh')
    workingQrId: { type: String, default: '' },    // working unit chosen or auto-created
    deductedAt: { type: Date, default: null },     // null = not deducted yet (idempotent guard)
    deductedBy: { type: PersonSchema, default: undefined },
    note: { type: String, default: '' },
  },
  { timestamps: true },
);

// One weighing per (petition, substance, instrument).
StandardWeighingSchema.index(
  { petitionId: 1, commonName: 1, substance: 1, instrument: 1, deletedAt: 1 },
  { unique: true },
);

StandardWeighingSchema.plugin(softDeletePlugin);
module.exports = mongoose.model('StandardWeighing', StandardWeighingSchema);
```

- [ ] **Step 2: Verify it loads (no test framework for models — smoke via node)**

Run: `node -e "require('./server/models/StandardWeighing'); console.log('ok')"`
Expected: prints `ok` with no schema error.

- [ ] **Step 3: Commit**

```bash
git add server/models/StandardWeighing.js
git commit -m "feat(lab): StandardWeighing model"
```

---

## Task 3: mg deduction + working-unit helpers (`stock.js`)

**Files:**
- Modify: `server/routes/stock.js` (add helpers + `POST /units/:qrId/deduct-mg`; export helpers)
- Test: `server/routes/__tests__/stockDeductMg.test.js` (pure planning helper only)

**Interfaces:**
- Produces (exported from `stock.js` via `module.exports = router; router.deductMgFromUnit = ...`):
  - `async deductMgFromUnit(qrId, mg, { sampleId, note, ...userMeta }) → { unit, before, after }` — atomic; throws `Error` with Thai message on invalid/insufficient.
  - `async createWorkingFromParent(parentUnit, { note }, req) → StockUnit` — creates a working unit (exp from frequency), volume mg initial/remaining 0.
  - `planDeductMg(unit, mg) → { ok: true, after } | { ok: false, reason }` (pure, no DB) — used by tests + the settle validator.
- Consumes: existing `StockUnit`, `StockStandard`, `logTransaction`, `workingExpForWithdraw`, `genUniqueQrId`, `personOf`, `userMeta`.

- [ ] **Step 1: Write the failing test for the pure planner**

```js
// server/routes/__tests__/stockDeductMg.test.js
const { planDeductMg } = require('../stock');

describe('planDeductMg', () => {
  const base = { status: 'active', exp: null, volume: { remaining: 100, unit: 'mg' } };
  test('ok when active and enough remaining', () => {
    expect(planDeductMg(base, 30)).toEqual({ ok: true, after: 70 });
  });
  test('rejects insufficient remaining', () => {
    expect(planDeductMg({ ...base, volume: { remaining: 10, unit: 'mg' } }, 30))
      .toEqual({ ok: false, reason: 'ปริมาณคงเหลือไม่พอ' });
  });
  test('rejects non-active unit', () => {
    expect(planDeductMg({ ...base, status: 'discarded' }, 5).ok).toBe(false);
  });
  test('rejects expired unit', () => {
    expect(planDeductMg({ ...base, exp: '2000-01-01' }, 5))
      .toEqual({ ok: false, reason: 'ขวดนี้หมดอายุแล้ว' });
  });
  test('rejects invalid mg', () => {
    expect(planDeductMg(base, 0).ok).toBe(false);
    expect(planDeductMg(base, -5).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest stockDeductMg`
Expected: FAIL — `planDeductMg is not a function`.

> Backend tests use **jest** (`server/package.json` → `"test": "jest"`, jest ^30 in devDeps), matching the existing `server/lib/*.test.js` files. Run all backend tests with `cd server && npm test`.

- [ ] **Step 3: Add the pure planner + helpers + endpoint in `stock.js`**

Add near the other helpers (after `logTransaction`, before `/* ==== STANDARDS ==== */`):

```js
// Pure: can this unit give up `mg`? (no DB) — shared by the endpoint and the
// lab-completion settle validator so both agree on the rules.
function planDeductMg(unit, mg) {
  const amount = Number(mg);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, reason: 'จำนวน mg ไม่ถูกต้อง' };
  if (!unit || unit.status !== 'active') return { ok: false, reason: 'ขวดนี้ใช้งานต่อไม่ได้' };
  if (unit.exp && new Date(unit.exp).getTime() < Date.now()) return { ok: false, reason: 'ขวดนี้หมดอายุแล้ว' };
  const remaining = Number(unit.volume && unit.volume.remaining) || 0;
  if (remaining < amount) return { ok: false, reason: 'ปริมาณคงเหลือไม่พอ' };
  return { ok: true, after: remaining - amount };
}

// Atomic: หัก mg จาก volume.remaining ของขวด (กัน race ด้วย $gte). โยน Error ถ้าไม่ผ่าน.
async function deductMgFromUnit(qrId, mg, meta = {}) {
  const amount = Number(mg);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('จำนวน mg ไม่ถูกต้อง');
  const unit = await StockUnit.findOne({ qrId });
  if (!unit) throw new Error('ไม่พบขวด (QR)');
  const plan = planDeductMg(unit, amount);
  if (!plan.ok) throw new Error(plan.reason);
  const before = Number(unit.volume.remaining) || 0;
  const updated = await StockUnit.findOneAndUpdate(
    { qrId, status: 'active', 'volume.remaining': { $gte: amount } },
    { $inc: { 'volume.remaining': -amount } },
    { new: true },
  );
  if (!updated) throw new Error('ปริมาณคงเหลือไม่พอ');
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
    sampleId: meta.sampleId,
    note: meta.note,
    userEmail: meta.userEmail,
    userName: meta.userName,
  });
  return { unit: updated, before, after: updated.volume.remaining };
}

// สร้าง working unit จากขวดแม่ (exp ตาม frequency). volume mg = 0 (v1: ใช้แค่ exp ตัดสินว่ายัง valid).
async function createWorkingFromParent(parentUnit, meta, req) {
  const std = await StockStandard.findOne({ code: parentUnit.itemCode });
  const shelf = (std && std.openShelfLife) || { value: 0, unit: 'day' };
  const now = new Date();
  const exp = workingExpForWithdraw(now, std && std.frequency, shelf, parentUnit.exp || null);
  const qrId = await genUniqueQrId();
  const working = await StockUnit.create({
    qrId,
    itemCode: parentUnit.itemCode,
    itemName: parentUnit.itemName,
    kind: 'working',
    source: parentUnit.source || '',
    parentId: parentUnit._id,
    lotNo: parentUnit.lotNo,
    exp,
    volume: { initial: 0, remaining: 0, unit: 'mg' },
    status: 'active',
    withdrawnDate: now,
    createdBy: req ? personOf(req) : undefined,
  });
  await logTransaction({
    itemType: 'standard',
    itemId: std ? std._id.toString() : parentUnit.itemCode,
    itemCode: parentUnit.itemCode,
    itemName: parentUnit.itemName,
    action: 'withdraw',
    unitId: working._id.toString(),
    qrId,
    volumeUnit: 'mg',
    unit: 'mg',
    note: (meta && meta.note) || 'auto working (ชั่ง standard)',
    userEmail: meta && meta.userEmail,
    userName: meta && meta.userName,
  });
  return working;
}
```

Add the endpoint next to `/standards/:id/deduct` (inside the STANDARDS section):

```js
// หัก mg จากขวดตรงๆ: { mg, sampleId?, petitionNo?, note? }
router.post('/units/:qrId/deduct-mg', async (req, res) => {
  try {
    const { mg, sampleId, petitionNo, note } = req.body || {};
    const meta = { sampleId, note: [petitionNo, note].filter(Boolean).join(' · '), ...userMeta(req) };
    const result = await deductMgFromUnit(req.params.qrId, mg, meta);
    res.json(result.unit);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
```

Update the export at the bottom of `stock.js`:

```js
module.exports = router;
router.planDeductMg = planDeductMg;
router.deductMgFromUnit = deductMgFromUnit;
router.createWorkingFromParent = createWorkingFromParent;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: (same command as Step 2)
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add server/routes/stock.js server/routes/__tests__/stockDeductMg.test.js
git commit -m "feat(stock): deduct-mg from unit + auto working helpers"
```

---

## Task 4: `StandardWeighing` routes + API client

**Files:**
- Create: `server/routes/standardWeighings.js`
- Modify: `server/index.js` (add `mountApi('/standard-weighings', require('./routes/standardWeighings'))`)
- Modify: `src/lib/api.ts` (add client methods + `StandardWeighingDoc` type)

**Interfaces:**
- Produces (REST): `GET /standard-weighings?petitionId=` → `StandardWeighingDoc[]`; `PUT /standard-weighings` upsert draft (body: `{ petitionId, petitionNo, sampleId, commonName, substance, instrument, times, mode, masses, bottleQrId, workingQrId, note }`) → the saved doc. **Does NOT deduct** (`deductedAt` untouched).
- Produces (client): `api.getStandardWeighings(petitionId)`, `api.saveStandardWeighing(body)`.

- [ ] **Step 1: Write the route**

```js
// server/routes/standardWeighings.js
const express = require('express');
const mongoose = require('mongoose');
const StandardWeighing = require('../models/StandardWeighing');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { petitionId } = req.query;
    if (!petitionId || !mongoose.Types.ObjectId.isValid(String(petitionId))) {
      return res.status(400).json({ error: 'petitionId required' });
    }
    const rows = await StandardWeighing.find({ petitionId }).sort({ commonName: 1, substance: 1 }).lean();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upsert a draft weighing (no deduction). Keyed by (petitionId, commonName, substance, instrument).
router.put('/', async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.petitionId || !mongoose.Types.ObjectId.isValid(String(b.petitionId))) {
      return res.status(400).json({ error: 'petitionId required' });
    }
    if (!b.commonName || !b.substance || !b.instrument) {
      return res.status(400).json({ error: 'commonName/substance/instrument required' });
    }
    const masses = Array.isArray(b.masses) ? b.masses.map(Number).filter((n) => Number.isFinite(n)) : [];
    const set = {
      petitionNo: String(b.petitionNo || ''),
      sampleId: String(b.sampleId || ''),
      times: b.times == null ? null : Number(b.times),
      mode: b.mode === 'working' ? 'working' : 'fresh',
      masses,
      totalMg: masses.reduce((s, n) => s + n, 0),
      bottleQrId: String(b.bottleQrId || ''),
      workingQrId: String(b.workingQrId || ''),
      note: String(b.note || ''),
    };
    // Never let a draft-save clobber an already-deducted record.
    const existing = await StandardWeighing.findOne({
      petitionId: b.petitionId, commonName: b.commonName, substance: b.substance, instrument: b.instrument,
    });
    if (existing && existing.deductedAt) return res.json(existing.toObject());
    const doc = await StandardWeighing.findOneAndUpdate(
      { petitionId: b.petitionId, commonName: b.commonName, substance: b.substance, instrument: b.instrument },
      { $set: set, $setOnInsert: { petitionId: b.petitionId, commonName: b.commonName, substance: b.substance, instrument: b.instrument } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
    res.json(doc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 2: Mount the route in `server/index.js`**

Add next to the other `mountApi` calls (after the `standard-configs` line ~46):

```js
mountApi('/standard-weighings', require('./routes/standardWeighings'));
```

- [ ] **Step 3: Add client methods + type in `src/lib/api.ts`**

Near the Standard Config client block (after `getStandardConfigs` ~line 606) add:

```ts
  // Standard Weighing (lab-testing)
  getStandardWeighings: (petitionId: string) =>
    request<StandardWeighingDoc[]>(`/standard-weighings?petitionId=${encodeURIComponent(petitionId)}`),
  saveStandardWeighing: (body: SaveStandardWeighingInput) =>
    request<StandardWeighingDoc>("/standard-weighings", { method: "PUT", body: JSON.stringify(body) }),
```

Add the types at the top of `src/lib/api.ts` (below existing imports/types, near `StandardConfigDoc` usage):

```ts
export type StandardWeighingDoc = {
  _id: string;
  petitionId: string;
  petitionNo: string;
  sampleId: string;
  commonName: string;
  substance: string;
  instrument: "GC" | "HPLC";
  times: number | null;
  mode: "fresh" | "working";
  masses: number[];
  totalMg: number;
  bottleQrId: string;
  workingQrId: string;
  deductedAt: string | null;
  note: string;
  createdAt?: string;
  updatedAt?: string;
};

export type SaveStandardWeighingInput = {
  petitionId: string;
  petitionNo: string;
  sampleId: string;
  commonName: string;
  substance: string;
  instrument: "GC" | "HPLC";
  times: number | null;
  mode: "fresh" | "working";
  masses: number[];
  bottleQrId?: string;
  workingQrId?: string;
  note?: string;
};
```

- [ ] **Step 4: Type-check + smoke the route**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Run (backend up): `curl -s "http://localhost:3001/api/standard-weighings?petitionId=000000000000000000000000"` → expect `[]` (valid ObjectId, no rows) or start the server and hit the endpoint.
Expected: type-check clean; endpoint returns `[]`.

- [ ] **Step 5: Commit**

```bash
git add server/routes/standardWeighings.js server/index.js src/lib/api.ts
git commit -m "feat(lab): StandardWeighing routes + API client"
```

---

## Task 5: Settle at completion (gate + deduct) — server-authoritative

**Files:**
- Create: `server/lib/standardWeighingSettle.js` (pure validator + orchestrator)
- Test: `server/lib/standardWeighingSettle.test.js`
- Modify: `server/routes/petitions.js` (call settle in the `side==='lab'` branch of `POST /:id/complete`)
- Modify: `src/lib/api.ts` (`completePetitionTrack` passes `requiredStandardKeys`)

**Interfaces:**
- Consumes: `StandardWeighing` model; `stock.js` exports `planDeductMg`, `deductMgFromUnit`, `createWorkingFromParent`; `StockUnit` model.
- Produces:
  - `validateWeighings(required, rows, unitByQr) → { errors: string[], plan: Array<{ rowId, bottleQrId, totalMg, sampleId }> }` (pure)
  - `async settleLabStandards(petition, requiredKeys, req) → void` — throws `Error(message)` if any validation fails; otherwise performs deductions + working creation + stamps `deductedAt`. **Idempotent.**

`required`/`requiredKeys` shape (from client): `{ commonName, substance, instrument, times }`.

- [ ] **Step 1: Write the failing test for the pure validator**

```js
// server/lib/standardWeighingSettle.test.js
const { validateWeighings } = require('./standardWeighingSettle');

const req1 = { commonName: 'Abamectin', substance: 'Abamectin', instrument: 'GC', times: 3 };
const freshRow = {
  _id: 'r1', commonName: 'Abamectin', substance: 'Abamectin', instrument: 'GC',
  mode: 'fresh', masses: [30, 31, 29], bottleQrId: 'u_a', deductedAt: null, sampleId: 'P-1-1',
};
const unitOk = { qrId: 'u_a', status: 'active', exp: null, volume: { remaining: 100, unit: 'mg' } };

test('valid fresh weighing → one deduction of Σmasses', () => {
  const { errors, plan } = validateWeighings([req1], [freshRow], { u_a: unitOk });
  expect(errors).toEqual([]);
  expect(plan).toEqual([{ rowId: 'r1', bottleQrId: 'u_a', totalMg: 90, sampleId: 'P-1-1' }]);
});

test('missing row for a required task → error, no plan', () => {
  const { errors, plan } = validateWeighings([req1], [], {});
  expect(errors[0]).toMatch(/Abamectin/);
  expect(plan).toEqual([]);
});

test('fresh row with wrong number of masses → error', () => {
  const { errors } = validateWeighings([req1], [{ ...freshRow, masses: [30, 31] }], { u_a: unitOk });
  expect(errors[0]).toMatch(/ครบ 3 ครั้ง/);
});

test('insufficient remaining → error', () => {
  const { errors } = validateWeighings([req1], [freshRow], { u_a: { ...unitOk, volume: { remaining: 10, unit: 'mg' } } });
  expect(errors[0]).toMatch(/คงเหลือไม่พอ/);
});

test('already deducted row → no error, no plan (idempotent)', () => {
  const { errors, plan } = validateWeighings([req1], [{ ...freshRow, deductedAt: new Date() }], { u_a: unitOk });
  expect(errors).toEqual([]);
  expect(plan).toEqual([]);
});

test('working mode row needs a workingQrId', () => {
  const wReq = { ...req1 };
  const okWork = { ...freshRow, mode: 'working', masses: [], bottleQrId: '', workingQrId: 'u_w' };
  expect(validateWeighings([wReq], [okWork], {}).errors).toEqual([]);
  expect(validateWeighings([wReq], [{ ...okWork, workingQrId: '' }], {}).errors[0]).toMatch(/working/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest lib/standardWeighingSettle.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `standardWeighingSettle.js`**

```js
// server/lib/standardWeighingSettle.js
const StandardWeighing = require('../models/StandardWeighing');
const StockUnit = require('../models/StockUnit');
const stockRouter = require('../routes/stock'); // exposes planDeductMg / deductMgFromUnit / createWorkingFromParent

const keyOf = (x) => `${x.commonName}|${x.substance}|${x.instrument}`;

/**
 * Pure. For each required task, ensure a matching, complete, valid weighing row.
 * Returns { errors, plan } where plan lists fresh, not-yet-deducted deductions.
 */
function validateWeighings(required, rows, unitByQr) {
  const errors = [];
  const plan = [];
  const rowByKey = new Map(rows.map((r) => [keyOf(r), r]));
  for (const req of required) {
    const label = `${req.substance} (${req.instrument})`;
    if (req.times == null) { errors.push(`ยังไม่ตั้งค่าจำนวนครั้ง (Standard Config) สำหรับ ${label}`); continue; }
    const row = rowByKey.get(keyOf(req));
    if (!row) { errors.push(`ยังไม่ได้บันทึกการชั่ง standard: ${label}`); continue; }
    if (row.mode === 'working') {
      if (!row.workingQrId) errors.push(`เลือก working solution ก่อน: ${label}`);
      continue;
    }
    // fresh
    const masses = Array.isArray(row.masses) ? row.masses.filter((n) => Number(n) > 0) : [];
    if (masses.length !== Number(req.times)) { errors.push(`กรอกน้ำหนักให้ครบ ${req.times} ครั้ง: ${label}`); continue; }
    if (!row.bottleQrId) { errors.push(`สแกน QR ขวดก่อน: ${label}`); continue; }
    if (row.deductedAt) continue; // idempotent — already deducted
    const unit = unitByQr[row.bottleQrId];
    const totalMg = masses.reduce((s, n) => s + Number(n), 0);
    const p = stockRouter.planDeductMg(unit, totalMg);
    if (!p.ok) { errors.push(`${p.reason}: ${label}`); continue; }
    plan.push({ rowId: String(row._id), bottleQrId: row.bottleQrId, totalMg, sampleId: row.sampleId });
  }
  return { errors, plan };
}

/** Orchestrator: validate → deduct atomically → create working → stamp deductedAt. Throws on any error. */
async function settleLabStandards(petition, requiredKeys, req) {
  const required = Array.isArray(requiredKeys) ? requiredKeys : [];
  if (required.length === 0) return; // nothing to weigh for this petition
  const rows = await StandardWeighing.find({ petitionId: petition._id });
  const qrIds = rows.filter((r) => r.mode === 'fresh' && r.bottleQrId).map((r) => r.bottleQrId);
  const units = await StockUnit.find({ qrId: { $in: qrIds } }).lean();
  const unitByQr = Object.fromEntries(units.map((u) => [u.qrId, u]));

  const { errors, plan } = validateWeighings(required, rows, unitByQr);
  if (errors.length) { const e = new Error(errors[0]); e.details = errors; throw e; }

  const meta = {
    userEmail: req.body?._user?.email || req.headers['x-user-email'] || '',
    userName: req.body?._user?.name || req.headers['x-user-name'] || '',
  };
  for (const step of plan) {
    const { unit } = await stockRouter.deductMgFromUnit(step.bottleQrId, step.totalMg, {
      sampleId: step.sampleId, note: `ชั่ง standard · ${petition.petitionNo}`, ...meta,
    });
    const working = await stockRouter.createWorkingFromParent(unit, { note: `${petition.petitionNo}`, ...meta }, req);
    await StandardWeighing.updateOne(
      { _id: step.rowId },
      { $set: { deductedAt: new Date(), deductedBy: { email: meta.userEmail, name: meta.userName }, workingQrId: working.qrId } },
    );
  }
}

module.exports = { validateWeighings, settleLabStandards, keyOf };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx jest lib/standardWeighingSettle.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Wire into `POST /:id/complete` (lab branch) in `server/routes/petitions.js`**

At the top of the file add the import (near other requires):

```js
const { settleLabStandards } = require('../lib/standardWeighingSettle');
```

In the `else` branch (side === 'lab'), **before** `doc.labCompletedAt = now;` (currently line ~323), insert:

```js
      // Gate + auto-deduct standard weighings before marking Lab complete.
      // Throws (→ 400) if any required weighing is incomplete or stock is short.
      try {
        await settleLabStandards(doc, req.body?.requiredStandardKeys, req);
      } catch (e) {
        return res.status(400).json({ error: { message: e.message, details: e.details || [] } });
      }
```

- [ ] **Step 6: Update `completePetitionTrack` in `src/lib/api.ts` to forward required keys**

Replace the existing `completePetitionTrack` with:

```ts
  completePetitionTrack: (
    petitionId: string,
    side: "lab" | "qc",
    actor: string,
    redoExplanation?: string,
    requiredStandardKeys?: Array<{ commonName: string; substance: string; instrument: "GC" | "HPLC"; times: number | null }>,
  ) =>
    request<import("@/types/petition.types").Petition>(`/petitions/${petitionId}/complete`, {
      method: "POST",
      body: JSON.stringify({ side, actor, redoExplanation, requiredStandardKeys }),
    }),
```

- [ ] **Step 7: Type-check + commit**

```bash
npx tsc -p tsconfig.app.json --noEmit
git add server/lib/standardWeighingSettle.js server/lib/standardWeighingSettle.test.js server/routes/petitions.js src/lib/api.ts
git commit -m "feat(lab): gate + auto-deduct standard weighings at lab completion"
```

---

## Task 6: `StandardWeighingSection` UI component

**Files:**
- Create: `src/components/lis/StandardWeighingSection.tsx`

**Interfaces:**
- Consumes: `WeighTask` + `buildWeighTasks` (Task 1); `api.getStandardWeighings` / `api.saveStandardWeighing` / `api.getStockUnit` (Task 4); `StockQrScanner` (`@/components/lis/StockQrScanner`); `StandardWeighingDoc` type.
- Produces: default export `StandardWeighingSection` with props:
  `{ petition: Petition; configs: StandardConfigDoc[]; readOnly: boolean; onValidityChange: (ready: boolean, requiredKeys: RequiredKey[]) => void }`
  where `RequiredKey = { commonName; substance; instrument; times }`.
- Behavior: renders one card per weigh task, autosaves drafts, reports readiness + required keys upward for the submit gate.

- [ ] **Step 1: Write the component**

```tsx
// src/components/lis/StandardWeighingSection.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FlaskConical, QrCode, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import StockQrScanner from "@/components/lis/StockQrScanner";
import { api, type StandardWeighingDoc } from "@/lib/api";
import type { StandardConfigDoc } from "@/lib/standardConfig";
import type { Petition } from "@/types/petition.types";
import { buildWeighTasks, type WeighTask } from "@/lib/standardWeighing";

export type RequiredKey = { commonName: string; substance: string; instrument: "GC" | "HPLC"; times: number | null };

type Props = {
  petition: Petition;
  configs: StandardConfigDoc[];
  readOnly: boolean;
  onValidityChange: (ready: boolean, requiredKeys: RequiredKey[]) => void;
};

type Draft = {
  mode: "fresh" | "working";
  masses: string[];      // string inputs, length = times
  bottleQrId: string;
  bottleLabel: string;   // "itemName · lot · เหลือ X mg" for display
  bottleRemaining: number;
  workingQrId: string;
  deductedAt: string | null;
};

const emptyDraft = (times: number): Draft => ({
  mode: "fresh", masses: Array.from({ length: Math.max(1, times) }, () => ""),
  bottleQrId: "", bottleLabel: "", bottleRemaining: 0, workingQrId: "", deductedAt: null,
});

function draftReady(t: WeighTask, d: Draft): boolean {
  if (t.times == null) return false;
  if (d.deductedAt) return true;
  if (d.mode === "working") return !!d.workingQrId;
  const nums = d.masses.map(Number).filter((n) => n > 0);
  if (nums.length !== t.times || !d.bottleQrId) return false;
  return nums.reduce((s, n) => s + n, 0) <= d.bottleRemaining;
}

export default function StandardWeighingSection({ petition, configs, readOnly, onValidityChange }: Props) {
  const tasks = useMemo(() => buildWeighTasks(petition, configs), [petition, configs]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [scanFor, setScanFor] = useState<string | null>(null); // task.key being scanned
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const { data: saved = [] } = useQuery<StandardWeighingDoc[]>({
    queryKey: ["standard-weighings", petition._id],
    queryFn: () => api.getStandardWeighings(petition._id),
    enabled: !!petition._id,
  });

  // Seed drafts from tasks, then overlay any saved rows.
  useEffect(() => {
    setDrafts((prev) => {
      const next: Record<string, Draft> = {};
      for (const t of tasks) {
        const row = saved.find((r) => r.commonName === t.commonName && r.substance === t.substance && r.instrument === t.instrument);
        if (prev[t.key] && !row) { next[t.key] = prev[t.key]; continue; }
        const base = emptyDraft(t.times ?? 1);
        next[t.key] = row
          ? {
              mode: row.mode,
              masses: (row.masses.length ? row.masses.map(String) : base.masses).slice(0, Math.max(1, t.times ?? 1)),
              bottleQrId: row.bottleQrId, bottleLabel: prev[t.key]?.bottleLabel ?? (row.bottleQrId ? `ขวด ${row.bottleQrId}` : ""),
              bottleRemaining: prev[t.key]?.bottleRemaining ?? Number.MAX_SAFE_INTEGER,
              workingQrId: row.workingQrId, deductedAt: row.deductedAt,
            }
          : base;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, saved]);

  // Report readiness + required keys upward whenever drafts/tasks change.
  useEffect(() => {
    const requiredKeys: RequiredKey[] = tasks.map((t) => ({ commonName: t.commonName, substance: t.substance, instrument: t.instrument, times: t.times }));
    const ready = tasks.every((t) => draftReady(t, drafts[t.key] ?? emptyDraft(t.times ?? 1)));
    onValidityChange(ready, requiredKeys);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, drafts]);

  const persist = (t: WeighTask, d: Draft) => {
    clearTimeout(saveTimers.current[t.key]);
    saveTimers.current[t.key] = setTimeout(() => {
      api.saveStandardWeighing({
        petitionId: petition._id, petitionNo: petition.petitionNo, sampleId: t.sampleId,
        commonName: t.commonName, substance: t.substance, instrument: t.instrument, times: t.times,
        mode: d.mode, masses: d.masses.map(Number).filter((n) => Number.isFinite(n)),
        bottleQrId: d.bottleQrId, workingQrId: d.workingQrId,
      }).catch(() => {});
    }, 500);
  };

  const update = (t: WeighTask, patch: Partial<Draft>) => {
    setDrafts((prev) => {
      const d = { ...(prev[t.key] ?? emptyDraft(t.times ?? 1)), ...patch };
      persist(t, d);
      return { ...prev, [t.key]: d };
    });
  };

  const onScanned = async (qrId: string) => {
    const key = scanFor;
    setScanFor(null);
    if (!key) return;
    const t = tasks.find((x) => x.key === key);
    if (!t) return;
    try {
      const unit = await api.getStockUnit(qrId);
      if (unit.volume?.unit !== "mg") { toast.error("ขวดนี้ไม่ได้เป็นหน่วย mg"); return; }
      const name = (unit.itemName || "").toLowerCase();
      if (t.substance && !name.includes(t.substance.toLowerCase().split(" ")[0])) {
        toast.warning(`ขวดที่สแกน (${unit.itemName}) อาจไม่ตรงกับสาร ${t.substance}`);
      }
      update(t, {
        bottleQrId: unit.qrId, bottleRemaining: Number(unit.volume?.remaining) || 0,
        bottleLabel: `${unit.itemName}${unit.lotNo ? ` · lot ${unit.lotNo}` : ""} · เหลือ ${unit.volume?.remaining ?? 0} mg`,
      });
    } catch {
      toast.error("ไม่พบขวด (QR) นี้");
    }
  };

  if (tasks.length === 0) return null;

  return (
    <section className="rounded-xl border bg-white p-4 space-y-3">
      <div className="flex items-center gap-2">
        <FlaskConical className="h-4 w-4 text-sky-500" />
        <h3 className="text-sm font-bold">ชั่ง Standard</h3>
        <span className="text-xs text-muted-foreground">(หักสต็อกตอนบันทึกผล)</span>
      </div>

      {tasks.map((t) => {
        const d = drafts[t.key] ?? emptyDraft(t.times ?? 1);
        const ready = draftReady(t, d);
        const total = d.masses.map(Number).filter((n) => n > 0).reduce((s, n) => s + n, 0);
        const over = d.mode === "fresh" && !!d.bottleQrId && total > d.bottleRemaining;
        return (
          <div key={t.key} className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">
                {t.substance} <span className="text-muted-foreground">· {t.instrument} · ชั่ง {t.times ?? "?"} ครั้ง</span>
              </div>
              {t.times == null ? (
                <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> ยังไม่ตั้งค่า</Badge>
              ) : d.deductedAt ? (
                <Badge className="gap-1 bg-emerald-600"><CheckCircle2 className="h-3 w-3" /> หักแล้ว</Badge>
              ) : ready ? (
                <Badge className="gap-1 bg-emerald-600"><CheckCircle2 className="h-3 w-3" /> พร้อม</Badge>
              ) : (
                <Badge variant="secondary">ยังไม่ครบ</Badge>
              )}
            </div>

            {!d.deductedAt && t.times != null && (
              <>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant={d.mode === "fresh" ? "default" : "outline"} disabled={readOnly}
                    onClick={() => update(t, { mode: "fresh" })}>ชั่งใหม่</Button>
                  <Button type="button" size="sm" variant={d.mode === "working" ? "default" : "outline"} disabled={readOnly}
                    onClick={() => update(t, { mode: "working" })}>ใช้ working เดิม</Button>
                </div>

                {d.mode === "fresh" ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button type="button" size="sm" variant="outline" className="gap-1" disabled={readOnly}
                        onClick={() => setScanFor(t.key)}>
                        <QrCode className="h-4 w-4" /> {d.bottleQrId ? "เปลี่ยนขวด" : "สแกน QR ขวด"}
                      </Button>
                      {d.bottleLabel && <span className="text-xs text-muted-foreground">{d.bottleLabel}</span>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Array.from({ length: Math.max(1, t.times) }).map((_, i) => (
                        <Input key={i} type="number" inputMode="decimal" step="0.0001" min={0} disabled={readOnly}
                          className="w-24" placeholder={`ครั้งที่ ${i + 1} (mg)`}
                          value={d.masses[i] ?? ""}
                          onChange={(e) => {
                            const masses = [...d.masses]; masses[i] = e.target.value; update(t, { masses });
                          }} />
                      ))}
                    </div>
                    <p className={`text-xs ${over ? "text-destructive" : "text-muted-foreground"}`}>
                      รวมที่จะหัก: {total.toLocaleString()} mg{over ? " — เกินคงเหลือในขวด!" : ""}
                    </p>
                  </>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" size="sm" variant="outline" className="gap-1" disabled={readOnly}
                      onClick={() => setScanFor(t.key)}>
                      <QrCode className="h-4 w-4" /> {d.workingQrId ? "เปลี่ยน working" : "สแกน working solution"}
                    </Button>
                    {d.workingQrId && <span className="text-xs text-muted-foreground">working {d.workingQrId}</span>}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}

      <StockQrScanner
        open={scanFor != null}
        title="สแกน QR ขวด standard"
        onClose={() => setScanFor(null)}
        onScanned={(qrId) => {
          const t = tasks.find((x) => x.key === scanFor);
          if (t && drafts[t.key]?.mode === "working") { update(t, { workingQrId: qrId }); setScanFor(null); }
          else onScanned(qrId);
        }}
      />
    </section>
  );
}
```

> Note: for `mode='working'` we accept the scanned QR as the working unit id directly (no volume check in v1). For `mode='fresh'` we load the unit to show remaining + warn on substance mismatch.

- [ ] **Step 2: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: clean (no errors in the new file).

- [ ] **Step 3: Commit**

```bash
git add src/components/lis/StandardWeighingSection.tsx
git commit -m "feat(lab): StandardWeighingSection UI (scan + weigh + autosave)"
```

---

## Task 7: Integrate into `LabTestingDetailPage` + gate submit

**Files:**
- Modify: `src/pages/LabTestingDetailPage.tsx`

**Interfaces:**
- Consumes: `StandardWeighingSection` + `RequiredKey`; `api.getStandardConfigs`.
- Produces: renders the section; blocks/enables "บันทึกผล"; passes `requiredStandardKeys` to `api.completePetitionTrack`.

- [ ] **Step 1: Load Standard Config + track weighing readiness**

Near the other queries/state in the component body (after `instrumentSources` state ~line 351) add:

```tsx
  const { data: standardConfigs = [] } = useQuery({
    queryKey: ["standard-configs"],
    queryFn: () => api.getStandardConfigs(),
  });
  const [stdWeighReady, setStdWeighReady] = useState(true);
  const [stdRequiredKeys, setStdRequiredKeys] = useState<
    Array<{ commonName: string; substance: string; instrument: "GC" | "HPLC"; times: number | null }>
  >([]);
```

Add the imports at the top of the file:

```tsx
import StandardWeighingSection from "@/components/lis/StandardWeighingSection";
```

(Ensure `useQuery` is already imported — the page uses React Query hooks; if not, add `import { useQuery } from "@tanstack/react-query";`.)

- [ ] **Step 2: Render the section**

Place `<StandardWeighingSection>` just above the footer save button block (before the `{labItems.length > 0 && !petition.labCompletedAt && (` block ~line 1490). Insert:

```tsx
        <StandardWeighingSection
          petition={petition}
          configs={standardConfigs}
          readOnly={isLocked}
          onValidityChange={(ready, keys) => { setStdWeighReady(ready); setStdRequiredKeys(keys); }}
        />
```

- [ ] **Step 3: Gate the submit button + forward keys**

In `handleSubmitResult`, after the existing `missing`/`redoExplanation` guards and before the confirm dialog, add the weighing gate:

```tsx
    if (!stdWeighReady) {
      toast.error("ชั่ง standard ยังไม่ครบ", {
        description: "กรอกน้ำหนัก/สแกนขวดให้ครบทุกสาร (หรือเลือกใช้ working เดิม) ก่อนบันทึกผล",
      });
      return;
    }
```

Change the `api.completePetitionTrack(...)` call to forward the keys:

```tsx
      const updated = await api.completePetitionTrack(
        petition._id, 'lab', user?.name ?? 'system', redoExplanation.trim() || undefined, stdRequiredKeys,
      );
```

In the `catch` of `handleSubmitResult`, surface the server's block message instead of a generic toast:

```tsx
    } catch (e) {
      const msg = (e as { message?: string })?.message;
      toast.error(msg && !/^Failed/.test(msg) ? msg : 'บันทึกผลไม่สำเร็จ');
    } finally {
```

Also disable the footer submit button when weighing isn't ready — update the footer button block (~line 1490-1495):

```tsx
        {labItems.length > 0 && !petition.labCompletedAt && (
          <div className="fixed bottom-0 ...existing classes...">
            <Button
              onClick={isComplete ? handleSubmitResult : handleSaveDraft}
              disabled={submitting || (isComplete && !stdWeighReady)}
            >
              {/* existing label logic */}
            </Button>
          </div>
        )}
```

> Keep the existing footer wrapper/label markup; only add `(isComplete && !stdWeighReady)` to the existing `disabled` expression. If the button already has a `disabled`, OR the new condition into it.

- [ ] **Step 4: Verify the API error message reaches the client**

Confirm `src/lib/api.ts` `request()` throws an `Error` whose `.message` is the server's `error.message` string (the backend returns `{ error: { message } }`). If `request` already unwraps `error.message`, the `catch` above shows the Thai block reason. (Check the `request` helper; most LIS endpoints already surface `error.message`.)

- [ ] **Step 5: Type-check + commit**

```bash
npx tsc -p tsconfig.app.json --noEmit
git add src/pages/LabTestingDetailPage.tsx
git commit -m "feat(lab): render standard weighing section + gate lab completion"
```

---

## Task 8: Verification, seed export, and manual E2E

**Files:**
- Modify: `server/seed-data/*` (via `npm run seed:export` — new `standardweighings` collection + updated stockunits/stocktransactions)

- [ ] **Step 1: Full type-check + unit tests**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Run: `npm run test -- src/lib/standardWeighing.test.ts`
Run: `cd server && npx jest lib/standardWeighingSettle.test.js routes/__tests__/stockDeductMg.test.js`
Expected: all green.

- [ ] **Step 2: Manual E2E (backend + frontend up; user's machine, real DB)**

Checklist — do each and confirm:
1. เปิด petition Lab ที่ assign เครื่อง GC 1 สาร (เช่น Abamectin) → เห็นการ์ด "ชั่ง Abamectin · GC · ชั่ง 3 ครั้ง".
2. โหมด "ชั่งใหม่" → สแกน QR ขวด Abamectin (หน่วย mg) → เห็น lot/คงเหลือ; กรอก 3 ช่อง (เช่น 30/31/29) → badge "พร้อม".
3. กด "บันทึกผล" → สำเร็จ; เปิดหน้า stock ขวดนั้น → `remaining` ลดลง 90 mg; มี working unit ใหม่ (exp ตาม frequency); มี StockTransaction 2 แถว (deduct mg + withdraw).
4. เปิด petition เดิมซ้ำ (ถ้า reopen ได้) / ยิง complete ซ้ำ → **ไม่หักซ้ำ** (deductedAt กันไว้).
5. กรณีบล็อก: ลบน้ำหนักช่องหนึ่ง / ไม่สแกนขวด → ปุ่มบันทึกถูก disable + ถ้า force ยิง server ตอบ 400 พร้อมข้อความไทยชี้สาร.
6. กรณีสต็อกไม่พอ: สแกนขวดที่เหลือ < Σ → เตือน "เกินคงเหลือ" + บล็อก.
7. โหมด "ใช้ working เดิม" (ถ้ามี working ของสาร) → สแกน working → badge พร้อม → บันทึกผลผ่านโดยไม่หัก solid.
8. สารที่ไม่ได้ assign GC/HPLC → ไม่มีการ์ด, บันทึกผลได้ตามปกติ.

- [ ] **Step 3: Export seed data + commit**

```bash
cd server && npm run seed:export
cd .. && git add server/seed-data/
git commit -m "chore(seed): export standardweighings + stock after standard-weighing E2E"
```

- [ ] **Step 4: Update auto-memory**

Append a one-line pointer in `C:\Users\it6ic\.claude\projects\C--Project-LIS\memory\MEMORY.md` and a `project_*` memory file describing this feature's status (develop, pushed?/pending E2E), mirroring existing entries.

---

## Self-Review notes (author)

- **Spec coverage:** §1 resolve → Task 1; §5 model → Task 2; §6.1 deduct-mg + §6.2 working → Task 3; §6.3 routes → Task 4; §6.4 settle/gate → Task 5; §7 UI → Task 6–7; §10 tests spread across 1/3/5/8. ✅
- **Deviations from spec (documented above):** weigh-task keyed by (commonName, substance, instrument) at petition level (not per-sampleId batch); required-set supplied by client (server enforces atomic deduction as the hard guarantee); instrument classified from `assignedMachines` names rather than re-resolved from SimpleMethod. All preserve the approved behavior (mg deduction on save, working reuse, strict block, auto working).
- **Type consistency:** `RequiredKey`/`requiredStandardKeys` shape `{commonName, substance, instrument, times}` identical across Task 5 (server), Task 6 (component), Task 7 (page), Task 5 (api). `WeighTask.key` = `${commonName}|${substance}|${instrument}` matches `keyOf` in the server validator. ✅
- **Open risk:** `assignedMachines` must be populated (assign step done). Petitions never assigned won't show cards → won't block (acceptable). `StockUnit` bottles must be mg-unit (216 exist).
