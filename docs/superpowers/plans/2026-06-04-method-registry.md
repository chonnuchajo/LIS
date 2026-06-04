# Method Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded `GC`/`HPLC` enum with an admin-managed Method registry, let each substance require an AND-set of methods, and generalize Standard Config + Petition Assign to work with any registered method.

**Architecture:** New `Method` Mongoose collection (admin CRUD, seeded with GC/HPLC/Titration/Digest/Reflux). `SimpleMethod` gains `methods: [[String]]` (positional per-substance, each = AND-set of method codes) alongside legacy `instruments`. A shared read-helper bridges old→new during transition. Standard Config seeds default rows from the registry; Petition Assign shows a machine picker for methods with `requiresMachine` and a "bench" chip otherwise. The `BOTH` (either-or) concept is removed entirely; existing `BOTH` slots migrate to empty.

**Tech Stack:** Express 4 + Mongoose 8 (backend), React 18 + TypeScript + Vite + TanStack Query + shadcn/ui (frontend), Vitest + Playwright (tests).

**Spec:** `docs/superpowers/specs/2026-06-04-method-registry-design.md`

---

## Conventions for this plan

- Backend test runner: there is no backend unit-test harness in this repo, so backend logic is verified by **pure helper modules tested with Vitest** (the helper is `require`-able from both server and test) plus manual `curl` smoke checks. Where a step says "Vitest", the test file lives under `src/lib/**` or `server/**/__tests__` and runs via the root `npm run test`.
- Frontend type-check after every frontend task: `npx tsc --noEmit` (NEVER `npm run build` — see CLAUDE.md).
- Commit after each task with explicit pathspec (a concurrent committer may touch `develop`).
- Method codes are uppercase, no spaces (`GC`, `HPLC`, `TITRATION`, `DIGEST`, `REFLUX`).

---

## File Structure

**Create:**
- `server/models/Method.js` — registry model (auto-loads via `loadAllModels()` dir scan)
- `server/routes/methods.js` — CRUD + `ensureDefaults()`
- `server/scripts/migrate-simplemethod-to-methods.js` — one-off migration (dry-run + commit)
- `src/lib/methodRegistry.ts` — shared client types + `readSlotMethods` + `machineMatchesMethod` pure helpers
- `src/lib/methodRegistry.test.ts` — Vitest for the helpers
- `src/pages/MethodSettings.tsx` — admin UI page for the registry
- `src/pages/__tests__/MethodSettings.test.tsx` — component test

**Modify:**
- `server/index.js` — mount `/methods` route
- `server/models/SimpleMethod.js` — add `methods: [[String]]`
- `server/routes/simpleMethods.js` — read/write `methods`, keep `instruments` back-compat
- `server/routes/standardConfigs.js` — seed defaults from registry, validate against registry
- `src/lib/standardConfig.ts` — `Instrument` → `string` method code; registry-aware validation
- `src/lib/standardConfig.test.ts` — update tests
- `src/lib/api.ts` — method registry endpoints + types
- `src/pages/MasterItems.tsx` — multi-select chips, drop BOTH, registry-driven
- `src/pages/StandardConfig.tsx` — registry-driven dropdown + default rows
- `src/pages/PetitionAssignPage.tsx` — per-method machine picker / bench chip, drop BOTH
- `src/lib/navItems.ts` — add `/methods` nav entry
- `src/App.tsx` — add `/methods` route
- `src/pages/Report.tsx`, `src/pages/AdminData.tsx`, `src/data/mockData.ts` — drop GC/HPLC hardcoding where it breaks

---

## Task 1: Method registry model + route + seed

**Files:**
- Create: `server/models/Method.js`
- Create: `server/routes/methods.js`
- Modify: `server/index.js` (route mount, after line 41 `/machines`)

- [ ] **Step 1: Create the model**

`server/models/Method.js`:

```js
const mongoose = require('mongoose');

const MethodSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
  label: { type: String, required: true, trim: true },
  requiresMachine: { type: Boolean, default: false },
  machinePrefix: { type: String, default: '', uppercase: true, trim: true }, // used only when requiresMachine
  defaultTimes: { type: Number, default: 1, min: 1 },
  order: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  builtIn: { type: Boolean, default: false }, // GC/HPLC: cannot delete, cannot change requiresMachine/machinePrefix
}, { timestamps: true });

module.exports = mongoose.model('Method', MethodSchema);
```

- [ ] **Step 2: Create the route with seed + CRUD**

`server/routes/methods.js`:

```js
const express = require('express');
const mongoose = require('mongoose');
const Method = require('../models/Method');
const SimpleMethod = require('../models/SimpleMethod');
const StandardConfig = require('../models/StandardConfig');

const router = express.Router();

const SEED = [
  { code: 'GC',        label: 'GC',        requiresMachine: true,  machinePrefix: 'GC',   defaultTimes: 3, order: 1, builtIn: true },
  { code: 'HPLC',      label: 'HPLC',      requiresMachine: true,  machinePrefix: 'HPLC', defaultTimes: 1, order: 2, builtIn: true },
  { code: 'TITRATION', label: 'Titration', requiresMachine: false, machinePrefix: '',     defaultTimes: 1, order: 3 },
  { code: 'DIGEST',    label: 'Digest',    requiresMachine: false, machinePrefix: '',     defaultTimes: 1, order: 4 },
  { code: 'REFLUX',    label: 'Reflux',    requiresMachine: false, machinePrefix: '',     defaultTimes: 1, order: 5 },
];

// Recreate the seed methods after a DB wipe. Idempotent: only inserts missing codes,
// never overwrites admin edits to existing ones.
async function ensureDefaults() {
  for (const m of SEED) {
    await Method.updateOne({ code: m.code }, { $setOnInsert: m }, { upsert: true });
  }
}

function validateBody(body, { isCreate }) {
  const code = String((body && body.code) || '').trim().toUpperCase();
  const label = String((body && body.label) || '').trim();
  if (isCreate && !/^[A-Z0-9_]+$/.test(code)) {
    return { error: { message: 'code ต้องเป็น A-Z 0-9 _ เท่านั้น', field: 'code' } };
  }
  if (!label) return { error: { message: 'label required', field: 'label' } };
  const requiresMachine = Boolean(body && body.requiresMachine);
  const machinePrefix = requiresMachine
    ? String((body && body.machinePrefix) || '').trim().toUpperCase()
    : '';
  if (requiresMachine && !machinePrefix) {
    return { error: { message: 'วิธีที่มีเครื่องต้องระบุ machinePrefix', field: 'machinePrefix' } };
  }
  const defaultTimes = Number(body && body.defaultTimes);
  if (!Number.isInteger(defaultTimes) || defaultTimes < 1) {
    return { error: { message: 'defaultTimes ต้องเป็นจำนวนเต็ม >= 1', field: 'defaultTimes' } };
  }
  return {
    value: {
      code, label, requiresMachine, machinePrefix, defaultTimes,
      order: Number(body && body.order) || 0,
      active: body && body.active === false ? false : true,
    },
  };
}

router.get('/', async (_req, res) => {
  try {
    await ensureDefaults();
    const docs = await Method.find().sort({ order: 1, code: 1 }).lean();
    res.json(docs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const built = validateBody(req.body, { isCreate: true });
    if (built.error) return res.status(400).json(built.error);
    const existing = await Method.findOne({ code: built.value.code }).lean();
    if (existing) return res.status(409).json({ message: 'code นี้มีอยู่แล้ว', field: 'code' });
    const doc = await Method.create(built.value);
    res.status(201).json(doc.toObject());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(404).json({ message: 'not found' });
    const current = await Method.findById(id).lean();
    if (!current) return res.status(404).json({ message: 'not found' });
    const built = validateBody({ ...req.body, code: current.code }, { isCreate: false });
    if (built.error) return res.status(400).json(built.error);
    // builtIn methods: lock machine wiring, allow label/defaultTimes/order/active.
    const patch = built.value;
    if (current.builtIn) {
      patch.requiresMachine = current.requiresMachine;
      patch.machinePrefix = current.machinePrefix;
    }
    patch.code = current.code; // code immutable after create
    const doc = await Method.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(404).json({ message: 'not found' });
    const doc = await Method.findById(id).lean();
    if (!doc) return res.status(404).json({ message: 'not found' });
    if (doc.builtIn) return res.status(403).json({ message: 'ลบวิธีพื้นฐานไม่ได้ (ปิดการใช้งานแทน)' });
    // Block delete if referenced anywhere.
    const inSimple = await SimpleMethod.findOne({ methods: { $elemMatch: { $elemMatch: { $eq: doc.code } } } }).lean();
    const inStd = await StandardConfig.findOne({ instrument: doc.code }).lean();
    if (inSimple || inStd) {
      return res.status(409).json({ message: 'วิธีนี้ถูกใช้อยู่ ลบไม่ได้ (ปิดการใช้งานแทน)' });
    }
    await Method.findByIdAndDelete(id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 3: Mount the route**

In `server/index.js`, after line 41 (`mountApi('/machines', ...)`), add:

```js
mountApi('/methods', require('./routes/methods'));
```

- [ ] **Step 4: Smoke-test the route**

Start backend (`cd server && npm run dev`), then:

Run: `curl -s http://localhost:3001/api/methods`
Expected: JSON array of 5 seeded methods, GC has `"requiresMachine":true,"machinePrefix":"GC","defaultTimes":3`, TITRATION has `"requiresMachine":false`.

Run: `curl -s -X DELETE http://localhost:3001/api/methods/<GC _id>`
Expected: HTTP 403 `{"message":"ลบวิธีพื้นฐานไม่ได้ ..."}`

- [ ] **Step 5: Export seed + commit**

```bash
npm run seed:export
git add -- server/models/Method.js server/routes/methods.js server/index.js server/seed-data/methods.json server/seed-data/_manifest.json
git commit -m "feat(methods): add admin-managed test-method registry model + route"
```

