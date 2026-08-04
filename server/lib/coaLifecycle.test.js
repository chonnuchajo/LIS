const test = require('node:test');
const assert = require('node:assert/strict');
const { formatCoaNo } = require('./coaNumber');
const { assertCanTransition, isQcHead, activePrintableStatuses } = require('./coaLifecycle');

test('formatCoaNo pads sequence to four digits and appends Gregorian year', () => {
  assert.equal(formatCoaNo(1, 2026), '00012026');
  assert.equal(formatCoaNo(22, 2026), '00222026');
  assert.equal(formatCoaNo(10000, 2026), '100002026');
});

test('QC Head role detection accepts role, activeRole, permission, and position signals', () => {
  assert.equal(isQcHead({ role: 'qc-head' }), true);
  assert.equal(isQcHead({ activeRole: 'qc_head' }), true);
  assert.equal(isQcHead({ permissions: ['coa.approve'] }), true);
  assert.equal(isQcHead({ position: 'QC Head' }), true);
  assert.equal(isQcHead({ role: 'lab-staff' }), false);
});

test('lifecycle allows submit, approve, revise, cancel, and print only from valid statuses', () => {
  assert.doesNotThrow(() => assertCanTransition('draft', 'submit'));
  assert.doesNotThrow(() => assertCanTransition('pendingApproval', 'approve'));
  assert.doesNotThrow(() => assertCanTransition('approved', 'revise'));
  assert.doesNotThrow(() => assertCanTransition('printed', 'cancel'));
  assert.doesNotThrow(() => assertCanTransition('reissued', 'print'));

  assert.throws(() => assertCanTransition('draft', 'approve'), /Cannot approve COA from draft/);
  assert.throws(() => assertCanTransition('pendingApproval', 'print'), /Cannot print COA from pendingApproval/);
  assert.throws(() => assertCanTransition('cancelled', 'print'), /Cannot print COA from cancelled/);
});

test('printable statuses exclude pending, cancelled, and superseded documents', () => {
  assert.equal(activePrintableStatuses.has('approved'), true);
  assert.equal(activePrintableStatuses.has('printed'), true);
  assert.equal(activePrintableStatuses.has('reissued'), true);
  assert.equal(activePrintableStatuses.has('pendingApproval'), false);
  assert.equal(activePrintableStatuses.has('cancelled'), false);
  assert.equal(activePrintableStatuses.has('superseded'), false);
});
