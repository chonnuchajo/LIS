const stockRouter = require('../stock');
const { StockSolvent } = require('../../models/Stock');
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

describe('stock solvent units routes', () => {
  const originals = {
    findSolventById: StockSolvent.findById,
    createTransaction: StockTransaction.create,
    unitExists: StockUnit.exists,
    unitCountDocuments: StockUnit.countDocuments,
    unitCreate: StockUnit.create,
    unitFind: StockUnit.find,
    userFindOne: User.findOne,
  };

  afterEach(() => {
    StockSolvent.findById = originals.findSolventById;
    StockTransaction.create = originals.createTransaction;
    StockUnit.exists = originals.unitExists;
    StockUnit.countDocuments = originals.unitCountDocuments;
    StockUnit.create = originals.unitCreate;
    StockUnit.find = originals.unitFind;
    User.findOne = originals.userFindOne;
    jest.restoreAllMocks();
  });

  test('receiving solvent creates one active StockUnit per bottle', async () => {
    const handler = routeHandler('/solvents/:id/receive');
    const solvent = {
      _id: { toString: () => 'solvent-1' },
      name: 'Acetone',
      qty: 0,
      sizeLiter: 0,
      price: 0,
      save: jest.fn().mockResolvedValue(undefined),
    };
    StockSolvent.findById = jest.fn().mockResolvedValue(solvent);
    StockUnit.exists = jest.fn().mockResolvedValue(false);
    StockUnit.countDocuments = jest.fn().mockResolvedValue(0);
    StockUnit.create = jest.fn(async (doc) => doc);
    StockTransaction.create = jest.fn().mockResolvedValue({});
    User.findOne = jest.fn(() => ({ lean: jest.fn().mockResolvedValue({ email: 'tester@example.com', name: 'Tester' }) }));

    const req = {
      params: { id: 'solvent-1' },
      body: {
        qty: 2,
        lotNo: 'LOT-A',
        exp: '2027-01-01',
        sizeLiter: 18,
        price: 3000,
        _user: { email: 'tester@example.com', name: 'Tester' },
      },
      headers: {},
    };
    const res = mockResponse();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Acetone',
      receivedUnits: expect.any(Array),
    }));
    expect(StockUnit.create).toHaveBeenCalledTimes(2);
    expect(StockUnit.create).toHaveBeenNthCalledWith(1, expect.objectContaining({
      itemType: 'solvent',
      itemId: 'solvent-1',
      itemCode: 'solvent-1',
      itemName: 'Acetone',
      lotNo: 'LOT-A',
      lotBottleNo: 1,
      volume: { initial: 18000, remaining: 18000, unit: 'ml' },
      status: 'active',
      createdBy: { email: 'tester@example.com', name: 'Tester' },
    }));
    expect(StockUnit.create).toHaveBeenNthCalledWith(2, expect.objectContaining({ lotBottleNo: 2 }));
    expect(StockTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      itemType: 'solvent',
      itemId: 'solvent-1',
      action: 'receive',
      delta: 2,
    }));
  });

  test('deducting solvent marks oldest active bottle units empty', async () => {
    const handler = routeHandler('/solvents/:id/deduct');
    const solvent = {
      _id: { toString: () => 'solvent-1' },
      name: 'Acetone',
      qty: 2,
      save: jest.fn().mockResolvedValue(undefined),
    };
    const unit = {
      status: 'active',
      volume: { initial: 18000, remaining: 18000, unit: 'ml' },
      save: jest.fn().mockResolvedValue(undefined),
    };
    const limit = jest.fn().mockResolvedValue([unit]);
    const sort = jest.fn(() => ({ limit }));
    StockSolvent.findById = jest.fn().mockResolvedValue(solvent);
    StockUnit.find = jest.fn(() => ({ sort }));
    StockTransaction.create = jest.fn().mockResolvedValue({});
    User.findOne = jest.fn(() => ({ lean: jest.fn().mockResolvedValue({ email: 'tester@example.com', name: 'Tester' }) }));

    const req = {
      params: { id: 'solvent-1' },
      body: { qty: 1, _user: { email: 'tester@example.com', name: 'Tester' } },
      headers: {},
    };
    const res = mockResponse();

    await handler(req, res);

    expect(StockUnit.find).toHaveBeenCalledWith({ itemType: 'solvent', itemId: 'solvent-1', status: 'active' });
    expect(sort).toHaveBeenCalledWith({ receivedDate: 1, createdAt: 1, _id: 1 });
    expect(limit).toHaveBeenCalledWith(1);
    expect(unit.status).toBe('empty');
    expect(unit.volume.remaining).toBe(0);
    expect(unit.save).toHaveBeenCalled();
  });
});
