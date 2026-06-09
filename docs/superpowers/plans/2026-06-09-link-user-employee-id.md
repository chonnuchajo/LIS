# Link LIS Users to Employee Codes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every LIS user a real `employeeId` (auto-matched by email at login, manually linkable as fallback), sourcing department/position from the HR employee record once linked.

**Architecture:** Pure matching helpers live in `server/lib/employeeLink.js` (unit-tested with `node:test`). A live webhook fetch lives in `server/lib/employeeDirectory.js`. The Microsoft-sync route auto-links by email; AccessControl gains a manual picker + a bulk "Sync พนักงาน" button. The frontend `AuthUser` carries `employeeId`, activating existing consumers.

**Tech Stack:** Express 4 + Mongoose 8 (backend), `node:test` (backend tests), React 18 + TypeScript + Vite + Vitest (frontend), shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-06-09-link-user-employee-id-design.md`

---

## File Structure

**Backend**
- Create `server/lib/employeeLink.js` — pure helpers: `normalizeEmployee`, `findEmployeeByEmail`, `findEmployeeById`, `planEmployeeSync`, constant `MONTHLY_TYPE`.
- Create `server/lib/employeeLink.test.js` — `node:test` unit tests for the above.
- Create `server/lib/employeeDirectory.js` — `EMPLOYEE_API_URL`, `fetchMonthlyEmployees()` (network; uses `employeeLink`).
- Modify `server/routes/employees.js` — reuse the new libs; add `GET /directory`; keep `/assignees` (Lab filter) behavior.
- Modify `server/models/User.js` — add `employeeId` field + partial unique index.
- Modify `server/routes/accessControl.js` — `formatUser` returns `employeeId`; auto-link in `POST /users/microsoft`; accept `employeeId` in `PATCH /users/:id`; add `POST /users/sync-employees`.

**Frontend**
- Modify `src/config/dev.ts` — add `employeeId` to `synthesizeDevUser`.
- Modify `src/context/AuthContext.tsx` — `AuthUser.employeeId`; populate from sync response and dev user.
- Modify `src/pages/AccessControl.tsx` — `employeeId` in local `User` type + mapping; employee column; link picker dialog; "Sync พนักงาน" button.

---

## Task 1: Pure employee-matching helpers

**Files:**
- Create: `server/lib/employeeLink.js`
- Test: `server/lib/employeeLink.test.js`

- [ ] **Step 1: Write the failing test**

Create `server/lib/employeeLink.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const {
  normalizeEmployee,
  findEmployeeByEmail,
  findEmployeeById,
  planEmployeeSync,
  MONTHLY_TYPE,
} = require('./employeeLink');

test('normalizeEmployee trims fields and lowercases email', () => {
  const row = {
    id: 6,
    employee_id: ' 11438 ',
    name: '  นางสาวพนิดา เบิกบาน ',
    department: ' Planning ',
    position: ' Specialist ',
    emp_type: 'รายเดือน',
    is_active: 1,
    email: ' Panida.B@ICPLADDA.com ',
  };
  const e = normalizeEmployee(row);
  assert.strictEqual(e.employeeId, '11438');
  assert.strictEqual(e.name, 'นางสาวพนิดา เบิกบาน');
  assert.strictEqual(e.department, 'Planning');
  assert.strictEqual(e.position, 'Specialist');
  assert.strictEqual(e.empType, 'รายเดือน');
  assert.strictEqual(e.isActive, true);
  assert.strictEqual(e.email, 'panida.b@icpladda.com');
});

test('normalizeEmployee maps null email to empty string', () => {
  assert.strictEqual(normalizeEmployee({ email: null }).email, '');
});

test('findEmployeeByEmail matches case-insensitively', () => {
  const employees = [
    { employeeId: '1', email: 'a@x.com' },
    { employeeId: '2', email: 'panida.b@icpladda.com' },
  ];
  assert.strictEqual(findEmployeeByEmail(employees, 'PANIDA.B@icpladda.com').employeeId, '2');
});

test('findEmployeeByEmail returns null for blank or no match', () => {
  const employees = [{ employeeId: '1', email: 'a@x.com' }];
  assert.strictEqual(findEmployeeByEmail(employees, ''), null);
  assert.strictEqual(findEmployeeByEmail(employees, '   '), null);
  assert.strictEqual(findEmployeeByEmail(employees, 'none@x.com'), null);
});

