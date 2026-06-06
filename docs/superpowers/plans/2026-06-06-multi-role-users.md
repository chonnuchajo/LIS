# Multi-Role Users Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let one user hold several roles at once, with permissions being the union of all their roles and single-behaviour branches resolving to the highest-priority role.

**Architecture:** Add `roles: [String]` to the User model while keeping the legacy `role` string as a computed "primary". A shared role-logic module (`primaryRole`, `unionPermissions`, `normalizeRoles`) is mirrored on frontend (`src/lib/roles.ts`) and backend (`server/lib/roles.js`). Permission resolution everywhere unions over all held roles; single-value branches (Home, redirects, display, petition filtering) use the primary role or "any held role matches".

**Tech Stack:** React 18 + TypeScript + Vite + Vitest (frontend), Express 4 + Mongoose 8 (backend).

**Spec:** `docs/superpowers/specs/2026-06-06-multi-role-users-design.md`

---

## File Structure

**New files:**
- `src/lib/roles.ts` — shared role logic (frontend): `primaryRole`, `unionPermissions`, `normalizeRoles`, `ROLE_PRIORITY`.
- `src/lib/roles.test.ts` — Vitest unit tests for the above.
- `server/lib/roles.js` — backend mirror of the same three functions (CommonJS).

**Modified — backend:**
- `server/models/User.js` — add `roles[]`, keep `role` in sync via `pre('save')`.
- `server/routes/accessControl.js` — union permissions, `roleIds` in/out, multi-role guards.
- `server/routes/auth.js` — SSO assigns into `roles`, response carries `roleIds`.

**Modified — frontend:**
- `src/lib/accessControl.ts` — `AccessUser.roles`, admin/no-role checks via `normalizeRoles`.
- `src/hooks/useCanAccessPath.ts` — effective permissions = union.
- `src/components/PrivateRoute.tsx` — effective permissions = union.
- `src/pages/Home.tsx` — pick home by primary role + union permissions.
- `src/pages/PetitionListPage.tsx` — lab/qc detection over all roles; admin/viewer via roles.
- `src/components/petition/PetitionView.tsx` — `canSeeTestItems` over roles.
- `src/pages/PetitionDetailPage.tsx` — `isAdmin` over roles.
- `src/components/lis/AppSidebar.tsx` — role badges + qc redirect over roles.
- `src/context/AuthContext.tsx` — `AuthUser.roles`, dev multi-role, SSO `roleIds`.
- `src/config/dev.ts` — `DevAuthUser.roles`, primary-derived department.
- `src/components/DevRoleSwitcher.tsx` — multi-select role toggles.
- `src/pages/AccessControl.tsx` — `roleIds`, multi-select editor, role badges.

---

## Task 1: Shared role logic (frontend)

**Files:**
- Create: `src/lib/roles.ts`
- Test: `src/lib/roles.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/roles.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { primaryRole, unionPermissions, normalizeRoles } from "./roles";

describe("primaryRole", () => {
  it("returns viewer for an empty list", () => {
    expect(primaryRole([])).toBe("viewer");
  });

  it("ranks admin highest", () => {
    expect(primaryRole(["viewer", "lab", "admin", "qc"])).toBe("admin");
  });

  it("ranks qc above lab", () => {
    expect(primaryRole(["lab", "qc"])).toBe("qc");
  });

  it("treats qc- and lab- prefixes by family", () => {
    expect(primaryRole(["lab-analyst", "qc-head"])).toBe("qc-head");
  });

  it("ranks a custom role above viewer but below lab", () => {
    expect(primaryRole(["viewer", "production"])).toBe("production");
    expect(primaryRole(["lab", "production"])).toBe("lab");
  });

  it("breaks ties by array order", () => {
    expect(primaryRole(["lab-analyst", "lab-head"])).toBe("lab-analyst");
  });
});

describe("normalizeRoles", () => {
  it("returns roles when present", () => {
    expect(normalizeRoles({ roles: ["lab", "qc"] })).toEqual(["lab", "qc"]);
  });

  it("falls back to legacy single role", () => {
    expect(normalizeRoles({ role: "qc" })).toEqual(["qc"]);
  });

  it("prefers non-empty roles over legacy role", () => {
    expect(normalizeRoles({ role: "viewer", roles: ["admin"] })).toEqual(["admin"]);
  });

  it("returns empty array when nothing is set", () => {
    expect(normalizeRoles({})).toEqual([]);
  });
});

describe("unionPermissions", () => {
  it("unions permissions across roles and de-dupes", () => {
    const byRole = { lab: ["a", "b"], qc: ["b", "c"] };
    expect(unionPermissions(["lab", "qc"], byRole)).toEqual(["a", "b", "c"]);
  });

  it("ignores roles with no permission entry", () => {
    expect(unionPermissions(["lab", "ghost"], { lab: ["a"] })).toEqual(["a"]);
  });

  it("returns empty array for no roles", () => {
    expect(unionPermissions([], { lab: ["a"] })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- src/lib/roles.test.ts`
Expected: FAIL — `Failed to resolve import "./roles"` / functions not defined.

- [ ] **Step 3: Write the implementation**

Create `src/lib/roles.ts`:

