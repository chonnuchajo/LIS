const test = require('node:test');
const assert = require('node:assert/strict');
const Petition = require('../models/Petition');
const PetitionAuditLog = require('../models/PetitionAuditLog');
const StandardTime = require('../models/StandardTime');
const StockTransaction = require('../models/StockTransaction');
const ResultDensity = require('../models/ResultDensity');
const User = require('../models/User');
const { buildSearchRankingStages } = require('../lib/searchRanking');
const petitions = require('./petitions');
const standardTimes = require('./standardTimes');
const stock = require('./stock');
const densities = require('./result-densities');

async function invoke(router, path, query) {
  const route = router.stack.find((entry) => entry.route?.path === path && entry.route.methods.get);
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  await route.route.stack[0].handle({ query }, response);
  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  return response.body;
}

function stubFind(context, Model, rows = []) {
  const originalFind = Model.find;
  return context.mock.method(Model, 'find', function find(filter) {
    const query = originalFind.call(this, filter);
    context.mock.method(query, 'exec', async () => rows);
    return query;
  });
}

function assertRanking(pipeline, fields, sort, skip = 1, limit = 1) {
  assert.ok(pipeline?.[0].$match, 'search must aggregate before pagination');
  assert.deepEqual(pipeline.slice(1), [
    ...buildSearchRankingStages('RI', fields, sort),
    { $skip: skip },
    { $limit: limit },
  ]);
}

test('petition search ranks live matches and hydrates phase advancement', async (context) => {
  stubFind(context, Petition);
  const count = context.mock.method(Petition, 'countDocuments', async () => 3);
  const row = {
    _id: '507f1f77bcf86cd799439011', petitionNo: 'RI', status: 'success',
    currentPhase: 1, phase2DueAt: new Date(0),
  };
  let pipeline;
  context.mock.method(Petition, 'aggregate', async (stages) => {
    if (stages.some((stage) => stage.$group)) return [{ _id: 'success', count: 3 }];
    pipeline = stages;
    return [row];
  });
  const saved = context.mock.method(Petition.prototype, 'save', async function save() {
    assert.ok(this instanceof Petition);
    assert.equal(this.isNew, false);
    return this;
  });
  const audit = context.mock.method(PetitionAuditLog, 'create', async () => ({}));
  const result = await invoke(petitions, '/', {
    search: ' RI ', page: '2', limit: '1', dept: 'production', status: 'success',
    assignedToEmployeeId: 'E1', assignedToName: 'Analyst',
  });
  assertRanking(pipeline, {
    primary: ['petitionNo'],
    secondary: ['prodOrderNos', 'productionWorkflow.requestNo', 'productionWorkflow.lisPetitionNo', 'submittedBy.name', 'items.batchNo'],
  }, { createdAt: -1 });
  const filter = pipeline[0].$match;
  assert.equal(filter.deletedAt, null);
  assert.equal(filter.status, 'success');
  assert.equal(filter.dept, 'production');
  assert.deepEqual(filter.$and[0].$or, [{ 'assignedTo.employeeId': 'E1' }, { 'assignedTo.name': 'Analyst' }]);
  assert.deepEqual(filter.$and[1].$or, [
    { petitionNo: /RI/i }, { prodOrderNos: /RI/i }, { 'productionWorkflow.requestNo': /RI/i },
    { 'productionWorkflow.lisPetitionNo': /RI/i }, { 'submittedBy.name': /RI/i }, { 'items.batchNo': /RI/i },
  ]);
  assert.equal(count.mock.calls[0].arguments[0].status, 'success');
  assert.equal(count.mock.calls[1].arguments[0].status, undefined);
  assert.equal(saved.mock.callCount(), 1);
  assert.equal(audit.mock.callCount(), 1);
  assert.equal(result.items[0].petitionNo, 'RI');
  assert.equal(result.items[0].currentPhase, 2);
  assert.equal(result.items[0].status, 'inProgress');
  assert.equal('__searchScore' in result.items[0], false);
  assert.equal(result.total, 3);
  assert.equal(result.summaryTotal, 3);
  assert.deepEqual(result.statusCounts, { success: 3 });
});

