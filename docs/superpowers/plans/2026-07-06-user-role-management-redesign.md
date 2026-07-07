# User & Role Management Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the **Users** and **Roles** tabs of `src/pages/AccessControl.tsx`: role **tags** + search/dept/role/status **filters** + **pagination** + a **side-drawer** role editor; role **cards** with counts, accessible-modules chips, and a 3-dot menu; **delete guard** (UI + server 409) for roles that still have users. Split the 1529-line page into focused components. Groups + Access Matrix tabs stay unchanged.

**Architecture:** `AccessControl.tsx` remains the stateful container (holds `users/roles/groups/permissions` + all mutation handlers, since Groups/Matrix tabs also use them) and delegates the Users/Roles tab BODIES to new presentational components in `src/components/lis/access/*` via props. Pure derivations (filter/paginate/counts/modules) live in `src/lib/accessDerive.ts` and are unit-tested. Server gains a `roleInUse` guard on role delete.

**Tech Stack:** React 18 + TS + Vite + Tailwind + shadcn/ui (Sheet, DropdownMenu, Pagination, Badge, Select, Input, Avatar, Tooltip — all already present) + Vitest/jsdom (frontend) · Express + Mongoose + `node:test` (server).

## Global Constraints

- **ภาษา/สไตล์:** label UI เป็นไทย, คงสไตล์เดิม (ขาว/เทาอ่อน, primary น้ำเงิน, การ์ดมุมมน, เส้นบาง, compact).
- **API เป็น fetch wrapper (ไม่ใช่ axios):** `api.get/post/patch/delete<T>(path, body?)` → `Promise<{ data: { data: T } }>` (อ่านผลที่ `res.data.data`). ไม่มี method เฉพาะ access-control — ใช้ path string ตรงๆ.
- **Data ไม่ใช่ React Query:** AccessControl ใช้ `useState` + `loadAccessControl()`. เก็บ pattern เดิม (optimistic update + normalize `roleIds = roleIds?.length ? roleIds : [roleId]`).
- **Invariant:** user ต้องมีอย่างน้อย 1 role เสมอ (ห้ามติ๊กออกหมด).
- **Delete guard:** UI ซ่อน/disable ปุ่มลบ role เมื่อ `locked` หรือ `userCount>0`; server `DELETE /roles/:id` ตอบ **409** ถ้ายังมี user.
- **ขอบเขต:** แก้เฉพาะ Users + Roles tab. **ห้ามแตะ** Groups (`value="groups"`) และ Access Matrix (`value="matrix"`) tab, permission model, หรือ `PathPicker`.
- **type-check:** `npx tsc -p tsconfig.app.json --noEmit` (root `tsc --noEmit` no-op). lint: `npm run lint`. FE test: `npx vitest run <path>`. server test: `node --test server/lib/<file>.test.js`.
- **git:** commit เฉพาะไฟล์ตัวเองด้วย explicit pathspec (มี committer อื่นในรีโป). ห้าม `npm run build`.

---

## File Structure

**สร้างใหม่:**
- `src/lib/accessDerive.ts` — pure: `filterUsers`, `paginate`, `countUsersInRole`, `rolePermissionCount`, `accessibleModules`, `distinctDepartments`
- `src/lib/accessDerive.test.ts`
- `src/components/lis/access/UserRoleDrawer.tsx` — Sheet (edit/create user: roles/status/employee link)
- `src/components/lis/access/UsersTab.tsx` — toolbar + table(tags) + pagination + drawer
- `src/components/lis/access/RoleCard.tsx` — role card + 3-dot menu (guarded delete)
- `src/components/lis/access/RoleEditDialog.tsx` — create/edit role (name/description)
- `src/components/lis/access/RolesTab.tsx` — create button + grid of RoleCard
- `src/components/lis/access/types.ts` — shared exported types (AppUser/Role/AccessGroup/UserStatus/EmployeeDirectoryEntry) moved out of AccessControl.tsx so the new components import them
- `server/lib/roleUsage.js` + `server/lib/roleUsage.test.js` — `roleInUse(users, roleId)`

**แก้:**
- `src/pages/AccessControl.tsx` — import shared types from `./…/access/types`; add `updateRole` handler + `deleteRole` 409 message; replace Users/Roles `TabsContent` bodies with `<UsersTab/>` / `<RolesTab/>`; remove the now-moved inline add-user row, role-chip cell, and employee dialog
- `server/routes/accessControl.js` — `DELETE /roles/:id` calls `roleInUse` → 409

---

## Task 1: `accessDerive.ts` — pure derivations

**Files:**
- Create: `src/components/lis/access/types.ts`, `src/lib/accessDerive.ts`, `src/lib/accessDerive.test.ts`

**Interfaces:**
- Produces (`types.ts`): `UserStatus`, `AppUser`, `Role`, `AccessGroup`, `EmployeeDirectoryEntry` (verbatim from AccessControl.tsx:36-73).
- Produces (`accessDerive.ts`):
  - `filterUsers(users: AppUser[], f: { search?: string; dept?: string; role?: string; status?: string }): AppUser[]`
  - `paginate<T>(list: T[], page: number, pageSize: number): { items: T[]; total: number; pageCount: number }`
  - `countUsersInRole(users: AppUser[], roleId: string): number`
  - `rolePermissionCount(permissions: Record<string,string[]>, roleId: string): number`
  - `accessibleModules(permissions: Record<string,string[]>, roleId: string, groups: AccessGroup[]): string[]`
  - `distinctDepartments(users: AppUser[]): string[]`

- [ ] **Step 1: Create shared types** — `src/components/lis/access/types.ts`