```ts
// Shared role logic. One user can hold several roles; permissions are the union
// of every held role, while single-behaviour branches (home, redirects, display)
// resolve to the highest-priority role. Mirrored in server/lib/roles.js — keep
// the two in sync (tests live here).

export interface RoleHolder {
  role?: string;
  roles?: string[];
}

// Higher number = higher priority. admin > qc(-*) > lab(-*) > custom > viewer.
function roleRank(role: string): number {
  if (role === "admin") return 4;
  if (role === "qc" || role.startsWith("qc-") || role.startsWith("qc_")) return 3;
  if (role === "lab" || role.startsWith("lab-") || role.startsWith("lab_")) return 2;
  if (role === "viewer") return 0;
  return 1; // any other custom role
}

/** Highest-priority role in the list, or "viewer" when empty. Ties break by
 *  array order (first wins). */
export function primaryRole(roles: string[]): string {
  if (!roles || roles.length === 0) return "viewer";
  let best = roles[0];
  let bestRank = roleRank(best);
  for (let i = 1; i < roles.length; i += 1) {
    const rank = roleRank(roles[i]);
    if (rank > bestRank) {
      best = roles[i];
      bestRank = rank;
    }
  }
  return best;
}

/** The lazy-migration shim: prefer `roles`, fall back to legacy single `role`. */
export function normalizeRoles(user: RoleHolder | null | undefined): string[] {
  if (!user) return [];
  if (user.roles && user.roles.length > 0) return user.roles;
  if (user.role) return [user.role];
  return [];
}

/** Union of every role's permissions, de-duped, stable order. */
export function unionPermissions(
  roles: string[],
  permsByRole: Record<string, string[]>,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const role of roles) {
    for (const perm of permsByRole[role] ?? []) {
      if (!seen.has(perm)) {
        seen.add(perm);
        out.push(perm);
      }
    }
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- src/lib/roles.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/roles.ts src/lib/roles.test.ts
git commit -m "feat(access): shared role logic (primaryRole, unionPermissions, normalizeRoles)"
```

---

## Task 2: Backend role-logic mirror

**Files:**
- Create: `server/lib/roles.js`

- [ ] **Step 1: Write the implementation**

Create `server/lib/roles.js` (CommonJS mirror of `src/lib/roles.ts`; logic is identical and covered by the frontend tests):

```js
// Mirror of src/lib/roles.ts — keep in sync. One user can hold several roles;
// permissions union over all of them, single-behaviour branches use the primary.

function roleRank(role) {
  if (role === 'admin') return 4;
  if (role === 'qc' || role.startsWith('qc-') || role.startsWith('qc_')) return 3;
  if (role === 'lab' || role.startsWith('lab-') || role.startsWith('lab_')) return 2;
  if (role === 'viewer') return 0;
  return 1;
}

function primaryRole(roles) {
  if (!roles || roles.length === 0) return 'viewer';
  let best = roles[0];
  let bestRank = roleRank(best);
  for (let i = 1; i < roles.length; i += 1) {
    const rank = roleRank(roles[i]);
    if (rank > bestRank) {
      best = roles[i];
      bestRank = rank;
    }
  }
  return best;
}

function normalizeRoles(user) {
  if (!user) return [];
  if (Array.isArray(user.roles) && user.roles.length > 0) return user.roles;
  if (user.role) return [user.role];
  return [];
}

function unionPermissions(roles, permsByRole) {
  const seen = new Set();
  const out = [];
  for (const role of roles) {
    for (const perm of permsByRole[role] || []) {
      if (!seen.has(perm)) {
        seen.add(perm);
        out.push(perm);
      }
    }
  }
  return out;
}

module.exports = { primaryRole, normalizeRoles, unionPermissions };
```

- [ ] **Step 2: Verify it loads**

Run: `node -e "const r=require('./server/lib/roles.js'); console.log(r.primaryRole(['lab','qc']), r.normalizeRoles({role:'viewer',roles:['admin']}), r.unionPermissions(['lab','qc'],{lab:['a','b'],qc:['b','c']}))"`
Expected output: `qc [ 'admin' ] [ 'a', 'b', 'c' ]`

- [ ] **Step 3: Commit**

```bash
git add server/lib/roles.js
git commit -m "feat(access): backend mirror of role logic"
```

---

## Task 3: User model — roles[] field + sync

**Files:**
- Modify: `server/models/User.js`

- [ ] **Step 1: Add the field and sync hook**

In `server/models/User.js`, add `roles` after the `role` line (line 8) and a
`pre('save')` hook that keeps `role` and `roles` consistent. The file already
requires `bcryptjs` and has a `pre('save')` for password — add a SECOND
`pre('save')` (Mongoose runs all registered pre-save hooks).

Add the require at the top (after line 2):

```js
const { primaryRole, normalizeRoles } = require('../lib/roles');
```

Add the field inside the schema (right after the `role:` line):

```js
  roles: { type: [String], default: [] },
```

Add this hook (place it just before `UserSchema.methods.comparePassword`):

```js
// Keep the legacy single `role` and the new `roles[]` consistent. If roles[] is
// set it wins and `role` becomes the primary; if only the legacy `role` is set,
// seed roles[] from it. Lets old single-role docs migrate lazily on next save.
UserSchema.pre('save', function (next) {
  const roles = normalizeRoles(this);
  this.roles = roles;
  this.role = primaryRole(roles);
  next();
});
```

