# Density batch-sync into the "ค่า ถพ." parameter — Design

**Date:** 2026-06-13
**Branch:** develop
**Status:** Approved (brainstorm) → pending implementation plan

## Problem

When QC records specific gravity (ค่า ถพ.) for a sample, the values already exist in
the DMA 501 density instrument's exported readings (the `Result-Density` collection,
surfaced read-only on the **ผล Density** page). Today QC re-types them by hand. We want a
one-button **sync** that pulls the matching instrument readings into the QC form, keyed
by the sample's batch number, supporting the case where one batch produced several
readings (TOP / bottom / repeats → multiple rows).

The live single-value instrument proxy (`InstrumentSource` + `/instrument-readings/:key/latest`)
is **not** used here: it returns one scalar with no batch matching, and the DMA readings
arrive asynchronously as a batch export into `Result-Density`, not via an on-demand live
endpoint.

## Key placement fact (verified)

- **`ค่า ถพ.`** is `scope: qc`, `shareWithLab: true`. It is **entered on `QCTestingDetailPage`**
  (which loads `(p.scope ?? 'qc') === 'qc'`). On `LabTestingDetailPage` shared QC params are
  rendered **read-only** (`scope !== 'lab'` → skip writes / read-only render) — the lab only
  *selects which entry to print* later via `__formEntryIndex` (existing `formSpecificGravity.ts`).
- Therefore the sync button lives on **`QCTestingDetailPage`**. That page currently has **no**
  instrument-pull or provenance infrastructure (the existing `InstrumentFetchButton` +
  `parseProvenance`/`sourceLabelFor` live only on `LabTestingDetailPage`). This feature adds a
  self-contained density sync to the QC page; it does **not** touch the Lab page.

## Data sources (existing)

- **`Result-Density`** collection (model `ResultDensity`, `strict:false`, collection
  `"Result-Density"`, no soft-delete plugin — external export). Relevant columns per row:
  - `Sample name` — e.g. `26S-FPN5-GMP-009`, or `26S-ACT50-095 bottom` / `... TOP`
  - `Density [g/cm³]` — string numeric
  - `T (block) [°C]` — temperature actually achieved at measurement
  - `T (set) [°C]` — instrument setpoint/target temperature
  - `Date & time`, `Instrument name` (`DMA 501`), `Measurement status`, etc.
- **Parameter `ค่า ถพ.`** (`scope: qc`, `shareWithLab: true`). Two `valueFields`:
  - `ค่าถพ.` (float, `g/cm³`) — the SG result; `SG_FIELD_LABEL` in `src/lib/formSpecificGravity.ts`
    already points here.
  - `อุณหภูมิ` (float, `°C`) — measurement temperature; its `standardValue` ("ค่ามาตรฐาน") is
    configured by hand in ParameterSettings and is the condition the reading is compared against.
- **`QCTestResult`** supports multi-entry (`entries[]`) + a `values` map; `formSpecificGravity.ts`
  already reads `result.entries` and `FORM_ENTRY_INDEX_KEY` (`__formEntryIndex`).
- **QC save paths** (existing, `src/lib/api.ts`):
  - `api.saveQCEntries({ ..., entries })` — persists the whole `entries[]` array (used by the
    remove-entry path `handleRemoveEntry`). **This feature reuses it to replace the array.**
  - `api.saveQCResult({ ..., entryIndex, fieldLabel, value })` — single per-entry field write.

## Config prerequisite

`ค่า ถพ.` must have **`multiEntry: true`** so multiple instrument rows become multiple entries.
Set via the existing ParameterSettings UI, then `npm run seed:export` + commit. No migration code.

## What this feature deliberately does NOT do

- **No new `valueField`.** The parameter stays at two fields.
- **`T (set)` is never written** as a result value or to `standardValue`. It is display-only,
  kept in per-entry provenance and shown for comparison against the configured standard.
- **No change** to the ผล Density page, the `InstrumentSource` live-proxy framework, or the Lab page.
- **No auto-sync** without a button press.

## Decisions (from brainstorm)

1. **Trigger:** a manual sync button on the SG parameter in the QC form. If no matching rows
   exist yet, poll every 30 s until they appear, then fill and stop.
