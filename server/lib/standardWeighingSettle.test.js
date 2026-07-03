const { validateWeighings } = require('./standardWeighingSettle');

const req1 = { commonName: 'Abamectin', substance: 'Abamectin', instrument: 'GC', times: 3 };
const freshRow = {
  _id: 'r1', commonName: 'Abamectin', substance: 'Abamectin', instrument: 'GC',
  mode: 'fresh', masses: [30, 31, 29], bottleQrId: 'u_a', deductedAt: null, sampleId: 'P-1-1',
};
const unitOk = { qrId: 'u_a', status: 'active', exp: null, volume: { remaining: 100, unit: 'mg' } };

test('valid fresh weighing → one deduction of Σmasses', () => {
  const { errors, plan } = validateWeighings([req1], [freshRow], { u_a: unitOk });
  expect(errors).toEqual([]);
  expect(plan).toEqual([{ rowId: 'r1', bottleQrId: 'u_a', totalMg: 90, sampleId: 'P-1-1' }]);
});

test('missing row for a required task → error, no plan', () => {
  const { errors, plan } = validateWeighings([req1], [], {});
  expect(errors[0]).toMatch(/Abamectin/);
  expect(plan).toEqual([]);
});

test('fresh row with wrong number of masses → error', () => {
  const { errors } = validateWeighings([req1], [{ ...freshRow, masses: [30, 31] }], { u_a: unitOk });
  expect(errors[0]).toMatch(/ครบ 3 ครั้ง/);
});

test('insufficient remaining → error', () => {
  const { errors } = validateWeighings([req1], [freshRow], { u_a: { ...unitOk, volume: { remaining: 10, unit: 'mg' } } });
  expect(errors[0]).toMatch(/คงเหลือไม่พอ/);
});

test('already deducted row → no error, no plan (idempotent)', () => {
  const { errors, plan } = validateWeighings([req1], [{ ...freshRow, deductedAt: new Date() }], { u_a: unitOk });
  expect(errors).toEqual([]);
  expect(plan).toEqual([]);
});

test('working mode row needs a workingQrId', () => {
  const wReq = { ...req1 };
  const okWork = { ...freshRow, mode: 'working', masses: [], bottleQrId: '', workingQrId: 'u_w' };
  expect(validateWeighings([wReq], [okWork], {}).errors).toEqual([]);
  expect(validateWeighings([wReq], [{ ...okWork, workingQrId: '' }], {}).errors[0]).toMatch(/working/i);
});

describe('settleLabStandards — partial-failure stamp ordering', () => {
  // The top of this file already did a plain `require('./standardWeighingSettle')`, which
  // cached a module instance wired to the REAL StandardWeighing/StockUnit/stockRouter. A
  // `jest.mock(...)` registered only now would not retroactively change that cached instance,
  // so we force a clean slate with `jest.resetModules()` and use `jest.doMock` (unhoisted,
  // executes in the written order) to register mocks and THEN re-require the module fresh,
  // guaranteeing this test exercises `settleLabStandards` wired to the mocks below.
  afterEach(() => {
    jest.resetModules();
  });

  test('stamps deductedAt before creating working unit (no double-deduct on retry)', async () => {
    jest.resetModules();
    jest.doMock('../models/StandardWeighing', () => ({ find: jest.fn(), updateOne: jest.fn() }));
    jest.doMock('../models/StockUnit', () => ({ find: jest.fn() }));
    jest.doMock('../routes/stock', () => ({
      planDeductMg: jest.fn(() => ({ ok: true, after: 60 })),
      deductMgFromUnit: jest.fn(async () => ({ unit: { qrId: 'u_a' } })),
      createWorkingFromParent: jest.fn(async () => { throw new Error('working create failed'); }),
    }));

    const StandardWeighing = require('../models/StandardWeighing');
    const StockUnit = require('../models/StockUnit');
    const { settleLabStandards } = require('./standardWeighingSettle');

    const row = {
      _id: 'r1', commonName: 'Abamectin', substance: 'Abamectin', instrument: 'GC',
      mode: 'fresh', masses: [30, 30, 30], bottleQrId: 'u_a', deductedAt: null, sampleId: 'P-1-1',
    };
    StandardWeighing.find.mockResolvedValue([row]);
    StandardWeighing.updateOne.mockResolvedValue({});
    StockUnit.find.mockReturnValue({
      lean: () => Promise.resolve([{ qrId: 'u_a', status: 'active', exp: null, volume: { remaining: 250, unit: 'mg' } }]),
    });
    const petition = { _id: 'p1', petitionNo: 'P-1' };
    const req = { body: {}, headers: {} };
    const required = [{ commonName: 'Abamectin', substance: 'Abamectin', instrument: 'GC', times: 3 }];

    await expect(settleLabStandards(petition, required, req)).rejects.toThrow(/working create failed/);

    // deductedAt must have been stamped BEFORE the working-creation failure:
    const stampCall = StandardWeighing.updateOne.mock.calls.find((c) => c[1] && c[1].$set && c[1].$set.deductedAt);
    expect(stampCall).toBeTruthy();
    // and it must NOT have (yet) recorded a workingQrId, since creation failed:
    expect(stampCall[1].$set.workingQrId).toBeUndefined();
  });
});
