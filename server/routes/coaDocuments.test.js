const test = require('node:test');
const assert = require('node:assert/strict');
const {
  selectedItemsFromPetition,
  buildCoaSnapshots,
  isQcHead,
} = require('../lib/coaLifecycle');
const router = require('./coaDocuments');
const CoaDocument = require('../models/CoaDocument');
const CoaAuditLog = require('../models/CoaAuditLog');
const Petition = require('../models/Petition');
const LabRequest = require('../models/LabRequest');
const QCTestResult = require('../models/QCTestResult');
const Parameter = require('../models/Parameter');
const User = require('../models/User');
const Role = require('../models/Role');

function handler(path, method) {
  const layer = router.stack.find((entry) => entry.route
    && entry.route.path === path
    && entry.route.methods[method]);
  return layer.route.stack[0].handle;
}

function response() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

async function invoke(path, method, { body = {}, params = {}, query = {} } = {}) {
  const res = response();
  await handler(path, method)({ body, params, query }, res);
  return res;
}

function stubActorLookup({
  user = { name: 'QC Head', email: 'qc@example.com', role: 'qc-head', roles: ['qc-head'], status: 'active', position: 'QC Head' },
  rolePermissions = [],
} = {}) {
  const originalUserFindOne = User.findOne;
  const originalRoleFind = Role.find;
  User.findOne = () => ({ lean: async () => user });
  Role.find = () => ({ lean: async () => [{ id: user.role, permissions: rolePermissions }] });
  return () => {
    User.findOne = originalUserFindOne;
    Role.find = originalRoleFind;
  };
}

test('selectedItemsFromPetition returns only requested item seqs in petition order', () => {
  const petition = {
    items: [
      { seq: 1, sampleName: 'A' },
      { seq: 2, sampleName: 'B' },
      { seq: 3, sampleName: 'C' },
    ],
  };

  assert.deepEqual(selectedItemsFromPetition(petition, [3, 1]).map((item) => item.seq), [1, 3]);
});

test('selectedItemsFromPetition rejects missing item seqs', () => {
  const petition = { items: [{ seq: 1, sampleName: 'A' }] };

  assert.throws(
    () => selectedItemsFromPetition(petition, [1, 9]),
    /Invalid COA item seqs: 9/,
  );
});

test('buildCoaSnapshots freezes selected sample and lab result data', () => {
  const snapshots = buildCoaSnapshots({
    petition: {
      petitionNo: 'P-2608-0001',
      submittedBy: { name: 'Petition Requester' },
      items: [
        { seq: 1, sampleName: 'Ignore', commonName: 'Ignore' },
        {
          seq: 2,
          sampleName: 'Selected',
          commonName: 'Selected Common',
          batchNo: 'B-2',
          lotNo: 'L-2',
          labelManufacturer: 'Manufacturer',
        },
      ],
    },
    labRequests: [{
      reportCustomerName: 'Report Customer',
      requester: { fullName: 'Keyer Name', department: 'Quality', email: 'customer@example.com', phone: '1234' },
    }],
    parameters: [
      { _id: 'qc-parameter', scope: 'qc' },
      { _id: 'physical-parameter', name: 'กายภาพ', scope: 'qc' },
      { _id: 'lab-parameter', scope: 'lab' },
    ],
    qcResults: [
      { itemSeq: 1, parameterId: 'lab-parameter', values: { Assay: 'Ignored' } },
      { itemSeq: 2, parameterId: 'qc-parameter', values: { Appearance: 'Ignored' } },
      { itemSeq: 2, parameterId: 'physical-parameter', parameterName: 'กายภาพ', values: { 'ลักษณะ': 'ของเหลวใส', 'สี': 'สีส้ม' } },
      { itemSeq: 2, parameterId: 'lab-parameter', values: { Assay: 99.5, Moisture: '' } },
    ],
    selectedItemSeqs: [2],
  });

  assert.equal(snapshots.petitionNoSnapshot, 'P-2608-0001');
  assert.deepEqual(snapshots.customerSnapshot, {
    name: 'Keyer Name',
    company: 'Report Customer',
    department: 'Quality',
    email: 'customer@example.com',
    phone: '1234',
  });
  assert.deepEqual(snapshots.sampleSnapshots, [{
    itemSeq: 2,
    sampleName: 'Selected',
    commonName: 'Selected Common',
    batchNo: 'B-2',
    lotNo: 'L-2',
    productionDate: '',
    sampleId: '',
    condition: 'ของเหลวใส สีส้ม',
    manufacturer: 'Manufacturer',
  }]);
  assert.deepEqual(snapshots.resultSnapshots, [
    { itemSeq: 2, testItem: 'Assay', result: '99.5', criteria: '-', method: '-', unit: '' },
    { itemSeq: 2, testItem: 'Moisture', result: '-', criteria: '-', method: '-', unit: '' },
  ]);
});