```ts
export type UserStatus = "active" | "inactive";

export type AppUser = {
  id: string;
  name: string;
  email: string;
  roleId: string;
  roleIds: string[];
  department: string;
  position: string;
  employeeId: string;
  status: UserStatus;
  lastActive: string;
};

export type Role = {
  id: string;
  name: string;
  description: string;
  locked?: boolean;
};

export type AccessGroup = {
  id: string;
  name: string;
  description: string;
  paths: string[];
  locked?: boolean;
  sortOrder?: number;
};

export type EmployeeDirectoryEntry = {
  employeeId: string;
  name: string;
  department: string;
  position: string;
  email: string;
};
```

- [ ] **Step 2: Write the failing test** — `src/lib/accessDerive.test.ts`

```ts
import { describe, it, expect } from "vitest";
import {
  filterUsers, paginate, countUsersInRole, rolePermissionCount,
  accessibleModules, distinctDepartments,
} from "./accessDerive";
import type { AppUser, AccessGroup } from "@/components/lis/access/types";

function u(over: Partial<AppUser>): AppUser {
  return {
    id: "x", name: "Somchai", email: "somchai@icpladda.com", roleId: "qc",
    roleIds: ["qc"], department: "QC", position: "Analyst", employeeId: "E01",
    status: "active", lastActive: "", ...over,
  };
}

describe("filterUsers", () => {
  const users = [
    u({ id: "a", name: "Alice", email: "alice@x.com", employeeId: "E1", department: "QC", roleIds: ["qc"], status: "active" }),
    u({ id: "b", name: "Bob", email: "bob@x.com", employeeId: "E2", department: "Lab", roleIds: ["lab", "qc"], status: "inactive" }),
    u({ id: "c", name: "Carol", email: "carol@x.com", employeeId: "E3", department: "QC", roleIds: ["viewer"], status: "active" }),
  ];
  it("search matches name/email/employeeId (case-insensitive, contains)", () => {
    expect(filterUsers(users, { search: "ali" }).map((x) => x.id)).toEqual(["a"]);
    expect(filterUsers(users, { search: "bob@x" }).map((x) => x.id)).toEqual(["b"]);
    expect(filterUsers(users, { search: "e3" }).map((x) => x.id)).toEqual(["c"]);
  });
  it("dept/role/status filter exactly; empty/undefined skips", () => {
    expect(filterUsers(users, { dept: "QC" }).map((x) => x.id)).toEqual(["a", "c"]);
    expect(filterUsers(users, { role: "qc" }).map((x) => x.id)).toEqual(["a", "b"]);
    expect(filterUsers(users, { status: "inactive" }).map((x) => x.id)).toEqual(["b"]);
    expect(filterUsers(users, {}).length).toBe(3);
  });
  it("combines filters (AND)", () => {
    expect(filterUsers(users, { dept: "QC", status: "active", role: "qc" }).map((x) => x.id)).toEqual(["a"]);
  });
});

describe("paginate", () => {
  const list = [1, 2, 3, 4, 5];
  it("slices the requested page (1-indexed) and reports total+pageCount", () => {
    expect(paginate(list, 1, 2)).toEqual({ items: [1, 2], total: 5, pageCount: 3 });
    expect(paginate(list, 3, 2)).toEqual({ items: [5], total: 5, pageCount: 3 });
  });
  it("clamps out-of-range page to the last page; empty list = 1 page", () => {
    expect(paginate(list, 99, 2).items).toEqual([5]);
    expect(paginate([], 1, 25)).toEqual({ items: [], total: 0, pageCount: 1 });
  });
});

describe("role helpers", () => {
  const users = [u({ roleIds: ["qc"] }), u({ roleIds: ["lab", "qc"] }), u({ roleIds: ["viewer"] })];
  it("countUsersInRole counts membership via roleIds", () => {
    expect(countUsersInRole(users, "qc")).toBe(2);
    expect(countUsersInRole(users, "viewer")).toBe(1);
    expect(countUsersInRole(users, "none")).toBe(0);
  });
  it("rolePermissionCount reads permissions[roleId] length, missing = 0", () => {
    expect(rolePermissionCount({ qc: ["/a", "/b"] }, "qc")).toBe(2);
    expect(rolePermissionCount({}, "qc")).toBe(0);
  });
});

describe("accessibleModules", () => {
  const groups: AccessGroup[] = [
    { id: "g-qc", name: "QC", description: "", paths: ["/qc-testing"] },
    { id: "g-lab", name: "Lab", description: "", paths: ["/lab-testing"] },
  ];
  it("maps group ids to group names, paths to nav labels, dedupes, drops unknown-empty", () => {
    const mods = accessibleModules({ r: ["g-qc", "/petitions", "g-qc"] }, "r", groups);
    expect(mods).toContain("QC");
    expect(mods).toContain("รายการคำร้อง"); // NAV_ITEMS label for /petitions
    expect(mods.filter((m) => m === "QC").length).toBe(1); // deduped
  });
  it("maps the 'others' token to อื่นๆ and returns [] for a role with no perms", () => {
    expect(accessibleModules({ r: ["others"] }, "r", groups)).toEqual(["อื่นๆ"]);
    expect(accessibleModules({}, "r", groups)).toEqual([]);
  });
});

describe("distinctDepartments", () => {
  it("returns unique non-empty departments sorted", () => {
    const users = [u({ department: "QC" }), u({ department: "Lab" }), u({ department: "QC" }), u({ department: "" })];
    expect(distinctDepartments(users)).toEqual(["Lab", "QC"]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/accessDerive.test.ts`
Expected: FAIL — cannot resolve `./accessDerive`

- [ ] **Step 4: Write implementation** — `src/lib/accessDerive.ts`

```ts
import { NAV_ITEMS } from "@/lib/navItems";
import type { AppUser, AccessGroup } from "@/components/lis/access/types";

export function filterUsers(
  users: AppUser[],
  f: { search?: string; dept?: string; role?: string; status?: string },
): AppUser[] {
  const q = (f.search ?? "").trim().toLowerCase();
  return users.filter((u) => {
    if (q) {
      const hay = `${u.name} ${u.email} ${u.employeeId}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.dept && u.department !== f.dept) return false;
    if (f.role && !u.roleIds.includes(f.role)) return false;
    if (f.status && u.status !== f.status) return false;
    return true;
  });
}

