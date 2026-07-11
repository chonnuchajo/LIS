# Design: Department-based automatic roles

**Date:** 2026-07-11
**Status:** Approved design, awaiting written-spec review

## Problem

Users already receive department and position from Microsoft Graph and the HR
employee directory during `/access-control/users/microsoft` sync. Admins can
manually assign multiple roles, but two common departments should receive their
working role automatically:

- Everyone in `Lab/วิเคราะห์` should receive the Lab Analyze working role.
- Everyone in `ควบคุมคุณภาพ` should receive the QC Staff working role.

This must add to existing roles, not replace them. For example, an `admin` user
in `Lab/วิเคราะห์` remains `admin` and also receives the lab role.

## Decisions

1. Add the automatic role assignment in the backend sync path, not the frontend.
   Backend role state is the source of truth for permissions and API responses.
2. Merge automatic roles into the existing `roles[]` array with stable
   de-duplication. Existing manually assigned roles are preserved.
3. Do not automatically remove roles when the department changes. Removing a
   role can revoke access unexpectedly, so cleanup remains an admin action.
4. Use the canonical role id `lab-analyst` for the Lab Analyze working role.
   Existing dashboard/profile code already maps lab-family roles to the
   `lab-analyze` dashboard profile, and assignment helpers already accept both
   `lab-analyst` and the legacy `lab-analyze` prefix.
5. Use `qc-staff` for the `ควบคุมคุณภาพ` department.

## Department Matching

Department values arrive as free text from Graph or HR. Matching should trim
whitespace and be exact after trimming for the known department names:

- `Lab/วิเคราะห์` -> `lab-analyst`
- `ควบคุมคุณภาพ` -> `qc-staff`

No partial or fuzzy matching is included in this change. If HR introduces
alternate labels later, they can be added explicitly to the mapping helper.

## Backend Design

Add a small pure helper, for example `server/lib/departmentRoles.js`:

- `automaticRolesForDepartment(department)` returns the role ids implied by a
  department.
- `mergeAutomaticRoles(currentRoles, department)` returns the current role list
  plus the department-implied roles, with duplicates removed.

Apply this helper after the final department value is known in:

- Existing Microsoft user sync in `server/routes/accessControl.js`
- New Microsoft user creation in `server/routes/accessControl.js`
- Manual employee linking via `PATCH /access-control/users/:id`
- Bulk HR sync via `POST /access-control/users/sync-employees`

After merging roles, keep the existing `User` model pre-save hook responsible
for deriving the primary legacy `role` field from `roles[]`.

## Testing

Use TDD before production edits:

- Unit tests for department mapping and role merge:
  - `Lab/วิเคราะห์` adds `lab-analyst`
  - `ควบคุมคุณภาพ` adds `qc-staff`
  - unrelated departments add nothing
  - existing roles are preserved
  - duplicate automatic roles are not repeated
  - admin remains present when an automatic role is added
- Route-level behavior can be covered by focused helper usage where practical,
  keeping database-heavy route tests out of scope unless the existing test
  harness already supports them.

Validation commands:

- `node --test server/lib/departmentRoles.test.js`
- `npm run test -- src/lib/roles.test.ts` only if frontend role behavior changes
- `npx tsc --noEmit` if TypeScript files change

No build command should be run for this change.

## Out Of Scope

- No frontend redesign.
- No role deletion or auto-removal based on department changes.
- No one-time database migration unless explicitly requested after the automatic
  sync behavior is implemented.