- [ ] **Step 2: Verify the model loads and syncs**

Run:
```bash
node -e "require('dotenv').config({path:'server/.env'}); const m=require('mongoose'); const U=require('./server/models/User'); const u=new U({email:'t@t.co', roles:['lab','qc']}); u.validate().then(()=>{ const d=require('../lib/roles'); }).catch(()=>{}); const doc=new U({email:'x@x.co', role:'qc'}); doc.$isNew=true; console.log('ok');"
```
Expected: prints `ok` with no throw. (Pure load/instantiation check; no DB write.)

> NOTE: If the `dotenv`/path resolution is awkward on Windows, instead just run
> `cd server && node -e "const U=require('./models/User'); console.log(typeof U)"`
> Expected: `function`.

- [ ] **Step 3: Commit**

```bash
git add server/models/User.js
git commit -m "feat(access): User.roles[] with role primary-sync on save"
```

---

## Task 4: accessControl.js — union permissions + roleIds

**Files:**
- Modify: `server/routes/accessControl.js`

- [ ] **Step 1: Require the helpers**

At the top of `server/routes/accessControl.js` (with the other requires), add:

```js
const { primaryRole, normalizeRoles, unionPermissions } = require('../lib/roles');
```

- [ ] **Step 2: Make getRolePermissions union over all roles**

Replace `getRolePermissions` (lines 139–142):

```js
async function getRolePermissions(rolesInput) {
  const roles = normalizeRoles(
    Array.isArray(rolesInput) ? { roles: rolesInput } : { role: rolesInput },
  );
  if (roles.length === 0) roles.push('viewer');
  const roleDocs = await Role.find({ id: { $in: roles } }).lean();
  const permsByRole = Object.fromEntries(roleDocs.map((r) => [r.id, r.permissions || []]));
  return unionPermissions(roles, permsByRole);
}
```

- [ ] **Step 3: Make formatUser carry roleIds**

Replace `formatUser` (lines 144–157):

```js
function formatUser(user, permissions) {
  const roles = normalizeRoles(user);
  return {
    id: user._id.toString(),
    name: user.name || '',
    email: user.email,
    roleId: primaryRole(roles),
    roleIds: roles,
    permissions,
    department: user.department || 'Unassigned',
    position: user.position || 'Unassigned',
    status: user.status || 'active',
    lastActive: user.lastActive || 'Never',
    authProvider: user.authProvider || 'local',
  };
}
```

> NOTE: `GET /` (line 187) calls `users.map(formatUser)` without precomputed
> permissions — that already returns `permissions: undefined` today and the
> frontend recomputes from the matrix. Leave that call as-is; it now also emits
> `roleIds`, which is what the new frontend reads.

- [ ] **Step 4: Accept roleIds when creating a user**

Replace the create-user handler body (lines 197–218) so it accepts `roleIds`
(array) and falls back to legacy `roleId`:

```js
router.post('/users', async (req, res) => {
  try {
    const { name, email, department, position, roleId, roleIds, status } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });

    const requested = Array.isArray(roleIds) && roleIds.length > 0
      ? roleIds
      : [roleId || 'viewer'];
    const found = await Role.find({ id: { $in: requested } });
    if (found.length !== requested.length) {
      return res.status(400).json({ error: 'role not found' });
    }

    const user = await User.create({
      name,
      email,
      department,
      position,
      roles: requested,
      status: status || 'active',
      lastActive: 'Never',
    });
    res.status(201).json(formatUser(user, await getRolePermissions(requested)));
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Email already exists' });
    res.status(400).json({ error: err.message });
  }
});
```

- [ ] **Step 5: Accept roleIds when patching a user**

Replace the `roleId` branch in the patch handler (lines 272–276) with:

```js
    if (req.body.roleIds !== undefined || req.body.roleId !== undefined) {
      const requested = Array.isArray(req.body.roleIds) && req.body.roleIds.length > 0
        ? req.body.roleIds
        : [req.body.roleId];
      const found = await Role.find({ id: { $in: requested } });
      if (found.length !== requested.length) {
        return res.status(400).json({ error: 'role not found' });
      }
      patch.roles = requested;
    }
```

> NOTE: `User.findByIdAndUpdate(..., patch, { new: true })` does NOT run the
> `pre('save')` hook, so `role` won't auto-sync on this path. Set it explicitly:
> after building `patch`, if `patch.roles` is present also set
> `patch.role = primaryRole(patch.roles)`. Add this line right after the block
> above:

```js
    if (patch.roles) patch.role = primaryRole(patch.roles);
```

- [ ] **Step 6: Multi-role aware guards (delete user + delete role)**

In the delete-user handler, replace the admin check (line 290):

```js
    if (normalizeRoles(user).includes('admin')) {
      return res.status(400).json({ error: 'admin users cannot be deleted here' });
    }
```

In the delete-role handler, replace the in-use count (line 316) so a role
attached via either field blocks deletion:

```js
    const users = await User.countDocuments({ $or: [{ role: role.id }, { roles: role.id }] });
```

- [ ] **Step 7: Type-check and verify the route still parses**