2. **Match key:** the **trailing batch number** of `Sample name` only, compared to the petition
   item's `batchNo`. (User accepted the cross-product collision risk; batch number alone.)
3. **Multiple rows per batch:** keep them all — one **entry** per row.
4. **Field mapping per entry:** `ค่าถพ.` ← `Density [g/cm³]`, `อุณหภูมิ` ← `T (block) [°C]`.
5. **`T (set)`:** display-only comparison against the `อุณหภูมิ` field's standard; persisted only
   inside per-entry provenance, never as a value/standard.

## Architecture

### 1. Backend — batch lookup endpoint

`GET /result-densities/by-batch/:batch` (mounted twice via `mountApi`).

- Match all `Result-Density` docs whose `Sample name` trailing batch equals `:batch`.
- Return `{ batch, docs: [...] }` (`lean()`), `docs` in measurement order (`_id` ascending);
  empty array when none yet.

**Matching authority is the server.** The client passes `batchNo` and trusts the returned docs;
it does not re-derive the match. Matching uses pure helpers in new `server/lib/densityBatch.js`:

- `extractDensityBatch(sampleName) -> string | null`
  - take the substring before the first whitespace (drops ` TOP` / ` bottom` / any suffix);
  - if it contains `-`, return the segment after the **last** `-`; else the whole token;
  - `26S-FPN5-GMP-009` → `009`; `26S-ACT50-095 bottom` → `095`.
- `batchMatches(petitionBatchNo, sampleName) -> boolean`
  - extract batch from `sampleName`; equal if trimmed strings match **or** both parse as integers
    and are numerically equal (`009` == `9`);
  - empty/nullish `petitionBatchNo` or unextractable batch → `false`.

**Query strategy:** correctness comes from applying `batchMatches` in JS to candidate docs. A Mongo
prefilter is optional and, if used, **must** be derived from the normalized integer so zero-padding
variants still match (e.g. regex `-0*<n>(?=\s|$)` for numeric batches), never the raw string — a
naive raw-string prefilter would wrongly drop `009` vs `9`. At the current collection size
(~230 docs) scanning all rows and filtering in JS is acceptable; add an index/tighter prefilter
later if it grows.

### 2. Frontend — API layer

`src/lib/api.ts`: add
`getResultDensitiesByBatch(batch: string) => Promise<{ batch: string; docs: Record<string, unknown>[] }>`
→ `GET /result-densities/by-batch/<encodeURIComponent(batch)>`.

### 3. Frontend — pure sync helpers (`src/lib/densitySync.ts`, Vitest-tested)

- `SG_VALUE_LABEL = 'ค่าถพ.'` (re-export of `SG_FIELD_LABEL`), `SG_TEMP_LABEL = 'อุณหภูมิ'`.
- `sourceSiblingKey(label) => \`${label}__source\`` — same `<label>__source` convention used by Lab.
- `densityRowToEntry(row) => Record<string, unknown>` — builds one entry:
  - `'ค่าถพ.'`: `Number(row['Density [g/cm³]'])` (or '' if unparseable),
  - `'อุณหภูมิ'`: `Number(row['T (block) [°C]'])`,
  - `'อุณหภูมิ__source'`: `{ source:'instrument', instrument: row['Instrument name'] || 'DMA 501',
    sampleName: row['Sample name'], tSet: Number(row['T (set) [°C]']), tBlock: Number(row['T (block) [°C]']) }`,
  - `'ค่าถพ.__source'`: `{ source:'instrument', instrument, sampleName }` (drives the "📡 จากเครื่อง" badge).
  - `fetchedAt` is added by the caller at apply time (timestamp not available in pure helpers).
- `hasHandTypedEntries(entries) => boolean` — true if any entry has a non-empty `ค่าถพ.`/`อุณหภูมิ`
  whose matching `__source` is absent or not `instrument` (drives the overwrite confirm).
- `formatTSetComparison(tSet, standardValue) => { text, status: 'match'|'differ'|'no-standard' }`
  — e.g. `เครื่องตั้งที่ (T set): 30 • มาตรฐาน: 30`.

Provenance `__source` siblings inside entries are ignored by entry validation/progress (those map
over `valueFields` by label) and by `resolveSpecificGravity` (reads a specific label) — same as how
the Lab page's `values.<label>__source` siblings are ignored.

