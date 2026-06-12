# Tab-Level Access Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins restrict individual in-component tabs (no own route) per role/group from the existing Access Control matrix, reusing the path-based model.

**Architecture:** Each lockable tab gets a virtual path `${parentPath}/${key}` registered in a single `tabItems.ts` registry. Unregistered tabs stay open to anyone with parent-page access; registered ("restricted") tabs require their virtual path granted directly (and `others` never grants them). A `useAccessibleTabs` hook filters tabs in each page; `AccessControl.tsx` exposes restricted tabs as indented checkboxes under their parent nav page.

**Tech Stack:** React 18 + TypeScript, TanStack React Query, Radix Tabs (shadcn/ui), Vitest. Access logic in `src/lib/accessControl.ts`, hook gate `useCanAccessPath`.

---

## File Structure

- **Create** `src/lib/tabItems.ts` — registry of restricted tabs + helpers (`RESTRICTED_TABS`, `RESTRICTED_TAB_PATHS`, `tabPath`, `restrictedTabsFor`). Single source of truth.
- **Modify** `src/lib/accessControl.ts` — make `others` deny restricted tab paths so they always require an explicit grant.
- **Create** `src/hooks/useAccessibleTabs.ts` — given a parent path + tab keys, returns visible keys + a safe default key, using `useCanAccessPath`.
- **Modify** `src/pages/SettingsPage.tsx` — first concrete tab page: filter `TabsTrigger`/`TabsContent` and guard the active tab with the hook.
- **Modify** `src/pages/AccessControl.tsx` — render restricted tabs as indented checkboxes under each selected nav page in the group editor.
- **Create/extend tests** — `src/lib/accessControl.test.ts` (restricted-tab rules), `src/hooks/useAccessibleTabs.test.tsx` (fallback default).

Convention for future tab-in-component pages: register tabs in `tabItems.ts`, then gate with `useAccessibleTabs` exactly like SettingsPage.

---

### Task 1: Tab registry (`src/lib/tabItems.ts`)

**Files:**
- Create: `src/lib/tabItems.ts`

- [ ] **Step 1: Create the registry**

```ts
// Tabs that live INSIDE a page (no React Router route of their own) but should be
// lockable per role/group via the Access Control matrix. Each entry maps to a
// "virtual path" `${parent}/${key}` used as a permission key — it is never a real
// route. Add an entry here to make a tab restricted; remove it to leave the tab
// open to anyone who can access the parent page.
export type RestrictedTab = {
  parent: string; // parent nav page path, e.g. "/settings"
  key: string; // Radix Tabs value, e.g. "dashboard"
  label: string; // shown in the Access Control matrix
};

export const RESTRICTED_TABS: RestrictedTab[] = [
  { parent: "/settings", key: "dashboard", label: "ตั้งค่าระบบ — แดชบอร์ด" },
];

export const tabPath = (parent: string, key: string) => `${parent}/${key}`;

export const RESTRICTED_TAB_PATHS = RESTRICTED_TABS.map((t) => tabPath(t.parent, t.key));

export const restrictedTabsFor = (parent: string) =>
  RESTRICTED_TABS.filter((t) => t.parent === parent);

// True if `${parent}/${key}` is a registered restricted tab.
export const isRestrictedTab = (parent: string, key: string) =>
  RESTRICTED_TABS.some((t) => t.parent === parent && t.key === key);
```

> Note: the seed entry (`/settings` → `dashboard`) is an example first lock. After this plan, the user edits this array to choose which tabs are locked.

- [ ] **Step 2: Commit**

```bash
git add src/lib/tabItems.ts
git commit -m "feat: add restricted-tab registry for tab-level access control"
```

---

### Task 2: Enforce restriction in `accessControl.ts`

**Files:**
- Modify: `src/lib/accessControl.ts`
- Test: `src/lib/accessControl.test.ts`

- [ ] **Step 1: Write the failing tests**

Append inside the existing `describe("userCanAccessPath", ...)` block in `src/lib/accessControl.test.ts` (before its closing `});`):

```ts
  it("grants a restricted tab when its exact virtual path is in permissions", () => {
    const user = { role: "lab", status: "active" as const, permissions: ["/settings/dashboard"] };
    expect(userCanAccessPath(user, "/settings/dashboard", groups)).toBe(true);
  });

  it("does not grant a restricted tab from the parent page permission alone", () => {
    const user = { role: "lab", status: "active" as const, permissions: ["/settings"] };
    expect(userCanAccessPath(user, "/settings/dashboard", groups)).toBe(false);
  });

  it("does not let 'others' grant a restricted tab", () => {
    const user = { role: "lab", status: "active" as const, permissions: ["others"] };
    expect(userCanAccessPath(user, "/settings/dashboard", groups)).toBe(false);
  });

  it("still lets 'others' grant a non-restricted in-page path", () => {
    const user = { role: "lab", status: "active" as const, permissions: ["others"] };
    expect(userCanAccessPath(user, "/settings/printers", groups)).toBe(true);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/accessControl.test.ts`
