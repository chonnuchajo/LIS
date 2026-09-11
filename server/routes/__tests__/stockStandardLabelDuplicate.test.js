const stockRouter = require('../stock');
const { StockStandard } = require('../../models/Stock');
const StockTransaction = require('../../models/StockTransaction');
const StockUnit = require('../../models/StockUnit');
const User = require('../../models/User');

function routeHandler(path, method = 'post') {
  const layer = stockRouter.stack.find((entry) => entry.route?.path === path && entry.route.methods[method]);
  if (!layer) throw new Error(`route not found: ${method.toUpperCase()} ${path}`);
  return layer.route.stack[0].handle;
}

function mockResponse() {
  return {
    statusCode: 200,
    status: jest.fn(function status(code) {
      this.statusCode = code;
      return this;
    }),
    json: jest.fn(function json(body) {
      this.body = body;
      return this;
    }),
  };
}

function chainLean(result) {
  return {
    select: jest.fn(function select() {
      return this;
    }),
    lean: jest.fn().mockResolvedValue(result),
  };
}

describe('stock standard label code duplicates', () => {
  const originals = {
    findStandardById: StockStandard.findById,
    createTransaction: StockTransaction.create,
    unitExists: StockUnit.exists,
    unitCountDocuments: StockUnit.countDocuments,
    unitCreate: StockUnit.create,
    unitFind: StockUnit.find,
    unitFindOne: StockUnit.findOne,
    userFindOne: User.findOne,
  };

  afterEach(() => {
    StockStandard.findById = originals.findStandardById;
    StockTransaction.create = originals.createTransaction;
    StockUnit.exists = originals.unitExists;
    StockUnit.countDocuments = originals.unitCountDocuments;
    StockUnit.create = originals.unitCreate;
    StockUnit.find = originals.unitFind;
    StockUnit.findOne = originals.unitFindOne;
    User.findOne = originals.userFindOne;
    jest.restoreAllMocks();
  });

  test('receiving standard bottles allows repeated Code in the same request', async () => {
    const handler = routeHandler('/standards/:id/units/receive');
    const standard = { _id: { toString: () => 'std-53' }, code: '53', name: 'Lambda-cyhalothrin' };
    StockStandard.findById = jest.fn().mockResolvedValue(standard);
    StockUnit.find = jest.fn(() => chainLean([]));
    StockUnit.findOne = jest.fn(() => chainLean(null));
    StockUnit.exists = jest.fn().mockResolvedValue(false);
    StockUnit.countDocuments = jest.fn().mockResolvedValue(0);
    StockUnit.create = jest.fn(async (doc) => ({ ...doc, _id: { toString: () => `unit-${StockUnit.create.mock.calls.length}` } }));
    StockTransaction.create = jest.fn().mockResolvedValue({});
    User.findOne = jest.fn(() => ({ lean: jest.fn().mockResolvedValue({ email: 'tester@example.com', name: 'Tester' }) }));

    const req = {
      params: { id: 'std-53' },
      body: {
        lotNo: 'GI503477',
        purity: '96.60',
        sizeMl: 100,
        unit: 'mg',
        type: 'primary',
        bottles: [
          { exp: '2027-10-17', labelCode: '536901' },
          { exp: '2027-10-17', labelCode: '536901' },
        ],
        _user: { email: 'tester@example.com', name: 'Tester' },
      },
      headers: {},
    };
    const res = mockResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(201);
    expect(StockUnit.create).toHaveBeenCalledTimes(2);
    expect(StockUnit.create).toHaveBeenNthCalledWith(1, expect.objectContaining({ labelCode: '536901' }));
    expect(StockUnit.create).toHaveBeenNthCalledWith(2, expect.objectContaining({ labelCode: '536901' }));
  });

  test('receiving standard bottle allows Code used by existing unit', async () => {
    const handler = routeHandler('/standards/:id/units/receive');
    const standard = { _id: { toString: () => 'std-53' }, code: '53', name: 'Lambda-cyhalothrin' };
    StockStandard.findById = jest.fn().mockResolvedValue(standard);
    StockUnit.find = jest.fn(() => chainLean([{ labelCode: '536901' }]));
    StockUnit.findOne = jest.fn(() => chainLean({ labelCode: '536901' }));
    StockUnit.exists = jest.fn().mockResolvedValue(false);
    StockUnit.countDocuments = jest.fn().mockResolvedValue(0);
    StockUnit.create = jest.fn(async (doc) => ({ ...doc, _id: { toString: () => 'unit-1' } }));
    StockTransaction.create = jest.fn().mockResolvedValue({});
    User.findOne = jest.fn(() => ({ lean: jest.fn().mockResolvedValue({ email: 'tester@example.com', name: 'Tester' }) }));

    const req = {
      params: { id: 'std-53' },
      body: {
        lotNo: 'GI503477',
        purity: '96.60',
        sizeMl: 100,
        unit: 'mg',
        type: 'primary',
        bottles: [{ exp: '2027-10-17', labelCode: '536901' }],
        _user: { email: 'tester@example.com', name: 'Tester' },
      },
      headers: {},
    };
    const res = mockResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(201);
    expect(StockUnit.create).toHaveBeenCalledWith(expect.objectContaining({ labelCode: '536901' }));
  });

  test('updating standard unit allows Code used by another unit', async () => {
    const handler = routeHandler('/units/:qrId', 'patch');
    const unit = {
      _id: 'unit-new',
      qrId: 'u_new',
      itemCode: '53',
      labelCode: '536902',
      status: 'active',
      volume: { initial: 100, remaining: 100, unit: 'mg' },
      save: jest.fn().mockResolvedValue(undefined),
    };
    StockUnit.findOne = jest.fn()
      .mockResolvedValueOnce(unit)
      .mockReturnValueOnce(chainLean({ labelCode: '536901' }));

    const req = { params: { qrId: 'u_new' }, body: { labelCode: '536901' }, headers: {} };
    const res = mockResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(unit.labelCode).toBe('536901');
    expect(unit.save).toHaveBeenCalled();
  });
});
