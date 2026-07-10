# Stock Row Detail Clicks Design

## Goal

On `/LIS/stock`, users can open item details from either a single click or a double click on rows in Standards, Solvents, and Glassware.

## Scope

- Standards keep the existing `StandardDetailDrawer`.
- Solvents and Glassware get simple right-side detail sheets that mirror the table data and expose the existing receive and edit actions.
- Row-level click and double-click both open the relevant detail sheet.
- Action buttons inside rows continue to run their own action only and must not open the detail sheet.

## Behavior

- Standards: clicking or double-clicking a standard row opens `StandardDetailDrawer`.
- Solvents: clicking or double-clicking a solvent row opens a solvent detail sheet with name, size, quantity, price, and note. The sheet includes receive and edit buttons.
- Glassware: clicking or double-clicking a glassware row opens a glassware detail sheet with name, quantity, price per piece, and note. The sheet includes receive and edit buttons.
- If an item is changed while its detail sheet is open, the sheet derives the current item from query data by id so it does not keep stale row snapshots.
- Delete, receive, and edit buttons inside table rows stop event propagation.

## Testing

- Extend `src/pages/__tests__/Stock.delete.test.tsx` with row interaction tests:
  - standard double click opens the existing drawer
  - solvent single click opens solvent detail
  - solvent double click opens solvent detail
  - glassware single click opens glassware detail
  - glassware double click opens glassware detail
  - row action buttons do not open the row detail sheet

## Constraints

- Do not run any build command.
- Prefer focused Vitest tests and TypeScript checks.
- Keep changes scoped to `src/pages/Stock.tsx` and its existing stock page test.