export function paginate<T>(list: T[], page: number, pageSize: number): { items: T[]; total: number; pageCount: number } {
  const total = list.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const clamped = Math.min(Math.max(1, page), pageCount);
  const start = (clamped - 1) * pageSize;
  return { items: list.slice(start, start + pageSize), total, pageCount };
}

export function countUsersInRole(users: AppUser[], roleId: string): number {
  return users.filter((u) => u.roleIds.includes(roleId)).length;
}

export function rolePermissionCount(permissions: Record<string, string[]>, roleId: string): number {
  return (permissions[roleId] ?? []).length;
}

const NAV_LABEL_BY_PATH: Record<string, string> = Object.fromEntries(NAV_ITEMS.map((i) => [i.path, i.label]));

export function accessibleModules(
  permissions: Record<string, string[]>,
  roleId: string,
  groups: AccessGroup[],
): string[] {
  const groupName: Record<string, string> = Object.fromEntries(groups.map((g) => [g.id, g.name]));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const perm of permissions[roleId] ?? []) {
    let label: string | undefined;
    if (groupName[perm]) label = groupName[perm];
    else if (NAV_LABEL_BY_PATH[perm]) label = NAV_LABEL_BY_PATH[perm];
    else if (perm === "others") label = "อื่นๆ";
    if (label && !seen.has(label)) {
      seen.add(label);
      out.push(label);
    }
  }
  return out;
}

