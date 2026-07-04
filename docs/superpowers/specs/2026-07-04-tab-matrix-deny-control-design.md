# Tab-Level Access Matrix — Deny Model — Design

**Date:** 2026-07-04
**Branch:** develop
**Status:** Approved (pending implementation)
**Supersedes:** `2026-06-12-tab-level-access-control-design.md` (opt-in "restricted tab" model)

## Problem

The Access Control matrix (`src/pages/AccessControl.tsx`) lets admins grant/deny
**sidebar nav pages** per role (Group → Page). But many features are **tabs inside a
page** (Stock's 5 tabs, Settings' tabs, Report's 4 views, Admin Data's 3 logs), which
share the parent route and can't be controlled per role.

The 2026-06-12 feature added an **opt-in** model: a tab registered in `tabItems.ts`
was hidden-by-default and required its virtual path `${parent}/${key}` granted
directly. Only Settings→`dashboard` was ever registered. That model does not scale to
"control every tab": registering all tabs as opt-in would make every existing role
see **zero tabs** on those pages until an admin re-granted each one — a silent
regression.

## Goal

Let admins control **any in-page tab** per role from the matrix — down to sub-tabs —
with a model that:

- **Never regresses** existing users (a role that can open a page keeps seeing all its
  tabs until an admin explicitly hides one). No data migration.
- Is **future-proof**: any page that has tabs — including ones built later — is
  controllable automatically once it follows one convention. The admin never edits
  code; a developer adds one registry line + one hook call.
- Reuses the existing role/permission storage and matrix UI. No parallel system.

## Non-Goals

- No per-row/per-field control (whole tabs only).
- No change to how **routed pages** are gated (`userCanAccessPath` for routes is
  untouched except removing the now-dead restricted-tab special-case).
- No server-side enforcement of tab visibility — tabs are UI gating only (they are not
  routes), consistent with the existing tab feature. Acceptable for an internal tool.

## Approach: opt-out (deny) with a single tab registry

Flip the semantics from **allow-by-default-hidden** to **visible-unless-denied**.

- A tab is **visible** to a user unless the user's effective permissions (the union
  across their roles) contain a **deny token** `deny:${parent}/${key}`.
- Default (no token) = visible → no regression, no migration.
- Granting/denying a tab in the matrix adds/removes that one token on the role.

### Multi-role rule: deny-wins

Effective permissions are a **flat union** across a user's roles
(`unionPermissions`, `src/lib/roles.ts`). A deny token is therefore present iff **at
least one** of the user's roles denies the tab → **deny-wins**. This is simple, falls
out of the existing union, and means a restriction sticks even for multi-role users.
Documented as intended behavior.

### Why deny tokens (not a new field)

Denials are stored as string tokens in the **same** `Role.permissions` array, so no
schema change and the existing `PUT /roles/:id/permissions` endpoint is reused. The
`deny:` prefix is inert everywhere that reads grants:

- `userCanAccessPath` ignores any entry that isn't a `/`-path, `others`, or a known
  group id — a `deny:` token matches none, so it never affects routing.
- The matrix's existing `toggleGroupForRole` / `togglePageForRole` filter by group id
  and group paths; `deny:` tokens are neither, so they survive those rewrites.

## Components

### 1. `src/lib/tabRegistry.ts` (new) — single source of truth

Replaces `src/lib/tabItems.ts`. Maps each tabbed nav page → its ordered tabs.

```ts
import type { LucideIcon } from "lucide-react";

export type TabDef = {
  key: string;              // Radix Tabs value, e.g. "standard"
  label: string;            // shown in the page tab bar AND the matrix
  icon?: LucideIcon;        // optional trigger icon
  adminOnly?: boolean;      // always admin-gated; not role-configurable, hidden from matrix
};

// key = parent nav path (must match NAV_ITEMS path)
export const TAB_REGISTRY: Record<string, TabDef[]> = {
  "/stock": [
    { key: "standard", label: "Standards" },
    { key: "solvent", label: "สารเคมี" },
    { key: "glassware", label: "เครื่องแก้ว" },
    { key: "receive", label: "รับเข้า" },
    { key: "history", label: "ประวัติ" },
  ],
  "/settings": [
    { key: "environment", label: "ห้องตรวจสภาพแวดล้อม" },
    { key: "printers", label: "เครื่องพิมพ์เอกสาร" },
    { key: "doc-numbers", label: "รหัสเอกสาร" },
    { key: "instruments", label: "เครื่องมือ/API" },
    { key: "dashboard", label: "แดชบอร์ด" },
    { key: "line", label: "LINE", adminOnly: true },
    { key: "api", label: "API", adminOnly: true },
  ],
  "/report": [
    { key: "dashboard", label: "Dashboard ภาพรวม" },
    { key: "trend", label: "%AI" },
    { key: "oee", label: "OEE เครื่องวิเคราะห์" },
    { key: "workload", label: "Workload บุคลากร" },
  ],
  "/admin-data": [
    { key: "database", label: "ฐานข้อมูลผลลัพธ์" },
    { key: "activelog", label: "Active Log" },
    { key: "auditlog", label: "Audit Log" },
  ],
};

export const DENY_PREFIX = "deny:";
export const tabPath = (parent: string, key: string) => `${parent}/${key}`;
export const denyToken = (parent: string, key: string) =>
  `${DENY_PREFIX}${tabPath(parent, key)}`;

export const tabsFor = (parent: string): TabDef[] => TAB_REGISTRY[parent] ?? [];
// Tabs that appear in the matrix (role-configurable = not adminOnly).
export const configurableTabsFor = (parent: string): TabDef[] =>
  tabsFor(parent).filter((t) => !t.adminOnly);
```

