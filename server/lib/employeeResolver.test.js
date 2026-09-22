const test = require('node:test');
const assert = require('node:assert/strict');
const directory = require('./employeeDirectory');
const { resolveEmployeeActor } = require('./employeeResolver');

test('resolveEmployeeActor prefers HR email and snapshots department', async (context) => {
  context.mock.method(directory, 'fetchActiveEmployees', async () => [{
    employeeId: 'E-100',
    name: 'นางสาวเอ',
    email: 'a@example.com',
    department: 'ผลิต 01',
    position: 'เจ้าหน้าที่',
  }]);

  const actor = await resolveEmployeeActor({
    employeeId: 'production-system',
    name: 'Production System',
    email: 'A@EXAMPLE.COM',
    department: 'production',
  });

  assert.deepEqual(actor, {
    employeeId: 'E-100',
    name: 'นางสาวเอ',
    email: 'a@example.com',
    department: 'ผลิต 01',
    position: 'เจ้าหน้าที่',
  });
});

test('resolveEmployeeActor falls back to the original snapshot when HR is unavailable', async (context) => {
  context.mock.method(directory, 'fetchActiveEmployees', async () => {
    throw new Error('HR unavailable');
  });

  const actor = await resolveEmployeeActor({
    employeeId: 'E-200',
    name: 'ผู้ส่ง',
    email: 'sender@example.com',
    department: 'ผลิต',
  });

  assert.deepEqual(actor, {
    employeeId: 'E-200',
    name: 'ผู้ส่ง',
    email: 'sender@example.com',
    department: 'ผลิต',
  });
});