export function distinctDepartments(users: AppUser[]): string[] {
  return [...new Set(users.map((u) => u.department).filter(Boolean))].sort();
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/accessDerive.test.ts`
Expected: PASS. (If the `รายการคำร้อง` label assertion fails, open `src/lib/navItems.ts` and use the exact label for `/petitions` — do not change the impl, fix the test's expected string to the real label.)

- [ ] **Step 6: Commit**

```bash
git add src/components/lis/access/types.ts src/lib/accessDerive.ts src/lib/accessDerive.test.ts
git commit -m "feat(access): pure accessDerive helpers + shared types"
```

---

## Task 2: Server — `roleInUse` guard on role delete

**Files:**
- Create: `server/lib/roleUsage.js`, `server/lib/roleUsage.test.js`
- Modify: `server/routes/accessControl.js` (the `DELETE /roles/:id` handler)

**Interfaces:**
- Produces: `roleInUse(users, roleId): boolean` (CommonJS). `DELETE /roles/:id` returns `409 { error, userCount }` when the role is still assigned.

- [ ] **Step 1: Write the failing test** — `server/lib/roleUsage.test.js`

```js
const test = require('node:test');
const assert = require('node:assert');
const { roleInUse } = require('./roleUsage');

test('roleInUse true when any user has the role in roleIds', () => {
  const users = [{ roleIds: ['qc'] }, { roleIds: ['lab', 'viewer'] }];
  assert.equal(roleInUse(users, 'lab'), true);
  assert.equal(roleInUse(users, 'qc'), true);
});

test('roleInUse falls back to legacy singular roleId', () => {
  assert.equal(roleInUse([{ roleId: 'qc' }], 'qc'), true);
  assert.equal(roleInUse([{ roleId: 'qc', roleIds: [] }], 'qc'), true);
});

test('roleInUse false when unused / empty', () => {
  assert.equal(roleInUse([{ roleIds: ['qc'] }], 'admin'), false);
  assert.equal(roleInUse([], 'qc'), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test server/lib/roleUsage.test.js`
Expected: FAIL — `Cannot find module './roleUsage'`

- [ ] **Step 3: Write implementation** — `server/lib/roleUsage.js`

```js
function roleInUse(users, roleId) {
  return (users || []).some((u) => {
    const ids = Array.isArray(u.roleIds) && u.roleIds.length ? u.roleIds : (u.roleId ? [u.roleId] : []);
    return ids.includes(roleId);
  });
}

module.exports = { roleInUse };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test server/lib/roleUsage.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Wire into the DELETE route** — `server/routes/accessControl.js`. Add the require near the other requires at the top of the file: `const { roleInUse } = require('../lib/roleUsage');`. Then find the `router.delete('/roles/:id', ...)` handler and, AFTER its existing `locked` guard and BEFORE it actually deletes, insert the usage check:

```js
    const users = await User.find();
    if (roleInUse(users.map((u) => u.toObject()), req.params.id)) {
      const userCount = users.filter((u) => {
        const ids = (u.roleIds && u.roleIds.length) ? u.roleIds : (u.roleId ? [u.roleId] : []);
        return ids.includes(req.params.id);
      }).length;
      return res.status(409).json({ error: 'role has assigned users', userCount });
    }
```

(`User` is already required in this file — it's used by the other user routes. If the DELETE handler is not `async`, make it `async`.)

- [ ] **Step 6: Commit**

```bash
git add server/lib/roleUsage.js server/lib/roleUsage.test.js server/routes/accessControl.js
git commit -m "feat(access): block deleting a role that still has assigned users (409)"
```

---

## Task 3: `UserRoleDrawer` (Sheet — edit/create user)

**Files:**
- Create: `src/components/lis/access/UserRoleDrawer.tsx`

**Interfaces:**
- Consumes: `AppUser`, `Role`, `EmployeeDirectoryEntry`, `UserStatus` (`./types`); shadcn `Sheet*`, `Button`, `Input`, `Checkbox` (`@/components/ui/checkbox`), `Badge`; lucide.
- Produces:
  ```ts
  interface UserRoleDrawerProps {
    open: boolean;
    mode: "create" | "edit";
    user: AppUser | null;
    roles: Role[];
    directory: EmployeeDirectoryEntry[];
    onClose: () => void;
    onCreate: (payload: { name: string; email: string; roleIds: string[] }) => void;
    onUpdate: (id: string, patch: { roleIds?: string[]; status?: UserStatus }) => void;
    onLinkEmployee: (userId: string, employeeId: string) => void;
  }
  ```

- [ ] **Step 1: Write implementation** — `src/components/lis/access/UserRoleDrawer.tsx`

```tsx
import { useEffect, useMemo, useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { UserCircle, Link2 } from "lucide-react";
import type { AppUser, Role, EmployeeDirectoryEntry, UserStatus } from "./types";

interface UserRoleDrawerProps {
  open: boolean;
  mode: "create" | "edit";
  user: AppUser | null;
  roles: Role[];
  directory: EmployeeDirectoryEntry[];
  onClose: () => void;
  onCreate: (payload: { name: string; email: string; roleIds: string[] }) => void;
  onUpdate: (id: string, patch: { roleIds?: string[]; status?: UserStatus }) => void;
  onLinkEmployee: (userId: string, employeeId: string) => void;
}

export default function UserRoleDrawer({
  open, mode, user, roles, directory, onClose, onCreate, onUpdate, onLinkEmployee,
}: UserRoleDrawerProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleIds, setRoleIds] = useState<string[]>(["viewer"]);
  const [status, setStatus] = useState<UserStatus>("active");
  const [empSearch, setEmpSearch] = useState("");
  const [picking, setPicking] = useState(false);

  // Sync local state whenever the drawer opens for a (different) user.
  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && user) {
      setRoleIds(user.roleIds.length ? user.roleIds : [user.roleId]);
      setStatus(user.status);
    } else {
      setName(""); setEmail(""); setRoleIds(["viewer"]); setStatus("active");
    }
    setEmpSearch(""); setPicking(false);
  }, [open, mode, user]);

  const toggleRole = (id: string) => {
    setRoleIds((cur) => {
      const next = cur.includes(id) ? cur.filter((r) => r !== id) : [...cur, id];
      return next.length === 0 ? cur : next; // keep at least one
    });
  };

  const filtered = useMemo(() => {
    const q = empSearch.toLowerCase();
    const matched = q
      ? directory.filter((e) =>
          e.name.toLowerCase().includes(q) ||
          e.employeeId.toLowerCase().includes(q) ||
          e.department.toLowerCase().includes(q))
      : directory;
    return matched.slice(0, 50);
  }, [directory, empSearch]);

  const save = () => {
    if (mode === "create") {
      if (!name.trim() || !email.trim()) return;
      onCreate({ name: name.trim(), email: email.trim(), roleIds });
    } else if (user) {
      onUpdate(user.id, { roleIds, status });
    }
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <UserCircle className="h-5 w-5 text-primary" />
            {mode === "create" ? "เพิ่มผู้ใช้" : user?.name}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-5 py-4">
          {mode === "create" ? (
            <div className="space-y-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อ-นามสกุล" />
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@icpladda.com" />
            </div>
          ) : (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <p className="font-medium">{user?.email}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {user?.department || "—"} · {user?.position || "—"}
              </p>
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-medium">บทบาท (Role)</p>
            <div className="space-y-1.5">
              {roles.map((role) => (
                <label key={role.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 cursor-pointer">
                  <Checkbox checked={roleIds.includes(role.id)} onCheckedChange={() => toggleRole(role.id)} />
                  <span className="text-sm">{role.name}</span>
                  {role.locked ? <Badge variant="gray-soft" className="text-[10px]">locked</Badge> : null}
                </label>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">ต้องมีอย่างน้อย 1 บทบาท</p>
          </div>

          {mode === "edit" && (
            <div>
              <p className="mb-2 text-sm font-medium">สถานะ</p>
              <div className="flex gap-2">
                {(["active", "inactive"] as UserStatus[]).map((s) => (
                  <Button key={s} type="button" size="sm"
                    variant={status === s ? "default" : "outline"}
                    onClick={() => setStatus(s)}>
                    {s === "active" ? "ใช้งาน" : "ปิดใช้งาน"}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {mode === "edit" && user && (
            <div>
              <p className="mb-2 text-sm font-medium flex items-center gap-1.5">
                <Link2 className="h-4 w-4 text-muted-foreground" /> ผูกพนักงาน
              </p>
              {!picking ? (
                <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                  <span className={user.employeeId ? "" : "text-muted-foreground"}>
                    {user.employeeId ? `รหัส ${user.employeeId}` : "ยังไม่ได้ผูก"}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setPicking(true)}>
                    {user.employeeId ? "เปลี่ยน" : "ผูก"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input value={empSearch} autoFocus onChange={(e) => setEmpSearch(e.target.value)}
                    placeholder="ค้นหาชื่อ / รหัส / แผนก..." />
                  <div className="max-h-56 overflow-y-auto space-y-1 rounded-md border p-1">
                    {filtered.length === 0 ? (
                      <p className="py-4 text-center text-sm text-muted-foreground">ไม่พบพนักงาน</p>
                    ) : filtered.map((e) => (
                      <button key={e.employeeId} type="button"
                        onClick={() => { onLinkEmployee(user.id, e.employeeId); setPicking(false); }}
                        className="w-full rounded px-3 py-2 text-left text-sm hover:bg-accent transition-colors">
                        <span className="font-medium">{e.name}</span>
                        <span className="text-muted-foreground"> ({e.employeeId}) · {e.department}</span>
                      </button>
                    ))}
                  </div>
                  {user.employeeId && (
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                      onClick={() => { onLinkEmployee(user.id, ""); setPicking(false); }}>
                      ยกเลิกการผูก
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <SheetFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={save} disabled={mode === "create" && (!name.trim() || !email.trim())}>บันทึก</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors in `UserRoleDrawer.tsx`. (Working tree has unrelated concurrent edits — ignore errors in files you didn't touch. Verify `@/components/ui/checkbox` exports `Checkbox`; it's used elsewhere in AccessControl already.)
```bash
git add src/components/lis/access/UserRoleDrawer.tsx
git commit -m "feat(access): UserRoleDrawer (Sheet) for editing/creating a user"
```

---

## Task 4: `UsersTab`

**Files:**
- Create: `src/components/lis/access/UsersTab.tsx`

**Interfaces:**
- Consumes: `AppUser`, `Role`, `EmployeeDirectoryEntry`, `UserStatus` (`./types`); `filterUsers`/`paginate`/`distinctDepartments` (`@/lib/accessDerive`); `UserRoleDrawer`; shadcn `Table*`, `Input`, `Select*`, `Badge`, `Button`, `Avatar*`, `DropdownMenu*`; lucide.
- Produces:
  ```ts
  interface UsersTabProps {
    users: AppUser[];
    roles: Role[];
    directory: EmployeeDirectoryEntry[];
    syncing: boolean;
    onCreate: (payload: { name: string; email: string; roleIds: string[] }) => void;
    onUpdate: (id: string, patch: { roleIds?: string[]; status?: UserStatus }) => void;
    onDelete: (id: string) => void;
    onLinkEmployee: (userId: string, employeeId: string) => void;
    onSync: () => void;
  }
  ```

- [ ] **Step 1: Write implementation** — `src/components/lis/access/UsersTab.tsx`

```tsx
import { useMemo, useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Plus, MoreVertical, Trash2 } from "lucide-react";
import { filterUsers, paginate, distinctDepartments } from "@/lib/accessDerive";
import type { AppUser, Role, EmployeeDirectoryEntry, UserStatus } from "./types";
import UserRoleDrawer from "./UserRoleDrawer";

const ALL = "__all__";
const PAGE_SIZES = [25, 50, 100];

interface UsersTabProps {
  users: AppUser[];
  roles: Role[];
  directory: EmployeeDirectoryEntry[];
  syncing: boolean;
  onCreate: (payload: { name: string; email: string; roleIds: string[] }) => void;
  onUpdate: (id: string, patch: { roleIds?: string[]; status?: UserStatus }) => void;
  onDelete: (id: string) => void;
  onLinkEmployee: (userId: string, employeeId: string) => void;
  onSync: () => void;
}

export default function UsersTab({
  users, roles, directory, syncing, onCreate, onUpdate, onDelete, onLinkEmployee, onSync,
}: UsersTabProps) {
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState(ALL);
  const [role, setRole] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [drawer, setDrawer] = useState<{ open: boolean; mode: "create" | "edit"; user: AppUser | null }>(
    { open: false, mode: "create", user: null });

  const roleName = useMemo(() => Object.fromEntries(roles.map((r) => [r.id, r.name])), [roles]);
  const departments = useMemo(() => distinctDepartments(users), [users]);

  const filtered = useMemo(() => filterUsers(users, {
    search,
    dept: dept === ALL ? undefined : dept,
    role: role === ALL ? undefined : role,
    status: status === ALL ? undefined : status,
  }), [users, search, dept, role, status]);

  const resetPage = () => setPage(1);
  const { items, total, pageCount } = paginate(filtered, page, pageSize);

  const openEdit = (u: AppUser) => setDrawer({ open: true, mode: "edit", user: u });
  const openCreate = () => setDrawer({ open: true, mode: "create", user: null });

  return (
    <Card>
      <CardHeader className="gap-3 pb-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className="text-base">จัดการผู้ใช้</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onSync} disabled={syncing}>
              {syncing ? "กำลัง Sync..." : "Sync พนักงาน"}
            </Button>
            <Button size="sm" className="gap-1.5" onClick={openCreate}>
              <Plus className="h-4 w-4" /> เพิ่มผู้ใช้
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); resetPage(); }}
              placeholder="ค้นหา ชื่อ/อีเมล/รหัสพนักงาน" className="pl-9" />
          </div>
          <FilterSelect value={dept} onChange={(v) => { setDept(v); resetPage(); }} allLabel="ทุกแผนก"
            options={departments.map((d) => ({ value: d, label: d }))} width="w-40" />
          <FilterSelect value={role} onChange={(v) => { setRole(v); resetPage(); }} allLabel="ทุกบทบาท"
            options={roles.map((r) => ({ value: r.id, label: r.name }))} width="w-40" />
          <FilterSelect value={status} onChange={(v) => { setStatus(v); resetPage(); }} allLabel="ทุกสถานะ"
            options={[{ value: "active", label: "ใช้งาน" }, { value: "inactive", label: "ปิดใช้งาน" }]} width="w-36" />
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ผู้ใช้</TableHead>
                <TableHead className="hidden md:table-cell">แผนก · ตำแหน่ง</TableHead>
                <TableHead>บทบาท</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead className="hidden lg:table-cell">ล่าสุด</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">ไม่พบผู้ใช้</TableCell></TableRow>
              ) : items.map((u) => (
                <TableRow key={u.id} className="cursor-pointer" onClick={() => openEdit(u)}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8"><AvatarFallback>{u.name.slice(0, 1)}</AvatarFallback></Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{u.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{u.department || "—"} · {u.position || "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {u.roleIds.length ? u.roleIds.map((rid) => (
                        <Badge key={rid} variant="secondary" className="text-[11px]">{roleName[rid] ?? rid}</Badge>
                      )) : <span className="text-xs text-muted-foreground">—</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.status === "active" ? "green-soft" : "gray-soft"}>
                      {u.status === "active" ? "ใช้งาน" : "ปิดใช้งาน"}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{u.lastActive || "—"}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="เมนู"><MoreVertical className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(u)}>แก้ไข</DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          disabled={u.roleId === "admin"}
                          onClick={() => onDelete(u.id)}>
                          <Trash2 className="mr-2 h-4 w-4" /> ลบผู้ใช้
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-2 border-t px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="text-muted-foreground">ทั้งหมด {total} คน</span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹</Button>
              <span className="tabular-nums">{Math.min(page, pageCount)} / {pageCount}</span>
              <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>›</Button>
            </div>
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); resetPage(); }}>
              <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((s) => <SelectItem key={s} value={String(s)}>ต่อหน้า {s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>

      <UserRoleDrawer
        open={drawer.open}
        mode={drawer.mode}
        user={drawer.user}
        roles={roles}
        directory={directory}
        onClose={() => setDrawer((d) => ({ ...d, open: false }))}
        onCreate={onCreate}
        onUpdate={onUpdate}
        onLinkEmployee={onLinkEmployee}
      />
    </Card>
  );
}

function FilterSelect({ value, onChange, allLabel, options, width }: {
  value: string; onChange: (v: string) => void; allLabel: string;
  options: { value: string; label: string }[]; width: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`h-9 ${width}`}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
```

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors in `UsersTab.tsx`. (Confirm `@/components/ui/avatar` exports `Avatar`/`AvatarFallback` and `dropdown-menu` exports the used names — both confirmed present.)
```bash
git add src/components/lis/access/UsersTab.tsx
git commit -m "feat(access): UsersTab with role tags, filters, pagination, drawer"
```

---

## Task 5: `RoleEditDialog` + `RoleCard` + `RolesTab`

**Files:**
- Create: `src/components/lis/access/RoleEditDialog.tsx`, `src/components/lis/access/RoleCard.tsx`, `src/components/lis/access/RolesTab.tsx`

**Interfaces:**
- Consumes: `Role`, `AppUser`, `AccessGroup` (`./types`); `countUsersInRole`/`rolePermissionCount`/`accessibleModules` (`@/lib/accessDerive`); shadcn `Dialog*`, `DropdownMenu*`, `Tooltip*`, `Card*`, `Badge`, `Button`, `Input`; lucide.
- Produces:
  - `RoleEditDialog({ open, mode, role, onClose, onSubmit }: { open: boolean; mode: "create"|"edit"; role: Role | null; onClose: () => void; onSubmit: (values: { name: string; description: string }) => void })`
  - `RoleCard({ role, userCount, permCount, modules, onEdit, onDelete }: { role: Role; userCount: number; permCount: number; modules: string[]; onEdit: () => void; onDelete: () => void })`
  - `RolesTab({ roles, users, permissions, groups, onCreate, onUpdate, onDelete }: { roles: Role[]; users: AppUser[]; permissions: Record<string,string[]>; groups: AccessGroup[]; onCreate: (v:{name:string;description:string})=>void; onUpdate:(id:string,v:{name:string;description:string})=>void; onDelete:(id:string)=>void })`

- [ ] **Step 1: Write `RoleEditDialog.tsx`**

```tsx
import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Role } from "./types";

interface Props {
  open: boolean;
  mode: "create" | "edit";
  role: Role | null;
  onClose: () => void;
  onSubmit: (values: { name: string; description: string }) => void;
}

export default function RoleEditDialog({ open, mode, role, onClose, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(mode === "edit" && role ? role.name : "");
    setDescription(mode === "edit" && role ? role.description : "");
  }, [open, mode, role]);

  const submit = () => {
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), description: description.trim() });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{mode === "create" ? "สร้าง Role" : "แก้ไข Role"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อ Role" autoFocus />
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="คำอธิบาย" />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={submit} disabled={!name.trim()}>บันทึก</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Write `RoleCard.tsx`**

```tsx
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { MoreVertical, Users, KeyRound, Trash2 } from "lucide-react";
import type { Role } from "./types";

interface Props {
  role: Role;
  userCount: number;
  permCount: number;
  modules: string[];
  onEdit: () => void;
  onDelete: () => void;
}

export default function RoleCard({ role, userCount, permCount, modules, onEdit, onDelete }: Props) {
  const [confirm, setConfirm] = useState(false);
  const deletable = !role.locked && userCount === 0;
  const shown = modules.slice(0, 5);
  const extra = modules.length - shown.length;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2 pb-3">
        <div className="min-w-0">
          <CardTitle className="text-base flex items-center gap-2">
            {role.name}
            {role.locked ? <Badge variant="gray-soft" className="text-[10px]">locked</Badge> : null}
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{role.description || "—"}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="เมนู"><MoreVertical className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>แก้ไข</DropdownMenuItem>
            {!role.locked && (
              <>
                <DropdownMenuSeparator />
                {userCount > 0 ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        {/* span wrapper so the disabled item still shows a tooltip */}
                        <span>
                          <DropdownMenuItem disabled className="text-destructive focus:text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> ลบ
                          </DropdownMenuItem>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>มีผู้ใช้ {userCount} คนอยู่</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setConfirm(true)}>
                    <Trash2 className="mr-2 h-4 w-4" /> ลบ
                  </DropdownMenuItem>
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-4 text-sm">
          <span className="inline-flex items-center gap-1 text-muted-foreground"><Users className="h-3.5 w-3.5" /> {userCount} คน</span>
          <span className="inline-flex items-center gap-1 text-muted-foreground"><KeyRound className="h-3.5 w-3.5" /> {permCount} สิทธิ์</span>
        </div>
        {modules.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <span className="text-xs text-muted-foreground mr-1">โมดูล:</span>
            {shown.map((m) => <Badge key={m} variant="outline" className="text-[11px]">{m}</Badge>)}
            {extra > 0 ? <Badge variant="outline" className="text-[11px]">+{extra}</Badge> : null}
          </div>
        )}
      </CardContent>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>ลบ Role “{role.name}”?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">การลบนี้ย้อนกลับไม่ได้</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirm(false)}>ยกเลิก</Button>
            <Button variant="destructive" onClick={() => { onDelete(); setConfirm(false); }}>ลบ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
```

- [ ] **Step 3: Write `RolesTab.tsx`**

```tsx
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { countUsersInRole, rolePermissionCount, accessibleModules } from "@/lib/accessDerive";
import type { Role, AppUser, AccessGroup } from "./types";
import RoleCard from "./RoleCard";
import RoleEditDialog from "./RoleEditDialog";

interface Props {
  roles: Role[];
  users: AppUser[];
  permissions: Record<string, string[]>;
  groups: AccessGroup[];
  onCreate: (v: { name: string; description: string }) => void;
  onUpdate: (id: string, v: { name: string; description: string }) => void;
  onDelete: (id: string) => void;
}

export default function RolesTab({ roles, users, permissions, groups, onCreate, onUpdate, onDelete }: Props) {
  const [dialog, setDialog] = useState<{ open: boolean; mode: "create" | "edit"; role: Role | null }>(
    { open: false, mode: "create", role: null });

  const cards = useMemo(() => roles.map((role) => ({
    role,
    userCount: countUsersInRole(users, role.id),
    permCount: rolePermissionCount(permissions, role.id),
    modules: accessibleModules(permissions, role.id, groups),
  })), [roles, users, permissions, groups]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5" onClick={() => setDialog({ open: true, mode: "create", role: null })}>
          <Plus className="h-4 w-4" /> สร้าง Role
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ role, userCount, permCount, modules }) => (
          <RoleCard
            key={role.id}
            role={role}
            userCount={userCount}
            permCount={permCount}
            modules={modules}
            onEdit={() => setDialog({ open: true, mode: "edit", role })}
            onDelete={() => onDelete(role.id)}
          />
        ))}
      </div>
      <RoleEditDialog
        open={dialog.open}
        mode={dialog.mode}
        role={dialog.role}
        onClose={() => setDialog((d) => ({ ...d, open: false }))}
        onSubmit={(v) => { if (dialog.mode === "create") onCreate(v); else if (dialog.role) onUpdate(dialog.role.id, v); }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Type-check + commit**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors in the 3 new files.
```bash
git add src/components/lis/access/RoleEditDialog.tsx src/components/lis/access/RoleCard.tsx src/components/lis/access/RolesTab.tsx
git commit -m "feat(access): RolesTab + RoleCard (counts/modules/3-dot menu) + RoleEditDialog"
```

---

## Task 6: Integrate into `AccessControl.tsx` (slim + wire + remove dead code)

**Files:**
- Modify: `src/pages/AccessControl.tsx`

**Interfaces:**
- Consumes: `UsersTab`, `RolesTab` (`@/components/lis/access/*`); shared types from `@/components/lis/access/types`.

- [ ] **Step 1: Point AccessControl at the shared types.** In `src/pages/AccessControl.tsx`, DELETE the local `type UserStatus/AppUser/Role/AccessGroup/EmployeeDirectoryEntry` definitions (lines 36-73) and instead import them: `import type { UserStatus, AppUser, Role, AccessGroup, EmployeeDirectoryEntry } from "@/components/lis/access/types";`. Keep the local `AccessControlState`, `defaultRoles`, `defaultUsers`, `defaultPermissions`.

- [ ] **Step 2: Add the `updateRole` handler.** Near the existing `addRole`/`deleteRole` handlers, add (the server route `PATCH /roles/:id` from the dashboard feature already accepts `{ name, description }`):

```tsx
  const updateRole = async (id: string, patch: { name: string; description: string }) => {
    try {
      const res = await api.patch<Role>(`/access-control/roles/${id}`, patch);
      setRoles((current) => current.map((r) => (r.id === id ? { ...r, ...res.data.data } : r)));
      notifyGroupMappingChanged();
      toast.success("Role updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update role");
    }
  };
```

- [ ] **Step 3: Surface the 409 on delete.** Replace the `deleteRole` catch body so the server's "assigned users" message reaches the user. Read `fetchApi` in `src/lib/api.ts` to confirm the thrown error's shape, then set the toast to prefer the server message:

```tsx
    } catch (err) {
      const anyErr = err as { response?: { data?: { error?: string; userCount?: number } }; message?: string };
      const serverMsg = anyErr.response?.data?.error;
      const count = anyErr.response?.data?.userCount;
      toast.error(
        serverMsg === "role has assigned users"
          ? `ลบไม่ได้: ยังมีผู้ใช้${count ? ` ${count} คน` : ""}ใช้ role นี้อยู่`
          : (serverMsg ?? (err instanceof Error ? err.message : "Failed to remove role")),
      );
    }
```

(Keep the rest of `deleteRole` — the `role?.locked` early-return and the success-path state updates — unchanged.)

- [ ] **Step 4: Replace the Users tab body.** Swap the entire `<TabsContent value="users">…</TabsContent>` block (the old CardHeader/search/add-row/Table, ~lines 858-1055) with:

```tsx
          <TabsContent value="users">
            <UsersTab
              users={filteredUsersBySearchRemoved /* see note */ ? users : users}
              roles={roles}
              directory={directory}
              syncing={syncing}
              onCreate={(payload) => addUserFromDrawer(payload)}
              onUpdate={(id, patch) => updateUser(id, patch)}
              onDelete={(id) => deleteUser(id)}
              onLinkEmployee={(userId, employeeId) => linkEmployee(userId, employeeId)}
              onSync={syncEmployees}
            />
          </TabsContent>