---

## Task 2: Client API + shared registry helpers

**Files:**
- Modify: `src/lib/api.ts`
- Create: `src/lib/methodRegistry.ts`
- Create: `src/lib/methodRegistry.test.ts`

- [ ] **Step 1: Write the failing helper tests**

`src/lib/methodRegistry.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readSlotMethods, machineMatchesMethod, type MethodDoc } from './methodRegistry';

const GC: MethodDoc = { _id: '1', code: 'GC', label: 'GC', requiresMachine: true, machinePrefix: 'GC', defaultTimes: 3, order: 1, active: true, builtIn: true };
const HPLC: MethodDoc = { _id: '2', code: 'HPLC', label: 'HPLC', requiresMachine: true, machinePrefix: 'HPLC', defaultTimes: 1, order: 2, active: true, builtIn: true };

describe('readSlotMethods', () => {
  it('returns methods field as-is when present', () => {
    expect(readSlotMethods({ methods: [['GC'], ['DIGEST', 'TITRATION']] }, 2)).toEqual([['GC'], ['DIGEST', 'TITRATION']]);
  });
  it('maps legacy instruments string→singleton, BOTH→empty, ""→empty', () => {
    expect(readSlotMethods({ instruments: ['GC', 'BOTH', ''] }, 3)).toEqual([['GC'], [], []]);
  });
  it('pads to substanceCount with empty slots', () => {
    expect(readSlotMethods({ methods: [['GC']] }, 3)).toEqual([['GC'], [], []]);
  });
  it('returns all-empty when nothing configured', () => {
    expect(readSlotMethods({}, 2)).toEqual([[], []]);
  });
});

describe('machineMatchesMethod', () => {
  it('matches machine name prefix to method machinePrefix (HPLC before GC)', () => {
    expect(machineMatchesMethod('HPLC 1260 1', HPLC, [GC, HPLC])).toBe(true);
    expect(machineMatchesMethod('HPLC 1260 1', GC, [GC, HPLC])).toBe(false);
    expect(machineMatchesMethod('GC 7890', GC, [GC, HPLC])).toBe(true);
  });
  it('non-machine method never matches a machine', () => {
    const titr: MethodDoc = { ...GC, code: 'TITRATION', requiresMachine: false, machinePrefix: '' };
    expect(machineMatchesMethod('GC 7890', titr, [GC, HPLC, titr])).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- methodRegistry`
Expected: FAIL — `Cannot find module './methodRegistry'`.

- [ ] **Step 3: Implement the helper module**

`src/lib/methodRegistry.ts`:

```ts
export type MethodDoc = {
  _id: string;
  code: string;
  label: string;
  requiresMachine: boolean;
  machinePrefix: string;
  defaultTimes: number;
  order: number;
  active: boolean;
  builtIn: boolean;
};

export type MethodInput = {
  code?: string;
  label: string;
  requiresMachine: boolean;
  machinePrefix: string;
  defaultTimes: number;
  order?: number;
  active?: boolean;
};

// One SimpleMethod entry as stored. `methods` is the new positional AND-set field;
// `instruments` is the legacy flat field kept for back-compat reads.
type SimpleMethodEntry = { methods?: string[][]; instruments?: string[] };

// Read a SimpleMethod entry into positional AND-sets, length === substanceCount.
// New `methods` wins; otherwise legacy `instruments` maps string→[string], BOTH/""→[].
export function readSlotMethods(entry: SimpleMethodEntry, substanceCount: number): string[][] {
  let slots: string[][];
  if (Array.isArray(entry.methods)) {
    slots = entry.methods.map((s) => (Array.isArray(s) ? s.filter(Boolean) : []));
  } else if (Array.isArray(entry.instruments)) {
    slots = entry.instruments.map((v) => {
      const t = String(v || '').trim().toUpperCase();
      return t && t !== 'BOTH' ? [t] : [];
    });
  } else {
    slots = [];
  }
  const out: string[][] = [];
  for (let i = 0; i < substanceCount; i += 1) out.push(slots[i] ?? []);
  return out;
}

// Does a machine (by name) satisfy a method? Longer prefixes are tried first so
// "HPLC ..." is not misread as "GC ...". Only machine-backed methods can match.
export function machineMatchesMethod(machineName: string, method: MethodDoc, allMethods: MethodDoc[]): boolean {
  if (!method.requiresMachine || !method.machinePrefix) return false;
  const name = String(machineName || '').trim().toUpperCase();
  const prefixes = allMethods
    .filter((m) => m.requiresMachine && m.machinePrefix)
    .map((m) => m.machinePrefix)
    .sort((a, b) => b.length - a.length);
  const winner = prefixes.find((p) => name.startsWith(p));
  return winner === method.machinePrefix;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run test -- methodRegistry`
Expected: PASS (all 6 tests).

- [ ] **Step 5: Add API endpoints + types**

In `src/lib/api.ts`, near `getStandardConfigs` (line ~306), add (and `import type { MethodDoc, MethodInput } from './methodRegistry';` at top):

