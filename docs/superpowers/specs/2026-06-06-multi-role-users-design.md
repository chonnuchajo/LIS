# Design: Users can hold multiple roles

**Date:** 2026-06-06
**Branch:** develop
**Status:** Approved (design), pending implementation plan

## Problem

Today a `User` has exactly one `role` (a single string). Permissions are
resolved at request time from that one role's `permissions[]`. Many code paths
branch on the single role string (admin bypass, home routing, sidebar redirect,
petition list lab/qc filtering). We want **one person to hold several roles at
once** (e.g. someone who is both `lab` and `qc`).

## Decisions (from brainstorming)

1. **Permissions = union** of every role the user holds.
2. **Single-behaviour branches** (Home page, redirects, display) resolve to the
   user's **highest-priority role**, picked automatically — the user does not
   choose an "active role".
3. **Data model:** add `roles: [String]` to `User`, keep the existing `role`
   field as a **computed primary** (the highest-priority role) so code that
   still reads `user.role` keeps working. Migrate lazily: an empty `roles` with
   a legacy `role` is treated as `roles = [role]`.

## Role precedence

A single ranking function decides the primary role and resolves single-behaviour
branches:

```
admin  >  qc / qc-*  >  lab / lab-*  >  any other custom role  >  viewer
```

- `primaryRole(roles: string[]): string` — returns the highest-ranked role, or
  `'viewer'` when the list is empty.
- Unknown/custom role ids rank above `viewer` but below `lab`. Tie-break by the
  order roles appear in the array.

This precedence lives in **one shared module** so frontend and backend agree.
Frontend: `src/lib/roles.ts`. Backend reuses the same logic (mirror in
`server/lib/roles.js` — the two are tiny and have no bundler shared between
them; keep them in sync, covered by tests on the frontend copy).

## Helpers (shared logic)

In `src/lib/roles.ts` (with co-located `roles.test.ts`):

- `primaryRole(roles: string[]): string`
- `unionPermissions(roles: string[], permsByRole: Record<string, string[]>): string[]`
  — flatten + de-dupe, stable order.
- `normalizeRoles(user: { role?: string; roles?: string[] }): string[]`
  — returns `roles` if non-empty, else `[role]` if present, else `[]`. The lazy
  migration shim used everywhere a user's role list is read.

Backend mirror `server/lib/roles.js` exports the same three functions for use in
`accessControl.js` / `auth.js`.

## Changes by layer

### A. Backend

**`server/models/User.js`**
- Add `roles: { type: [String], default: [] }`.
- Keep `role: String`. On `pre('save')`, if `roles` is non-empty set
  `role = primaryRole(roles)`; if `roles` is empty but `role` is set, set
  `roles = [role]`. Keeps both fields consistent without a bulk migration.

**`server/routes/accessControl.js`**
- `getRolePermissions(roleOrRoles)` → accept an array (or single, normalized);
  return `unionPermissions(roles, permsByRole)`.
- `formatUser(user, permissions)` → return `roleId` (= `primaryRole`),
  **`roleIds: roles[]`**, and `permissions` (union). Keep `roleId` for compat.
- Create user (`role: role.id`) → accept `roleIds: string[]`; set
  `roles = roleIds`, `role = primaryRole(roleIds)`.
- Patch user → accept `roleIds`; set both `roles` and `role`.
- Delete-role guard (`User.countDocuments({ role: id })`) → also count
  `roles: id` (a role still attached to anyone blocks deletion).
- Admin-protection (`user.role === 'admin'`) → `normalizeRoles(user).includes('admin')`.

**`server/routes/auth.js`**
- SSO sync: when assigning a default role to a fresh/viewer user, write `roles`
  too. Response `role` / formatting → include `roleIds` and primary `role`.

### B. Frontend permission resolution (union)

Three places build an "effective user" by swapping in the role's permissions.
All change from `permissions[user.role]` to the **union** over `normalizeRoles`:

- `src/hooks/useCanAccessPath.ts`
- `src/components/PrivateRoute.tsx`
- `src/pages/Home.tsx`

