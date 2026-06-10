const test = require('node:test');
const assert = require('node:assert');
const {
  hasFilledValue,
  qcParamAppliesToItem,
  computeQcHeuristic,
  enteredParamNames,
} = require('./petitionStatusLog');

test('hasFilledValue: empty/blank → false, value → true', () => {
  assert.strictEqual(hasFilledValue({}), false);
  assert.strictEqual(hasFilledValue({ a: '' }), false);
  assert.strictEqual(hasFilledValue({ a: '  ' }), false);
  assert.strictEqual(hasFilledValue(null), false);
  assert.strictEqual(hasFilledValue({ a: '7' }), true);
  assert.strictEqual(hasFilledValue({ a: 0 }), true);
});

test('qcParamAppliesToItem: applyAll matches anything', () => {
  assert.strictEqual(qcParamAppliesToItem({ applyAll: true }, { sampleName: 'X' }), true);
});

test('qcParamAppliesToItem: commonName match (case-insensitive)', () => {
  const p = { commonNames: ['NaOH'] };
  assert.strictEqual(qcParamAppliesToItem(p, { commonName: 'naoh' }), true);
  assert.strictEqual(qcParamAppliesToItem(p, { commonName: 'KCl' }), false);
});

test('qcParamAppliesToItem: itemNames match sampleName', () => {
  assert.strictEqual(qcParamAppliesToItem({ itemNames: ['ตัวอย่าง A'] }, { sampleName: 'ตัวอย่าง A' }), true);
});

test('qcParamAppliesToItem: testItems name match', () => {
  assert.strictEqual(qcParamAppliesToItem({ name: 'pH' }, { testItems: 'pH, ความชื้น' }), true);
});

test('computeQcHeuristic: 1 of 2 params filled → 50%', () => {
  const petition = { items: [{ seq: 1, commonName: 'NaOH', sampleName: 'S1' }] };
  const parameters = [
    { _id: 'p1', name: 'pH', status: 'active', scope: 'qc', commonNames: ['NaOH'] },
    { _id: 'p2', name: 'ความชื้น', status: 'active', scope: 'qc', commonNames: ['NaOH'] },
  ];
  const qcResults = [{ itemSeq: 1, parameterId: 'p1', values: { v: '7' } }];
  assert.deepStrictEqual(
    computeQcHeuristic(petition, qcResults, parameters),
    { filled: 1, total: 2, percent: 50 },
  );
});

test('computeQcHeuristic: no matched params → total 0, percent 0', () => {
  const petition = { items: [{ seq: 1, commonName: 'X', sampleName: 'S' }] };
  const parameters = [{ _id: 'p1', name: 'pH', status: 'active', scope: 'qc', commonNames: ['NaOH'] }];
  assert.deepStrictEqual(computeQcHeuristic(petition, [], parameters), { filled: 0, total: 0, percent: 0 });
});

test('computeQcHeuristic: lab-scope and inactive params excluded', () => {
  const petition = { items: [{ seq: 1, commonName: 'NaOH' }] };
  const parameters = [
    { _id: 'p1', name: 'pH', status: 'active', scope: 'lab', applyAll: true },
    { _id: 'p2', name: 'x', status: 'inactive', scope: 'qc', applyAll: true },
  ];
  assert.strictEqual(computeQcHeuristic(petition, [], parameters).total, 0);
});

test('computeQcHeuristic: filled capped at total (percent never > 100)', () => {
  const petition = { items: [{ seq: 1, commonName: 'NaOH' }] };
  const parameters = [{ _id: 'p1', name: 'pH', status: 'active', scope: 'qc', commonNames: ['NaOH'] }];
  const qcResults = [
    { itemSeq: 1, parameterId: 'p1', values: { v: '7' } },
    { itemSeq: 1, parameterId: 'pX', values: { v: '7' } },
  ];
  const r = computeQcHeuristic(petition, qcResults, parameters);
  assert.strictEqual(r.filled, 1);
  assert.strictEqual(r.percent, 100);
});

test('enteredParamNames: distinct, ordered by enteredAt, blanks ignored', () => {
  const qcResults = [
    { parameterName: 'ความชื้น', values: { v: '1' }, enteredAt: '2026-06-10T02:00:00Z' },
    { parameterName: 'pH', values: { v: '7' }, enteredAt: '2026-06-10T01:00:00Z' },
    { parameterName: 'pH', values: { v: '8' }, enteredAt: '2026-06-10T03:00:00Z' },
    { parameterName: 'ไม่นับ', values: {}, enteredAt: '2026-06-10T00:00:00Z' },
  ];
  assert.deepStrictEqual(enteredParamNames(qcResults), ['pH', 'ความชื้น']);
});
