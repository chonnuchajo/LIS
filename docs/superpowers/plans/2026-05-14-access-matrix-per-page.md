# Access Matrix Per-Page Permissions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the Access Matrix grant permissions per individual page, not just per whole group, while keeping a one-click "whole group" action.

**Architecture:** `permissions[roleId]` stays a `string[]` but new writes contain page paths only; legacy group-ID entries remain readable by a new backward-compatible access check `userCanAccessPath`. The matrix tab gets tri-state group checkboxes plus expandable per-page rows. `PrivateRoute` and `AppSidebar` switch to path-based checks. No schema change, no data migration.

**Tech Stack:** React 18 + TypeScript + Vite, Vitest, shadcn/ui (Radix Checkbox), Express + Mongoose backend.

**Spec:** `docs/superpowers/specs/2026-05-14-access-matrix-per-page-design.md`

---

## File Structure

- `src/lib/accessControl.ts` — add `userCanAccessPath`; remove `hasGroupPermission`, `findGroupIdsForPath`, `userMatchesAnyGroup` (and `GroupId` if unused).
- `src/lib/accessControl.test.ts` — **new** unit tests for `userCanAccessPath`.
- `src/components/PrivateRoute.tsx` — enforce access via `userCanAccessPath` on the current pathname.
- `src/components/lis/AppSidebar.tsx` — filter sidebar items per-page via `userCanAccessPath`.
- `src/components/ui/checkbox.tsx` — render a `Minus` icon + primary background for the `indeterminate` state.
- `src/pages/AccessControl.tsx` — matrix tab: tri-state group checkbox + expandable per-page rows; Roles tab badge relabel.
- `server/routes/accessControl.js` — `PUT /roles/:id/permissions` accepts page paths, not just group IDs.

---

### Task 1: `userCanAccessPath` access-check function

**Files:**
- Modify: `src/lib/accessControl.ts`
- Test: `src/lib/accessControl.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/lib/accessControl.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { userCanAccessPath } from "./accessControl";

const groups = [
  { id: "samples", paths: ["/petitions", "/petitions/:id", "/send-sample"] },
  { id: "reports", paths: ["/report"] },
  { id: "others", paths: [] },
];

describe("userCanAccessPath", () => {
  it("lets admin access any path", () => {
    const user = { role: "admin", status: "active" as const, permissions: [] };
    expect(userCanAccessPath(user, "/anything", groups)).toBe(true);
  });

  it("grants access when the exact path is in permissions", () => {
    const user = { role: "lab", status: "active" as const, permissions: ["/report"] };
    expect(userCanAccessPath(user, "/report", groups)).toBe(true);
  });

  it("denies a path that is not in permissions", () => {
    const user = { role: "lab", status: "active" as const, permissions: ["/report"] };
    expect(userCanAccessPath(user, "/send-sample", groups)).toBe(false);
  });

  it("matches a pattern path entry against a concrete pathname", () => {
    const user = { role: "lab", status: "active" as const, permissions: ["/petitions/:id"] };
    expect(userCanAccessPath(user, "/petitions/123", groups)).toBe(true);
  });

  it("honors a legacy group-id entry by granting all its paths", () => {
    const user = { role: "lab", status: "active" as const, permissions: ["samples"] };
    expect(userCanAccessPath(user, "/send-sample", groups)).toBe(true);
  });

  it("does not let a legacy group-id entry leak into other groups", () => {
    const user = { role: "lab", status: "active" as const, permissions: ["samples"] };
    expect(userCanAccessPath(user, "/report", groups)).toBe(false);
  });

  it("legacy 'others' entry grants paths not covered by any other group", () => {
    const user = { role: "lab", status: "active" as const, permissions: ["others"] };
    expect(userCanAccessPath(user, "/unmapped-page", groups)).toBe(true);
  });

  it("legacy 'others' entry does not grant a path covered by another group", () => {
    const user = { role: "lab", status: "active" as const, permissions: ["others"] };
    expect(userCanAccessPath(user, "/report", groups)).toBe(false);
  });

  it("denies an inactive user even with a matching path", () => {
    const user = { role: "lab", status: "inactive" as const, permissions: ["/report"] };
    expect(userCanAccessPath(user, "/report", groups)).toBe(false);
  });

  it("denies a user with no role", () => {
    const user = { status: "active" as const, permissions: ["/report"] };
    expect(userCanAccessPath(user, "/report", groups)).toBe(false);
  });

  it("denies a user with empty permissions", () => {
    const user = { role: "lab", status: "active" as const, permissions: [] };
    expect(userCanAccessPath(user, "/report", groups)).toBe(false);
  });

  it("denies a null user", () => {
    expect(userCanAccessPath(null, "/report", groups)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/accessControl.test.ts`
