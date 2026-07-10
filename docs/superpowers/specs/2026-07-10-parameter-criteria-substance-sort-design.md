# Parameter Criteria Substance Sort Design

## Goal

Update `/LIS/parameter-settings` so the `แยกตามสาร` criteria tab sorts by substance-focused values instead of parameter order or `%สาร`.

## Scope

- Change only the criteria tabs UI and related tests.
- Keep parameter storage, API payloads, row-builder output, and abnormal calculation behavior unchanged.
- Do not touch generated build assets in `assets/` or `app.html`.

## Behavior

In the `แยกตามสาร` tab, the sort menu will show only these options:

- `ชื่อสาร A-Z` as the default.
- `ชื่อสาร Z-A`.
- `ค่าต่ำสุด น้อยไปมาก`.
- `ค่าต่ำสุด มากไปน้อย`.
- `ค่าสูงสุด น้อยไปมาก`.
- `ค่าสูงสุด มากไปน้อย`.

The `แยกตามสาร` tab will not show `ตามลำดับ Parameter` or `%สาร` sorting options.

For substance rows:

- `ชื่อสาร` sorting uses `row.substance` with the existing Thai/English numeric collator.
- `ค่าต่ำสุด` sorting uses `row.value`.
- `ค่าสูงสุด` sorting uses `row.value2`.
- Rows with missing numeric values sort after rows with numeric values.
- Ties fall back to the existing parameter order, field index, rule index, and field label ordering.

The `ตาม %สาร` tab keeps the existing `%สาร` sort behavior. Other criteria tabs continue to use their existing practical sort options and are not part of this change.

## Architecture

`ParameterCriteriaTabs.tsx` currently owns the shared filter and sort menu for all criteria tabs. The implementation will make sort options tab-aware:

- Track the selected sort key as a wider union that includes substance-name and numeric range sort keys.
- Resolve an effective sort key per active tab so `แยกตามสาร` defaults to `ชื่อสาร A-Z`.
- Render different `<option>` sets depending on the active tab.
- Extend row comparison helpers to compare substance name, minimum value, and maximum value.

This keeps the change localized to the criteria tab component and avoids changing `parameterCriteriaRows.ts` unless a type addition is needed for sorting.

## Testing

Add focused tests in `ParameterCriteriaTabs.test.tsx` for:

- `แยกตามสาร` defaults to `ชื่อสาร A-Z`.
- `แยกตามสาร` includes `ชื่อสาร Z-A`.
- `แยกตามสาร` excludes `ตามลำดับ Parameter` and `%สาร` sort options.
- `ค่าต่ำสุด` and `ค่าสูงสุด` sort in both directions.
- Existing `ตาม %สาร` sort behavior remains available.
