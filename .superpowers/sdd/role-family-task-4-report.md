# Task 4: Role Family Selector

## Status

Completed on branch `develop`.

## Changes

- Added `RoleFamily` and optional `Role.family` to the access-control types.
- Added role-area radio controls to create and edit dialogs, including Lab, QC, and Not Lab/QC values.
- Passed family values through role create and update callbacks and API requests.
- Added Lab and QC badges to role cards and family values to default roles.
- Added dialog tests covering Lab creation, QC editing, and blank-family creation.

## Validation

- RED: `npm.cmd run test -- src/components/lis/access/RoleEditDialog.test.tsx` failed as expected before implementation because the dialog lacked accessible field labels and family controls.
- GREEN: `npm.cmd run test -- src/components/lis/access/RoleEditDialog.test.tsx` passed: 1 file, 3 tests.
- Cleanup: after adding `aria-describedby={undefined}` to `DialogContent`, `npm.cmd run test -- src/components/lis/access/RoleEditDialog.test.tsx` passed again: 1 file, 3 tests, with no stderr warnings.
- `npx.cmd tsc --noEmit` passed.
- `git diff --check` passed.

## Notes

- Used `npm.cmd` because PowerShell execution policy blocks `npm.ps1`.
- Set `aria-describedby={undefined}` because this dialog does not need a separate description; this removes Radix's missing-description warning while preserving the accessible title.
- Commit was not created: the sandbox denied creation of `.git/index.lock` during `git add`, including the retry after the warning cleanup.

## Legacy Family Inference Fix

### Commands Run

- `npm.cmd run test -- src/components/lis/access/RoleEditDialog.test.tsx`
- `npm.cmd run test -- src/components/lis/access/RoleEditDialog.test.tsx`

### RED/GREEN Evidence

- RED: the focused suite failed with 2 expected failures. `lab-head` left Lab unchecked and `qc_staff` left QC unchecked because the edit initializer used a blank family when `role.family` was absent.
- GREEN: the focused suite passed after the dialog began inferring `lab` and `qc` from legacy IDs. Result: 1 file, 5 tests passed.

### Changed Files

- `src/components/lis/access/RoleEditDialog.tsx`
- `src/components/lis/access/RoleEditDialog.test.tsx`
- `.superpowers/sdd/role-family-task-4-report.md`

### Concerns

- No production build was run, per repository policy and task instructions.

## Explicit Blank Family Preservation Fix

### Commands Run

- `npm.cmd run test -- src/components/lis/access/RoleEditDialog.test.tsx`
- `npm.cmd run test -- src/components/lis/access/RoleEditDialog.test.tsx`

### RED/GREEN Evidence

- RED: the focused suite failed with 1 expected failure. A `lab-head` role with explicit `family: ""` did not select Not Lab/QC because the resolver fell back to the legacy ID.
- GREEN: the focused suite passed after the resolver began preserving any non-null family value before legacy-ID inference. Result: 1 file, 6 tests passed.

### Concerns

- No production build was run, per repository policy and task instructions.