Expected: FAIL — `userCanAccessPath` is not exported / not a function.

- [ ] **Step 3: Implement `userCanAccessPath`**

In `src/lib/accessControl.ts`, add this function (place it after `pathMatches`, before or after `findGroupIdsForPath` — it will be the only path-check export kept after Task 4):

```ts
export function userCanAccessPath(
  user: AccessUser | null | undefined,
  pathname: string,
  groups: { id: string; paths?: string[] }[],
) {
  if (!user || user.status === "inactive" || !user.role) return false;
  if (user.role === "admin") return true;

  const permissions = user.permissions ?? [];
  for (const entry of permissions) {
    if (entry.startsWith("/")) {
      if (pathMatches(entry, pathname)) return true;
      continue;
    }
    if (entry === "others") {
      const coveredByOtherGroup = groups
        .filter((group) => group.id !== "others")
        .some((group) => (group.paths ?? []).some((path) => pathMatches(path, pathname)));
      if (!coveredByOtherGroup) return true;
      continue;
    }
    const group = groups.find((g) => g.id === entry);
    if (group && (group.paths ?? []).some((path) => pathMatches(path, pathname))) {
      return true;
    }
  }
  return false;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/accessControl.test.ts`
Expected: PASS — all 12 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/accessControl.ts src/lib/accessControl.test.ts
git commit -m "feat: add userCanAccessPath path-based access check"
```

---

### Task 2: Enforce access in `PrivateRoute` via `userCanAccessPath`

**Files:**
- Modify: `src/components/PrivateRoute.tsx`

- [ ] **Step 1: Replace the file contents**

Overwrite `src/components/PrivateRoute.tsx` with:

```tsx
import { Navigate, useLocation } from "react-router-dom";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { userCanAccessPath } from "@/lib/accessControl";
import { api } from "@/lib/api";
import { DEV_MODE } from "@/config/dev";

type AccessGroup = {
  id: string;
  paths?: string[];
};

type AccessControlState = {
  groups: AccessGroup[];
};

let groupMapCache: AccessGroup[] | null = null;
let groupMapRequest: Promise<AccessGroup[]> | null = null;

