# Standard Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/standard-config` page (Substances + Overrides tabs) backed by two new MongoDB collections, sharing a `parseSubstances` helper across client and server. Phase 1: config-only — no stock deduction.

**Architecture:**
- Frontend page in `src/pages/StandardConfig.tsx` with shadcn `Tabs`; data via TanStack React Query; auto-save on blur for slot edits; client-side live preview for override rules.
- Backend Express routes (`/api/standard-configs`, `/api/standard-overrides`) using Mongoose models, registered in `server/index.js`.
- Shared `parseSubstances()` extracted from existing in-page copies (`PetitionAssignPage.tsx:57`, `MasterItems.tsx:223`) to `src/lib/substances.ts`; identical port at `server/utils/substances.js`.
- Page access via existing `PrivateRoute` (path-based); no read/write split — current codebase (e.g. MasterItems) does not distinguish.

**Tech Stack:** React 18 + TypeScript + Vite, shadcn/ui (Tabs, Dialog, Popover, Select, Checkbox), TanStack React Query, react-router-dom v6, Express + Mongoose, Vitest (client-only — server has no test framework).

**Spec:** `docs/superpowers/specs/2026-05-29-standard-config-design.md` (commit `6b7db31`)

---

## File Map

**New files:**
- `src/lib/substances.ts` — shared parser (extract from existing copies)
- `src/lib/substances.test.ts` — TDD tests for parser
- `src/lib/resolveStandardConfig.ts` — lookup function (priority order)
- `src/lib/resolveStandardConfig.test.ts` — TDD tests for lookup
- `src/pages/StandardConfig.tsx` — main page (tabs container)
- `src/pages/standardConfig/SubstancesTab.tsx` — Substances tab UI
- `src/pages/standardConfig/OverridesTab.tsx` — Overrides tab UI
- `src/pages/standardConfig/SlotEditor.tsx` — shared slot editor (chips + unit dropdown)
- `src/pages/standardConfig/types.ts` — TS types for both collections
- `server/utils/substances.js` — port of parser
- `server/models/StandardConfig.js`
- `server/models/StandardOverride.js`
- `server/routes/standardConfigs.js`
- `server/routes/standardOverrides.js`

**Modified files:**
- `src/App.tsx` — register route
- `src/lib/navItems.ts` — add sidebar entry
- `src/lib/api.ts` — add CRUD endpoints
- `src/pages/PetitionAssignPage.tsx` — import shared `parseSubstances`, delete local copy
- `src/pages/MasterItems.tsx` — import shared `parseSubstances`, delete local copy
- `server/index.js` — `mountApi` the two new routes

---

## Task 1: Extract shared `parseSubstances` helper (TDD)

**Files:**
- Create: `src/lib/substances.ts`
- Create: `src/lib/substances.test.ts`

The algorithm currently exists verbatim at `src/pages/PetitionAssignPage.tsx:57-78` and `src/pages/MasterItems.tsx:223-248`. Extract it once and keep behavior identical.

- [ ] **Step 1: Write failing test**

Create `src/lib/substances.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseSubstances } from "./substances";

describe("parseSubstances", () => {
  it("returns single substance unchanged", () => {
    expect(parseSubstances("ABAMECTIN")).toEqual(["ABAMECTIN"]);
  });

  it("trims whitespace", () => {
    expect(parseSubstances("  ABAMECTIN  ")).toEqual(["ABAMECTIN"]);
  });

  it("returns empty array for empty input", () => {
    expect(parseSubstances("")).toEqual([]);
  });

  it("splits two substances on plus", () => {
    expect(parseSubstances("ANILOFOS + BISPYRIBAC-SODIUM")).toEqual([
      "ANILOFOS",
      "BISPYRIBAC-SODIUM",
    ]);
  });

  it("filters out empty fragments", () => {
    expect(parseSubstances("ANILOFOS + + BISPYRIBAC-SODIUM")).toEqual([
      "ANILOFOS",
      "BISPYRIBAC-SODIUM",
    ]);
  });

  it("merges shortest fragment with shorter neighbor when 3+ parts", () => {
    // 3 parts: A(8) + B(3) + C(10) → B is shortest, neighbors A=8, C=10 → merge with A
    // result: "A + B" (2 substances)
    expect(parseSubstances("AAAAAAAA + BBB + CCCCCCCCCC")).toEqual([
      "AAAAAAAA + BBB",
      "CCCCCCCCCC",
    ]);
  });

  it("merges down to exactly 2 substances for 4+ parts", () => {
    const result = parseSubstances("AAAA + BB + CCCC + DDDDDD");
    expect(result).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/substances.test.ts`
Expected: FAIL — `Cannot find module './substances'`.

- [ ] **Step 3: Implement the helper**

Create `src/lib/substances.ts` (copy algorithm from existing call sites verbatim):
```ts
// Split a commonName into its component substances by "+", merging short
// fragments (3+ parts) down to at most 2 substances. Used by Petition Assign,
// Master Items (Simple Method tab), and Standard Config to keep positional
// instrument arrays aligned across the app.
export function parseSubstances(commonName: string): string[] {
  const parts = commonName.split("+").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return [commonName.trim()].filter(Boolean);
  if (parts.length <= 2) return parts;

  while (parts.length > 2) {
    let shortestIdx = 0;
    for (let i = 1; i < parts.length; i += 1) {
      if (parts[i].length < parts[shortestIdx].length) shortestIdx = i;
    }
    let neighborIdx: number;
    if (shortestIdx === 0) neighborIdx = 1;
    else if (shortestIdx === parts.length - 1) neighborIdx = shortestIdx - 1;
    else
      neighborIdx =
        parts[shortestIdx - 1].length <= parts[shortestIdx + 1].length
          ? shortestIdx - 1
          : shortestIdx + 1;

    const lo = Math.min(shortestIdx, neighborIdx);
    const hi = Math.max(shortestIdx, neighborIdx);
    const merged = `${parts[lo]} + ${parts[hi]}`;
    parts.splice(lo, hi - lo + 1, merged);
  }
  return parts;
}

export function substanceKey(value: string): string {
  return value.trim().toLowerCase();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/substances.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/substances.ts src/lib/substances.test.ts
git commit -m "feat(lib): extract shared parseSubstances helper with tests"
```

---

## Task 2: Refactor existing call sites to use shared helper

**Files:**
- Modify: `src/pages/PetitionAssignPage.tsx:57-78`
- Modify: `src/pages/MasterItems.tsx:223-248`

- [ ] **Step 1: Import in PetitionAssignPage.tsx**

In `src/pages/PetitionAssignPage.tsx`, find the existing import block (top of file) and add:
```ts
import { parseSubstances } from "@/lib/substances";
```

Then delete the local `function parseSubstances(...)` block (lines 57-78 — the entire function including the comment above it at line 54-56). Leave the rest of the file untouched; all existing references to `parseSubstances` resolve to the import.

- [ ] **Step 2: Import in MasterItems.tsx**

In `src/pages/MasterItems.tsx`, add to imports:
```ts
import { parseSubstances } from "@/lib/substances";
```

Delete the local `function parseSubstances(...)` block at lines 223-248.

- [ ] **Step 3: Run type check + tests**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/pages/PetitionAssignPage.tsx src/pages/MasterItems.tsx
git commit -m "refactor: use shared parseSubstances helper in petition/master pages"
```

---

## Task 3: Server-side `parseSubstances` port + StandardConfig model

**Files:**
- Create: `server/utils/substances.js`
- Create: `server/models/StandardConfig.js`

- [ ] **Step 1: Create server-side parser**

Create `server/utils/substances.js`:
```js
// MUST stay in sync with src/lib/substances.ts. Same algorithm, no transpile.
function parseSubstances(commonName) {
  const value = String(commonName || '');
  const parts = value.split('+').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  if (parts.length <= 2) return parts;

  while (parts.length > 2) {
    let shortestIdx = 0;
    for (let i = 1; i < parts.length; i += 1) {
      if (parts[i].length < parts[shortestIdx].length) shortestIdx = i;
    }
    let neighborIdx;
    if (shortestIdx === 0) neighborIdx = 1;
    else if (shortestIdx === parts.length - 1) neighborIdx = shortestIdx - 1;
    else neighborIdx = parts[shortestIdx - 1].length <= parts[shortestIdx + 1].length
      ? shortestIdx - 1
      : shortestIdx + 1;

    const lo = Math.min(shortestIdx, neighborIdx);
    const hi = Math.max(shortestIdx, neighborIdx);
    const merged = `${parts[lo]} + ${parts[hi]}`;
    parts.splice(lo, hi - lo + 1, merged);
  }
  return parts;
}

function substanceKey(value) {
  return String(value || '').trim().toLowerCase();
}

module.exports = { parseSubstances, substanceKey };
```

- [ ] **Step 2: Create StandardConfig model**

Create `server/models/StandardConfig.js`:
```js
const mongoose = require('mongoose');

const UNITS = ['ml', 'µL', 'ppm', 'mg'];

const InstrumentConfigSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    unit: { type: String, enum: UNITS, default: 'ml' },
    slots: { type: [Number], default: [] },
  },
  { _id: false },
);

const StandardConfigSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    nameLower: { type: String, required: true, unique: true, index: true },
    isManual: { type: Boolean, default: false },
    gc: { type: InstrumentConfigSchema, default: () => ({}) },
    hplc: { type: InstrumentConfigSchema, default: () => ({}) },
  },
  { timestamps: true },
);

StandardConfigSchema.statics.UNITS = UNITS;

module.exports = mongoose.model('StandardConfig', StandardConfigSchema);
```

- [ ] **Step 3: Verify model loads**

Run: `node -e "require('./server/models/StandardConfig'); console.log('ok')"` from project root.
Expected: prints `ok` (no module/schema errors).

- [ ] **Step 4: Commit**

```bash
git add server/utils/substances.js server/models/StandardConfig.js
git commit -m "feat(server): add StandardConfig model + substances helper port"
```

---

## Task 4: StandardConfig CRUD + sync routes

**Files:**
- Create: `server/routes/standardConfigs.js`
- Modify: `server/index.js` (register route)

- [ ] **Step 1: Create routes**

Create `server/routes/standardConfigs.js`:
```js
const express = require('express');
const mongoose = require('mongoose');
const StandardConfig = require('../models/StandardConfig');
const { parseSubstances, substanceKey } = require('../utils/substances');

