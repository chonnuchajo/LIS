# เบิกสารเคมี (solvent) ให้เครื่อง — daily-check/analysis · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มปุ่ม "เบิกสารเคมี" ในหน้า `/daily-check/analysis` ให้ผู้วิเคราะห์เลือก solvent (สแกน/เลือก) → เบิกให้เครื่อง GC/HPLC เครื่องหนึ่ง โดยหักสต็อก `StockSolvent.qty` + log ธุรกรรม + เก็บ record ว่าเบิกให้เครื่องไหน แสดงทั้งการ์ดรวมและใต้การ์ดเครื่อง.

**Architecture:** collection ใหม่ `ChemicalRequisition` (1 doc = 1 การเบิก) + route `/chemical-requisitions` (GET/POST/DELETE) ที่หัก solvent แบบ atomic แล้วบันทึก record. Frontend เพิ่ม pure helper + api methods + dialog + wire เข้า `RoomEquipmentCheckPage` (gate เฉพาะห้อง analysis). ตรรกะที่ test ได้ (validation, grouping, note) แยกเป็น pure lib ทั้งฝั่ง server (`node:test`) และ client (Vitest); ตัว route/DB + UI ตรวจด้วย manual E2E.

**Tech Stack:** Express 4 + Mongoose 8 (backend), React 18 + TS + TanStack Query + shadcn/ui (frontend), `html5-qrcode` scanner เดิม.

## Global Constraints

- UI labels เป็น **ภาษาไทย** (ตามทั้งแอป).
- ขอบเขต v1 = **solvent เท่านั้น + ห้อง analysis เท่านั้น** (model/route ใช้ `roomSlug` ทั่วไป แต่ UI เปิดปุ่มเฉพาะ analysis). ไม่แตะสารมาตรฐาน/StockUnit/QC.
- หน่วยหัก = **จำนวนขวด** (`qty`), หน่วย `"bottle"`, default 1.
- **ไม่เพิ่ม npm dependency ใหม่.**
- Backend routes ต้อง register ผ่าน `mountApi()` (mount ทั้ง `/api/*` และ `/LIS/api/*`).
- Delete ต้องใช้ **soft delete** (`softDeletePlugin` / `doc.softDelete(by)`).
- **Backend tests**: `node:test` + `node:assert`, รันด้วย `node --test <file>` โดย cwd = `server/` (ไม่มี live DB — ทดสอบเฉพาะ pure function + `model.validate()` ในหน่วยความจำ).
- **Frontend tests**: Vitest, รันด้วย `npm test` (cwd = repo root).
- **Typecheck**: `npx tsc -p tsconfig.app.json --noEmit` (cwd = root). Baseline repo มี ~12 latent errors อยู่แล้ว — task ผ่านเมื่อ **ไม่เพิ่ม error ใหม่** (เทียบ baseline). อย่าใช้ `npx tsc --noEmit` เฉย ๆ (root tsconfig `files:[]` → เช็ค 0 ไฟล์).
- Commit ทุก task ด้วย **explicit pathspec** (รีโปนี้มี process อื่น commit แทรกได้).

---

## File Structure

- **Create** `server/models/ChemicalRequisition.js` — mongoose model (auto-loaded โดย `loadAllModels()` ที่ `readdirSync(models)`).
- **Create** `server/models/ChemicalRequisition.test.js` — model validation test (`node:test`).
- **Create** `server/lib/chemicalRequisition.js` — pure helpers (`todayStr`, `buildDeductNote`, `normalizeReqInput`).
- **Create** `server/lib/chemicalRequisition.test.js` — pure-helper test (`node:test`).
- **Create** `server/routes/chemical-requisitions.js` — GET/POST/DELETE route.
- **Modify** `server/index.js` — `mountApi('/chemical-requisitions', ...)`.
- **Create** `src/lib/chemicalRequisition.ts` — TS types + pure helpers (`ChemicalRequisition`, `groupRequisitionsByInstrument`, `validateRequisitionQty`, `todayStr`).
- **Create** `src/lib/chemicalRequisition.test.ts` — Vitest.
- **Modify** `src/lib/api.ts` — 3 methods + import type.
- **Create** `src/components/lis/daily-check/ChemicalRequisitionDialog.tsx` — dialog เลือกเครื่อง+solvent+qty.
- **Modify** `src/pages/daily-check/RoomEquipmentCheckPage.tsx` — การ์ดรวม + บล็อกใต้การ์ดเครื่อง + render dialog (gate `roomSlug === "analysis"`).

---

### Task 1: Backend model `ChemicalRequisition` + validation test

**Files:**
- Create: `server/models/ChemicalRequisition.js`
- Test: `server/models/ChemicalRequisition.test.js`

**Interfaces:**
- Produces: mongoose model `ChemicalRequisition` with fields `{ date, roomSlug, instrumentId, instrumentName, itemType, solventId, solventName, qty, unit, note, requestedBy:{email,name}, deletedAt, deletedBy, createdAt, updatedAt }`; instance method `softDelete(by)` (จาก plugin).