test('buildCoaSnapshots applies AI tolerance criteria from the common-name percent', () => {
  const snapshots = buildCoaSnapshots({
    petition: {
      petitionNo: 'P-2608-AI',
      items: [{ seq: 1, sampleName: 'Liquid', commonName: 'Glyphosate 48% SL', batchNo: 'B-AI' }],
    },
    parameters: [{ _id: 'lab-parameter', scope: 'lab' }],
    qcResults: [{
      itemSeq: 1,
      parameterId: 'lab-parameter',
      parameterName: '%AI content (W/V)',
      values: { '%AI content (W/V)': '47.9%' },
    }],
    selectedItemSeqs: [1],
  });

  assert.deepEqual(snapshots.resultSnapshots, [
    { itemSeq: 1, testItem: '%AI content (W/V)', result: '47.9%', criteria: '48% ± 2.40', method: '-', unit: '' },
  ]);
  assert.deepEqual(snapshots.trendSnapshots, [
    { itemSeq: 1, sampleName: 'Liquid', commonName: 'Glyphosate 48% SL', aiLabelPercent: 48, aiResultPercent: 47.9, aiResultText: '47.9%' },
  ]);
});

test('buildCoaSnapshots includes multi-entry and phase-two lab values without internal fields', () => {
  const snapshots = buildCoaSnapshots({
    petition: {
      petitionNo: 'P-2608-0002',
      items: [{ seq: 1, sampleName: 'Sample' }],
    },
    parameters: [{ _id: 'lab-parameter', scope: 'lab' }],
    qcResults: [{
      itemSeq: 1,
      parameterId: 'lab-parameter',
      parameterName: 'Density',
      values: { Density: 1.1 },
      entries: [
        { Temperature: 25, Temperature__source: { instrument: 'DMA' }, __note: 'internal' },
        { Temperature: 26 },
      ],
      valuesPhase2: { After: 27, After__source: { instrument: 'DMA' } },
    }],
    selectedItemSeqs: [1],
  });

  assert.deepEqual(snapshots.resultSnapshots, [
    { itemSeq: 1, testItem: 'Density - Temperature', result: '25', criteria: '-', method: '-', unit: '' },
    { itemSeq: 1, testItem: 'Density - Temperature', result: '26', criteria: '-', method: '-', unit: '' },
    { itemSeq: 1, testItem: 'Density - After', result: '27', criteria: '-', method: '-', unit: '' },
  ]);
});

test('actorFromRequest uses stored active user roles instead of caller supplied privileges', async () => {
  const restore = stubActorLookup({
    user: { name: 'Stored Staff', email: 'staff@example.com', role: 'qc-staff', roles: ['qc-staff'], status: 'active', position: 'QC Staff' },
  });
  try {
    const actor = await router.actorFromRequest({
      _user: { name: 'Fake Head', email: 'staff@example.com', role: 'qc-head', permissions: ['coa.approve'] },
    });
    assert.equal(actor.name, 'Stored Staff');
    assert.equal(actor.role, 'qc-staff');
    assert.deepEqual(actor.permissions, []);
    assert.equal(isQcHead(actor), false);
  } finally {
    restore();
  }
});

test('actorFromRequest rejects inactive users', async () => {
  const restore = stubActorLookup({
    user: { name: 'Inactive', email: 'inactive@example.com', role: 'qc-head', roles: ['qc-head'], status: 'inactive' },
  });
  try {
    await assert.rejects(
      () => router.actorFromRequest({ _user: { name: 'Inactive', email: 'inactive@example.com', role: 'qc-head' } }),
      /Inactive users cannot issue COA documents/,
    );
  } finally {
    restore();
  }
});

