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