- [ ] **Step 1: Write the failing test** — create `server/models/ChemicalRequisition.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const ChemicalRequisition = require('./ChemicalRequisition');

test('valid doc validates + applies defaults (unit=bottle, itemType=solvent)', async () => {
  const doc = new ChemicalRequisition({
    date: '2026-07-03', roomSlug: 'analysis',
    instrumentId: 'LD-004', instrumentName: 'GC 8890',
    solventId: 's1', solventName: 'Methanol', qty: 1,
  });
  await doc.validate();
  assert.strictEqual(doc.unit, 'bottle');
  assert.strictEqual(doc.itemType, 'solvent');
});

test('rejects when required fields missing', async () => {
  const doc = new ChemicalRequisition({ roomSlug: 'analysis' });
  await assert.rejects(() => doc.validate());
});

test('rejects invalid itemType', async () => {
  const doc = new ChemicalRequisition({
    date: '2026-07-03', roomSlug: 'analysis', instrumentId: 'LD-004',
    solventId: 's1', qty: 1, itemType: 'standard',
  });
  await assert.rejects(() => doc.validate());
});

test('softDelete method exists (from plugin)', () => {
  const doc = new ChemicalRequisition({
    date: '2026-07-03', roomSlug: 'analysis', instrumentId: 'LD-004', solventId: 's1', qty: 1,
  });
  assert.strictEqual(typeof doc.softDelete, 'function');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && node --test models/ChemicalRequisition.test.js`
Expected: FAIL — `Cannot find module './ChemicalRequisition'`.

- [ ] **Step 3: Write the model** — create `server/models/ChemicalRequisition.js`:

```js
const mongoose = require('mongoose');
const { softDeletePlugin } = require('../lib/softDelete');

const PersonSchema = new mongoose.Schema({
  email: { type: String, default: '' },
  name: { type: String, default: '' },
}, { _id: false });

const ChemicalRequisitionSchema = new mongoose.Schema({
  date: { type: String, required: true, index: true },     // "YYYY-MM-DD" (local)
  roomSlug: { type: String, required: true, index: true },
  instrumentId: { type: String, required: true },
  instrumentName: { type: String, default: '' },
  itemType: { type: String, enum: ['solvent'], default: 'solvent' },
  solventId: { type: String, required: true, index: true },
  solventName: { type: String, default: '' },
  qty: { type: Number, required: true },
  unit: { type: String, default: 'bottle' },
  note: { type: String, default: '' },
  requestedBy: { type: PersonSchema, default: undefined },
}, { timestamps: true });

ChemicalRequisitionSchema.index({ roomSlug: 1, date: 1 });
ChemicalRequisitionSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('ChemicalRequisition', ChemicalRequisitionSchema);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && node --test models/ChemicalRequisition.test.js`
Expected: PASS — `tests 4 / pass 4 / fail 0`.

- [ ] **Step 5: Commit**

```bash
git add -- server/models/ChemicalRequisition.js server/models/ChemicalRequisition.test.js
git commit -m "feat(stock): ChemicalRequisition model for daily-check solvent requisition" -- server/models/ChemicalRequisition.js server/models/ChemicalRequisition.test.js
```

---

### Task 2: Backend pure helpers + test

**Files:**
- Create: `server/lib/chemicalRequisition.js`
- Test: `server/lib/chemicalRequisition.test.js`

**Interfaces:**
- Produces:
  - `todayStr(d = new Date()) -> "YYYY-MM-DD"` (local time).
  - `buildDeductNote(instrumentName, note) -> string` — StockTransaction note ที่ฝังชื่อเครื่อง.
  - `normalizeReqInput(body) -> { error: string } | { value: { roomSlug, date, instrumentId, instrumentName, solventId, qty:Number, note, requestedBy:{email,name} } }`.

- [ ] **Step 1: Write the failing test** — create `server/lib/chemicalRequisition.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { todayStr, buildDeductNote, normalizeReqInput } = require('./chemicalRequisition');

test('todayStr formats YYYY-MM-DD (local)', () => {
  assert.strictEqual(todayStr(new Date(2026, 6, 3)), '2026-07-03');
  assert.strictEqual(todayStr(new Date(2026, 11, 9)), '2026-12-09');
});

test('buildDeductNote embeds instrument + optional note', () => {
  assert.strictEqual(buildDeductNote('GC 8890', ''), 'เบิกให้ GC 8890');
  assert.strictEqual(buildDeductNote('GC 8890', 'lot A'), 'เบิกให้ GC 8890 — lot A');
  assert.strictEqual(buildDeductNote('', ''), 'เบิกให้ -');
});

test('normalizeReqInput rejects bad input', () => {
  assert.ok(normalizeReqInput({ instrumentId: 'x', qty: 1 }).error);   // no solventId
  assert.ok(normalizeReqInput({ solventId: 's', qty: 1 }).error);      // no instrumentId
  assert.ok(normalizeReqInput({ solventId: 's', instrumentId: 'x', qty: 0 }).error);
  assert.ok(normalizeReqInput({ solventId: 's', instrumentId: 'x', qty: -2 }).error);
  assert.ok(normalizeReqInput({ solventId: 's', instrumentId: 'x', qty: 'abc' }).error);
});

test('normalizeReqInput normalizes good input (coerces qty, trims requestedBy)', () => {
  const { value, error } = normalizeReqInput({
    solventId: 's1', instrumentId: 'LD-004', instrumentName: 'GC 8890',
    qty: '2', roomSlug: 'analysis', date: '2026-07-03', note: 'x',
    requestedBy: { email: 'a@b.c', name: 'Ann' },
  });
  assert.strictEqual(error, undefined);
  assert.strictEqual(value.qty, 2);
  assert.strictEqual(value.instrumentName, 'GC 8890');
  assert.strictEqual(value.requestedBy.name, 'Ann');
  assert.strictEqual(value.date, '2026-07-03');
  assert.strictEqual(value.roomSlug, 'analysis');
});

test('normalizeReqInput defaults date to today + roomSlug to analysis', () => {
  const { value } = normalizeReqInput({ solventId: 's', instrumentId: 'x', qty: 1 });
  assert.match(value.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.strictEqual(value.roomSlug, 'analysis');
  assert.strictEqual(value.requestedBy.name, '');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && node --test lib/chemicalRequisition.test.js`
