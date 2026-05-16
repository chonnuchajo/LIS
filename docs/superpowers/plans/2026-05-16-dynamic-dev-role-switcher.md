# Dynamic Dev Role Switcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dev-mode role switcher render buttons dynamically from the backend `roles` list so newly created roles appear and deleted ones disappear without a code change.

**Architecture:** Drop the hardcoded `DEV_USERS` map. The existing `AuthContext` already fetches `/access-control` for the permission matrix — extend that same fetch to capture `roles`, expose them through context, synthesize a dev `AuthUser` per selected role on demand, and have the `DevRoleSwitcher` render one button per backend role. Wire `addRole`/`deleteRole` in the Access Control page to dispatch the existing `lis-access-groups-changed` event so the context refetches.

**Tech Stack:** React 18, TypeScript, Vitest (jsdom + @testing-library/react), Vite. No new dependencies.

**Spec:** [docs/superpowers/specs/2026-05-16-dynamic-dev-role-switcher-design.md](../specs/2026-05-16-dynamic-dev-role-switcher-design.md)

**Conventions note for the implementer:**
- The repo has Vitest configured but only a placeholder test (`src/test/example.test.ts`). There is no established React-component test pattern here. This plan adds a focused unit test for the pure `synthesizeDevUser` helper (it's worth testing in isolation) and relies on lint + build + manual dev-mode verification for the React integration parts, matching the project's actual conventions.
- Use TypeScript path alias `@/*` → `src/*`.
- Commit messages follow the repo's short lowercase style (see `git log --oneline`: "slide Collapsible", "lab dashboard", etc.). Keep them brief.

---

## File Structure

- **Modify** `src/config/dev.ts` — remove `DEV_USERS` and the `DevUser` type. Add `synthesizeDevUser(role)` pure helper.
- **Modify** `src/context/AuthContext.tsx` — fetch `roles` alongside `permissions`, expose `devRoles` on context, build `devUser` via `synthesizeDevUser`, add stale-role guard effect.
- **Modify** `src/components/DevRoleSwitcher.tsx` — drop `ROLE_LABELS` and `DEV_USERS` import; render one button per `devRoles` item using `role.name`.
- **Modify** `src/pages/AccessControl.tsx` — dispatch `lis-access-groups-changed` after successful `addRole` and `deleteRole`.
- **Create** `src/config/dev.test.ts` — unit tests for `synthesizeDevUser`.

---

## Task 1: Add and test `synthesizeDevUser` helper

This is the only pure function in the change. We test-drive it first, then use it from `AuthContext`.

**Files:**
- Modify: `src/config/dev.ts`
- Create: `src/config/dev.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/config/dev.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { synthesizeDevUser } from "./dev";

describe("synthesizeDevUser", () => {
  it("builds a dev AuthUser shape from a role id and name", () => {
    const user = synthesizeDevUser({ id: "qc", name: "QC Reviewer" });

    expect(user).toEqual({
      id: "dev-qc",
      email: "qc.dev@icpladda.com",
      name: "Dev QC Reviewer",
      role: "qc",
      permissions: [],
      department: "QC Reviewer",
      position: "QC Reviewer",
      status: "active",
    });
  });

  it("uses the role id (not name) in email and id fields so custom role names cannot break the email", () => {
    const user = synthesizeDevUser({ id: "custom-role", name: "ผู้ตรวจ" });

    expect(user.id).toBe("dev-custom-role");
    expect(user.email).toBe("custom-role.dev@icpladda.com");
    expect(user.role).toBe("custom-role");
    expect(user.name).toBe("Dev ผู้ตรวจ");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/config/dev.test.ts`
Expected: FAIL with `synthesizeDevUser is not exported from './dev'` (or similar import error).

- [ ] **Step 3: Edit `src/config/dev.ts` — remove `DEV_USERS`, add `synthesizeDevUser`**

Replace the full contents of `src/config/dev.ts` with:

```ts
// Dev mode bypasses Microsoft login and injects a hardcoded user.
// Vite sets import.meta.env.DEV to false for production builds.
export const DEV_MODE =
  import.meta.env.DEV && import.meta.env.VITE_DEV_MODE !== "false";

export const DEV_DEFAULT_ROLE = "admin";

export type DevAuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
  department: string;
  position: string;
  status: "active";
};

export const synthesizeDevUser = (role: { id: string; name: string }): DevAuthUser => ({
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

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/config/dev.test.ts`
Expected: PASS — both test cases green.

- [ ] **Step 5: Commit**

```powershell
git add src/config/dev.ts src/config/dev.test.ts
git commit -m "dev: synthesize dev user from role instead of hardcoded map"
```

---

## Task 2: Wire `AuthContext` and `DevRoleSwitcher` to backend roles

`AuthContext` already fetches `/access-control` and reacts to `lis-access-groups-changed`. We extend the fetch to also capture `roles`, build `devUser` via `synthesizeDevUser`, expose `devRoles` on the context, add a guard that kicks the active dev session back to `admin` if its role got deleted, and update the switcher to render from `devRoles`.

These two files are edited in one task because removing `DEV_USERS` (Task 1) leaves the switcher's import broken — fixing both together keeps every commit green.

**Files:**
- Modify: `src/context/AuthContext.tsx`
- Modify: `src/components/DevRoleSwitcher.tsx`

- [ ] **Step 1: Update the `/access-control` response type and add `devRoles` state**

In `src/context/AuthContext.tsx`, find the existing `loadMatrix` effect (around lines 53-74) and the surrounding state declarations.

**Replace** these existing pieces:

```tsx
import { DEV_MODE, DEV_USERS, DEV_DEFAULT_ROLE } from "@/config/dev";
```

with:

```tsx
import { DEV_MODE, DEV_DEFAULT_ROLE, synthesizeDevUser } from "@/config/dev";
```

**Replace** the existing state declarations near the top of `AuthProvider`:

```tsx
const [devPermissions, setDevPermissions] = useState<Record<string, string[]>>({});
```

with:

```tsx
const [devPermissions, setDevPermissions] = useState<Record<string, string[]>>({});
const [devRoles, setDevRoles] = useState<{ id: string; name: string }[]>([]);
```

- [ ] **Step 2: Update the `loadMatrix` effect to also store roles**

**Replace** the existing dev-mode `useEffect` (currently calling `api.get<{ permissions?: ... }>` and only setting `devPermissions`) with:

```tsx
useEffect(() => {
  if (!DEV_MODE) return;

  let active = true;
  const loadMatrix = () => {
    api
      .get<{
        permissions?: Record<string, string[]>;
        roles?: { id: string; name: string }[];
      }>("/access-control")
      .then((res) => {
        if (!active) return;
        setDevPermissions(res.data.data.permissions ?? {});
        setDevRoles(res.data.data.roles ?? []);
      })
      .catch((err) => {
        console.error("Failed to load access matrix for dev role", err);
      });
  };

  loadMatrix();
  window.addEventListener("lis-access-groups-changed", loadMatrix);
  return () => {
    active = false;
    window.removeEventListener("lis-access-groups-changed", loadMatrix);
  };
}, []);
```

- [ ] **Step 3: Replace `devUser` construction with the synthesized version**

**Replace** the existing `devUser` block (currently using `DEV_USERS[devRole] ?? DEV_USERS[DEV_DEFAULT_ROLE]`) with:

```tsx
const devUser: AuthUser | null = DEV_MODE
  ? (() => {
      const role =
        devRoles.find((r) => r.id === devRole) ??
        devRoles.find((r) => r.id === DEV_DEFAULT_ROLE);
      if (!role) return null;
      const base = synthesizeDevUser(role);
      return {
        ...base,
        permissions: devPermissions[role.id] ?? [],
      };
    })()
  : null;
```

Returning `null` while `devRoles` is still empty (initial paint before the fetch resolves) is intentional and matches the existing `!devRole` early return in `DevRoleSwitcher`.

- [ ] **Step 4: Add the stale-role guard effect**

Add this `useEffect` immediately after the existing `loadMatrix` effect (still inside `AuthProvider`):

```tsx
useEffect(() => {
  if (!DEV_MODE) return;
  if (devRoles.length === 0) return; // not loaded yet — don't kick
  if (devRoles.some((r) => r.id === devRole)) return; // current role still valid
  switchDevRole(DEV_DEFAULT_ROLE);
}, [devRoles, devRole]);
```

(`switchDevRole` is declared earlier in `AuthProvider` and is stable enough for this — it's just two synchronous writes — so we don't add it to the dep array.)

- [ ] **Step 5: Expose `devRoles` through the context value**

**Update** the `AuthContextType` interface near the top of the file:

```tsx
interface AuthContextType {
  user: AuthUser | null;
  login: () => Promise<void>;
  logout: () => void;
  devRole?: string;
  devRoles?: { id: string; name: string }[];
  switchDevRole?: (role: string) => void;
}
```

**Update** the final `AuthContext.Provider` return value (currently `value={{ user, login, logout, devRole: DEV_MODE ? devRole : undefined, switchDevRole: DEV_MODE ? switchDevRole : undefined }}`) to:

```tsx
<AuthContext.Provider
  value={{
    user,
    login,
    logout,
    devRole: DEV_MODE ? devRole : undefined,
    devRoles: DEV_MODE ? devRoles : undefined,
    switchDevRole: DEV_MODE ? switchDevRole : undefined,
  }}
>
  {children}
</AuthContext.Provider>
```

- [ ] **Step 6: Update `DevRoleSwitcher` to consume `devRoles`**

In `src/components/DevRoleSwitcher.tsx`:

**Replace** the import:

```tsx
import { DEV_MODE, DEV_USERS } from "@/config/dev";
```

with:

```tsx
import { DEV_MODE } from "@/config/dev";
```

**Delete** the entire `ROLE_LABELS` constant block (currently lines 5-10):

```tsx
const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  lab: "Lab",
  qc: "QC",
  viewer: "Viewer",
};
```

**Update** the `useAuth()` destructure (currently `const { devRole, switchDevRole } = useAuth();`) to:

```tsx
const { devRole, devRoles, switchDevRole } = useAuth();
```

**Update** the early-return guard (currently `if (!DEV_MODE || !switchDevRole || !devRole) return null;`) to:

```tsx
if (!DEV_MODE || !switchDevRole || !devRole || !devRoles || devRoles.length === 0) return null;
```

**Replace** the button-list block — find:

```tsx
{Object.keys(DEV_USERS).map((role) => (
  <button
    key={role}
    onClick={() => switchDevRole(role)}
    className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
      devRole === role
        ? "bg-orange-500 text-white"
        : "text-gray-600 hover:bg-orange-100"
    }`}
  >
    {ROLE_LABELS[role] ?? role}
  </button>
))}
```

and replace with:

```tsx
{devRoles.map((role) => (
  <button
    key={role.id}
    onClick={() => switchDevRole(role.id)}
    className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
      devRole === role.id
        ? "bg-orange-500 text-white"
        : "text-gray-600 hover:bg-orange-100"
    }`}
  >
    {role.name}
  </button>
))}
```

- [ ] **Step 7: Verify build is clean**

Run: `npm run build`
Expected: PASS — build completes with no TypeScript errors.

- [ ] **Step 8: Verify lint is clean**

Run: `npm run lint`
Expected: no new lint errors introduced by the edited files. (Pre-existing warnings in unrelated files are not the implementer's concern.)

- [ ] **Step 9: Commit**

```powershell
git add src/context/AuthContext.tsx src/components/DevRoleSwitcher.tsx
git commit -m "dev: drive role switcher from backend roles + stale-role guard"
```

---

## Task 3: Notify on role create and delete

`AuthContext`'s `loadMatrix` listens for `lis-access-groups-changed`. The Access Control page already dispatches this event for group changes but not for role create/delete — that's the last bit that makes the flow live.

**Files:**
- Modify: `src/pages/AccessControl.tsx`

- [ ] **Step 1: Dispatch event after successful `addRole`**

In `src/pages/AccessControl.tsx`, find the existing `addRole` function (around lines 317-335). Locate the `toast.success("Role added");` line in the `try` block.

**Insert** `notifyGroupMappingChanged();` immediately before that toast, so the relevant section reads:

```tsx
const res = await api.post<Role>("/access-control/roles", {
  name,
  description: newRole.description.trim(),
});
setRoles((current) => [...current, res.data.data]);
setPermissions((current) => ({ ...current, [res.data.data.id]: [] }));
setNewRole({ name: "", description: "" });
notifyGroupMappingChanged();
toast.success("Role added");
```

- [ ] **Step 2: Dispatch event after successful `deleteRole`**

In the same file, find the existing `deleteRole` function (around lines 337-352). Locate the `toast.success("Role removed");` line in the `try` block.

**Insert** `notifyGroupMappingChanged();` immediately before that toast, so the relevant section reads:

```tsx
await api.delete(`/access-control/roles/${id}`);
setRoles((current) => current.filter((r) => r.id !== id));
setPermissions((current) => {
  const next = { ...current };
  delete next[id];
  return next;
});
notifyGroupMappingChanged();
toast.success("Role removed");
```

- [ ] **Step 3: Verify build still passes**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```powershell
git add src/pages/AccessControl.tsx
git commit -m "access: notify listeners when roles are added or removed"
```

---

## Task 4: Manual verification in dev mode

This is a UI feature. After all code changes are committed, run the dev server and confirm the flow end-to-end. Type-checking and the unit test verify code correctness; only manual use verifies the feature.

**Files:** none modified in this task.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: dev server starts on port 8000 (per `vite.config.ts`). Open the URL it prints (typically `http://localhost:8000/LIS/`).

Note: this requires the backend on `http://localhost:3001` to be running so the `/access-control` proxy returns real data. If the backend isn't available, the switcher will render nothing (no roles loaded) — that is expected behavior, not a bug introduced by this change.

- [ ] **Step 2: Verify the switcher renders the current backend roles**

In the app, look for the orange "DEV MODE" badge (bottom-right by default). Below it should be one button per role currently in the backend — at minimum `Administrator`, plus whatever else exists.

Expected: buttons match the roles shown on the Access Control page's Roles tab.

- [ ] **Step 3: Verify role-create propagates**

Navigate to **Access Control → Roles**. Create a new role (e.g., `name = "Test Role"`).

Expected: a `Test Role` button appears in the DEV MODE switcher within ~1 render (no page refresh needed).

- [ ] **Step 4: Verify role-delete propagates and the stale-role guard fires**

Click the new `Test Role` button in the switcher (active role highlighted orange). Then go back to Access Control and delete `Test Role`.

Expected:
- The `Test Role` button disappears from the switcher.
- The active role highlight moves to `Administrator` (the `DEV_DEFAULT_ROLE`).
- `localStorage.getItem("dev_role")` is now `"admin"` (check in DevTools → Application → Local Storage).

- [ ] **Step 5: Verify production behavior is untouched**

Run: `npm run build`
Expected: PASS.

The `DEV_MODE` constant is `false` in a production build (via `import.meta.env.DEV`), so `AuthProvider`'s dev-mode effects are no-ops and `DevRoleSwitcher` returns `null`. No further manual check needed beyond a clean build.

- [ ] **Step 6: Report back**

Summarize the manual verification result (each substep PASS/FAIL with any unexpected observations). If everything passed, the feature is done. If anything failed, stop and report — do not patch silently.
