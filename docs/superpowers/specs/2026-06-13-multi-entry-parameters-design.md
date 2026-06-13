# Multi-entry parameters — design spec

**Date:** 2026-06-13
**Branch:** develop
**Status:** approved, ready for implementation plan

## Problem

Some parameters need to capture a value more than once and keep **all** of them.
Two distinct shapes are required:

1. **Field-level repeat** — a single `valueField` is filled multiple times (e.g. a pH
   reading taken 3 times). Other fields in the same parameter are filled once.
2. **Parameter-level repeat (multi-entry)** — the *whole* set of valueFields repeats
   as independent rows (e.g. several lots / replicate runs), each row holding the full
   field set.

Both modes must be supported and may be toggled independently per parameter/field.

## Decisions (from brainstorming)

- Storage shape: **structured arrays** (approach B), not composite string keys.
- Abnormal evaluation: **strictest** — if *any* entry / *any* repeated value is out of
  standard, the parameter is flagged abnormal.
- Entry identity: **auto-numbered** ("ค่าที่ 1, 2, 3…" / "รายการที่ 1, 2…"), **no limit**,
  no per-entry label.
- Lab and QC parameter results share **one collection** (`QCTestResult`, written via
  `saveQCResult`/`getQCResults`). `PhysicalResult` is a separate legacy model and is out
  of scope.

## Data model

### Parameter (`server/models/Parameter.js`)
- Add `multiEntry: { type: Boolean, default: false }` — parameter-level repeat.
- `ValueFieldSchema`: add `multiple: { type: Boolean, default: false }` — field-level repeat.

### QCTestResult (`server/models/QCTestResult.js`)
- Add `entries: { type: [mongoose.Schema.Types.Mixed], default: undefined }` — an array of
  value-objects, used **only** when the parameter is `multiEntry`.
- `values` stays as-is: used for non-multiEntry parameters and for back-compat with existing
  data. `valuesPhase2` unchanged.

### Stored shapes
- Field-level `multiple` → the field's value is an array:
  `{ "pH": [7.1, 7.3, 7.0] }`
- Parameter-level `multiEntry` → `entries` is an array of value-objects:
  `entries: [ { pH: 7.1, temp: 30 }, { pH: 7.3, temp: 31 } ]`
- Nesting is well-defined: a `multiEntry` parameter that contains a `multiple` field stores
  `entries[i][label]` as an array.

## Central accessors (normalize so readers loop once)

Add to `src/lib/parameterValidation.ts`, with a JS mirror in `server/routes/qcResults.js`
(the file already carries "keep in sync" comments):

- `getEntryValues(result, param): Record<string, unknown>[]`
  - non-multiEntry → `[result.values ?? {}]`
  - multiEntry → `result.entries ?? [{}]`
- `fieldValueList(values, field): unknown[]`
  - non-multiple → `[values[field.label]]`
  - multiple → `Array.isArray(values[field.label]) ? values[field.label] : []`

All abnormal / count / progress readers become:
`for each entry → for each field → for each value in fieldValueList → isFieldAbnormal`,
flagging abnormal if **any** value is out of standard (strictest).

Readers to update:
- `server/routes/qcResults.js`: `/abnormal-flags`, `/progress`.
- `src/lib/parameterValidation.ts`: `countAbnormalInResults`.
- Detail + approval pages consume the same accessors for rendering.

`substanceMode` and `conditionalMode` continue to work **inside** each entry's values object
(the existing `field.label::sub` keys live within a single entry).

## Save path

`PUT /qc-results` gains an optional `entryIndex`:

- **multiEntry + `entryIndex` present** → read-modify-write: load the doc, clone `entries`
  (or `[]`), pad with `{}` up to `entryIndex`, set `entries[entryIndex][fieldLabel] = value`,
  then `$set: { entries }`. This avoids the Mongo gotcha where `$set: "entries.0.x"` on a
  missing field creates an **object** keyed `"0"` instead of an array.
- **field-level `multiple`** → the client sends the entire array as `value`; the existing
  `$set: values.<label> = value` path is unchanged (value is `Mixed`).
- Audit logging stays field-level (same `qcResultAuditEvent` flow); for multiEntry the
  metadata carries `entryIndex`.

Entry add/remove is index-driven: adding an entry = the client writing to a new
`entryIndex`; removing = client sends the trimmed `entries` array (a small explicit save).

## UI

### ParameterSettings (`src/pages/ParameterSettings.tsx`)
- Parameter-level checkbox **"กรอกได้หลายรายการ"** next to the `hasPhases` toggle.
- Per-field checkbox **"ช่องนี้กรอกได้หลายค่า"** in the field editor.
- Disable/grey the checkboxes when guardrails forbid the combination (see below).

### Detail pages (QC + Lab — `QCTestingDetailPage.tsx`, `LabTestingDetailPage.tsx`)
Build on the existing `expandFieldForItem` render-unit abstraction:
- field `multiple` → render N inputs under "ค่าที่ 1, 2, 3…" with `[+ เพิ่มค่า]` / `[ลบ]`,
  auto-numbered, no cap.
- param `multiEntry` → render the whole field-set card repeated with
  `[+ เพิ่มรายการ]` / `[ลบรายการ]`, auto-numbered.

### Approval review (QC + Lab — `QCApprovalReviewPage.tsx`, `LabApprovalReviewPage.tsx`)
Render every entry / every repeated value read-only; out-of-standard values highlighted as
today.

## Guardrails (enforced in `Parameter` `pre('validate')`)
- `multiEntry` **cannot** combine with `hasPhases`.
- `field.multiple` is allowed only for type `text` / `number` / `float` / `enum`
  (not `timer` / `photo` / `file` / `reference`).
- `field.multiple` cannot combine with `substanceMode`, `reference`, or `triggersPhase2`.

## Progress / edge cases
- A field counts as "filled" if it has ≥1 non-empty value/entry.
- The required-fields denominator counts each required field **once**, not multiplied by
  entry count.
- Existing data is unaffected: empty `entries` ⇒ readers fall back to `values`.

## Testing (Vitest)
- `getEntryValues` / `fieldValueList` across non-multi, field-multiple, param-multiEntry,
  and nested cases.
- Abnormal "strictest" behaviour: one bad value among many ⇒ abnormal; all good ⇒ normal.
- Guardrail validation errors (multiEntry+hasPhases, multiple+unsupported type, etc.).
- Server↔client mirror parity for the abnormal logic.

## Out of scope
- `PhysicalResult` legacy model.
- Per-entry labels / min-max entry counts (auto-number, unlimited per decisions).
- Statistical aggregation (mean/SD) of repeated values — not requested.