Run: `cd server && node -e "require('./routes/accessControl'); console.log('loaded')"`
Expected: `loaded` (no syntax/require errors).

- [ ] **Step 8: Commit**

```bash
git add server/routes/accessControl.js
git commit -m "feat(access): accessControl route unions perms + accepts roleIds"
```

---

## Task 5: auth.js — SSO writes roles, response carries roleIds

**Files:**
- Modify: `server/routes/auth.js`

- [ ] **Step 1: Require helpers and update formatSsoUser**

At the top of `server/routes/auth.js` add (with the other requires):

```js
const { primaryRole, normalizeRoles, unionPermissions } = require('../lib/roles');
```

Replace `getPermissions` (lines 33–36) and `formatSsoUser` (lines 38–49):

```js
async function getPermissions(rolesInput) {
  const roles = normalizeRoles(
    Array.isArray(rolesInput) ? { roles: rolesInput } : { role: rolesInput },
  );
  if (roles.length === 0) roles.push('viewer');
  const roleDocs = await Role.find({ id: { $in: roles } }).lean();
  const permsByRole = Object.fromEntries(roleDocs.map((r) => [r.id, r.permissions || []]));
  return unionPermissions(roles, permsByRole);
}

function formatSsoUser(user, permissions = []) {
  const roles = normalizeRoles(user);
  return {
    id: String(user._id),
    email: user.email,
    name: user.name,
    role: primaryRole(roles),
    roleId: primaryRole(roles),
    roleIds: roles,
    permissions,
    department: user.department,
    position: user.position,
    status: user.status,
  };
}
```

- [ ] **Step 2: SSO existing-user role assignment writes roles[]**

In the SSO existing-user branch, replace line 107 and the following
`getPermissions` call (lines 107–109):

```js
      const currentRoles = normalizeRoles(user);
      const onlyViewer = currentRoles.length === 0 || (currentRoles.length === 1 && currentRoles[0] === 'viewer');
      if (role && onlyViewer) user.roles = [role.id];
      await user.save();
      return res.json(formatSsoUser(user, await getPermissions(normalizeRoles(user))));
```

- [ ] **Step 3: SSO new-user create uses roles[]**

In the SSO create branch (lines 112–123), replace `role: role?.id || 'viewer',`
with:

```js
      roles: [role?.id || 'viewer'],
```

And update the final response (line 125):

```js
    res.status(201).json(formatSsoUser(user, await getPermissions(normalizeRoles(user))));
```

- [ ] **Step 4: Verify the route parses**

Run: `cd server && node -e "require('./routes/auth'); console.log('loaded')"`
Expected: `loaded`.

- [ ] **Step 5: Commit**

```bash
git add server/routes/auth.js
git commit -m "feat(access): SSO assigns into roles[], response carries roleIds"
```

---

## Task 6: accessControl.ts — roles-aware access checks

**Files:**
- Modify: `src/lib/accessControl.ts`
- Test: `src/lib/accessControl.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/accessControl.test.ts` (inside the existing `describe`, before
its closing `});` — or add a new `describe` block at end of file):

```ts
describe("userCanAccessPath with multiple roles", () => {
  it("admin via roles[] bypasses all checks", () => {
    const user = { roles: ["lab", "admin"], status: "active" as const, permissions: [] };
    expect(userCanAccessPath(user, "/anything", groups)).toBe(true);
  });

  it("treats roles[] of lab the same as legacy role lab", () => {
    const user = { roles: ["lab"], status: "active" as const, permissions: ["/report"] };
    expect(userCanAccessPath(user, "/report", groups)).toBe(true);
  });

  it("denies when neither role nor roles is set", () => {
    const user = { status: "active" as const, permissions: ["/report"] };
    expect(userCanAccessPath(user, "/report", groups)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify the admin-via-roles test fails**

Run: `npm run test -- src/lib/accessControl.test.ts`
Expected: FAIL — "admin via roles[] bypasses" returns false (current code only
checks `user.role`).

- [ ] **Step 3: Update accessControl.ts**

In `src/lib/accessControl.ts`:

Add the import at the top (after the existing import on line 1):

```ts
import { normalizeRoles } from "./roles";
```

Add `roles` to the `AccessUser` interface (after `role?: string;` on line 5):

```ts
  roles?: string[];
```

Replace the guard + admin bypass (lines 82–83) inside `userCanAccessPath`:

```ts
  const roles = normalizeRoles(user);
  if (!user || user.status === "inactive" || roles.length === 0) return false;
  if (roles.includes("admin")) return true;
