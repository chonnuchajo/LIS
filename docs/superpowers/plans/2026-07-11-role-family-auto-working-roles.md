# Role Family Auto Working Roles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically add `lab-analyze` or `qc-staff` when users receive Lab/QC-family roles, and require new roles to declare their family.

**Architecture:** Add a small backend role-family helper and make Access Control routes normalize user role lists through it before saving. Store role family metadata on `Role` documents, expose it to the frontend role manager, and adjust the home dashboard resolver so base working dashboards win when those base roles are present.

**Tech Stack:** Node.js, Express, Mongoose, `node:test`, React, TypeScript, Vitest, Testing Library.

## Global Constraints

- Do not run `npm run build`, `npm run build:dev`, `npm run build:watch`, `vite build`, or any equivalent build command.
- Automatic base roles are appended to `roles[]`; they never replace existing roles.
- Do not auto-remove roles when a role family changes.
- Base Lab working role id is `lab-analyze`.
- Base QC working role id is `qc-staff`.
- Valid role family values are `lab`, `qc`, and empty string.
- Preserve legacy fallback for role ids `lab`, `lab-*`, `lab_*`, `qc`, `qc-*`, and `qc_*`.
- Do not update generated `assets/`, root `app.html`, or seed-data exports.

---

## File Structure

- Create `server/lib/roleFamilies.js`: pure family normalization, fallback, base-role merge, and user-object mutation helpers.
- Create `server/lib/roleFamilies.test.js`: `node:test` coverage for family mapping and stable role merging.
- Modify `server/models/Role.js`: add `family` field.
- Modify `server/routes/accessControl.js`: expose `family`, upsert required base role docs, validate role create/edit family, and normalize user roles before save.
- Modify `server/seed-access-control.js`: include `family` and the two base working roles in the manual seed script.
- Modify `src/components/lis/access/types.ts`: add frontend `RoleFamily` and `Role.family`.
- Modify `src/components/lis/access/RoleEditDialog.tsx`: add Lab/QC/none selector and submit `family`.
- Create `src/components/lis/access/RoleEditDialog.test.tsx`: verify create/edit payloads include `family`.
- Modify `src/components/lis/access/RolesTab.tsx`: pass `family` through callbacks.
- Modify `src/components/lis/access/RoleCard.tsx`: show Lab/QC family badges.
- Modify `src/pages/AccessControl.tsx`: send role `family` on create/update and keep local types aligned.
- Modify `src/lib/dashboardProfiles.ts` and `src/lib/dashboardProfiles.test.ts`: add `resolveDashboardRole()` and use it for home dashboard profile selection.
- Modify `src/pages/RoleDashboard.tsx`: resolve the dashboard from `resolveDashboardRole(roles)`.
- Modify `src/config/dev.ts` and `src/config/dev.test.ts`: normalize dev-mode role toggles so Lab/QC selections include their base working roles and base-role removal falls back safely.
- Modify `src/context/AuthContext.tsx`: use the dev-mode role selection helpers.

---

### Task 1: Backend Role-Family Helper

**Files:**
- Create: `server/lib/roleFamilies.test.js`
- Create: `server/lib/roleFamilies.js`

**Interfaces:**
- Produces: `normalizeRoleFamily(value: unknown): '' | 'lab' | 'qc'`
- Produces: `roleFamilyForId(roleId: unknown, explicitFamily?: unknown): '' | 'lab' | 'qc'`
- Produces: `baseRoleForFamily(family: unknown): '' | 'lab-analyze' | 'qc-staff'`
- Produces: `mergeBaseRolesForFamilies(roleIds: unknown, roleDocs?: Array<{ id?: string; family?: string }>): string[]`
- Produces: `applyBaseRolesToUser(user: object | null | undefined, roleDocs?: Array<{ id?: string; family?: string }>): object | null | undefined`

- [ ] **Step 1: Write the failing helper tests**

Create `server/lib/roleFamilies.test.js` with this content:

```js
const test = require('node:test');
const assert = require('node:assert');
const {
  normalizeRoleFamily,
  roleFamilyForId,
  baseRoleForFamily,
  mergeBaseRolesForFamilies,
  applyBaseRolesToUser,
} = require('./roleFamilies');

test('normalizeRoleFamily accepts only lab, qc, and blank', () => {
  assert.strictEqual(normalizeRoleFamily('lab'), 'lab');
  assert.strictEqual(normalizeRoleFamily(' LAB '), 'lab');
  assert.strictEqual(normalizeRoleFamily('qc'), 'qc');
  assert.strictEqual(normalizeRoleFamily(' QC '), 'qc');
  assert.strictEqual(normalizeRoleFamily(''), '');
  assert.strictEqual(normalizeRoleFamily(null), '');
  assert.strictEqual(normalizeRoleFamily('finance'), '');
});

test('roleFamilyForId uses explicit family before prefix fallback', () => {
  assert.strictEqual(roleFamilyForId('custom-role', 'lab'), 'lab');
  assert.strictEqual(roleFamilyForId('lab-head', 'qc'), 'qc');
  assert.strictEqual(roleFamilyForId('qc-head', ''), 'qc');
  assert.strictEqual(roleFamilyForId('lab_inventory', undefined), 'lab');
  assert.strictEqual(roleFamilyForId('production', undefined), '');
});

test('baseRoleForFamily maps Lab and QC to working role ids', () => {
  assert.strictEqual(baseRoleForFamily('lab'), 'lab-analyze');
  assert.strictEqual(baseRoleForFamily('qc'), 'qc-staff');
  assert.strictEqual(baseRoleForFamily(''), '');
  assert.strictEqual(baseRoleForFamily('finance'), '');
});

test('mergeBaseRolesForFamilies appends lab-analyze for Lab-family roles', () => {
  assert.deepStrictEqual(
    mergeBaseRolesForFamilies(
      ['viewer', 'lab-head'],
      [{ id: 'viewer', family: '' }, { id: 'lab-head', family: 'lab' }],
    ),
    ['viewer', 'lab-head', 'lab-analyze'],
  );
});

test('mergeBaseRolesForFamilies appends qc-staff for QC-family roles', () => {
  assert.deepStrictEqual(
    mergeBaseRolesForFamilies(
      ['qc-data-config'],
      [{ id: 'qc-data-config', family: 'qc' }],
    ),
    ['qc-data-config', 'qc-staff'],
  );
});

test('mergeBaseRolesForFamilies adds both base roles when both families are present', () => {
  assert.deepStrictEqual(
    mergeBaseRolesForFamilies(
      ['lab-inventory', 'qc-head'],
      [{ id: 'lab-inventory', family: 'lab' }, { id: 'qc-head', family: 'qc' }],
    ),
    ['lab-inventory', 'qc-head', 'lab-analyze', 'qc-staff'],
  );
});

test('mergeBaseRolesForFamilies does not duplicate existing base roles', () => {
  assert.deepStrictEqual(
    mergeBaseRolesForFamilies(
      ['lab-head', 'lab-analyze', 'qc-staff', 'qc-head'],
      [{ id: 'lab-head', family: 'lab' }, { id: 'qc-head', family: 'qc' }],
    ),
    ['lab-head', 'lab-analyze', 'qc-staff', 'qc-head'],
  );
});

test('mergeBaseRolesForFamilies preserves manual roles and removes blank duplicates', () => {
  assert.deepStrictEqual(
    mergeBaseRolesForFamilies(
      ['viewer', '', null, 'viewer', 'custom'],
      [{ id: 'custom', family: '' }],
    ),
    ['viewer', 'custom'],
  );
});

test('mergeBaseRolesForFamilies falls back to legacy prefixes without role docs', () => {
  assert.deepStrictEqual(
    mergeBaseRolesForFamilies(['lab-head', 'lab-inventory', 'qc-head'], []),
    ['lab-head', 'lab-inventory', 'qc-head', 'lab-analyze', 'qc-staff'],
  );
});

test('applyBaseRolesToUser mutates user roles from roles[]', () => {
  const user = { role: 'viewer', roles: ['lab-head'] };
  const result = applyBaseRolesToUser(user, [{ id: 'lab-head', family: 'lab' }]);

  assert.strictEqual(result, user);
  assert.deepStrictEqual(user.roles, ['lab-head', 'lab-analyze']);
});

test('applyBaseRolesToUser falls back to legacy user.role when roles[] is empty', () => {
  const user = { role: 'qc-head', roles: [] };
  applyBaseRolesToUser(user, [{ id: 'qc-head', family: 'qc' }]);

  assert.deepStrictEqual(user.roles, ['qc-head', 'qc-staff']);
});

test('applyBaseRolesToUser returns nullish users unchanged', () => {
  assert.strictEqual(applyBaseRolesToUser(null, []), null);
  assert.strictEqual(applyBaseRolesToUser(undefined, []), undefined);
});
```

- [ ] **Step 2: Run the helper tests and verify RED**

Run:

```bash
node --test server/lib/roleFamilies.test.js
```

Expected result: FAIL because `./roleFamilies` cannot be found.

- [ ] **Step 3: Add the minimal helper implementation**

Create `server/lib/roleFamilies.js` with this content:

```js
const { normalizeRoles } = require('./roles');

const LAB_BASE_ROLE = 'lab-analyze';
const QC_BASE_ROLE = 'qc-staff';

function normalizeRoleFamily(value) {
  const family = String(value ?? '').trim().toLowerCase();
  return family === 'lab' || family === 'qc' ? family : '';
}

function normalizeRoleId(value) {
  return String(value ?? '').trim().toLowerCase();
}

function roleFamilyForId(roleId, explicitFamily) {
  const family = normalizeRoleFamily(explicitFamily);
  if (family) return family;
  const id = normalizeRoleId(roleId);
  if (id === 'lab' || id.startsWith('lab-') || id.startsWith('lab_')) return 'lab';
  if (id === 'qc' || id.startsWith('qc-') || id.startsWith('qc_')) return 'qc';
  return '';
}

function baseRoleForFamily(family) {
  const normalized = normalizeRoleFamily(family);
  if (normalized === 'lab') return LAB_BASE_ROLE;
  if (normalized === 'qc') return QC_BASE_ROLE;
  return '';
}

function docsById(roleDocs) {
  const map = new Map();
  for (const doc of Array.isArray(roleDocs) ? roleDocs : []) {
    const id = normalizeRoleId(doc?.id);
    if (id) map.set(id, doc);
  }
  return map;
}

function stableUniqueRoleIds(values) {
  const seen = new Set();
  const out = [];
  for (const value of Array.isArray(values) ? values : []) {
    const id = normalizeRoleId(value);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function mergeBaseRolesForFamilies(roleIds, roleDocs = []) {
  const merged = stableUniqueRoleIds(roleIds);
  const seen = new Set(merged);
  const byId = docsById(roleDocs);
  const baseRoles = [];

  for (const id of merged) {
    const doc = byId.get(id);
    const family = roleFamilyForId(id, doc?.family);
    const baseRole = baseRoleForFamily(family);
    if (baseRole && !seen.has(baseRole)) {
      seen.add(baseRole);
      baseRoles.push(baseRole);
    }
  }

  return [...merged, ...baseRoles];
}

function applyBaseRolesToUser(user, roleDocs = []) {
  if (!user) return user;
  user.roles = mergeBaseRolesForFamilies(normalizeRoles(user), roleDocs);
  return user;
}

module.exports = {
  LAB_BASE_ROLE,
  QC_BASE_ROLE,
  normalizeRoleFamily,
  roleFamilyForId,
  baseRoleForFamily,
  mergeBaseRolesForFamilies,
  applyBaseRolesToUser,
};
```

- [ ] **Step 4: Run the helper tests and verify GREEN**

Run:

```bash
node --test server/lib/roleFamilies.test.js
```