```

Simplify to just `users={users}` (UsersTab does its own filtering now). And add a thin `addUserFromDrawer` adapter next to `addUser` (the drawer sends `{name,email,roleIds}`; the existing `addUser` reads from `newUser` state — write a parameterized version):

```tsx
  const addUserFromDrawer = async (payload: { name: string; email: string; roleIds: string[] }) => {
    if (!payload.name.trim() || !payload.email.trim()) { toast.error("ต้องกรอกชื่อและอีเมล"); return; }
    try {
      const res = await api.post<AppUser>("/access-control/users", {
        name: payload.name, email: payload.email, department: "Unassigned", position: "Unassigned", roleIds: payload.roleIds,
      });
      const added = res.data.data;
      const normalized = { ...added, roleIds: added.roleIds && added.roleIds.length ? added.roleIds : [added.roleId] };
      setUsers((current) => [...current, normalized]);
      toast.success("เพิ่มผู้ใช้แล้ว");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add user");
    }
  };
```

Final Users tab body:

```tsx
          <TabsContent value="users">
            <UsersTab
              users={users}
              roles={roles}
              directory={directory}
              syncing={syncing}
              onCreate={addUserFromDrawer}
              onUpdate={updateUser}
              onDelete={deleteUser}
              onLinkEmployee={linkEmployee}
              onSync={syncEmployees}
            />
          </TabsContent>