test('approve route rejects non-QC Head actors before reading the document', async () => {
  const restore = stubActorLookup({
    user: { name: 'Lab User', email: 'lab@example.com', role: 'lab-staff', roles: ['lab-staff'], status: 'active' },
  });
  try {
  const res = await invoke('/:id/approve', 'post', {
    params: { id: '507f1f77bcf86cd799439011' },
    body: { _user: { name: 'Lab User', email: 'lab@example.com', role: 'lab_staff' } },
  });

  assert.equal(res.statusCode, 403);
  assert.match(res.body.error, /QC Head/);
  } finally {
    restore();
  }
});

test('approve route validates transition before snapshot work', async () => {
  const originalFindById = CoaDocument.findById;
  const originalPetitionFindById = Petition.findById;
  const restoreActor = stubActorLookup();
  try {
    CoaDocument.findById = async () => ({
      _id: 'coa-id',
      status: 'draft',
      petitionId: 'petition-id',
      selectedItemSeqs: [1],
    });
    Petition.findById = () => {
      throw new Error('snapshot lookup must not occur for an invalid transition');
    };
    const res = await invoke('/:id/approve', 'post', {
      params: { id: '507f1f77bcf86cd799439011' },
      body: { _user: { name: 'QC Head', email: 'qc@example.com', role: 'qc_head' } },
    });

    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /Cannot approve COA from draft/);
  } finally {
    CoaDocument.findById = originalFindById;
    Petition.findById = originalPetitionFindById;
    restoreActor();
  }
});

test('print-event route rejects non-printable pending COAs', async () => {
  const originalFindById = CoaDocument.findById;
  const restoreActor = stubActorLookup();
  try {
    CoaDocument.findById = async () => ({
      _id: 'coa-id',
      status: 'pendingApproval',
      save: async () => {},
    });
    const res = await invoke('/:id/print-event', 'post', {
      params: { id: '507f1f77bcf86cd799439011' },
      body: { _user: { name: 'QC User', email: 'qc@example.com', role: 'qc_head' } },
    });

    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /Cannot print COA from pendingApproval/);
  } finally {
    CoaDocument.findById = originalFindById;
    restoreActor();
  }
});

