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
  writeCoaAuditEvent,
  assertCanEditSnapshots,
  assertCanSupersede,
  buildSupersessionUpdate,
  applySupersession,
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

test('cancelled COA documents require cancellation reason even when cancel payload is missing', async () => {
  const coa = new CoaDocument({
    petitionId: new mongoose.Types.ObjectId(),
    status: 'cancelled',
  });

  await assert.rejects(() => coa.validate(), /COA cancellation reason is required/);
});

test('issued COA snapshot fields cannot be modified without internal override', async () => {
  const issuedCoa = CoaDocument.hydrate({
    _id: new mongoose.Types.ObjectId(),
    petitionId: new mongoose.Types.ObjectId(),
    status: 'approved',
    customerSnapshot: { name: 'Original Customer' },
    sampleSnapshots: [{ itemSeq: 1, sampleName: 'Original Sample' }],
    resultSnapshots: [{ itemSeq: 1, testItem: 'Assay', result: 'Pass' }],
  });

  issuedCoa.customerSnapshot = { name: 'Edited Customer' };
  await assert.rejects(() => issuedCoa.validate(), /Cannot edit issued COA snapshots/);

  const overrideCoa = CoaDocument.hydrate({
    _id: new mongoose.Types.ObjectId(),
    petitionId: new mongoose.Types.ObjectId(),
    status: 'approved',
    customerSnapshot: { name: 'Original Customer' },
  });
  overrideCoa.customerSnapshot = { name: 'Frozen Approval Snapshot' };
  overrideCoa.$locals.allowIssuedSnapshotMutation = true;

  await assert.doesNotReject(() => overrideCoa.validate());
});

test('writeCoaAuditEvent persists a validated audit event', async () => {
  const createdRows = [];
  const stubAuditModel = {
    create: async (payload) => {
      createdRows.push(payload);
      return { _id: 'audit-id', ...payload };
    },
  };
  const doc = {
    _id: 'coa-id',
    coaNo: '00012026',
    petitionId: 'petition-id',
    petitionNoSnapshot: 'P-001',
  };

  const row = await writeCoaAuditEvent(
    doc,
    'approved',
    { name: 'QC Head', email: 'qc@example.com', role: 'qc-head' },
    'Approved for release',
    { status: 'approved' },
    stubAuditModel,
  );

  assert.equal(row._id, 'audit-id');
  assert.equal(createdRows.length, 1);
  assert.equal(createdRows[0].coaId, 'coa-id');
  assert.equal(createdRows[0].event, 'approved');
  assert.equal(createdRows[0].note, 'Approved for release');
  assert.deepEqual(createdRows[0].metadata, { status: 'approved' });
  assert.ok(createdRows[0].createdAt instanceof Date);

  await assert.rejects(
    () => writeCoaAuditEvent(doc, 'approved', { name: 'QC Head' }, null, null, stubAuditModel),
    /actor email is required/,
  );
});

test('applySupersession performs reciprocal source and revision updates', async () => {
  const calls = [];
  const stubCoaDocumentModel = {
    findById: (id) => ({
      select: () => ({
        lean: async () => ({ _id: id, status: 'printed' }),
      }),
    }),
    updateOne: async (filter, update) => {
      calls.push({ filter, update });
      return { acknowledged: true, modifiedCount: 1 };
    },
  };

  const result = await applySupersession({
    sourceCoaId: 'source-id',
    revisionCoaId: 'revision-id',
    CoaDocumentModel: stubCoaDocumentModel,
  });

  assert.deepEqual(result.source, { acknowledged: true, modifiedCount: 1 });
  assert.deepEqual(calls, [
    {
      filter: { _id: 'source-id' },
      update: { $set: { status: 'superseded', supersededByCoaId: 'revision-id' } },
    },
    {
      filter: { _id: 'revision-id' },
      update: { $set: { status: 'reissued', supersedesCoaId: 'source-id' } },
    },
  ]);

  const draftSourceModel = {
    findById: () => ({
      select: () => ({
        lean: async () => ({ status: 'draft' }),
      }),
    }),
    updateOne: async () => {
      throw new Error('updateOne should not be called for draft supersession source');
    },
  };
  await assert.rejects(
    () => applySupersession({
      sourceCoaId: 'draft-source-id',
      revisionCoaId: 'revision-id',
      CoaDocumentModel: draftSourceModel,
    }),
    /Cannot supersede COA from draft/,
  );
});

test('printable statuses exclude pending, cancelled, and superseded documents', () => {
  assert.equal(activePrintableStatuses instanceof Set, true);
  assert.equal(activePrintableStatuses.has('approved'), true);
  assert.equal(activePrintableStatuses.has('printed'), true);
  assert.equal(activePrintableStatuses.has('reissued'), true);
  assert.equal(activePrintableStatuses.has('pendingApproval'), false);
  assert.equal(activePrintableStatuses.has('cancelled'), false);
  assert.equal(activePrintableStatuses.has('superseded'), false);
  assert.equal(canPrintStatus('approved'), true);
});