**Adding a future page** = add one entry here + have the page call `useAccessibleTabs`.
The matrix and gating both pick it up with no other change.

### 2. `src/lib/accessControl.ts` — remove dead restricted-tab logic

- Drop the `RESTRICTED_TAB_PATHS` import and the `others`-branch special-case that
  excluded restricted tab paths (lines ~102–111). Tabs are no longer grant-paths, so
  `others` has nothing to exclude.
- No new logic here — deny is evaluated in the tab hook, not in route resolution.
- Add a tiny pure helper (here or in `tabRegistry.ts`) for the hook to use:
  `isTabDenied(effectivePermissions: string[], parent: string, key: string): boolean`
  → `effectivePermissions.includes(denyToken(parent, key))`.

### 3. `src/hooks/useAccessibleTabs.ts` — rewrite to deny semantics

New signature reads the registry itself (page passes only the parent path):

```ts
useAccessibleTabs(parentPath: string): {
  tabs: TabDef[];                    // registry tabs for this page filtered by isVisible
  isVisible: (key: string) => boolean;
  visibleKeys: string[];
  defaultKey: string | undefined;    // first visible key — safe active-tab fallback
}
```

- Gets effective permissions the same way `useCanAccessPath` does: `useAuth()` +
  the `["access-control"]` React Query + `unionPermissions(normalizeRoles(user), permsByRole)`.
  (Factor a small `useEffectivePermissions()` hook so both call sites share it.)
- admin → nothing denied, and `adminOnly` tabs pass (admin bypass, matches `userCanAccessPath`).
- `isVisible(key)` is the single decision point:
  - a key **not** in the registry → always visible (untouched pages);
  - an `adminOnly` key → visible only to admin;
  - otherwise → visible unless `isTabDenied(perms, parentPath, key)`.
- `tabs = tabsFor(parentPath).filter((t) => isVisible(t.key))` — so for an admin it
  includes the `adminOnly` tabs, and for everyone it drops denied tabs. The page maps
  this directly; it needs no separate `isAdmin` check for LINE/API.
- `defaultKey` = first visible key, so a user never lands on a denied tab.

### 4. Tab pages — render from the registry, filter, guard

`Stock`, `SettingsPage`, `Report`, `AdminData` (and future tabbed pages):

- Render the `TabsList` by mapping `tabs` from the hook (already filtered — includes
  `adminOnly` for admins, excludes denied) instead of a hardcoded trigger list.
  `TabsContent value=...` blocks stay as-is. Settings' LINE/API `adminOnly` tabs are
  handled by `isVisible`, so the page drops its ad-hoc `isAdmin &&` trigger gate; they
  stay out of the matrix (not role-configurable).
- Drive the active tab from `defaultKey` and guard it (`activeTab && isVisible(activeTab)
  ? activeTab : defaultKey`) — pattern already in `SettingsPage`.

### 5. `src/pages/AccessControl.tsx` — matrix 3rd level (Page → Tab)

- **Group Control PathPicker**: remove the tab sub-checkbox block (tabs are no longer
  stored in `group.paths`). Pages only.
- **Access Matrix tab**: under each expanded group, for each page row that has
  `configurableTabsFor(path).length > 0`, render an expand affordance; expanding shows
  one **tab sub-row** per configurable tab (3rd indent level).
  - Per-role tab checkbox: **checked = allowed (default)**, **unchecked = denied**.
    `checked = !isTabDenied(permissions[roleId] ?? [], parent, key)`.
  - Toggling off → add `denyToken(...)` to `permissions[roleId]`; toggling on → remove
    it. Reuse `savePermissions`; preserve all other tokens.
  - Disable (grey) the tab checkbox when the role can't access the parent page
    (`!isPageGranted(roleId, group, path)`) — tabs are moot without page access.
- New state `expandedPages: Set<string>` keyed by `${group.id}|${path}`; default
  collapsed to keep the matrix compact.
- When listing a group's page rows, **filter out any tab virtual paths** that may still
  linger in `group.paths` from the old model (so a stale `/settings/dashboard` doesn't
  render as a bogus page row). No destructive migration required; they're inert.

## Behavior changes to note

- **Settings → "แดชบอร์ด" flips** from hidden-by-default (opt-in) to visible-by-default.
  Anyone who can open Settings now sees it unless denied in the matrix. Accepted by
  user; no deny is seeded. Admins can deny it per role at any time.
- Any stale grant tokens from the old model (`/settings/dashboard` in a role's
  permissions or a group's `paths`) become inert. Optional, non-blocking cleanup only.

## Testing

- `src/lib/tabRegistry.test.ts` (or extend accessControl.test): `isTabDenied` true iff
  token present; `configurableTabsFor` drops `adminOnly`; unknown page → `[]`.
- `src/hooks/useAccessibleTabs.test.tsx`: unregistered key always visible; denied key
  hidden; `adminOnly` visible only to admin; `defaultKey` falls back to first visible
  when the natural default is denied; admin sees everything.
- `src/lib/accessControl.test.ts`: confirm removing the restricted-tab special-case
  doesn't change route grants; `deny:` tokens never grant a route.
- Update `src/pages/__tests__/SettingsPage.test.tsx` for the new hook signature.

## Rollout

- Frontend-only except **one server line**: extend the `PUT /roles/:id/permissions`
  filter in `server/routes/accessControl.js` to also keep `deny:`-prefixed tokens
  (`id.startsWith('/') || id.startsWith(DENY_PREFIX) || validIds.has(id)`), else the
  server silently drops every denial on save.
- No migration. Register the 4 pages now; PetitionAssign / Daily Check are intentionally
  out (workflow phases / sub-views) and addable later via one registry line.