```ts
  getMethods: () => request<MethodDoc[]>("/methods"),
  createMethod: (data: MethodInput) =>
    request<MethodDoc>("/methods", { method: "POST", body: JSON.stringify(data) }),
  updateMethod: (id: string, data: MethodInput) =>
    request<MethodDoc>(`/methods/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteMethod: (id: string) =>
    request<{ ok: true }>(`/methods/${encodeURIComponent(id)}`, { method: "DELETE" }),
```

- [ ] **Step 6: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add -- src/lib/methodRegistry.ts src/lib/methodRegistry.test.ts src/lib/api.ts
git commit -m "feat(methods): client registry helpers + API endpoints"
```

---

## Task 3: SimpleMethod model + route store `methods`

**Files:**
- Modify: `server/models/SimpleMethod.js`
- Modify: `server/routes/simpleMethods.js`

- [ ] **Step 1: Add `methods` to the model**

`server/models/SimpleMethod.js`:

```js
const mongoose = require('mongoose');

const SimpleMethodSchema = new mongoose.Schema({
  itemNo: { type: String, required: true, unique: true, index: true },
  instruments: { type: [String], default: [] },     // legacy (back-compat read; written until cleanup)
  methods: { type: [[String]], default: undefined }, // positional AND-sets per substance
}, { timestamps: true });

module.exports = mongoose.model('SimpleMethod', SimpleMethodSchema);
```

- [ ] **Step 2: Update the route to accept + return `methods`**

Replace the body of `server/routes/simpleMethods.js` with:

```js
const express = require('express');
const SimpleMethod = require('../models/SimpleMethod');

const router = express.Router();

// Normalize an incoming per-substance AND-set array (string[][]).
// Each slot → array of uppercase non-empty codes, de-duplicated, order preserved.
function normalizeMethods(value) {
  if (!Array.isArray(value)) return [];
  return value.map((slot) => {
    const list = Array.isArray(slot) ? slot : [slot];
    const seen = new Set();
    const out = [];
    for (const entry of list) {
      const code = String(entry || '').trim().toUpperCase();
      if (code && !seen.has(code)) { seen.add(code); out.push(code); }
    }
    return out;
  });
}

router.get('/', async (_req, res) => {
  try {
    const docs = await SimpleMethod.find().lean();
    res.json(docs.map((doc) => ({
      itemNo: doc.itemNo,
      instruments: doc.instruments || [],
      methods: doc.methods, // undefined when not migrated yet → client falls back to instruments
    })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:itemNo', async (req, res) => {
  try {
    const itemNo = String(req.params.itemNo || '').trim();
    if (!itemNo) return res.status(400).json({ message: 'itemNo required' });
    const methods = normalizeMethods(req.body && req.body.methods);
    const doc = await SimpleMethod.findOneAndUpdate(
      { itemNo },
      { $set: { methods } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
    res.json({ itemNo: doc.itemNo, methods: doc.methods || [], instruments: doc.instruments || [] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/', async (req, res) => {
  try {
    const updates = Array.isArray(req.body && req.body.updates) ? req.body.updates : [];
    const ops = updates
      .map((entry) => ({
        itemNo: String((entry && entry.itemNo) || '').trim(),
        methods: normalizeMethods(entry && entry.methods),
      }))
      .filter((entry) => entry.itemNo)
      .map((entry) => ({
        updateOne: {
          filter: { itemNo: entry.itemNo },
          update: { $set: { methods: entry.methods } },
          upsert: true,
        },
      }));
    if (ops.length === 0) return res.json({ matched: 0, upserted: 0 });
    const result = await SimpleMethod.bulkWrite(ops);
    res.json({
      matched: result.matchedCount || 0,
      upserted: (result.upsertedIds && Object.keys(result.upsertedIds).length) || 0,
      modified: result.modifiedCount || 0,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 3: Smoke-test the round-trip**

Restart backend. Run:

```bash
curl -s -X PUT http://localhost:3001/api/simple-methods/__TEST__ \
  -H 'Content-Type: application/json' \
  -d '{"methods":[["DIGEST","TITRATION"],["GC"]]}'
```
Expected: `{"itemNo":"__TEST__","methods":[["DIGEST","TITRATION"],["GC"]],...}`.

Run: `curl -s http://localhost:3001/api/simple-methods | grep __TEST__`
Expected: the entry includes `"methods":[["DIGEST","TITRATION"],["GC"]]`. Then delete it via mongo or leave (harmless test itemNo).

- [ ] **Step 4: Commit**

```bash
git add -- server/models/SimpleMethod.js server/routes/simpleMethods.js
git commit -m "feat(simple-method): store per-substance AND-set methods field"
```

---

## Task 4: Migration script (instruments → methods, BOTH → empty)

**Files:**
- Create: `server/scripts/migrate-simplemethod-to-methods.js`

- [ ] **Step 1: Write the migration script**

Follow the dry-run/commit pattern of the existing `server/scripts/` migrations.

`server/scripts/migrate-simplemethod-to-methods.js`:

```js
// Usage:
//   node scripts/migrate-simplemethod-to-methods.js          # dry-run (no writes)
//   node scripts/migrate-simplemethod-to-methods.js --commit # apply
require('dotenv').config();
const mongoose = require('mongoose');
const SimpleMethod = require('../models/SimpleMethod');

const COMMIT = process.argv.includes('--commit');
const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/LIS-DB';

// instruments[i] (string) → methods[i] (string[]): GC/HPLC→[x], ""→[], BOTH→[] (drop either-or).
function toMethods(instruments) {
  return (instruments || []).map((v) => {
    const t = String(v || '').trim().toUpperCase();
    return t && t !== 'BOTH' ? [t] : [];
  });
}

async function main() {
  await mongoose.connect(URI);
  const docs = await SimpleMethod.find().lean();
  let changed = 0;
  let bothCleared = 0;
  const ops = [];
  for (const doc of docs) {
    if (Array.isArray(doc.methods)) continue; // already migrated
    const bothCount = (doc.instruments || []).filter((v) => String(v).toUpperCase() === 'BOTH').length;
    bothCleared += bothCount;
    const methods = toMethods(doc.instruments);
    changed += 1;
    if (bothCount > 0) console.log(`  BOTH cleared: ${doc.itemNo} (${bothCount} slot)`);
    ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: { methods } } } });
  }
  console.log(`\nDocs to migrate: ${changed}, BOTH slots cleared: ${bothCleared}`);
  if (!COMMIT) {
    console.log('DRY-RUN — no writes. Re-run with --commit to apply.');
  } else if (ops.length) {
    const res = await SimpleMethod.bulkWrite(ops);
    console.log(`Committed. modified=${res.modifiedCount}`);
  }
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Dry-run**

Run: `cd server && node scripts/migrate-simplemethod-to-methods.js`
Expected: prints `Docs to migrate: ~1419, BOTH slots cleared: 50` and lists the 50 BOTH itemNos. No writes.

- [ ] **Step 3: Commit (apply)**

Run: `cd server && node scripts/migrate-simplemethod-to-methods.js --commit`
Expected: `Committed. modified=<n>`.

- [ ] **Step 4: Verify a known BOTH item cleared**

Run: `curl -s http://localhost:3001/api/simple-methods | python -c "import sys,json; d={x['itemNo']:x for x in json.load(sys.stdin)}; print(d['F-BILBO-1000X12'])"`
Expected: `methods` is `[[]]` (empty slot), not `BOTH`.

- [ ] **Step 5: Export seed + commit**

```bash
npm run seed:export
git add -- server/scripts/migrate-simplemethod-to-methods.js server/seed-data/simplemethods.json server/seed-data/_manifest.json
git commit -m "chore(simple-method): migrate instruments→methods, clear 50 BOTH slots"
```

---

## Task 5: Standard Config backend — seed defaults from registry

**Files:**
- Modify: `server/routes/standardConfigs.js`

- [ ] **Step 1: Replace `DEFAULTS`/`ensureDefaults` to read the registry**

In `server/routes/standardConfigs.js`, add `const Method = require('../models/Method');` at the top, then replace lines 11–36 (`const DEFAULTS = [...]` through the end of `ensureDefaults`) with:

```js
// Default rows come from the Method registry (one isDefault row per method, scope:'all').
async function ensureDefaults() {
  const methods = await Method.find().lean();
  for (const m of methods) {
    await StandardConfig.updateOne(
      { instrument: m.code, scope: 'all' },
      {
        $setOnInsert: {
          instrument: m.code,
          scope: 'all',
          commonName: null,
          commonNameLower: null,
          times: m.defaultTimes,
          isDefault: true,
          note: '',
        },
      },
      { upsert: true },
    );
  }
}
```

- [ ] **Step 2: Validate instrument against the registry**

Replace `buildSubstanceBody` lines 49–52 (the `instrument !== 'GC' && instrument !== 'HPLC'` check) with a registry lookup. Change `buildSubstanceBody` to async and pass a valid-codes set:

```js
async function buildSubstanceBody(body) {
  const instrument = String((body && body.instrument) || '').toUpperCase();
  const valid = await Method.exists({ code: instrument });
  if (!valid) {
    return { error: { message: 'instrument ไม่ตรงกับวิธีที่มีในระบบ', field: 'instrument' } };
  }
  // ...rest unchanged (commonName + times validation)...
```

Then update the two call sites to `await buildSubstanceBody(req.body)` (POST handler line 90, PUT handler line 127). They are already inside `async` handlers, so just add `await`.

- [ ] **Step 3: Smoke-test defaults**

Restart backend. Run: `curl -s http://localhost:3001/api/standard-configs | python -m json.tool`
Expected: 5 `isDefault:true` rows — GC(3), HPLC(1), TITRATION(1), DIGEST(1), REFLUX(1).

