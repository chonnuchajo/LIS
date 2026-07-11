# Department Auto Roles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically add the Lab Analyze and QC Staff working roles based on the user's HR/Microsoft department while preserving all existing manual roles.

**Architecture:** Put the department-to-role rule in a small pure backend helper and apply it only after the final persisted department is known. Existing `User` model pre-save logic remains responsible for deriving the legacy primary `role` from `roles[]`.

**Tech Stack:** Node.js, Express, Mongoose, `node:test`, existing backend role helpers in `server/lib/roles.js`.

## Global Constraints

- Do not run `npm run build`, `npm run build:dev`, `npm run build:watch`, `vite build`, or any equivalent build command.
- Automatic roles are added to `roles[]`; they never replace existing roles.
- Do not auto-remove roles when department changes.
- `Lab/วิเคราะห์` maps to canonical role id `lab-analyst`.
- `ควบคุมคุณภาพ` maps to role id `qc-staff`.
- Department matching trims whitespace and uses exact known labels only.
- Keep the change backend-only unless TypeScript frontend files become necessary.

---

## File Structure

- Create `server/lib/departmentRoles.js`: pure helpers for exact department matching and stable role merging.
- Create `server/lib/departmentRoles.test.js`: `node:test` coverage for all department mapping and merge behavior from the spec.
- Modify `server/routes/accessControl.js`: apply automatic roles after the final department is known in Microsoft sync, new Microsoft user creation, manual employee linking, and bulk HR sync.
- Do not modify generated `assets/`, root `app.html`, or frontend build artifacts.

---

### Task 1: Department-role helper

**Files:**
- Create: `server/lib/departmentRoles.test.js`
- Create: `server/lib/departmentRoles.js`

**Interfaces:**
- Produces: `automaticRolesForDepartment(department: unknown): string[]`
- Produces: `mergeAutomaticRoles(currentRoles: unknown, department: unknown): string[]`
- Consumes: none

- [ ] **Step 1: Write the failing helper tests**

Create `server/lib/departmentRoles.test.js` with this content:

```js
const test = require('node:test');
const assert = require('node:assert');
const {
  automaticRolesForDepartment,
  mergeAutomaticRoles,
} = require('./departmentRoles');

test('automaticRolesForDepartment maps Lab/วิเคราะห์ to lab-analyst', () => {
  assert.deepStrictEqual(automaticRolesForDepartment('Lab/วิเคราะห์'), ['lab-analyst']);
});

test('automaticRolesForDepartment maps ควบคุมคุณภาพ to qc-staff', () => {
  assert.deepStrictEqual(automaticRolesForDepartment('ควบคุมคุณภาพ'), ['qc-staff']);
});

test('automaticRolesForDepartment trims department whitespace before matching', () => {
  assert.deepStrictEqual(automaticRolesForDepartment('  Lab/วิเคราะห์  '), ['lab-analyst']);
  assert.deepStrictEqual(automaticRolesForDepartment('\nควบคุมคุณภาพ\t'), ['qc-staff']);
});

test('automaticRolesForDepartment returns empty for unrelated or blank departments', () => {
  assert.deepStrictEqual(automaticRolesForDepartment('IT'), []);
  assert.deepStrictEqual(automaticRolesForDepartment(''), []);
  assert.deepStrictEqual(automaticRolesForDepartment(undefined), []);
  assert.deepStrictEqual(automaticRolesForDepartment(null), []);
});

test('mergeAutomaticRoles preserves existing roles and appends lab automatic role', () => {
  assert.deepStrictEqual(
    mergeAutomaticRoles(['viewer'], 'Lab/วิเคราะห์'),
    ['viewer', 'lab-analyst'],
  );
});

test('mergeAutomaticRoles preserves admin when adding an automatic role', () => {
  assert.deepStrictEqual(
    mergeAutomaticRoles(['admin'], 'Lab/วิเคราะห์'),
    ['admin', 'lab-analyst'],
  );
});

test('mergeAutomaticRoles appends qc-staff for the quality-control department', () => {
  assert.deepStrictEqual(
    mergeAutomaticRoles(['viewer'], 'ควบคุมคุณภาพ'),
    ['viewer', 'qc-staff'],
  );
});

test('mergeAutomaticRoles does not duplicate an existing automatic role', () => {
  assert.deepStrictEqual(
    mergeAutomaticRoles(['viewer', 'lab-analyst'], 'Lab/วิเคราะห์'),
    ['viewer', 'lab-analyst'],
  );
});

test('mergeAutomaticRoles de-dupes existing role input in stable order', () => {
  assert.deepStrictEqual(
    mergeAutomaticRoles(['viewer', 'viewer', 'qc-staff'], 'ควบคุมคุณภาพ'),
    ['viewer', 'qc-staff'],
  );
});

test('mergeAutomaticRoles ignores blank role ids', () => {
  assert.deepStrictEqual(
    mergeAutomaticRoles(['viewer', '', null, 'admin'], 'IT'),
    ['viewer', 'admin'],
  );
});
```