Expected result: PASS for all tests in `server/lib/roleFamilies.test.js`.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
git add server/lib/roleFamilies.js server/lib/roleFamilies.test.js
git commit -m "feat(access): add role family helpers"
```

---

### Task 2: Persist and Enforce Role Families in Access Control

**Files:**
- Modify: `server/models/Role.js`
- Modify: `server/routes/accessControl.js`
- Modify: `server/seed-access-control.js`
- Test: `server/lib/roleFamilies.test.js`

**Interfaces:**
- Consumes: `normalizeRoleFamily(value)`, `mergeBaseRolesForFamilies(roleIds, roleDocs)`, and `applyBaseRolesToUser(user, roleDocs)` from `server/lib/roleFamilies.js`
- Produces: `Role.family` persisted as `'' | 'lab' | 'qc'`
- Produces: API roles formatted with `{ id, name, description, locked, dashboardProfile, family }`
- Produces: Access Control user saves normalized with required base roles

- [ ] **Step 1: Add the Role model field**

In `server/models/Role.js`, update `RoleSchema` by adding `family` after `dashboardProfile`:

```js
  dashboardProfile: { type: String, default: '' },
  family: { type: String, enum: ['', 'lab', 'qc'], default: '' },
```

- [ ] **Step 2: Import the helper in the route**

In `server/routes/accessControl.js`, add this require near the other helper imports:

```js
const {
  LAB_BASE_ROLE,
  QC_BASE_ROLE,
  normalizeRoleFamily,
  mergeBaseRolesForFamilies,
  applyBaseRolesToUser,
} = require('../lib/roleFamilies');
```

- [ ] **Step 3: Add known family defaults in the route**

In `server/routes/accessControl.js`, replace `defaultRoles` with this version:

```js
const defaultRoles = [
  { id: 'admin', name: 'Administrator', description: 'Full system access', locked: true, permissions: defaultGroups.map(g => g.id), family: '' },
  { id: LAB_BASE_ROLE, name: 'Lab Analyze', description: 'Base Lab analysis workspace', permissions: ['dashboard', 'samples', 'results', '/lab-testing', '/lab-testing/:id'], family: 'lab', dashboardProfile: 'lab-analyze' },
  { id: QC_BASE_ROLE, name: 'QC Staff', description: 'Base QC receiving and tracking workspace', permissions: ['dashboard', 'samples', 'qc', '/qc-testing', '/qc-testing/:id'], family: 'qc', dashboardProfile: 'qc-staff' },
  { id: 'lab', name: 'Lab Analyst', description: 'Sample handling and result entry', permissions: ['dashboard', 'samples', 'results', 'stock'], family: 'lab' },
  { id: 'qc', name: 'QC Reviewer', description: 'Review and approve results', permissions: ['dashboard', 'results', 'qc', 'reports'], family: 'qc' },
  { id: 'viewer', name: 'Viewer', description: 'Read-only access to dashboards and reports', permissions: ['dashboard', 'reports'], family: '' },
];
```

After `defaultRoles`, add this constant:

```js
const knownRoleFamilies = new Map([
  ['lab', 'lab'],
  [LAB_BASE_ROLE, 'lab'],
  ['lab-data-config', 'lab'],
  ['lab-config', 'lab'],
  ['lab-head', 'lab'],
  ['lab-inventory', 'lab'],
  ['qc', 'qc'],
  [QC_BASE_ROLE, 'qc'],
  ['qc-reviewer', 'qc'],
  ['qc-data-config', 'qc'],
  ['qc-head', 'qc'],
]);
```

- [ ] **Step 4: Upsert base role docs and backfill known families**

In `server/routes/accessControl.js`, add this function before `ensureDefaults()`:

```js
async function ensureRoleFamilyDefaults() {
  for (const role of defaultRoles.filter((item) => [LAB_BASE_ROLE, QC_BASE_ROLE].includes(item.id))) {
    const { family, ...insertFields } = role;
    await Role.updateOne(
      { id: role.id },
      { $setOnInsert: insertFields, $set: { family } },
      { upsert: true },
    );
  }
  for (const [id, family] of knownRoleFamilies.entries()) {
    await Role.updateOne({ id }, { $set: { family } });
  }
}
```

Then update `ensureDefaults()` so it calls the function after the admin permission update and before `return groups;`:

```js
  await ensureRoleFamilyDefaults();
  return groups;
```

- [ ] **Step 5: Add route-local normalization helpers**

In `server/routes/accessControl.js`, add these functions after `getRolePermissions()`:

```js
function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function uniqueRoleIds(values, fallback = 'viewer') {
  const source = Array.isArray(values) && values.length > 0 ? values : [fallback];
  const seen = new Set();
  const out = [];
  for (const value of source) {
    const id = String(value ?? '').trim().toLowerCase();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out.length > 0 ? out : [fallback];
}

async function normalizeRequestedRoles(values, fallback = 'viewer') {
  const requested = uniqueRoleIds(values, fallback);
  const found = await Role.find({ id: { $in: requested } });
  const foundIds = new Set(found.map((role) => role.id));
  const missing = requested.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    const error = new Error('role not found');
    error.status = 400;
    throw error;
  }
  return mergeBaseRolesForFamilies(requested, found);
}

async function applyStoredBaseRoles(user) {
  const current = normalizeRoles(user);
  const roleDocs = current.length > 0 ? await Role.find({ id: { $in: current } }) : [];
  applyBaseRolesToUser(user, roleDocs);
  return user;
}
```

- [ ] **Step 6: Include family in formatted roles**

In `formatRole(role)`, add `family`:

```js
    dashboardProfile: role.dashboardProfile || null,
    family: normalizeRoleFamily(role.family),
```

- [ ] **Step 7: Normalize role ids when creating local users**

In `router.post('/users', ...)`, add `await ensureDefaults();` immediately inside the `try` block.

Replace the current `requested`/`found` validation block with:

```js
    const requested = await normalizeRequestedRoles(
      Array.isArray(roleIds) && roleIds.length > 0 ? roleIds : [roleId || 'viewer'],
      'viewer',
    );