Run: `curl -s -X POST http://localhost:3001/api/standard-configs -H 'Content-Type: application/json' -d '{"instrument":"NOPE","scope":"substance","commonName":"x","times":2}'`
Expected: HTTP 400 `{"message":"instrument ไม่ตรงกับวิธีที่มีในระบบ",...}`.

- [ ] **Step 4: Export seed + commit**

```bash
npm run seed:export
git add -- server/routes/standardConfigs.js server/seed-data/standardconfigs.json server/seed-data/_manifest.json
git commit -m "feat(standard-config): seed + validate defaults from method registry"
```

---

## Task 6: Standard Config frontend — registry-driven

**Files:**
- Modify: `src/lib/standardConfig.ts`
- Modify: `src/lib/standardConfig.test.ts`
- Modify: `src/pages/StandardConfig.tsx`

- [ ] **Step 1: Update the lib type + validation (write failing test first)**

In `src/lib/standardConfig.test.ts`, replace the instrument-validation tests so the validator takes a set of valid codes. Add:

```ts
it('rejects an instrument not in the registry', () => {
  expect(validateStandardConfigInput(
    { instrument: 'NOPE', scope: 'all', commonName: null, times: 1 },
    new Set(['GC', 'HPLC', 'TITRATION']),
  )).toEqual({ field: 'instrument', message: 'กรุณาเลือกวิธีทดสอบ' });
});
it('accepts a registry method', () => {
  expect(validateStandardConfigInput(
    { instrument: 'TITRATION', scope: 'all', commonName: null, times: 1 },
    new Set(['GC', 'HPLC', 'TITRATION']),
  )).toBeNull();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- standardConfig`
Expected: FAIL — `validateStandardConfigInput` takes 1 arg / `Instrument` type errors.

- [ ] **Step 3: Implement lib changes**

In `src/lib/standardConfig.ts`:
- Replace `export type Instrument = "GC" | "HPLC";` with `export type Instrument = string;` (method code).
- Change the signature and instrument check in `validateStandardConfigInput`:

```ts
export function validateStandardConfigInput(
  input: StandardConfigInput,
  validCodes: Set<string>,
): ValidationError | null {
  if (!input.instrument || !validCodes.has(input.instrument)) {
    return { field: "instrument", message: "กรุณาเลือกวิธีทดสอบ" };
  }
  // ...rest unchanged...
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run test -- standardConfig`
Expected: PASS.

- [ ] **Step 5: Wire the page to the registry**

In `src/pages/StandardConfig.tsx`:
- Load methods: `const { data: methods = [] } = useQuery({ queryKey: ['methods'], queryFn: () => api.getMethods() });`
- Replace the hardcoded dropdown at line ~305 `{(["GC", "HPLC"] as Instrument[]).map((inst) => (` with:

```tsx
{methods.filter((m) => m.active).map((m) => (
  // existing button/option JSX, using m.code as value and m.label as text
))}
```

- Update the default `form` instrument seed (line ~59 `instrument: "GC"`) to `instrument: methods[0]?.code ?? "GC"`.
- Pass valid codes to the validator call: `validateStandardConfigInput(form, new Set(methods.map((m) => m.code)))`.

- [ ] **Step 6: Type-check + manual check + commit**

Run: `npx tsc --noEmit`
Expected: no errors. Open `/standard-config` in the app — dropdown lists all 5 methods, default rows show all 5.

```bash
git add -- src/lib/standardConfig.ts src/lib/standardConfig.test.ts src/pages/StandardConfig.tsx
git commit -m "feat(standard-config): registry-driven method dropdown + validation"
```

---

## Task 7: Simple Method UI — multi-select chips, drop BOTH

**Files:**
- Modify: `src/pages/MasterItems.tsx`

This page currently models a slot as `"GC" | "HPLC" | "BOTH" | ""`. Convert each slot to a **set of method codes** loaded from the registry.

- [ ] **Step 1: Load the registry + replace slot types**

Near the top data-loading of `MasterItems.tsx`, add:

```tsx
const { data: registryMethods = [] } = useQuery({ queryKey: ['methods'], queryFn: () => api.getMethods() });
const activeMethods = useMemo(() => registryMethods.filter((m) => m.active), [registryMethods]);
```

Replace the slot model:
- Delete `type SimpleInstrument`, `type AssignmentSlot`, `const INSTRUMENT_ORDER`, `toggleInstrument`, `normalizeAssignment`, and `detectInstruments`'s GC/HPLC-only regex (line 63–249 region).
- New slot type: a slot is `string[]` (method codes, AND). A row's draft is `string[][]` (positional).

- [ ] **Step 2: Replace the load/normalize from `/simple-methods`**

At line ~851 where it fetches `/simple-methods` and builds `map[entry.itemNo] = (entry.instruments||[]).map(normalizeAssignment)`, use the shared helper:

```tsx
import { readSlotMethods } from '@/lib/methodRegistry';
// ...
const res = await api.get<Array<{ itemNo: string; instruments?: string[]; methods?: string[][] }>>('/simple-methods');
res.forEach((entry) => {
  const count = parseSubstances(commonNameForItem(entry.itemNo)).length || 1; // substance count for this row
  map[entry.itemNo] = readSlotMethods(entry, count);
});
```

