# Tab-Level Access Matrix (Deny Model) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins control every in-page tab per role from the Access Control matrix (Group → Page → Tab), with a visible-unless-denied model that never regresses existing users.

**Architecture:** A single `tabRegistry.ts` lists each tabbed page's tabs (the source of truth for both page rendering and the matrix). Tab gating flips from opt-in ("restricted, hidden unless granted") to opt-out ("visible unless a `deny:${parent}/${key}` token is present in the role's permissions"). Deny tokens live in the existing `Role.permissions` string array — inert for route resolution, surfaced only by `useAccessibleTabs`.

**Tech Stack:** React 18 + TypeScript + Vite + shadcn/ui Tabs + TanStack Query (frontend, Vitest); Express + Mongoose (backend, Jest).

## Global Constraints

- Production base path is `/LIS/`; never hardcode it — irrelevant here (no new routes).
- Type-check with `npx tsc -p tsconfig.app.json --noEmit` (the bare `npx tsc --noEmit` is a no-op in this repo).
- Do NOT run `npm run build`. Use tsc for type-checking.
- Commit only files this plan touches, with explicit pathspec (a concurrent committer may be active on `develop`).
- Tabs are frontend UI gating only — no server enforcement (tabs are not routes). Consistent with the prior tab feature.
- Multi-role rule: **deny-wins** (a tab is hidden if any of the user's roles denies it) — a consequence of the flat `unionPermissions`.
- Deny token format: `deny:${parent}/${key}` (e.g. `deny:/stock/history`). Prefix constant `DENY_PREFIX = "deny:"`.

---

### Task 1: `tabRegistry.ts` — single source of truth + helpers

**Files:**
- Create: `src/lib/tabRegistry.ts`
- Test: `src/lib/tabRegistry.test.ts`

**Interfaces:**
- Produces:
  - `type TabDef = { key: string; label: string; icon?: LucideIcon; adminOnly?: boolean }`
  - `TAB_REGISTRY: Record<string, TabDef[]>`
  - `DENY_PREFIX: "deny:"`
  - `tabPath(parent: string, key: string): string`
  - `denyToken(parent: string, key: string): string`
  - `tabsFor(parent: string): TabDef[]`
  - `configurableTabsFor(parent: string): TabDef[]` (drops `adminOnly`)
  - `isTabDenied(permissions: string[], parent: string, key: string): boolean`
  - `PAGES_WITH_TABS: string[]`

- [ ] **Step 1: Write the failing test**

Create `src/lib/tabRegistry.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  tabsFor,
  configurableTabsFor,
  tabPath,
  denyToken,
  isTabDenied,
  PAGES_WITH_TABS,
} from "./tabRegistry";

describe("tabRegistry", () => {
  it("returns [] for a page with no registered tabs", () => {
    expect(tabsFor("/nope")).toEqual([]);
  });

  it("configurableTabsFor drops adminOnly tabs", () => {
    const keys = configurableTabsFor("/settings").map((t) => t.key);
    expect(keys).toContain("dashboard");
    expect(keys).not.toContain("line");
    expect(keys).not.toContain("api");
  });

  it("tabsFor keeps adminOnly tabs", () => {
    expect(tabsFor("/settings").map((t) => t.key)).toContain("line");
  });

  it("builds tab + deny tokens", () => {
    expect(tabPath("/stock", "history")).toBe("/stock/history");
    expect(denyToken("/stock", "history")).toBe("deny:/stock/history");
  });

  it("isTabDenied reflects token presence", () => {
    expect(isTabDenied(["deny:/stock/history"], "/stock", "history")).toBe(true);
    expect(isTabDenied([], "/stock", "history")).toBe(false);
    expect(isTabDenied(["/stock"], "/stock", "history")).toBe(false);
  });

  it("PAGES_WITH_TABS lists the registered pages", () => {
    expect(PAGES_WITH_TABS).toEqual(
      expect.arrayContaining(["/stock", "/settings", "/report", "/admin-data"]),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/tabRegistry.test.ts`
Expected: FAIL with "Failed to resolve import ./tabRegistry".

- [ ] **Step 3: Write the registry**

Create `src/lib/tabRegistry.ts`:

```ts
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  TrendingUp,
  Gauge,
  Users,
  Database,
  Activity,
  History,
} from "lucide-react";

export type TabDef = {
  key: string; // Radix Tabs value
  label: string; // shown in the page tab bar AND the matrix
  icon?: LucideIcon; // optional trigger icon
  adminOnly?: boolean; // always admin-gated; not role-configurable, hidden from matrix
};

export const DENY_PREFIX = "deny:";

// key = parent nav path (must match NAV_ITEMS path). Order = tab bar order.
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
    { key: "dashboard", label: "Dashboard ภาพรวม", icon: LayoutDashboard },
    { key: "trend", label: "%AI", icon: TrendingUp },
    { key: "oee", label: "OEE เครื่องวิเคราะห์", icon: Gauge },
    { key: "workload", label: "Workload บุคลากร", icon: Users },
  ],
  "/admin-data": [
    { key: "database", label: "ฐานข้อมูลผลลัพธ์", icon: Database },
    { key: "activelog", label: "Active Log", icon: Activity },
    { key: "auditlog", label: "Audit Log", icon: History },
  ],
};

export const tabPath = (parent: string, key: string) => `${parent}/${key}`;
export const denyToken = (parent: string, key: string) =>
  `${DENY_PREFIX}${tabPath(parent, key)}`;

export const tabsFor = (parent: string): TabDef[] => TAB_REGISTRY[parent] ?? [];

export const configurableTabsFor = (parent: string): TabDef[] =>
  tabsFor(parent).filter((t) => !t.adminOnly);

export const isTabDenied = (
  permissions: string[],
  parent: string,
  key: string,
): boolean => permissions.includes(denyToken(parent, key));

export const PAGES_WITH_TABS = Object.keys(TAB_REGISTRY);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/tabRegistry.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tabRegistry.ts src/lib/tabRegistry.test.ts
git commit -m "feat: tabRegistry — single source for lockable in-page tabs" -- src/lib/tabRegistry.ts src/lib/tabRegistry.test.ts
```

---

### Task 2: `accessControl.ts` — drop the dead restricted-tab logic

**Files:**
- Modify: `src/lib/accessControl.ts` (remove import line 3 + the `others`-branch tab exception)
- Modify: `src/lib/accessControl.test.ts` (replace the 4 restricted-tab tests, lines ~162–180)

**Interfaces:**
- Consumes: nothing new.
- Produces: `userCanAccessPath` unchanged in signature; `deny:` tokens are now just unrecognized permission entries (ignored).

- [ ] **Step 1: Update the tests first (they encode the new behavior)**

In `src/lib/accessControl.test.ts`, replace the four `it(...)` blocks from
`"grants a restricted tab when its exact virtual path is in permissions"` through
`"still lets 'others' grant a non-restricted in-page path"` (the block ending at the
`});` on line ~180, just before `describe("userCanAccessPath with multiple roles"`)
with:

```ts
  it("a deny: token is inert and never grants a route", () => {
    const user = { role: "lab", status: "active" as const, permissions: ["deny:/report/oee"] };
    expect(userCanAccessPath(user, "/report/oee", groups)).toBe(false);
    expect(userCanAccessPath(user, "/report", groups)).toBe(false);
  });

  it("granting a page does not auto-grant its in-page tab paths", () => {
    const user = { role: "lab", status: "active" as const, permissions: ["/report"] };
    expect(userCanAccessPath(user, "/report", groups)).toBe(true);
    // tab visibility is handled by the deny model in useAccessibleTabs, not here
    expect(userCanAccessPath(user, "/report/oee", groups)).toBe(false);
  });

  it("'others' now grants an uncovered in-page path (no restricted-tab exception)", () => {
    const user = { role: "lab", status: "active" as const, permissions: ["others"] };
    expect(userCanAccessPath(user, "/settings/dashboard", groups)).toBe(true);
    expect(userCanAccessPath(user, "/settings/printers", groups)).toBe(true);
  });
```

- [ ] **Step 2: Run the tests to verify the 'others' one now fails**

Run: `npx vitest run src/lib/accessControl.test.ts`
Expected: FAIL on `"'others' now grants an uncovered in-page path"` — currently the
`RESTRICTED_TAB_PATHS` exception makes `/settings/dashboard` return `false`.

- [ ] **Step 3: Remove the restricted-tab logic from `accessControl.ts`**

Delete line 3:

```ts
import { RESTRICTED_TAB_PATHS } from "./tabItems";
```

In `userCanAccessPath`, replace the `others` branch:

```ts
    if (entry === "others") {
      // Restricted tabs are never granted by the catch-all "others" — they must be
      // assigned explicitly, even if no group happens to claim them.
      const isRestrictedTabPath = RESTRICTED_TAB_PATHS.some((p) => pathMatches(p, pathname));
      if (isRestrictedTabPath) continue;
      const coveredByOtherGroup = groups
        .filter((group) => group.id !== "others")
        .some((group) => (group.paths ?? []).some((path) => grantMatches(path, pathname)));
      if (!coveredByOtherGroup) return true;
      continue;
    }
```

with:

```ts
    if (entry === "others") {
      const coveredByOtherGroup = groups
        .filter((group) => group.id !== "others")
        .some((group) => (group.paths ?? []).some((path) => grantMatches(path, pathname)));
      if (!coveredByOtherGroup) return true;
      continue;
    }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/accessControl.test.ts`
Expected: PASS (all, including the 3 rewritten tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/accessControl.ts src/lib/accessControl.test.ts
git commit -m "refactor: drop opt-in restricted-tab exception (moving to deny model)" -- src/lib/accessControl.ts src/lib/accessControl.test.ts
```

---

### Task 3: `useEffectivePermissions` + rewrite `useAccessibleTabs` (deny model)

**Files:**
- Create: `src/hooks/useEffectivePermissions.ts`
- Modify: `src/hooks/useAccessibleTabs.ts` (full rewrite)
- Modify: `src/hooks/useAccessibleTabs.test.tsx` (full rewrite)

**Interfaces:**
- Consumes: `tabsFor`, `isTabDenied`, `TabDef` from `@/lib/tabRegistry`; `useAuth` from `@/context/AuthContext`; `unionPermissions`, `normalizeRoles` from `@/lib/roles`; `loadAccessControl` from `@/lib/accessControlSource`.
- Produces:
  - `useEffectivePermissions(): { permissions: string[]; isAdmin: boolean }`
  - `useAccessibleTabs(parentPath: string): { tabs: TabDef[]; isVisible: (key: string) => boolean; visibleKeys: string[]; defaultKey: string | undefined }`

- [ ] **Step 1: Write the failing test**

Replace the entire contents of `src/hooks/useAccessibleTabs.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAccessibleTabs } from "./useAccessibleTabs";

// Mutable mock the hook reads each render.
const mock = { permissions: [] as string[], isAdmin: false };
vi.mock("./useEffectivePermissions", () => ({
  useEffectivePermissions: () => mock,
}));

describe("useAccessibleTabs (deny model)", () => {
  it("shows all registry tabs by default (nothing denied)", () => {
    mock.permissions = [];
    mock.isAdmin = false;
    const { result } = renderHook(() => useAccessibleTabs("/stock"));
    expect(result.current.visibleKeys).toEqual([
      "standard",
      "solvent",
      "glassware",
      "receive",
      "history",
    ]);
  });

  it("hides a denied tab", () => {
    mock.permissions = ["deny:/stock/history"];
    mock.isAdmin = false;
    const { result } = renderHook(() => useAccessibleTabs("/stock"));
    expect(result.current.isVisible("history")).toBe(false);
    expect(result.current.visibleKeys).not.toContain("history");
  });

  it("adminOnly tab is hidden for non-admin, shown for admin", () => {
    mock.permissions = [];
    mock.isAdmin = false;
    expect(renderHook(() => useAccessibleTabs("/settings")).result.current.isVisible("line")).toBe(false);
    mock.isAdmin = true;
    expect(renderHook(() => useAccessibleTabs("/settings")).result.current.isVisible("line")).toBe(true);
  });

  it("admin ignores deny tokens", () => {
    mock.permissions = ["deny:/stock/history"];
    mock.isAdmin = true;
    const { result } = renderHook(() => useAccessibleTabs("/stock"));
    expect(result.current.isVisible("history")).toBe(true);
  });

  it("keeps an unregistered key visible", () => {
    mock.permissions = [];
    mock.isAdmin = false;
    const { result } = renderHook(() => useAccessibleTabs("/stock"));
    expect(result.current.isVisible("nonexistent")).toBe(true);
  });

  it("defaultKey falls back to the first visible key", () => {
    mock.permissions = ["deny:/stock/standard"];
    mock.isAdmin = false;
    const { result } = renderHook(() => useAccessibleTabs("/stock"));
    expect(result.current.defaultKey).toBe("solvent");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useAccessibleTabs.test.tsx`
Expected: FAIL — old `useAccessibleTabs(parent, keys)` signature / missing `./useEffectivePermissions`.

- [ ] **Step 3: Create `useEffectivePermissions.ts`**

```ts
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { normalizeRoles, unionPermissions } from "@/lib/roles";
import { loadAccessControl } from "@/lib/accessControlSource";

/**
 * The current user's effective permissions — the de-duped union of every role's
 * permission list (grants, group ids, `others`, and `deny:` tab tokens) — plus an
 * `isAdmin` flag. Shares the ["access-control"] query with useCanAccessPath, so no
 * extra fetch.
 */
export function useEffectivePermissions(): { permissions: string[]; isAdmin: boolean } {
  const { user } = useAuth();
  const { data: accessControl } = useQuery({
    queryKey: ["access-control"],
    queryFn: () => loadAccessControl(),
    staleTime: 5 * 60 * 1000,
  });
  return useMemo(() => {
    const roles = normalizeRoles(user);
    const permsByRole = accessControl?.permissions ?? {};
    return {
      permissions: unionPermissions(roles, permsByRole),
      isAdmin: roles.includes("admin"),
    };
  }, [accessControl, user]);
}
```

- [ ] **Step 4: Rewrite `useAccessibleTabs.ts`**

Replace the entire file:

```ts
import { useMemo } from "react";
import { useEffectivePermissions } from "./useEffectivePermissions";
import { tabsFor, isTabDenied, type TabDef } from "@/lib/tabRegistry";

/**
 * Deny-model gating for in-page tabs. A tab from the registry is visible unless the
 * user's effective permissions deny it (`deny:${parent}/${key}`). `adminOnly` tabs
 * are visible only to admin; admin is never denied; a key not in the registry is
 * always visible (pages that opt out of control). Render the returned `tabs` as the
 * TabsList and seed the active tab with `defaultKey` so a user never lands on a
 * hidden tab.
 */
export function useAccessibleTabs(parentPath: string) {
  const { permissions, isAdmin } = useEffectivePermissions();

  return useMemo(() => {
    const registry = tabsFor(parentPath);
    const byKey = new Map(registry.map((t) => [t.key, t]));
    const isVisible = (key: string) => {
      const def = byKey.get(key);
      if (!def) return true; // unregistered → always visible
      if (def.adminOnly) return isAdmin;
      if (isAdmin) return true;
      return !isTabDenied(permissions, parentPath, key);
    };
    const tabs: TabDef[] = registry.filter((t) => isVisible(t.key));
    const visibleKeys = tabs.map((t) => t.key);
    return { tabs, isVisible, visibleKeys, defaultKey: visibleKeys[0] };
  }, [permissions, isAdmin, parentPath]);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/hooks/useAccessibleTabs.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useEffectivePermissions.ts src/hooks/useAccessibleTabs.ts src/hooks/useAccessibleTabs.test.tsx
git commit -m "feat: deny-model useAccessibleTabs + useEffectivePermissions" -- src/hooks/useEffectivePermissions.ts src/hooks/useAccessibleTabs.ts src/hooks/useAccessibleTabs.test.tsx
```

---

### Task 4: Server — persist `deny:` permission tokens

**Files:**
- Create: `server/lib/permissionFilter.js`
- Test: `server/lib/permissionFilter.test.js`
- Modify: `server/routes/accessControl.js` (the `PUT /roles/:id/permissions` filter, lines ~488–492)

**Interfaces:**
- Produces: `isStorablePermission(id, validIds: Set<string>): boolean` and `DENY_PREFIX: "deny:"`.

- [ ] **Step 1: Write the failing test**

Create `server/lib/permissionFilter.test.js`:

```js
const { isStorablePermission } = require("./permissionFilter");

describe("isStorablePermission", () => {
  const valid = new Set(["qc", "/report"]);

  it("keeps known group ids", () => {
    expect(isStorablePermission("qc", valid)).toBe(true);
  });
  it("keeps known group paths", () => {
    expect(isStorablePermission("/report", valid)).toBe(true);
  });
  it("keeps any route-shaped string", () => {
    expect(isStorablePermission("/stock", valid)).toBe(true);
  });
  it("keeps deny tokens", () => {
    expect(isStorablePermission("deny:/stock/history", valid)).toBe(true);
  });
  it("drops unrecognized junk", () => {
    expect(isStorablePermission("random", valid)).toBe(false);
  });
  it("drops non-strings", () => {
    expect(isStorablePermission(5, valid)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest lib/permissionFilter.test.js`
Expected: FAIL — cannot find `./permissionFilter`.

- [ ] **Step 3: Create the helper**

Create `server/lib/permissionFilter.js`:

```js
const DENY_PREFIX = "deny:";

// A permission token is storable if it is a known group id / group path, any
// route-shaped string (`/...` — covers per-page 'others' entries that live only in
// the frontend PAGE_ITEMS), or a tab-deny token (`deny:/parent/key`). Everything
// else is dropped to keep the array clean.
function isStorablePermission(id, validIds) {
  if (typeof id !== "string") return false;
  return validIds.has(id) || id.startsWith("/") || id.startsWith(DENY_PREFIX);
}

module.exports = { isStorablePermission, DENY_PREFIX };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest lib/permissionFilter.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Wire the helper into the route**

In `server/routes/accessControl.js`, add near the other top-of-file `require`s:

```js
const { isStorablePermission } = require("../lib/permissionFilter");
```

Then replace the filter in `PUT /roles/:id/permissions`:

```js
    const permissions = Array.isArray(req.body.permissions)
      ? req.body.permissions.filter(
          id => typeof id === 'string' && (validIds.has(id) || id.startsWith('/')),
        )
      : [];
```

with:

```js
    const permissions = Array.isArray(req.body.permissions)
      ? req.body.permissions.filter(id => isStorablePermission(id, validIds))
      : [];
```

- [ ] **Step 6: Verify the server still starts / no syntax error**

Run: `cd server && node -e "require('./routes/accessControl.js'); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 7: Commit**

```bash
git add server/lib/permissionFilter.js server/lib/permissionFilter.test.js server/routes/accessControl.js
git commit -m "feat: accept deny: tab tokens in role permissions" -- server/lib/permissionFilter.js server/lib/permissionFilter.test.js server/routes/accessControl.js
```

---

### Task 5: Wire `SettingsPage` to the registry + new hook

**Files:**
- Modify: `src/pages/SettingsPage.tsx` (remove `TAB_KEYS`; new hook call; render TabsList from `tabs`)
- Modify: `src/pages/__tests__/SettingsPage.test.tsx` (update the hook mock)

**Interfaces:**
- Consumes: `useAccessibleTabs(parentPath)` from Task 3.

- [ ] **Step 1: Update the SettingsPage test mock first**

In `src/pages/__tests__/SettingsPage.test.tsx`, replace the `useAccessibleTabs` mock:

```tsx
vi.mock("@/hooks/useAccessibleTabs", () => ({
  useAccessibleTabs: () => ({
    isVisible: () => true,
    defaultKey: "environment",
  }),
}));
```

with:

```tsx
vi.mock("@/hooks/useAccessibleTabs", () => ({
  useAccessibleTabs: () => ({
    tabs: [
      { key: "environment", label: "ห้องตรวจสภาพแวดล้อม" },
      { key: "printers", label: "เครื่องพิมพ์เอกสาร" },
      { key: "doc-numbers", label: "รหัสเอกสาร" },
      { key: "instruments", label: "เครื่องมือ/API" },
      { key: "dashboard", label: "แดชบอร์ด" },
    ],
    isVisible: () => true,
    defaultKey: "environment",
  }),
}));
```

- [ ] **Step 2: Run the SettingsPage test (baseline green)**

Run: `npx vitest run src/pages/__tests__/SettingsPage.test.tsx`
Expected: PASS. This is a refactor (page render source changes from hardcoded triggers
to the registry map) with the same visible tab labels, so the behavior test — "groups
the settings into an environment tab and a printer tab" — must stay green before and
after Step 3. It is the guard that the refactor didn't change what renders.

- [ ] **Step 3: Update `SettingsPage.tsx`**

Remove the `TAB_KEYS` constant (line 23):

```ts
const TAB_KEYS = ["environment", "printers", "doc-numbers", "instruments", "dashboard"];
```

Change the hook call (line ~127) from:

```ts
  const { isVisible, defaultKey } = useAccessibleTabs("/settings", TAB_KEYS);
```

to:

```ts
  const { tabs, isVisible, defaultKey } = useAccessibleTabs("/settings");
```

Replace the entire `<TabsList>…</TabsList>` block (lines ~149–167) with:

```tsx
        <TabsList>
          {tabs.map((t) => (
            <TabsTrigger key={t.key} value={t.key} className="gap-1.5">
              {t.icon && <t.icon className="h-4 w-4" />}
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
```

Leave every `<TabsContent value="…">` block unchanged. Keep the `isAdmin` declaration (line 28) — it still gates the LINE/API `TabsContent` blocks (lines ~238, ~249). The `line`/`api` triggers are now produced by the registry map: they are `adminOnly`, so `useAccessibleTabs` includes them in `tabs` only for admins — matching the existing `isAdmin`-gated content. Non-admins get neither trigger nor content.

- [ ] **Step 4: Type-check + run the test**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no new errors in `SettingsPage.tsx`.

Run: `npx vitest run src/pages/__tests__/SettingsPage.test.tsx`
Expected: PASS (4 tests) — the tab-name assertions resolve against the mapped `tabs`.

- [ ] **Step 5: Commit**

```bash
git add src/pages/SettingsPage.tsx src/pages/__tests__/SettingsPage.test.tsx
git commit -m "feat: SettingsPage renders tabs from registry (deny model)" -- src/pages/SettingsPage.tsx src/pages/__tests__/SettingsPage.test.tsx
```

---

### Task 6: Wire `Stock`, `Report`, `AdminData` tab bars to the registry

**Files:**
- Modify: `src/pages/Stock.tsx` (component `StockPage`, tab bar at ~995)
- Modify: `src/pages/Report.tsx` (tab bar at ~236)
- Modify: `src/pages/AdminData.tsx` (tab bar at ~120)

**Interfaces:**
- Consumes: `useAccessibleTabs(parentPath)` from Task 3.

- [ ] **Step 1: `Stock.tsx`**

Add the import (with the other `@/` imports):

```ts
import { useAccessibleTabs } from "@/hooks/useAccessibleTabs";
```

Inside `const StockPage = () => {` (near the other hooks, before `return`):

```ts
  const { tabs, defaultKey } = useAccessibleTabs("/stock");
```

Replace the tab bar (lines ~995–1002) — keep all `<TabsContent>` unchanged:

```tsx
      <Tabs defaultValue="standard">
        <TabsList className="mb-4 flex-wrap h-auto">
          <TabsTrigger value="standard">Standards</TabsTrigger>
          <TabsTrigger value="solvent">สารเคมี</TabsTrigger>
          <TabsTrigger value="glassware">เครื่องแก้ว</TabsTrigger>
          <TabsTrigger value="receive">รับเข้า</TabsTrigger>
          <TabsTrigger value="history">ประวัติ</TabsTrigger>
        </TabsList>
```

with:

```tsx
      <Tabs defaultValue={defaultKey}>
        <TabsList className="mb-4 flex-wrap h-auto">
          {tabs.map((t) => (
            <TabsTrigger key={t.key} value={t.key} className="gap-1.5">
              {t.icon && <t.icon className="h-4 w-4" />}
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
```

- [ ] **Step 2: `Report.tsx`**

Add the import:

```ts
import { useAccessibleTabs } from "@/hooks/useAccessibleTabs";
```

Inside the page component (before `return`):

```ts
  const { tabs, defaultKey } = useAccessibleTabs("/report");
```

Replace the tab bar (lines ~236–242) — keep all `<TabsContent>` unchanged:

```tsx
        <Tabs defaultValue="dashboard">
          <TabsList className="mb-4 flex-wrap h-auto">
            {tabs.map((t) => (
              <TabsTrigger key={t.key} value={t.key} className="gap-1.5">
                {t.icon && <t.icon className="w-4 h-4" />}
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
```

(Set `<Tabs defaultValue={defaultKey}>`.)

- [ ] **Step 3: `AdminData.tsx`**

Add the import:

```ts
import { useAccessibleTabs } from "@/hooks/useAccessibleTabs";
```

Inside the page component (before `return`):

```ts
  const { tabs, defaultKey } = useAccessibleTabs("/admin-data");
```

Replace the tab bar (lines ~120–127) — keep the surrounding `<div className="overflow-x-auto …">` wrapper and all `<TabsContent>` unchanged:

```tsx
        <Tabs defaultValue={defaultKey}>
          <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
            <TabsList className="mb-4 w-max">
              {tabs.map((t) => (
                <TabsTrigger key={t.key} value={t.key} className="gap-1.5">
                  {t.icon && <t.icon className="w-4 h-4" />}
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
```

- [ ] **Step 4: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no new errors in `Stock.tsx`, `Report.tsx`, `AdminData.tsx`.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Stock.tsx src/pages/Report.tsx src/pages/AdminData.tsx
git commit -m "feat: render Stock/Report/AdminData tab bars from registry" -- src/pages/Stock.tsx src/pages/Report.tsx src/pages/AdminData.tsx
```

---

### Task 7: Access Matrix — Group → Page → Tab (3rd level) + deny toggles

**Files:**
- Modify: `src/pages/AccessControl.tsx`

**Interfaces:**
- Consumes: `configurableTabsFor`, `denyToken`, `isTabDenied`, `tabsFor` from `@/lib/tabRegistry`; existing `permissions`, `savePermissions`, `isPageGranted`, `getGroupPagePaths`, `navItemByPath`, `expandedGroups` in the component.

- [ ] **Step 1: Swap the registry import**

Replace:

```ts
import { restrictedTabsFor, tabPath } from "@/lib/tabItems";
```

with:

```ts
import { configurableTabsFor, denyToken, isTabDenied, tabsFor } from "@/lib/tabRegistry";
```

- [ ] **Step 2: Simplify `PathPicker.toggle` (drop tab child paths)**

Replace (lines ~121–128):

```tsx
  const toggle = (item: NavItem, checked: boolean) => {
    if (checked) {
      if (!value.includes(item.path)) onChange([...value, item.path]);
    } else {
      const childTabPaths = restrictedTabsFor(item.path).map((t) => tabPath(t.parent, t.key));
      onChange(value.filter((p) => p !== item.path && !childTabPaths.includes(p)));
    }
  };
```

with:

```tsx
  const toggle = (item: NavItem, checked: boolean) => {
    if (checked) {
      if (!value.includes(item.path)) onChange([...value, item.path]);
    } else {
      onChange(value.filter((p) => p !== item.path));
    }
  };
```

- [ ] **Step 3: Remove the tab sub-checkboxes from `PathPicker`**

Delete the `{checked && restrictedTabsFor(item.path).map((tab) => { … })}` block
(lines ~199–225), leaving the page `<label>…</label>` that precedes it. The
returned element becomes just:

```tsx
            return (
              <div key={item.path}>
                <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-accent">
                  <Checkbox
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={(c) => toggle(item, c === true)}
                  />
                  <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm">{item.label}</span>
                  <span className="ml-auto truncate font-mono text-[10px] text-muted-foreground">
                    {item.path}
                  </span>
                </label>
              </div>
            );
```

- [ ] **Step 4: Add per-page expand state + a tab-virtual-path guard + a deny toggle**

After the existing `expandedGroups` state (line ~265) add:

```tsx
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());
```

Near `toggleExpandedGroup` (line ~711) add:

```tsx
  const toggleExpandedPage = (groupId: string, path: string) => {
    const key = `${groupId}|${path}`;
    setExpandedPages((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // A stored path like "/settings/dashboard" whose parent has a registry tab of that
  // key is a leftover tab-grant from the old opt-in model — never render it as a page
  // row (its tab is now shown under its parent page instead).
  const isTabVirtualPath = (p: string) => {
    const i = p.lastIndexOf("/");
    if (i <= 0) return false;
    return tabsFor(p.slice(0, i)).some((t) => t.key === p.slice(i + 1));
  };
```

Near `togglePageForRole` (line ~767) add:

```tsx
  const toggleTabForRole = (
    roleId: string,
    parent: string,
    key: string,
    allowed: boolean,
  ) => {
    const token = denyToken(parent, key);
    const current = permissions[roleId] ?? [];
    const next = allowed
      ? current.filter((p) => p !== token)
      : current.includes(token)
        ? current
        : [...current, token];
    savePermissions(roleId, next);
  };
```

- [ ] **Step 5: Render the page rows with an expander + nested tab rows**

In the matrix `<TabsContent value="matrix">`, replace the page-rows block
`{expanded && groupPaths.map((path) => { … })}` (lines ~1360–1406) with:

```tsx
                            {expanded &&
                              groupPaths
                                .filter((path) => !isTabVirtualPath(path))
                                .map((path) => {
                                  const navItem = navItemByPath.get(path);
                                  const pageTabs = configurableTabsFor(path);
                                  const pageExpandKey = `${group.id}|${path}`;
                                  const pageExpanded = expandedPages.has(pageExpandKey);
                                  return (
                                    <Fragment key={`${group.id}-${path}`}>
                                      <TableRow className="bg-muted/30">
                                        <TableCell className="sticky left-0 z-10 min-w-[130px] w-[130px] sm:min-w-[200px] sm:w-[200px] md:min-w-[240px] md:w-[240px] bg-card py-1.5 pl-12 shadow-[1px_0_0_0_hsl(var(--border))]">
                                          <div className="flex items-center gap-2">
                                            {pageTabs.length > 0 ? (
                                              <button
                                                type="button"
                                                onClick={() => toggleExpandedPage(group.id, path)}
                                                className="rounded text-muted-foreground hover:text-foreground"
                                                aria-label={pageExpanded ? "ยุบรายแท็บ" : "ขยายรายแท็บ"}
                                                aria-expanded={pageExpanded}
                                              >
                                                {pageExpanded ? (
                                                  <ChevronDown className="h-3.5 w-3.5" />
                                                ) : (
                                                  <ChevronRight className="h-3.5 w-3.5" />
                                                )}
                                              </button>
                                            ) : (
                                              <span className="inline-block w-3.5" />
                                            )}
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
                                          <TableCell key={role.id} className="px-1 py-1.5 text-center sm:px-4">
                                            <Checkbox
                                              checked={isPageGranted(role.id, group, path)}
                                              onCheckedChange={(c) =>
                                                togglePageForRole(role.id, group, path, c === true)
                                              }
                                              aria-label={`${role.name} ${navItem?.label ?? path}`}
                                            />
                                          </TableCell>
                                        ))}
                                      </TableRow>
                                      {pageExpanded &&
                                        pageTabs.map((tab) => (
                                          <TableRow key={`${group.id}-${path}-${tab.key}`} className="bg-muted/10">
                                            <TableCell className="sticky left-0 z-10 min-w-[130px] w-[130px] sm:min-w-[200px] sm:w-[200px] md:min-w-[240px] md:w-[240px] bg-card py-1 pl-[4.5rem] shadow-[1px_0_0_0_hsl(var(--border))]">
                                              <span className="text-xs text-muted-foreground">↳ {tab.label}</span>
                                            </TableCell>
                                            {roles.map((role) => {
                                              const pageGranted = isPageGranted(role.id, group, path);
                                              return (
                                                <TableCell key={role.id} className="px-1 py-1 text-center sm:px-4">
                                                  <Checkbox
                                                    checked={!isTabDenied(permissions[role.id] ?? [], path, tab.key)}
                                                    disabled={!pageGranted}
                                                    onCheckedChange={(c) =>
                                                      toggleTabForRole(role.id, path, tab.key, c === true)
                                                    }
                                                    aria-label={`${role.name} ${navItem?.label ?? path} ${tab.label}`}
                                                  />
                                                </TableCell>
                                              );
                                            })}
                                          </TableRow>
                                        ))}
                                    </Fragment>
                                  );
                                })}
```

- [ ] **Step 6: Type-check + lint**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no new errors in `AccessControl.tsx` (note `Fragment`, `ChevronDown`, `ChevronRight` are already imported).

Run: `npm run lint`
Expected: no new errors from `AccessControl.tsx`.

- [ ] **Step 7: Commit**

```bash
git add src/pages/AccessControl.tsx
git commit -m "feat: matrix Group→Page→Tab with per-role deny toggles" -- src/pages/AccessControl.tsx
```

---

### Task 8: Delete `tabItems.ts` + full verification sweep

**Files:**
- Delete: `src/lib/tabItems.ts`

- [ ] **Step 1: Confirm there are no remaining importers**

Run: `git grep -n "tabItems\|RESTRICTED_TAB\|restrictedTabsFor\|isRestrictedTab" -- src ':!*.test.*'`
Expected: no matches (all consumers migrated in Tasks 2, 3, 7). If any appear, fix them before deleting.

- [ ] **Step 2: Delete the file**

```bash
git rm src/lib/tabItems.ts
```

- [ ] **Step 3: Full type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: PASS (no references to the deleted module).

- [ ] **Step 4: Full frontend test run**

Run: `npx vitest run src/lib/tabRegistry.test.ts src/lib/accessControl.test.ts src/hooks/useAccessibleTabs.test.tsx src/pages/__tests__/SettingsPage.test.tsx`
Expected: PASS across all four files.

- [ ] **Step 5: Server test run**

Run: `cd server && npx jest lib/permissionFilter.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git commit -m "chore: remove obsolete tabItems registry" -- src/lib/tabItems.ts
```

---

### Task 9: Manual end-to-end verification

**Files:** none (manual). Requires both processes running (`npm run dev` + `cd server && npm run dev`).

- [ ] **Step 1: Baseline — tabs visible by default**

As a non-admin role (use DevRoleSwitcher, e.g. `lab`) with access to `/stock`, open Stock: all 5 tabs show. Open `/report`, `/admin-data`, `/settings` (if accessible): all tabs show. Confirms no regression.

- [ ] **Step 2: Deny a tab from the matrix**

As admin → Access Control → Access Matrix. Expand a group, then expand a page that has
tabs (e.g. Stock). Uncheck "ประวัติ" for the `lab` role. Confirm the request
`PUT /LIS/api/access-control/roles/lab/permissions` succeeds and the response
`permissions` array contains `deny:/stock/history` (Network tab).

- [ ] **Step 3: Verify the deny takes effect**

Switch to the `lab` role, open Stock: the "ประวัติ" tab is gone; the other 4 remain; the
active tab is a visible one (not blank).

- [ ] **Step 4: Re-allow**

As admin, re-check "ประวัติ" for `lab`. Response no longer contains the deny token.
Switch to `lab`, open Stock: all 5 tabs return.

- [ ] **Step 5: Page-grant gating of tab checkboxes**

In the matrix, for a role that does NOT have a given page granted, confirm that page's
tab checkboxes render **disabled** (greyed). Grant the page → checkboxes become
enabled.

- [ ] **Step 6: adminOnly tabs stay out of the matrix**

Confirm Settings' LINE / API tabs do NOT appear as rows under `/settings` in the matrix
(they are `adminOnly`), and still render in the Settings page only for admin.

- [ ] **Step 7: Persistence across reload**

Deny a tab, hard-reload the app, confirm the deny survived (loaded from the DB, not just
client state).

---

## Notes for the implementer

- **Behavior flip (expected, accepted):** Settings' "แดชบอร์ด" tab is now visible by
  default to anyone who can open Settings (previously hidden-by-default). Deny it in the
  matrix wherever it should be hidden.
- **No data migration.** Old grant tokens like `/settings/dashboard` in a role's
  permissions or a group's `paths` are inert; `isTabVirtualPath` hides the stale ones
  from the matrix page-row list. Do not write a cleanup migration unless asked.
- After the plan, run `npm run lint` once more over the whole change set and, if the DB
  was touched via UI during manual testing, note that `auto-sync.ps1` / `seed:export`
  handles backup on the prod box (no action needed in dev).
