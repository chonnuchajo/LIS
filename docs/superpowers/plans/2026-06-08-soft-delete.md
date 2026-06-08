# Soft Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert every backend DB delete endpoint from hard delete to soft delete (rows are marked hidden, not removed), with reads auto-filtering hidden rows.

**Architecture:** A shared Mongoose plugin (`server/lib/softDelete.js`) adds `deletedAt`/`deletedBy` fields, query pre-hooks that auto-exclude soft-deleted rows, an instance `softDelete(by)` method, and a static `softDeleteMany(filter, by)`. The plugin is applied explicitly to 19 models. Delete routes are rewritten to call the soft-delete API instead of `deleteOne`/`findByIdAndDelete`/`deleteMany`. Unique indexes on soft-deletable models become compound `{ key, deletedAt }` so a value can be reused after its row is hidden.

**Tech Stack:** Node.js, Express 4, Mongoose 8, MongoDB. Tests use Node's built-in `node:test` + `node:assert` (the repo's server test convention — no DB harness; the plugin's pure logic is unit-tested, route/model edits are smoke-loaded).

**Spec:** `docs/superpowers/specs/2026-06-08-soft-delete-design.md`

**Conventions used throughout:**
- All commands run from `C:\Project\LIS\server` (the backend package root).
- The actor for `deletedBy` is resolved per route as: `req.query.actor || (req.body && req.body.actor) || 'system'`.
- "Smoke-load" means: `node -e "require('./<path>')"` exits 0 with no output (proves the file parses and its `require`s resolve).

---

### Task 1: Soft-delete plugin (TDD)

**Files:**
- Create: `server/lib/softDelete.js`
- Test: `server/lib/softDelete.test.js`

- [ ] **Step 1: Write the failing test**

Create `server/lib/softDelete.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const {
  liveFilter,
  softDeleteValues,
  applyLiveFilter,
  QUERY_HOOKS,
  softDeletePlugin,
} = require('./softDelete');

test('liveFilter selects rows that are not deleted', () => {
  assert.deepStrictEqual(liveFilter(), { deletedAt: null });
});

test('softDeleteValues sets deletedAt to the given time and deletedBy', () => {
  const now = new Date('2026-06-08T00:00:00.000Z');
  assert.deepStrictEqual(softDeleteValues('alice', now), {
    deletedAt: now,
    deletedBy: 'alice',
  });
});

test('softDeleteValues falls back to "system" when actor is missing', () => {
  const now = new Date('2026-06-08T00:00:00.000Z');
  assert.strictEqual(softDeleteValues(undefined, now).deletedBy, 'system');
  assert.strictEqual(softDeleteValues('', now).deletedBy, 'system');
});

test('applyLiveFilter adds the not-deleted filter to a normal query', () => {
  const calls = [];
  const fakeQuery = {
    getOptions: () => ({}),
    where(cond) { calls.push(cond); return this; },
  };
  let nextCalled = false;
  applyLiveFilter.call(fakeQuery, () => { nextCalled = true; });
  assert.deepStrictEqual(calls, [{ deletedAt: null }]);
  assert.strictEqual(nextCalled, true);
});

test('applyLiveFilter skips the filter when withDeleted option is set', () => {
  const calls = [];
  const fakeQuery = {
    getOptions: () => ({ withDeleted: true }),
    where(cond) { calls.push(cond); return this; },
  };
  let nextCalled = false;
  applyLiveFilter.call(fakeQuery, () => { nextCalled = true; });
  assert.deepStrictEqual(calls, []);
  assert.strictEqual(nextCalled, true);
});

test('QUERY_HOOKS covers the read/update query types we must filter', () => {
  for (const hook of ['find', 'findOne', 'findOneAndUpdate', 'count', 'countDocuments', 'updateOne', 'updateMany']) {
    assert.ok(QUERY_HOOKS.includes(hook), `missing hook: ${hook}`);
  }
});

test('softDeletePlugin registers fields, hooks, method and static on a schema', () => {
  const registered = { hooks: [], paths: null, methods: {}, statics: {} };
  const fakeSchema = {
    add(def) { registered.paths = def; },
    pre(name) { registered.hooks.push(name); },
    methods: {},
    statics: {},
  };
  softDeletePlugin(fakeSchema);
  assert.ok(registered.paths.deletedAt, 'deletedAt path added');
  assert.ok(registered.paths.deletedBy, 'deletedBy path added');
  for (const hook of QUERY_HOOKS) {
    assert.ok(registered.hooks.includes(hook), `hook not registered: ${hook}`);
  }
  assert.strictEqual(typeof fakeSchema.methods.softDelete, 'function');
  assert.strictEqual(typeof fakeSchema.statics.softDeleteMany, 'function');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test lib/softDelete.test.js`