```

> NOTE: `normalizeRoles` handles `user` being null (returns `[]`), but the
> `user.status` read still needs the `!user` guard — keep `!user` first in the
> `||` chain as shown so it short-circuits before `user.status`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- src/lib/accessControl.test.ts`
Expected: PASS (old + new cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/accessControl.ts src/lib/accessControl.test.ts
git commit -m "feat(access): userCanAccessPath honors roles[] (admin bypass, no-role deny)"
```

---

## Task 7: Effective-permission union in the three resolvers

**Files:**
- Modify: `src/hooks/useCanAccessPath.ts:33-40`
- Modify: `src/components/PrivateRoute.tsx:95-105`
- Modify: `src/pages/Home.tsx:71-94` (the effect that sets `permOverride`) and `resolveHomeKind` call site

- [ ] **Step 1: Update useCanAccessPath.ts**

Add import (top of file):

```ts
import { normalizeRoles, unionPermissions } from "@/lib/roles";
```

Replace the `effectiveUser` memo block (lines 33–40):

```ts
  return useMemo(() => {
    const groups = accessControl?.groups ?? [];
    const roles = normalizeRoles(user);
    const permsByRole = accessControl?.permissions ?? {};
    const effectiveUser =
      user && roles.length > 0
        ? { ...user, permissions: unionPermissions(roles, permsByRole) }
        : user;
    return (path: string) => userCanAccessPath(effectiveUser, path, groups);
  }, [accessControl, user]);
```

- [ ] **Step 2: Update PrivateRoute.tsx**

Add import (top of file, with the other `@/lib` imports):

```ts
import { normalizeRoles, unionPermissions } from "@/lib/roles";
```

Replace the `currentUser` construction (lines 103–105):

```ts
  const roles = normalizeRoles(user);
  const currentUser =
    user && roles.length > 0
      ? { ...user, permissions: unionPermissions(roles, accessControl?.permissions ?? {}) }
      : user;
```

> NOTE: the early-return guard on line 95 (`if (!user?.role || ...)`) must also
> accept a user that only has `roles[]`. Replace it with:

```ts
  if (normalizeRoles(user).length === 0 || user?.status === undefined) {
    return null;
  }
```

- [ ] **Step 3: Update Home.tsx**

Add import (top of file):

```ts
import { normalizeRoles, primaryRole, unionPermissions } from "@/lib/roles";
```

Replace the matrix effect's permission line (lines 85–87) so it unions:

```ts
        const roles = normalizeRoles(user);
        if (roles.length > 0 && data.permissions) {
          setPermOverride(unionPermissions(roles, data.permissions));
        }
```

Find where `resolveHomeKind(...)` is called (it takes `role` as first arg) and
pass the primary role. Search for `resolveHomeKind(` and change the role argument
from `user?.role` to:

```ts
primaryRole(normalizeRoles(user))
```

> NOTE: `resolveHomeKind` itself is unchanged — it already derives qc/lab/admin
> from the permission list, which is now the union. Only its `role` argument
> (used for the `=== "admin"` fast-path) switches to the primary role.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in the three modified files.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useCanAccessPath.ts src/components/PrivateRoute.tsx src/pages/Home.tsx
git commit -m "feat(access): union permissions across roles in route/home resolvers"
```

---

## Task 8: Petition pages + sidebar — roles-aware branches

**Files:**
- Modify: `src/pages/PetitionListPage.tsx:77-112`
- Modify: `src/components/petition/PetitionView.tsx:35`
- Modify: `src/pages/PetitionDetailPage.tsx:158`
- Modify: `src/components/lis/AppSidebar.tsx:174,295`

- [ ] **Step 1: PetitionListPage — detect over all roles**

Add import (top of file):

```ts
import { normalizeRoles } from "@/lib/roles";
```

`isLabRole`/`isQcRole` already take a single role string — keep them. Change
`canSeePetition` (lines 85–98) to test ANY held role:

```ts
function canSeePetition(
  petition: Petition,
  user: { email?: string; name?: string; role?: string; roles?: string[] } | null,
): boolean {
  if (!user) return false;
  const roles = normalizeRoles(user);
  if (isOwnSubmission(petition, user)) return true;
  if (isAssignedTo(petition, user)) return true;
  if (RECEIVED_STATUSES.has(petition.status)) {
    if (roles.some(isLabRole)) {
      if (petitionHasLabItems(petition)) return true;
    }
    if (roles.some(isQcRole)) return true;
  }
  return false;
}
```

Replace the role-derived flags (lines 110–112):

```ts
  const roles = normalizeRoles(user);
  const canViewAll = roles.includes('admin');
  const canCreatePetition = canAccess('/petitions/new');
  const canSeeTestItems = roles.length > 0 && roles.some((r) => r !== 'viewer');
```

> NOTE: confirm `Petition`-list `useAuth()` `user` carries `roles`; after Task 9
> it does. The `roles?: string[]` in the `canSeePetition` signature keeps tsc
> happy regardless.

- [ ] **Step 2: PetitionView — canSeeTestItems over roles**

Add import:

```ts
import { normalizeRoles } from "@/lib/roles";
```

Replace line 35:

```ts
  const roles = normalizeRoles(user);
  const canSeeTestItems = roles.length > 0 && roles.some((r) => r !== 'viewer');
```

- [ ] **Step 3: PetitionDetailPage — isAdmin over roles**

Add import:

```ts
import { normalizeRoles } from "@/lib/roles";
```

Replace line 158 (`const isAdmin = user?.role === 'admin';`):

```ts
  const isAdmin = normalizeRoles(user).includes('admin');
```

- [ ] **Step 4: AppSidebar — role badges + qc redirect over roles**

Add import:

```ts
import { normalizeRoles } from "@/lib/roles";
```

Replace `roleLabel` (line 174) to show all roles joined by name:

```ts
  const roleLabel = (() => {
    const roles = normalizeRoles(user);
    if (roles.length === 0) return "No role";
    return roles.map((r) => roleNameById[r] ?? r).join(", ");
  })();
```

Replace the qc redirect target (line 295) — `user?.role === "qc"` becomes "any
held role is qc/qc-*":

```ts
                      ? normalizeRoles(user).some(
                          (r) => r === "qc" || r.startsWith("qc-") || r.startsWith("qc_"),
                        )
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/pages/PetitionListPage.tsx src/components/petition/PetitionView.tsx src/pages/PetitionDetailPage.tsx src/components/lis/AppSidebar.tsx
git commit -m "feat(access): petition pages + sidebar branch over roles[]"
```

---

## Task 9: AuthContext — carry roles, dev multi-role, SSO roleIds

**Files:**
- Modify: `src/context/AuthContext.tsx`
- Modify: `src/config/dev.ts`

- [ ] **Step 1: dev.ts — DevAuthUser.roles + primary-derived department**

In `src/config/dev.ts`:

Add import at top:

```ts
import { primaryRole } from "@/lib/roles";
```

Add `roles` to `DevAuthUser` (after `role: string;` on line 12):

```ts
  roles: string[];
```

Change `synthesizeDevUser` to accept one-or-many roles. Replace the function
(lines 29–38) with a version that takes an array and derives the primary:

```ts
export const synthesizeDevUser = (
  roles: { id: string; name: string }[],
): DevAuthUser => {
  const ids = roles.map((r) => r.id);
  const primaryId = primaryRole(ids);
  const primary = roles.find((r) => r.id === primaryId) ?? roles[0];
  return {
    id: `dev-${primary.id}`,
    email: `${primary.id}.dev@icpladda.com`,
    name: `Dev ${primary.name}`,
    role: primary.id,
    roles: ids,
    permissions: [],
    department: devDepartment(primary.id),
    position: primary.name,
    status: "active",
  };
};
```

> NOTE: `synthesizeDevAssignees` (line 61) calls `synthesizeDevUser(role)` with a
> single role object. Update that call to wrap in an array:
> `synthesizeDevUser([role]).name`.

- [ ] **Step 2: AuthContext — multi dev role state + AuthUser.roles + SSO roleIds**

In `src/context/AuthContext.tsx`:

Add import:

```ts
import { normalizeRoles, primaryRole } from "@/lib/roles";
```

Add `roles` to `AuthUser` (after `role?: string;` on line 12):

```ts
  roles?: string[];
```

Replace the `devRole` state + `switchDevRole` (lines 52–61) with a multi-select
set, migrating the old single `dev_role` key:

```ts
  const [devRoleIds, setDevRoleIds] = useState<string[]>(() => {
    const multi = localStorage.getItem("dev_roles");
    if (multi) {
      try {
        const parsed = JSON.parse(multi);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        /* ignore */
      }
    }
    const single = localStorage.getItem("dev_role");
    return single ? [single] : [DEV_DEFAULT_ROLE];
  });
  const [devPermissions, setDevPermissions] = useState<Record<string, string[]>>({});
  const [devRoles, setDevRoles] = useState<{ id: string; name: string }[]>([]);

  const setDevRolesSelection = (ids: string[]) => {
    const next = ids.length > 0 ? ids : [DEV_DEFAULT_ROLE];
    localStorage.setItem("dev_roles", JSON.stringify(next));
    setDevRoleIds(next);
  };

  // Toggle a single role in/out of the dev selection (used by DevRoleSwitcher).
  const toggleDevRole = (role: string) => {
    setDevRolesSelection(
      devRoleIds.includes(role)
        ? devRoleIds.filter((r) => r !== role)
        : [...devRoleIds, role],
    );
  };
```

Update the context type (lines 24–26) to expose the new shape. Replace those
three lines:

```ts
  devRoleIds?: string[];
  devRoles?: { id: string; name: string }[];
  toggleDevRole?: (role: string) => void;
```

Replace the "prune invalid dev role" effect (lines 94–99) to prune the set:

```ts
  useEffect(() => {
    if (!DEV_MODE) return;
    if (devRoles.length === 0) return; // not loaded yet
    const valid = devRoleIds.filter((id) => devRoles.some((r) => r.id === id));
    if (valid.length === devRoleIds.length) return; // all still valid
    setDevRolesSelection(valid.length > 0 ? valid : [DEV_DEFAULT_ROLE]);
  }, [devRoles, devRoleIds]);
```

Replace the `devUser` builder (lines 101–113):

```ts
  const devUser: AuthUser | null = DEV_MODE
    ? (() => {
        const selected = devRoleIds
          .map((id) => devRoles.find((r) => r.id === id))
          .filter((r): r is { id: string; name: string } => Boolean(r));
        const roleObjs = selected.length > 0
          ? selected
          : devRoles.filter((r) => r.id === DEV_DEFAULT_ROLE);
        if (roleObjs.length === 0) return null;
        const base = synthesizeDevUser(roleObjs);
        return {
          ...base,
          permissions: unionPermissions(base.roles, devPermissions),
        };
      })()
    : null;
```

Add `unionPermissions` to the roles import:

```ts
import { normalizeRoles, primaryRole, unionPermissions } from "@/lib/roles";
```

Replace the non-dev `user` builder role lines (lines 125–126) inside the
`account ? { ... }` object:

```ts
        role: syncedUser?.role,
        roles: syncedUser?.roles,
```

Update the synced (SSO) response type (lines 166–174) to include `roleIds`, and
the `setSyncedUser` block (lines 184–193) to set `roles`:

In the `api.post<{...}>` generic add `roleId: string;` is already there — add
`roleIds?: string[];` to that type literal. Then in `setSyncedUser`:

```ts
        setSyncedUser({
          id: res.data.data.id,
          email: res.data.data.email,
          name: res.data.data.name,
          role: res.data.data.roleId,
          roles: res.data.data.roleIds ?? [res.data.data.roleId],
          permissions: res.data.data.permissions ?? [],
          department: res.data.data.department,
          position: res.data.data.position,
          status: res.data.data.status,
        });
```

Finally update the `AuthContext.Provider value={{ ... }}` to pass the new dev
fields instead of `devRole`/`switchDevRole`. Find the provider value object and
replace those keys with `devRoleIds`, `devRoles`, `toggleDevRole`.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: errors ONLY in `DevRoleSwitcher.tsx` (still uses old `devRole`/`switchDevRole`) — fixed in Task 10. No other errors.

- [ ] **Step 4: Commit**

```bash
git add src/context/AuthContext.tsx src/config/dev.ts
git commit -m "feat(access): AuthContext carries roles[], dev multi-role selection"
```

---

## Task 10: DevRoleSwitcher — multi-select toggles

**Files:**
- Modify: `src/components/DevRoleSwitcher.tsx`
- Modify: `src/config/dev.test.ts` (if it references `synthesizeDevUser` single-arg)

- [ ] **Step 1: Check dev.test.ts for broken calls**

Run: `npm run test -- src/config/dev.test.ts`
Expected: it may FAIL if it calls `synthesizeDevUser(role)` with a single object.
If so, update those calls to pass an array `synthesizeDevUser([role])` and assert
on `.roles`. (If the test doesn't touch `synthesizeDevUser`, skip this step.)

- [ ] **Step 2: Update DevRoleSwitcher to multi-select**

In `src/components/DevRoleSwitcher.tsx`:

Replace the destructure (line 26):

```ts
  const { devRoleIds, devRoles, toggleDevRole } = useAuth();
```

Replace the guard (line 64):

```ts
  if (!DEV_MODE || !toggleDevRole || !devRoleIds || !devRoles || devRoles.length === 0) return null;
```

Replace the buttons block (lines 153–167) so each role is a toggle and multiple
can be active:

```tsx
      <div className="flex flex-wrap gap-1 rounded-md border border-orange-300 bg-white p-1 shadow-md">
        {devRoles.map((role) => {
          const active = devRoleIds.includes(role.id);
          return (
            <button
              key={role.id}
              onClick={() => toggleDevRole(role.id)}
              className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                active
                  ? "bg-orange-500 text-white"
                  : "text-gray-600 hover:bg-orange-100"
              }`}
            >
              {role.name}
            </button>
          );
        })}
      </div>