### 4. Frontend — sync button + polling on QCTestingDetailPage

A self-contained control rendered on the `ค่า ถพ.` (multiEntry) param, per item:

- **Button "ดึงค่า ถพ."**, shown only when `!isLocked` (`isLocked = !!petition.qcCompletedAt`) and the
  item has a non-empty `batchNo`. Disabled with hint "ไม่มีเลข batch" when `batchNo` is empty.
- On click:
  - If `hasHandTypedEntries(entriesByKey[k])`, show a confirm ("จะเขียนทับค่าที่กรอกเอง?"). Confirm
    happens **once at click time**; once confirmed (or nothing hand-typed), applying fetched rows —
    including via a later poll — needs no further confirm.
  - Enable a React Query: `queryKey: ['density-by-batch', petitionId, itemSeq, batchNo]`,
    `queryFn: api.getResultDensitiesByBatch(batchNo)`,
    `refetchInterval: (q) => (q.state.data?.docs?.length ? false : 30_000)` (poll only while empty),
    `enabled` toggled on by the button, off on cancel/unmount.
  - While polling with zero docs: inline status "รอค่าจากเครื่อง…" + a cancel control (disables the query).
- On non-empty `docs` (initial or via poll):
  - `rows = docs.map(densityRowToEntry)` with `fetchedAt = new Date().toISOString()` stamped on each
    `__source`.
  - `setEntriesByKey(k → rows)`; `setEntryCount(k → rows.length)` so the visible cards match.
  - Persist the whole array via `api.saveQCEntries({ ..., entries: rows, enteredBy })`, then
    `loadResults(id)` — mirrors `handleRemoveEntry`.
  - Toast "ดึงค่า ถพ. จากเครื่องแล้ว (N รายการ)"; disable the query (stop polling).

### 5. Frontend — T(set) comparison display

In the QC page's per-entry render (`param.multiEntry` branch), under each entry's `อุณหภูมิ` field,
a read-only line from `formatTSetComparison(entry['อุณหภูมิ__source'].tSet, field.standardValue)`:
green when equal, amber when they differ, plain value when no standard configured. This is the only
surface for `T (set)`; never editable, never saved as a value.

## Error handling / edge cases

- `batchNo` empty → button disabled + hint.
- Endpoint error / timeout → toast "ดึงค่าจากเครื่องไม่ได้ — กรอกมือได้"; form keeps working; polling stops.
- `Sample name` without `-` that doesn't match → skipped by `batchMatches`.
- Locked QC (`qcCompletedAt`) → button hidden (read-only form).
- Leaving the page / pressing cancel → query disabled / unmounted → polling stops.
- Duplicate identical rows are kept as separate entries (the instrument exported them); the existing
  multiEntry 1k-entry cap applies.

## Testing

- **Vitest — `server/.../densityBatch`** rule via a TS/JS unit test (`node:test` co-located
  `server/lib/densityBatch.test.js`, run with `node --test`): `extractDensityBatch` (`009`, suffix
  `bottom`/`TOP`, no `-`, empty), `batchMatches` (`009`==`9`, mismatch, empty inputs).
- **Vitest — `src/lib/densitySync.test.ts`:** `densityRowToEntry` mapping + provenance, unparseable
  numerics, `hasHandTypedEntries` (instrument vs hand-typed vs empty), `formatTSetComparison`
  (match / differ / no-standard).
- **Backend integration:** `by-batch/:batch` returns only matching rows, measurement order, empty
  array when none.
- **Manual E2E:** open a QC sample with a known `batchNo`; press sync while `Result-Density` has no
  matching row → see polling; seed a matching row → entries fill (Density + T block), T(set)
  comparison line shows; multi-row batch yields multiple entries; locked petition hides the button;
  overwrite confirm fires when entries were hand-typed.

## Out of scope

- Changing the ผล Density page or the Lab page.
- Touching the `InstrumentSource` live-proxy framework.
- Auto-sync without a button press.
- Writing `T (set)` into any stored value or standard.
- Unifying the Lab page's local provenance helpers with `densitySync.ts` (possible later cleanup).
