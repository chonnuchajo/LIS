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

function sortedLimitedLean(items) {
  return {
    sort() {
      return {
        limit() {
          return { lean: async () => items };
        },
        lean: async () => items,
      };
    },
    lean: async () => items,
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

test('GET / includes requested COA rows for Lab-approved petitions without COA documents', async () => {
  const originals = {
    coaFind: CoaDocument.find,
    petitionFind: Petition.find,
    labRequestFind: LabRequest.find,
    fetch: global.fetch,
  };
  try {
    CoaDocument.find = () => sortedLimitedLean([]);
    Petition.find = () => sortedLimitedLean([{
      _id: 'petition-1',
      petitionNo: 'P-2609-0002',
      labApprovedAt: new Date('2026-09-05T09:46:39.203Z'),
      submittedBy: { name: 'Requester Name', email: 'requester@example.com' },
      items: [{ seq: 1, sampleName: 'Trade A', commonName: 'Common A', batchNo: 'B-001', lotNo: 'L-001', productionDate: '2026-09-01' }],
    }]);
    LabRequest.find = () => ({ lean: async () => [{
      petitionId: 'petition-1',
      sampleSeq: 1,
      reportCustomerName: 'Customer A',
      requester: { fullName: 'Requester Name', department: 'R&D', email: 'requester@example.com', phone: '1234' },
    }] });
    global.fetch = async () => ({ ok: true, status: 200, text: async () => '[]' });

    const res = await invoke('/', 'get');

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.items.length, 1);
    assert.deepEqual(res.body.items[0], {
      _id: 'requested:petition-1',
      coaNo: null,
      revision: 0,
      status: 'requested',
      petitionId: 'petition-1',
      petitionNoSnapshot: 'P-2609-0002',
      selectedItemSeqs: [1],
      customerSnapshot: {
        name: 'Requester Name',
        company: 'Customer A',
        department: 'R&D',
        email: 'requester@example.com',
        phone: '1234',
      },
      sampleSnapshots: [{ itemSeq: 1, sampleName: 'Trade A', commonName: 'Common A', batchNo: 'B-001', lotNo: 'L-001', productionDate: '2026-09-01', sampleId: '', condition: '', manufacturer: '' }],
      resultSnapshots: [],
      trendSnapshots: [],
      print: { printCount: 0 },
      createdAt: new Date('2026-09-05T09:46:39.203Z'),
      updatedAt: new Date('2026-09-05T09:46:39.203Z'),
    });
  } finally {
    CoaDocument.find = originals.coaFind;
    Petition.find = originals.petitionFind;
    LabRequest.find = originals.labRequestFind;
    global.fetch = originals.fetch;
  }
});

test('externalCoaRowsToDocuments maps only ERP rows that ask for COA', () => {
  const docs = router.externalCoaRowsToDocuments(JSON.stringify([
    {
      CompanySource: 'ICPL',
      SaleName: 'PIMSIRI',
      CustomerName: 'Customer A',
      SaleOrderNo: 'SO26040020',
      Line: 10000,
      SaleOrderDate: '2026-04-02T00:00:00.000Z',
      ItemNo: 'FC-CAVAL-1X16',
      TradeName: 'Carval',
      CommonName: 'SPIRODICLOFEN 24 % W/V SC',
      PackingSize: '16*1 L',
      Quantity: 100,
      OutstandingQty: 100,
      Unit: 'carton',
      PendingStatus: 'pending shipment',
      UpdateDate: '2026-04-02T04:02:29.360Z',
      ShipmentDate: '2026-05-26T00:00:00.000Z',
      remark: 'send with COA',
    },
    {
      CustomerName: 'Customer B',
      SaleOrderNo: 'SO26040021',
      Line: 10000,
      remark: 'no special document',
    },
  ]));

  assert.equal(docs.length, 1);
  assert.equal(docs[0]._id, 'external-coa-request-SO26040020-10000');
  assert.equal(docs[0].status, 'requested');
  assert.equal(docs[0].petitionNoSnapshot, 'SO26040020');
  assert.equal(docs[0].customerSnapshot.name, 'Customer A');
  assert.deepEqual(docs[0].sampleSnapshots[0], {
    itemSeq: 10000,
    sampleName: 'Carval',
    commonName: 'SPIRODICLOFEN 24 % W/V SC',
    sampleId: 'FC-CAVAL-1X16',
    condition: '16*1 L',
  });
  assert.equal(docs[0].externalCoaRequest.pendingStatus, 'pending shipment');
});

test('GET / merges external COA requests with stored and Lab-approved requested rows', async () => {
  const originals = {
    coaFind: CoaDocument.find,
    petitionFind: Petition.find,
    labRequestFind: LabRequest.find,
    fetch: global.fetch,
  };
  try {
    let coaFindCalls = 0;
    CoaDocument.find = () => {
      coaFindCalls += 1;
      if (coaFindCalls === 1) {
        return sortedLimitedLean([{
          _id: 'stored-coa',
          coaNo: '00012026',
          revision: 0,
          status: 'draft',
          petitionId: '507f1f77bcf86cd799439031',
          petitionNoSnapshot: 'P-2608-0001',
          selectedItemSeqs: [1],
          sampleSnapshots: [],
          resultSnapshots: [],
          updatedAt: '2026-04-01T00:00:00.000Z',
        }]);
      }
      return sortedLimitedLean([]);
    };
    Petition.find = () => sortedLimitedLean([{
      _id: 'petition-1',
      petitionNo: 'P-2609-0002',
      labApprovedAt: new Date('2026-04-03T00:00:00.000Z'),
      submittedBy: { name: 'Requester Name', email: 'requester@example.com' },
      items: [{ seq: 1, sampleName: 'Trade A', commonName: 'Common A' }],
    }]);
    LabRequest.find = () => ({ lean: async () => [{ petitionId: 'petition-1', sampleSeq: 1 }] });
    global.fetch = async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify([{
        CustomerName: 'Customer A',
        SaleOrderNo: 'SO26040020',
        Line: 10000,
        TradeName: 'Carval',
        CommonName: 'SPIRODICLOFEN 24 % W/V SC',
        UpdateDate: '2026-04-02T00:00:00.000Z',
        remark: 'send with COA',
      }]),
    });

    const res = await invoke('/', 'get');

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.items.map((item) => item._id), [
      'requested:petition-1',
      'external-coa-request-SO26040020-10000',
      'stored-coa',
    ]);
  } finally {
    CoaDocument.find = originals.coaFind;
    Petition.find = originals.petitionFind;
    LabRequest.find = originals.labRequestFind;
    global.fetch = originals.fetch;
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

test('source selection survives create, submit and revision without accepting stale physical descriptions', async () => {
  const originals = {
    create: CoaDocument.create, findById: CoaDocument.findById, auditCreate: CoaAuditLog.create,
    petitionFindById: Petition.findById, labRequestFind: LabRequest.find,
    qcResultFind: QCTestResult.find, parameterFind: Parameter.find,
  };
  const restoreActor = stubActorLookup();
  const petitionId = '507f1f77bcf86cd799439031';
  const actor = { email: 'qc@example.com' };
  const values = { 'ลักษณะ': 'ของเหลวใส', 'สี': 'สีส้ม' };
  const parameters = [
    { _id: 'ai', name: '%AI', scope: 'lab', valueFields: [{ label: '%AI', type: 'float', unit: '%' }] },
    { _id: 'physical', name: 'กายภาพ', scope: 'qc', valueFields: [{ label: 'ลักษณะ', type: 'enum' }, { label: 'สี', type: 'text' }] },
  ];
  let document;
  try {
    Petition.findById = () => ({ lean: async () => ({ _id: petitionId, petitionNo: 'P-1', labApprovedAt: new Date(), items: [{ seq: 1, commonName: 'Glyphosate 48% SL' }] }) });
    LabRequest.find = () => ({ lean: async () => [{ sampleSeq: 1 }] });
    Parameter.find = () => ({ lean: async () => parameters });
    QCTestResult.find = () => ({ lean: async () => [
      { itemSeq: 1, parameterId: 'ai', parameterName: '%AI', entries: [{ '%AI': 48.1 }, { '%AI': 48.3 }] },
      { itemSeq: 1, parameterId: 'physical', values },
    ] });
    CoaAuditLog.create = async () => {};
    CoaDocument.create = async (payload) => {
      document = { _id: '507f1f77bcf86cd799439032', ...payload, $locals: {}, save: async () => {} };
      return document;
    };
    CoaDocument.findById = () => ({ then: (resolve) => resolve(document), lean: async () => document });
    const sources = await invoke('/source-data/:petitionId', 'get', { params: { petitionId }, query: { itemSeqs: '1' } });
    assert.equal(sources.statusCode, 200);
    const selectedField = sources.body.results.find((row) => row.kind === 'result' && row.testItem === 'กายภาพ - สี');
    const genericSelections = [{ itemSeq: 1, resultKeys: [selectedField.key] }];
    const genericCreated = await invoke('/', 'post', {
      body: { petitionId, selectedItemSeqs: [1], formSelections: genericSelections, _user: actor },
    });
    assert.equal(genericCreated.statusCode, 201);
    assert.equal(genericCreated.body.status, 'draft');
    assert.deepEqual(genericCreated.body.formSelections, genericSelections);
    assert.deepEqual(genericCreated.body.resultSnapshots, [{ itemSeq: 1, testItem: 'กายภาพ - สี', result: 'สีส้ม', criteria: '', unit: '' }]);
    const genericSubmitted = await invoke('/:id/submit', 'post', { params: { id: document._id }, body: { _user: actor } });
    assert.equal(genericSubmitted.statusCode, 200);
    assert.deepEqual(document.resultSnapshots, genericCreated.body.resultSnapshots);
    document.status = 'approved';
    const genericRevised = await invoke('/:id/revise', 'post', { params: { id: document._id }, body: { _user: actor } });
    assert.equal(genericRevised.statusCode, 201);
    assert.deepEqual(document.formSelections, genericSelections);
    const invalidSelection = await invoke('/', 'post', {
      body: { petitionId, selectedItemSeqs: [1], formSelections: [{ itemSeq: 1, resultKeys: ['missing'] }], _user: actor },
    });
    assert.equal(invalidSelection.statusCode, 400);
    const formSelections = [{
      itemSeq: 1, aiKey: sources.body.results.find((row) => row.result === '48.3%').key,
      appearanceKey: sources.body.results.find((row) => row.kind === 'appearance').key,
      appearanceSource: 'ของเหลวใส สีส้ม', appearanceSpecification: 'Clear orange liquid',
      appearanceResult: 'Conform', densityKey: '',
    }];
    const created = await invoke('/', 'post', { body: { petitionId, selectedItemSeqs: [1], formSelections, _user: actor } });
    assert.equal(created.statusCode, 201);
    assert.deepEqual(created.body.formSelections, formSelections);
    const selectedResults = structuredClone(created.body.resultSnapshots);
    const submitted = await invoke('/:id/submit', 'post', { params: { id: document._id }, body: { _user: actor } });
    assert.equal(submitted.statusCode, 200);
    assert.equal(document.status, 'pendingApproval');
    assert.deepEqual(document.resultSnapshots, selectedResults);
    document.status = 'approved';
    const revised = await invoke('/:id/revise', 'post', { params: { id: document._id }, body: { _user: actor } });
    assert.equal(revised.statusCode, 201);
    assert.deepEqual(document.formSelections, formSelections);
    values['สี'] = 'สีดำ';
    const stale = await invoke('/:id/submit', 'post', { params: { id: document._id }, body: { _user: actor } });
    assert.equal(stale.statusCode, 400);
    assert.match(stale.body.error, /ผลกายภาพเปลี่ยน/);
    assert.equal(document.status, 'revisionDraft');
    const invalidSample = await invoke('/source-data/:petitionId', 'get', { params: { petitionId }, query: { itemSeqs: '99' } });
    assert.equal(invalidSample.statusCode, 400);
    Petition.findById = () => ({ lean: async () => ({ _id: petitionId, items: [{ seq: 1 }] }) });
    const notApproved = await invoke('/source-data/:petitionId', 'get', { params: { petitionId }, query: { itemSeqs: '1' } });
    assert.equal(notApproved.statusCode, 400);
  } finally {
    CoaDocument.create = originals.create;
    CoaDocument.findById = originals.findById;
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