```

- [ ] **Step 3: Type-check + full test run**

Run: `npx tsc --noEmit`
Expected: no errors anywhere now.

Run: `npm run test`
Expected: all suites pass (roles, accessControl, dev, others green).

- [ ] **Step 4: Commit**

```bash
git add src/components/DevRoleSwitcher.tsx src/config/dev.test.ts
git commit -m "feat(access): DevRoleSwitcher multi-select role toggles"
```

---

## Task 11: AccessControl page — multi-select role editor + badges

**Files:**
- Modify: `src/pages/AccessControl.tsx`

- [ ] **Step 1: AppUser type carries roleIds**

In `src/pages/AccessControl.tsx`, update the `AppUser` type (lines 36–45) — add
`roleIds` and keep `roleId` (primary, for display fallback):

```ts
type AppUser = {
  id: string;
  name: string;
  email: string;
  roleId: string;
  roleIds: string[];
  department: string;
  position: string;
  status: UserStatus;
  lastActive: string;
};
```

- [ ] **Step 2: new-user state holds roleIds**

Replace the `newUser` initial state's `roleId: "viewer"` (line 208) with:

```ts
    roleIds: ["viewer"] as string[],
```

And remove the `roleId: "viewer"` key — search the `useState({` block (lines
203–209) and ensure it reads:

```ts
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    department: "",
    position: "",
    roleIds: ["viewer"] as string[],
  });
