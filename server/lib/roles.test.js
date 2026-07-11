const test = require('node:test');
const assert = require('node:assert');
const { primaryRole, normalizeRoles, unionPermissions } = require('./roles');

test('primaryRole returns viewer for an empty list', () => {
  assert.strictEqual(primaryRole([]), 'viewer');
});

test('primaryRole ranks admin above every other role', () => {
  assert.strictEqual(primaryRole(['viewer', 'lab-head', 'admin', 'qc-head']), 'admin');
});

test('primaryRole ranks qc-head above lab-head', () => {
  assert.strictEqual(primaryRole(['lab-head', 'qc-head']), 'qc-head');
});

test('primaryRole ranks lab-head above staff working roles', () => {
  assert.strictEqual(primaryRole(['qc-staff', 'lab-head']), 'lab-head');
  assert.strictEqual(primaryRole(['lab-analyze', 'lab-head']), 'lab-head');
});

test('primaryRole ranks lab-analyze and qc-staff equally', () => {
  assert.strictEqual(primaryRole(['lab-analyze', 'qc-staff']), 'lab-analyze');
  assert.strictEqual(primaryRole(['qc-staff', 'lab-analyze']), 'qc-staff');
});

test('primaryRole ranks staff working roles above other non-viewer roles', () => {
  assert.strictEqual(primaryRole(['lab-inventory', 'lab-analyze']), 'lab-analyze');
  assert.strictEqual(primaryRole(['production', 'qc-staff']), 'qc-staff');
});

test('primaryRole ranks viewer lowest and breaks other-role ties by array order', () => {
  assert.strictEqual(primaryRole(['viewer', 'production']), 'production');
  assert.strictEqual(primaryRole(['production', 'lab']), 'production');
  assert.strictEqual(primaryRole(['lab', 'production']), 'lab');
});

test('normalizeRoles returns roles when present', () => {
  assert.deepStrictEqual(normalizeRoles({ roles: ['lab', 'qc'] }), ['lab', 'qc']);
});

test('normalizeRoles falls back to legacy single role', () => {
  assert.deepStrictEqual(normalizeRoles({ role: 'qc' }), ['qc']);
});

test('normalizeRoles prefers non-empty roles over legacy role', () => {
  assert.deepStrictEqual(normalizeRoles({ role: 'viewer', roles: ['admin'] }), ['admin']);
});

test('normalizeRoles returns empty array when nothing is set', () => {
  assert.deepStrictEqual(normalizeRoles({}), []);
});

test('unionPermissions unions permissions across roles and de-dupes', () => {
  const byRole = { lab: ['a', 'b'], qc: ['b', 'c'] };
  assert.deepStrictEqual(unionPermissions(['lab', 'qc'], byRole), ['a', 'b', 'c']);
});

test('unionPermissions ignores roles with no permission entry', () => {
  assert.deepStrictEqual(unionPermissions(['lab', 'ghost'], { lab: ['a'] }), ['a']);
});

test('unionPermissions returns empty array for no roles', () => {
  assert.deepStrictEqual(unionPermissions([], { lab: ['a'] }), []);
});
