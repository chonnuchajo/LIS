const chemicalRouter = require('../chemical-requisitions');
const { StockSolvent } = require('../../models/Stock');
const ChemicalRequisition = require('../../models/ChemicalRequisition');
const StockTransaction = require('../../models/StockTransaction');
const StockUnit = require('../../models/StockUnit');
const User = require('../../models/User');

function routeHandler(path, method = 'post') {
  const layer = chemicalRouter.stack.find((entry) => entry.route?.path === path && entry.route.methods[method]);
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

describe('chemical requisitions solvent unit QR', () => {
  const originals = {
    findSolventById: StockSolvent.findById,
    findSolventOneAndUpdate: StockSolvent.findOneAndUpdate,
    createRequisition: ChemicalRequisition.create,
    createTransaction: StockTransaction.create,
    unitFind: StockUnit.find,
    unitFindOneAndUpdate: StockUnit.findOneAndUpdate,
    userFindOne: User.findOne,
  };

  afterEach(() => {
    StockSolvent.findById = originals.findSolventById;
    StockSolvent.findOneAndUpdate = originals.findSolventOneAndUpdate;
    ChemicalRequisition.create = originals.createRequisition;
    StockTransaction.create = originals.createTransaction;
    StockUnit.find = originals.unitFind;
    StockUnit.findOneAndUpdate = originals.unitFindOneAndUpdate;
    User.findOne = originals.userFindOne;
    jest.restoreAllMocks();
  });

  test('deducts the scanned solvent bottle unit instead of the oldest unit', async () => {
    const handler = routeHandler('/');
    const solvent = { _id: { toString: () => 'solvent-1' }, name: 'Methanol' };
    const updatedSolvent = { _id: 'solvent-1', name: 'Methanol', qty: 1 };
    const scannedUnit = {
      _id: { toString: () => 'unit-2' },
      qrId: 'u_sol_2',
      itemId: 'solvent-1',
      status: 'empty',
      volume: { initial: 2500, remaining: 0, unit: 'ml' },
    };
    StockSolvent.findById = jest.fn().mockResolvedValue(solvent);
    StockSolvent.findOneAndUpdate = jest.fn().mockResolvedValue(updatedSolvent);
    StockUnit.find = jest.fn();
    StockUnit.findOneAndUpdate = jest.fn().mockResolvedValue(scannedUnit);
    StockTransaction.create = jest.fn().mockResolvedValue({});
    ChemicalRequisition.create = jest.fn(async (doc) => doc);
    User.findOne = jest.fn(() => ({ lean: jest.fn().mockResolvedValue({ email: 'tester@example.com', name: 'Tester' }) }));

    const req = {
      body: {
        roomSlug: 'analysis',
        date: '2026-08-25',
        instrumentId: 'gc-1',
        instrumentName: 'GC 1',
        solventId: 'solvent-1',
        solventUnitQrId: 'u_sol_2',
        qty: 1,
        requestedBy: { email: 'tester@example.com', name: 'Tester' },
      },
      headers: {},
    };
    const res = mockResponse();

    await handler(req, res);

    expect(StockUnit.find).not.toHaveBeenCalled();
    expect(StockUnit.findOneAndUpdate).toHaveBeenCalledWith(
      { qrId: 'u_sol_2', itemType: 'solvent', itemId: 'solvent-1', status: 'active' },
      { $set: { status: 'empty', 'volume.remaining': 0 } },
      { new: true },
    );
    expect(StockTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      itemType: 'solvent',
      itemId: 'solvent-1',
      action: 'deduct',
      unitId: 'unit-2',
      qrId: 'u_sol_2',
    }));
    expect(ChemicalRequisition.create).toHaveBeenCalledWith(expect.objectContaining({
      solventId: 'solvent-1',
      solventUnitQrId: 'u_sol_2',
      qty: 1,
    }));
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
