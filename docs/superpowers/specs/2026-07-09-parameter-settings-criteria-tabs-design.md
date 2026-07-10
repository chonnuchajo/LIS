# Parameter Settings criteria tabs

**Date:** 2026-07-09
**Scope:** `/LIS/parameter-settings`

## Problem

Numeric parameter fields already support three advanced criteria modes:

- `substanceMode`: แยกตามสาร
- `conditionalMode`: เงื่อนไขพิเศษ
- `labelToleranceMode`: ตาม %สาร

Today these criteria are edited from inside each value field card and then inside a mode-specific dialog. That works for single-field setup, but it is hard to review or revise the saved criteria as a table across many parameters.

## Goal

Add page-level tabs in `/LIS/parameter-settings` so users can inspect and edit the three advanced criteria modes as tables:

- แยกตามสาร
- เงื่อนไขพิเศษ
- ตาม %สาร

The new tabs must reuse the existing parameter data model and existing mode dialogs. The feature is a management view, not a new criteria engine.

## Non-goals

- Do not change how abnormal detection is calculated.
- Do not change the parameter schema.
- Do not add new routes or access-control paths.
- Do not replace the existing field-level editor.
- Do not make all cells inline editable in this pass.

## UI Design

Keep the existing QC/Lab scope tabs. Add a second tab group below them for the management view:

- รายการพารามิเตอร์
- แยกตามสาร
- เงื่อนไขพิเศษ
- ตาม %สาร

`รายการพารามิเตอร์` shows the current parameter list unchanged.

The three new tabs filter the already-loaded `parameters` list by the selected scope and the active mode flag on each numeric/float value field.

## Table Design

### แยกตามสาร

Show one row per `substanceStandards[]` entry.

Columns:

- Parameter
- Field
- สาร
- เงื่อนไข
- ค่า
- ค่า 2
- หัวหน้า QC พิจารณาเท่านั้น
- จัดการ

The edit action opens `SubstanceStandardsDialog` for that field.

### เงื่อนไขพิเศษ

Show one row per `conditionalStandards[]` entry.

Columns:

- Parameter
- Field
- ลำดับ
- ชื่อกฎ
- เงื่อนไข
- ผลลัพธ์/เกณฑ์
- จัดการ

The edit action opens `ConditionalStandardsDialog` for that field. It must pass the same sibling-field and all-parameter context as the existing field editor.

### ตาม %สาร

Show one row per `labelToleranceStandards[]` entry.

Columns:

- Parameter
- Field
- สาร/ตัวเลือก
- % ยา
- เกณฑ์คลาดเคลื่อน%
- ค่าต่ำสุด
- 25% ล่าง
- 25% บน
- ค่าสูงสุด
- จัดการ

Column mapping:

- `% ยา`: `labelPercent`
- `เกณฑ์คลาดเคลื่อน%`: percentage tolerance value when the rule uses percent mode. Prefer the auto/pass tolerance that defines the inner pass band.
- `ค่าต่ำสุด`: `failLow`
- `25% ล่าง`: `passLow`
- `25% บน`: `passHigh`
- `ค่าสูงสุด`: `failHigh`

For non-range rules, show a concise preview from existing label-tolerance helpers instead of inventing derived range values unless the helper already resolves them safely.

The edit action opens `LabelToleranceDialog` for that field.

## Data Flow

No API changes are required.

`ParameterSettings.tsx` already loads the parameter list and saves whole parameter records through the existing dialog flow. The new tabs should derive flat table rows from the current `parameters` state:

- Find each parameter in the selected scope.
- Iterate `valueFields`.
- Include only numeric/float fields with the matching mode enabled.
- Flatten each mode array into display rows.

When a row is edited, open the existing mode dialog for the owning field. On save, update that field in the owning parameter, submit through the same save path used by the main parameter editor, then invalidate `["parameters"]`.

## Error Handling

- Empty tabs show a standard empty state, not a blank table.
- If a parameter field has mode enabled but no rows, show one setup row with an edit action so users can add criteria.
- If a referenced parameter or field cannot be found while opening an editor, show a toast error and do not mutate local state.

## Testing

Use TDD for implementation.

Target tests:

1. A pure row-builder test for each table mode:
   - `substanceMode` creates one row per substance standard.
   - `conditionalMode` creates one row per rule.
   - `labelToleranceMode` maps `% ยา`, tolerance, and range columns from `LabelToleranceRule`.
2. A focused React test if the page has an existing practical harness:
   - Switching to each tab renders rows from supplied parameter data.
   - Empty tab renders an empty state.
3. Type-check with `npx tsc --noEmit`.

Manual verification:

- Open `/LIS/parameter-settings`.
- Confirm the current parameter list still works.
- Confirm the three new tabs display table rows for existing configured fields.
- Open edit from each new tab and save without losing existing criteria.

## Risks

- `ParameterSettings.tsx` is already large. Keep the row-building logic in small helpers to avoid making the page harder to maintain.
- `LabelToleranceDialog` has role-sensitive fields. Reusing the existing dialog preserves current permission behavior.
- Existing built assets in the repo may be dirty from prior builds. Implementation should touch source and tests only unless a production build is explicitly requested.