Expected: FAIL — `Cannot find module './softDelete'`.

- [ ] **Step 3: Write the implementation**

Create `server/lib/softDelete.js`:

```js
// Soft-delete plugin: marks rows hidden instead of removing them, and auto-hides
// them from reads. Apply explicitly per model (NOT as a global mongoose.plugin),
// so embedded subdocument schemas don't get polluted with deletedAt fields.

const QUERY_HOOKS = [
  'find',
  'findOne',
  'findOneAndUpdate',
  'findOneAndReplace',
  'count',
  'countDocuments',
  'updateOne',
  'updateMany',
];

// Pure: filter that matches live (non-deleted) rows. `{ deletedAt: null }` also
// matches rows where the field is absent (legacy rows predating soft delete).
const liveFilter = () => ({ deletedAt: null });

// Pure: the field patch written when soft-deleting.
const softDeleteValues = (by, now) => ({
  deletedAt: now,
  deletedBy: by || 'system',
});

// Query pre-hook body. `this` is a Mongoose Query. Adds the not-deleted filter
// unless the query opted out with `.setOptions({ withDeleted: true })`.
function applyLiveFilter(next) {
  const opts = typeof this.getOptions === 'function' ? this.getOptions() : {};
  if (!opts.withDeleted) {
    this.where(liveFilter());
  }
  next();
}

function softDeletePlugin(schema) {
  schema.add({
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: String, default: '' },
  });

  for (const hook of QUERY_HOOKS) {
    schema.pre(hook, applyLiveFilter);
  }

  // Instance: soft-delete a loaded document.
  schema.methods.softDelete = function softDelete(by) {
    Object.assign(this, softDeleteValues(by, new Date()));
    return this.save();
  };

  // Static: soft-delete every live row matching `filter`. The updateMany pre-hook
  // scopes this to live rows, so it is idempotent.
  schema.statics.softDeleteMany = function softDeleteMany(filter, by) {
    return this.updateMany(filter, { $set: softDeleteValues(by, new Date()) });
  };
}

module.exports = {
  QUERY_HOOKS,
  liveFilter,
  softDeleteValues,
  applyLiveFilter,
  softDeletePlugin,
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test lib/softDelete.test.js`
Expected: PASS — all tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/lib/softDelete.js server/lib/softDelete.test.js
git commit -m "feat(soft-delete): shared mongoose soft-delete plugin"
```

---

### Task 2: Apply the plugin to all target models

**Files (Modify):**
- `server/models/Petition.js`
- `server/models/Sample.js`
- `server/models/PhysicalResult.js`
- `server/models/Approval.js`
- `server/models/RealtimeDensity.js`
- `server/models/LabRequest.js`
- `server/models/Machine.js`
- `server/models/Parameter.js`
- `server/models/Method.js`
- `server/models/StandardConfig.js`
- `server/models/MasterItemMeta.js`
- `server/models/CommonNameOverride.js`
- `server/models/SimpleMethodExclusion.js`
- `server/models/Stock.js`
- `server/models/User.js`
- `server/models/Role.js`
- `server/models/AccessGroup.js`

- [ ] **Step 1: Add the plugin import + apply to each model**

In **every** file above, add the require near the top (after the `mongoose` require):

```js
const { softDeletePlugin } = require('../lib/softDelete');
```

Then, immediately **before** the `mongoose.model(...)` call(s), apply the plugin to that file's schema(s). Examples:

For single-schema files (e.g. `Machine.js`), add before `module.exports = mongoose.model('Machine', MachineSchema);`:

```js
MachineSchema.plugin(softDeletePlugin);
```

Apply to the correspondingly-named schema in each file:
- `Petition.js` → `PetitionSchema.plugin(softDeletePlugin);` (NOT the embedded `PetitionItemSchema`/`ReviewEntrySchema`/etc. — only the top-level `PetitionSchema`)
- `Sample.js` → the schema passed to `mongoose.model('Sample', ...)`
- `PhysicalResult.js`, `Approval.js`, `RealtimeDensity.js`, `LabRequest.js`, `Parameter.js`, `Method.js`, `StandardConfig.js`, `MasterItemMeta.js`, `CommonNameOverride.js`, `SimpleMethodExclusion.js`, `User.js`, `Role.js`, `AccessGroup.js` → each file's top-level schema.

For `Stock.js` (three models in one file), apply to all three before `module.exports`:

```js
StockStandardSchema.plugin(softDeletePlugin);
StockSolventSchema.plugin(softDeletePlugin);
StockGlasswareSchema.plugin(softDeletePlugin);
```

> If a file's schema variable name differs from the examples, use the actual variable passed to `mongoose.model(...)` in that file. Apply the plugin only to top-level schemas, never to `{ _id: false }` embedded subdocument schemas.

- [ ] **Step 2: Smoke-load every modified model**

Run:
```bash
node -e "['Petition','Sample','PhysicalResult','Approval','RealtimeDensity','LabRequest','Machine','Parameter','Method','StandardConfig','MasterItemMeta','CommonNameOverride','SimpleMethodExclusion','Stock','User','Role','AccessGroup'].forEach(m => require('./models/'+m)); console.log('OK')"
```
Expected: prints `OK` with no errors (proves all schemas compile with the plugin and `deletedAt`/`deletedBy` paths are accepted).

- [ ] **Step 3: Commit**

```bash
git add server/models/
git commit -m "feat(soft-delete): apply soft-delete plugin to deletable models"
```

---

### Task 3: Convert unique indexes to compound `{ key, deletedAt }`

**Files (Modify):** the models below. For each, remove the inline `unique: true` from the field (keep any plain `index: true`) and add a compound unique index that appends `deletedAt`.

- [ ] **Step 1: Single-field unique → compound**

`server/models/Petition.js` — change line ~199:
```js
// before: petitionNo: { type: String, required: true, unique: true, index: true },
petitionNo: { type: String, required: true, index: true },
```
and add after the schema definition, before `module.exports`:
```js
PetitionSchema.index({ petitionNo: 1, deletedAt: 1 }, { unique: true });
```

`server/models/Sample.js` — `id` field: drop `unique: true`, then:
```js
SampleSchema.index({ id: 1, deletedAt: 1 }, { unique: true });
```
(use the file's actual schema variable name)

`server/models/Approval.js` — `sampleId`: drop `unique: true`, then:
```js
ApprovalSchema.index({ sampleId: 1, deletedAt: 1 }, { unique: true });
```

`server/models/PhysicalResult.js` — `sampleId`: drop `unique: true`, then:
```js
PhysicalResultSchema.index({ sampleId: 1, deletedAt: 1 }, { unique: true });
```

`server/models/RealtimeDensity.js` — `sampleId`: drop `unique: true`, then:
```js
RealtimeDensitySchema.index({ sampleId: 1, deletedAt: 1 }, { unique: true });
```

`server/models/LabRequest.js` — `labRequestNo`: drop `unique: true` (keep `index: true`), then:
```js
LabRequestSchema.index({ labRequestNo: 1, deletedAt: 1 }, { unique: true });
```

`server/models/Machine.js` — `code`: drop `unique: true` (keep `index: true`), then:
```js
MachineSchema.index({ code: 1, deletedAt: 1 }, { unique: true });
```

`server/models/Method.js` — `code`: drop `unique: true` (keep `uppercase: true, trim: true`), then:
```js
MethodSchema.index({ code: 1, deletedAt: 1 }, { unique: true });
```

`server/models/MasterItemMeta.js` — `itemNo`: drop `unique: true` (keep `index: true`), then:
```js
MasterItemMetaSchema.index({ itemNo: 1, deletedAt: 1 }, { unique: true });
```

`server/models/CommonNameOverride.js` — `rawKey`: drop `unique: true`, then:
```js
CommonNameOverrideSchema.index({ rawKey: 1, deletedAt: 1 }, { unique: true });
```

`server/models/User.js` — `email`: drop `unique: true` (keep `lowercase: true`), then:
```js
UserSchema.index({ email: 1, deletedAt: 1 }, { unique: true });
```

`server/models/Role.js` — `id`: drop `unique: true` (keep `lowercase: true`), then:
```js
RoleSchema.index({ id: 1, deletedAt: 1 }, { unique: true });
```

`server/models/AccessGroup.js` — `id`: drop `unique: true` (keep `lowercase: true`), then:
```js
AccessGroupSchema.index({ id: 1, deletedAt: 1 }, { unique: true });
```

`server/models/Stock.js` — each of the three schemas has `code: { ..., unique: true, index: true }`. Drop `unique: true` from each (keep `index: true`) and add:
```js
StockStandardSchema.index({ code: 1, deletedAt: 1 }, { unique: true });
StockSolventSchema.index({ code: 1, deletedAt: 1 }, { unique: true });
StockGlasswareSchema.index({ code: 1, deletedAt: 1 }, { unique: true });
```

> Use each file's real schema variable name where it differs from the example.

- [ ] **Step 2: Compound unique → append deletedAt**

`server/models/StandardConfig.js` — change the existing index (lines ~21-24):
```js
// before: StandardConfigSchema.index({ instrument: 1, scope: 1, commonNameLower: 1 }, { unique: true });
StandardConfigSchema.index(
  { instrument: 1, scope: 1, commonNameLower: 1, deletedAt: 1 },
  { unique: true },
);
```

`server/models/SimpleMethodExclusion.js` — change the existing index (line ~12):
```js
// before: SimpleMethodExclusionSchema.index({ pattern: 1, matchType: 1 }, { unique: true });
SimpleMethodExclusionSchema.index({ pattern: 1, matchType: 1, deletedAt: 1 }, { unique: true });
```

- [ ] **Step 3: Smoke-load**

Run:
```bash
node -e "['Petition','Sample','PhysicalResult','Approval','RealtimeDensity','LabRequest','Machine','Method','StandardConfig','MasterItemMeta','CommonNameOverride','SimpleMethodExclusion','Stock','User','Role','AccessGroup'].forEach(m => require('./models/'+m)); console.log('OK')"
```
Expected: prints `OK`.

- [ ] **Step 4: Re-run the plugin tests (no regressions)**

Run: `node --test lib/softDelete.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/models/
git commit -m "feat(soft-delete): compound unique indexes scoped by deletedAt"
```

> **Note on rollout:** `ensureCollections()` in `server/index.js` runs `syncIndexes()` on boot, which drops the old single-field unique indexes and builds the new compound ones automatically. No manual migration is needed. If a collection already contains duplicate live values (shouldn't, since they were unique before), `syncIndexes` would error on that collection's index build — surface it rather than forcing.

---

### Task 4: Petition delete route → soft delete (with cascade)

**Files (Modify):** `server/routes/petitions.js` (lines ~611-634)

- [ ] **Step 1: Replace the delete handler**

Replace:
```js
router.delete('/:id', async (req, res) => {
  try {
    const doc = await Petition.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: { message: 'ไม่พบคำร้อง' } });
    logAudit(doc, {
      event: 'deleted',
      fromStatus: doc.status,
      actor: req.query.actor || 'system',
      note: 'ลบคำร้อง',
    });
    const sampleIds = sampleIdsFromPetition(doc);
    if (sampleIds.length > 0) {
      await Promise.all([
        Sample.deleteMany({ id: { $in: sampleIds } }),
        PhysicalResult.deleteMany({ sampleId: { $in: sampleIds } }),
        Approval.deleteMany({ sampleId: { $in: sampleIds } }),
        RealtimeDensity.deleteMany({ sampleId: { $in: sampleIds } }),
      ]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});
```

with:
```js
router.delete('/:id', async (req, res) => {
  try {
    const actor = req.query.actor || (req.body && req.body.actor) || 'system';
    const doc = await Petition.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: { message: 'ไม่พบคำร้อง' } });
    logAudit(doc, {
      event: 'deleted',
      fromStatus: doc.status,
      actor,
      note: 'ลบคำร้อง',
    });
    await doc.softDelete(actor);
    const sampleIds = sampleIdsFromPetition(doc);
    if (sampleIds.length > 0) {
      await Promise.all([
        Sample.softDeleteMany({ id: { $in: sampleIds } }, actor),
        PhysicalResult.softDeleteMany({ sampleId: { $in: sampleIds } }, actor),
        Approval.softDeleteMany({ sampleId: { $in: sampleIds } }, actor),
        RealtimeDensity.softDeleteMany({ sampleId: { $in: sampleIds } }, actor),
      ]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});
```

- [ ] **Step 2: Smoke-load**

Run: `node -e "require('./routes/petitions')"`
Expected: exits 0, no output.

- [ ] **Step 3: Commit**

```bash
git add server/routes/petitions.js
git commit -m "feat(soft-delete): petition delete soft-deletes petition + cascade"
```

---

### Task 5: Simple single-document delete routes → soft delete

These routes have no extra side-effects beyond the delete. Each becomes "load → `softDelete(actor)`", or a `softDeleteMany` where there's no `_id` to load.

**Files (Modify):**
- `server/routes/samples.js` (~51)
- `server/routes/labRequests.js` (~102)
- `server/routes/machines.js` (~48)
- `server/routes/parameters.js` (~51)
- `server/routes/densities.js` (~29)
- `server/routes/commonNameOverrides.js` (~43)
- `server/routes/simpleMethodExclusions.js` (~39)
- `server/routes/masterItemMeta.js` (~71)

- [ ] **Step 1: samples.js**

Replace:
```js
router.delete('/:id', async (req, res) => {
  try {
    await Sample.findOneAndDelete({ id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```
with:
```js
router.delete('/:id', async (req, res) => {
  try {
    const actor = req.query.actor || (req.body && req.body.actor) || 'system';
    await Sample.softDeleteMany({ id: req.params.id }, actor);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 2: labRequests.js**

Replace:
```js
    const doc = await LabRequest.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: { message: 'ไม่พบใบคำขอรับบริการ' } });
    res.json({ success: true });
```
with:
```js
    const actor = req.query.actor || (req.body && req.body.actor) || 'system';
    const doc = await LabRequest.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: { message: 'ไม่พบใบคำขอรับบริการ' } });
    await doc.softDelete(actor);
    res.json({ success: true });
```

- [ ] **Step 3: machines.js**

Replace:
```js
    const item = await Machine.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
```
with:
```js
    const actor = req.query.actor || (req.body && req.body.actor) || 'system';
    const item = await Machine.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    await item.softDelete(actor);
    res.json({ success: true });
```

- [ ] **Step 4: parameters.js**

Replace:
```js
    const item = await Parameter.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
```
with:
```js
    const actor = req.query.actor || (req.body && req.body.actor) || 'system';
    const item = await Parameter.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    await item.softDelete(actor);
    res.json({ success: true });
```

- [ ] **Step 5: densities.js**

Replace:
```js
    await RealtimeDensity.findOneAndDelete({ sampleId: req.params.sampleId });
    res.json({ success: true });
```
with:
```js
    const actor = req.query.actor || (req.body && req.body.actor) || 'system';
    await RealtimeDensity.softDeleteMany({ sampleId: req.params.sampleId }, actor);
    res.json({ success: true });
```

- [ ] **Step 6: commonNameOverrides.js**

Replace:
```js
    await CommonNameOverride.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
```
with:
```js
    const actor = req.query.actor || (req.body && req.body.actor) || 'system';
    await CommonNameOverride.softDeleteMany({ _id: req.params.id }, actor);
    res.json({ ok: true });
```

- [ ] **Step 7: simpleMethodExclusions.js**

Replace:
```js
    await SimpleMethodExclusion.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
```
with:
```js
    const actor = req.query.actor || (req.body && req.body.actor) || 'system';
    await SimpleMethodExclusion.softDeleteMany({ _id: req.params.id }, actor);
    res.json({ ok: true });
```

- [ ] **Step 8: masterItemMeta.js**

Replace:
```js
    const itemNo = String(req.params.itemNo || '').trim();
    if (!itemNo) return res.status(400).json({ message: 'itemNo required' });
    await MasterItemMeta.deleteOne({ itemNo });
    res.json({ success: true });
```
with:
```js
    const itemNo = String(req.params.itemNo || '').trim();
    if (!itemNo) return res.status(400).json({ message: 'itemNo required' });
    const actor = req.query.actor || (req.body && req.body.actor) || 'system';
    await MasterItemMeta.softDeleteMany({ itemNo }, actor);
    res.json({ success: true });
```

- [ ] **Step 9: Smoke-load all eight**

Run:
```bash
node -e "['samples','labRequests','machines','parameters','densities','commonNameOverrides','simpleMethodExclusions','masterItemMeta'].forEach(r => require('./routes/'+r)); console.log('OK')"
```
Expected: prints `OK`.

- [ ] **Step 10: Commit**

```bash
git add server/routes/
git commit -m "feat(soft-delete): convert simple delete routes to soft delete"
```

---

### Task 6: Guarded delete routes (methods, standardConfigs)

These keep their pre-delete guard checks; only the final delete call changes. Both currently load the doc with `.lean()`, so use the `softDeleteMany` static keyed by `_id` rather than an instance method.

**Files (Modify):**
- `server/routes/methods.js` (~113)
- `server/routes/standardConfigs.js` (~154) and (~36)

- [ ] **Step 1: methods.js — replace the final delete**

Replace:
```js
    await Method.findByIdAndDelete(id);
    res.json({ ok: true });
```
with:
```js
    const actor = req.query.actor || (req.body && req.body.actor) || 'system';
    await Method.softDeleteMany({ _id: id }, actor);
    res.json({ ok: true });
```
(Leave the `builtIn` / referenced-by checks above unchanged.)

- [ ] **Step 2: standardConfigs.js — replace the per-id delete (~154)**

Replace:
```js
    await StandardConfig.findByIdAndDelete(id);
    res.json({ ok: true });
```
with:
```js
    const actor = req.query.actor || (req.body && req.body.actor) || 'system';
    await StandardConfig.softDeleteMany({ _id: id }, actor);
    res.json({ ok: true });
```
(Leave the `isDefault` check above unchanged.)

- [ ] **Step 3: standardConfigs.js — convert the maintenance prune (~36)**

This prunes configs whose instrument no longer exists in the Machine registry. Replace:
```js
  await StandardConfig.deleteMany({ instrument: { $nin: machineCodes } });
```
with:
```js
  await StandardConfig.softDeleteMany({ instrument: { $nin: machineCodes } }, 'system');
```
(Keep the surrounding code; `machineCodes` is already in scope.)

- [ ] **Step 4: Smoke-load**

Run: `node -e "require('./routes/methods'); require('./routes/standardConfigs'); console.log('OK')"`
Expected: prints `OK`.

- [ ] **Step 5: Commit**

```bash
git add server/routes/methods.js server/routes/standardConfigs.js
git commit -m "feat(soft-delete): soft-delete in guarded method/standard-config routes"
```

---

### Task 7: Stock delete routes → soft delete (keep transaction log)

Each stock delete logs a `StockTransaction` from the deleted item's fields, so we must load the item first, then soft-delete, then log.

**Files (Modify):** `server/routes/stock.js` (~124 standards, ~480 solvents, ~608 glassware)

- [ ] **Step 1: standards (~124)**

Replace:
```js
    const item = await StockStandard.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    await logTransaction({
```
with:
```js
    const actor = req.query.actor || (req.body && req.body.actor) || 'system';
    const item = await StockStandard.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    await item.softDelete(actor);
    await logTransaction({
```
(Leave the `logTransaction({...})` body and `res.json` unchanged.)

- [ ] **Step 2: solvents (~480)**

Apply the same transform: change `const item = await StockSolvent.findByIdAndDelete(req.params.id);` to load + soft-delete:
```js
    const actor = req.query.actor || (req.body && req.body.actor) || 'system';
    const item = await StockSolvent.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    await item.softDelete(actor);
```
immediately before that route's `logTransaction({...})` call. (Match the exact `if (!item)` line already present in that handler; do not duplicate it.)

- [ ] **Step 3: glassware (~608)**

Apply the same transform for `StockGlassware`:
```js
    const actor = req.query.actor || (req.body && req.body.actor) || 'system';
    const item = await StockGlassware.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    await item.softDelete(actor);
```
immediately before that route's `logTransaction({...})` call.

- [ ] **Step 4: Smoke-load**

Run: `node -e "require('./routes/stock'); console.log('OK')"`
Expected: prints `OK`.

- [ ] **Step 5: Commit**

```bash
git add server/routes/stock.js
git commit -m "feat(soft-delete): soft-delete stock items, keep transaction log"
```

---

### Task 8: Access-control delete routes → soft delete

These have guard checks (admin protection, locked roles/groups, in-use roles) that stay. Only the final `deleteOne()` becomes `softDelete(actor)`. The post-delete side-effects (pulling a group id out of role permissions) stay.

**Files (Modify):** `server/routes/accessControl.js` (~308 users, ~335 roles, ~430 groups)

- [ ] **Step 1: users (~315)**

Replace:
```js
    await user.deleteOne();
    res.json({ success: true });
```
(inside the `/users/:id` handler) with:
```js
    const actor = req.query.actor || (req.body && req.body.actor) || 'system';
    await user.softDelete(actor);
    res.json({ success: true });
```

- [ ] **Step 2: roles (~342)**

Replace:
```js
    await role.deleteOne();
    res.json({ success: true });
```
(inside the `/roles/:id` handler) with:
```js
    const actor = req.query.actor || (req.body && req.body.actor) || 'system';
    await role.softDelete(actor);
    res.json({ success: true });
```
(Leave the `locked` check and the `User.countDocuments(...)` in-use check above unchanged — `countDocuments` now auto-excludes soft-deleted users, which is the desired "live users only" count.)

- [ ] **Step 3: groups (~435)**

Replace:
```js
    await group.deleteOne();
    await Role.updateMany({}, { $pull: { permissions: req.params.id } });
    res.json({ success: true });
```
with:
```js
    const actor = req.query.actor || (req.body && req.body.actor) || 'system';
    await group.softDelete(actor);
    await Role.updateMany({}, { $pull: { permissions: req.params.id } });
    res.json({ success: true });
```

- [ ] **Step 4: Smoke-load**

Run: `node -e "require('./routes/accessControl'); console.log('OK')"`
Expected: prints `OK`.

- [ ] **Step 5: Commit**

```bash
git add server/routes/accessControl.js
git commit -m "feat(soft-delete): soft-delete users/roles/groups"
```

---

### Task 9: Final verification

- [ ] **Step 1: Run the full server test suite**

Run: `node --test lib/`
Expected: all tests pass (existing `accessGroups`, `stockSource`, `userProfile`, plus new `softDelete`).

- [ ] **Step 2: Confirm no stray hard-delete remains in routes**

Run:
```bash
grep -rnE "findByIdAndDelete|findOneAndDelete|\.deleteOne\(|\.deleteMany\(" routes/
```
Expected: the only matches are the intentionally-excluded ones — `uploads.js` (filesystem) and `masterItems.js` (ERP webhook forward). Every other route uses `softDelete`/`softDeleteMany`. If any other match appears, convert it.

- [ ] **Step 3: Boot the server against a dev DB and confirm index sync**

> Requires MongoDB running locally. If unavailable in this environment, note it and have the user run it.

Run: `npm run dev` (then stop after boot)
Expected: logs `✅ Connected to MongoDB` and `🚀 Server running` with no `syncIndexes` errors. A `syncIndexes` error here means a collection has duplicate live values under the new compound unique index — investigate that collection's data rather than reverting.

- [ ] **Step 4: Manual smoke (optional, with server + dev DB up)**

For one representative entity (e.g. a Machine):
1. `POST` a machine, then `DELETE` it via the API.
2. `GET` the list → the machine is **absent**.
3. In the DB (`mongosh`), `db.machines.findOne({ code: '<code>' })` → row **still present** with `deletedAt` set and `deletedBy` populated.
4. `POST` a new machine reusing the same `code` → **succeeds** (compound index allows reuse after soft delete).

- [ ] **Step 5: Refresh seed-data backup**

Per repo convention (off-cycle data/model change), run:
```bash
npm run seed:export
```
Then commit:
```bash
git add server/seed-data/
git commit -m "chore(soft-delete): refresh seed-data after schema change"
```

---

## Self-review notes

- **Spec coverage:** plugin (§1 → Task 1), models w/ plugin (§2 → Task 2), delete routes incl. cascade (§3 → Tasks 4-8), compound unique indexes (§4 → Task 3), seed-export unchanged-but-refreshed (§5 → Task 9 Step 5), out-of-scope excludes verified by Task 9 Step 2.
- **Excluded as designed:** `uploads.js`, `masterItems.js`, `StockUnit` discard — never touched; confirmed by the Task 9 grep.
- **Naming consistency:** plugin exports `softDeletePlugin`, `liveFilter`, `softDeleteValues`, `applyLiveFilter`, `QUERY_HOOKS`; instance method `softDelete(by)`; static `softDeleteMany(filter, by)` — used identically across all tasks.