const router = express.Router();

const UNITS = new Set(StandardConfig.UNITS);
const MAX_SLOTS = 20;
const MAX_SLOT_VALUE = 10000;
const MAX_NAME_LEN = 200;

function validateInstrument(payload, fieldPrefix) {
  if (!payload || typeof payload !== 'object') return null;
  const enabled = Boolean(payload.enabled);
  const unit = String(payload.unit || 'ml');
  if (!UNITS.has(unit)) {
    return { message: `${fieldPrefix}.unit must be one of ${[...UNITS].join(', ')}`, field: `${fieldPrefix}.unit` };
  }
  const slotsRaw = Array.isArray(payload.slots) ? payload.slots : [];
  if (slotsRaw.length > MAX_SLOTS) {
    return { message: `${fieldPrefix}.slots may have at most ${MAX_SLOTS} values`, field: `${fieldPrefix}.slots` };
  }
  const slots = [];
  for (const v of slotsRaw) {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0 || n > MAX_SLOT_VALUE) {
      return { message: `${fieldPrefix}.slots must contain positive numbers ≤ ${MAX_SLOT_VALUE}`, field: `${fieldPrefix}.slots` };
    }
    slots.push(n);
  }
  if (enabled && slots.length < 1) {
    return { message: `${fieldPrefix}.slots required when enabled`, field: `${fieldPrefix}.slots` };
  }
  return { ok: { enabled, unit, slots } };
}

function buildBody(body) {
  const errors = [];
  const gc = validateInstrument(body && body.gc, 'gc');
  if (gc && gc.message) errors.push(gc);
  const hplc = validateInstrument(body && body.hplc, 'hplc');
  if (hplc && hplc.message) errors.push(hplc);
  if (errors.length) return { error: errors[0] };
  return {
    value: {
      gc: gc ? gc.ok : { enabled: false, unit: 'ml', slots: [] },
      hplc: hplc ? hplc.ok : { enabled: false, unit: 'ml', slots: [] },
    },
  };
}