test('findEmployeeByEmail ignores employees with blank email', () => {
  const employees = [{ employeeId: '1', email: '' }];
  assert.strictEqual(findEmployeeByEmail(employees, ''), null);
});

test('findEmployeeById matches trimmed id', () => {
  const employees = [{ employeeId: '11438' }];
  assert.strictEqual(findEmployeeById(employees, ' 11438 ').employeeId, '11438');
  assert.strictEqual(findEmployeeById(employees, '999'), null);
  assert.strictEqual(findEmployeeById(employees, ''), null);
});

test('planEmployeeSync links empty users, counts already-linked and unmatched', () => {
  const users = [
    { id: 'u1', email: 'a@x.com', employeeId: '' },          // will link
    { id: 'u2', email: 'b@x.com', employeeId: '7' },         // already linked
    { id: 'u3', email: 'none@x.com', employeeId: '' },       // unmatched
  ];
  const employees = [
    { employeeId: '1', email: 'a@x.com', department: 'Lab', position: 'Analyst' },
  ];
  const plan = planEmployeeSync(users, employees);
  assert.strictEqual(plan.linked, 1);
  assert.strictEqual(plan.alreadyLinked, 1);
  assert.strictEqual(plan.unmatched, 1);
  assert.deepStrictEqual(plan.updates, [
    { userId: 'u1', employeeId: '1', department: 'Lab', position: 'Analyst' },
  ]);
});