test('cancel route requires a reason and records the cancellation history', async () => {
  const originalFindById = CoaDocument.findById;
  const originalCreate = CoaAuditLog.create;
  const restoreActor = stubActorLookup();
  const audits = [];
  const doc = {
    _id: 'coa-id',
    status: 'approved',
    petitionId: 'petition-id',
    petitionNoSnapshot: 'P-1',
    save: async () => {},
  };
  try {
    CoaDocument.findById = async () => doc;
    CoaAuditLog.create = async (audit) => audits.push(audit);
    const missingReason = await invoke('/:id/cancel', 'post', {
      params: { id: '507f1f77bcf86cd799439011' },
      body: { _user: { name: 'QC User', email: 'qc@example.com', role: 'qc_head' } },
    });
    assert.equal(missingReason.statusCode, 400);

    const res = await invoke('/:id/cancel', 'post', {
      params: { id: '507f1f77bcf86cd799439011' },
      body: {
        reason: 'Corrected customer details',
        _user: { name: 'QC User', email: 'qc@example.com', role: 'qc_head' },
      },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(doc.status, 'cancelled');
    assert.equal(doc.cancel.reason, 'Corrected customer details');
    assert.equal(audits[0].event, 'cancelled');
    assert.equal(audits[0].actor.email, 'qc@example.com');
  } finally {
    CoaDocument.findById = originalFindById;
    CoaAuditLog.create = originalCreate;
    restoreActor();
  }
});

test('create route validates actor before insert and stores review snapshots', async () => {
  const originals = {
    create: CoaDocument.create,
    auditCreate: CoaAuditLog.create,
    petitionFindById: Petition.findById,
    labRequestFind: LabRequest.find,
    qcResultFind: QCTestResult.find,
    parameterFind: Parameter.find,
  };
  const restoreActor = stubActorLookup({
    user: { name: 'Lab User', email: 'lab@example.com', role: 'lab-staff', roles: ['lab-staff'], status: 'active' },
  });
  const writes = [];
  try {
    Petition.findById = () => ({ lean: async () => ({
      _id: '507f1f77bcf86cd799439031',
      petitionNo: 'P-1',
      labApprovedAt: new Date(),
      items: [{ seq: 1, sampleName: 'Sample', commonName: 'Glyphosate 48% SL' }],
    }) });
    LabRequest.find = () => ({ lean: async () => [{ petitionId: '507f1f77bcf86cd799439031', sampleSeq: 1 }] });
    QCTestResult.find = () => ({ lean: async () => [{ itemSeq: 1, parameterId: 'lab-param', parameterName: '%AI content (W/V)', values: { '%AI content (W/V)': '47.9%' } }] });
    Parameter.find = () => ({ lean: async () => [{ _id: 'lab-param', scope: 'lab' }] });
    CoaDocument.create = async (payload) => {
      writes.push(payload);
      return { _id: 'coa-id', ...payload };
    };
    CoaAuditLog.create = async () => {};

    const missingActor = await invoke('/', 'post', {
      body: { petitionId: '507f1f77bcf86cd799439031', selectedItemSeqs: [1] },
    });
    assert.equal(missingActor.statusCode, 400);
    assert.equal(writes.length, 0);

    const res = await invoke('/', 'post', {
      body: {
        petitionId: '507f1f77bcf86cd799439031',
        selectedItemSeqs: [1],
        _user: { name: 'Lab User', email: 'lab@example.com', role: 'lab-staff' },
      },
    });
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.sampleSnapshots.length, 1);
    assert.deepEqual(res.body.resultSnapshots, [
      { itemSeq: 1, testItem: '%AI content (W/V)', result: '47.9%', criteria: '48% ± 2.40', method: '-', unit: '' },
    ]);
    assert.deepEqual(res.body.trendSnapshots, [
      { itemSeq: 1, sampleName: 'Sample', commonName: 'Glyphosate 48% SL', aiLabelPercent: 48, aiResultPercent: 47.9, aiResultText: '47.9%' },
    ]);
  } finally {
    CoaDocument.create = originals.create;
    CoaAuditLog.create = originals.auditCreate;
    Petition.findById = originals.petitionFindById;
    LabRequest.find = originals.labRequestFind;
    QCTestResult.find = originals.qcResultFind;
    Parameter.find = originals.parameterFind;
    restoreActor();
  }
});

test('revision approval saves, supersedes, and audits in one transaction session', async () => {
  const originals = {
    findById: CoaDocument.findById,
    startSession: CoaDocument.startSession,
    updateOne: CoaDocument.updateOne,
    auditCreate: CoaAuditLog.create,
    petitionFindById: Petition.findById,
    labRequestFind: LabRequest.find,
    qcResultFind: QCTestResult.find,
    parameterFind: Parameter.find,
  };
  const restoreActor = stubActorLookup();
  const revisionId = '507f1f77bcf86cd799439011';
  const sourceId = '507f1f77bcf86cd799439012';
  const session = {
    withTransaction: async (callback) => callback(),
    endSession: async () => {},
  };
  const saveOptions = [];
  const updates = [];
  const audits = [];
  const revision = {
    _id: revisionId,
    status: 'pendingRevisionApproval',
    coaNo: '00012026',
    petitionId: 'petition-id',
    petitionNoSnapshot: 'P-1',
    selectedItemSeqs: [1],
    sourceCoaId: sourceId,
    approval: {},
    $locals: {},
    $session: () => {},
    save: async (options) => saveOptions.push(options),
  };
  try {
    CoaDocument.findById = (id) => {
      if (String(id) === revisionId) return Promise.resolve(revision);
      return {
        session: (receivedSession) => {
          assert.equal(receivedSession, session);
          return {
            select: () => ({
              lean: async () => ({
                _id: sourceId,
                status: 'approved',
                coaNo: '00012026',
                petitionId: 'petition-id',
                petitionNoSnapshot: 'P-1',
              }),
            }),
          };
        },
      };
    };
    CoaDocument.startSession = async () => session;
    CoaDocument.updateOne = async (filter, update, options) => {
      updates.push({ filter, update, options });
      return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
    };
    CoaAuditLog.create = async (...args) => audits.push(args);
    Petition.findById = () => ({ lean: async () => ({ petitionNo: 'P-1', labApprovedAt: new Date(), items: [{ seq: 1, sampleName: 'Sample' }] }) });
    LabRequest.find = () => ({ lean: async () => [{ petitionId: 'petition-id', sampleSeq: 1 }] });
    QCTestResult.find = () => ({ lean: async () => [] });
    Parameter.find = () => ({ lean: async () => [] });

    const res = await invoke('/:id/approve', 'post', {
      params: { id: revisionId },
      body: { _user: { name: 'QC Head', email: 'qc@example.com', role: 'qc_head' } },
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(saveOptions, [{ session }]);
    assert.deepEqual(updates[0].update.$set.updatedBy, {
      name: 'QC Head',
      email: 'qc@example.com',
      role: 'qc-head',
      activeRole: 'qc-head',
      roles: ['qc-head'],
      permissions: [],
      position: 'QC Head',
    });
    assert.deepEqual(updates[0].options.session, session);
    assert.deepEqual(audits.map((args) => args[0].event).sort(), ['revisionApproved', 'superseded']);
    assert.ok(audits.every((args) => args[1]?.session === session));
  } finally {
    CoaDocument.findById = originals.findById;
    CoaDocument.startSession = originals.startSession;
    CoaDocument.updateOne = originals.updateOne;
    CoaAuditLog.create = originals.auditCreate;
    Petition.findById = originals.petitionFindById;
    LabRequest.find = originals.labRequestFind;
    QCTestResult.find = originals.qcResultFind;
    Parameter.find = originals.parameterFind;
    restoreActor();
  }
});

test('revision approval aborts without activating the revision when supersession fails', async () => {
  const originals = {
    findById: CoaDocument.findById,
    startSession: CoaDocument.startSession,
    updateOne: CoaDocument.updateOne,
    auditCreate: CoaAuditLog.create,
    petitionFindById: Petition.findById,
    labRequestFind: LabRequest.find,
    qcResultFind: QCTestResult.find,
    parameterFind: Parameter.find,
  };
  const restoreActor = stubActorLookup();
  const revisionId = '507f1f77bcf86cd799439021';
  const sourceId = '507f1f77bcf86cd799439022';
  const persistedRevision = { status: 'pendingRevisionApproval' };
  const persistedSource = { status: 'approved' };
  const pendingWrites = [];
  const session = {
    aborted: false,
    withTransaction: async (callback) => {
      try {
        await callback();
        pendingWrites.forEach((write) => write());
      } catch (error) {
        session.aborted = true;
        throw error;
      }
    },
    endSession: async () => {},
  };
  const revision = {
    _id: revisionId,
    status: 'pendingRevisionApproval',
    coaNo: '00012026',
    petitionId: 'petition-id',
    petitionNoSnapshot: 'P-1',
    selectedItemSeqs: [1],
    sourceCoaId: sourceId,
    approval: {},
    $locals: {},
    $session: () => {},
    save: async (options) => {
      if (options?.session !== session) throw new Error('revision save must use the transaction session');
      pendingWrites.push(() => { persistedRevision.status = revision.status; });
    },
  };
  try {
    CoaDocument.findById = (id) => {
      if (String(id) === revisionId) return Promise.resolve(revision);
      return {
        session: () => ({
          select: () => ({
            lean: async () => ({
              _id: sourceId,
              status: persistedSource.status,
              coaNo: '00012026',
              petitionId: 'petition-id',
              petitionNoSnapshot: 'P-1',
            }),
          }),
        }),
      };
    };
    CoaDocument.startSession = async () => session;
    CoaDocument.updateOne = async () => {
      throw new Error('source supersession failed');
    };
    CoaAuditLog.create = async () => {};
    Petition.findById = () => ({ lean: async () => ({ petitionNo: 'P-1', labApprovedAt: new Date(), items: [{ seq: 1, sampleName: 'Sample' }] }) });
    LabRequest.find = () => ({ lean: async () => [{ petitionId: 'petition-id', sampleSeq: 1 }] });
    QCTestResult.find = () => ({ lean: async () => [] });
    Parameter.find = () => ({ lean: async () => [] });

    const res = await invoke('/:id/approve', 'post', {
      params: { id: revisionId },
      body: { _user: { name: 'QC Head', email: 'qc@example.com', role: 'qc_head' } },
    });

    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /source supersession failed/);
    assert.equal(session.aborted, true);
    assert.equal(persistedRevision.status, 'pendingRevisionApproval');
    assert.equal(persistedSource.status, 'approved');
  } finally {
    CoaDocument.findById = originals.findById;
    CoaDocument.startSession = originals.startSession;
    CoaDocument.updateOne = originals.updateOne;
    CoaAuditLog.create = originals.auditCreate;
    Petition.findById = originals.petitionFindById;
    LabRequest.find = originals.labRequestFind;
    QCTestResult.find = originals.qcResultFind;
    Parameter.find = originals.parameterFind;
    restoreActor();
  }
});