(If the row's substance count is derived elsewhere in this file, reuse that; the existing code already splits substances per row — feed that length into `readSlotMethods`.)

- [ ] **Step 3: Replace the per-slot toggle UI**

At the table cell that renders `INSTRUMENT_ORDER.map(...)` toggle buttons (line ~1274), render one toggle per active method, multi-select (AND):

```tsx
{activeMethods.map((m) => {
  const active = (draftValue[index] ?? []).includes(m.code);
  return (
    <Button
      key={m.code}
      type="button"
      size="sm"
      variant={active ? 'default' : 'outline'}
      onClick={() => setSlotMethods(draftValue, index, toggleMethod(draftValue[index] ?? [], m.code))}
    >
      {m.label}
    </Button>
  );
})}
```

Add the pure helpers in this file:

```tsx
function toggleMethod(slot: string[], code: string): string[] {
  return slot.includes(code) ? slot.filter((c) => c !== code) : [...slot, code];
}
function setSlotMethods(row: string[][], index: number, next: string[]): string[][] {
  const copy = row.map((s) => [...s]);
  copy[index] = next;
  return copy;
}
```

- [ ] **Step 4: Replace filters + bulk-apply + save payload**

- `SimpleMethodFilter` (line ~820): change to `'all' | 'unassigned' | <methodCode>`. Compute `hasMethod = row.assignments.some((slot) => slot.includes(filter))`; `unassigned` = any slot empty. Remove the `gc-only/hplc-only/both` cases; render filter options from `activeMethods`.
- Bulk-apply (`applyBulk`, line ~1037): apply a chosen method code to every slot (toggle on) for the row.
- Save (line ~955): payload changes from `{ itemNo, instruments }` to `{ itemNo, methods }`:

```tsx
const methods = methodDrafts[row.key] ?? row.assignments; // string[][]
await api.put('/simple-methods', { updates: itemNos.map((itemNo) => ({ itemNo, methods })) });
```

- [ ] **Step 5: Type-check + manual smoke + commit**

Run: `npx tsc --noEmit`
Expected: no errors.

Manual: open `/master-items` Simple Method view — each substance shows toggle buttons for all 5 methods; select Digest+Titration on a row, save, reload → persists as AND-set. Filter by "Titration" shows only rows containing it.

```bash
git add -- src/pages/MasterItems.tsx
git commit -m "feat(simple-method): multi-select method chips, drop BOTH"
```

---

## Task 8: Petition Assign — per-method machine picker / bench chip

**Files:**
- Modify: `src/pages/PetitionAssignPage.tsx`

- [ ] **Step 1: Load registry + replace slot model**

Add a registry query (same as other pages). Replace:
- `type Instrument = 'GC' | 'HPLC'` and `SlotRequirement` (with BOTH) usage → method codes.
- `machineInstrument` (line 88–95) and `machineMatchesSlot` (line 97–101): delete; use `machineMatchesMethod` from `@/lib/methodRegistry`.
- `SlotInstruments` type (line 140) → `type SlotMethods = string[][]` (positional AND-sets).

- [ ] **Step 2: Build groups with AND-sets**

In `buildSubstanceGroups` (line 142), change slots to carry a method-code array per substance:

```tsx
slots: substances.map((name, idx) => ({
  name,
  methods: slotMethods[idx] ?? [], // string[] (AND)
})),
```

Source `slotMethods` from the simple-methods query using `readSlotMethods(entry, substances.length)` (replace the existing instruments mapping at line ~301–338).

- [ ] **Step 3: Render picker per method**

Where a slot's instrument drove the machine picker, iterate the slot's methods. For each method `code`, look it up in the registry:
- `requiresMachine` → render the machine picker, filtering machines with `machineMatchesMethod(machine.name, method, allMethods)`. The user must pick one machine per machine-backed method in the slot.
- `!requiresMachine` → render a static chip: ``<Badge>ทำที่โต๊ะ — {method.label}</Badge>`` (auto-satisfied, no machine needed).

- [ ] **Step 4: Block-assign rule (preserve existing behavior)**

A slot with **no methods** (`methods.length === 0`) → keep the existing lock + block-Assign behavior (the petition-assign-no-method rule). A slot whose machine-backed methods are not all assigned → Assign stays disabled. Bench-only slots are considered satisfied. Update the existing "can assign" predicate accordingly (search for where the Assign button `disabled` is computed and where the no-method warning renders).

- [ ] **Step 5: Type-check + manual smoke + commit**

Run: `npx tsc --noEmit`
Expected: no errors.

Manual: assign a petition whose substance is mapped to `Titration` (bench) → shows "ทำที่โต๊ะ" chip, Assign enabled without a machine. A substance mapped to `GC` still requires picking a GC machine. A substance with empty methods → Assign blocked.

```bash
git add -- src/pages/PetitionAssignPage.tsx
git commit -m "feat(assign): per-method machine picker + bench chip, drop BOTH"
```

---

## Task 9: Method registry admin UI

**Files:**
- Create: `src/pages/MethodSettings.tsx`
- Create: `src/pages/__tests__/MethodSettings.test.tsx`
- Modify: `src/lib/navItems.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write a minimal failing render test**

`src/pages/__tests__/MethodSettings.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MethodSettings from '../MethodSettings';
import { api } from '@/lib/api';

vi.spyOn(api, 'getMethods').mockResolvedValue([
  { _id: '1', code: 'GC', label: 'GC', requiresMachine: true, machinePrefix: 'GC', defaultTimes: 3, order: 1, active: true, builtIn: true },
  { _id: '3', code: 'TITRATION', label: 'Titration', requiresMachine: false, machinePrefix: '', defaultTimes: 1, order: 3, active: true, builtIn: false },
] as any);

function renderPage() {
  const qc = new QueryClient();
  return render(<QueryClientProvider client={qc}><MethodSettings /></QueryClientProvider>);
}

describe('MethodSettings', () => {
  it('lists methods from the registry', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Titration')).toBeInTheDocument());
    expect(screen.getByText('GC')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- MethodSettings`
Expected: FAIL — `Cannot find module '../MethodSettings'`.

- [ ] **Step 3: Implement the page**

`src/pages/MethodSettings.tsx` — a table of methods (code, label, requiresMachine, machinePrefix, defaultTimes, active) with add/edit dialog using `api.createMethod`/`updateMethod`/`deleteMethod`. Follow the `PageHeader` + `DataTable` patterns used by `src/pages/StandardConfig.tsx`. Rules in UI: `code` field editable only when adding; `requiresMachine`/`machinePrefix` disabled for `builtIn`; delete hidden for `builtIn`; `machinePrefix` field shown only when `requiresMachine` checked.

- [ ] **Step 4: Run to verify pass**

Run: `npm run test -- MethodSettings`
Expected: PASS.

- [ ] **Step 5: Register route + nav**

- `src/App.tsx`: add `<Route path="/methods" element={<PrivateRoute><MethodSettings /></PrivateRoute>} />` (match the existing protected-route pattern).
- `src/lib/navItems.ts`: add a nav entry `{ path: '/methods', label: 'วิธีทดสอบ', icon: <icon>, ... }` near the config/admin group (Machines / Parameter Settings).

- [ ] **Step 6: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add -- src/pages/MethodSettings.tsx src/pages/__tests__/MethodSettings.test.tsx src/App.tsx src/lib/navItems.ts
git commit -m "feat(methods): admin registry settings page + route + nav"
```

---

## Task 10: Clean up remaining GC/HPLC references + full verify

**Files:**
- Modify: `src/pages/Report.tsx`, `src/pages/AdminData.tsx`, `src/data/mockData.ts` (only where GC/HPLC hardcoding breaks compilation or shows stale UI)

- [ ] **Step 1: Find remaining hard references**

Run: `npx tsc --noEmit`
Expected: surfaces any leftover references to the removed `Instrument` union / `SlotRequirement` / `BOTH`. Fix each by switching to `string` method codes or registry lookups. For `mockData.ts`, update any `instruments`/`BOTH` literals to `methods` AND-set shape so tests stay coherent.

- [ ] **Step 2: Run the full test suite**

Run: `npm run test`
Expected: all tests pass (existing + new `methodRegistry`, `standardConfig`, `MethodSettings`).

- [ ] **Step 3: Playwright e2e — new method end-to-end**

Add/extend an e2e under the existing Playwright dir: create a method in `/methods` (e.g. `TITRATION` already seeded — use it), map it to a substance in `/master-items`, then open `/petitions/.../assign` and assert the bench chip "ทำที่โต๊ะ" appears and Assign is enabled.

Run: `npx playwright test`
Expected: PASS (or document any pre-existing unrelated failures).

- [ ] **Step 4: Final type-check + commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add -- src/pages/Report.tsx src/pages/AdminData.tsx src/data/mockData.ts <any e2e file>
git commit -m "chore(methods): drop residual GC/HPLC hardcoding, e2e for new method"
```

---

## Self-Review notes (spec coverage)

- Method registry (model/route/seed/admin UI) → Tasks 1, 9 ✓
- `requiresMachine` mixed machine/bench → Tasks 1 (model), 8 (assign) ✓
- Admin-managed list → Tasks 1, 9 ✓
- Multi-select AND, drop BOTH → Tasks 3, 7, 8 ✓
- Migrate 50 BOTH → empty → Task 4 ✓
- Back-compat read (`instruments`→`methods`) → Task 2 (`readSlotMethods`), used in 7, 8 ✓
- Standard Config from registry → Tasks 5, 6 ✓
- Petition Assign machine picker / bench chip + block-assign rule preserved → Task 8 ✓
- No `npm run build`; seed:export after data/model changes → Tasks 1, 4, 5 ✓
- YAGNI: no OR semantics, no `instruments` field removal this round, no auto-guessing 50 BOTH substances ✓
