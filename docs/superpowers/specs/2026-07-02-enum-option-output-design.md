# Enum Option Output (ปกติ / ไม่ปกติ / ข้อความ) — Design

**Date:** 2026-07-02
**Status:** Approved design, pending implementation plan
**Scope:** Parameter enum fields — per-option result classification

## Problem

Enum parameter fields currently classify each option as **ปกติ / ไม่ปกติ** using a single
per-option "ปกติ" checkbox backed by `expectedValues`:

- Options in `expectedValues` → normal.
- When `expectedValues` is non-empty, every option **not** in it is implicitly abnormal.
- When `expectedValues` is empty, the whole field is neutral (nothing flagged).

This is a hard binary with no per-option neutral state. There is no way to have an option that
is neither pass nor fail — one that just records/shows an informational note without being counted
as abnormal.

## Goal

Let each enum option pick one of **three outputs**:

| Output | Meaning | Counts as abnormal? | Highlight |
| --- | --- | --- | --- |
| **ปกติ** (`normal`, "true") | pass — same as old ปกติ | No | normal/green |
| **ไม่ปกติ** (`abnormal`, "false") | fail | **Yes** | red |
| **ข้อความ** (`text`, custom) | shows a fixed custom string set at config time; informational only | No | plain (info) |

The custom text is **entered by the configurer at setup time** (fixed per option), not typed by the
inspector at test time. When the inspector selects a `text` option, the configured string is displayed
as read-only info ("แสดงเฉยๆ"). This is distinct from the existing `requireNoteOn`
("ต้องการคำอธิบาย"), which asks the *inspector* to type a note — that feature stays unchanged and
orthogonal.

## Non-goals

- No change to numeric / other field types.
- No change to `requireNoteOn` ("ต้องการคำอธิบาย") behavior.
- No forced database migration (see Backward compatibility).

## Data model

Add an optional per-option map `optionOutputs` to `ValueFieldSchema`, mirroring the existing
`optionFilters` pattern (`Map` of a sub-schema, `default: undefined`).

```
optionOutputs: Map<optionLabel, {
  kind: 'normal' | 'abnormal' | 'text',
  text: string   // used only when kind === 'text'
}>
```

Example stored value:

```json
"optionOutputs": {
  "ใส":              { "kind": "normal" },
  "ขุ่น":            { "kind": "abnormal" },
  "มีตะกอนเล็กน้อย":  { "kind": "text", "text": "อยู่ในเกณฑ์ยอมรับได้ เฝ้าระวัง" }
}
```

**Source of truth:** `optionOutputs`. `expectedValues` is only consulted for **legacy** fields that
have no `optionOutputs` (see Backward compatibility). New/edited fields do not depend on
`expectedValues` for abnormal detection.

### Discriminator

`optionOutputs` present (a defined map) → **new model**.
`optionOutputs` absent (`undefined`) → **legacy model** (existing `expectedValues` logic).

This presence/absence check is reliable because `default: undefined` means the field never
materializes on legacy documents — same guarantee `optionFilters` relies on today.

## Abnormal detection

`isEnumAbnormal(field, value)` — duplicated in **two** places that must stay in sync:

- `src/lib/parameterValidation.ts` (frontend, TS)
- `server/routes/qcResults.js` (backend copy, powers `GET /qc-results/abnormal-flags`)

New logic (both copies):

```
str = String(value)          // "" / null / undefined → not abnormal (unchanged)
if field.optionOutputs:
    entry = optionOutputs[str]        // Map.get on backend, object index on frontend
    return entry?.kind === 'abnormal'
else:                                  // legacy
    expected = field.expectedValues
    return expected.length > 0 && !expected.includes(str)
```

Because everything abnormal-related flows through `isFieldAbnormal` → `isEnumAbnormal`
(abnormal count, red highlight on QC/Lab detail, `/abnormal-flags`, the หัวหน้า approval flow via
`getAbnormalFlags`), updating these two copies propagates the new behavior everywhere. `text` and
`normal` options both return `false`, so `text` options render neutrally and are excluded from counts.

## Backward compatibility & migration

**No data migration.** Legacy enum params (no `optionOutputs`) keep working via the `expectedValues`
branch above. When a legacy enum field is opened for editing in the new UI, seed `optionOutputs` from
`expectedValues` so it upgrades on first save:

- option in `expectedValues` → `{ kind: 'normal' }`
- option not in `expectedValues` → `{ kind: 'abnormal' }`

(Legacy had no neutral state, so nothing maps to `text`.) After a save, the field carries
`optionOutputs` and the new branch takes over. Seed-data JSON stays valid untouched; `seed:export`
runs on the normal auto-sync cycle.

## UI — ParameterSettings.tsx

Per-option row (enum type), replace the single "ปกติ" checkbox with a 3-way control; keep the
"ต้องการคำอธิบาย" checkbox as-is:

```
ตัวเลือก "ขุ่น"
  ( ) ปกติ   (•) ไม่ปกติ   ( ) ข้อความ        ☐ ต้องการคำอธิบาย

ตัวเลือก "มีตะกอนเล็กน้อย"
  ( ) ปกติ   ( ) ไม่ปกติ   (•) ข้อความ        ☐ ต้องการคำอธิบาย
      └ ข้อความที่แสดง: [ อยู่ในเกณฑ์ยอมรับได้ เฝ้าระวัง____ ]
```

- Selecting **ข้อความ** reveals an inline text input for the custom string. Hidden for
  normal/abnormal.
- Handlers: replace `toggleExpected` with `setOptionOutput(opt, kind)` and `setOptionText(opt, text)`,
  writing into `optionOutputs`. `toggleRequireNote` unchanged.
- `addOption`: new option defaults to `{ kind: 'text', text: <the option label> }` — shows its own
  label as neutral info until the configurer sets ปกติ/ไม่ปกติ, so nothing is silently flagged
  abnormal. (Chosen default; see Open decisions — resolved.)
- `removeOption` (currently also strips `requireNoteOn` / `expectedValues` / `optionFilters`): also
  delete the option key from `optionOutputs`; drop the map to `undefined` when it becomes empty.
- Type switch away from `enum` (the `onValueChange` reset that clears `requireNoteOn` /
  `expectedValues`): also clear `optionOutputs`.
- Legacy seeding: when a `setOptionOutput` / `setOptionText` handler fires on an enum field whose
  `optionOutputs` is still undefined, first build the full map from the current `options` +
  `expectedValues` (per the migration mapping above), then apply the edit — so the first interaction
  materializes `optionOutputs` for every existing option, not just the one touched.
- Field summary line (the `case "enum"` around L711–718) and the per-field helper text (L1570–1592):
  update to describe counts by output kind (e.g. `ปกติ n · ไม่ปกติ m · ข้อความ k`) instead of the
  `expectedValues`-only summary.

## Display — QC / Lab detail pages

`QCTestingDetailPage.tsx` and `LabTestingDetailPage.tsx` share the same enum render path:

- Red highlight / abnormal state already comes from `isFieldAbnormal(field, value)` → automatically
  correct once `isEnumAbnormal` is updated. No change needed for highlight logic.
- When the selected option is `kind === 'text'`, render the configured custom string as a read-only
  info line beside/below the value ("แสดงเฉยๆ"). Reuse the existing note-display slot styling.
- The abnormal message `ค่าผิดปกติ — คาดหวัง: ${expectedValues.join(', ')}` (QC L129 / Lab L171):
  when `optionOutputs` is present, derive the "expected/normal" set from options whose
  `kind === 'normal'` instead of reading `expectedValues`.

## Validation — Parameter.js

In the enum branch of the `pre('validate')` hook:

- Drop orphan `optionOutputs` keys not present in `options` (same as `optionFilters` orphan cleanup).
- For entries with `kind === 'text'`, require non-empty `text` (reject blank custom text to avoid an
  empty info line). `normal`/`abnormal` ignore `text`.
- Existing `expectedValues` / `requireNoteOn` validation stays for legacy fields.

## Tests

`src/lib/parameterValidation.test.ts` — add `isEnumAbnormal` cases:

- `optionOutputs` present: `abnormal` → true; `normal` → false; `text` → false; unknown/empty value
  → false.
- Legacy (no `optionOutputs`): existing `expectedValues` behavior unchanged.
- `isFieldAbnormal` / `countAbnormalInResults` with a `text` option present (not counted).

Mirror at least the core abnormal cases for the backend copy if a server test harness exists for
`qcResults.js`; otherwise cover via the shared logic + manual E2E.

## Change surface (summary)

1. `server/models/Parameter.js` — add `optionOutputs` sub-schema + validation.
2. `src/lib/api.ts` — add `optionOutputs?: Record<string, { kind: 'normal'|'abnormal'|'text'; text?: string }>` to `ParameterValueField`.
3. `src/lib/parameterValidation.ts` — update `isEnumAbnormal`.
4. `server/routes/qcResults.js` — update the duplicated `isEnumAbnormal`.
5. `src/pages/ParameterSettings.tsx` — 3-way control + custom text input; handlers; add/remove/type-switch; legacy seeding; summaries.
6. `src/pages/QCTestingDetailPage.tsx` + `src/pages/LabTestingDetailPage.tsx` — render `text` custom string; derive normal set for the abnormal message.
7. `src/lib/parameterValidation.test.ts` — new cases.

## Open decisions — resolved

- **Meaning of "ข้อความ":** custom text set by the configurer at setup, displayed read-only, neutral. ✔
- **Default for a newly added option:** `text` with `text = option label` (neutral, no accidental flag). ✔
- **Migration:** none; presence/absence discriminator + graceful upgrade on edit. ✔