- [ ] **Step 2: Run the helper tests and verify RED**

Run:

```bash
node --test server/lib/departmentRoles.test.js
```

Expected result: FAIL because `./departmentRoles` cannot be found.

- [ ] **Step 3: Add the minimal helper implementation**

Create `server/lib/departmentRoles.js` with this content:

```js
const DEPARTMENT_ROLE_MAP = new Map([
  ['Lab/วิเคราะห์', ['lab-analyst']],
  ['ควบคุมคุณภาพ', ['qc-staff']],
]);

function normalizeDepartment(department) {
  return String(department ?? '').trim();
}

function automaticRolesForDepartment(department) {
  const key = normalizeDepartment(department);
  const roles = DEPARTMENT_ROLE_MAP.get(key);
  return roles ? [...roles] : [];
}

function normalizeRoleList(currentRoles) {
  return Array.isArray(currentRoles) ? currentRoles : [];
}

function mergeAutomaticRoles(currentRoles, department) {
  const seen = new Set();
  const merged = [];
  for (const role of [
    ...normalizeRoleList(currentRoles),
    ...automaticRolesForDepartment(department),
  ]) {
    const id = String(role ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    merged.push(id);
  }
  return merged;
}

module.exports = {
  automaticRolesForDepartment,
  mergeAutomaticRoles,
};
```

- [ ] **Step 4: Run the helper tests and verify GREEN**

Run:

```bash
node --test server/lib/departmentRoles.test.js
```

Expected result: PASS for all tests in `departmentRoles.test.js`.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
git add server/lib/departmentRoles.js server/lib/departmentRoles.test.js
git commit -m "feat(access): add department auto role helper"
```

---

### Task 2: Apply automatic roles during user sync

**Files:**
- Modify: `server/routes/accessControl.js`
- Test: `server/lib/departmentRoles.test.js`

**Interfaces:**
- Consumes: `mergeAutomaticRoles(currentRoles: unknown, department: unknown): string[]` from Task 1
- Consumes: `normalizeRoles(user)` and `primaryRole(roles)` from `server/lib/roles.js`
- Produces: `applyAutomaticRolesToUser(user: object, department?: unknown): object`
- Produces: Existing access-control route behavior with persisted automatic roles in `roles[]`

- [ ] **Step 1: Write the failing route-scenario helper tests before route edits**

Update the import in `server/lib/departmentRoles.test.js` from:

```js
const {
  automaticRolesForDepartment,
  mergeAutomaticRoles,
} = require('./departmentRoles');
```

to:

```js
const {
  automaticRolesForDepartment,
  mergeAutomaticRoles,
  applyAutomaticRolesToUser,
} = require('./departmentRoles');
```

Append these tests to `server/lib/departmentRoles.test.js`:

```js
test('mergeAutomaticRoles keeps a manually assigned qc role when Lab adds lab-analyst', () => {
  assert.deepStrictEqual(
    mergeAutomaticRoles(['qc-reviewer'], 'Lab/วิเคราะห์'),
    ['qc-reviewer', 'lab-analyst'],
  );
});

test('mergeAutomaticRoles keeps a manually assigned lab role when QC adds qc-staff', () => {
  assert.deepStrictEqual(
    mergeAutomaticRoles(['lab-head'], 'ควบคุมคุณภาพ'),
    ['lab-head', 'qc-staff'],
  );
});

test('mergeAutomaticRoles makes no role changes for unrelated departments', () => {
  assert.deepStrictEqual(
    mergeAutomaticRoles(['viewer', 'custom-role'], 'IT'),
    ['viewer', 'custom-role'],
  );
});