Each computes `unionPermissions(normalizeRoles(user), accessControl.permissions)`
and sets it as the effective `permissions[]`.

### C. Frontend single-role branches → primary / includes

- `src/lib/accessControl.ts`
  - `AccessUser` gains `roles?: string[]`.
  - Admin bypass: `user.role === 'admin'` → `normalizeRoles(user).includes('admin')`.
  - The `!user.role` guard → "no roles" check via `normalizeRoles`.
- `src/pages/Home.tsx` — pick home by `primaryRole(normalizeRoles(user))`.
- `src/components/lis/AppSidebar.tsx`
  - Display: show each role as a badge (was `roleNameById[user.role]`).
  - QC dashboard redirect (`user?.role === "qc"`) → `normalizeRoles(user).includes('qc')`.
- `src/pages/PetitionListPage.tsx` — lab/qc detection becomes "any held role
  matches": `roles.some(r => r === 'lab' || r.startsWith('lab-') || r.startsWith('lab_'))`
  and the qc equivalent. A user with both sees both lab and qc work. Admin /
  `!== 'viewer'` checks → `includes` / `some` over the role list.
- `src/components/petition/PetitionView.tsx` and
  `src/components/PetitionDetailPage.tsx` — `role !== 'viewer'` / `role === 'admin'`
  → `normalizeRoles(user)` with `includes` / `.some(r => r !== 'viewer')`.

### D. AuthContext / types

`src/context/AuthContext.tsx`
- `AuthUser` gains `roles?: string[]`; keep `role?` as primary.
- Synced (SSO) user: set `roles: res.data.data.roleIds ?? [res.data.data.roleId]`,
  `role: res.data.data.roleId` (primary).
- Dev user: build `roles` from the dev selection (see F), `role = primaryRole(roles)`.

### E. Access Control admin page (`src/pages/AccessControl.tsx`)

- `AppUser` type: add `roleIds: string[]` (keep `roleId` = primary for display).
- User editor: replace the single role `<select>` with a **multi-select**
  (checkbox list or badge multi-picker) bound to `roleIds`.
- Save: `updateUser(user.id, { roleIds })` (and create-user with `roleIds`).
- User rows: render roles as multiple badges instead of one.
- `src/lib/api.ts`: update the user create/update payload types to send
  `roleIds: string[]`.

### F. Dev mode

`src/config/dev.ts`
- `DevAuthUser` gains `roles: string[]`; keep `role` = primary.
- `synthesizeDevUser` accepts the selected role(s) (or keep single-role helper
  and assemble `roles` in AuthContext) — set `roles[]` and `role = primaryRole`.
- `department`/`position` derive from the **primary** role.

`src/components/DevRoleSwitcher.tsx`
- Switch from single-select to **multi-select** (checkboxes) so union behaviour
  is testable in dev. Persist the selected set (e.g. `dev_roles` in
  localStorage, JSON array; migrate the old `dev_role` single value on read).
- `switchDevRole` → `setDevRoles(string[])`.

## Testing

- `src/lib/roles.test.ts` (Vitest): `primaryRole` precedence (incl. empty →
  `viewer`, custom-role ranking, tie-break), `unionPermissions` (dedupe, order),
  `normalizeRoles` (legacy `role` only, `roles` only, both, neither).
- Extend `src/lib/accessControl` tests: a user with `roles: ['lab','qc']` is
  granted paths from **both** groups; admin via `roles: ['admin']` bypasses.
- Keep existing suite green (`npm run test`, `npx tsc --noEmit`, `npm run lint`).

## Backward compatibility / rollout

- No destructive DB migration: legacy users keep `role`; `roles` fills in lazily
  on read (`normalizeRoles`) and persists on next save.
- API keeps returning `roleId`; adds `roleIds`. Old clients reading `roleId`
  still work.
- After implementation, run `npm run seed:export` and commit so `seed-data/`
  reflects any users that gain `roles`.

## Out of scope

- No per-session "active role" switcher in production (precedence is automatic).
- No change to the `Role` model or the permission-group/`AccessGroup` system.
