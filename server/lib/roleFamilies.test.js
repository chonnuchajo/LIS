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
