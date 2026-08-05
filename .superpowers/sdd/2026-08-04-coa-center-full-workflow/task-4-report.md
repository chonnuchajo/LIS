# Task 4 Report: COA List Page And Create Dialog

## Scope

Implemented the Task 4 COA UI surface only. No application route or navigation registration was added; that remains Task 6 ownership.

## Delivered

- `src/components/coa/CoaStatusBadge.tsx`: maps every `CoaStatus` to the repository's supported badge variants and uses `coaStatusLabel` for the displayed label.
- `src/components/coa/CoaCreateDialog.tsx`: loads eligible petitions only while open, permits selection of one petition and its sample items, warns when an item already has an active COA, and creates a draft through `api.createCoaDocument`.
- `src/pages/CoaCenterPage.tsx`: lists COA documents, supports COA/petition-number search, shows status/sample/print data, and navigates to the document detail after row selection or successful creation.
- `src/pages/__tests__/CoaCenterPage.test.tsx`: covers the requested list rendering and create-action presence.

## TDD Evidence

1. Added the focused page test first.
2. Ran it before implementation with `node_modules/.bin/vitest.cmd run src/pages/__tests__/CoaCenterPage.test.tsx`.
3. Observed the expected red failure: `Failed to resolve import "../CoaCenterPage"` because the page did not exist.
4. Added the owned components/page and reran the same focused test successfully.

## Verification

- Focused Vitest: 1 test file passed, 1 test passed.
- TypeScript: `node_modules/.bin/tsc.cmd --noEmit` exited 0.
- No build command was run.

## Notes

- The direct `npx` invocation was blocked by the local PowerShell execution policy, so the equivalent local `.cmd` shim was used for Vitest and TypeScript.
- The focused test emits pre-existing React Router v7 future-flag warnings; it still passes.
