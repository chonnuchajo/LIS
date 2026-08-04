const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { formatCoaNo } = require('./coaNumber');
const CoaDocument = require('../models/CoaDocument');
const CoaAuditLog = require('../models/CoaAuditLog');
const {
  assertCanTransition,
  isQcHead,
  activePrintableStatuses,
  canPrintStatus,
  assertValidCancellation,
  buildCoaAuditEvent,
  assertCanEditSnapshots,
  assertCanSupersede,
  buildSupersessionUpdate,
} = require('./coaLifecycle');

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
  assert.doesNotThrow(() => assertCanTransition('pendingApproval', 'approve', { role: 'qc-head' }));
  assert.doesNotThrow(() => assertCanTransition('approved', 'revise'));
  assert.doesNotThrow(() => assertCanTransition('printed', 'cancel', { permissions: ['coa.approve'] }));
  assert.doesNotThrow(() => assertCanTransition('reissued', 'print'));

  assert.throws(() => assertCanTransition('pendingApproval', 'approve'), /QC Head required to approve COA/);
  assert.throws(() => assertCanTransition('pendingApproval', 'approve', { role: 'lab-staff' }), /QC Head required to approve COA/);
  assert.throws(() => assertCanTransition('draft', 'approve', { role: 'qc-head' }), /Cannot approve COA from draft/);
  assert.throws(() => assertCanTransition('pendingApproval', 'print'), /Cannot print COA from pendingApproval/);
  assert.throws(() => assertCanTransition('cancelled', 'print'), /Cannot print COA from cancelled/);
});

test('rejection and cancellation require QC Head and cancellation requires a reason', () => {
  assert.doesNotThrow(() => assertCanTransition('pendingApproval', 'reject', { position: 'QC Head' }));
  assert.throws(() => assertCanTransition('pendingApproval', 'reject', { role: 'lab-staff' }), /QC Head required to reject COA/);
  assert.doesNotThrow(() => assertValidCancellation('Correction required'));
  assert.throws(() => assertValidCancellation('  '), /COA cancellation reason is required/);
  assert.throws(() => assertCanTransition('approved', 'cancel', { role: 'lab-staff' }), /QC Head required to cancel COA/);
});

test('audit event helper requires event, actor identity, and a timestamp-ready payload', () => {
  const event = buildCoaAuditEvent({
    event: 'approved',
    actor: { name: 'QC Head', email: 'qc@example.com', role: 'qc-head' },
    coaId: 'coa-id',
  });
  assert.equal(event.event, 'approved');
  assert.deepEqual(event.actor, { name: 'QC Head', email: 'qc@example.com', role: 'qc-head' });
  assert.equal(event.coaId, 'coa-id');
  assert.ok(event.createdAt instanceof Date);
  assert.throws(() => buildCoaAuditEvent({ event: 'approved', actor: { name: 'QC Head' } }), /actor email is required/);
});

test('snapshot edits are allowed only for draft documents', () => {
  assert.doesNotThrow(() => assertCanEditSnapshots('draft'));
  assert.doesNotThrow(() => assertCanEditSnapshots('revisionDraft'));
  assert.throws(() => assertCanEditSnapshots('approved'), /Cannot edit COA snapshots from approved/);
  assert.throws(() => assertCanEditSnapshots('reissued'), /Cannot edit COA snapshots from reissued/);
});

test('revision approval supersedes an active source and reissues the revision', () => {
  assert.doesNotThrow(() => assertCanSupersede('printed'));
  assert.throws(() => assertCanSupersede('draft'), /Cannot supersede COA from draft/);
  assert.deepEqual(
    buildSupersessionUpdate({ sourceCoaId: 'source-id', replacementCoaId: 'revision-id', sourceStatus: 'approved' }),
    {
      source: { status: 'superseded', supersededByCoaId: 'revision-id' },
      replacement: { status: 'reissued', supersedesCoaId: 'source-id' },
    },
  );
});

test('COA document and audit schemas reject missing cancellation and actor identity data', () => {
  const coa = new CoaDocument({
    petitionId: new mongoose.Types.ObjectId(),
    cancel: { reason: '   ' },
  });
  assert.match(coa.validateSync().errors['cancel.reason'].message, /cancellation reason is required/);

  const audit = new CoaAuditLog({
    coaId: new mongoose.Types.ObjectId(),
    event: 'approved',
    actor: { name: ' ', email: '' },
  });
  const auditErrors = audit.validateSync().errors;
  assert.ok(auditErrors['actor.name']);
  assert.ok(auditErrors['actor.email']);
});

test('printable statuses exclude pending, cancelled, and superseded documents', () => {
  assert.equal(activePrintableStatuses.has('approved'), true);
  assert.equal(activePrintableStatuses.has('printed'), true);
  assert.equal(activePrintableStatuses.has('reissued'), true);
  assert.equal(activePrintableStatuses.has('pendingApproval'), false);
  assert.equal(activePrintableStatuses.has('cancelled'), false);
  assert.equal(activePrintableStatuses.has('superseded'), false);
  assert.equal(canPrintStatus('approved'), true);
  assert.equal(Object.isFrozen(activePrintableStatuses), true);
});