test('audit search ranks before pagination while keeping filters', async (context) => {
  stubFind(context, PetitionAuditLog);
  const count = context.mock.method(PetitionAuditLog, 'countDocuments', async () => 2);
  const rows = [{ petitionNo: 'RI', actor: 'Analyst' }];
  const aggregate = context.mock.method(PetitionAuditLog, 'aggregate', async () => rows);
  const result = await invoke(petitions, '/audit-logs', {
    search: 'RI', page: '2', limit: '1', event: 'statusChanged', status: 'inProgress',
    from: '2026-09-01', to: '2026-09-19',
  });
  const pipeline = aggregate.mock.calls[0]?.arguments[0];
  assertRanking(pipeline, { primary: ['petitionNo'], secondary: ['actor', 'note'] }, { createdAt: -1 });
  assert.deepEqual(pipeline[0].$match, count.mock.calls[0].arguments[0]);
  assert.equal(pipeline[0].$match.event, 'statusChanged');
  assert.equal(pipeline[0].$match.toStatus, 'inProgress');
  assert.deepEqual(pipeline[0].$match.$or, [{ petitionNo: /RI/i }, { actor: /RI/i }, { note: /RI/i }]);
  assert.ok(pipeline[0].$match.createdAt.$gte instanceof Date);
  assert.ok(pipeline[0].$match.createdAt.$lte instanceof Date);
  assert.deepEqual(result.items, rows);
  assert.equal(result.total, 2);
});

test('standard time search ranks analysis names before pagination with old tie-breaks', async (context) => {
  stubFind(context, StandardTime);
  const count = context.mock.method(StandardTime, 'countDocuments', async () => 2);
  const rows = [{ analysisName: 'RI', instrument: 'HPLC 1' }];
  const aggregate = context.mock.method(StandardTime, 'aggregate', async () => rows);
  const result = await invoke(standardTimes, '/', {
    search: ' RI ', page: '2', limit: '1', instrument: 'HPLC 1', machineType: 'hplc', hasData: 'true',
  });
  const pipeline = aggregate.mock.calls[0]?.arguments[0];
  assertRanking(pipeline, { primary: ['analysisName'], secondary: ['instrument', 'columnDimension'] },
    { machineType: 1, instrument: 1, analysisName: 1 });
  assert.deepEqual(pipeline[0].$match, count.mock.calls[0].arguments[0]);
  assert.equal(pipeline[0].$match.instrument, 'HPLC 1');
  assert.equal(pipeline[0].$match.machineType, 'HPLC');
  assert.equal(pipeline[0].$match.hasData, true);
  assert.deepEqual(pipeline[0].$match.$or, [{ analysisName: /RI/i }, { instrument: /RI/i }, { columnDimension: /RI/i }]);
  assert.deepEqual(result.items, rows);
  assert.equal(result.total, 2);
});

test('stock search casts filters and ranks before pagination while enriching actors', async (context) => {
  stubFind(context, StockTransaction);
  const rows = [{ itemCode: 'RI', itemName: 'Substance', userEmail: 'analyst@example.test' }];
  const aggregate = context.mock.method(StockTransaction, 'aggregate', async () => rows);
  stubFind(context, User, [{ email: 'analyst@example.test', name: 'Analyst' }]);
  const query = {
    search: ' RI ', skip: '1', limit: '1', itemType: 'standard', itemId: 123, qrId: 'BOTTLE',
    action: 'deduct', user: 'analyst', createdFrom: '2026-09-01', createdTo: '2026-09-19',
  };
  const result = await invoke(stock, '/transactions', query);
  const pipeline = aggregate.mock.calls[0]?.arguments[0];
  assertRanking(pipeline, { primary: ['itemCode'], secondary: ['itemName', 'userName', 'userEmail'] },
    { createdAt: -1, _id: -1 });
  assert.deepEqual(pipeline[0].$match, { ...stock.buildTransactionFilter(query), itemId: '123' });
  assert.equal(result[0].itemCode, 'RI');
  assert.equal(result[0].userName, 'Analyst');
});