```

Keep the `User.create()` call, but ensure it writes the normalized roles:

```js
      roles: requested,
```

- [ ] **Step 8: Normalize existing Microsoft users before save**

In the `if (user)` branch of `router.post('/users/microsoft', ...)`, after `user.lastActive = now;` and before the `try { await user.save(); }` block, add:

```js
      await applyStoredBaseRoles(user);
```

- [ ] **Step 9: Normalize new Microsoft users**

In the new-user branch of `router.post('/users/microsoft', ...)`, keep:

```js
    const existingUsers = await User.countDocuments();
    const role = existingUsers === 0 ? 'admin' : 'viewer';
```

After `const link = await resolveEmployeeLink(normalizedEmail);`, add:

```js
    const resolvedDepartment = (link && link.department) || resolveHrField(department, undefined);
    const resolvedPosition = (link && link.position) || resolveHrField(position, undefined);
    const roles = await normalizeRequestedRoles([role], role);
```

Then set the new user document to include `roles`, `resolvedDepartment`, and `resolvedPosition`:

```js
      role,
      roles,
      department: resolvedDepartment,
      position: resolvedPosition,
```

- [ ] **Step 10: Normalize PATCH user role updates and employee linking**

In `router.patch('/users/:id', ...)`, add `await ensureDefaults();` immediately inside the `try` block.

Replace the current `requested`/`found` validation block with:

```js
      patch.roles = await normalizeRequestedRoles(
        Array.isArray(req.body.roleIds) && req.body.roleIds.length > 0
          ? req.body.roleIds
          : [req.body.roleId],
        'viewer',
      );
```

Remove this line because the `User` model pre-save hook will derive it:

```js
    if (patch.roles) patch.role = primaryRole(patch.roles);
```

Replace the final `findByIdAndUpdate` block:

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
    await applyStoredBaseRoles(user);
    await user.save();
    res.json(formatUser(user));
```

- [ ] **Step 11: Normalize bulk employee sync saves**

In `router.post('/users/sync-employees', ...)`, add `await ensureDefaults();` immediately inside the `try` block.

Replace the update loop:

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
      await applyStoredBaseRoles(user);
      await user.save();
    }
```

- [ ] **Step 12: Validate and persist role family on role create/edit**

In `router.post('/roles', ...)`, replace the body extraction and create logic with:

```js
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    if (!hasOwn(req.body, 'family')) return res.status(400).json({ error: 'family is required' });
    const family = normalizeRoleFamily(req.body.family);
    if (String(req.body.family ?? '').trim() && !family) {
      return res.status(400).json({ error: 'invalid family' });
    }
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const role = await Role.create({ id, name, description, family, permissions: [] });
```

In `router.patch('/roles/:id', ...)`, add this block after the `description` update:

```js
    if ('family' in req.body) {
      const family = normalizeRoleFamily(req.body.family);
      if (String(req.body.family ?? '').trim() && !family) {
        return res.status(400).json({ error: 'invalid family' });
      }
      updates.family = family;
    }
```

- [ ] **Step 13: Update the manual seed script**

In `server/seed-access-control.js`, replace `ROLES` with:

```js
const ROLES = [
  { id: 'admin', name: 'Administrator', description: 'Full system access', locked: true, permissions: ['others', 'qc', 'lab', 'inventory'], family: '' },
  { id: 'lab-analyze', name: 'Lab Analyze', description: 'Base Lab analysis workspace', locked: false, permissions: ['/dashboard/lab', '/record-results', '/daily-check', '/lab-testing', '/lab-testing/:id'], family: 'lab', dashboardProfile: 'lab-analyze' },
  { id: 'qc-staff', name: 'QC Staff', description: 'Base QC receiving and tracking workspace', locked: false, permissions: ['/dashboard/qc', '/physical-inspection', '/qc-testing', '/qc-testing/:id'], family: 'qc', dashboardProfile: 'qc-staff' },
  { id: 'lab', name: 'Lab Analyst', description: 'Sample handling and result entry', locked: false, permissions: ['/record-results', '/daily-check', '/stock-deduction', '/petitions/assign', '/master-items', '/simple-method', '/machines', '/stock'], family: 'lab' },
  { id: 'qc', name: 'QC Reviewer', description: 'Review and approve results', locked: false, permissions: ['inventory', '/physical-inspection'], family: 'qc' },
  { id: 'viewer', name: 'Viewer', description: 'Read-only access to dashboards and reports', locked: false, permissions: ['/home', '/', '/petitions'], family: '' },
];
```

- [ ] **Step 14: Run backend focused tests**

Run:

```bash
node --test server/lib/roleFamilies.test.js
node --test server/lib/roleUsage.test.js
node --test server/lib/userProfile.test.js
node --test server/lib/employeeLink.test.js
```

Expected result: all commands PASS.

- [ ] **Step 15: Commit Task 2**

Run:

```bash
git add server/models/Role.js server/routes/accessControl.js server/seed-access-control.js
git commit -m "feat(access): enforce role family base roles"
```

---

### Task 3: Dashboard Chooses Base Working Profile

**Files:**
- Modify: `src/lib/dashboardProfiles.test.ts`
- Modify: `src/lib/dashboardProfiles.ts`
- Modify: `src/pages/RoleDashboard.tsx`

**Interfaces:**
- Consumes: `roleIds: string[]`
- Produces: `resolveDashboardRole(roleIds: string[]): string`
- Produces: `RoleDashboard` resolves profile from `resolveDashboardRole(roles)`

- [ ] **Step 1: Write failing dashboard resolver tests**

In `src/lib/dashboardProfiles.test.ts`, update the import:

```ts
  DASHBOARD_PROFILES, KPI_META, resolveProfileForRole, resolveActiveRole, resolveDashboardRole,
