# Remove standard-weighing + Standard stock frequency dropdown — design

Date: 2026-07-04
Branch: develop

## Context

Yesterday's "ชั่ง Standard" feature (weigh standard → auto-deduct stock on Lab result
save) is being rolled back, and the Standard stock UI gets three tweaks. Four changes:

1. Remove the standard-weighing feature entirely.
2. Relabel the Standard "ความถี่" field → "ความถี่/1 ครั้ง".
3. Hide the "-" (split working) and delete (discard) buttons in `StandardUnitsPanel`
   everywhere.
4. Turn the free-text `frequency` field into a dropdown of presets + custom.

## Change 1 — Remove standard-weighing feature (full removal)

Rationale: user chose full removal, not dead code. Lab completion no longer deducts
standard stock.

Delete files:
- `src/components/lis/StandardWeighingSection.tsx`
- `src/lib/standardWeighing.ts`, `src/lib/standardWeighing.test.ts`
- `server/routes/standardWeighings.js`
- `server/lib/standardWeighingSettle.js`, `server/lib/standardWeighingSettle.test.js`
- `server/models/StandardWeighing.js`

Unwire:
- `server/index.js` — remove `mountApi('/standard-weighings', ...)`.
- `server/routes/petitions.js` — remove `settleLabStandards` import + the settle
  try/catch block in `POST /:id/complete`. Lab side just sets `labCompletedAt` now.
- `src/lib/api.ts` — remove `StandardWeighingDoc`, `SaveStandardWeighingInput`,
  `getStandardWeighings`, `saveStandardWeighing`, and the `requiredStandardKeys`
  parameter (both the arg and the body field) of `completePetitionTrack`.
- `src/pages/LabTestingDetailPage.tsx` — remove the `<StandardWeighingSection>` block,
  its import, `standardWeighReady` / `requiredStandardKeys` state, the save-gate, the
  extra `disabled` condition on the submit button, and the now-orphaned
  `standardConfigs` state + `api.getStandardConfigs()` query (only fed the section).

Left in place: historical docs under `docs/superpowers/`, and any stale
`seed-data/standardweighings*.json` dump (harmless; no model recreates the collection).

## Change 2 — Relabel frequency

`src/pages/Stock.tsx`: table header (`<TableHead>ความถี่`) and edit-dialog `<Label>`
→ `ความถี่/1 ครั้ง`.

## Change 3 — Hide split/discard buttons

`src/components/lis/stock/StandardUnitsPanel.tsx`: remove the `Minus` ("แบ่ง working")
and `Trash2` ("ทิ้ง") action buttons, plus the now-unused `withdrawQr` / `discardQr`
state, `WithdrawDialog` / `DiscardDialog` renders, `canWithdraw` / `canDiscard`, and the
`Minus` / `Trash2` icon imports. Keep edit + reprint. The dialog component files stay —
they're still reachable via the top-level Stock page QR-scan flow.

## Change 4 — Frequency dropdown

New `src/lib/standardFrequency.ts` (+ `standardFrequency.test.ts`):

- `FREQUENCY_UNITS = ["day","week","month"]`.
- `FREQUENCY_PRESETS = ["1/1 day","1/1 week","1/1 month","1/2 month","1/3 month","1/6 month"]`.
- `parseFrequency(str)` → `{ count:number, unit:"day"|"week"|"month" } | null`. Regex
  `^(\d+)\s*/\s*(\d+)\s*(day|week|month)s?$` case-insensitive; ignores the numerator
  (always "1 time"), returns `count` = denominator. `""`/unparseable → `null`.
- `formatFrequency(count, unit)` → `"1/{count} {unit}"` (lowercase canonical).
- `isPreset(str)` → whether the canonicalized string is one of the six presets.

UI in `StandardDialog` (Stock.tsx): replace the free-text `<Input>` with:
- A `<Select>` listing the 6 preset strings + a `custom` sentinel ("กำหนดเอง").
- When `custom`: show a numeric count `<Input>` (min 1) + a day/week/month `<Select>`;
  the form value = `formatFrequency(count, unit)`.
- On mount: `parseFrequency(item.frequency)`; if it canonicalizes to a preset → select
  it; else if it parses → custom prefilled with its count/unit; else (empty) → empty.

Existing data is all `1/N Unit` (`1/1 Day`, `1/1 Week`, `1/1 Month`, `1/2 Month`,
`1/3 Month`, `1/6 Month`, `1/4 Month`); all map onto a preset except `1/4 Month`,
which lands in custom. No DB migration.

Display choice: dropdown options show the full canonical string so
pick == stored == table cell.

## Testing

- Unit test `standardFrequency.ts` (parse/format/isPreset, real legacy values).
- `npx tsc -p tsconfig.app.json` clean for touched files; `npm run test`; `npm run lint`.
- Manual E2E on the user's box: edit a Standard, switch presets + custom, save,
  confirm table cell; confirm split/discard buttons gone; confirm lab-testing page has
  no ชั่ง Standard block and Lab save still works without deducting.