router.get('/', async (_req, res) => {
  try {
    const docs = await StandardConfig.find().lean();
    res.json(docs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const name = String((req.body && req.body.name) || '').trim();
    if (!name) return res.status(400).json({ message: 'name required', field: 'name' });
    if (name.length > MAX_NAME_LEN) return res.status(400).json({ message: `name too long (max ${MAX_NAME_LEN})`, field: 'name' });
    const built = buildBody(req.body);
    if (built.error) return res.status(400).json(built.error);
    const nameLower = name.toLowerCase();
    const existing = await StandardConfig.findOne({ nameLower }).lean();
    if (existing) return res.status(409).json({ message: 'standard already exists', field: 'name' });
    const doc = await StandardConfig.create({
      name,
      nameLower,
      isManual: true,
      gc: built.value.gc,
      hplc: built.value.hplc,
    });
    res.status(201).json(doc.toObject());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:nameLower', async (req, res) => {
  try {
    const nameLower = String(req.params.nameLower || '').trim().toLowerCase();
    if (!nameLower) return res.status(400).json({ message: 'nameLower required' });
    const built = buildBody(req.body);
    if (built.error) return res.status(400).json(built.error);
    const doc = await StandardConfig.findOneAndUpdate(
      { nameLower },
      { $set: { gc: built.value.gc, hplc: built.value.hplc } },
      { new: true },
    ).lean();
    if (!doc) return res.status(404).json({ message: 'not found' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:nameLower', async (req, res) => {
  try {
    const nameLower = String(req.params.nameLower || '').trim().toLowerCase();
    const doc = await StandardConfig.findOne({ nameLower }).lean();
    if (!doc) return res.status(404).json({ message: 'not found' });
    if (!doc.isManual) return res.status(400).json({ message: 'cannot delete derived standard' });
    await StandardConfig.deleteOne({ nameLower });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/sync', async (_req, res) => {
  try {
    // Aggregate distinct substances + initial enabled flags from MasterItem + SimpleMethod
    let MasterItem;
    let SimpleMethod;
    try {
      MasterItem = mongoose.model('MasterItem');
      SimpleMethod = mongoose.model('SimpleMethod');
    } catch (err) {
      return res.status(502).json({ message: 'master items unavailable' });
    }

    const masters = await MasterItem.find().lean();
    const simple = await SimpleMethod.find().lean();
    const itemNoKeys = ['item_no', 'itemCode', 'item_code', 'code', 'Code', 'ITEM_CODE'];
    const commonNameKeys = ['common_name', 'commonname', 'commonName', 'item_name2', 'itemType'];

    function pick(obj, keys) {
      for (const k of keys) {
        const v = obj && obj[k];
        if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
      }
      return '';
    }

    const itemNoToInstruments = new Map();
    for (const entry of simple) {
      const itemNo = String(entry.itemNo || '').trim();
      if (!itemNo) continue;
      itemNoToInstruments.set(itemNo, Array.isArray(entry.instruments) ? entry.instruments : []);
    }

    // substanceKey → { name, gc.enabled, hplc.enabled }
    const initial = new Map();
    for (const m of masters) {
      const commonName = pick(m, commonNameKeys);
      const itemNo = pick(m, itemNoKeys);
      if (!commonName) continue;
      const substances = parseSubstances(commonName);
      const instruments = itemNoToInstruments.get(itemNo) || [];
      substances.forEach((sub, i) => {
        const key = substanceKey(sub);
        if (!key) return;
        const prev = initial.get(key) || { name: sub, gc: false, hplc: false };
        const instr = String(instruments[i] || '').toUpperCase();
        if (instr === 'GC') prev.gc = true;
        if (instr === 'HPLC') prev.hplc = true;
        initial.set(key, prev);
      });
    }

    let added = 0;
    let updated = 0;
    for (const [nameLower, info] of initial) {
      const existing = await StandardConfig.findOne({ nameLower }).lean();
      if (!existing) {
        await StandardConfig.create({
          name: info.name,
          nameLower,
          isManual: false,
          gc: { enabled: info.gc, unit: 'ml', slots: [] },
          hplc: { enabled: info.hplc, unit: 'ml', slots: [] },
        });
        added += 1;
        continue;
      }
      if (existing.isManual) continue;
      // Only flip enabled flags from false→true; never overwrite user-entered slots/unit.
      const patch = {};
      if (info.gc && !existing.gc.enabled) patch['gc.enabled'] = true;
      if (info.hplc && !existing.hplc.enabled) patch['hplc.enabled'] = true;
      if (Object.keys(patch).length) {
        await StandardConfig.updateOne({ nameLower }, { $set: patch });
        updated += 1;
      }
    }

    res.json({ added, updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 2: Register route**

In `server/index.js`, add after the `mountApi('/simple-methods', …)` line (around line 37):
```js
mountApi('/standard-configs', require('./routes/standardConfigs'));
```

- [ ] **Step 3: Smoke test routes**

Start dev: `npm run dev` (server auto-runs separately — confirm both are running).

In a new terminal, run:
```bash
curl http://localhost:3001/api/standard-configs
```
Expected: `[]` (empty array, status 200).

Then:
```bash
curl -X POST http://localhost:3001/api/standard-configs/sync
```
Expected: `{"added": N, "updated": M}` where N > 0 if master items have commonNames.

Then:
```bash
curl http://localhost:3001/api/standard-configs | head -c 500
```
Expected: array of objects with `name`, `nameLower`, `isManual:false`, `gc`, `hplc`.

- [ ] **Step 4: Commit**

```bash
git add server/routes/standardConfigs.js server/index.js
git commit -m "feat(server): standard-configs CRUD + sync from master endpoint"
```

---

## Task 5: StandardOverride model + routes

**Files:**
- Create: `server/models/StandardOverride.js`
- Create: `server/routes/standardOverrides.js`
- Modify: `server/index.js`

- [ ] **Step 1: Create model**

Create `server/models/StandardOverride.js`:
```js
const mongoose = require('mongoose');

const UNITS = ['ml', 'µL', 'ppm', 'mg'];
const MATCH_TYPES = ['substring', 'substance', 'commonName'];
const SCOPES = ['substanceOnly', 'wholeCommonName'];

const InstrumentConfigSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    unit: { type: String, enum: UNITS, default: 'ml' },
    slots: { type: [Number], default: [] },
  },
  { _id: false },
);

const StandardOverrideSchema = new mongoose.Schema(
  {
    matchType: { type: String, enum: MATCH_TYPES, required: true },
    matchValue: { type: String, required: true },
    matchValueLower: { type: String, required: true },
    scope: { type: String, enum: SCOPES, default: 'substanceOnly' },
    note: { type: String, default: '' },
    priority: { type: Number, default: 0 },
    gc: { type: InstrumentConfigSchema, default: () => ({}) },
    hplc: { type: InstrumentConfigSchema, default: () => ({}) },
  },
  { timestamps: true },
);

StandardOverrideSchema.index({ matchType: 1, matchValueLower: 1 }, { unique: true });

StandardOverrideSchema.statics.UNITS = UNITS;
StandardOverrideSchema.statics.MATCH_TYPES = MATCH_TYPES;
StandardOverrideSchema.statics.SCOPES = SCOPES;

module.exports = mongoose.model('StandardOverride', StandardOverrideSchema);
```

- [ ] **Step 2: Create routes**

Create `server/routes/standardOverrides.js`:
```js
const express = require('express');
const StandardOverride = require('../models/StandardOverride');

const router = express.Router();

const UNITS = new Set(StandardOverride.UNITS);
const MATCH_TYPES = new Set(StandardOverride.MATCH_TYPES);
const SCOPES = new Set(StandardOverride.SCOPES);
const MAX_SLOTS = 20;
const MAX_SLOT_VALUE = 10000;
const MAX_VAL_LEN = 200;

function validateInstrument(payload, fieldPrefix) {
  if (!payload || typeof payload !== 'object') {
    return { ok: { enabled: false, unit: 'ml', slots: [] } };
  }
  const enabled = Boolean(payload.enabled);
  const unit = String(payload.unit || 'ml');
  if (!UNITS.has(unit)) return { message: `${fieldPrefix}.unit invalid`, field: `${fieldPrefix}.unit` };
  const slotsRaw = Array.isArray(payload.slots) ? payload.slots : [];
  if (slotsRaw.length > MAX_SLOTS) return { message: `${fieldPrefix}.slots > ${MAX_SLOTS}`, field: `${fieldPrefix}.slots` };
  const slots = [];
  for (const v of slotsRaw) {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0 || n > MAX_SLOT_VALUE) {
      return { message: `${fieldPrefix}.slots invalid value`, field: `${fieldPrefix}.slots` };
    }
    slots.push(n);
  }
  if (enabled && slots.length < 1) return { message: `${fieldPrefix}.slots required when enabled`, field: `${fieldPrefix}.slots` };
  return { ok: { enabled, unit, slots } };
}

function buildBody(body, requireMatchType) {
  const errors = [];
  if (requireMatchType) {
    const mt = String(body && body.matchType || '');
    if (!MATCH_TYPES.has(mt)) errors.push({ message: 'matchType invalid', field: 'matchType' });
  }
  const matchValue = String((body && body.matchValue) || '').trim();
  if (!matchValue) errors.push({ message: 'matchValue required', field: 'matchValue' });
  if (matchValue.length > MAX_VAL_LEN) errors.push({ message: `matchValue too long`, field: 'matchValue' });
  const scope = String((body && body.scope) || 'substanceOnly');
  if (!SCOPES.has(scope)) errors.push({ message: 'scope invalid', field: 'scope' });
  const priority = Number(body && body.priority);
  if (body && body.priority !== undefined && !Number.isFinite(priority)) {
    errors.push({ message: 'priority must be a number', field: 'priority' });
  }
  const gc = validateInstrument(body && body.gc, 'gc');
  if (gc.message) errors.push(gc);
  const hplc = validateInstrument(body && body.hplc, 'hplc');
  if (hplc.message) errors.push(hplc);
  if (errors.length) return { error: errors[0] };
  return {
    value: {
      matchValue,
      matchValueLower: matchValue.toLowerCase(),
      scope,
      note: String((body && body.note) || ''),
      priority: Number.isFinite(priority) ? priority : 0,
      gc: gc.ok,
      hplc: hplc.ok,
    },
  };
}

router.get('/', async (_req, res) => {
  try {
    const docs = await StandardOverride.find().sort({ priority: -1, createdAt: 1 }).lean();
    res.json(docs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const built = buildBody(req.body, true);
    if (built.error) return res.status(400).json(built.error);
    const matchType = String(req.body.matchType);
    const doc = await StandardOverride.create({ matchType, ...built.value });
    res.status(201).json(doc.toObject());
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ message: 'duplicate rule (same matchType + matchValue)' });
    }
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const built = buildBody(req.body, false);
    if (built.error) return res.status(400).json(built.error);
    // matchType is immutable — never updated
    const doc = await StandardOverride.findByIdAndUpdate(
      req.params.id,
      { $set: built.value },
      { new: true },
    ).lean();
    if (!doc) return res.status(404).json({ message: 'not found' });
    res.json(doc);
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ message: 'duplicate rule' });
    }
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const doc = await StandardOverride.findByIdAndDelete(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: 'not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 3: Register route**

In `server/index.js`, add after the standard-configs registration:
```js
mountApi('/standard-overrides', require('./routes/standardOverrides'));
```

- [ ] **Step 4: Smoke test**

```bash
curl http://localhost:3001/api/standard-overrides
```
Expected: `[]`.

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"matchType":"substring","matchValue":"ani","priority":10,"gc":{"enabled":true,"unit":"ml","slots":[5]}}' \
  http://localhost:3001/api/standard-overrides
```
Expected: 201 with the created object.

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"matchType":"substring","matchValue":"ani"}' \
  http://localhost:3001/api/standard-overrides
```
Expected: 409 `{"message":"duplicate rule (same matchType + matchValue)"}`.

- [ ] **Step 5: Commit**

```bash
git add server/models/StandardOverride.js server/routes/standardOverrides.js server/index.js
git commit -m "feat(server): standard-overrides model + CRUD with priority sort"
```

---

## Task 6: Client API + types

**Files:**
- Modify: `src/lib/api.ts`
- Create: `src/pages/standardConfig/types.ts`

- [ ] **Step 1: Create types**

Create `src/pages/standardConfig/types.ts`:
```ts
export const STANDARD_UNITS = ['ml', 'µL', 'ppm', 'mg'] as const;
export type StandardUnit = (typeof STANDARD_UNITS)[number];

export const MATCH_TYPES = ['substring', 'substance', 'commonName'] as const;
export type MatchType = (typeof MATCH_TYPES)[number];

export const OVERRIDE_SCOPES = ['substanceOnly', 'wholeCommonName'] as const;
export type OverrideScope = (typeof OVERRIDE_SCOPES)[number];

export type InstrumentConfig = {
  enabled: boolean;
  unit: StandardUnit;
  slots: number[];
};

export type StandardConfigDoc = {
  _id: string;
  name: string;
  nameLower: string;
  isManual: boolean;
  gc: InstrumentConfig;
  hplc: InstrumentConfig;
  createdAt?: string;
  updatedAt?: string;
};

export type StandardOverrideDoc = {
  _id: string;
  matchType: MatchType;
  matchValue: string;
  matchValueLower: string;
  scope: OverrideScope;
  note: string;
  priority: number;
  gc: InstrumentConfig;
  hplc: InstrumentConfig;
  createdAt?: string;
  updatedAt?: string;
};

export type SyncResult = { added: number; updated: number };
```

- [ ] **Step 2: Add API endpoints**

In `src/lib/api.ts`, add at the top after the existing type imports:
```ts
import type {
  StandardConfigDoc,
  StandardOverrideDoc,
  SyncResult,
} from "@/pages/standardConfig/types";
```

Then add inside the `api` object (after the stock blocks, before the closing `}`):
```ts
  // Standard Config
  getStandardConfigs: () => request<StandardConfigDoc[]>("/standard-configs"),
  createStandardConfig: (data: Partial<StandardConfigDoc>) =>
    request<StandardConfigDoc>("/standard-configs", { method: "POST", body: JSON.stringify(data) }),
  updateStandardConfig: (nameLower: string, data: Partial<StandardConfigDoc>) =>
    request<StandardConfigDoc>(`/standard-configs/${encodeURIComponent(nameLower)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteStandardConfig: (nameLower: string) =>
    request<{ ok: true }>(`/standard-configs/${encodeURIComponent(nameLower)}`, { method: "DELETE" }),
  syncStandardConfigs: () =>
    request<SyncResult>("/standard-configs/sync", { method: "POST" }),

  // Standard Overrides
  getStandardOverrides: () => request<StandardOverrideDoc[]>("/standard-overrides"),
  createStandardOverride: (data: Partial<StandardOverrideDoc>) =>
    request<StandardOverrideDoc>("/standard-overrides", { method: "POST", body: JSON.stringify(data) }),
  updateStandardOverride: (id: string, data: Partial<StandardOverrideDoc>) =>
    request<StandardOverrideDoc>(`/standard-overrides/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteStandardOverride: (id: string) =>
    request<{ ok: true }>(`/standard-overrides/${id}`, { method: "DELETE" }),
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/api.ts src/pages/standardConfig/types.ts
git commit -m "feat(api): client endpoints + types for standard-config + overrides"
```

---

## Task 7: `resolveStandardConfig()` lookup helper (TDD)

**Files:**
- Create: `src/lib/resolveStandardConfig.ts`
- Create: `src/lib/resolveStandardConfig.test.ts`

This is the lookup function the future stock-deduction code will call. It encodes the priority order documented in the spec.

- [ ] **Step 1: Write failing tests**

Create `src/lib/resolveStandardConfig.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { resolveStandardConfig } from "./resolveStandardConfig";
import type { StandardConfigDoc, StandardOverrideDoc } from "@/pages/standardConfig/types";

const cfg = (name: string, gcSlots: number[] = [], hplcSlots: number[] = []): StandardConfigDoc => ({
  _id: name,
  name,
  nameLower: name.toLowerCase(),
  isManual: false,
  gc: { enabled: gcSlots.length > 0, unit: "ml", slots: gcSlots },
  hplc: { enabled: hplcSlots.length > 0, unit: "ml", slots: hplcSlots },
});

const ovr = (
  partial: Partial<StandardOverrideDoc> & Pick<StandardOverrideDoc, "matchType" | "matchValue">
): StandardOverrideDoc => ({
  _id: `${partial.matchType}:${partial.matchValue}`,
  matchValueLower: partial.matchValue.toLowerCase(),
  scope: "substanceOnly",
  note: "",
  priority: 0,
  gc: { enabled: false, unit: "ml", slots: [] },
  hplc: { enabled: false, unit: "ml", slots: [] },
  ...partial,
});

describe("resolveStandardConfig", () => {
  it("returns 'none' when no config and no override matches", () => {
    const result = resolveStandardConfig("ABAMECTIN", 0, [], []);
    expect(result.source).toBe("none");
  });

  it("returns 'base' from StandardConfig keyed by parsed substance", () => {
    const result = resolveStandardConfig("ABAMECTIN", 0, [cfg("ABAMECTIN", [10, 12])], []);
    expect(result.source).toBe("base");
    expect(result.name).toBe("ABAMECTIN");
    expect(result.gc.slots).toEqual([10, 12]);
  });

  it("returns 'override' for exact commonName match (highest priority)", () => {
    const result = resolveStandardConfig(
      "ANILOFOS",
      0,
      [cfg("ANILOFOS", [10])],
      [ovr({ matchType: "commonName", matchValue: "ANILOFOS", priority: 1, gc: { enabled: true, unit: "ml", slots: [99] } })],
    );
    expect(result.source).toBe("override");
    expect(result.gc.slots).toEqual([99]);
  });

  it("prefers commonName match over substring match regardless of priority", () => {
    const result = resolveStandardConfig(
      "ANILOFOS",
      0,
      [],
      [
        ovr({ matchType: "substring", matchValue: "ani", priority: 100, gc: { enabled: true, unit: "ml", slots: [5] } }),
        ovr({ matchType: "commonName", matchValue: "ANILOFOS", priority: 1, gc: { enabled: true, unit: "ml", slots: [99] } }),
      ],
    );
    expect(result.gc.slots).toEqual([99]);
  });

  it("prefers substring over substance when both at same tier", () => {
    const result = resolveStandardConfig(
      "ANILOFOS",
      0,
      [],
      [
        ovr({ matchType: "substance", matchValue: "ANILOFOS", priority: 1, gc: { enabled: true, unit: "ml", slots: [50] } }),
        ovr({ matchType: "substring", matchValue: "ani", priority: 1, gc: { enabled: true, unit: "ml", slots: [5] } }),
      ],
    );
    expect(result.gc.slots).toEqual([5]);
  });

  it("substance override matches by exact substance at substanceIndex (case-insensitive)", () => {
    const result = resolveStandardConfig(
      "ANILOFOS + BISPYRIBAC-SODIUM",
      1,
      [],
      [ovr({ matchType: "substance", matchValue: "bispyribac-sodium", priority: 1, hplc: { enabled: true, unit: "ml", slots: [10] } })],
    );
    expect(result.source).toBe("override");
    expect(result.hplc.slots).toEqual([10]);
  });

  it("substring match is case-insensitive", () => {
    const result = resolveStandardConfig(
      "ANILOFOS",
      0,
      [],
      [ovr({ matchType: "substring", matchValue: "ANI", priority: 1, gc: { enabled: true, unit: "ml", slots: [5] } })],
    );
    expect(result.source).toBe("override");
  });

  it("among overrides at same tier, higher priority wins", () => {
    const result = resolveStandardConfig(
      "ANILOFOS",
      0,
      [],
      [
        ovr({ matchType: "substring", matchValue: "ani", priority: 1, gc: { enabled: true, unit: "ml", slots: [1] } }),
        ovr({ matchType: "substring", matchValue: "ilo", priority: 10, gc: { enabled: true, unit: "ml", slots: [10] } }),
      ],
    );
    expect(result.gc.slots).toEqual([10]);
  });
});
```

- [ ] **Step 2: Run tests to verify failures**

Run: `npx vitest run src/lib/resolveStandardConfig.test.ts`
Expected: FAIL — `Cannot find module './resolveStandardConfig'`.

- [ ] **Step 3: Implement**

Create `src/lib/resolveStandardConfig.ts`:
```ts
import { parseSubstances, substanceKey } from "./substances";
import type {
  InstrumentConfig,
  StandardConfigDoc,
  StandardOverrideDoc,
} from "@/pages/standardConfig/types";

export type ResolveResult = {
  name: string;
  gc: InstrumentConfig;
  hplc: InstrumentConfig;
  source: "override" | "base" | "none";
};

const EMPTY: InstrumentConfig = { enabled: false, unit: "ml", slots: [] };

function pickByTier(
  overrides: StandardOverrideDoc[],
  predicate: (o: StandardOverrideDoc) => boolean,
): StandardOverrideDoc | null {
  const matches = overrides.filter(predicate);
  if (matches.length === 0) return null;
  matches.sort((a, b) => b.priority - a.priority);
  return matches[0];
}

export function resolveStandardConfig(
  commonName: string,
  substanceIndex: number,
  configs: StandardConfigDoc[],
  overrides: StandardOverrideDoc[],
): ResolveResult {
  const substances = parseSubstances(commonName);
  const substance = substances[substanceIndex] || "";
  const commonLower = commonName.trim().toLowerCase();
  const substanceLower = substanceKey(substance);

  // Tier 1: exact commonName match
  const cnHit = pickByTier(
    overrides,
    (o) => o.matchType === "commonName" && o.matchValueLower === commonLower,
  );
  if (cnHit) return overrideToResult(cnHit, substance);

  // Tier 2: substring in commonName (case-insensitive)
  const subHit = pickByTier(
    overrides,
    (o) => o.matchType === "substring" && commonLower.includes(o.matchValueLower),
  );
  if (subHit) return overrideToResult(subHit, substance);

  // Tier 3: exact substance match at substanceIndex
  const subsHit = pickByTier(
    overrides,
    (o) => o.matchType === "substance" && o.matchValueLower === substanceLower,
  );
  if (subsHit) return overrideToResult(subsHit, substance);

  // Tier 4: base config
  const base = configs.find((c) => c.nameLower === substanceLower);
  if (base) {
    return { name: base.name, gc: base.gc, hplc: base.hplc, source: "base" };
  }

  return { name: substance, gc: EMPTY, hplc: EMPTY, source: "none" };
}

function overrideToResult(o: StandardOverrideDoc, fallbackName: string): ResolveResult {
  return { name: o.matchValue || fallbackName, gc: o.gc, hplc: o.hplc, source: "override" };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/resolveStandardConfig.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/resolveStandardConfig.ts src/lib/resolveStandardConfig.test.ts
git commit -m "feat(lib): resolveStandardConfig lookup with override priority order"
```

---

## Task 8: Page scaffold + route + sidebar

**Files:**
- Create: `src/pages/StandardConfig.tsx`
- Create: `src/pages/standardConfig/SubstancesTab.tsx` (placeholder)
- Create: `src/pages/standardConfig/OverridesTab.tsx` (placeholder)
- Modify: `src/App.tsx`
- Modify: `src/lib/navItems.ts`

- [ ] **Step 1: Placeholder tab files**

Create `src/pages/standardConfig/SubstancesTab.tsx`:
```tsx
export default function SubstancesTab() {
  return <div className="py-8 text-sm text-muted-foreground">Substances tab — coming next</div>;
}
```

Create `src/pages/standardConfig/OverridesTab.tsx`:
```tsx
export default function OverridesTab() {
  return <div className="py-8 text-sm text-muted-foreground">Overrides tab — coming next</div>;
}
```

- [ ] **Step 2: Create main page**

Create `src/pages/StandardConfig.tsx`:
```tsx
import { FlaskRound } from "lucide-react";
import AppLayout from "@/components/lis/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SubstancesTab from "./standardConfig/SubstancesTab";
import OverridesTab from "./standardConfig/OverridesTab";

export default function StandardConfig() {
  return (
    <AppLayout title="Standard Config">
      <div className="space-y-4">
        <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
          <FlaskRound className="w-6 h-6" />
          Standard Config
        </h1>
        <p className="text-sm text-muted-foreground">
          ตั้งค่า standard ต่อสาร + override rules (ใช้สำหรับลบสต็อกในอนาคต)
        </p>
        <Tabs defaultValue="substances" className="w-full">
          <TabsList>
            <TabsTrigger value="substances">Substances</TabsTrigger>
            <TabsTrigger value="overrides">Overrides</TabsTrigger>
          </TabsList>
          <TabsContent value="substances">
            <SubstancesTab />
          </TabsContent>
          <TabsContent value="overrides">
            <OverridesTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
```

- [ ] **Step 3: Register route**

In `src/App.tsx`, add import near the other page imports:
```ts
import StandardConfig from "./pages/StandardConfig";
```

Add route inside `<Routes>` (after `/parameter-settings`):
```tsx
<Route path="/standard-config" element={<PrivateRoute><StandardConfig /></PrivateRoute>} />
```

- [ ] **Step 4: Add sidebar entry**

In `src/lib/navItems.ts`, add to the `NAV_ITEMS` array (after `/simple-method` line):
```ts
  { icon: FlaskConical, label: "Standard Config", path: "/standard-config" },
```

- [ ] **Step 5: Manual smoke test**

Run: `npm run dev` (if not running).
Navigate to `http://localhost:8000/standard-config`.
Expected: page loads, both tabs render their placeholder text, sidebar entry visible and active when on the page.

- [ ] **Step 6: Type-check + tests**

Run: `npx tsc --noEmit`
Run: `npx vitest run`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/pages/StandardConfig.tsx src/pages/standardConfig/ src/App.tsx src/lib/navItems.ts
git commit -m "feat(ui): scaffold /standard-config page with Tabs + sidebar entry"
```

---

## Task 9: Shared `SlotEditor` component

**Files:**
- Create: `src/pages/standardConfig/SlotEditor.tsx`

Used by both tabs to edit `{enabled, unit, slots[]}` for GC or HPLC.

- [ ] **Step 1: Create component**

Create `src/pages/standardConfig/SlotEditor.tsx`:
```tsx
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  STANDARD_UNITS,
  type InstrumentConfig,
  type StandardUnit,
} from "./types";

type Props = {
  label: string;
  value: InstrumentConfig;
  onChange: (next: InstrumentConfig) => void;
  disabled?: boolean;
};

export default function SlotEditor({ label, value, onChange, disabled }: Props) {
  const [draft, setDraft] = useState<string>("");

  const setEnabled = (enabled: boolean) => onChange({ ...value, enabled });
  const setUnit = (unit: StandardUnit) => onChange({ ...value, unit });
  const removeSlot = (idx: number) =>
    onChange({ ...value, slots: value.slots.filter((_, i) => i !== idx) });
  const addSlot = () => {
    const n = Number(draft);
    if (!Number.isFinite(n) || n <= 0) return;
    if (value.slots.length >= 20) return;
    onChange({ ...value, slots: [...value.slots, n] });
    setDraft("");
  };
  const editSlot = (idx: number, raw: string) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    const next = [...value.slots];
    next[idx] = n;
    onChange({ ...value, slots: next });
  };

  return (
    <div className={cn("flex flex-col gap-2", disabled && "opacity-60 pointer-events-none")}>
      <div className="flex items-center gap-2">
        <Checkbox
          id={`${label}-enabled`}
          checked={value.enabled}
          onCheckedChange={(v) => setEnabled(Boolean(v))}
        />
        <label htmlFor={`${label}-enabled`} className="text-sm font-medium">
          {label}
        </label>
        {value.enabled && (
          <Select value={value.unit} onValueChange={(v) => setUnit(v as StandardUnit)}>
            <SelectTrigger className="h-7 w-20 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STANDARD_UNITS.map((u) => (
                <SelectItem key={u} value={u} className="text-xs">{u}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      {value.enabled ? (
        <div className="flex flex-wrap gap-1.5 items-center">
          {value.slots.map((s, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs">
              <Input
                type="number"
                value={s}
                onChange={(e) => editSlot(i, e.target.value)}
                className="h-5 w-14 border-0 bg-transparent p-0 text-xs"
              />
              <button
                type="button"
                onClick={() => removeSlot(i)}
                className="text-muted-foreground hover:text-destructive"
                aria-label={`remove slot ${i + 1}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <Input
            type="number"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); addSlot(); }
            }}
            placeholder="ค่า"
            className="h-6 w-16 text-xs"
          />
          <Button type="button" size="sm" variant="outline" className="h-6 px-2" onClick={addSlot}>
            <Plus className="w-3 h-3" />
          </Button>
          {value.slots.length === 0 && (
            <span className="text-xs text-amber-600">⚠ ยังไม่ตั้งค่า</span>
          )}
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/pages/standardConfig/SlotEditor.tsx
git commit -m "feat(ui): SlotEditor component for instrument config rows"
```

---

## Task 10: Substances tab — read, render, inline auto-save

**Files:**
- Modify: `src/pages/standardConfig/SubstancesTab.tsx`

Replace the placeholder with the full tab. This is the largest single file change in the plan — keep it focused on read+render+edit; sync/add/filter come in later tasks.

- [ ] **Step 1: Implement read + render + auto-save**

Replace `src/pages/standardConfig/SubstancesTab.tsx` with:
```tsx
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import SlotEditor from "./SlotEditor";
import type { InstrumentConfig, StandardConfigDoc } from "./types";

export default function SubstancesTab() {
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useQuery<StandardConfigDoc[]>({
    queryKey: ["standard-configs"],
    queryFn: () => api.getStandardConfigs(),
  });

  // Optimistic local cache for in-flight edits
  const [pending, setPending] = useState<Record<string, Partial<StandardConfigDoc>>>({});

  const mutation = useMutation({
    mutationFn: ({ nameLower, patch }: { nameLower: string; patch: Partial<StandardConfigDoc> }) =>
      api.updateStandardConfig(nameLower, patch),
    onSuccess: (_data, vars) => {
      setPending((p) => {
        const next = { ...p };
        delete next[vars.nameLower];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["standard-configs"] });
    },
    onError: (err: Error, vars) => {
      toast.error(`บันทึก ${vars.nameLower} ไม่สำเร็จ — ${err.message}`);
      setPending((p) => {
        const next = { ...p };
        delete next[vars.nameLower];
        return next;
      });
    },
  });

  const rows = useMemo<StandardConfigDoc[]>(() => {
    return data.map((row) => ({ ...row, ...(pending[row.nameLower] || {}) }));
  }, [data, pending]);

  const handleInstrumentChange = (
    row: StandardConfigDoc,
    field: "gc" | "hplc",
    next: InstrumentConfig,
  ) => {
    const patch = { gc: row.gc, hplc: row.hplc, [field]: next };
    setPending((p) => ({ ...p, [row.nameLower]: patch }));
    mutation.mutate({ nameLower: row.nameLower, patch });
  };

  if (isLoading) return <div className="py-8 text-sm text-muted-foreground">โหลด...</div>;

  return (
    <div className="space-y-3">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[260px]">Standard</TableHead>
              <TableHead className="w-[120px]">Source</TableHead>
              <TableHead>GC</TableHead>
              <TableHead>HPLC</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                  ยังไม่มี standard — กด Sync จาก Master เพื่อเริ่ม
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row._id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>
                    <Badge variant={row.isManual ? "secondary" : "outline"}>
                      {row.isManual ? "manual" : "master"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <SlotEditor
                      label="GC"
                      value={row.gc}
                      onChange={(next) => handleInstrumentChange(row, "gc", next)}
                    />
                  </TableCell>
                  <TableCell>
                    <SlotEditor
                      label="HPLC"
                      value={row.hplc}
                      onChange={(next) => handleInstrumentChange(row, "hplc", next)}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Manual smoke**

Run dev server. Navigate to `/standard-config`. Substances tab should show "ยังไม่มี standard..." (or rows if Task 4 sync ran).

If empty, you can preload: `curl -X POST http://localhost:3001/api/standard-configs/sync`. Refresh — rows appear.

Toggle a GC checkbox on a row → unit dropdown appears → add a slot value 10 → press Enter → chip appears. Check Network tab: PUT request to `/api/standard-configs/<nameLower>` returns 200. Refresh page → value persisted.

- [ ] **Step 3: Type-check + tests**

Run: `npx tsc --noEmit`
Run: `npx vitest run`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/pages/standardConfig/SubstancesTab.tsx
git commit -m "feat(ui): substances tab — read, render, inline auto-save"
```

---

## Task 11: Substances tab — sync button + add-manual dialog

**Files:**
- Modify: `src/pages/standardConfig/SubstancesTab.tsx`

- [ ] **Step 1: Add sync button + add-manual dialog**

In `src/pages/standardConfig/SubstancesTab.tsx`, add these imports at the top:
```tsx
import { useState as useReactState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
```
(If `useState` is already imported, drop the alias and use the existing import. The above is for clarity — adjust to match the existing imports.)

Inside the `SubstancesTab` component, add above the `mutation` declaration:
```tsx
const [addOpen, setAddOpen] = useState(false);
const [newName, setNewName] = useState("");
const [newGc, setNewGc] = useState<InstrumentConfig>({ enabled: false, unit: "ml", slots: [] });
const [newHplc, setNewHplc] = useState<InstrumentConfig>({ enabled: false, unit: "ml", slots: [] });

const syncMutation = useMutation({
  mutationFn: () => api.syncStandardConfigs(),
  onSuccess: (result) => {
    toast.success(`Sync เสร็จ — เพิ่ม ${result.added} / อัพเดต ${result.updated}`);
    queryClient.invalidateQueries({ queryKey: ["standard-configs"] });
  },
  onError: (err: Error) => toast.error(`Sync ไม่สำเร็จ — ${err.message}`),
});

const createMutation = useMutation({
  mutationFn: () =>
    api.createStandardConfig({
      name: newName.trim(),
      gc: newGc,
      hplc: newHplc,
    }),
  onSuccess: () => {
    toast.success("เพิ่ม standard สำเร็จ");
    setAddOpen(false);
    setNewName("");
    setNewGc({ enabled: false, unit: "ml", slots: [] });
    setNewHplc({ enabled: false, unit: "ml", slots: [] });
    queryClient.invalidateQueries({ queryKey: ["standard-configs"] });
  },
  onError: (err: Error) => toast.error(err.message),
});
```

Then add a toolbar above the `<div className="rounded-md border">` block:
```tsx
<div className="flex items-center gap-2">
  <Button
    variant="outline"
    size="sm"
    onClick={() => syncMutation.mutate()}
    disabled={syncMutation.isPending}
  >
    <RefreshCw className={`w-4 h-4 mr-1 ${syncMutation.isPending ? "animate-spin" : ""}`} />
    Sync จาก Master
  </Button>
  <Dialog open={addOpen} onOpenChange={setAddOpen}>
    <DialogTrigger asChild>
      <Button size="sm"><Plus className="w-4 h-4 mr-1" /> เพิ่ม Standard</Button>
    </DialogTrigger>
    <DialogContent>
      <DialogHeader><DialogTitle>เพิ่ม Standard</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label htmlFor="new-std-name">ชื่อ Standard</Label>
          <Input id="new-std-name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        </div>
        <SlotEditor label="GC" value={newGc} onChange={setNewGc} />
        <SlotEditor label="HPLC" value={newHplc} onChange={setNewHplc} />
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={() => setAddOpen(false)}>ยกเลิก</Button>
        <Button
          onClick={() => createMutation.mutate()}
          disabled={!newName.trim() || createMutation.isPending}
        >
          บันทึก
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</div>
```

Also add a delete button column for manual rows. Update the table header to include an actions column:
```tsx
<TableHead className="w-[60px]" />
```
And in each row, add a final cell:
```tsx
<TableCell>
  {row.isManual && (
    <Button
      size="icon"
      variant="ghost"
      onClick={() => {
        if (!confirm(`ลบ ${row.name}?`)) return;
        api.deleteStandardConfig(row.nameLower)
          .then(() => {
            toast.success("ลบสำเร็จ");
            queryClient.invalidateQueries({ queryKey: ["standard-configs"] });
          })
          .catch((err: Error) => toast.error(err.message));
      }}
    >
      <Trash2 className="w-4 h-4 text-destructive" />
    </Button>
  )}
</TableCell>
```
Import `Trash2` from `lucide-react` alongside the other icons.

- [ ] **Step 2: Manual smoke**

- Click "Sync จาก Master" → toast appears with counts.
- Click "เพิ่ม Standard" → dialog opens. Fill name "TEST-MANUAL", enable GC, add slot 5, save → new row with `manual` badge + 🗑 button.
- Click 🗑 → confirm → row removed.

- [ ] **Step 3: Type-check + commit**

Run: `npx tsc --noEmit`

```bash
git add src/pages/standardConfig/SubstancesTab.tsx
git commit -m "feat(ui): substances tab — sync, add-manual, delete-manual"
```

---

## Task 12: Substances tab — search + filter + URL state

**Files:**
- Modify: `src/pages/standardConfig/SubstancesTab.tsx`

- [ ] **Step 1: Add search + filter**

Add imports:
```tsx
import { Search } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import {
  Select as FilterSelect,
  SelectContent as FilterSelectContent,
  SelectItem as FilterSelectItem,
  SelectTrigger as FilterSelectTrigger,
  SelectValue as FilterSelectValue,
} from "@/components/ui/select";
```
(If `Select` already imported by SlotEditor at file scope, you can reuse; the aliases shown above keep this self-contained.)

Inside the component, add:
```tsx
const [searchParams, setSearchParams] = useSearchParams();
const q = (searchParams.get("q") || "").toLowerCase();
const filter = searchParams.get("filter") || "all"; // all | gc | hplc | unset

const filteredRows = useMemo(() => {
  return rows
    .filter((r) => (q ? r.nameLower.includes(q) : true))
    .filter((r) => {
      if (filter === "gc") return r.gc.enabled;
      if (filter === "hplc") return r.hplc.enabled;
      if (filter === "unset") return !r.gc.enabled && !r.hplc.enabled;
      return true;
    });
}, [rows, q, filter]);
```

Replace the body iteration to use `filteredRows` instead of `rows`.

Add filter controls inside the toolbar (next to existing buttons):
```tsx
<div className="ml-auto flex items-center gap-2">
  <div className="relative">
    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
    <Input
      placeholder="ค้นหา..."
      value={searchParams.get("q") || ""}
      onChange={(e) => {
        const next = new URLSearchParams(searchParams);
        if (e.target.value) next.set("q", e.target.value);
        else next.delete("q");
        setSearchParams(next, { replace: true });
      }}
      className="h-8 w-40 pl-7 text-sm"
    />
  </div>
  <FilterSelect
    value={filter}
    onValueChange={(v) => {
      const next = new URLSearchParams(searchParams);
      if (v === "all") next.delete("filter");
      else next.set("filter", v);
      setSearchParams(next, { replace: true });
    }}
  >
    <FilterSelectTrigger className="h-8 w-36 text-sm">
      <FilterSelectValue />
    </FilterSelectTrigger>
    <FilterSelectContent>
      <FilterSelectItem value="all">ทั้งหมด</FilterSelectItem>
      <FilterSelectItem value="gc">GC enabled</FilterSelectItem>
      <FilterSelectItem value="hplc">HPLC enabled</FilterSelectItem>
      <FilterSelectItem value="unset">ยังไม่ตั้งค่า</FilterSelectItem>
    </FilterSelectContent>
  </FilterSelect>
</div>
```

- [ ] **Step 2: Manual smoke**

- Type in search box → URL updates `?q=...` → rows filter (substring on lowercase name).
- Change filter dropdown → URL updates `?filter=gc` → only GC-enabled rows shown.
- Refresh page with `?q=ani&filter=gc` in URL → state restored.

- [ ] **Step 3: Type-check + commit**

```bash
git add src/pages/standardConfig/SubstancesTab.tsx
git commit -m "feat(ui): substances tab — search + filter persisted in URL"
```

---

## Task 13: Overrides tab — list + delete

**Files:**
- Modify: `src/pages/standardConfig/OverridesTab.tsx`

- [ ] **Step 1: Implement read + render + delete**

Replace `src/pages/standardConfig/OverridesTab.tsx`:
```tsx
import { Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import type { StandardOverrideDoc } from "./types";

function renderSlots(cfg: { enabled: boolean; unit: string; slots: number[] }) {
  if (!cfg.enabled) return <span className="text-xs text-muted-foreground">—</span>;
  if (cfg.slots.length === 0) return <span className="text-xs text-amber-600">⚠ ยังไม่ตั้งค่า</span>;
  return (
    <span className="text-xs">{cfg.slots.length} × [{cfg.slots.join(", ")}] {cfg.unit}</span>
  );
}

export default function OverridesTab() {
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useQuery<StandardOverrideDoc[]>({
    queryKey: ["standard-overrides"],
    queryFn: () => api.getStandardOverrides(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteStandardOverride(id),
    onSuccess: () => {
      toast.success("ลบ rule สำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["standard-overrides"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) return <div className="py-8 text-sm text-muted-foreground">โหลด...</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {/* Add button comes in next task */}
        <span className="text-xs text-muted-foreground">{data.length} rules</span>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">Pri</TableHead>
              <TableHead className="w-[200px]">Match</TableHead>
              <TableHead className="w-[140px]">Scope</TableHead>
              <TableHead>GC</TableHead>
              <TableHead>HPLC</TableHead>
              <TableHead className="w-[140px]">Note</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                  ยังไม่มี override rules
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow key={row._id}>
                  <TableCell className="text-xs">{row.priority}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="mr-1 text-xs">{row.matchType}</Badge>
                    <span className="text-xs font-mono">"{row.matchValue}"</span>
                  </TableCell>
                  <TableCell className="text-xs">{row.scope === "wholeCommonName" ? "whole" : "substance"}</TableCell>
                  <TableCell>{renderSlots(row.gc)}</TableCell>
                  <TableCell>{renderSlots(row.hplc)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.note}</TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (!confirm(`ลบ override rule นี้?`)) return;
                        deleteMutation.mutate(row._id);
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Manual smoke**

Seed an override:
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"matchType":"substring","matchValue":"ani","priority":10,"gc":{"enabled":true,"unit":"ml","slots":[5]}}' \
  http://localhost:3001/api/standard-overrides
```

Reload `/standard-config`, switch to Overrides tab → row appears, sorted by priority desc. Click 🗑 → confirm → row removed.

- [ ] **Step 3: Type-check + commit**

```bash
git add src/pages/standardConfig/OverridesTab.tsx
git commit -m "feat(ui): overrides tab — read, render, delete"
```

---

## Task 14: Overrides tab — Add Rule dialog with live preview

**Files:**
- Modify: `src/pages/standardConfig/OverridesTab.tsx`

- [ ] **Step 1: Add dialog state + form**

Add imports to top of `OverridesTab.tsx`:
```tsx
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SlotEditor from "./SlotEditor";
import { parseSubstances } from "@/lib/substances";
import type {
  InstrumentConfig,
  MatchType,
  OverrideScope,
  StandardConfigDoc,
} from "./types";
```

Inside `OverridesTab`, add (above `if (isLoading) ...`):
```tsx
const { data: configs = [] } = useQuery<StandardConfigDoc[]>({
  queryKey: ["standard-configs"],
  queryFn: () => api.getStandardConfigs(),
});

// master items already fetched elsewhere; reuse same key
const { data: masterItems = [] } = useQuery<Array<Record<string, unknown>>>({
  queryKey: ["master-items-for-overrides"],
  queryFn: async () => {
    const res = await api.get<unknown>("/master-items");
    const payload = res.data.data;
    return Array.isArray(payload) ? (payload as Array<Record<string, unknown>>) : [];
  },
});

const [addOpen, setAddOpen] = useState(false);
const [matchType, setMatchType] = useState<MatchType>("substring");
const [matchValue, setMatchValue] = useState("");
const [scope, setScope] = useState<OverrideScope>("substanceOnly");
const [priority, setPriority] = useState(0);
const [note, setNote] = useState("");
const [gc, setGc] = useState<InstrumentConfig>({ enabled: false, unit: "ml", slots: [] });
const [hplc, setHplc] = useState<InstrumentConfig>({ enabled: false, unit: "ml", slots: [] });

const commonNames = useMemo(() => {
  const keys = ["common_name", "commonname", "commonName", "item_name2", "itemType"];
  const set = new Set<string>();
  for (const item of masterItems) {
    for (const k of keys) {
      const v = item[k];
      if (v !== undefined && v !== null && String(v).trim()) {
        set.add(String(v).trim());
        break;
      }
    }
  }
  return [...set].sort();
}, [masterItems]);

const preview = useMemo(() => {
  if (!matchValue.trim()) return [];
  const needle = matchValue.trim().toLowerCase();
  const hits: { commonName: string; substanceIndex: number }[] = [];
  for (const cn of commonNames) {
    const substances = parseSubstances(cn);
    if (matchType === "commonName") {
      if (cn.toLowerCase() === needle) hits.push({ commonName: cn, substanceIndex: 0 });
    } else if (matchType === "substring") {
      if (cn.toLowerCase().includes(needle)) hits.push({ commonName: cn, substanceIndex: 0 });
    } else { // substance
      substances.forEach((sub, i) => {
        if (sub.trim().toLowerCase() === needle) hits.push({ commonName: cn, substanceIndex: i });
      });
    }
    if (hits.length >= 200) break;
  }
  return hits;
}, [matchValue, matchType, commonNames]);

const createMutation = useMutation({
  mutationFn: () =>
    api.createStandardOverride({
      matchType, matchValue: matchValue.trim(), scope, priority, note, gc, hplc,
    }),
  onSuccess: () => {
    toast.success("เพิ่ม override rule สำเร็จ");
    setAddOpen(false);
    setMatchValue(""); setNote(""); setPriority(0);
    setGc({ enabled: false, unit: "ml", slots: [] });
    setHplc({ enabled: false, unit: "ml", slots: [] });
    queryClient.invalidateQueries({ queryKey: ["standard-overrides"] });
  },
  onError: (err: Error) => toast.error(err.message),
});
```

Replace the toolbar `<div>` with:
```tsx
<div className="flex items-center gap-2">
  <Dialog open={addOpen} onOpenChange={setAddOpen}>
    <DialogTrigger asChild>
      <Button size="sm"><Plus className="w-4 h-4 mr-1" /> เพิ่ม Override Rule</Button>
    </DialogTrigger>
    <DialogContent className="max-w-xl">
      <DialogHeader><DialogTitle>เพิ่ม Override Rule</DialogTitle></DialogHeader>
      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
        <div>
          <Label className="text-sm">Match type</Label>
          <RadioGroup value={matchType} onValueChange={(v) => setMatchType(v as MatchType)} className="flex gap-4 mt-1">
            <label className="flex items-center gap-1 text-sm"><RadioGroupItem value="substring" /> Substring</label>
            <label className="flex items-center gap-1 text-sm"><RadioGroupItem value="substance" /> Substance</label>
            <label className="flex items-center gap-1 text-sm"><RadioGroupItem value="commonName" /> CommonName</label>
          </RadioGroup>
        </div>
        <div>
          <Label htmlFor="match-value" className="text-sm">Match value</Label>
          {matchType === "substring" ? (
            <Input id="match-value" value={matchValue} onChange={(e) => setMatchValue(e.target.value)} />
          ) : matchType === "substance" ? (
            <Select value={matchValue} onValueChange={setMatchValue}>
              <SelectTrigger><SelectValue placeholder="เลือก substance" /></SelectTrigger>
              <SelectContent>
                {configs.map((c) => (
                  <SelectItem key={c._id} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Select value={matchValue} onValueChange={setMatchValue}>
              <SelectTrigger><SelectValue placeholder="เลือก commonName" /></SelectTrigger>
              <SelectContent>
                {commonNames.map((cn) => (
                  <SelectItem key={cn} value={cn}>{cn}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div>
          <Label className="text-sm">Scope</Label>
          <RadioGroup
            value={scope}
            onValueChange={(v) => setScope(v as OverrideScope)}
            className="flex gap-4 mt-1"
          >
            <label className={`flex items-center gap-1 text-sm ${matchType === "commonName" ? "opacity-40" : ""}`}>
              <RadioGroupItem value="substanceOnly" disabled={matchType === "commonName"} />
              เฉพาะ substance ที่ match
            </label>
            <label className="flex items-center gap-1 text-sm">
              <RadioGroupItem value="wholeCommonName" /> ทั้ง commonName
            </label>
          </RadioGroup>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="priority" className="text-sm">Priority</Label>
            <Input
              id="priority"
              type="number"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="note" className="text-sm">Note</Label>
            <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <SlotEditor label="GC" value={gc} onChange={setGc} />
        <SlotEditor label="HPLC" value={hplc} onChange={setHplc} />
        {matchValue.trim() && (
          <div className="rounded border bg-muted/40 p-2 text-xs">
            <div className="font-medium mb-1">จะกระทบ commonName เหล่านี้ ({preview.length} รายการ):</div>
            {preview.length === 0 ? (
              <div className="text-muted-foreground">ไม่ match commonName ใดๆ</div>
            ) : (
              <ul className="space-y-0.5">
                {preview.slice(0, 5).map((h, i) => (
                  <li key={i}>· {h.commonName} (substance #{h.substanceIndex + 1})</li>
                ))}
                {preview.length > 5 && (
                  <li className="text-muted-foreground">… และอีก {preview.length - 5}</li>
                )}
              </ul>
            )}
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={() => setAddOpen(false)}>ยกเลิก</Button>
        <Button
          onClick={() => createMutation.mutate()}
          disabled={!matchValue.trim() || createMutation.isPending}
        >
          บันทึก
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
  <span className="text-xs text-muted-foreground">{data.length} rules</span>
</div>
```

- [ ] **Step 2: Manual smoke**

- Click "เพิ่ม Override Rule" → dialog opens.
- Choose Substring + type "ani" → preview lists matching commonNames (e.g. ANILOFOS rows).
- Enable GC + add slot 5, save → toast success → new row in table.
- Repeat with same `substring "ani"` → toast error 409 duplicate.

- [ ] **Step 3: Type-check + commit**

```bash
git add src/pages/standardConfig/OverridesTab.tsx
git commit -m "feat(ui): overrides tab — add dialog with live preview"
```

---

## Task 15: Overrides tab — inline edit + conflict warning + keep-local-on-error

**Files:**
- Modify: `src/pages/standardConfig/OverridesTab.tsx`
- Modify: `src/pages/standardConfig/SubstancesTab.tsx`

Implements three spec items that were deferred from earlier tasks:
1. Inline-edit overrides (spec: "Edit / delete — Inline expand on row click; same controls as the add dialog").
2. Conflict warning on same-priority overlap (spec: "Conflict warning — non-blocking").
3. Keep local edit on Substances-tab mutation failure (spec: "Network / 500: toast + keep local edit + retry button").

- [ ] **Step 1: Refactor add/edit form into shared component**

In `src/pages/standardConfig/OverridesTab.tsx`, factor the dialog form body
into a local `OverrideForm` component near the top of the file (above
`OverridesTab`). Both add and edit reuse it:

```tsx
type OverrideFormValue = {
  matchType: MatchType;
  matchValue: string;
  scope: OverrideScope;
  priority: number;
  note: string;
  gc: InstrumentConfig;
  hplc: InstrumentConfig;
};

function OverrideForm({
  value, onChange, lockMatchType, configs, commonNames,
}: {
  value: OverrideFormValue;
  onChange: (next: OverrideFormValue) => void;
  lockMatchType: boolean; // true when editing
  configs: StandardConfigDoc[];
  commonNames: string[];
}) {
  const preview = useMemo(() => {
    if (!value.matchValue.trim()) return [];
    const needle = value.matchValue.trim().toLowerCase();
    const hits: { commonName: string; substanceIndex: number }[] = [];
    for (const cn of commonNames) {
      const substances = parseSubstances(cn);
      if (value.matchType === "commonName") {
        if (cn.toLowerCase() === needle) hits.push({ commonName: cn, substanceIndex: 0 });
      } else if (value.matchType === "substring") {
        if (cn.toLowerCase().includes(needle)) hits.push({ commonName: cn, substanceIndex: 0 });
      } else {
        substances.forEach((sub, i) => {
          if (sub.trim().toLowerCase() === needle) hits.push({ commonName: cn, substanceIndex: i });
        });
      }
      if (hits.length >= 200) break;
    }
    return hits;
  }, [value.matchValue, value.matchType, commonNames]);

  return (
    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
      <div>
        <Label className="text-sm">Match type</Label>
        <RadioGroup
          value={value.matchType}
          onValueChange={(v) => onChange({ ...value, matchType: v as MatchType })}
          className="flex gap-4 mt-1"
        >
          {(["substring", "substance", "commonName"] as MatchType[]).map((mt) => (
            <label key={mt} className={`flex items-center gap-1 text-sm ${lockMatchType ? "opacity-40" : ""}`}>
              <RadioGroupItem value={mt} disabled={lockMatchType} /> {mt}
            </label>
          ))}
        </RadioGroup>
        {lockMatchType && (
          <div className="text-xs text-muted-foreground mt-1">
            ไม่สามารถแก้ match type ของ rule ที่มีอยู่ — ลบแล้วสร้างใหม่
          </div>
        )}
      </div>
      <div>
        <Label htmlFor="match-value" className="text-sm">Match value</Label>
        {value.matchType === "substring" ? (
          <Input
            id="match-value"
            value={value.matchValue}
            onChange={(e) => onChange({ ...value, matchValue: e.target.value })}
          />
        ) : value.matchType === "substance" ? (
          <Select value={value.matchValue} onValueChange={(v) => onChange({ ...value, matchValue: v })}>
            <SelectTrigger><SelectValue placeholder="เลือก substance" /></SelectTrigger>
            <SelectContent>
              {configs.map((c) => (<SelectItem key={c._id} value={c.name}>{c.name}</SelectItem>))}
            </SelectContent>
          </Select>
        ) : (
          <Select value={value.matchValue} onValueChange={(v) => onChange({ ...value, matchValue: v })}>
            <SelectTrigger><SelectValue placeholder="เลือก commonName" /></SelectTrigger>
            <SelectContent>
              {commonNames.map((cn) => (<SelectItem key={cn} value={cn}>{cn}</SelectItem>))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div>
        <Label className="text-sm">Scope</Label>
        <RadioGroup
          value={value.scope}
          onValueChange={(v) => onChange({ ...value, scope: v as OverrideScope })}
          className="flex gap-4 mt-1"
        >
          <label className={`flex items-center gap-1 text-sm ${value.matchType === "commonName" ? "opacity-40" : ""}`}>
            <RadioGroupItem value="substanceOnly" disabled={value.matchType === "commonName"} />
            เฉพาะ substance ที่ match
          </label>
          <label className="flex items-center gap-1 text-sm">
            <RadioGroupItem value="wholeCommonName" /> ทั้ง commonName
          </label>
        </RadioGroup>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="priority" className="text-sm">Priority</Label>
          <Input
            id="priority" type="number" value={value.priority}
            onChange={(e) => onChange({ ...value, priority: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label htmlFor="note" className="text-sm">Note</Label>
          <Input
            id="note" value={value.note}
            onChange={(e) => onChange({ ...value, note: e.target.value })}
          />
        </div>
      </div>
      <SlotEditor label="GC" value={value.gc} onChange={(gc) => onChange({ ...value, gc })} />
      <SlotEditor label="HPLC" value={value.hplc} onChange={(hplc) => onChange({ ...value, hplc })} />
      {value.matchValue.trim() && (
        <div className="rounded border bg-muted/40 p-2 text-xs">
          <div className="font-medium mb-1">จะกระทบ commonName เหล่านี้ ({preview.length} รายการ):</div>
          {preview.length === 0 ? (
            <div className="text-muted-foreground">ไม่ match commonName ใดๆ</div>
          ) : (
            <ul className="space-y-0.5">
              {preview.slice(0, 5).map((h, i) => (
                <li key={i}>· {h.commonName} (substance #{h.substanceIndex + 1})</li>
              ))}
              {preview.length > 5 && (
                <li className="text-muted-foreground">… และอีก {preview.length - 5}</li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
```

Then refactor the existing Add dialog body to use `<OverrideForm value={...} onChange={...} lockMatchType={false} ... />` instead of inlining all the fields. Replace the inline `useState` for matchType/matchValue/etc. with a single `useState<OverrideFormValue>(...)`.

- [ ] **Step 2: Add edit dialog state + handler**

Inside `OverridesTab`, add:
```tsx
const [editingId, setEditingId] = useState<string | null>(null);
const [editValue, setEditValue] = useState<OverrideFormValue | null>(null);

const openEdit = (row: StandardOverrideDoc) => {
  setEditingId(row._id);
  setEditValue({
    matchType: row.matchType,
    matchValue: row.matchValue,
    scope: row.scope,
    priority: row.priority,
    note: row.note,
    gc: row.gc,
    hplc: row.hplc,
  });
};

const updateMutation = useMutation({
  mutationFn: () => {
    if (!editingId || !editValue) throw new Error("no edit state");
    return api.updateStandardOverride(editingId, {
      matchValue: editValue.matchValue,
      scope: editValue.scope,
      priority: editValue.priority,
      note: editValue.note,
      gc: editValue.gc,
      hplc: editValue.hplc,
      // matchType intentionally omitted — server ignores it
    });
  },
  onSuccess: () => {
    toast.success("อัพเดต rule สำเร็จ");
    setEditingId(null);
    setEditValue(null);
    queryClient.invalidateQueries({ queryKey: ["standard-overrides"] });
  },
  onError: (err: Error) => toast.error(err.message),
});
```

In the table, add an Edit button cell (before the delete button):
```tsx
<TableCell>
  <Button size="icon" variant="ghost" onClick={() => openEdit(row)}>
    <Pencil className="w-4 h-4" />
  </Button>
</TableCell>
```
Update the `<TableHead className="w-[60px]" />` count and `colSpan={7}` → `colSpan={8}`.
Import `Pencil` from `lucide-react`.

Add the edit dialog at the bottom of the JSX (after the existing add Dialog):
```tsx
<Dialog open={editingId !== null} onOpenChange={(open) => { if (!open) { setEditingId(null); setEditValue(null); } }}>
  <DialogContent className="max-w-xl">
    <DialogHeader><DialogTitle>แก้ Override Rule</DialogTitle></DialogHeader>
    {editValue && (
      <OverrideForm
        value={editValue}
        onChange={setEditValue}
        lockMatchType
        configs={configs}
        commonNames={commonNames}
      />
    )}
    <DialogFooter>
      <Button variant="ghost" onClick={() => { setEditingId(null); setEditValue(null); }}>ยกเลิก</Button>
      <Button
        onClick={() => updateMutation.mutate()}
        disabled={!editValue?.matchValue.trim() || updateMutation.isPending}
      >
        บันทึก
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

- [ ] **Step 3: Add conflict warning on save**

Define a helper near the top of `OverridesTab.tsx` (outside the component):
```tsx
function overlaps(a: StandardOverrideDoc, b: { matchType: MatchType; matchValueLower: string }): boolean {
  if (a.matchType === "substring" && b.matchType === "substring") {
    return a.matchValueLower.includes(b.matchValueLower) || b.matchValueLower.includes(a.matchValueLower);
  }
  if (a.matchType === b.matchType) {
    return a.matchValueLower === b.matchValueLower;
  }
  return false;
}
```

Inside the component, add a `checkConflict` helper that runs before `mutate()` fires (for both add and update):
```tsx
const checkConflict = (formValue: OverrideFormValue, excludeId?: string): StandardOverrideDoc | null => {
  const needle = {
    matchType: formValue.matchType,
    matchValueLower: formValue.matchValue.trim().toLowerCase(),
  };
  for (const row of data) {
    if (excludeId && row._id === excludeId) continue;
    if (row.priority !== formValue.priority) continue;
    if (overlaps(row, needle)) return row;
  }
  return null;
};
```

Wrap the save buttons to confirm on conflict:
```tsx
const submitAdd = () => {
  const conflict = checkConflict(addValue);
  if (conflict) {
    const ok = confirm(
      `rule นี้ priority เท่ากับ '${conflict.matchType} ${conflict.matchValue}' — อาจ match ทับกัน. บันทึกต่อ?`,
    );
    if (!ok) return;
  }
  createMutation.mutate();
};
const submitEdit = () => {
  if (!editValue) return;
  const conflict = checkConflict(editValue, editingId ?? undefined);
  if (conflict) {
    const ok = confirm(
      `rule นี้ priority เท่ากับ '${conflict.matchType} ${conflict.matchValue}' — อาจ match ทับกัน. บันทึกต่อ?`,
    );
    if (!ok) return;
  }
  updateMutation.mutate();
};
```
Wire the Add dialog's save button to `submitAdd` and the Edit dialog's save button to `submitEdit`.

- [ ] **Step 4: SubstancesTab — keep-local + retry on mutation error**

In `src/pages/standardConfig/SubstancesTab.tsx`, change the mutation `onError`
to keep the local edit in `pending` (so the UI does not revert) and track an
error map. Replace the existing `onError` with:

```tsx
const [errored, setErrored] = useState<Set<string>>(new Set());

const mutation = useMutation({
  mutationFn: ({ nameLower, patch }: { nameLower: string; patch: Partial<StandardConfigDoc> }) =>
    api.updateStandardConfig(nameLower, patch),
  onSuccess: (_data, vars) => {
    setPending((p) => {
      const next = { ...p };
      delete next[vars.nameLower];
      return next;
    });
    setErrored((s) => {
      const n = new Set(s); n.delete(vars.nameLower); return n;
    });
    queryClient.invalidateQueries({ queryKey: ["standard-configs"] });
  },
  onError: (err: Error, vars) => {
    toast.error(`บันทึก ${vars.nameLower} ไม่สำเร็จ — ${err.message}`);
    setErrored((s) => new Set(s).add(vars.nameLower));
    // DO NOT delete from `pending` — keep the local edit visible per spec
  },
});

const retry = (row: StandardConfigDoc) => {
  const patch = pending[row.nameLower];
  if (!patch) return;
  mutation.mutate({ nameLower: row.nameLower, patch });
};
```

Add a retry indicator cell or icon when `errored.has(row.nameLower)`:
```tsx
{errored.has(row.nameLower) && (
  <Button size="sm" variant="outline" onClick={() => retry(row)}>ลองอีกครั้ง</Button>
)}
```
Place it in the Standard column next to the name, or in a new column — adjust styling to match.

- [ ] **Step 5: Manual smoke**

- Add an override → click Pencil on its row → dialog opens with values pre-filled → matchType disabled → change priority → save → row updates.
- Add an override with matchType=substring, matchValue="ani", priority=10. Save. Add another with matchType=substring, matchValue="il", priority=10 → confirm dialog appears warning of overlap (since "il" and "ani" overlap nowhere — pick a real overlap like "ani" and "anil" instead). Cancel → not saved. Retry with confirm → saved.
- Substances tab: stop the backend server. Edit a slot → toast error appears, chip remains visible, "ลองอีกครั้ง" button appears. Restart server, click retry → success, button disappears.

- [ ] **Step 6: Type-check + commit**

Run: `npx tsc --noEmit`

```bash
git add src/pages/standardConfig/OverridesTab.tsx src/pages/standardConfig/SubstancesTab.tsx
git commit -m "feat(ui): override inline edit + conflict warning + substance keep-local on error"
```

---

## Task 16: Final verification + smoke

**Files:** none (verification only)

- [ ] **Step 1: Full type-check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 2: All tests**

Run: `npm run test`
Expected: all pass, including new `substances.test.ts` and `resolveStandardConfig.test.ts`.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: 0 errors. Address any new warnings in files you touched.

- [ ] **Step 4: Manual end-to-end**

With dev + server running:

1. Navigate to `/standard-config`. Page loads, both tabs visible.
2. Substances tab empty → click "Sync จาก Master" → toast "เพิ่ม N / อัพเดต M" → rows appear, sourced from master.
3. Open a row's GC, add slots [10, 12, 15], unit ml → auto-save (network PUT 200) → refresh page → values persist.
4. Click "เพิ่ม Standard" → name "MANUAL-TEST", GC enabled, slots [5] → save → row appears with `manual` badge + delete button.
5. Search "ani" → only matching rows shown; URL has `?q=ani`. Reload — search restored.
6. Filter `GC enabled` → only rows with GC enabled shown.
7. Switch to Overrides tab.
8. Click "เพิ่ม Override Rule" → Substring "ani", priority 10, GC enabled, slot 5 → save. Row appears.
9. Try adding same rule again → toast "duplicate rule" (409).
10. Delete manual standard from Substances tab → row removed.
11. Delete override rule → row removed.

- [ ] **Step 5: Final commit (if any tidying)**

If any small fixes emerged during smoke:
```bash
git add -p   # interactive add specific hunks
git commit -m "fix(standard-config): tidy <area>"
```
Otherwise, no commit needed.

---

## Notes for the executing engineer

- **No server-side test framework exists** — tests are vitest-only on the client. Server changes are verified via curl smoke tests and the manual e2e in Task 15.
- **Permissions** — there's no read/write split in this codebase. Anyone who can reach the page via `PrivateRoute` can edit. Don't add a custom gate; that would diverge from MasterItems / SimpleMethod precedent.
- **API base path** — `api.ts` already handles `/api` vs `/LIS/api` resolution. Just register the routes in `server/index.js` via `mountApi(...)` and the client picks them up.
- **Tabs styling** — `src/components/ui/tabs.tsx` is the shadcn primitive. Match existing usage in `MasterItems.tsx` if visual tweaks needed.
- **`api.get<T>(path)`** returns `{ data: { data: T } }` — the double `.data` wrap is real; copy the pattern used in `MasterItems.tsx:490`.
- **Stale rows after master deletion are intentional** per spec — don't add cleanup logic in Phase 1.
- **`µL`** unit uses the µ (U+00B5) character — copy/paste from the spec or this plan, don't retype.
