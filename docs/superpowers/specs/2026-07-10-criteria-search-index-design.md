# Criteria Search Index

**Date:** 2026-07-10
**Scope:** `/LIS/parameter-settings` advanced criteria tabs

## Problem

The advanced criteria tabs let users search criteria rows, but the current search is too narrow. It mostly matches fields copied directly into each visible criteria row, such as the substance name, numeric criteria values, rule labels, and displayed selector text.

Users expect the criteria search to find anything related to the substance or criteria owner, not only the visible substance name. For example, a row should still be found when the user searches by the owning parameter, value-field label, parameter note, or the parameter-level "apply to" metadata.

## Goal

Expand the criteria search index so one criteria row can be found by all relevant data on the owning parameter, value field, and rule.

The visible table layout should stay unchanged. This is a search behavior improvement only.

## Non-goals

- Do not change the parameter schema.
- Do not change how abnormal detection or standard resolution works.
- Do not add API endpoints.
- Do not add new table columns in this pass.
- Do not change the main parameter-list search unless required by shared helper extraction.

## Searchable Data

Every advanced criteria row should include a derived `searchText` value built from:

- Parameter identity: `parameterName`, scope, status, and note.
- Parameter-level applicability: `applyAll`, `itemNames`, `commonNames`, `productTypes`, `categories`, `subCategories`, and `itemGroups`.
- Value field identity: `fieldLabel`, field type, unit, and basic field options when applicable.
- Row-specific criteria data already searchable today:
  - substance criteria: substance, operator, value, value2, product types, regulatory types, categories, and head-only flag.
  - conditional criteria: rule label, condition text, result text, source field labels, condition operators, condition values, output text, and output kind.
  - label tolerance criteria: selector text, substance, label percent, product types, tolerance values, range values, and preview text.

The search should remain case-insensitive and should tolerate non-string values by converting them to strings.

## Design

Add `searchText` to `CriteriaRowOwner` or an equivalent shared row base in `src/lib/parameterCriteriaRows.ts`.

Build the base search text in the row-builder owner helper from the owning `ParameterItem` and `ParameterValueField`. Each row builder then appends mode-specific fields before returning the row.

`src/components/lis/ParameterCriteriaTabs.tsx` should keep the existing `SEARCHABLE_ROW_KEYS` behavior for explicit row fields, but also check `row.searchText`. This keeps the component simple and preserves existing searches while broadening matches.

Use small helpers for flattening search tokens so arrays, booleans, nulls, and nested option/filter objects do not require ad hoc string handling in the component.

## Error Handling

Missing or empty metadata should simply be skipped. Search indexing must never block rendering a row.

If `itemGroups` are stored as IDs, this pass searches the IDs. Display-name lookup can be added later only if the criteria tabs receive `groupNameById` or a similar lookup.

## Testing

Add focused tests covering search matches that are not visible in the current row table:

1. Criteria tab search finds a substance criteria row by parameter note.
2. Criteria tab search finds a substance criteria row by parameter-level `commonNames` or `itemNames`.
3. Criteria tab search finds a row by value-field label.
4. Existing direct searches, such as substance name and label percent, still work.

Also add or update pure row-builder tests to assert that `searchText` contains representative owner and rule tokens.

## Verification

Run the focused tests:

```bash
npx vitest run src/lib/parameterCriteriaRows.test.ts src/components/lis/ParameterCriteriaTabs.test.tsx src/pages/__tests__/ParameterSettings.criteria-tabs.test.tsx
```

Run type-check if focused tests pass:

```bash
npx tsc --noEmit
```

No production build is required for this change.