Expected: the 3rd test (`others` grants restricted tab) FAILS — currently `others` returns `true` for `/settings/dashboard` because no group claims it.

- [ ] **Step 3: Implement the guard**

In `src/lib/accessControl.ts`, add the import near the top (after the existing imports):

```ts
import { RESTRICTED_TAB_PATHS } from "./tabItems";
```

Then in the `others` branch of `userCanAccessPath`, deny restricted tab paths first. Replace this block:

```ts
    if (entry === "others") {
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/accessControl.test.ts`
Expected: PASS (all tests, including the 4 new ones).

- [ ] **Step 5: Commit**

```bash
git add src/lib/accessControl.ts src/lib/accessControl.test.ts
git commit -m "feat: restricted tabs require explicit grant, never via 'others'"
```

---

### Task 3: `useAccessibleTabs` hook

**Files:**
- Create: `src/hooks/useAccessibleTabs.ts`
- Test: `src/hooks/useAccessibleTabs.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useAccessibleTabs.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAccessibleTabs } from "./useAccessibleTabs";

// canAccess(path): true for everything except the restricted dashboard tab.
vi.mock("./useCanAccessPath", () => ({
  useCanAccessPath: () => (path: string) => path !== "/settings/dashboard",
}));

describe("useAccessibleTabs", () => {
  const keys = ["environment", "printers", "dashboard"];

  it("hides a restricted tab the user cannot access", () => {
    const { result } = renderHook(() => useAccessibleTabs("/settings", keys));
    expect(result.current.isVisible("dashboard")).toBe(false);
    expect(result.current.isVisible("environment")).toBe(true);
    expect(result.current.visibleKeys).toEqual(["environment", "printers"]);
  });

  it("keeps unregistered tabs visible regardless of canAccess", () => {
    const { result } = renderHook(() => useAccessibleTabs("/settings", ["printers"]));
    // "printers" is not in RESTRICTED_TABS, so it is always visible.
    expect(result.current.isVisible("printers")).toBe(true);
  });

  it("defaultKey is the first visible key", () => {
    const { result } = renderHook(() => useAccessibleTabs("/settings", keys));
    expect(result.current.defaultKey).toBe("environment");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useAccessibleTabs.test.tsx`
Expected: FAIL with "Failed to resolve import ./useAccessibleTabs".

- [ ] **Step 3: Implement the hook**

Create `src/hooks/useAccessibleTabs.ts`:

```ts
import { useMemo } from "react";
import { useCanAccessPath } from "./useCanAccessPath";
import { isRestrictedTab, tabPath } from "@/lib/tabItems";

/**
 * Filters in-component tabs by access. A tab key not registered in RESTRICTED_TABS
 * for `parentPath` is always visible (open tab). A registered (restricted) tab is
 * visible only if the user is granted its virtual path `${parentPath}/${key}`.
 * `defaultKey` is the first visible key — use it to seed/guard the active tab so a
 * user never lands on a hidden tab.
 */
export function useAccessibleTabs(parentPath: string, tabKeys: string[]) {
  const canAccess = useCanAccessPath();

  return useMemo(() => {
    const isVisible = (key: string) =>
      !isRestrictedTab(parentPath, key) || canAccess(tabPath(parentPath, key));
    const visibleKeys = tabKeys.filter(isVisible);
    return { isVisible, visibleKeys, defaultKey: visibleKeys[0] };
  }, [canAccess, parentPath, tabKeys]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/useAccessibleTabs.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAccessibleTabs.ts src/hooks/useAccessibleTabs.test.tsx
git commit -m "feat: useAccessibleTabs hook to gate in-component tabs"
```

---

### Task 4: Gate tabs in `SettingsPage`

**Files:**
- Modify: `src/pages/SettingsPage.tsx:106-184`

- [ ] **Step 1: Import the hook and controlled Tabs state**

At the top of `src/pages/SettingsPage.tsx`, add to the existing React import and add the hook import. Ensure `useState` is imported from `react` (add it if missing) and add:

```ts
import { useAccessibleTabs } from "@/hooks/useAccessibleTabs";
```

- [ ] **Step 2: Compute visible tabs inside the component**

Immediately before the `return (` (around line 95), add:

```tsx
  const TAB_KEYS = ["environment", "printers", "doc-numbers", "instruments", "dashboard"];
  const { isVisible, defaultKey } = useAccessibleTabs("/settings", TAB_KEYS);
  const [activeTab, setActiveTab] = useState<string | undefined>(defaultKey);
  // If the chosen tab becomes hidden (or default resolves late), snap to a visible one.
  const currentTab = activeTab && isVisible(activeTab) ? activeTab : defaultKey;
```

- [ ] **Step 3: Make Tabs controlled and gate each tab**

Change the `<Tabs defaultValue="environment">` opening tag (line 106) to:

```tsx
      <Tabs value={currentTab} onValueChange={setActiveTab}>
```

Wrap each `TabsTrigger` so hidden ones don't render. Replace the `<TabsList>...</TabsList>` block (lines 107-113) with:

