const test = require('node:test');
const assert = require('node:assert');
const { hasLabAnalystRole, userToAssignee, mergeAssignees } = require('./assignees');

test('hasLabAnalystRole matches lab-analyst (canonical) and lab-analyze (legacy/typo)', () => {
  assert.strictEqual(hasLabAnalystRole(['lab-analyst']), true);
  assert.strictEqual(hasLabAnalystRole(['admin', 'lab-analyze']), true);
  assert.strictEqual(hasLabAnalystRole(['qc-staff', 'lab-head']), false);
  assert.strictEqual(hasLabAnalystRole(['lab-inventory']), false);
  assert.strictEqual(hasLabAnalystRole([]), false);
  assert.strictEqual(hasLabAnalystRole(undefined), false);
});

test('userToAssignee maps a User doc to the assignee shape with empType "role"', () => {
  const a = userToAssignee({
    employeeId: ' 11604 ',
    name: '  นางสาวเกศกนก ',
    department: 'IT',
    position: 'IT Staff',
    status: 'active',
  });
  assert.deepStrictEqual(a, {
    id: 0,
    employeeId: '11604',
    name: 'นางสาวเกศกนก',
    department: 'IT',
    position: 'IT Staff',
    empType: 'role',
    isActive: true,
  });
});

test('userToAssignee marks inactive users', () => {
  assert.strictEqual(userToAssignee({ status: 'inactive', name: 'x', employeeId: '1' }).isActive, false);
});

test('mergeAssignees dedupes by employeeId, HR (dept) entry wins', () => {
  const dept = [{ employeeId: '11604', name: 'HR Name', department: 'Lab/วิเคราะห์', empType: 'รายเดือน' }];
  const role = [{ employeeId: '11604', name: 'Role Name', department: 'IT', empType: 'role' }];
  const merged = mergeAssignees(dept, role);
  assert.strictEqual(merged.length, 1);
  assert.strictEqual(merged[0].name, 'HR Name');
  assert.strictEqual(merged[0].empType, 'รายเดือน');
});

test('mergeAssignees keeps a role user with a different employeeId', () => {
  const dept = [{ employeeId: '11604', name: 'HR Name' }];
  const role = [{ employeeId: '99999', name: 'Role Only', department: 'IT', empType: 'role' }];
  const merged = mergeAssignees(dept, role);
  assert.strictEqual(merged.length, 2);
  assert.strictEqual(merged[1].employeeId, '99999');
});

test('mergeAssignees dedupes by case-insensitive name when employeeId missing', () => {
  const merged = mergeAssignees(
    [{ employeeId: '', name: 'Same Person' }],
    [{ employeeId: '', name: 'same person', empType: 'role' }],
  );
  assert.strictEqual(merged.length, 1);
});

test('mergeAssignees drops entries with no employeeId and no name', () => {
  const merged = mergeAssignees([], [{ employeeId: '', name: '' }]);
  assert.strictEqual(merged.length, 0);
});