test('MONTHLY_TYPE is the Thai monthly label', () => {
  assert.strictEqual(MONTHLY_TYPE, 'รายเดือน');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test server/lib/employeeLink.test.js`
Expected: FAIL — `Cannot find module './employeeLink'`.

- [ ] **Step 3: Write minimal implementation**

Create `server/lib/employeeLink.js`:

```js
// Pure helpers for matching LIS users to HR employee records. No network here —
// the live webhook fetch lives in employeeDirectory.js so these stay unit-testable.

const MONTHLY_TYPE = 'รายเดือน';

function normalizeEmployee(row) {
  return {
    id: row.id,
    employeeId: String(row.employee_id ?? '').trim(),
    name: String(row.name ?? '').trim(),
    department: String(row.department ?? '').trim(),
    position: String(row.position ?? '').trim(),
    empType: String(row.emp_type ?? '').trim(),
    isActive: Number(row.is_active) === 1,
    email: String(row.email ?? '').trim().toLowerCase(),
  };
}

function findEmployeeByEmail(employees, email) {
  const key = String(email ?? '').trim().toLowerCase();
  if (!key) return null;
  return employees.find((e) => e.email && e.email.toLowerCase() === key) || null;
}

function findEmployeeById(employees, employeeId) {
  const key = String(employeeId ?? '').trim();
  if (!key) return null;
  return employees.find((e) => e.employeeId === key) || null;
}

// Given the current users and the employee directory, decide which users to link.
// Only fills users with an empty employeeId — never overwrites an existing link.
function planEmployeeSync(users, employees) {
  let linked = 0;
  let alreadyLinked = 0;
  let unmatched = 0;
  const updates = [];
  for (const user of users) {
    if (user.employeeId) {
      alreadyLinked += 1;
      continue;
    }
    const emp = findEmployeeByEmail(employees, user.email);
    if (!emp) {
      unmatched += 1;
      continue;
    }
    linked += 1;
    updates.push({
      userId: user.id,
      employeeId: emp.employeeId,
      department: emp.department,
      position: emp.position,
    });
  }
  return { updates, linked, alreadyLinked, unmatched };
}

module.exports = {
  MONTHLY_TYPE,
  normalizeEmployee,
  findEmployeeByEmail,
  findEmployeeById,
  planEmployeeSync,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test server/lib/employeeLink.test.js`
Expected: PASS — all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/lib/employeeLink.js server/lib/employeeLink.test.js
git commit -m "feat(employees): pure employee-matching helpers + tests"
```

---

## Task 2: Live monthly-employee directory fetch

**Files:**
- Create: `server/lib/employeeDirectory.js`

This module does network IO (no unit test — verified via the route in Task 3).

- [ ] **Step 1: Write the implementation**

Create `server/lib/employeeDirectory.js`:

```js
const { normalizeEmployee, MONTHLY_TYPE } = require('./employeeLink');

const EMPLOYEE_API_URL = 'https://n8n-plant.icpladda.com/webhook/api/employee';

// Fetch the HR webhook and return active monthly employees (all departments),
// normalized. Throws on a non-OK response so callers can decide whether the
// failure is fatal (the directory route) or skippable (auto-link).
async function fetchMonthlyEmployees() {
  const response = await fetch(EMPLOYEE_API_URL);
  if (!response.ok) {
    throw new Error(`โหลดข้อมูลพนักงานไม่สำเร็จ (${response.status})`);
  }
  const payload = await response.json();
  const rows = Array.isArray(payload?.value)
    ? payload.value
    : Array.isArray(payload)
      ? payload
      : [];
  return rows
    .map(normalizeEmployee)
    .filter((e) => e.isActive && e.empType === MONTHLY_TYPE && e.employeeId && e.name);
}

module.exports = { EMPLOYEE_API_URL, fetchMonthlyEmployees };
```

- [ ] **Step 2: Sanity-check it loads**

Run: `node -e "require('./server/lib/employeeDirectory'); console.log('ok')"`
Expected: prints `ok` (module parses and its deps resolve).

- [ ] **Step 3: Commit**

```bash
git add server/lib/employeeDirectory.js
git commit -m "feat(employees): live monthly-employee directory fetch helper"
```

---

## Task 3: `/employees/directory` route + refactor `/assignees`

**Files:**
- Modify: `server/routes/employees.js`

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `server/routes/employees.js` with:

```js
const express = require('express');
const { fetchMonthlyEmployees } = require('../lib/employeeDirectory');

const router = express.Router();

const ALLOWED_DEPARTMENTS = ['Lab/วิเคราะห์'];

function toAssignee(e) {
  return {
    id: e.id,
    employeeId: e.employeeId,
    name: e.name,
    department: e.department,
    position: e.position,
    empType: e.empType,
    isActive: e.isActive,
  };
}

function toDirectoryEntry(e) {
  return {
    employeeId: e.employeeId,
    name: e.name,
    department: e.department,
    position: e.position,
    email: e.email,
  };
}

function byDeptThenName(a, b) {
  return (
    a.department.localeCompare(b.department, 'th') ||
    a.name.localeCompare(b.name, 'th')
  );
}

// Lab analysts only — drives the /petitions/assign picker. Unchanged behavior.
router.get('/assignees', async (_req, res) => {
  try {
    const employees = await fetchMonthlyEmployees();
    const result = employees
      .filter((e) => ALLOWED_DEPARTMENTS.includes(e.department))
      .map(toAssignee)
      .sort(byDeptThenName);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// All active monthly employees (every department) — drives the Access Control
// "link to employee" picker.
router.get('/directory', async (_req, res) => {
  try {
    const employees = await fetchMonthlyEmployees();
    const result = employees.map(toDirectoryEntry).sort(byDeptThenName);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

module.exports = router;
```

- [ ] **Step 2: Verify `/assignees` still works (no regression)**

Start the backend (`cd server && npm run dev`), then run:
`curl -s http://localhost:3001/api/employees/assignees | head -c 300`
Expected: JSON array of Lab/วิเคราะห์ monthly employees with `employeeId`/`name` (same shape as before).

- [ ] **Step 3: Verify `/directory` returns all monthly depts with email**

Run: `curl -s http://localhost:3001/api/employees/directory | head -c 400`
Expected: JSON array spanning multiple departments, each entry has `email` (e.g. `panida.b@icpladda.com`).

- [ ] **Step 4: Commit**

```bash
git add server/routes/employees.js
git commit -m "feat(employees): add /directory route, refactor onto shared helpers"
```

---

## Task 4: Add `employeeId` to the User model

**Files:**
- Modify: `server/models/User.js`

- [ ] **Step 1: Add the field**

In `server/models/User.js`, inside the schema definition, add `employeeId` right after the `position` line:

```js
  position: { type: String, default: 'Unassigned' },
  employeeId: { type: String, default: '' },
```

- [ ] **Step 2: Add the partial unique index**

In `server/models/User.js`, directly below the existing line
`UserSchema.index({ email: 1, deletedAt: 1 }, { unique: true });`
add:

```js
// One employee record maps to at most one (non-deleted) user. Partial filter so
// only non-empty employeeIds are constrained — many users may sit unlinked ('').
UserSchema.index(
  { employeeId: 1, deletedAt: 1 },
  { unique: true, partialFilterExpression: { employeeId: { $gt: '' } } },
);
```

- [ ] **Step 3: Verify the model loads and index syncs**

Restart the backend (`cd server && npm run dev`). On boot `ensureCollections()` runs `syncIndexes()`.
Expected: server starts with no index/model errors in the log.

- [ ] **Step 4: Commit**

```bash
git add server/models/User.js
git commit -m "feat(users): add employeeId field + partial unique index"
```

---

## Task 5: Auto-link on Microsoft sync + expose `employeeId`

**Files:**
- Modify: `server/routes/accessControl.js`

- [ ] **Step 1: Import the helpers**

At the top of `server/routes/accessControl.js`, below the existing `const { primaryRole, normalizeRoles, unionPermissions } = require('../lib/roles');` line, add:

```js
const { fetchMonthlyEmployees } = require('../lib/employeeDirectory');
const { findEmployeeByEmail, findEmployeeById, planEmployeeSync } = require('../lib/employeeLink');
```

- [ ] **Step 2: Return `employeeId` from `formatUser`**

In `formatUser`, add `employeeId` to the returned object, right after the `position` line:

```js
    position: user.position || 'Unassigned',
    employeeId: user.employeeId || '',
```

- [ ] **Step 3: Auto-link inside `POST /users/microsoft`**

In `POST /users/microsoft`, the existing-user branch currently ends with `user.lastActive = now;` then `await user.save();`. Insert the auto-link block immediately **before** `user.lastActive = now;` in that branch:

```js
      // Auto-link to an HR employee by email the first time we can. Only fills an
      // empty employeeId (never overwrites an admin's manual link). Webhook
      // failure is non-fatal — login must not break if HR is unreachable.
      if (!user.employeeId) {
        try {
          const emp = findEmployeeByEmail(await fetchMonthlyEmployees(), normalizedEmail);
          if (emp) {
            user.employeeId = emp.employeeId;
            user.department = emp.department || user.department;
            user.position = emp.position || user.position;
          }
        } catch (e) {
          // HR webhook down — skip auto-link this round.
        }
      }
      user.lastActive = now;
```

For the **new-user** branch (the `user = await User.create({...})` call), after that `create` resolves, add an auto-link follow-up immediately after it and before the `res.status(201)` line:

```js
      try {
        const emp = findEmployeeByEmail(await fetchMonthlyEmployees(), normalizedEmail);
        if (emp) {
          user.employeeId = emp.employeeId;
          user.department = emp.department || user.department;
          user.position = emp.position || user.position;
          await user.save();
        }
      } catch (e) {
        // HR webhook down — skip auto-link this round.
      }
```

- [ ] **Step 4: Manual verification (dev needs a real match — defer to Task 9)**

Run: `npx tsc -p tsconfig.app.json --noEmit` is frontend-only; for the backend just confirm it parses:
`node -e "require('./server/routes/accessControl'); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 5: Commit**

```bash
git add server/routes/accessControl.js
git commit -m "feat(access-control): auto-link user to employee by email on MS sync"
```

---

## Task 6: Manual link (PATCH) + bulk sync endpoint

**Files:**
- Modify: `server/routes/accessControl.js`

- [ ] **Step 1: Accept `employeeId` in `PATCH /users/:id`**

In `PATCH /users/:id`, the handler builds a `patch` object. Replace the whole handler body (the `try { ... } catch (err) { ... }` block) with:

```js
  try {
    const patch = {};
    ['name', 'email', 'department', 'position', 'status', 'lastActive'].forEach(key => {
      if (req.body[key] !== undefined) patch[key] = req.body[key];
    });
    if (req.body.roleIds !== undefined || req.body.roleId !== undefined) {
      const requested = [...new Set(
        Array.isArray(req.body.roleIds) && req.body.roleIds.length > 0
          ? req.body.roleIds
          : [req.body.roleId],
      )];
      const found = await Role.find({ id: { $in: requested } });
      if (found.length !== requested.length) {
        return res.status(400).json({ error: 'role not found' });
      }
      patch.roles = requested;
    }
    if (patch.roles) patch.role = primaryRole(patch.roles);

    if (req.body.employeeId !== undefined) {
      const employeeId = String(req.body.employeeId || '').trim();
      if (employeeId) {
        // Block linking the same employee to two users (the partial unique index
        // is the backstop; this gives a friendly 409).
        const dupe = await User.findOne({ employeeId, _id: { $ne: req.params.id } });
        if (dupe) {
          return res.status(409).json({ error: 'employee already linked to another user' });
        }
        patch.employeeId = employeeId;
        // Pull แผนก/ตำแหน่ง from the HR record (source of truth). Webhook down =
        // link the id only, leave dept/position untouched.
        try {
          const emp = findEmployeeById(await fetchMonthlyEmployees(), employeeId);
          if (emp) {
            patch.department = emp.department || undefined;
            patch.position = emp.position || undefined;
          }
        } catch (e) {
          // HR webhook down — link id only.
        }
      } else {
        patch.employeeId = ''; // unlink
      }
    }

    const user = await User.findByIdAndUpdate(req.params.id, patch, { new: true });
    if (!user) return res.status(404).json({ error: 'user not found' });
    res.json(formatUser(user));
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'employee already linked to another user' });
    res.status(400).json({ error: err.message });
  }
```

- [ ] **Step 2: Add `POST /users/sync-employees`**

In `server/routes/accessControl.js`, add this route immediately **after** the `PATCH /users/:id` handler and before `router.delete('/users/:id', ...)`:

```js
router.post('/users/sync-employees', async (_req, res) => {
  try {
    const employees = await fetchMonthlyEmployees();
    const users = await User.find();
    const plan = planEmployeeSync(
      users.map(u => ({ id: u._id.toString(), email: u.email, employeeId: u.employeeId || '' })),
      employees,
    );
    for (const update of plan.updates) {
      await User.findByIdAndUpdate(update.userId, {
        employeeId: update.employeeId,
        department: update.department || undefined,
        position: update.position || undefined,
      });
    }
    res.json({ linked: plan.linked, alreadyLinked: plan.alreadyLinked, unmatched: plan.unmatched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 3: Verify the route file parses**

Run: `node -e "require('./server/routes/accessControl'); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 4: Verify sync endpoint end-to-end**

With the backend running and at least one user whose email matches a monthly employee, run:
`curl -s -X POST http://localhost:3001/api/access-control/users/sync-employees`
Expected: JSON like `{"linked":N,"alreadyLinked":M,"unmatched":K}`. Re-running it should move that N into `alreadyLinked` (non-destructive, proves precedence).

- [ ] **Step 5: Commit**

```bash
git add server/routes/accessControl.js
git commit -m "feat(access-control): manual employee link (PATCH) + bulk sync endpoint"
```

---

## Task 7: Frontend — `employeeId` on AuthUser

**Files:**
- Modify: `src/config/dev.ts`
- Modify: `src/context/AuthContext.tsx`

- [ ] **Step 1: Add `employeeId` to the synthetic dev user**

In `src/config/dev.ts`, inside the object returned by `synthesizeDevUser` (the block ending `status: "active",`), add after the `position:` line:

```js
    position: primary.name,
    employeeId: `DEV-${primary.id}`,
```

- [ ] **Step 2: Add `employeeId` to the `AuthUser` interface**

In `src/context/AuthContext.tsx`, add to the `AuthUser` interface after `position?: string;`:

```ts
  position?: string;
  employeeId?: string;
```

- [ ] **Step 3: Carry `employeeId` through the MSAL-account user object**

In `src/context/AuthContext.tsx`, in the `account ? { ... }` user object (around the `department: syncedUser?.department` lines), add after `position:`:

```ts
        department: syncedUser?.department,
        position: syncedUser?.position,
        employeeId: syncedUser?.employeeId,
```

- [ ] **Step 4: Add `employeeId` to the sync response type + `setSyncedUser`**

In `src/context/AuthContext.tsx`, in `POST<{...}>("/access-control/users/microsoft", ...)`, add `employeeId: string;` to the response generic (after `position: string;`). Then in the `setSyncedUser({...})` call add after `position: res.data.data.position,`:

```ts
          department: res.data.data.department,
          position: res.data.data.position,
          employeeId: res.data.data.employeeId,
```

(`syncedUser` is typed from `AuthUser` so no separate type change is needed there beyond Step 2.)

- [ ] **Step 5: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no new errors referencing `AuthUser`, `syncedUser`, or `employeeId`. (Pre-existing latent errors elsewhere may remain — confirm none are in the files you touched.)

- [ ] **Step 6: Commit**

```bash
git add src/config/dev.ts src/context/AuthContext.tsx
git commit -m "feat(auth): expose employeeId on AuthUser (sync + dev)"
```

---

## Task 8: Frontend — AccessControl link picker + sync button

**Files:**
- Modify: `src/pages/AccessControl.tsx`

- [ ] **Step 1: Add `employeeId` to the local `User` type and mapping**

In `src/pages/AccessControl.tsx`, add `employeeId: string;` to the local `User` interface after `position: string;`. Wherever the API user is mapped into local state (the `formatUser`-shaped mapping when loading `/access-control`), include `employeeId: u.employeeId ?? ""`.

- [ ] **Step 2: Add directory state + fetch**

Near the other `useState`/data hooks in the component, add:

```tsx
const [directory, setDirectory] = useState<
  { employeeId: string; name: string; department: string; position: string; email: string }[]
>([]);
const [linkUserId, setLinkUserId] = useState<string | null>(null);
const [linkQuery, setLinkQuery] = useState("");

useEffect(() => {
  api
    .get<{ employeeId: string; name: string; department: string; position: string; email: string }[]>(
      "/employees/directory",
    )
    .then((res) => setDirectory(res.data.data ?? []))
    .catch(() => setDirectory([]));
}, []);
```

(Match the existing `api.get` result-shape used elsewhere in this file — if the file reads `res.data` rather than `res.data.data`, follow that convention.)

- [ ] **Step 3: Add the link handler**

Add alongside the other user mutation handlers:

```tsx
const linkEmployee = async (userId: string, employeeId: string) => {
  try {
    const res = await api.patch<User>(`/access-control/users/${userId}`, { employeeId });
    const updated = res.data.data;
    setUsers((current) => current.map((u) => (u.id === userId ? { ...u, ...updated } : u)));
    setLinkUserId(null);
    setLinkQuery("");
  } catch (err) {
    const status = (err as { status?: number })?.status;
    toast({
      title: status === 409 ? "พนักงานนี้ถูกผูกกับผู้ใช้อื่นแล้ว" : "ผูกพนักงานไม่สำเร็จ",
      variant: "destructive",
    });
  }
};
```

(Use whatever toast/notify utility the file already imports; if none, surface the error inline.)

- [ ] **Step 4: Add a "Sync พนักงาน" button**

Near the user-tab header/actions, add (admin-gated like other admin actions in the file):

```tsx
<Button
  variant="outline"
  onClick={async () => {
    try {
      const res = await api.post<{ linked: number; alreadyLinked: number; unmatched: number }>(
        "/access-control/users/sync-employees",
      );
      const { linked, alreadyLinked, unmatched } = res.data.data;
      toast({
        title: `Sync พนักงานเสร็จ: ผูกใหม่ ${linked}, ผูกอยู่แล้ว ${alreadyLinked}, ไม่พบ ${unmatched}`,
      });
      // refetch the access-control payload so the table reflects new links
      reloadAccessControl();
    } catch {
      toast({ title: "Sync พนักงานไม่สำเร็จ", variant: "destructive" });
    }
  }}
>
  Sync พนักงาน
</Button>
```

(`reloadAccessControl` = whatever this file already calls to refetch `/access-control`; reuse it.)

- [ ] **Step 5: Show employeeId + link action in the user row**

In the user table, under the email line (around `<p className="text-xs text-muted-foreground">{user.email}</p>`), add:

```tsx
<p className="text-xs text-muted-foreground">
  {user.employeeId ? `รหัสพนักงาน: ${user.employeeId}` : "ยังไม่ผูกพนักงาน"}
  <button
    type="button"
    className="ml-2 text-primary underline"
    onClick={() => { setLinkUserId(user.id); setLinkQuery(""); }}
  >
    {user.employeeId ? "เปลี่ยน" : "ผูก"}
  </button>
</p>
```

- [ ] **Step 6: Add the picker dialog**

Add a shadcn `Dialog` (reuse the file's existing dialog import) controlled by `linkUserId`. Body: a search input bound to `linkQuery`, and a filtered list from `directory`:

```tsx
<Dialog open={!!linkUserId} onOpenChange={(open) => { if (!open) setLinkUserId(null); }}>
  <DialogContent>
    <DialogHeader><DialogTitle>ผูกผู้ใช้กับพนักงาน</DialogTitle></DialogHeader>
    <Input
      placeholder="ค้นหาชื่อ / รหัส / แผนก"
      value={linkQuery}
      onChange={(e) => setLinkQuery(e.target.value)}
    />
    <div className="max-h-72 overflow-y-auto mt-2 space-y-1">
      {directory
        .filter((e) => {
          const q = linkQuery.trim().toLowerCase();
          if (!q) return true;
          return (
            e.name.toLowerCase().includes(q) ||
            e.employeeId.toLowerCase().includes(q) ||
            e.department.toLowerCase().includes(q)
          );
        })
        .slice(0, 50)
        .map((e) => (
          <button
            key={e.employeeId}
            type="button"
            className="w-full text-left px-2 py-1 rounded hover:bg-muted"
            onClick={() => linkUserId && linkEmployee(linkUserId, e.employeeId)}
          >
            <span className="font-medium">{e.name}</span>{" "}
            <span className="text-xs text-muted-foreground">
              ({e.employeeId}) · {e.department} · {e.position}
            </span>
          </button>
        ))}
    </div>
    <DialogFooter>
      {linkUserId &&
        users.find((u) => u.id === linkUserId)?.employeeId ? (
          <Button variant="ghost" onClick={() => linkEmployee(linkUserId, "")}>
            ยกเลิกการผูก
          </Button>
        ) : null}
    </DialogFooter>
  </DialogContent>
</Dialog>
```

- [ ] **Step 7: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no new errors in `AccessControl.tsx`.

- [ ] **Step 8: Lint**

Run: `npm run lint`
Expected: no new lint errors in the touched files.

- [ ] **Step 9: Commit**

```bash
git add src/pages/AccessControl.tsx
git commit -m "feat(access-control): employee link picker + Sync พนักงาน button"
```

---

## Task 9: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full backend unit suite**

Run: `node --test server/lib/employeeLink.test.js`
Expected: PASS.

- [ ] **Step 2: Run the frontend test suite**

Run: `npm run test`
Expected: existing suites pass (no regressions); count is ≥ the prior baseline.

- [ ] **Step 3: Type-check the frontend**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no new errors in touched files.

- [ ] **Step 4: Manual smoke (backend running, dev frontend running)**

1. Open Access Control. Click **Sync พนักงาน** → toast shows linked/already/unmatched counts.
2. A user whose Microsoft email matches a monthly employee now shows `รหัสพนักงาน: <id>` and the HR department/position.
3. For an unmatched user, click **ผูก**, search, pick an employee → row updates with id + dept/position.
4. Try linking the **same** employee to a second user → 409 toast "พนักงานนี้ถูกผูกกับผู้ใช้อื่นแล้ว".
5. Open the picker on a linked user → **ยกเลิกการผูก** clears the id.

- [ ] **Step 5: Export seed data (persist the new links)**

Run: `cd server && npm run seed:export`
Then commit the regenerated `server/seed-data/*.json` (per the seed-data-must-match-DB convention).

```bash
git add server/seed-data
git commit -m "chore(seed): export users with employeeId links"
```

---

## Self-Review Notes

- **Spec coverage:** directory endpoint (T2/T3), User.employeeId + index (T4), auto-link on sync (T5), manual PATCH + bulk sync (T6), AuthUser.employeeId (T7), AccessControl UI + sync button (T8), seed export (T9). All spec sections mapped.
- **Precedence:** auto-link and `planEmployeeSync` both gate on empty `employeeId` — manual links survive re-sync (tested in T1; verified in T6 Step 4).
- **Uniqueness:** partial unique index (T4) + app-level 409 in PATCH (T6) + 11000 catch.
- **Webhook-down safety:** auto-link (T5) and PATCH dept/position pull (T6) wrap fetch in try/catch; only the explicit directory/sync routes surface a 5xx.
- **Naming consistency:** `fetchMonthlyEmployees`, `findEmployeeByEmail`, `findEmployeeById`, `planEmployeeSync`, `employeeId` used identically across backend and frontend.
