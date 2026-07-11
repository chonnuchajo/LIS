# Master Item Edit Commonname Read-Only Design

## Goal

Show the item's existing commonname when editing a Master Item, without letting users change it from the edit dialog.

## Scope

- Add a read-only commonname field to the Master Item edit dialog.
- Read the value from the existing raw item keys already used by the detail drawer: `common_name`, `commonname`, `commonName`, `item_name2`, or `itemType`.
- Keep the existing editable `ประเภท` selector and save behavior unchanged.
- Do not add commonname to the form state or the metadata payload.
- Do not show the read-only commonname field when creating a new item, because no raw item record exists yet.

## UI Behavior

When a user opens `Master Items` and edits an existing item, the dialog shows:

- `Code`
- `ชื่อ Item`
- `commonname` as a disabled/read-only input
- the existing `ประเภท` selector
- the rest of the current fields

If the raw commonname is missing, the field shows `-`.

## Data Flow

`MasterItemDialog` computes the display value directly from `item` with `firstValue(item, commonNameKeys)`. The value is not stored in `MasterItemForm`, so it cannot be accidentally submitted or written back as metadata.

## Testing

Add a focused interaction test that opens the edit dialog for a fixture item and asserts that `commonname` displays the fixture's `common_name` value as a disabled/read-only field.

Run focused tests for `MasterItems.interactions.test.tsx` and TypeScript validation with `npx tsc --noEmit`.