```

Add this `describe` block after `resolveActiveRole` tests:

```ts
describe("resolveDashboardRole", () => {
  it("prefers admin over base working roles", () => {
    expect(resolveDashboardRole(["lab-head", "lab-analyze", "admin"])).toBe("admin");
    expect(resolveDashboardRole(["qc-head", "qc-staff", "admin"])).toBe("admin");
  });

  it("uses lab-analyze as the home profile when Lab higher roles include it", () => {
    expect(resolveDashboardRole(["lab-head", "lab-analyze"])).toBe("lab-analyze");
    expect(resolveDashboardRole(["lab-inventory", "lab-analyze"])).toBe("lab-analyze");
  });

  it("uses qc-staff as the home profile when QC higher roles include it", () => {
    expect(resolveDashboardRole(["qc-head", "qc-staff"])).toBe("qc-staff");
    expect(resolveDashboardRole(["qc-data-config", "qc-staff"])).toBe("qc-staff");
  });

  it("falls back to the existing primary role behavior when no base working role is present", () => {
    expect(resolveDashboardRole(["lab-head"])).toBe("lab-head");
    expect(resolveDashboardRole(["lab", "qc"])).toBe("qc");
    expect(resolveDashboardRole([])).toBe("viewer");
  });
});
```

- [ ] **Step 2: Run the focused frontend test and verify RED**

Run:

```bash
npm run test -- src/lib/dashboardProfiles.test.ts
```

Expected result: FAIL because `resolveDashboardRole` is not exported.

- [ ] **Step 3: Implement `resolveDashboardRole`**

In `src/lib/dashboardProfiles.ts`, add this function above `resolveActiveRole`:

```ts
export function resolveDashboardRole(roleIds: string[]): string {
  if (roleIds.includes("admin")) return "admin";
  if (roleIds.includes("qc-staff")) return "qc-staff";
  if (roleIds.includes("lab-analyze")) return "lab-analyze";
  return primaryRole(roleIds);
}
```

- [ ] **Step 4: Use the resolver in RoleDashboard**

In `src/pages/RoleDashboard.tsx`, change the imports:

```ts
import { normalizeRoles } from "@/lib/roles";
import { resolveProfileForRole, resolveDashboardRole, DASHBOARD_PROFILES, type KpiId } from "@/lib/dashboardProfiles";
```

Then replace:

```ts
  const profileId = resolveProfileForRole(primaryRole(roles), roleObjs);
```

with:

```ts
  const profileId = resolveProfileForRole(resolveDashboardRole(roles), roleObjs);
```

- [ ] **Step 5: Run the focused frontend test and verify GREEN**

Run:

```bash
npm run test -- src/lib/dashboardProfiles.test.ts
```

Expected result: PASS.

- [ ] **Step 6: Commit Task 3**

Run:

```bash
git add src/lib/dashboardProfiles.ts src/lib/dashboardProfiles.test.ts src/pages/RoleDashboard.tsx
git commit -m "feat(dashboard): prefer base working role profiles"
```

---

### Task 4: Role Family Selector in Access Control UI

**Files:**
- Modify: `src/components/lis/access/types.ts`
- Create: `src/components/lis/access/RoleEditDialog.test.tsx`
- Modify: `src/components/lis/access/RoleEditDialog.tsx`
- Modify: `src/components/lis/access/RolesTab.tsx`
- Modify: `src/components/lis/access/RoleCard.tsx`
- Modify: `src/pages/AccessControl.tsx`

**Interfaces:**
- Consumes: backend `Role.family`
- Produces: `RoleFamily = '' | 'lab' | 'qc'`
- Produces: Role create/update payloads `{ name: string; description: string; family: RoleFamily }`

- [ ] **Step 1: Add frontend role-family types**

In `src/components/lis/access/types.ts`, add this type above `export type Role`:

```ts
export type RoleFamily = "" | "lab" | "qc";
```

Then update `Role`:

```ts
export type Role = {
  id: string;
  name: string;
  description: string;
  locked?: boolean;
  family?: RoleFamily;
};
```

- [ ] **Step 2: Write failing RoleEditDialog tests**

Create `src/components/lis/access/RoleEditDialog.test.tsx` with this content:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RoleEditDialog from "./RoleEditDialog";

describe("RoleEditDialog", () => {
  it("submits the selected Lab family when creating a role", () => {
    const onSubmit = vi.fn();

    render(
      <RoleEditDialog
        open
        mode="create"
        role={null}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText("Role name"), { target: { value: "Lab Head" } });
    fireEvent.change(screen.getByLabelText("Role description"), { target: { value: "Approves Lab work" } });
    fireEvent.click(screen.getByLabelText("Lab"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Lab Head",
      description: "Approves Lab work",
      family: "lab",
    });
  });

  it("loads and submits the existing QC family when editing a role", () => {
    const onSubmit = vi.fn();

    render(
      <RoleEditDialog
        open
        mode="edit"
        role={{ id: "qc-head", name: "QC Head", description: "Approves QC work", family: "qc" }}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByLabelText("QC")).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: "QC Head",
      description: "Approves QC work",
      family: "qc",
    });
  });

  it("submits a blank family for roles outside Lab and QC", () => {
    const onSubmit = vi.fn();

    render(
      <RoleEditDialog
        open
        mode="create"
        role={null}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText("Role name"), { target: { value: "Production" } });
    fireEvent.click(screen.getByLabelText("Not Lab/QC"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Production",
      description: "",
      family: "",
    });
  });
});
```

- [ ] **Step 3: Run the dialog tests and verify RED**

Run:

```bash
npm run test -- src/components/lis/access/RoleEditDialog.test.tsx
```

Expected result: FAIL because `RoleEditDialog` does not expose role-family controls or submit `family`.

- [ ] **Step 4: Update RoleEditDialog**

In `src/components/lis/access/RoleEditDialog.tsx`, replace the file with this content:

```tsx
import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { Role, RoleFamily } from "./types";

const FAMILY_OPTIONS: { value: RoleFamily; label: string; description: string }[] = [
  { value: "lab", label: "Lab", description: "Adds lab-analyze to assigned users" },
  { value: "qc", label: "QC", description: "Adds qc-staff to assigned users" },
  { value: "", label: "Not Lab/QC", description: "No automatic working role" },
];

interface Props {
  open: boolean;
  mode: "create" | "edit";
  role: Role | null;
  onClose: () => void;
  onSubmit: (values: { name: string; description: string; family: RoleFamily }) => void;
}

export default function RoleEditDialog({ open, mode, role, onClose, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [family, setFamily] = useState<RoleFamily>("");

  useEffect(() => {
    if (!open) return;
    setName(mode === "edit" && role ? role.name : "");
    setDescription(mode === "edit" && role ? role.description : "");
    setFamily(mode === "edit" && role ? role.family ?? "" : "");
  }, [open, mode, role]);

  const submit = () => {
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), description: description.trim(), family });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{mode === "create" ? "Create Role" : "Edit Role"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="role-name">Role name</Label>
            <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role-description">Role description</Label>
            <Input id="role-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Role area</Label>
            <RadioGroup value={family || "none"} onValueChange={(value) => setFamily(value === "none" ? "" : value as RoleFamily)}>
              {FAMILY_OPTIONS.map((option) => {
                const value = option.value || "none";
                return (
                  <Label
                    key={value}
                    htmlFor={`role-family-${value}`}
                    className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted/40"
                  >
                    <RadioGroupItem id={`role-family-${value}`} value={value} className="mt-0.5" />
                    <span>
                      <span className="block text-sm font-medium">{option.label}</span>
                      <span className="block text-xs font-normal text-muted-foreground">{option.description}</span>
                    </span>
                  </Label>
                );
              })}
            </RadioGroup>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!name.trim()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: Update RolesTab callback types**

In `src/components/lis/access/RolesTab.tsx`, update imports and props:

```ts
import type { Role, AppUser, AccessGroup, RoleFamily } from "./types";
```

Then change callback types:

```ts
  onCreate: (v: { name: string; description: string; family: RoleFamily }) => void;
  onUpdate: (id: string, v: { name: string; description: string; family: RoleFamily }) => void;
```

- [ ] **Step 6: Show family badges on role cards**

In `src/components/lis/access/RoleCard.tsx`, add this helper above the component:

```tsx
function familyLabel(family?: Role["family"]) {
  if (family === "lab") return "Lab";
  if (family === "qc") return "QC";
  return "";
}
```

Then in the `CardTitle` next to the `locked` badge, add:

```tsx
            {familyLabel(role.family) ? <Badge variant="outline" className="text-[10px]">{familyLabel(role.family)}</Badge> : null}
```

- [ ] **Step 7: Pass family through AccessControl role mutations**

In `src/pages/AccessControl.tsx`, update the type import:

```ts
import type { AppUser, Role, AccessGroup, EmployeeDirectoryEntry, RoleFamily } from "@/components/lis/access/types";
```

Update `defaultRoles` entries to include `family`:

```ts
  { id: "admin", name: "Administrator", description: "Full system access", locked: true, family: "" },
  { id: "lab-analyze", name: "Lab Analyze", description: "Base Lab analysis workspace", family: "lab" },
  { id: "qc-staff", name: "QC Staff", description: "Base QC receiving and tracking workspace", family: "qc" },
  { id: "lab", name: "Lab Analyst", description: "Sample handling and result entry", family: "lab" },
  { id: "qc", name: "QC Reviewer", description: "Review and approve results", family: "qc" },
  { id: "viewer", name: "Viewer", description: "Read-only access to dashboards and reports", family: "" },
```

Update `addRoleFromDialog`:

```ts
  const addRoleFromDialog = async (v: { name: string; description: string; family: RoleFamily }) => {
    if (!v.name.trim()) { toast.error("ต้องกรอกชื่อ Role"); return; }
    try {
      const res = await api.post<Role>("/access-control/roles", { name: v.name, description: v.description, family: v.family });
      setRoles((current) => [...current, res.data.data]);
      setPermissions((current) => ({ ...current, [res.data.data.id]: [] }));
      notifyGroupMappingChanged();
      toast.success("เพิ่ม Role แล้ว");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "เพิ่ม Role ไม่สำเร็จ");
    }
  };
