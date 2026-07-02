# Per-substance / Conditional Criteria Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the already-wired per-substance (`substanceMode`) and conditional (`conditionalMode`) criteria actually persist by defining them on the Mongoose schema, and lock the substance picker so names come only from master data.

**Architecture:** The frontend UI, frontend validation logic, and the backend abnormal-detection consumer (`server/routes/qcResults.js`) all already read these four fields. The single defect is that `server/models/Parameter.js` `ValueFieldSchema` never declares them, so Mongoose `strict: true` silently strips `substanceMode` / `substanceStandards` / `conditionalMode` / `conditionalStandards` on every save. Task 1 adds the schema (3 sub-schemas + 4 fields + one mutual-exclusion guard), which fixes both persistence and the dormant server-side abnormal detection at once. Task 2 removes the free-text substance entry from `SubstanceStandardsDialog`.

**Tech Stack:** Node + Mongoose 8 (backend), React 18 + TypeScript + Vite (frontend), `node:test` for backend tests, Vitest for frontend.

## Global Constraints

- Commit ONLY the files listed in each task, using explicit `git add -- <path>` pathspecs — `develop` sometimes has a concurrent committer, so never `git add -A`.
- Backend tests use `node:test` + `node:assert` (NOT jest, despite `server/package.json`'s `"test": "jest"`). Run with `node --test`.
- Frontend type-check command is `npx tsc -p tsconfig.app.json --noEmit` (the bare `npx tsc --noEmit` is a no-op here — root tsconfig has `files: []`). The repo has ~12 pre-existing latent type errors; a clean run means "no NEW errors in touched files".
- Do NOT run `npm run build` (its `postbuild` rewrites root files).
- No data migration and no `seed:export` — nothing was ever persisted for these fields, and this is a schema/code change, not a data change.
- Do NOT modify consumer logic (`server/routes/qcResults.js`, `src/lib/parameterValidation.ts`, `server/lib/petitionStatusLog.js`) — they are already correct.
- Operator enum reused across sub-schemas: `['lt', 'lte', 'eq', 'gte', 'gt', 'between', 'tolerance', null]` (the 7 `StandardOperator` values plus `null`). Condition op enum: `['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between']`.

---

### Task 1: Persist substance/conditional criteria on the Parameter schema

**Files:**
- Modify: `server/models/Parameter.js` (add 3 sub-schemas after `OptionOutputSchema` at line 7; add 4 fields inside `ValueFieldSchema` after the `optionOutputs` field at line 68; add one guard inside the `pre('validate')` per-field loop)
- Test: `server/models/Parameter.test.js` (append to existing file — it uses `node:test`)

**Interfaces:**
- Consumes: nothing (first task).
- Produces: A `Parameter` document now round-trips these `valueFields[].` properties:
  - `substanceMode: boolean`
  - `substanceStandards: Array<{ substance: string, operator: string|null, value: number|null, value2: number|null }>`
  - `conditionalMode: boolean`
  - `conditionalStandards: Array<{ label: string, conditions: Array<{ sourceParameterId: string|null, sourceFieldLabel: string, op: string, value: string|number, value2: number|null }>, operator: string|null, value: number|null, value2: number|null }>`
  - Validation: a field with both `substanceMode` and `conditionalMode` true throws; `multiple` + `substanceMode` throws (existing guard, now reachable).

- [ ] **Step 1: Write the failing tests**

Append to `server/models/Parameter.test.js`:

```js
test('persists substanceMode + substanceStandards (not stripped by strict mode)', () => {
  const doc = new Parameter({
    name: 'ทดสอบสาร',
    valueFields: [{
      label: 'AI content', type: 'number', unit: 'g/L',
      substanceMode: true,
      substanceStandards: [{ substance: 'ABAMECTIN', operator: 'gte', value: 1.8, value2: null }],
    }],
  });
  const f = doc.valueFields[0];
  assert.strictEqual(f.substanceMode, true);
  assert.strictEqual(f.substanceStandards.length, 1);
  assert.strictEqual(f.substanceStandards[0].substance, 'ABAMECTIN');
  assert.strictEqual(f.substanceStandards[0].operator, 'gte');
  assert.strictEqual(f.substanceStandards[0].value, 1.8);
});

test('persists conditionalMode + conditionalStandards incl nested conditions (string & numeric values)', () => {
  const doc = new Parameter({
    name: 'ทดสอบเงื่อนไข',
    valueFields: [{
      label: 'ความหนืด', type: 'number', unit: 'cP',
      conditionalMode: true,
      conditionalStandards: [{
        label: 'ก้อนใหญ่',
        conditions: [
          { sourceParameterId: null, sourceFieldLabel: 'ชนิดสินค้า', op: 'eq', value: 'powder' },
          { sourceParameterId: null, sourceFieldLabel: 'น้ำหนัก', op: 'gte', value: 5, value2: null },
        ],
        operator: 'between', value: 10, value2: 20,
      }],
    }],
  });
  const f = doc.valueFields[0];
  assert.strictEqual(f.conditionalMode, true);
  assert.strictEqual(f.conditionalStandards.length, 1);
  const rule = f.conditionalStandards[0];
  assert.strictEqual(rule.label, 'ก้อนใหญ่');
  assert.strictEqual(rule.operator, 'between');
  assert.strictEqual(rule.value, 10);
  assert.strictEqual(rule.value2, 20);
  assert.strictEqual(rule.conditions.length, 2);
  assert.strictEqual(rule.conditions[0].value, 'powder'); // string preserved (Mixed)
  assert.strictEqual(rule.conditions[1].value, 5);        // number preserved (Mixed)
});

test('rejects a field with both substanceMode and conditionalMode', async () => {
  const doc = new Parameter({
    name: 'ทดสอบขัดกัน',
    valueFields: [{ label: 'x', type: 'number', unit: 'g', substanceMode: true, conditionalMode: true }],
  });
  await assert.rejects(() => doc.validate());
});

test('rejects multiple + substanceMode', async () => {
  const doc = new Parameter({
    name: 'ทดสอบ multiple',
    valueFields: [{ label: 'x', type: 'number', unit: 'g', multiple: true, substanceMode: true }],
  });
  await assert.rejects(() => doc.validate(), /กรอกหลายค่า/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test server/models/Parameter.test.js`
Expected: The two "persists…" tests FAIL (fields are `undefined` — `substanceStandards.length` throws on undefined / mismatch); the two guard tests likely FAIL too (validation does not yet reject both-modes, and `substanceMode` is stripped before the `multiple` guard runs so it does not throw).

- [ ] **Step 3: Add the sub-schemas**

In `server/models/Parameter.js`, insert AFTER the `OptionOutputSchema` block (after line 7, before `const ValueFieldSchema`):

```js
const OP_ENUM = ['lt', 'lte', 'eq', 'gte', 'gt', 'between', 'tolerance', null];

const SubstanceStandardSchema = new mongoose.Schema({
  substance: { type: String, required: true, trim: true },
  operator: { type: String, enum: OP_ENUM, default: null },
  value: { type: Number, default: null },
  value2: { type: Number, default: null },
}, { _id: false });

const StandardConditionSchema = new mongoose.Schema({
  sourceParameterId: { type: String, default: null },
  sourceFieldLabel: { type: String, required: true },
  op: { type: String, enum: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between'], required: true },
  value: { type: mongoose.Schema.Types.Mixed },
  value2: { type: Number, default: null },
}, { _id: false });

const StandardRuleSchema = new mongoose.Schema({
  label: { type: String, default: '' },
  conditions: { type: [StandardConditionSchema], default: [] },
  operator: { type: String, enum: OP_ENUM, default: null },
  value: { type: Number, default: null },
  value2: { type: Number, default: null },
}, { _id: false });
```

- [ ] **Step 4: Add the four fields to `ValueFieldSchema`**

In `server/models/Parameter.js`, immediately AFTER the `optionOutputs` field line (currently line 68: `optionOutputs: { type: Map, of: OptionOutputSchema, default: undefined },`), add:

```js
  // Per-substance standards (number/float). substanceMode=true → single standardOperator/Value ignored.
  substanceMode: { type: Boolean, default: false },
  substanceStandards: { type: [SubstanceStandardSchema], default: [] },
  // Conditional standards (number/float). conditionalMode=true → single standard* and substance* ignored.
  conditionalMode: { type: Boolean, default: false },
  conditionalStandards: { type: [StandardRuleSchema], default: [] },
```

- [ ] **Step 5: Add the mutual-exclusion guard**

In `server/models/Parameter.js`, inside the `pre('validate')` per-field `for` loop, add this guard immediately BEFORE the `if (f.multiple) {` block (currently line 195):

```js
    if (f.substanceMode && f.conditionalMode) {
      return next(new Error(`ช่อง "${f.label}": ใช้โหมด "แยกตามสาร" และ "เงื่อนไขพิเศษ" พร้อมกันไม่ได้`));
    }
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node --test server/models/Parameter.test.js`
Expected: PASS — all four new tests plus the five pre-existing `optionOutputs` tests (9 total).

- [ ] **Step 7: Commit**

```bash
git add -- server/models/Parameter.js server/models/Parameter.test.js
git commit -m "fix(parameter): persist substance/conditional criteria on schema

ValueFieldSchema omitted substanceMode/substanceStandards/conditionalMode/
conditionalStandards, so Mongoose strict mode stripped them on save — losing
config and starving the server-side abnormal detection in qcResults.js. Add
3 sub-schemas + 4 fields + a substanceMode/conditionalMode mutual-exclusion
guard. node:test round-trip + guard tests.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Lock substance names — remove free-text entry from the dialog

**Files:**
- Modify: `src/components/lis/SubstanceStandardsDialog.tsx` (remove `manual` state at line 54; remove its reset at line 61; remove the manual-entry `<div>` block at lines 192-205)

**Interfaces:**
- Consumes: Task 1's persisted schema (so a saved config survives) — no code dependency, sequencing only.
- Produces: A dialog whose only substance sources are the three master-data-backed tabs (`commonName` / `ชื่อ` / `กลุ่ม`). `addSubstance` remains, called only by the tab pick buttons.

- [ ] **Step 1: Remove the `manual` state declaration**

In `src/components/lis/SubstanceStandardsDialog.tsx`, delete line 54:

```tsx
  const [manual, setManual] = useState("");
```

- [ ] **Step 2: Remove the `manual` reset in the open effect**

In the `useEffect(() => { if (open) { ... } }, [open])` block, delete the line:

```tsx
      setManual("");
```

(The block keeps `setList(field.substanceStandards ?? [])` and `setSearch("")`.)

- [ ] **Step 3: Remove the manual-entry block**

Delete the entire `<div className="mt-2 flex gap-2">…</div>` block (currently lines 192-205) that contains the `Input` with `placeholder="พิมพ์ชื่อสารเพิ่มเอง แล้ว Enter"` and its "เพิ่ม" `Button`:

```tsx
            <div className="mt-2 flex gap-2">
              <Input
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addSubstance(manual); setManual(""); }
                }}
                placeholder="พิมพ์ชื่อสารเพิ่มเอง แล้ว Enter"
                className="h-9"
              />
              <Button type="button" variant="outline" className="h-9" onClick={() => { addSubstance(manual); setManual(""); }}>
                เพิ่ม
              </Button>
            </div>