```

- [ ] **Step 5: Replace the Roles tab body.** Swap `<TabsContent value="roles">…</TabsContent>` (~lines 1057-1113) with:

```tsx
          <TabsContent value="roles">
            <RolesTab
              roles={roles}
              users={users}
              permissions={permissions}
              groups={groups}
              onCreate={(v) => addRoleFromDialog(v)}
              onUpdate={updateRole}
              onDelete={deleteRole}
            />
          </TabsContent>
```

Add an `addRoleFromDialog` adapter next to `addRole` (dialog passes `{name,description}`; existing `addRole` reads `newRole` state):

```tsx
  const addRoleFromDialog = async (v: { name: string; description: string }) => {
    if (!v.name.trim()) { toast.error("ต้องกรอกชื่อ Role"); return; }
    try {
      const res = await api.post<Role>("/access-control/roles", { name: v.name, description: v.description });
      setRoles((current) => [...current, res.data.data]);
      setPermissions((current) => ({ ...current, [res.data.data.id]: [] }));
      notifyGroupMappingChanged();
      toast.success("เพิ่ม Role แล้ว");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add role");
    }
  };
```

- [ ] **Step 6: Remove now-dead code.** Delete from `AccessControl.tsx`: the old `newUser` state + `addUser` (replaced by `addUserFromDrawer`), the old `newRole` state + `addRole` (replaced by `addRoleFromDialog`), the old top-level `search`/`filteredUsers` (moved into UsersTab), and the **employee link Dialog** block (`lines ~1461-1524`) plus its `linkingUserId`/`employeeSearch`/`filteredDirectory` state that only served it (the drawer now embeds employee picking; `linkEmployee` handler STAYS — it's passed to the drawer). Add the two new imports: `import UsersTab from "@/components/lis/access/UsersTab";` and `import RolesTab from "@/components/lis/access/RolesTab";`. Leave Groups (`value="groups"`) and Access Matrix (`value="matrix"`) TabsContent and all their state/handlers untouched.

- [ ] **Step 7: Full verification**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no NEW errors from your files. Any error naming a symbol you removed (e.g. `filteredUsers`, `newUser`, `linkingUserId`) means a leftover reference in the Users/Roles area — remove it. Do NOT touch Groups/Matrix references. (Pre-existing/concurrent errors in unrelated files are not yours.)
Run: `npm run lint` — no NEW lint errors from `src/components/lis/access/*` or `AccessControl.tsx`.
Run: `npx vitest run src/lib/accessDerive.test.ts` and `node --test server/lib/roleUsage.test.js` — all pass.

- [ ] **Step 8: Manual E2E (browser, per project convention)**

`npm run dev` + `cd server && npm run dev`. On `/access-control`: (1) Users — search by name/email/รหัส, filter by แผนก/บทบาท/สถานะ, paginate, click a row → drawer edits roles (≥1 enforced) + status + employee link → save reflects in table; "+ เพิ่มผู้ใช้" creates via drawer; role column shows tags; delete via ⋮. (2) Roles — cards show counts + module chips; ⋮ → แก้ไข updates name/desc; "สร้าง Role" adds; delete hidden on locked (admin), disabled with tooltip when userCount>0, works when 0. Confirm Groups + Access Matrix tabs still function unchanged.

- [ ] **Step 9: Commit**

```bash
git add src/pages/AccessControl.tsx
git commit -m "feat(access): slim AccessControl — delegate Users/Roles tabs to new components"
```

---

## Self-Review (against spec)

**Spec coverage:**
- §1 split into components → Tasks 1,3,4,5,6 ✓
- §2 UsersTab (role tags, search+dept/role/status filters, client pagination, row→drawer, Sync, +เพิ่มผู้ใช้) → Task 4 ✓
- §3 UserRoleDrawer (roles multi ≥1, status, employee link, create mode) → Task 3 ✓
- §4 RolesTab/RoleCard (name/desc/#users/#perms/modules, ⋮ edit+guarded delete) → Task 5 ✓
- §5 server guard 409 → Task 2 + Task 6 step 3 ✓
- §6 accessDerive helpers → Task 1 ✓
- §7 testing (accessDerive vitest, roleUsage node:test, manual E2E) → Tasks 1,2,6 ✓
- §8 out-of-scope (Groups/Matrix/permission model untouched) → Task 6 step 6 guard ✓
- Decisions: Users+Roles only ✓ · Sheet drawer ✓ · UI+server delete guard (RoleCard disable/hide + 409) ✓ · component split ✓ · client filter+pagination ✓ · modules from permissions→group/nav ✓ · drawer edits roles+status+employee link, dept/position read-only ✓

**Placeholder scan:** no "TBD/implement later". The `filteredUsersBySearchRemoved` note in Task 6 step 4 is immediately resolved to `users={users}` in the same step's "Final Users tab body" block — the final code has no placeholder.

**Type consistency:** `AppUser/Role/AccessGroup/UserStatus/EmployeeDirectoryEntry` defined in `types.ts` (Task 1) consumed everywhere. Drawer/tab handler prop signatures (`onCreate({name,email,roleIds})`, `onUpdate(id,{roleIds?,status?})`, `onLinkEmployee(userId,employeeId)`, role `onCreate/onUpdate({name,description})`, `onDelete(id)`) are consistent between the components (Tasks 3,4,5) and the AccessControl adapters (Task 6). `accessDerive` signatures (Task 1) match call sites in UsersTab/RolesTab (Tasks 4,5).