function loadGroupMap() {
  if (groupMapCache) return Promise.resolve(groupMapCache);
  if (!groupMapRequest) {
    groupMapRequest = api
      .get<AccessControlState>("/access-control")
      .then((res) => {
        groupMapCache = res.data.data.groups;
        return groupMapCache;
      })
      .finally(() => {
        groupMapRequest = null;
      });
  }
  return groupMapRequest;
}

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useIsAuthenticated();
  const { inProgress } = useMsal();
  const { user } = useAuth();
  const location = useLocation();
  const [groups, setGroups] = useState<AccessGroup[]>([]);
  const [mappingLoaded, setMappingLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [mappingVersion, setMappingVersion] = useState(0);

  useEffect(() => {
    const refreshMapping = () => {
      groupMapCache = null;
      setMappingVersion((current) => current + 1);
    };
    window.addEventListener("lis-access-groups-changed", refreshMapping);
    return () => {
      window.removeEventListener("lis-access-groups-changed", refreshMapping);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setMappingLoaded(false);
    loadGroupMap()
      .then((loadedGroups) => {
        if (!alive) return;
        setGroups(loadedGroups);
        setLoadFailed(false);
      })
      .catch(() => {
        if (alive) setLoadFailed(true);
      })
      .finally(() => {
        if (alive) setMappingLoaded(true);
      });

    return () => {
      alive = false;
    };
  }, [mappingVersion]);

  if (DEV_MODE) {
    return <>{children}</>;
  }

  if (inProgress !== InteractionStatus.None) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!user?.role || user.status === undefined) {
    return null;
  }

  if (!mappingLoaded) {
    return null;
  }

  if (!loadFailed && !userCanAccessPath(user, location.pathname, groups)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md rounded-lg border bg-card p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-foreground">ไม่มีสิทธิ์เข้าใช้งานหน้านี้</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Role ของคุณยังไม่ได้รับสิทธิ์สำหรับหน้านี้
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default PrivateRoute;
```

Notes: `loadFailed` preserves the previous fail-open behavior — if the access-control API is unreachable, routes are not blocked. The load effect no longer depends on `location.pathname` because `userCanAccessPath` receives the pathname at render time.

- [ ] **Step 2: Verify it compiles / lints**

Run: `npm run lint`
Expected: PASS — no errors in `PrivateRoute.tsx`. (Pre-existing warnings elsewhere are acceptable; no new errors.)

- [ ] **Step 3: Commit**

```bash
git add src/components/PrivateRoute.tsx
git commit -m "refactor: enforce route access by pathname in PrivateRoute"
```

---

### Task 3: Filter sidebar items per-page in `AppSidebar`

**Files:**
- Modify: `src/components/lis/AppSidebar.tsx:13` (import)
- Modify: `src/components/lis/AppSidebar.tsx:172-175` (section render)

- [ ] **Step 1: Update the import**

Change line 13 from:

```tsx
import { hasGroupPermission, pathMatches } from "@/lib/accessControl";
```

to:

```tsx
import { pathMatches, userCanAccessPath } from "@/lib/accessControl";
```

- [ ] **Step 2: Filter items per-page instead of hiding sections by group id**

Replace lines 172-175:

```tsx
          {sections.map((section, sIdx) => {
            if (!hasGroupPermission(user, section.id)) return null;
            const visibleItems = section.items;
            if (visibleItems.length === 0) return null;
```

with:

```tsx
          {sections.map((section, sIdx) => {
            const visibleItems = section.items.filter((item) =>
              userCanAccessPath(user, item.path, navGroups),
            );
            if (visibleItems.length === 0) return null;
```

The rest of the section body (which already maps over `visibleItems`) is unchanged. Empty sections are still hidden by the `visibleItems.length === 0` guard.

- [ ] **Step 3: Verify it compiles / lints**

Run: `npm run lint`
Expected: PASS — no new errors in `AppSidebar.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/components/lis/AppSidebar.tsx
git commit -m "refactor: filter sidebar nav items by per-page access"
```

---

### Task 4: Remove dead group-based access helpers

**Files:**
- Modify: `src/lib/accessControl.ts`

- [ ] **Step 1: Confirm the helpers have no remaining callers**

Run: `npx grep -rn "hasGroupPermission\|findGroupIdsForPath\|userMatchesAnyGroup\|GroupId" src` — or use the Grep tool with pattern `hasGroupPermission|findGroupIdsForPath|userMatchesAnyGroup|GroupId` over `src`.
Expected: matches only inside `src/lib/accessControl.ts` itself. If any other file still imports them, stop and fix that file first.

- [ ] **Step 2: Remove the dead exports**

In `src/lib/accessControl.ts`, delete:
- the `export type GroupId = string;` line (only if Step 1 showed no external `GroupId` users),
- the entire `hasGroupPermission` function,
- the entire `findGroupIdsForPath` function,
- the entire `userMatchesAnyGroup` function.

Keep: the `AccessUser` interface, `normalizePath`, `pathMatches`, and `userCanAccessPath`. The resulting file is:

```ts
export interface AccessUser {
  role?: string;
  status?: "active" | "inactive";
  permissions?: string[];
}

function normalizePath(path: string) {
  if (!path || path === "/") return "/";
  return path.replace(/\/+$/, "");
}

export function pathMatches(pattern: string, pathname: string) {
  const normalizedPattern = normalizePath(pattern);
  const normalizedPath = normalizePath(pathname);

  if (normalizedPattern === normalizedPath) return true;
  if (normalizedPattern.endsWith("/*")) {
    return normalizedPath.startsWith(normalizedPattern.slice(0, -2));
  }

  const patternParts = normalizedPattern.split("/");
  const pathParts = normalizedPath.split("/");
  if (patternParts.length !== pathParts.length) return false;

  return patternParts.every((part, index) => part.startsWith(":") || part === pathParts[index]);
}

export function userCanAccessPath(
  user: AccessUser | null | undefined,
  pathname: string,
  groups: { id: string; paths?: string[] }[],
) {
  if (!user || user.status === "inactive" || !user.role) return false;
  if (user.role === "admin") return true;

  const permissions = user.permissions ?? [];
  for (const entry of permissions) {
    if (entry.startsWith("/")) {
      if (pathMatches(entry, pathname)) return true;
      continue;
    }
    if (entry === "others") {
      const coveredByOtherGroup = groups
        .filter((group) => group.id !== "others")
        .some((group) => (group.paths ?? []).some((path) => pathMatches(path, pathname)));
      if (!coveredByOtherGroup) return true;
      continue;
    }
    const group = groups.find((g) => g.id === entry);
    if (group && (group.paths ?? []).some((path) => pathMatches(path, pathname))) {
      return true;
    }
  }
  return false;
}
```

- [ ] **Step 3: Verify tests + lint still pass**

Run: `npx vitest run src/lib/accessControl.test.ts`
Expected: PASS — 12 tests green.

Run: `npm run lint`
Expected: PASS — no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/accessControl.ts
git commit -m "refactor: drop unused group-based access helpers"
```

---

### Task 5: Backend accepts page-path permissions

**Files:**
- Modify: `server/routes/accessControl.js:305-322` (`PUT /roles/:id/permissions`)

- [ ] **Step 1: Widen the valid-id set to include group paths**

In `server/routes/accessControl.js`, in the `router.put('/roles/:id/permissions', ...)` handler, replace:

```js
    const groups = await ensureGroups();
    const validIds = new Set(groups.map(group => group.id));
    const permissions = Array.isArray(req.body.permissions)
      ? req.body.permissions.filter(id => validIds.has(id))
      : [];
```

with:

```js
    const groups = await ensureGroups();
    const validIds = new Set([
      ...groups.map(group => group.id),
      ...groups.flatMap(group => group.paths || []),
    ]);
    const permissions = Array.isArray(req.body.permissions)
      ? req.body.permissions.filter(id => validIds.has(id))
      : [];
```

Group IDs stay in the set so legacy entries and the "whole group" semantics still validate; page paths are now also accepted.

- [ ] **Step 2: Manually verify the endpoint**

Start the backend however the project normally runs it (e.g. `npm run dev` which proxies `/LIS/api` → `localhost:3001`, with the API server running). Then exercise the endpoint:

```bash
curl -X PUT http://localhost:3001/api/access-control/roles/viewer/permissions \
  -H "Content-Type: application/json" \
  -d '{"permissions":["/report","/bogus-path-xyz"]}'
```

Expected: response JSON `permissions` contains `"/report"` and does **not** contain `"/bogus-path-xyz"` (a path that exists in no group is filtered out).

- [ ] **Step 3: Commit**

```bash
git add server/routes/accessControl.js
git commit -m "feat: accept page-path permissions in role permissions endpoint"
```

---

### Task 6: Tri-state group checkbox + indeterminate visual

**Files:**
- Modify: `src/components/ui/checkbox.tsx`

- [ ] **Step 1: Render a distinct indeterminate state**

Overwrite `src/components/ui/checkbox.tsx` with:

```tsx
import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current")}>
      {props.checked === "indeterminate" ? (
        <Minus className="h-4 w-4" />
      ) : (
        <Check className="h-4 w-4" />
      )}
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
```

- [ ] **Step 2: Verify it compiles / lints**

Run: `npm run lint`
Expected: PASS — no new errors in `checkbox.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/checkbox.tsx
git commit -m "feat: support indeterminate state in Checkbox"
```

---

### Task 7: Matrix tab — expandable per-page permission rows

**Files:**
- Modify: `src/pages/AccessControl.tsx`

- [ ] **Step 1: Update imports**

In `src/pages/AccessControl.tsx`:

Change the React import (line 1) from:

```tsx
import { useEffect, useMemo, useState } from "react";
```

to:

```tsx
import { Fragment, useEffect, useMemo, useState } from "react";
```

Add `ChevronDown` and `ChevronRight` to the `lucide-react` import block (the block that currently starts with `ChevronsUpDown`):

```tsx
import {
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  FolderTree,
  GripVertical,
  KeyRound,
  LockKeyhole,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  UsersRound,
} from "lucide-react";
```

- [ ] **Step 2: Add `expandedGroups` state**

In the `AccessControl` component, next to the other `useState` declarations (after `navDragOverPath`, around line 196), add:

```tsx
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
```

- [ ] **Step 3: Add the `navItemByPath` lookup**

Next to the other `useMemo` declarations (e.g. after `roleById`, around line 220), add:

```tsx
  const navItemByPath = useMemo(
    () => new Map(NAV_ITEMS.map((item) => [item.path, item])),
    [],
  );
```

- [ ] **Step 4: Remove the old `togglePermission` and `pathListToText`**

Delete the `pathListToText` definition (currently around line 261):

```tsx
  const pathListToText = (group: AccessGroup) => (group.paths ?? []).join(", ");
```

Delete the entire `togglePermission` function (currently around lines 471-486):

```tsx
  const togglePermission = async (roleId: string, groupId: string) => {
    const current = permissions[roleId] ?? [];
    const nextRolePermissions = current.includes(groupId)
      ? current.filter((id) => id !== groupId)
      : [...current, groupId];
    const nextPermissions = { ...permissions, [roleId]: nextRolePermissions };
    setPermissions(nextPermissions);
    try {
      await api.put(`/access-control/roles/${roleId}/permissions`, {
        permissions: nextRolePermissions,
      });
    } catch (err) {
      setPermissions(permissions);
      toast.error(err instanceof Error ? err.message : "Failed to update permissions");
    }
  };
```

- [ ] **Step 5: Add the matrix helper functions**

Immediately after the `renderNavItemsForGroup` function (currently ends around line 512, just before `return (`), add:

```tsx
  const getGroupPagePaths = (group: AccessGroup): string[] => {
    if (group.id === "others") {
      return renderNavItemsForGroup(group).map((item) => item.path);
    }
    return group.paths ?? [];
  };

  const toggleExpandedGroup = (groupId: string) => {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const savePermissions = async (roleId: string, nextRolePermissions: string[]) => {
    const previous = permissions;
    setPermissions({ ...permissions, [roleId]: nextRolePermissions });
    try {
      await api.put(`/access-control/roles/${roleId}/permissions`, {
        permissions: nextRolePermissions,
      });
    } catch (err) {
      setPermissions(previous);
      toast.error(err instanceof Error ? err.message : "Failed to update permissions");
    }
  };

  const groupCheckState = (
    roleId: string,
    group: AccessGroup,
  ): boolean | "indeterminate" => {
    const current = permissions[roleId] ?? [];
    if (current.includes(group.id)) return true;
    const groupPaths = getGroupPagePaths(group);
    if (groupPaths.length === 0) return false;
    const granted = groupPaths.filter((path) => current.includes(path));
    if (granted.length === 0) return false;
    if (granted.length === groupPaths.length) return true;
    return "indeterminate";
  };

  const isPageGranted = (roleId: string, group: AccessGroup, path: string) => {
    const current = permissions[roleId] ?? [];
    return current.includes(group.id) || current.includes(path);
  };

  const toggleGroupForRole = (roleId: string, group: AccessGroup, checked: boolean) => {
    const current = permissions[roleId] ?? [];
    const groupPaths = getGroupPagePaths(group);
    const groupPathSet = new Set(groupPaths);
    const next = current.filter(
      (entry) => entry !== group.id && !groupPathSet.has(entry),
    );
    if (checked) next.push(...groupPaths);
    savePermissions(roleId, next);
  };

  const togglePageForRole = (
    roleId: string,
    group: AccessGroup,
    path: string,
    checked: boolean,
  ) => {
    const current = permissions[roleId] ?? [];
    const groupPaths = getGroupPagePaths(group);
    const groupPathSet = new Set(groupPaths);
    const hadLegacyGroup = current.includes(group.id);
    const granted = new Set(
      hadLegacyGroup
        ? groupPaths
        : groupPaths.filter((p) => current.includes(p)),
    );
    if (checked) granted.add(path);
    else granted.delete(path);
    const next = current.filter(
      (entry) => entry !== group.id && !groupPathSet.has(entry),
    );
    next.push(...groupPaths.filter((p) => granted.has(p)));
    savePermissions(roleId, next);
  };
```

Notes: any interaction normalizes a legacy group-id entry into explicit page paths — `toggleGroupForRole`/`togglePageForRole` always strip `group.id` and all the group's paths from `current`, then re-add the chosen paths.

- [ ] **Step 6: Replace the matrix `TableBody`**

In the `matrix` `TabsContent`, replace the entire `<TableBody>...</TableBody>` block (currently lines 1042-1063, the `groups.map` rendering one row per group) with:

```tsx
                    <TableBody>
                      {groups.map((group) => {
                        const groupPaths = getGroupPagePaths(group);
                        const expanded = expandedGroups.has(group.id);
                        return (
                          <Fragment key={group.id}>
                            <TableRow>
                              <TableCell>
                                <div className="flex items-start gap-2">
                                  <button
                                    type="button"
                                    onClick={() => toggleExpandedGroup(group.id)}
                                    className="mt-0.5 text-muted-foreground hover:text-foreground"
                                    aria-label={expanded ? "ยุบรายหน้า" : "ขยายรายหน้า"}
                                  >
                                    {expanded ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                  </button>
                                  <div>
                                    <p className="font-medium">{group.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {groupPaths.length} หน้า
                                    </p>
                                    {group.description && (
                                      <p className="mt-1 text-xs text-muted-foreground">
                                        {group.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              {roles.map((role) => (
                                <TableCell key={role.id} className="text-center">
                                  <Checkbox
                                    checked={groupCheckState(role.id, group)}
                                    onCheckedChange={(c) =>
                                      toggleGroupForRole(role.id, group, c === true)
                                    }
                                    aria-label={`${role.name} ${group.name}`}
                                  />
                                </TableCell>
                              ))}
                            </TableRow>
                            {expanded &&
                              groupPaths.map((path) => {
                                const navItem = navItemByPath.get(path);
                                return (
                                  <TableRow
                                    key={`${group.id}-${path}`}
                                    className="bg-muted/30"
                                  >
                                    <TableCell className="py-1.5 pl-12">
                                      <div className="flex items-center gap-2">
                                        {navItem ? (
                                          <>
                                            <navItem.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                            <span className="text-sm">{navItem.label}</span>
                                            <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                                              {path}
                                            </span>
                                          </>
                                        ) : (
                                          <span className="font-mono text-xs text-muted-foreground">
                                            {path}
                                          </span>
                                        )}
                                      </div>
                                    </TableCell>
                                    {roles.map((role) => (
                                      <TableCell
                                        key={role.id}
                                        className="py-1.5 text-center"
                                      >
                                        <Checkbox
                                          checked={isPageGranted(role.id, group, path)}
                                          onCheckedChange={(c) =>
                                            togglePageForRole(
                                              role.id,
                                              group,
                                              path,
                                              c === true,
                                            )
                                          }
                                          aria-label={`${role.name} ${navItem?.label ?? path}`}
                                        />
                                      </TableCell>
                                    ))}
                                  </TableRow>
                                );
                              })}
                          </Fragment>
                        );
                      })}
                    </TableBody>
```

- [ ] **Step 7: Relabel the Roles tab badge**

In the `roles` `TabsContent`, change (currently around line 837):

```tsx
                      <Badge variant="outline">
                        {(permissions[role.id] ?? []).length} groups
                      </Badge>
```

to:

```tsx
                      <Badge variant="outline">
                        {(permissions[role.id] ?? []).length} permissions
                      </Badge>
```

- [ ] **Step 8: Verify it compiles / lints**

Run: `npm run lint`
Expected: PASS — no new errors. In particular, no "unused variable" errors (confirms `togglePermission` and `pathListToText` were fully removed).

- [ ] **Step 9: Manual UI test**

Run `npm run dev` and open the app (DEV_MODE is on, so you land as admin). Go to **Access Control → Access Matrix** and verify:
- Each group row has a chevron; clicking it expands/collapses per-page rows.
- A group with all pages granted shows a filled (checked) group checkbox; none granted shows empty; some granted shows the `Minus` (indeterminate) icon.
- Ticking a group checkbox grants every page of that group to that role; the per-page rows all become checked. Unticking clears them all.
- Ticking a single page row sets the group checkbox to indeterminate.
- Expand the **อื่นๆ (others)** group — per-page rows appear and are individually toggleable.
- Reload the page; selections persist (round-tripped through the backend).
- Go to **Roles** tab — the badge reads "N permissions".

- [ ] **Step 10: Commit**

```bash
git add src/pages/AccessControl.tsx
git commit -m "feat: per-page permission rows in Access Matrix"
```

---

### Task 8: Full verification

- [ ] **Step 1: Run the test suite**

Run: `npm run test`
Expected: PASS — including the new `accessControl.test.ts`.

- [ ] **Step 2: Run the linter**

Run: `npm run lint`
Expected: PASS — no new errors introduced by this work.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build completes with no TypeScript errors.

- [ ] **Step 4: Final manual smoke test**

With `npm run dev`: set `src/config/dev.ts` `DEV_MODE` aside mentally — confirm the matrix, sidebar, and route guarding all behave as in Task 7 Step 9. No commit needed if Tasks 1-7 are all committed and nothing changed here.

---

## Self-Review Notes

- **Spec coverage:** storage model (Tasks 1, 5, 7) · matrix UI tri-state + per-page (Tasks 6, 7) · `others` per-page (Task 7, `getGroupPagePaths`) · `userCanAccessPath` (Task 1) · `PrivateRoute` (Task 2) · `AppSidebar` (Task 3) · backend validation (Task 5) · dead-helper removal (Task 4) · badge relabel (Task 7) · tests (Tasks 1, 8). All spec sections map to a task.
- **No migration / no schema change:** confirmed — no task touches Mongoose models or writes a migration.
- **Type consistency:** `userCanAccessPath(user, pathname, groups)` signature is identical in Task 1 (definition + test), Task 2 (`PrivateRoute`), Task 3 (`AppSidebar`), Task 4 (final file). `getGroupPagePaths`, `groupCheckState`, `isPageGranted`, `toggleGroupForRole`, `togglePageForRole`, `savePermissions` are all defined once in Task 7 Step 5 and used only within Task 7 Step 6.
