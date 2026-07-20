# Item-Scoped Substance Criteria Design

## Goal

Allow substance-based parameter criteria to differ when the same substance name appears on different master items, package sizes, or item codes. The parameter settings UI must also expose the related raw master item context, keep newly added value fields visible at the top, and protect unsaved dialog edits.

## Scope

This change applies to the Parameter Settings page, especially numeric value fields using the "substance" criteria mode. Existing substance rules that only contain a `substance` name remain valid and continue to act as general substance rules.

## Data Model

Extend `SubstanceStandard` with optional master item context:

```ts
type SubstanceStandard = {
  substance: string;
  operator: StandardOperator;
  value: number | null;
  value2?: number | null;
  itemNo?: string;
  packSize?: string;
  masterItemName?: string;
  masterCommonName?: string;
  masterRaw?: Record<string, unknown>;
};
```

The rule identity for picker and display dedupe becomes:

```txt
normalized(substance) + normalized(itemNo) + normalized(packSize)
```

Rules without `itemNo` and `packSize` use the existing general behavior.

## UI Behavior

In `SubstanceStandardsDialog`, choosing from master items creates one rule per item/package combination. Same substance names from different item codes or package sizes can be added independently and edited independently.

The selected criteria list shows enough context to distinguish rows:

- substance name
- item code
- package size
- master item/trade name
- common name

The "แยกตามสาร" criteria tab adds master item context columns, including item code and package size. Raw master item data is available from the row context in a compact details view or expandable/collapsible preview so users can inspect the source data without leaving the page.

In `ParameterDialog`, the "เพิ่มช่อง" action inserts the new value field at the top of the value field list. Existing move up/down controls still allow users to reorder the field afterward.

## Unsaved Changes

`ParameterDialog` tracks a baseline snapshot when opened. Any change to the form or AI-generated draft makes the dialog dirty.

When the user tries to close a dirty dialog through cancel, outside close, or the dialog close action, show a confirmation dialog with:

- `บันทึก`: run the same validation and submit path as the primary save button
- `ไม่บันทึก`: close and discard local edits
- `กลับไปแก้ไข`: keep the dialog open

If validation fails from `บันทึก`, keep the parameter dialog open and show the validation error.

## Compatibility

Existing `substanceStandards` entries without master item fields stay valid. Search and sort must include the new master item context but keep current behavior for legacy rows.

## Tests

Add or update tests for:

- building substance criteria rows with same substance but different `itemNo`/`packSize`
- displaying and searching item code/package context in the criteria tab
- adding duplicate substance names from different master items in `SubstanceStandardsDialog`
- preventing duplicate rows only when `substance + itemNo + packSize` all match
- inserting new value fields at the top of the Parameter dialog
- dirty close confirmation with save, discard, and cancel paths

Verification must avoid build commands. Use focused Vitest tests and static TypeScript checking with `npx tsc --noEmit` if needed.
