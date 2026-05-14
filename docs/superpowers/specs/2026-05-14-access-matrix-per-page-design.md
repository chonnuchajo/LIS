# Access Matrix — Per-Page Permission Granting

**Date:** 2026-05-14
**Status:** Approved design, pending implementation plan

## Problem

The Access Matrix tab (`src/pages/AccessControl.tsx`) currently grants permissions at the **group level only** — one checkbox per (group × role) cell. A role either receives an entire group (all its pages) or nothing.

We need the matrix to also support granting **individual pages** within a group, while still offering a one-click "whole group" action.

## Current State

- `permissions[roleId]` is a `string[]` of **group IDs** — both in the frontend state and in the backend `Role.permissions` field.
- A group has `paths: string[]`. Granting a group to a role grants every path in that group.
- Access enforcement: `PrivateRoute` calls `findGroupIdsForPath(pathname, groups)` to find which group IDs cover the current route, then `userMatchesAnyGroup(user, groupIds)` checks if the user's `permissions` contains any of them.
- `PUT /access-control/roles/:id/permissions` validates the incoming array against the set of known group IDs, dropping anything else.
- The `others` group is a locked catch-all; its membership is **computed** (every nav item not covered by another group). Its `paths` array is only an ordering hint.

## Approved Approach

**Mixed permissions array, paths-first on write.**

Keep `permissions[roleId]` as a `string[]`. Going forward the matrix writes **only page paths** (entries starting with `/`). Selecting "whole group" writes all of that group's page paths. Legacy entries that are group IDs remain readable by the access check, so **no data migration and no schema change** are required.

Tradeoff accepted by the user: because "whole group" expands to explicit paths at write time, a page added to a group *later* is **not** automatically granted to roles — an admin must tick the new page. This was chosen deliberately over keeping group-ID entries.

## Design

### 1. Permission storage model

- `permissions[roleId]: string[]` unchanged in shape.
- New writes from the matrix contain page paths only (e.g. `/send-sample`, `/petitions/:id`).
- Legacy group-ID entries (e.g. `samples`) are still honored by the access check for backward compatibility. They are never *written* by the new matrix, so they naturally disappear as roles are re-saved.

### 2. Matrix UI (`src/pages/AccessControl.tsx`, `matrix` tab)

- Each group is a **parent row** with:
  - an expand/collapse chevron,
  - a **tri-state group checkbox** per role: `checked` = every page of the group is granted, `indeterminate` = some pages granted, `unchecked` = none.
- Expanding a parent row reveals one **child row per page** in the group, each with its own per-role checkbox.
- **Page list per group** (the child rows):
  - Normal groups: every entry in `group.paths`. This includes non-nav paths such as `/petitions/:id`, so access can be controlled at full granularity. Nav paths render with their icon + Thai label; non-nav paths render the raw path string.
  - `others` group: the computed uncovered nav items (reuse the existing `renderNavItemsForGroup` logic), since `others.paths` is only an ordering hint.
- **Interactions:**
  - Toggling a **group checkbox** on → add every page path of that group to `permissions[roleId]`; off → remove all of them.
  - Toggling a **page checkbox** → add/remove that single path.
  - Group checkbox state is derived: all pages present → `checked`; some → `indeterminate`; none → `unchecked`.
- Saving still goes through the existing `togglePermission` flow / `PUT /access-control/roles/:id/permissions`, just with a possibly larger array. The optimistic-update + rollback pattern already in `togglePermission` is preserved; it may need to be generalized to accept a computed next-array rather than a single toggled ID.

### 3. Access enforcement (`src/lib/accessControl.ts`, `src/components/PrivateRoute.tsx`)

Add `userCanAccessPath(user, pathname, groups)`:

- `admin` role → `true`.
- Inactive user / no role → `false`.
- For each entry in `user.permissions`:
  - entry starts with `/` → `true` if `pathMatches(entry, pathname)`.
  - entry is the group ID `others` → `true` if `pathname` is **not** covered by any non-`others` group's paths.
  - entry is any other group ID → `true` if any path of that group `pathMatches(pathname)`.
- otherwise → `false`.

`PrivateRoute` calls `userCanAccessPath(user, location.pathname, groups)` instead of building `mappedGroupIds` + `userMatchesAnyGroup`. The existing group-map cache, the `lis-access-groups-changed` refresh listener, and the `DEV_MODE` bypass are unchanged.

`userMatchesAnyGroup` / `findGroupIdsForPath` may become unused once `PrivateRoute` switches over — remove them if so; keep `hasGroupPermission` only if other callers still need it (verify with a grep during implementation).

### 4. Backend (`server/routes/accessControl.js`)

`PUT /roles/:id/permissions` currently filters the incoming array to known group IDs:

```js
const validIds = new Set(groups.map(group => group.id));
const permissions = req.body.permissions.filter(id => validIds.has(id));
```

Widen `validIds` to also include every path across all groups, so page-path entries survive validation. Group IDs stay in the set for backward compatibility.

No change to the `Role` schema (`permissions` is already a string array). No migration script.

### 5. Minor cleanup

- The Roles tab card badge currently reads `"{n} groups"` from `permissions[role.id].length`. Since entries are now pages, relabel to `"{n} permissions"`.

## Out of Scope

- No change to how groups themselves are defined or to the Group Control tab.
- No data migration; legacy group-ID permission entries are tolerated, not converted.
- No change to the `Role` / `AccessGroup` MongoDB schemas.

## Testing

- **Unit (`src/lib/accessControl.ts`):** `userCanAccessPath` — admin bypass; exact path match; pattern path match (`/petitions/:id`); legacy group-ID entry grants all its paths; legacy `others` entry grants uncovered paths only; inactive user denied; empty permissions denied.
- **Manual UI:** expand/collapse a group row; tick a single page → only that page accessible for the role; tick the group checkbox → all pages accessible and checkbox shows `checked`; untick one page → checkbox shows `indeterminate`; verify per-page selection works for the `others` group; reload and confirm persistence.
- **Backend:** `PUT /roles/:id/permissions` with a body containing page paths → paths are persisted (not stripped); with a bogus path → stripped.
- Run `npm run test` and `npm run lint`.
