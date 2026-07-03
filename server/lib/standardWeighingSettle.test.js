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