```

Update the reset in `addUser` (line 328) similarly:

```ts
      setNewUser({ name: "", email: "", department: "", position: "", roleIds: ["viewer"] });
```

> NOTE: `addUser` posts `{ ...newUser, ... }` (line 322–326). Since `newUser`
> now has `roleIds`, the backend (Task 4) reads it directly — no other change to
> the POST body needed.

- [ ] **Step 3: search filter uses roleIds**

The user search (line 267) does `roleById[user.roleId]?.name...`. Replace with a
match over any assigned role:

```ts
      user.roleIds.some((rid) => roleById[rid]?.name.toLowerCase().includes(query))
```

- [ ] **Step 4: Replace the new-user role Select with a multi-toggle**

Replace the new-user `<Select>` block (lines 770–784) with a row of toggle
buttons (reuses the existing `roles` list; no new imports):

```tsx
                  <div className="flex flex-wrap items-center gap-1 rounded-md border px-2 py-1">
                    {roles.map((role) => {
                      const active = newUser.roleIds.includes(role.id);
                      return (
                        <button
                          key={role.id}
                          type="button"
                          onClick={() =>
                            setNewUser({
                              ...newUser,
                              roleIds: active
                                ? newUser.roleIds.filter((r) => r !== role.id)
                                : [...newUser.roleIds, role.id],
                            })
                          }
                          className={cn(
                            "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                            active
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/70",
                          )}
                        >
                          {role.name}
                        </button>
                      );
                    })}
                  </div>
