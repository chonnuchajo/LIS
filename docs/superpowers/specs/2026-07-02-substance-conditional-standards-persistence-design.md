# Per-substance / conditional criteria — persistence fix + lock substance names

**Date:** 2026-07-02
**Branch:** develop
**Scope:** bugfix (make an existing, already-wired feature actually persist) + one UI restriction

## Problem

The Parameter config UI already offers three criteria modes for numeric (`number`/`float`) value-fields:

- **ค่าเดียว (single)** — plain `standardOperator` / `standardValue` / `standardValue2`
- **แยกตามสาร (per-substance)** — `substanceMode` + `substanceStandards[]`
- **เงื่อนไขพิเศษ (conditional)** — `conditionalMode` + `conditionalStandards[]` (if/then rules keyed off other fields' values)

The whole feature is wired end-to-end **except storage**:

- Frontend UI: `ParameterSettings.tsx:1296-1384` (mode selector), `SubstanceStandardsDialog.tsx`, `ConditionalStandardsDialog`, types in `api.ts:782-828`.
- Frontend logic: `parameterValidation.ts` (`expandFieldForItem`, `findSubstanceStandard`, `isSubstanceAbnormal`, `resolveStandard`, `resolveFieldStandard`, `countAbnormalInResults`).
- Backend consumer: `server/routes/qcResults.js:78-85, 215-231` reads all four fields to compute abnormal flags server-side.

But `server/models/Parameter.js` `ValueFieldSchema` **never defines** `substanceMode`, `substanceStandards`, `conditionalMode`, `conditionalStandards`. With Mongoose default `strict: true`, these are silently dropped on every `create` / `findByIdAndUpdate`.

**Verified** (no DB needed — strict casting happens on construction):

```
new Parameter({ valueFields:[{ label, type:'number', unit:'g/L',
  substanceMode:true, substanceStandards:[{substance:'ABAMECTIN',operator:'gte',value:1.8}] }]})
→ toObject().valueFields[0] === { ... NO substanceMode / substanceStandards / conditionalMode / conditionalStandards }
```

**Consequences:**
1. Saving a field in "แยกตามสาร" / "เงื่อนไขพิเศษ" mode reverts to "ค่าเดียว" on reload — config is lost ("ต้องมีการเก็บ").
2. Server-side abnormal detection in `qcResults.js` for these two modes **never fires** — `field.substanceMode` is always `undefined` after load, so it always falls through to the single-value path.
3. The `pre('validate')` guard at `Parameter.js:199` (`multiple` + `substanceMode`) is dead code — the field is stripped before validation runs.

Additionally, `SubstanceStandardsDialog.tsx:192-205` has a free-text "พิมพ์ชื่อสารเพิ่มเอง แล้ว Enter" box, which contradicts the requirement that substance names must only come from the controlled master-data list ("ต้องไม่เพิ่มชื่อสารเองได้").

## Goals

1. Persist `substanceMode` / `substanceStandards` / `conditionalMode` / `conditionalStandards` on `ValueFieldSchema` so config survives save/reload. This simultaneously activates the already-written server-side abnormal detection.
2. Remove the free-text substance entry from `SubstanceStandardsDialog` so substances can only be picked from master-data (commonName / ชื่อ / กลุ่ม tabs).

## Non-goals

- No data migration — nothing was ever persisted, so there is nothing to migrate. Users re-enter config.
- No changes to consumer logic (`qcResults.js`, `parameterValidation.ts`, `petitionStatusLog.js`) — already correct, just starved of data.
- No change to the "เงื่อนไขพิเศษ" (conditional) semantics — user confirmed the existing cross-field if/then rule engine is what they want.
- No `seed:export` step — this is a schema/code change, not a data change.

## Design

### 1. Backend schema (`server/models/Parameter.js`) — primary fix

Add three `_id:false` sub-schemas above `ValueFieldSchema`, mirroring the `api.ts` types and reusing the existing operator enum shape (`['lt','lte','eq','gte','gt','between','tolerance', null]`, default `null`):

```js
const OP_ENUM = ['lt', 'lte', 'eq', 'gte', 'gt', 'between', 'tolerance', null];

const SubstanceStandardSchema = new mongoose.Schema({
  substance: { type: String, required: true, trim: true },   // e.g. "ABAMECTIN" (extractSubstanceName form)
  operator:  { type: String, enum: OP_ENUM, default: null },
  value:     { type: Number, default: null },
  value2:    { type: Number, default: null },                // between / tolerance
}, { _id: false });

const StandardConditionSchema = new mongoose.Schema({
  sourceParameterId: { type: String, default: null },        // null = sibling field in same parameter
  sourceFieldLabel:  { type: String, required: true },
  op:    { type: String, enum: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between'], required: true },
  value: { type: mongoose.Schema.Types.Mixed },              // string | number
  value2:{ type: Number, default: null },                    // between
}, { _id: false });

const StandardRuleSchema = new mongoose.Schema({
  label:      { type: String, default: '' },
  conditions: { type: [StandardConditionSchema], default: [] }, // AND-ed; empty = default row (always matches)
  operator:   { type: String, enum: OP_ENUM, default: null },
  value:      { type: Number, default: null },
  value2:     { type: Number, default: null },
}, { _id: false });
```

Add to `ValueFieldSchema`:

```js
substanceMode:        { type: Boolean, default: false },
substanceStandards:   { type: [SubstanceStandardSchema], default: [] },
conditionalMode:      { type: Boolean, default: false },
conditionalStandards: { type: [StandardRuleSchema], default: [] },
```

**Rules / rationale:**
- `condition.value` is `Mixed` because the type is `string | number` (enum-source fields compare by string; numeric-source by number — `evalCondition` in `parameterValidation.ts` already handles both).
- **Do not clear the `*Standards` arrays when toggling modes.** `ParameterSettings.tsx:1305-1306` deliberately preserves the arrays when switching modes so the user doesn't lose entered criteria; the schema must respect that — only the `*Mode` booleans gate behavior.
- `operator`/rule `operator` enum includes `null` and defaults `null` to match the existing `standardOperator` field and tolerate any empty state; the UI always sends a concrete operator (default `gte`) for substances.

**Validation (`pre('validate')`):**
- Add a guard: a field with **both** `substanceMode` and `conditionalMode` true → error (mutually exclusive; the UI already models them as a single radio, this is backend defense-in-depth).
- The existing `multiple` + `substanceMode` guard (line ~199) becomes live automatically once the field is defined — no change needed, but it is now exercised by tests.
- No forced normalization of modes on non-numeric fields: the UI already resets `conditionalMode` to false for non-numeric types (`ParameterSettings.tsx:1263`), and all consumers gate on `isNumeric`, so a stray mode on a non-numeric field is inert. Keep the schema minimal.

### 2. Frontend (`src/components/lis/SubstanceStandardsDialog.tsx`) — lock substance names

- Remove the manual-entry block (`lines 192-205`): the `<Input placeholder="พิมพ์ชื่อสารเพิ่มเอง แล้ว Enter">` and its "เพิ่ม" button.
- Remove the `manual` state (`line 54`) and its reset inside the `open` effect (`line 61`).
- Keep the three source tabs (`commonName` / `ชื่อ` search / `กลุ่ม`), all backed by `master-items` + `item-groups`. Result: substances are selectable **only** from controlled master data.

### 3. Tests

**Backend — primary TDD guard, reproduces the exact bug.** Append to the **existing** `server/models/Parameter.test.js`, matching its convention: `node:test` + `node:assert`, `new Parameter({...})`, then inspect `doc.valueFields[0]` (and `await doc.validate()` for guards). Run with `node --test server/models/Parameter.test.js`. Note: strict-mode stripping happens at construction, so the round-trip assertions do **not** need `validate()` — inspecting the constructed doc is enough.

1. Field with `substanceMode:true` + `substanceStandards:[{substance,operator,value,value2}]` → `doc.valueFields[0].substanceMode === true` and `substanceStandards[0].value` preserved. **Fails today (fields stripped), passes after the fix.**
2. Field with `conditionalMode:true` + `conditionalStandards:[{ label, conditions:[{sourceFieldLabel,op,value,value2}], operator, value }]` → round-trips including nested `conditions`, with `condition.value` preserved for both a string case (e.g. `productType`) and a numeric case.
3. Guard: `substanceMode:true` **and** `conditionalMode:true` on the same field → `assert.rejects(() => doc.validate())`.
4. Guard (now live once field is defined): `multiple:true` + `substanceMode:true` → `assert.rejects(() => doc.validate())`.

**Frontend — light / optional.** The change is a pure deletion. A Vitest render test for `SubstanceStandardsDialog` requires a `QueryClientProvider` + mocked `api.get` for `master-items`/`item-groups`, which is heavier than the change warrants. Prefer a manual check that the "พิมพ์ชื่อสารเพิ่มเอง" input is gone (consistent with the repo's manual-E2E norm for dialog UI). Add the render test only if the harness proves cheap to stand up.

## Files touched

- `server/models/Parameter.js` — add 3 sub-schemas + 4 fields + one validation guard.
- `src/components/lis/SubstanceStandardsDialog.tsx` — remove manual-entry block + `manual` state.
- `server/models/Parameter.test.js` (existing) — append schema round-trip + guard tests (`node:test`).
- `src/components/lis/SubstanceStandardsDialog.test.tsx` (new, optional) — assert manual input gone.

## Risks / notes

- `PATCH /parameters/:id` runs with `runValidators: true`; the new sub-schema enums must match what the UI sends. Confirmed operators sent: the 7 `StandardOperator` values (substance dialog filters out the UI-only `none`). `null` is tolerated by the enum.
- Concurrent-committer hazard on `develop`: commit only these files with explicit pathspecs.