```

Update `updateRole`:

```ts
  const updateRole = async (id: string, patch: { name: string; description: string; family: RoleFamily }) => {
```

- [ ] **Step 8: Run dialog tests and verify GREEN**

Run:

```bash
npm run test -- src/components/lis/access/RoleEditDialog.test.tsx
```

Expected result: PASS.

- [ ] **Step 9: Commit Task 4**

Run:

```bash
git add src/components/lis/access/types.ts src/components/lis/access/RoleEditDialog.tsx src/components/lis/access/RoleEditDialog.test.tsx src/components/lis/access/RolesTab.tsx src/components/lis/access/RoleCard.tsx src/pages/AccessControl.tsx
git commit -m "feat(access): add role family selector"
```

---

### Task 5: Dev Mode Role Selection Normalization

**Files:**
- Modify: `src/config/dev.test.ts`
- Modify: `src/config/dev.ts`
- Modify: `src/context/AuthContext.tsx`

**Interfaces:**
- Consumes: frontend `Role.family` values from Access Control responses
- Produces: `DevRoleOption = { id: string; name: string; family?: '' | 'lab' | 'qc' | null }`
- Produces: `normalizeDevRoleSelection(roleIds: string[], roles: DevRoleOption[]): string[]`
- Produces: `toggleDevRoleSelection(currentIds: string[], toggledId: string, roles: DevRoleOption[]): string[]`

- [ ] **Step 1: Write failing dev-mode selection tests**

In `src/config/dev.test.ts`, update the import:

```ts
import {
  synthesizeDevUser,
  synthesizeDevAssignees,
  normalizeDevRoleSelection,
  toggleDevRoleSelection,
  type DevRoleOption,
} from "./dev";
```

Add this role fixture after the import:

```ts
const devRoles: DevRoleOption[] = [
  { id: "admin", name: "Admin", family: "" },
  { id: "lab", name: "Lab", family: "lab" },
  { id: "lab-analyze", name: "Lab Analyze", family: "lab" },
  { id: "lab-head", name: "Lab Head", family: "lab" },
  { id: "qc", name: "QC", family: "qc" },
  { id: "qc-staff", name: "QC Staff", family: "qc" },
  { id: "qc-head", name: "QC Head", family: "qc" },
];
```

Add this `describe` block after the `synthesizeDevUser` tests:

```ts
describe("dev role selection normalization", () => {
  it("adds lab-analyze when a Lab role is selected", () => {
    expect(normalizeDevRoleSelection(["lab"], devRoles)).toEqual(["lab", "lab-analyze"]);
    expect(toggleDevRoleSelection(["admin"], "lab", devRoles)).toEqual(["admin", "lab", "lab-analyze"]);
  });

  it("adds qc-staff when a QC role is selected", () => {
    expect(normalizeDevRoleSelection(["qc-head"], devRoles)).toEqual(["qc-head", "qc-staff"]);
    expect(toggleDevRoleSelection(["admin"], "qc", devRoles)).toEqual(["admin", "qc", "qc-staff"]);
  });

  it("removing lab-analyze removes Lab-family dev roles and falls back to admin", () => {
    expect(toggleDevRoleSelection(["lab-head", "lab-analyze"], "lab-analyze", devRoles)).toEqual(["admin"]);
    expect(toggleDevRoleSelection(["admin", "lab-head", "lab-analyze"], "lab-analyze", devRoles)).toEqual(["admin"]);
  });

  it("removing qc-staff removes QC-family dev roles and falls back to admin", () => {
    expect(toggleDevRoleSelection(["qc-head", "qc-staff"], "qc-staff", devRoles)).toEqual(["admin"]);
    expect(toggleDevRoleSelection(["admin", "qc-head", "qc-staff"], "qc-staff", devRoles)).toEqual(["admin"]);
  });

  it("falls back to admin when a selected family is missing its base role", () => {
    const withoutLabAnalyze = devRoles.filter((role) => role.id !== "lab-analyze");
    const withoutQcStaff = devRoles.filter((role) => role.id !== "qc-staff");

    expect(normalizeDevRoleSelection(["lab-head"], withoutLabAnalyze)).toEqual(["admin"]);
    expect(normalizeDevRoleSelection(["qc-head"], withoutQcStaff)).toEqual(["admin"]);
  });
});
```

- [ ] **Step 2: Run the dev tests and verify RED**

Run:

```bash
npm run test -- src/config/dev.test.ts
```

Expected result: FAIL because `normalizeDevRoleSelection`, `toggleDevRoleSelection`, and `DevRoleOption` are not exported.

- [ ] **Step 3: Implement dev-mode selection helpers**

In `src/config/dev.ts`, replace the `DevAuthUser` type and `synthesizeDevUser` signature area with this code while keeping the existing `DEV_MODE` and `DEV_DEFAULT_ROLE` constants:

```ts
export type RoleFamily = "" | "lab" | "qc";

export type DevRoleOption = {
  id: string;
  name: string;
  family?: RoleFamily | null;
};

export type DevAuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  roles: string[];
  permissions: string[];
  department: string;
  position: string;
  employeeId: string;
  status: "active";
};

const LAB_DEV_BASE_ROLE = "lab-analyze";
const QC_DEV_BASE_ROLE = "qc-staff";

function normalizeFamily(value: unknown): RoleFamily {
  const family = String(value ?? "").trim().toLowerCase();
  return family === "lab" || family === "qc" ? family : "";
}

