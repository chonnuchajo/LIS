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
    { id: 'u1', email: 'a@x.com', employeeId: '' },
    { id: 'u2', email: 'b@x.com', employeeId: '7' },
    { id: 'u3', email: 'none@x.com', employeeId: '' },
  ];
  const employees = [
    { employeeId: '1', email: 'a@x.com', name: 'นายเอ', department: 'Lab', position: 'Analyst' },
  ];
  const plan = planEmployeeSync(users, employees);
  assert.strictEqual(plan.linked, 1);
  assert.strictEqual(plan.alreadyLinked, 1);
  assert.strictEqual(plan.unmatched, 1);
  assert.deepStrictEqual(plan.updates, [
    { userId: 'u1', employeeId: '1', name: 'นายเอ', department: 'Lab', position: 'Analyst' },
  ]);
});

test('planEmployeeSync matches a mixed-case user email', () => {
  const users = [{ id: 'u1', email: 'A@X.com', employeeId: '' }];
  const employees = [{ employeeId: '1', email: 'a@x.com', name: 'นายเอ', department: 'Lab', position: 'Analyst' }];
  const plan = planEmployeeSync(users, employees);
  assert.strictEqual(plan.linked, 1);
  assert.deepStrictEqual(plan.updates, [
    { userId: 'u1', employeeId: '1', name: 'นายเอ', department: 'Lab', position: 'Analyst' },
  ]);
});

test('MONTHLY_TYPE is the Thai monthly label', () => {
  assert.strictEqual(MONTHLY_TYPE, 'รายเดือน');
});