Expected: FAIL — `Cannot find module './chemicalRequisition'`.

- [ ] **Step 3: Write the helpers** — create `server/lib/chemicalRequisition.js`:

```js
// Pure helpers for chemical (solvent) requisition — no DB, unit-tested.

const todayStr = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// StockTransaction note that records which machine got the solvent.
const buildDeductNote = (instrumentName, note) =>
  `เบิกให้ ${instrumentName || '-'}${note ? ` — ${note}` : ''}`;

// Validate + normalize a POST body. Returns { error } or { value }.
function normalizeReqInput(body) {
  const b = body || {};
  const qty = Number(b.qty);
  if (!b.solventId) return { error: 'solventId ต้องระบุ' };
  if (!b.instrumentId) return { error: 'instrumentId ต้องระบุ' };
  if (!Number.isFinite(qty) || qty <= 0) return { error: 'จำนวนไม่ถูกต้อง' };
  const rb = b.requestedBy || {};
  return {
    value: {
      roomSlug: String(b.roomSlug || 'analysis'),
      date: b.date ? String(b.date) : todayStr(),
      instrumentId: String(b.instrumentId),
      instrumentName: b.instrumentName ? String(b.instrumentName) : '',
      solventId: String(b.solventId),
      qty,
      note: b.note ? String(b.note) : '',
      requestedBy: {
        email: rb.email ? String(rb.email) : '',
        name: rb.name ? String(rb.name) : '',
      },
    },
  };
}

module.exports = { todayStr, buildDeductNote, normalizeReqInput };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && node --test lib/chemicalRequisition.test.js`
Expected: PASS — `tests 5 / pass 5 / fail 0`.

- [ ] **Step 5: Commit**

```bash
git add -- server/lib/chemicalRequisition.js server/lib/chemicalRequisition.test.js
git commit -m "feat(stock): pure helpers for chemical requisition (validate/note/date)" -- server/lib/chemicalRequisition.js server/lib/chemicalRequisition.test.js
```

---

### Task 3: Backend route `/chemical-requisitions` + register

**Files:**
- Create: `server/routes/chemical-requisitions.js`
- Modify: `server/index.js` (add one `mountApi` line near the other daily-check routes, ~line 57)

**Interfaces:**
- Consumes: `StockSolvent` (`server/models/Stock.js`), `StockTransaction`, `ChemicalRequisition` (Task 1), `{ buildDeductNote, normalizeReqInput }` (Task 2).
- Produces HTTP:
  - `GET /chemical-requisitions?room=&date=` → `{ data: ChemicalRequisition[] }` (newest-first).
  - `POST /chemical-requisitions` body `{ roomSlug, date, instrumentId, instrumentName, solventId, qty, note?, requestedBy:{email,name} }` → `201 { requisition, solvent }` | `400 { error }` | `404 { error }`.
  - `DELETE /chemical-requisitions/:id` → `{ ok:true, solvent }` | `404`.

> **Note on tests:** ตัว route แตะ DB (atomic `$inc`) ซึ่งรีโปนี้ไม่มี test harness แบบ live DB — logic ที่ test ได้ถูกดึงไป Task 2 แล้ว. Task นี้ตรวจด้วย (ก) โหลดไฟล์ไม่ error, (ข) manual E2E ใน Task 7.

- [ ] **Step 1: Write the route** — create `server/routes/chemical-requisitions.js`:

```js
const express = require('express');
const router = express.Router();
const { StockSolvent } = require('../models/Stock');
const StockTransaction = require('../models/StockTransaction');
const ChemicalRequisition = require('../models/ChemicalRequisition');
const { buildDeductNote, normalizeReqInput } = require('../lib/chemicalRequisition');

async function logTx(data) {
  try { await StockTransaction.create(data); }
  catch (err) { console.error('logTransaction failed:', err.message); }
}

// GET /chemical-requisitions?room=&date=
router.get('/', async (req, res) => {
  try {
    const { room, date } = req.query;
    const q = {};
    if (room) q.roomSlug = String(room);
    if (date && date !== 'all') q.date = String(date);
    const rows = await ChemicalRequisition.find(q).sort({ createdAt: -1 }).lean();
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /chemical-requisitions — atomic deduct + log + record
router.post('/', async (req, res) => {
  try {
    const norm = normalizeReqInput(req.body);
    if (norm.error) return res.status(400).json({ error: norm.error });
    const v = norm.value;

    const solvent = await StockSolvent.findById(v.solventId);
    if (!solvent) return res.status(404).json({ error: 'ไม่พบสารเคมี' });

    // atomic — guards against negative qty / race
    const updated = await StockSolvent.findOneAndUpdate(
      { _id: v.solventId, qty: { $gte: v.qty } },
      { $inc: { qty: -v.qty } },
      { new: true },
    );
    if (!updated) return res.status(400).json({ error: 'จำนวน stock ไม่พอ' });

    await logTx({
      itemType: 'solvent',
      itemId: solvent._id.toString(),
      itemName: solvent.name,
      action: 'deduct',
      beforeQty: updated.qty + v.qty,
      afterQty: updated.qty,
      delta: -v.qty,
      unit: 'bottle',
      note: buildDeductNote(v.instrumentName, v.note),
      userEmail: v.requestedBy.email,
      userName: v.requestedBy.name,
    });

    const requisition = await ChemicalRequisition.create({
      date: v.date,
      roomSlug: v.roomSlug,
      instrumentId: v.instrumentId,
      instrumentName: v.instrumentName,
      itemType: 'solvent',
      solventId: solvent._id.toString(),
      solventName: solvent.name,
      qty: v.qty,
      unit: 'bottle',
      note: v.note,
      requestedBy: v.requestedBy,
    });

    res.status(201).json({ requisition, solvent: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /chemical-requisitions/:id — soft-delete + restore qty
router.delete('/:id', async (req, res) => {
  try {
    const doc = await ChemicalRequisition.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'ไม่พบรายการ' });

    let restored = null;
    if (doc.solventId) {
      restored = await StockSolvent.findByIdAndUpdate(
        doc.solventId,
        { $inc: { qty: doc.qty } },
        { new: true },
      );
    }
    if (restored) {
      await logTx({
        itemType: 'solvent',
        itemId: doc.solventId,
        itemName: doc.solventName,
        action: 'receive',
        beforeQty: restored.qty - doc.qty,
        afterQty: restored.qty,
        delta: doc.qty,
        unit: 'bottle',
        note: `ยกเลิกเบิก ${doc.instrumentName || '-'}`,
      });
    }
    await doc.softDelete(doc.requestedBy?.name || 'system');
    res.json({ ok: true, solvent: restored || null });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 2: Register the route** — in `server/index.js`, add after the `equipment-checks` line (~line 57):

```js
mountApi('/equipment-checks', require('./routes/equipment-checks'));
mountApi('/chemical-requisitions', require('./routes/chemical-requisitions')); // เบิกสารเคมี (solvent) → เครื่อง
```

- [ ] **Step 3: Verify the route file loads without error**

Run: `cd server && node -e "require('./routes/chemical-requisitions'); console.log('route OK')"`
Expected: prints `route OK` (no syntax/require error). (Mongoose model registers without a DB connection.)

- [ ] **Step 4: Re-run backend tests (nothing broke)**

Run: `cd server && node --test lib/chemicalRequisition.test.js models/ChemicalRequisition.test.js`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add -- server/routes/chemical-requisitions.js server/index.js
git commit -m "feat(stock): /chemical-requisitions route (atomic deduct + record + restore on delete)" -- server/routes/chemical-requisitions.js server/index.js
```

---

### Task 4: Frontend pure helpers + Vitest

**Files:**
- Create: `src/lib/chemicalRequisition.ts`
- Test: `src/lib/chemicalRequisition.test.ts`

**Interfaces:**
- Produces:
  - `interface ChemicalRequisition { _id; date; roomSlug; instrumentId; instrumentName; itemType:"solvent"; solventId; solventName; qty:number; unit:string; note:string; requestedBy:{email:string;name:string}; createdAt?:string }`
  - `todayStr(d?: Date) -> string`
  - `groupRequisitionsByInstrument(reqs) -> Record<string, ChemicalRequisition[]>`
  - `validateRequisitionQty(qty:number, remaining:number) -> string` ("" = ok)

- [ ] **Step 1: Write the failing test** — create `src/lib/chemicalRequisition.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  groupRequisitionsByInstrument,
  validateRequisitionQty,
  todayStr,
  type ChemicalRequisition,
} from "./chemicalRequisition";

const mk = (over: Partial<ChemicalRequisition>): ChemicalRequisition => ({
  _id: "x", date: "2026-07-03", roomSlug: "analysis",
  instrumentId: "LD-004", instrumentName: "GC 8890", itemType: "solvent",
  solventId: "s1", solventName: "Methanol", qty: 1, unit: "bottle",
  note: "", requestedBy: { email: "", name: "" }, ...over,
});

describe("groupRequisitionsByInstrument", () => {
  it("groups rows by instrumentId", () => {
    const g = groupRequisitionsByInstrument([
      mk({ instrumentId: "LD-004" }),
      mk({ instrumentId: "LD-004" }),
      mk({ instrumentId: "LD-003" }),
    ]);
    expect(g["LD-004"]).toHaveLength(2);
    expect(g["LD-003"]).toHaveLength(1);
    expect(g["LD-001"]).toBeUndefined();
  });
  it("empty input → empty map", () => {
    expect(groupRequisitionsByInstrument([])).toEqual({});
  });
});

describe("validateRequisitionQty", () => {
  it("ok within stock", () => expect(validateRequisitionQty(2, 5)).toBe(""));
  it("ok exactly at stock", () => expect(validateRequisitionQty(5, 5)).toBe(""));
  it("zero / negative invalid", () => {
    expect(validateRequisitionQty(0, 5)).toBe("กรุณาระบุจำนวน");
    expect(validateRequisitionQty(-1, 5)).toBe("กรุณาระบุจำนวน");
  });
  it("over stock", () => expect(validateRequisitionQty(6, 5)).toBe("จำนวน stock ไม่พอ"));
});

describe("todayStr", () => {
  it("formats YYYY-MM-DD", () => expect(todayStr(new Date(2026, 6, 3))).toBe("2026-07-03"));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/chemicalRequisition.test.ts`
Expected: FAIL — cannot resolve `./chemicalRequisition`.

- [ ] **Step 3: Write the helpers** — create `src/lib/chemicalRequisition.ts`:

```ts
export interface ChemicalRequisition {
  _id: string;
  date: string;
  roomSlug: string;
  instrumentId: string;
  instrumentName: string;
  itemType: "solvent";
  solventId: string;
  solventName: string;
  qty: number;
  unit: string;
  note: string;
  requestedBy: { email: string; name: string };
  createdAt?: string;
}

export const todayStr = (d: Date = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export function groupRequisitionsByInstrument(
  reqs: ChemicalRequisition[],
): Record<string, ChemicalRequisition[]> {
  const map: Record<string, ChemicalRequisition[]> = {};
  for (const r of reqs) {
    if (!map[r.instrumentId]) map[r.instrumentId] = [];
    map[r.instrumentId].push(r);
  }
  return map;
}

/** "" = ok; otherwise a Thai error message. */
export function validateRequisitionQty(qty: number, remaining: number): string {
  if (!Number.isFinite(qty) || qty <= 0) return "กรุณาระบุจำนวน";
  if (qty > remaining) return "จำนวน stock ไม่พอ";
  return "";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/chemicalRequisition.test.ts`
Expected: PASS — all specs green.

- [ ] **Step 5: Commit**

```bash
git add -- src/lib/chemicalRequisition.ts src/lib/chemicalRequisition.test.ts
git commit -m "feat(daily-check): pure helpers for chemical requisition (group/validate/date)" -- src/lib/chemicalRequisition.ts src/lib/chemicalRequisition.test.ts
```

---

### Task 5: API layer methods

**Files:**
- Modify: `src/lib/api.ts` (add import near line 11–17; add 3 methods in the stock section, e.g. after `receiveSolvent` ~line 249)

**Interfaces:**
- Consumes: `ChemicalRequisition` (Task 4), `StockSolventItem` (existing).
- Produces on the `api` object:
  - `getChemicalRequisitions({ room, date? }) -> Promise<ChemicalRequisition[]>`
  - `createChemicalRequisition(body) -> Promise<{ requisition: ChemicalRequisition; solvent: StockSolventItem }>`
  - `deleteChemicalRequisition(id) -> Promise<{ ok: true }>`

- [ ] **Step 1: Add the import** — near the other `import type` lines at the top of `src/lib/api.ts` (after line 17):

```ts
import type { ChemicalRequisition } from "@/lib/chemicalRequisition";
```

- [ ] **Step 2: Add the methods** — inside the `api` object, right after the `receiveSolvent` method (`~line 249`):

```ts
  // Chemical requisition — เบิกสารเคมี (solvent) → เครื่อง (daily-check/analysis)
  getChemicalRequisitions: (params: { room: string; date?: string }) => {
    const qs =
      "?" +
      new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v != null && v !== "")
          .map(([k, v]) => [k, String(v)]),
      ).toString();
    return request<{ data: ChemicalRequisition[] }>(`/chemical-requisitions${qs}`).then((r) => r.data);
  },
  createChemicalRequisition: (body: {
    roomSlug: string;
    date: string;
    instrumentId: string;
    instrumentName: string;
    solventId: string;
    qty: number;
    note?: string;
    requestedBy: { email: string; name: string };
  }) =>
    request<{ requisition: ChemicalRequisition; solvent: StockSolventItem }>(
      "/chemical-requisitions",
      { method: "POST", body: JSON.stringify(body) },
    ),
  deleteChemicalRequisition: (id: string) =>
    request<{ ok: true }>(`/chemical-requisitions/${id}`, { method: "DELETE" }),
```

- [ ] **Step 3: Typecheck (no new errors vs baseline)**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no error mentioning `src/lib/api.ts` or `chemicalRequisition` (pre-existing ~12 baseline errors in other files are unchanged).

- [ ] **Step 4: Commit**

```bash
git add -- src/lib/api.ts
git commit -m "feat(api): chemical requisition endpoints (get/create/delete)" -- src/lib/api.ts
```

---

### Task 6: `ChemicalRequisitionDialog` component

**Files:**
- Create: `src/components/lis/daily-check/ChemicalRequisitionDialog.tsx`

**Interfaces:**
- Consumes: `api.getSolvents`, `api.createChemicalRequisition` (Task 5), `validateRequisitionQty`, `todayStr` (Task 4), `StockQrScanner` (`@/components/lis/StockQrScanner`), `useAuth`, `RoomInstrument` type (`@/lib/roomEquipment`), `parseScannedQrId` is handled inside `StockQrScanner` (it returns the bare id via `onScanned`).
- Produces: default export `ChemicalRequisitionDialog` with props:

```ts
interface Props {
  roomSlug: string;
  instruments: { id: string; name: string }[];
  presetInstrumentId?: string;
  onClose: () => void;
  onSaved: () => void;   // parent invalidates queries
}
```

- [ ] **Step 1: Write the component** — create `src/components/lis/daily-check/ChemicalRequisitionDialog.tsx`:

```tsx
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Check, ChevronsUpDown, QrCode } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import StockQrScanner from "@/components/lis/StockQrScanner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { validateRequisitionQty, todayStr } from "@/lib/chemicalRequisition";
import type { StockSolventItem } from "@/types/stock";

interface Props {
  roomSlug: string;
  instruments: { id: string; name: string }[];
  presetInstrumentId?: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function ChemicalRequisitionDialog({
  roomSlug, instruments, presetInstrumentId, onClose, onSaved,
}: Props) {
  const { user } = useAuth();
  const [instrumentId, setInstrumentId] = useState(presetInstrumentId ?? "");
  const [solventId, setSolventId] = useState("");
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const [pickOpen, setPickOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  const { data: solvents = [] } = useQuery({
    queryKey: ["stock", "solvents"],
    queryFn: api.getSolvents,
  });

  const solvent = useMemo(
    () => (solvents as StockSolventItem[]).find((s) => s._id === solventId) || null,
    [solvents, solventId],
  );
  const remaining = solvent?.qty ?? 0;
  const qtyNum = Number(qty);
  const qtyError = solvent ? validateRequisitionQty(qtyNum, remaining) : "";
  const canSave = !!instrumentId && !!solventId && !qtyError && !!user?.name;

  const onScanned = (id: string) => {
    setScanOpen(false);
    const found = (solvents as StockSolventItem[]).find((s) => s._id === id);
    if (!found) { toast.error("ไม่พบสารเคมีจาก QR นี้"); return; }
    setSolventId(found._id);
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      api.createChemicalRequisition({
        roomSlug,
        date: todayStr(),
        instrumentId,
        instrumentName: instruments.find((i) => i.id === instrumentId)?.name ?? "",
        solventId,
        qty: qtyNum,
        note: note || undefined,
        requestedBy: { email: user?.email ?? "", name: user?.name ?? "" },
      }),
    onSuccess: () => {
      toast.success(`เบิก ${solvent?.name ?? "สารเคมี"} ${qtyNum} ขวดแล้ว`);
      onSaved();
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || "บันทึกไม่สำเร็จ"),
  });

  return (
    <>
      <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>เบิกสารเคมี</DialogTitle>
            <DialogDescription>เลือกเครื่องและสารเคมี (solvent) ที่จะเบิก</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* เครื่อง */}
            <div>
              <Label className="mb-1.5 block">เครื่อง</Label>
              <div className="flex flex-wrap gap-1.5">
                {instruments.map((ins) => (
                  <Button
                    key={ins.id}
                    type="button"
                    size="sm"
                    variant={instrumentId === ins.id ? "default" : "outline"}
                    className="h-8 text-xs"
                    onClick={() => setInstrumentId(ins.id)}
                  >
                    {ins.name}
                  </Button>
                ))}
              </div>
            </div>

            {/* สารเคมี */}
            <div>
              <Label className="mb-1.5 block">สารเคมี (solvent)</Label>
              <div className="flex gap-2">
                <Popover open={pickOpen} onOpenChange={setPickOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="flex-1 justify-between font-normal">
                      <span className="truncate">
                        {solvent ? `${solvent.name} (คงเหลือ ${solvent.qty})` : "เลือกสารเคมี..."}
                      </span>
                      <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-0" align="start">
                    <Command>
                      <CommandInput placeholder="ค้นหาชื่อสารเคมี" />
                      <CommandList>
                        <CommandEmpty>ไม่พบรายการ</CommandEmpty>
                        {(solvents as StockSolventItem[]).map((s) => (
                          <CommandItem
                            key={s._id}
                            value={s.name}
                            onSelect={() => { setSolventId(s._id); setPickOpen(false); }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", solventId === s._id ? "opacity-100" : "opacity-0")} />
                            <span className="flex-1">{s.name}</span>
                            <span className="text-xs text-muted-foreground tabular-nums">คงเหลือ {s.qty}</span>
                          </CommandItem>
                        ))}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Button type="button" variant="outline" size="icon" onClick={() => setScanOpen(true)} title="สแกนบาร์โค้ด">
                  <QrCode className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* จำนวน */}
            <div>
              <Label className="mb-1.5 block">จำนวน (ขวด)</Label>
              <Input
                type="number" min="1" value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
              {qtyError && <p className="mt-1 text-sm text-destructive">{qtyError}</p>}
            </div>

            {/* หมายเหตุ */}
            <div>
              <Label className="mb-1.5 block">หมายเหตุ</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" />
            </div>

            <div>
              <Label className="mb-1.5 block">ผู้เบิก</Label>
              <Input value={user?.name ?? ""} readOnly disabled className="bg-muted/40" />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
            <Button
              type="button"
              disabled={!canSave || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? "กำลังบันทึก..." : "เบิก"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <StockQrScanner
        open={scanOpen}
        title="สแกนบาร์โค้ดสารเคมี"
        onClose={() => setScanOpen(false)}
        onScanned={onScanned}
      />
    </>
  );
}
```

- [ ] **Step 2: Typecheck (no new errors vs baseline)**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no error referencing `ChemicalRequisitionDialog.tsx` (baseline errors elsewhere unchanged). If `useAuth`'s `user` type lacks `email`/`name`, use the same access pattern already used in `RoomEquipmentCheckPage.tsx` (`user?.name`, `user?.email`) — those are known-valid there.

- [ ] **Step 3: Commit**

```bash
git add -- src/components/lis/daily-check/ChemicalRequisitionDialog.tsx
git commit -m "feat(daily-check): ChemicalRequisitionDialog (pick/scan solvent → machine, deduct)" -- src/components/lis/daily-check/ChemicalRequisitionDialog.tsx
```

---

### Task 7: Wire into `RoomEquipmentCheckPage` (analysis only)

**Files:**
- Modify: `src/pages/daily-check/RoomEquipmentCheckPage.tsx`

**Interfaces:**
- Consumes: `ANALYSIS_ROOM_SLUG` (`@/lib/analysisInstruments`), `groupRequisitionsByInstrument`, `todayStr` (Task 4), `api.getChemicalRequisitions`/`api.deleteChemicalRequisition` (Task 5), `ChemicalRequisitionDialog` (Task 6). Page already has `useAuth`, `fmtTime`, `queryClient`, `instruments`.

> The page is shared by sample-prep/analysis/extraction. All new UI is gated behind `roomSlug === ANALYSIS_ROOM_SLUG`, so other rooms render exactly as before.

- [ ] **Step 1: Add imports** — at the top of `src/pages/daily-check/RoomEquipmentCheckPage.tsx`, alongside existing imports:

```tsx
import { Plus, X, FlaskConical } from "lucide-react";
import { ANALYSIS_ROOM_SLUG } from "@/lib/analysisInstruments";
import {
  groupRequisitionsByInstrument,
  todayStr as reqTodayStr,
} from "@/lib/chemicalRequisition";
import ChemicalRequisitionDialog from "@/components/lis/daily-check/ChemicalRequisitionDialog";
```

(Keep the existing `lucide-react` import line; merge `Plus, X, FlaskConical` into it if you prefer a single import. `CheckCircle2, Clock, AlertTriangle, RotateCcw` are already imported.)

- [ ] **Step 2: Add requisition state + queries** — inside the component, after the existing `createMutation` (before the `if (!room || !catalog)` early-return), add:

```tsx
  const isAnalysis = roomSlug === ANALYSIS_ROOM_SLUG;
  const [reqDialog, setReqDialog] = useState<{ open: boolean; presetInstrumentId?: string }>({ open: false });

  const { data: requisitions = [] } = useQuery({
    queryKey: ["chemical-requisitions", roomSlug, reqTodayStr()],
    queryFn: () => api.getChemicalRequisitions({ room: roomSlug, date: reqTodayStr() }),
    enabled: isAnalysis,
    refetchOnWindowFocus: true,
  });

  const reqByInstrument = useMemo(() => groupRequisitionsByInstrument(requisitions), [requisitions]);

  const deleteReqMutation = useMutation({
    mutationFn: (id: string) => api.deleteChemicalRequisition(id),
    onSuccess: () => {
      toast.success("ยกเลิกการเบิกแล้ว (คืนสต็อก)");
      queryClient.invalidateQueries({ queryKey: ["chemical-requisitions"] });
      queryClient.invalidateQueries({ queryKey: ["stock", "solvents"] });
    },
    onError: (err: Error) => toast.error(err.message || "ยกเลิกไม่สำเร็จ"),
  });

  const onReqSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["chemical-requisitions"] });
    queryClient.invalidateQueries({ queryKey: ["stock", "solvents"] });
    queryClient.invalidateQueries({ queryKey: ["stock", "transactions"] });
  };
```

> `useMemo` and `useState` are already imported (line 1). `useMutation`/`useQuery`/`queryClient`/`toast`/`api` are already imported.

- [ ] **Step 3: Add the top "เบิกสารเคมีวันนี้" card** — in the returned JSX, immediately **after** the header `<div className="mb-4 ...">…</div>` block (the one with the "ตรวจแล้ว/ปกติ" badges) and **before** `<div className="space-y-6">`, insert:

```tsx
      {isAnalysis && (
        <Card className="mb-6 border-primary/20">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-primary" /> เบิกสารเคมีวันนี้
            </CardTitle>
            <Button size="sm" onClick={() => setReqDialog({ open: true })}>
              <Plus className="w-4 h-4 mr-1" /> เบิกสารเคมี
            </Button>
          </CardHeader>
          <CardContent>
            {requisitions.length === 0 ? (
              <p className="text-sm text-muted-foreground">ยังไม่มีการเบิกวันนี้</p>
            ) : (
              <ul className="divide-y">
                {requisitions.map((r) => (
                  <li key={r._id} className="flex items-center gap-2 py-1.5 text-sm">
                    <span className="text-xs text-muted-foreground tabular-nums w-12">
                      {r.createdAt ? fmtTime(r.createdAt) : ""}
                    </span>
                    <span className="font-medium">{r.solventName}</span>
                    <span className="text-muted-foreground">× {r.qty} ขวด</span>
                    <span className="text-muted-foreground">→ {r.instrumentName}</span>
                    {r.requestedBy?.name && (
                      <span className="text-xs text-muted-foreground">· {r.requestedBy.name}</span>
                    )}
                    <button
                      className="ml-auto text-muted-foreground hover:text-destructive"
                      title="ยกเลิกการเบิก (คืนสต็อก)"
                      disabled={deleteReqMutation.isPending}
                      onClick={() => {
                        if (window.confirm(`ยกเลิกการเบิก ${r.solventName} × ${r.qty} ขวด และคืนสต็อก?`)) {
                          deleteReqMutation.mutate(r._id);
                        }
                      }}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
```

- [ ] **Step 4: Add per-machine requisition block + button** — inside the instrument card's `<CardContent>`, after the "recorder" `<div>` and before the `showResult ? (...) : (...)` save-button block, insert:

```tsx
                        {isAnalysis && (
                          <div className="border-t pt-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-medium text-muted-foreground">สารเคมีที่เบิกวันนี้</span>
                              <Button
                                type="button" size="sm" variant="ghost" className="h-7 text-xs gap-1"
                                onClick={() => setReqDialog({ open: true, presetInstrumentId: instrument.id })}
                              >
                                <Plus className="w-3.5 h-3.5" /> เบิกให้เครื่องนี้
                              </Button>
                            </div>
                            {(reqByInstrument[instrument.id] ?? []).length === 0 ? (
                              <p className="text-xs text-muted-foreground/70">—</p>
                            ) : (
                              <ul className="space-y-0.5">
                                {(reqByInstrument[instrument.id] ?? []).map((r) => (
                                  <li key={r._id} className="text-xs text-muted-foreground">
                                    {r.solventName} × {r.qty} ขวด
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
```

- [ ] **Step 5: Render the dialog** — at the very end of the returned fragment, just before the closing `</>`, add:

```tsx
      {reqDialog.open && (
        <ChemicalRequisitionDialog
          roomSlug={roomSlug}
          instruments={instruments.map((i) => ({ id: i.id, name: i.name }))}
          presetInstrumentId={reqDialog.presetInstrumentId}
          onClose={() => setReqDialog({ open: false })}
          onSaved={onReqSaved}
        />
      )}
```

- [ ] **Step 6: Typecheck (no new errors vs baseline)**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no error referencing `RoomEquipmentCheckPage.tsx` (baseline errors elsewhere unchanged).

- [ ] **Step 7: Run the full frontend test suite (nothing broke)**

Run: `npm test`
Expected: all suites pass (incl. `chemicalRequisition.test.ts`).

- [ ] **Step 8: Commit**

```bash
git add -- src/pages/daily-check/RoomEquipmentCheckPage.tsx
git commit -m "feat(daily-check): wire chemical requisition into analysis room (top card + per-machine)" -- src/pages/daily-check/RoomEquipmentCheckPage.tsx
```

---

### Task 8: Manual E2E verification (on user's machine, both processes running)

> No commit. Requires backend (`cd server && npm run dev`) + frontend (`npm run dev`) + at least one `StockSolvent` with `qty > 0`. Do this with the user.

- [ ] **Step 1:** เปิด `/daily-check/analysis`. ยืนยันว่ามีการ์ด **"เบิกสารเคมีวันนี้"** ด้านบน + แต่ละการ์ดเครื่องมีบล็อก "สารเคมีที่เบิกวันนี้" + ปุ่ม "เบิกให้เครื่องนี้". เปิด `/daily-check/sample-prep` แล้วยืนยันว่า **ไม่มี** ส่วนนี้ (gate ทำงาน).
- [ ] **Step 2:** กด "เบิกสารเคมี" → เลือกเครื่อง GC 8890 → เลือก solvent A → จำนวน 2 → เบิก. คาดหวัง: toast สำเร็จ, รายการโผล่ทั้งการ์ดรวมและใต้การ์ด GC 8890, และ `qty` ของ solvent A ในหน้า Stock ลดลง 2.
- [ ] **Step 3:** ตรวจ Stock transactions — มี log `deduct` unit `bottle` note `"เบิกให้ GC 8890"`.
- [ ] **Step 4:** กดปุ่ม X ที่รายการ → ยืนยัน → รายการหาย + `qty` solvent คืนกลับ +2 + มี transaction `receive` note `"ยกเลิกเบิก GC 8890"`.
- [ ] **Step 5:** เบิกจำนวนเกินคงเหลือ → ปุ่ม "เบิก" disabled + ข้อความ "จำนวน stock ไม่พอ"; ถ้าฝืนยิง (race) backend ตอบ 400.
- [ ] **Step 6:** กดปุ่มสแกน (QrCode) → สแกนสติกเกอร์ solvent (QR = `_id`) → solvent ถูกเลือกอัตโนมัติ. สแกนสติกเกอร์ที่ไม่ใช่ solvent → toast "ไม่พบสารเคมีจาก QR นี้".
- [ ] **Step 7:** (ถ้าโรลผู้ใช้ไม่ใช่ admin) ยืนยันว่าโรล Lab เข้าถึง `/chemical-requisitions` + `/stock/solvents` ได้ — ถ้าโดน 403/permission ให้เพิ่ม path ในสิทธิ์โรล Lab (Access Control) แล้วทดสอบซ้ำ.

---

## Self-Review

**Spec coverage:**
- §3.1 log + ตัดสต็อก → Task 3 (POST หัก + record + logTx). ✓
- §3.2 solvent เท่านั้น → model `itemType` enum `['solvent']`, UI ใช้ `getSolvents`. ✓
- §3.3 เลือก/สแกน → Task 6 (combobox + `StockQrScanner`, match `_id`). ✓
- §3.4 จำนวนขวด default 1 + กันเกิน → `validateRequisitionQty` (Task 4) + atomic `$gte` (Task 3). ✓
- §3.5 เลือกเครื่อง → Task 6 machine buttons. ✓
- §3.6 แสดง 2 แบบ → Task 7 (การ์ดรวม + ใต้การ์ด). ✓
- §3.7 ลบ + คืน qty → Task 3 DELETE + Task 7 X button. ✓
- §4 model → Task 1. ✓  §5 routes → Task 3. ✓  §6 frontend → Tasks 5–7. ✓  §7 pure logic → Tasks 2 & 4. ✓
- §8 edge cases: สแกนผิดสาร (Task 6 toast), สต็อกไม่พอ (Task 3+4), race (atomic), ลบหลัง solvent หาย (Task 3 `if (restored)`), qty 0 (validate). ✓
- §9 permissions → Task 8 Step 7. ✓  §10 testing → Tasks 1,2,4 + Task 8. ✓

**Placeholder scan:** ไม่มี TBD/TODO; ทุก step มีโค้ด/คำสั่งจริง. ✓

**Type consistency:** `ChemicalRequisition` (fields ตรงกันทั้ง TS Task 4 และ model Task 1); `createChemicalRequisition` body ตรงกับ POST `normalizeReqInput` ที่รับ (`roomSlug, date, instrumentId, instrumentName, solventId, qty, note, requestedBy`); `groupRequisitionsByInstrument`/`validateRequisitionQty`/`todayStr` ชื่อตรงกันทุกจุดที่เรียก; dialog props `instruments: {id,name}[]` ตรงกับที่ page ส่ง (`instruments.map(i => ({id, name}))`). ✓

---

## Execution Handoff

Plan complete. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks.
2. **Inline Execution** — execute in this session with checkpoints.