test('applyAutomaticRolesToUser mutates roles using the user department', () => {
  const user = { role: 'viewer', roles: ['viewer'], department: 'Lab/วิเคราะห์' };
  const result = applyAutomaticRolesToUser(user);

  assert.strictEqual(result, user);
  assert.deepStrictEqual(user.roles, ['viewer', 'lab-analyst']);
});

test('applyAutomaticRolesToUser falls back to legacy role when roles[] is empty', () => {
  const user = { role: 'viewer', roles: [], department: 'ควบคุมคุณภาพ' };
  applyAutomaticRolesToUser(user);

  assert.deepStrictEqual(user.roles, ['viewer', 'qc-staff']);
});

test('applyAutomaticRolesToUser can use an explicit department after HR patching', () => {
  const user = { role: 'admin', roles: ['admin'], department: 'IT' };
  applyAutomaticRolesToUser(user, 'Lab/วิเคราะห์');

  assert.deepStrictEqual(user.roles, ['admin', 'lab-analyst']);
});
```

- [ ] **Step 2: Run the helper tests and verify RED**

Run:

```bash
node --test server/lib/departmentRoles.test.js
```

Expected result: FAIL because `applyAutomaticRolesToUser` is not exported.

- [ ] **Step 3: Implement `applyAutomaticRolesToUser`**

In `server/lib/departmentRoles.js`, add the `normalizeRoles` import at the top:

```js
const { normalizeRoles } = require('./roles');
```

Then add this function after `mergeAutomaticRoles`:

```js
function applyAutomaticRolesToUser(user, department = user?.department) {
  if (!user) return user;
  user.roles = mergeAutomaticRoles(normalizeRoles(user), department);
  return user;
}
```

Update the export block to:

```js
module.exports = {
  automaticRolesForDepartment,
  mergeAutomaticRoles,
  applyAutomaticRolesToUser,
};
```

- [ ] **Step 4: Run the helper tests and verify GREEN**

Run:

```bash
node --test server/lib/departmentRoles.test.js
```

Expected result: PASS for all tests in `departmentRoles.test.js`.

- [ ] **Step 5: Import the helper in `server/routes/accessControl.js`**

Near the existing imports at the top of `server/routes/accessControl.js`, add:

```js
const { applyAutomaticRolesToUser, mergeAutomaticRoles } = require('../lib/departmentRoles');
```

The import block should include these role-related lines:

```js
const { resolveHrField } = require('../lib/userProfile');
const { primaryRole, normalizeRoles, unionPermissions } = require('../lib/roles');
const { applyAutomaticRolesToUser, mergeAutomaticRoles } = require('../lib/departmentRoles');
```

- [ ] **Step 6: Apply automatic roles for existing Microsoft users**

Inside `router.post('/users/microsoft', ...)`, in the `if (user)` branch, after `user.lastActive = now;` and before the `try { await user.save(); }` block, add:

```js
      applyAutomaticRolesToUser(user);
```

The end of the existing-user branch should read:

```js
      user.lastActive = now;
      applyAutomaticRolesToUser(user);
      try {
        await user.save();
      } catch (e) {
```

- [ ] **Step 7: Apply automatic roles for newly created Microsoft users**

In the new-user branch of `router.post('/users/microsoft', ...)`, keep these two lines unchanged:

```js
    const existingUsers = await User.countDocuments();
    const role = existingUsers === 0 ? 'admin' : 'viewer';
```

Then replace the current `newUserDoc` construction with this version so the department is calculated once before roles are merged:

```js
    const resolvedDepartment = (link && link.department) || resolveHrField(department, undefined);
    const resolvedPosition = (link && link.position) || resolveHrField(position, undefined);
    const roles = mergeAutomaticRoles([role], resolvedDepartment);
    const newUserDoc = {
      email: normalizedEmail,
      // HR is the source of truth for the display name once linked.
      name: (link && link.name) || name || normalizedEmail,
      role,
      roles,
      department: resolvedDepartment,
      position: resolvedPosition,
      employeeId: (link && link.employeeId) || '',
      status: 'active',
      lastActive: now,
      authProvider: 'microsoft',
      microsoftId,
      tenantId,
    };
```

Do not add route validation for whether `lab-analyst` or `qc-staff` exists in `Role`; this route already accepts persisted role ids and resolves permissions from the role collection. Missing role docs simply contribute no permissions until configured.

- [ ] **Step 8: Apply automatic roles for manual employee linking**

In `router.patch('/users/:id', ...)`, replace the final update block:

```js
    const user = await User.findByIdAndUpdate(req.params.id, patch, { new: true });
    if (!user) return res.status(404).json({ error: 'user not found' });
    res.json(formatUser(user));
```

with:

```js
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'user not found' });

    Object.assign(user, patch);
    applyAutomaticRolesToUser(user);
    await user.save();
    res.json(formatUser(user));