for (const [label, router, path, Model, sort] of [
  ['petitions', petitions, '/', Petition, { createdAt: -1 }],
  ['audit logs', petitions, '/audit-logs', PetitionAuditLog, { createdAt: -1 }],
  ['standard times', standardTimes, '/', StandardTime, { machineType: 1, instrument: 1, analysisName: 1 }],
  ['stock transactions', stock, '/transactions', StockTransaction, { createdAt: -1, _id: -1 }],
]) {
  test(`${label} blank search retains find, old sort, and pagination`, async (context) => {
    const find = stubFind(context, Model);
    context.mock.method(Model, 'countDocuments', async () => 0);
    const aggregate = context.mock.method(Model, 'aggregate', async () => []);
    await invoke(router, path, { search: '   ', page: '2', skip: '2', limit: '2' });
    assert.equal(find.mock.callCount(), 1);
    const query = find.mock.calls[0].result;
    assert.deepEqual(query.getOptions().sort, sort);
    assert.equal(query.getOptions().skip, 2);
    assert.equal(query.getOptions().limit, 2);
    assert.equal(query.getQuery().$or, undefined);
    assert.equal(query.exec.mock.callCount(), 1);
    assert.equal(aggregate.mock.calls.some((call) => call.arguments[0].some((stage) => stage.$set)), false);
  });
}

test('density search ranks IDs above names before pagination with latest timestamp ties', async (context) => {
  const rows = [
    { 'Sample ID': 'XXRI', 'Sample name': 'Product 2026', 'Date & time': '9/19/2026 10:00 AM' },
    { 'Sample ID': 'RIVER', 'Sample name': 'Product 2026', 'Date & time': '9/17/2026 10:00 AM' },
    { 'Sample ID': 'OTHER', 'Sample name': 'RI', 'Date & time': '9/20/2026 10:00 AM' },
    { 'Sample ID': 'RI', 'Sample name': 'Product 2026', 'Date & time': '9/16/2026 10:00 AM' },
    { 'Sample ID': 'RI001', 'Sample name': 'Product 2026', 'Date & time': '9/18/2026 10:00 AM' },
    { 'Sample ID': 'ARI', 'Sample name': 'Product 2026', 'Date & time': '9/19/2026 11:00 AM' },
  ];
  const find = stubFind(context, ResultDensity, rows);
  const query = { search: ' RI ', limit: '2', product: 'Product', status: 'Valid', date: '2026-09-19' };
  const first = await invoke(densities, '/', { ...query, page: '1' });
  const second = await invoke(densities, '/', { ...query, page: '2' });
  const third = await invoke(densities, '/', { ...query, page: '3' });
  assert.deepEqual([...first.docs, ...second.docs, ...third.docs].map((row) => row['Sample ID']),
    ['RI', 'RI001', 'RIVER', 'ARI', 'XXRI', 'OTHER']);
  assert.equal(first.total, 6);
  assert.equal(first.docs[0].Batch, '2026');
  const filter = find.mock.calls[0].arguments[0];
  assert.deepEqual(filter.$or, [{ 'Sample ID': /RI/i }, { 'Sample name': /RI/i }]);
  assert.equal(filter['Product name'], 'Product');
  assert.deepEqual(filter['Measurement status'], /^Valid$/i);
  assert.ok(filter['Date & time'].$regex);
  assert.equal(rows[0]['Sample ID'], 'XXRI');
});

test('density blank search keeps timestamp sorting before pagination', async (context) => {
  stubFind(context, ResultDensity, [
    { 'Sample ID': 'OLD', 'Date & time': '9/18/2026 10:00 AM' },
    { 'Sample ID': 'NEW', 'Date & time': '9/19/2026 10:00 AM' },
  ]);
  const result = await invoke(densities, '/', { search: '   ', page: '2', limit: '1' });
  assert.equal(result.docs[0]['Sample ID'], 'OLD');
  assert.equal(result.total, 2);
});