```tsx
        <TabsList>
          {isVisible("environment") && (
            <TabsTrigger value="environment">ห้องตรวจสภาพแวดล้อม</TabsTrigger>
          )}
          {isVisible("printers") && (
            <TabsTrigger value="printers">เครื่องพิมพ์เอกสาร</TabsTrigger>
          )}
          {isVisible("doc-numbers") && (
            <TabsTrigger value="doc-numbers">รหัสเอกสาร</TabsTrigger>
          )}
          {isVisible("instruments") && (
            <TabsTrigger value="instruments">เครื่องมือ/API</TabsTrigger>
          )}
          {isVisible("dashboard") && (
            <TabsTrigger value="dashboard">แดชบอร์ด</TabsTrigger>
          )}
        </TabsList>
```

Then guard the restricted content panel: wrap the `dashboard` `TabsContent` (lines 178-183) so a hidden tab's content never mounts:

```tsx
        {isVisible("dashboard") && (
          <TabsContent value="dashboard" className="space-y-3">
            <p className="text-sm text-muted-foreground">
              เลือกว่าจะแสดงส่วนไหน เรียงลำดับอย่างไร และ KPI ใบไหน — แยกตาม role (ค่ามาตรฐานใช้เมื่อ role นั้นยังไม่ตั้งค่า)
            </p>
            <DashboardLayoutConfigCard roles={roleOptions} />
          </TabsContent>
        )}
```

(Other `TabsContent` panels stay as-is — they are unregistered/open tabs.)

- [ ] **Step 4: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no new errors from `SettingsPage.tsx` (repo has ~12 known pre-existing errors; verify none are newly introduced in this file).

- [ ] **Step 5: Commit**

```bash
git add src/pages/SettingsPage.tsx
git commit -m "feat: gate restricted tabs in SettingsPage via useAccessibleTabs"
```

---

### Task 5: Show restricted tabs in the Access Control matrix

**Files:**
- Modify: `src/pages/AccessControl.tsx:151-200`

- [ ] **Step 1: Import the registry**

Add to the imports at the top of `src/pages/AccessControl.tsx`:

```ts
import { restrictedTabsFor, tabPath } from "@/lib/tabItems";
```

- [ ] **Step 2: Render restricted-tab checkboxes under each nav page**

In the `PathPicker` component, the `NAV_ITEMS.map((item) => { ... })` returns either an "owned" row or a `<label>` checkbox row. Wrap each rendered nav row so its restricted tabs follow it, indented, only when the parent page is checked.

Replace the final `return (` of the `.map` callback — the open-tab `<label>...</label>` block (lines 183-199) — with a fragment that adds the tab sub-rows:

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
                {checked &&
                  restrictedTabsFor(item.path).map((tab) => {
                    const tp = tabPath(tab.parent, tab.key);
                    const tabChecked = value.includes(tp);
                    return (
                      <label
                        key={tp}
                        className="ml-6 flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-accent"
                      >
                        <Checkbox
                          checked={tabChecked}
                          disabled={disabled}
                          onCheckedChange={(c) =>
                            onChange(
                              c === true
                                ? [...value, tp]
                                : value.filter((p) => p !== tp),
                            )
                          }
                        />
                        <span className="truncate text-xs text-muted-foreground">↳ {tab.label}</span>
                        <span className="ml-auto truncate font-mono text-[10px] text-muted-foreground">
                          {tp}
                        </span>
                      </label>
                    );
                  })}
              </div>
            );
```

The `key` moves from the `<label>` to the wrapping `<div>` (remove `key={item.path}` from the inner `<label>`).

- [ ] **Step 3: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no new errors from `AccessControl.tsx`.

- [ ] **Step 4: Manual smoke test**

Run frontend + backend (`npm run dev` and `cd server && npm run dev`). In dev, use DevRoleSwitcher:
1. Open `/access-control`, edit a non-admin group, open the page picker, check "ตั้งค่าระบบ" → the indented "↳ ตั้งค่าระบบ — แดชบอร์ด" row appears. Leave it unchecked. Save.
2. Switch to a role in that group (not admin, not `others`-only granting dashboard). Open `/settings` → the "แดชบอร์ด" tab is hidden; the page defaults to "ห้องตรวจสภาพแวดล้อม".
3. Back in `/access-control`, check the "↳ แดชบอร์ด" sub-row, save. Reload `/settings` → "แดชบอร์ด" tab now visible.
4. Confirm admin always sees the tab.

- [ ] **Step 5: Commit**

```bash
git add src/pages/AccessControl.tsx
git commit -m "feat: expose restricted tabs as indented checkboxes in access matrix"
```

---

### Task 6: Final verification

- [ ] **Step 1: Run the full unit suite**

Run: `npx vitest run src/lib/accessControl.test.ts src/hooks/useAccessibleTabs.test.tsx`
Expected: all PASS.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no new lint errors in the five touched files.

- [ ] **Step 3: Type-check the app project**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no new errors introduced by this work (compare against the ~12 known pre-existing errors).