```

- [ ] **Step 5: Replace the per-row role Select with multi-toggle badges**

Replace the per-user role `<Select>` (lines 856–871) with toggle buttons that
patch `roleIds`:

```tsx
                          <TableCell className="min-w-[160px] sm:min-w-[200px]">
                            <div className="flex flex-wrap items-center gap-1">
                              {roles.map((role) => {
                                const active = user.roleIds.includes(role.id);
                                return (
                                  <button
                                    key={role.id}
                                    type="button"
                                    onClick={() => {
                                      const next = active
                                        ? user.roleIds.filter((r) => r !== role.id)
                                        : [...user.roleIds, role.id];
                                      if (next.length === 0) return; // keep at least one role
                                      updateUser(user.id, { roleIds: next });
                                    }}
                                    className={cn(
                                      "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                                      active
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted text-muted-foreground hover:bg-muted/70",
                                    )}
                                  >
                                    {role.name}
                                  </button>
                                );
                              })}
                            </div>
                          </TableCell>
```

> NOTE: `updateUser` is typed `Partial<AppUser>` (line 293) and PATCHes the body
> straight through (line 297). `{ roleIds: next }` flows to the backend patch
> handler from Task 4. No signature change needed.

- [ ] **Step 6: Defensive — tolerate users without roleIds from older API**

The GET response now includes `roleIds`, but guard against undefined for safety.
Where users are loaded into state (search for `setUsers(res.data.data.users)` or
similar around line 230), the rows now read `user.roleIds`. If the load maps
raw API users, ensure each has `roleIds`. Add a normalization map right where
users are set:

```ts
      setUsers(
        (res.data.data.users as AppUser[]).map((u) => ({
          ...u,
          roleIds: u.roleIds && u.roleIds.length > 0 ? u.roleIds : [u.roleId],
        })),
      );
```

> Find the exact line that sets users from the access-control response and apply
> this mapping there. (The roles list set on line 233 is unrelated.)

- [ ] **Step 7: Type-check + lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: clean (no new warnings in AccessControl.tsx).

- [ ] **Step 8: Commit**

```bash
git add src/pages/AccessControl.tsx
git commit -m "feat(access): AccessControl multi-select role editor + roleIds"
```

---

## Task 12: Full verification + seed export

**Files:** none (verification only)

- [ ] **Step 1: Full type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 2: Full test suite**

Run: `npm run test`
Expected: all suites pass, including `src/lib/roles.test.ts` and the extended
`src/lib/accessControl.test.ts`.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 4: Manual smoke (dev) — describe, don't automate**

With backend (`cd server && npm run dev`) and frontend (`npm run dev`) running:
- In the DevRoleSwitcher, select BOTH `lab` and `qc`. Confirm the sidebar shows
  both role names and that pages gated to either lab or qc are reachable.
- Open Access Control, give a test user two roles, reload, confirm both badges
  persist and the user's permissions reflect the union.

(This step is for the human operator; no command asserted.)

- [ ] **Step 5: Seed export so seed-data reflects any role changes**

Per the project's seed-data backup rule (DB is recoverable from git), run:

Run: `cd server && npm run seed:export`
Expected: `server/seed-data/*.json` updated (e.g. `users.json` now has `roles`).

- [ ] **Step 6: Commit seed export**

```bash
git add server/seed-data
git commit -m "chore(access): seed-data export after multi-role migration"
```

---

## Self-Review Notes (already reconciled)

- **Spec §3 lazy migration:** handled by `normalizeRoles` (frontend + backend) and
  the User `pre('save')` hook (Task 3). `findByIdAndUpdate` bypasses the hook, so
  Task 4 Step 5 sets `role` explicitly.
- **Spec §A delete-role guard:** Task 4 Step 6 counts both `role` and `roles`.
- **Spec §E api.ts payload types:** `api.post`/`api.patch` in AccessControl.tsx are
  generic over the response, and bodies are untyped `unknown`, so sending
  `roleIds` needs no `src/lib/api.ts` change. (The spec's mention of api.ts type
  updates is satisfied by AppUser carrying `roleIds`.)
- **Naming consistency:** `roleIds` (API/DB-facing array), `roles` (in-memory
  AuthUser/RoleHolder array), `primaryRole`/`normalizeRoles`/`unionPermissions`
  used identically across all tasks.
- **Home.tsx:** `resolveHomeKind` unchanged; only its `role` arg becomes the
  primary and its `permissions` arg becomes the union.
