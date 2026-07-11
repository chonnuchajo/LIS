# Role Family Final Fix Report

## Status

Implemented the final-review fix for preserving explicit blank role families.

## RED Evidence

Before production changes, ran:

```text
node --test server/lib/roleFamilies.test.js
npm.cmd run test -- src/config/dev.test.ts
```

The backend run failed 2 tests: `roleFamilyForId("lab-support", "")` returned `"lab"`, and an explicitly blank `lab-support` role received `lab-analyze`. The dev run failed 1 test: explicit-blank `lab-support` received `lab-analyze`. These failures reproduced the reported issue.

## GREEN Evidence

After the fix, ran:

```text
node --test server/lib/roleFamilies.test.js
npm.cmd run test -- src/config/dev.test.ts
npm.cmd run test -- src/components/lis/access/RoleEditDialog.test.tsx src/lib/dashboardProfiles.test.ts src/lib/roles.test.ts src/config/dev.test.ts
```

Results: 14/14 backend helper tests passed; the focused dev suite passed 13/13 tests; the broader frontend run passed 46/46 tests across 4 files. No build command was run.

## Changed Files

- `server/lib/roleFamilies.test.js`
- `server/lib/roleFamilies.js`
- `server/routes/accessControl.js`
- `src/config/dev.test.ts`
- `src/config/dev.ts`
- `.superpowers/sdd/role-family-final-fix-report.md`

## PATCH Family Adjudication

Did not require `family` on every `PATCH /roles/:id` request. The feature spec requires family on `POST /access-control/roles`; PATCH validates and applies family only when it is present. Dashboard-profile-only PATCH callers remain supported.

## Concerns

`src/config/dev.test.ts` contained a pre-existing dirty primary-role expectation hunk. It was preserved and excluded from this fix's staged changes; only the newly added role-family test hunk is staged. Existing legacy records with an absent or null `family` are intentionally backfilled, while explicit `""` values are retained.

## Final Review: Blank Base Role Removal

### RED Evidence

Before the production change, ran:

```text
npm.cmd run test -- src/config/dev.test.ts
```

Result: 13/15 tests passed and the two new explicit-blank base role cases failed. Removing `lab-analyze` returned `["lab-head", "lab-analyze"]`; removing `qc-staff` returned `["qc-head", "qc-staff"]`.

### GREEN Evidence

After the production change, ran:

```text
npm.cmd run test -- src/config/dev.test.ts
npm.cmd run test -- src/components/lis/access/RoleEditDialog.test.tsx src/lib/dashboardProfiles.test.ts src/lib/roles.test.ts src/config/dev.test.ts
```

Results: the focused dev suite passed 15/15 tests; the broader frontend-focused run passed 48/48 tests across 4 files. No build command was run.

### Changed Files

- `src/config/dev.ts`
- `src/config/dev.test.ts`
- `.superpowers/sdd/role-family-final-fix-report.md`

### Concerns

`src/config/dev.test.ts` retains its pre-existing unrelated primary-role expectation hunk. The final fix test hunk must be staged precisely so the unrelated change is not included in this commit.