```

This preserves existing roles when only `employeeId` changes, adds the automatic role after HR department is loaded into `patch.department`, and lets the `User` model save hook keep `role` and `roles[]` consistent.

- [ ] **Step 9: Apply automatic roles during bulk HR sync**

In `router.post('/users/sync-employees', ...)`, replace the loop:

```js
    for (const update of plan.updates) {
      await User.findByIdAndUpdate(update.userId, {
        employeeId: update.employeeId,
        name: update.name || undefined,
        department: update.department || undefined,
        position: update.position || undefined,
      });
    }
```

with:

```js
    const usersById = new Map(users.map((u) => [u._id.toString(), u]));
    for (const update of plan.updates) {
      const user = usersById.get(update.userId);
      if (!user) continue;
      user.employeeId = update.employeeId;
      if (update.name) user.name = update.name;
      if (update.department) user.department = update.department;
      if (update.position) user.position = update.position;
      applyAutomaticRolesToUser(user);
      await user.save();
    }
```

This keeps bulk sync on `save()` so the existing `User` model pre-save hook derives the primary `role` field.

- [ ] **Step 10: Run focused backend tests**

Run:

```bash
node --test server/lib/departmentRoles.test.js
node --test server/lib/roles.test.js
node --test server/lib/userProfile.test.js
node --test server/lib/employeeLink.test.js
```

Expected result: all four commands PASS. `roles.test.js`, `userProfile.test.js`, and `employeeLink.test.js` are nearby regression guards for role normalization and department source-of-truth behavior.

- [ ] **Step 11: Run TypeScript check only if TypeScript files changed**

If this task changed only `server/**/*.js`, skip this step. If any `src/**/*.ts` or `src/**/*.tsx` file changed, run:

```bash
npx tsc --noEmit
```

Expected result: PASS with no TypeScript errors.

- [ ] **Step 12: Inspect diff**

Run:

```bash
git diff -- server/lib/departmentRoles.js server/lib/departmentRoles.test.js server/routes/accessControl.js
```

Expected result:
- No build artifacts changed.
- `server/routes/accessControl.js` imports `applyAutomaticRolesToUser` and `mergeAutomaticRoles`.
- Existing Microsoft users call `applyAutomaticRolesToUser(user)` before `save()`.
- New Microsoft users set `roles` from `mergeAutomaticRoles([role], resolvedDepartment)`.
- Manual employee linking and bulk HR sync save Mongoose documents after role merge.

- [ ] **Step 13: Commit Task 2**

Run:

```bash
git add server/routes/accessControl.js server/lib/departmentRoles.js server/lib/departmentRoles.test.js
git commit -m "feat(access): assign roles from department sync"
```

---

## Final Verification

- [ ] Run the focused backend test set:

```bash
node --test server/lib/departmentRoles.test.js
node --test server/lib/roles.test.js
node --test server/lib/userProfile.test.js
node --test server/lib/employeeLink.test.js
```

- [ ] Confirm no prohibited build command was run.
- [ ] Confirm `git status --short` contains only intentional files or is clean after commits.
- [ ] Do not update `server/seed-data/users.json` unless the user explicitly requests a one-time data export or migration.

---

## Self-Review Notes

- Spec coverage: Task 1 covers department matching, stable de-duplication, preserving existing roles, preserving admin, and duplicate prevention. Task 2 applies the helper to existing Microsoft sync, new Microsoft sync, manual employee linking, and bulk HR sync.
- Scope control: The plan does not auto-remove roles, does not touch frontend code, and does not add a one-time migration.
- Type consistency: The helper exports `automaticRolesForDepartment`, `mergeAutomaticRoles`, and `applyAutomaticRolesToUser`; route code imports `applyAutomaticRolesToUser` for existing documents and `mergeAutomaticRoles` for new-user document construction.
