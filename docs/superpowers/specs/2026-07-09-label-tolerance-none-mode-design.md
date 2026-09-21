# Label Tolerance None Mode Design

## Goal

Add a `ไม่มี` option to both dropdowns in the label tolerance rule dialog:

- `ช่วงผ่านอัตโนมัติ`
- `เกณฑ์กรม`

Selecting `ไม่มี` disables that band and hides its numeric inputs. The saved rule must round-trip through the frontend, API types, Mongoose schema, validation, and result calculation.

## Behavior

`autoMode = "none"` means there is no automatic pass band. If a head-review band exists, values inside that band become `เกณฑ์กรม`; values outside it become `ไม่ผ่าน`. If no head-review band exists either, the rule is incomplete and does not produce a verdict.

`headMode = "none"` means there is no head-review band. Values inside the automatic pass band become `ผ่าน`; values outside it become `ไม่ผ่าน`.

If both modes are `none`, validation rejects the rule because it has no usable threshold. This keeps configured label tolerance rules meaningful.

## Scope

Update the label tolerance mode type from `percent | abs | range` to include `none` in:

- `src/lib/api.ts`
- `src/components/lis/LabelToleranceDialog.tsx`
- `src/lib/parameterValidation.ts`
- `src/lib/standardOperators.ts`
- `server/models/Parameter.js`
- `server/lib/abnormal.js`

Add focused tests for:

- Backend schema accepts `autoMode: "none"` with a valid `headMode`.
- Backend schema accepts `headMode: "none"` with a valid `autoMode`.
- Backend validation rejects both modes set to `none`.
- Frontend result calculation returns `review` when only head band exists and value is inside it.
- Frontend result calculation returns `pass`/`fail` when only auto band exists.

## UI Details

Add `SelectItem value="none"` labeled `ไม่มี` to both dropdowns. When selected:

- Hide the numeric input area for that band.
- Clear the band-specific values for the mode being disabled where practical.
- Keep the other band editable and visible.

The existing permission rule remains: non-head users cannot edit head fields.

## Compatibility

Existing rules without `autoMode`/`headMode` continue through legacy normalization. Existing `percent`, `abs`, and `range` behavior remains unchanged.

The legacy top-level `mode: "range"` path is kept intact and does not need a separate `none` option because the requested dropdowns are the split-mode controls.

## Verification

Run focused tests after implementation:

- `npm run test -- src/lib/parameterValidation.test.ts`
- `npm run test -- server/models/Parameter.test.js`
- `npx tsc -p tsconfig.app.json --noEmit`