```

Leave the `</Tabs>` above it and the closing `</div>` of the left column intact. Keep the `Input` and `Button` imports — both are still used elsewhere (search box, footer).

- [ ] **Step 4: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: No new errors referencing `SubstanceStandardsDialog.tsx` (in particular, no "`manual` is not defined" / "declared but never used"). Pre-existing latent errors in other files are acceptable.

- [ ] **Step 5: Manual verification (dialog UI)**

Open Parameter Settings → a numeric field → set โหมดเกณฑ์ = "แยกตามสาร" → open "ตั้งเงื่อนไขรายสาร". Confirm:
- The "พิมพ์ชื่อสารเพิ่มเอง แล้ว Enter" input and its "เพิ่ม" button are gone.
- Substances can still be added via the `commonName` / `ชื่อ` / `กลุ่ม` tabs.
- Save the parameter, reload the page, reopen the field → the mode stays "แยกตามสาร" and the per-substance criteria are still present (this is the Task 1 persistence fix verified end-to-end).

(Optional automated test — add only if standing up the harness is cheap: a Vitest render test wrapping `SubstanceStandardsDialog` in a `QueryClientProvider` with `api.get` mocked for `/master-items` + `/item-groups`, asserting `queryByPlaceholderText(/พิมพ์ชื่อสารเพิ่มเอง/)` is `null`. Per the spec this is deprioritized in favor of the manual check above.)

- [ ] **Step 6: Commit**

```bash
git add -- src/components/lis/SubstanceStandardsDialog.tsx
git commit -m "feat(parameter): lock substance picker to master data

Remove the free-text 'พิมพ์ชื่อสารเพิ่มเอง' entry from SubstanceStandardsDialog;
substances can now only be picked from the commonName/ชื่อ/กลุ่ม tabs (master
items + item groups).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Notes for the implementer

- Verify Task 1 first and independently — its backend round-trip test is the precise reproduction of the reported "ไม่เก็บค่า" bug. Do not proceed to Task 2 until Task 1's tests pass.
- After both tasks, the full end-to-end win is: configure "แยกตามสาร"/"เงื่อนไขพิเศษ" → save → reload → config persists AND `qcResults.js` now flags per-substance / conditional abnormalities server-side (previously it silently fell through to single-value because the fields were stripped).
- Pushing to `origin/develop` and any broader manual E2E are left to the user, per repo norm.
