# Dynamic Dev Role Switcher

**Date:** 2026-05-16
**Status:** Approved for implementation

## Problem

The dev-mode role switcher renders buttons from a hardcoded `DEV_USERS` map in `src/config/dev.ts`. The Access Control page (`src/pages/AccessControl.tsx`) lets admins create and delete roles via the backend, but those changes never reach the switcher. Developers cannot switch into a freshly created role, and deleted roles remain selectable.

## Goal

The dev-mode role switcher must reflect the live role list from the backend:

- A role created in Access Control immediately becomes selectable in the switcher.
- A role deleted in Access Control immediately disappears from the switcher.
- If the currently selected dev role is deleted, the switcher falls back to a safe default and persists the change.

Production (MSAL) auth, permission resolution, and backend API contracts do not change.

## Approach

Drop the hardcoded `DEV_USERS` map. Drive the switcher from the same `/access-control` payload that already feeds dev permissions, and synthesize the dev `AuthUser` shape on the fly from each role.

### Changes by file

#### `src/config/dev.ts`

- Remove `DEV_USERS` and its `DevUser` type.
- Keep `DEV_MODE` and `DEV_DEFAULT_ROLE = "admin"`.
- Add a helper:

  ```ts
  export const synthesizeDevUser = (role: { id: string; name: string }): {
    id: string;
    email: string;
    name: string;
    role: string;
    permissions: string[];
    department: string;
    position: string;
    status: "active";
  } => ({
    id: `dev-${role.id}`,
    email: `${role.id}.dev@icpladda.com`,
    name: `Dev ${role.name}`,
    role: role.id,
    permissions: [],
    department: role.name,
    position: role.name,
    status: "active",
  });
  ```

  (Permissions array gets overlaid by the access matrix in `AuthContext`, same as today.)

#### `src/context/AuthContext.tsx`

- In the `/access-control` fetch that currently captures `permissions`, also capture `roles` (the endpoint already returns them — see `AccessControlState` in `src/pages/AccessControl.tsx:72-77`).
- Add state `const [devRoles, setDevRoles] = useState<{ id: string; name: string }[]>([])`.
- Rebuild `devUser` from `synthesizeDevUser(role)` where `role = devRoles.find(r => r.id === devRole)`.
- Stale-role guard: in an effect that runs when `devRoles` changes, if `devRole` is non-empty AND `devRoles.length > 0` AND `devRoles` does not contain `devRole`, call `switchDevRole(DEV_DEFAULT_ROLE)`. (Wait for `devRoles.length > 0` to avoid kicking on the initial empty state before the fetch resolves.)
- Expose `devRoles` through the context value so the switcher can read it. Add `devRoles?: { id: string; name: string }[]` to `AuthContextType`.

#### `src/components/DevRoleSwitcher.tsx`

- Remove the `ROLE_LABELS` map and the `DEV_USERS` import.
- Read `devRoles` from `useAuth()`.
- Render one button per role in `devRoles`, using `role.name` as the label.
- Guard: if `devRoles` is empty (still loading), render nothing (same pattern as the existing `!devRole` early return).

#### `src/pages/AccessControl.tsx`

- In `addRole` (currently `src/pages/AccessControl.tsx:317-335`) call `notifyGroupMappingChanged()` after the successful response.
- In `deleteRole` (currently `src/pages/AccessControl.tsx:337-352`) call `notifyGroupMappingChanged()` after the successful response.
- (The event name `lis-access-groups-changed` stays as-is to avoid touching the three other listeners. It already carries no payload — it's a "something in /access-control changed, refetch" signal.)

## Flow after the change

1. Admin creates a role in Access Control → `addRole` POSTs to backend → dispatches `lis-access-groups-changed`.
2. `AuthContext` listener refetches `/access-control` → `devRoles` state updates.
3. `DevRoleSwitcher` re-renders with the new role's button.

Delete flow is symmetric: button disappears; stale-role guard kicks the active session back to `admin` if the deleted role was selected.

## Non-goals

- No change to the `/access-control` backend contract.
- No change to MSAL/production auth path.
- No change to how permissions are resolved per role.
- No UI redesign of the switcher beyond the dynamic button list.

## Risks

- **Role with empty name** — `role.name` is the button label. The Access Control "Add Role" form already requires a non-empty name (`src/pages/AccessControl.tsx:319-321`), so this is enforced at the source.
- **Race between switching role and a delete** — if a dev clicks a button at the same moment that role is being deleted, the stale-role guard catches it on the next render. No additional handling needed.
- **`devRoles` empty on first paint** — the switcher returns null until the fetch resolves. Matches the existing behavior of returning null when `devRole` is unset.