function normalizeRoleId(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function roleFamilyForDevRole(roleId: string, explicitFamily?: unknown): RoleFamily {
  const family = normalizeFamily(explicitFamily);
  if (family) return family;
  if (roleId === "lab" || roleId.startsWith("lab-") || roleId.startsWith("lab_")) return "lab";
  if (roleId === "qc" || roleId.startsWith("qc-") || roleId.startsWith("qc_")) return "qc";
  return "";
}

function baseRoleForDevFamily(family: RoleFamily) {
  if (family === "lab") return LAB_DEV_BASE_ROLE;
  if (family === "qc") return QC_DEV_BASE_ROLE;
  return "";
}

function uniqueRoleIds(ids: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const normalized = normalizeRoleId(id);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function rolesById(roles: DevRoleOption[]) {
  return new Map(roles.map((role) => [role.id, role]));
}

export function normalizeDevRoleSelection(roleIds: string[], roles: DevRoleOption[]): string[] {
  const byId = rolesById(roles);
  const selected = uniqueRoleIds(roleIds).filter((id) => byId.has(id));
  const kept: string[] = [];
  const families = new Set<RoleFamily>();

  for (const id of selected) {
    const role = byId.get(id);
    const family = roleFamilyForDevRole(id, role?.family);
    const baseRole = baseRoleForDevFamily(family);
    if (baseRole && !byId.has(baseRole)) continue;
    kept.push(id);
    if (family) families.add(family);
  }

  const withBase = [...kept];
  for (const family of families) {
    const baseRole = baseRoleForDevFamily(family);
    if (baseRole && byId.has(baseRole)) withBase.push(baseRole);
  }

  const normalized = uniqueRoleIds(withBase);
  if (normalized.length > 0) return normalized;
  return byId.has(DEV_DEFAULT_ROLE) ? [DEV_DEFAULT_ROLE] : [];
}

export function toggleDevRoleSelection(
  currentIds: string[],
  toggledId: string,
  roles: DevRoleOption[],
): string[] {
  const byId = rolesById(roles);
  const id = normalizeRoleId(toggledId);
  if (!byId.has(id)) return normalizeDevRoleSelection(currentIds, roles);

  const current = normalizeDevRoleSelection(currentIds, roles);
  const role = byId.get(id);
  const family = roleFamilyForDevRole(id, role?.family);
  const baseRole = baseRoleForDevFamily(family);
  const next = current.includes(id)
    ? id === baseRole
      ? current.filter((roleId) => roleFamilyForDevRole(roleId, byId.get(roleId)?.family) !== family)
      : current.filter((roleId) => roleId !== id)
    : [...current, id];

  return normalizeDevRoleSelection(next, roles);
}
```

Then update the existing `synthesizeDevUser` signature:

```ts
export const synthesizeDevUser = (
  roles: DevRoleOption[],
): DevAuthUser => {
```

- [ ] **Step 4: Wire helpers into AuthContext**

In `src/context/AuthContext.tsx`, replace the dev import:

```ts
import {
  DEV_MODE,
  DEV_DEFAULT_ROLE,
  synthesizeDevUser,
  normalizeDevRoleSelection,
  toggleDevRoleSelection,
  type DevRoleOption,
} from "@/config/dev";
```

Update the context type:

```ts
  devRoles?: DevRoleOption[];
```

Update dev roles state:

```ts
  const [devRoles, setDevRoles] = useState<DevRoleOption[]>([]);
```

Add this helper near `setDevRolesSelection`:

```ts
  const sameRoleSelection = (a: string[], b: string[]) =>
    a.length === b.length && a.every((id, index) => id === b[index]);
```

Replace `setDevRolesSelection` with:

```ts
  const setDevRolesSelection = (ids: string[]) => {
    const next = normalizeDevRoleSelection(ids, devRoles);
    localStorage.setItem("dev_roles", JSON.stringify(next));
    setDevRoleIds(next);
  };
```

Replace `toggleDevRole` with:

```ts
  const toggleDevRole = (role: string) => {
    setDevRolesSelection(toggleDevRoleSelection(devRoleIds, role, devRoles));
  };
```

Replace the stale-role guard effect body with:

```ts
    const valid = devRoleIds.filter((id) => devRoles.some((r) => r.id === id));
    const normalized = normalizeDevRoleSelection(valid, devRoles);
    if (sameRoleSelection(normalized, devRoleIds)) return;
    setDevRolesSelection(normalized);
```

Update the `selected` type guard in `devUser`:

```ts
          .filter((r): r is DevRoleOption => Boolean(r));
```

- [ ] **Step 5: Run the dev tests and verify GREEN**

Run:

```bash
npm run test -- src/config/dev.test.ts
```

Expected result: PASS.

- [ ] **Step 6: Commit Task 5**

Run:

```bash
git add src/config/dev.ts src/config/dev.test.ts src/context/AuthContext.tsx
git commit -m "feat(dev): normalize role family toggles"
```

---

### Task 6: Final Verification

**Files:**
- Test only

**Interfaces:**
- Consumes all previous task outputs
- Produces verified working tree without build artifacts

- [ ] **Step 1: Run backend tests**

Run:

```bash
node --test server/lib/roleFamilies.test.js
node --test server/lib/roleUsage.test.js
node --test server/lib/userProfile.test.js
node --test server/lib/employeeLink.test.js
```

Expected result: all commands PASS.

- [ ] **Step 2: Run focused frontend tests**

Run:

```bash
npm run test -- src/components/lis/access/RoleEditDialog.test.tsx src/lib/dashboardProfiles.test.ts src/lib/roles.test.ts src/config/dev.test.ts
```

Expected result: PASS.

- [ ] **Step 3: Run TypeScript validation**

Run:

```bash
npx tsc --noEmit
```

Expected result: PASS with no TypeScript errors.

- [ ] **Step 4: Inspect the diff**

Run:

```bash
git diff -- server/lib/roleFamilies.js server/lib/roleFamilies.test.js server/models/Role.js server/routes/accessControl.js server/seed-access-control.js src/components/lis/access/types.ts src/components/lis/access/RoleEditDialog.tsx src/components/lis/access/RoleEditDialog.test.tsx src/components/lis/access/RolesTab.tsx src/components/lis/access/RoleCard.tsx src/pages/AccessControl.tsx src/lib/dashboardProfiles.ts src/lib/dashboardProfiles.test.ts src/pages/RoleDashboard.tsx
```

Expected result:

- No generated `assets/` files changed.
- `Role.family` is persisted and formatted.
- `POST /roles` rejects missing or invalid `family`.
- User role saves call the role-family helper before `save()`.
- `lab-analyze` and `qc-staff` are created when missing and marked with family.
- `RoleDashboard` uses `resolveDashboardRole(roles)`.
- Role create/edit UI submits `family`.

- [ ] **Step 5: Confirm prohibited build commands were not run**

Check shell history for the current work session and confirm none of these commands were run:

```text
npm run build
npm run build:dev
npm run build:watch
vite build
```

- [ ] **Step 6: Commit final verification adjustments if any**

If verification required small fixes, commit only the changed source and test files:

```bash
git status --short
git add <changed source and test files>
git commit -m "fix(access): verify role family auto roles"
```

If no fixes were needed after Task 4, do not create an empty commit.

---

## Self-Review Notes

- Spec coverage: Task 1 covers role-family mapping, prefix fallback, de-duplication, preserving existing roles, and both-family users. Task 2 covers persistence, route enforcement, Microsoft login sync, manual employee linking, HR sync, and required family on new roles. Task 3 covers the home dashboard behavior. Task 4 covers the role creation/editing UI. Task 5 covers devmode role-family toggle behavior and fallback to `admin`.
- Placeholder scan: The plan contains no `TBD`, no `TODO`, no "fill in" steps, and every code-changing step includes concrete code.
- Type consistency: Backend uses `family`; frontend uses `RoleFamily = "" | "lab" | "qc"`; create/update callbacks carry `{ name, description, family }`; dashboard resolver name is consistently `resolveDashboardRole`.
