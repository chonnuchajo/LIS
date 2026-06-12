# Tab-Level Access Control — Design

**Date:** 2026-06-12
**Branch:** develop
**Status:** Approved (pending implementation)

## Problem

Access control is **path-based**: `userCanAccessPath()` (`src/lib/accessControl.ts`)
matches a user's `permissions[]` against route paths, and the Access Control matrix
(`src/pages/AccessControl.tsx`) lets admins assign **sidebar nav pages** (`NAV_ITEMS`)
to groups/roles.

Some features are **tabs inside a page**, not their own route — e.g.
`SettingsPage` (environment / printers / doc-numbers / instruments / dashboard),
`DailyCheckPage` rooms, Report sub-views. These tabs share the parent's route, so
they can't be granted/denied per role. We want some roles to be blocked from
certain tabs, configurable from the existing Access Control matrix.

## Goals

- Restrict individual tabs per role/group, configured in the Access Control matrix
  (no code change per role).
- Reuse the existing path-based model, group assignment, `useCanAccessPath`, and
  admin bypass — no parallel permission system.
- Zero regression: existing tabs stay visible to everyone who can see the parent
  page unless explicitly marked restricted.
- Adding a new lockable tab = edit one registry file.

## Non-Goals

- No per-row/per-field access control (only whole tabs).
- No change to the deny-by-default behavior of routed pages.
- Not converting every tab to a route.

## Approach: Virtual sub-paths + opt-in restriction

Each lockable tab gets a **virtual path** `${parentPath}/${key}`
(e.g. `/settings/dashboard`, `/daily-check/analysis`). Virtual paths are never
registered as React Router routes; they exist only as permission keys.

**Access rules** (extending `userCanAccessPath`):

- **Unregistered tab** → visible to anyone who can access the parent page
  (current behavior, untouched).
- **Registered (restricted) tab** → requires its virtual path granted **directly**
  via the matrix. Parent-page access alone is NOT enough. `others` never grants a
  restricted tab.
- **admin** → bypasses everything (existing logic).

Why opt-in (allow-by-default) rather than deny-by-default: most tabs should stay
open; only a few need locking. Deny-by-default would hide every existing tab until
re-granted — a regression and heavy admin overhead. Confirmed with user.

### Verified path-matching safety

- Virtual paths are 2-segment (`/settings/dashboard`). `pathMatches` requires equal
  segment count and each pattern segment to be literal-or-`:param`. No existing
  2-segment `:param` route has first segment `settings`/`daily-check`/`report`, so
  no accidental match.
- `grantMatches("/settings", "/settings/dashboard")` → false (segment counts
  differ, not in `IMPLIED_CHILD_PATHS`), so granting the parent does NOT auto-grant
  a restricted tab. Exactly the desired behavior.

## Components

### 1. `src/lib/tabItems.ts` (new) — registry

```ts
export type RestrictedTab = { parent: string; key: string; label: string };

export const RESTRICTED_TABS: RestrictedTab[] = [
  // add only tabs that should be lockable, e.g.:
  // { parent: "/settings", key: "dashboard", label: "แดชบอร์ด" },
];

export const tabPath = (parent: string, key: string) => `${parent}/${key}`;
export const RESTRICTED_TAB_PATHS = RESTRICTED_TABS.map((t) => tabPath(t.parent, t.key));
export const restrictedTabsFor = (parent: string) =>
  RESTRICTED_TABS.filter((t) => t.parent === parent);
```

Single source of truth shared by the matrix, the gating hook, and each page.

### 2. `src/lib/accessControl.ts` — enforce restriction

Import `RESTRICTED_TAB_PATHS`. In the `others` branch of `userCanAccessPath`, deny
any pathname that matches a restricted tab path (so an `others` user can't leak into
a locked tab). Direct/group grants of the exact virtual path still work through the
existing literal-path and group branches with no change. Keep the function pure —
the constant is module-level, not a new argument.

### 3. `src/hooks/useAccessibleTabs.ts` (new) — gating + safe default

```ts
useAccessibleTabs(parentPath: string, tabKeys: string[]): {
  visibleKeys: string[];          // keys the user may see (unregistered keys always pass)
  isVisible: (key: string) => boolean;
  defaultKey: string | undefined; // first visible key (for safe active-tab fallback)
}
```

Uses `useCanAccessPath()`. A tab key not in `RESTRICTED_TABS` for that parent is
always visible; a restricted one passes only if `canAccess(tabPath(parent, key))`.

### 4. Tab pages — filter + guard

`SettingsPage`, `DailyCheckPage`, Report page (and any future tabbed page that
registers tabs):

- Filter `TabsTrigger`/`TabsContent` by `isVisible(key)`.
- Initialize/guard the active tab value with `defaultKey` so a user can't land on or
  force-select a hidden tab (e.g. via stale state or URL).

### 5. `src/pages/AccessControl.tsx` — matrix UI

In the group editor, under each selected nav page render its `restrictedTabsFor(path)`
as indented checkboxes (e.g. under "ตั้งค่าระบบ" → ☐ แดชบอร์ด). Toggling adds/removes
the virtual path in `group.paths`. Virtual paths:

- Are stored in `group.paths` like any path.
- Do NOT render in the sidebar (they aren't `NAV_ITEMS`), consistent with how non-nav
  paths are already stored-but-hidden.
- Count as "claimed" in the `others`-coverage and ordering-hint logic where relevant.

## Testing

- `src/lib/accessControl.test.ts`: restricted tab requires direct/group grant; parent
  grant does not suffice; `others` does not grant; admin bypasses; unregistered tab
  unaffected.
- `useAccessibleTabs`: unregistered keys always visible; restricted key gated;
  `defaultKey` falls back to first visible when the natural default is hidden.

## Rollout

- Ship with `RESTRICTED_TABS` empty or with only the tabs the user names first → no
  behavior change until a tab is registered AND a grant assigned.
- Registering a tab + granting it in the matrix is all that's needed per new lock.
