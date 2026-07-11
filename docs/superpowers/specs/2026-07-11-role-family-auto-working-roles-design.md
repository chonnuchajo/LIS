# Design: Role family automatic working roles

**Date:** 2026-07-11
**Status:** Approved design, written spec pending review

## Problem

Access Control supports multiple roles per user. Some roles represent higher
level Lab or QC capabilities, but those users still need the base working role
for their department so the home dashboard and shared work surfaces behave like
the staff page plus the extra role-specific access.

Required behavior:

- Users with Lab roles such as `lab-data-config`, `lab-head`, and
  `lab-inventory` automatically receive `lab-analyze`.
- Users with QC roles such as `qc-data-config` and `qc-head` automatically
  receive `qc-staff`.
- When an admin creates a new role, the role must declare whether it belongs to
  Lab or QC. A role that does not belong to either area can remain unclassified.
- If a user is assigned a Lab-family role, `lab-analyze` is added. If a user is
  assigned a QC-family role, `qc-staff` is added.
- Existing roles are preserved and automatic roles are not duplicated.

## Decisions

1. Add role-family metadata to the `Role` model instead of relying only on role
   id prefixes. This lets new roles declare their area explicitly.
2. Keep backend normalization as the source of truth. Frontend role selection
   can show the family, but the API must enforce the automatic base roles for
   user creation, user role updates, Microsoft login sync, manual employee
   linking, and HR employee sync.
3. Use `lab-analyze` as the base Lab working role because the current dashboard
   profile and route logic already use that id.
4. Use `qc-staff` as the base QC working role.
5. Preserve all manually assigned roles. The helper only appends missing base
   roles; it never removes roles.
6. Support legacy data by falling back to role id prefixes when a role document
   has no family metadata:
   - `lab`, `lab-*`, and `lab_*` imply Lab.
   - `qc`, `qc-*`, and `qc_*` imply QC.
7. Avoid a one-time migration. Existing role documents can receive family during
   normal seed/default backfill or the next edit.

## Backend Design

Add `family` to `server/models/Role.js`:

- Allowed values: `lab`, `qc`, and empty string.
- Default value: empty string.

Create a pure helper such as `server/lib/roleFamilies.js`:

- `normalizeRoleFamily(value)` returns `lab`, `qc`, or empty string.
- `roleFamilyForId(roleId, explicitFamily)` returns explicit family when set,
  otherwise applies the legacy id-prefix fallback.
- `baseRoleForFamily(family)` returns `lab-analyze`, `qc-staff`, or empty.
- `mergeBaseRolesForFamilies(roleIds, roleDocs)` returns role ids plus any
  required base working roles in stable order.

Apply that helper in `server/routes/accessControl.js` wherever persisted user
roles are created or changed:

- `POST /access-control/users`
- `POST /access-control/users/microsoft` for existing and new users
- `PATCH /access-control/users/:id`
- `POST /access-control/users/sync-employees`

Role create/edit routes accept and persist `family`:

- `POST /access-control/roles` requires a provided `family` value. Valid values
  are `lab`, `qc`, and empty string.
- `PATCH /access-control/roles/:id` can update `family`.
- `formatRole()` includes `family` so the frontend can render and edit it.

Default role backfill should mark known roles:

- Lab: `lab`, `lab-analyze`, `lab-data-config`, `lab-config`, `lab-head`,
  `lab-inventory`
- QC: `qc`, `qc-staff`, `qc-reviewer`, `qc-data-config`, `qc-head`

## Frontend Design

Extend the Access Control role type with `family?: "lab" | "qc" | ""`.

`RoleEditDialog` gets a required area selector for create mode:

- Lab
- QC
- Not Lab/QC

Edit mode shows the same selector so admins can correct role metadata.

`RolesTab`, `RoleCard`, and `AccessControl.tsx` pass `family` through create and
update calls. Role cards can show a small `Lab` or `QC` badge so admins can scan
which family a role belongs to.

The user role drawer does not need to manually add base roles. It sends the
selected roles to the API, and the API response updates the drawer/table with
the normalized role list.

## Testing

Use TDD before production edits.

Backend helper tests:

- Lab explicit family adds `lab-analyze`.
- QC explicit family adds `qc-staff`.
- Existing `lab-analyze` and `qc-staff` are not duplicated.
- Existing manual roles are preserved.
- A user with both Lab and QC family roles gets both base roles.
- Blank/non-classified roles add no base role.
- Prefix fallback works for existing `lab-head`, `lab-inventory`, and `qc-head`
  role ids even if family is missing.

Route-adjacent tests should cover the request/normalization helper used by
Access Control routes rather than database-heavy integration where possible.

Frontend tests should cover `RoleEditDialog` payload behavior if the current
test setup supports this component cheaply.

Validation commands:

- `node --test server/lib/roleFamilies.test.js`
- `npm run test -- src/lib/roles.test.ts src/lib/dashboardProfiles.test.ts`
- `npx tsc --noEmit` because TypeScript frontend types/components change

No build command should be run.

## Out Of Scope

- No automatic role removal.
- No production build.
- No one-time database migration or seed-data export unless explicitly
  requested.
- No redesign of the dashboard visuals.
