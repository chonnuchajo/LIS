# Task 5 Report: COA Detail Page, Approval Actions, Audit Timeline, And Print Event Hook

## Scope

Implemented the Task 5 COA detail workflow only. No application route or navigation registration was added; Task 6 retains that ownership.

## Delivered

- `src/components/lis/PrintPreviewDialog.tsx`: accepts optional `onPrinted` metadata and invokes it only after `printDocument()` succeeds.
- `src/components/coa/CoaAuditTimeline.tsx`: shows lifecycle events with actor, timestamp, note, and an empty-history state.
- `src/components/coa/CoaReportTemplate.tsx`: renders the A4 COA print document from `CoaReportPage` data produced from the frozen document snapshots.
- `src/pages/CoaDetailPage.tsx`: loads a COA document, exposes lifecycle actions, requires a reason for rejection/cancellation, gates printing with `canPrintCoa`, records successful print events, and displays snapshot samples/results plus the audit history.
- `src/pages/__tests__/CoaDetailPage.test.tsx`: verifies a pending-approval COA renders its petition number and has its print action disabled.

## TDD Evidence

1. Added the detail page test before any production implementation.
2. Ran `npx.cmd vitest run src/pages/__tests__/CoaDetailPage.test.tsx`.
3. Observed the expected red failure: `Failed to resolve import "../CoaDetailPage"` because the page did not exist.
4. Added the Task 5 components, detail page, and print callback.
5. Reran the focused test successfully.

## Verification

- Focused Vitest: 2 test files passed, 2 tests passed (`CoaDetailPage` and `coaReport`).
- ESLint: passed for all five changed source/test files.
- `git diff --check`: passed.
- No build command was run.

## Concern

`npx.cmd tsc -p tsconfig.app.json --noEmit` remains blocked by unrelated pre-existing errors in `PetitionDashboardTable`, `PetitionPrintTemplate`, parameter/receive tests, `LabTestingDetailPage`, `RoleDashboard`, and `StandardTimePage`. The command reported no errors in Task 5 files.

## Notes

- Direct `npx` is blocked by the local PowerShell execution policy, so the equivalent `npx.cmd` shim was used.
- Focused React tests emit existing React Router v7 future-flag warnings while passing.
