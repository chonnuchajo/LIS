const test = require('node:test');
const assert = require('node:assert');
const {
  isLabBatch,
  hasFilledValue,
  qcParamAppliesToItem,
  computeQcHeuristic,
  enteredParamNames,
} = require('./petitionStatusLog');

test('isLabBatch: last char 1 or 6 → true; else false; null-safe', () => {
  assert.strictEqual(isLabBatch('AB1'), true);
  assert.strictEqual(isLabBatch('AB6'), true);
  assert.strictEqual(isLabBatch('AB2'), false);
  assert.strictEqual(isLabBatch('  AB1  '), true);
  assert.strictEqual(isLabBatch(''), false);
  assert.strictEqual(isLabBatch(null), false);
  assert.strictEqual(isLabBatch(undefined), false);
});

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

// ─── Task 2: buildCurrent ────────────────────────────────────────────────────
const { buildCurrent } = require('./petitionStatusLog');

const QC0 = { filled: 0, total: 0, percent: 0 };

test('current rule1: approved', () => {
  assert.deepStrictEqual(
    buildCurrent({ status: 'approved', items: [] }, QC0, [], true),
    { label: 'หัวหน้า QC อนุมัติ — ปิดงาน' },
  );
});

test('current rule2: rejected', () => {
  assert.deepStrictEqual(
    buildCurrent({ status: 'rejected', items: [] }, QC0, [], true),
    { label: 'ส่งกลับให้แก้ไข' },
  );
});

test('current rule3: success', () => {
  assert.deepStrictEqual(
    buildCurrent({ status: 'success', items: [] }, QC0, [], true),
    { label: 'เสร็จสิ้น — รอหัวหน้า QC ยืนยัน', side: 'qc' },
  );
});

test('current rule4: QC partial shows names + percent', () => {
  const p = { status: 'inProgress', items: [] };
  assert.deepStrictEqual(
    buildCurrent(p, { filled: 1, total: 2, percent: 45 }, ['pH', 'ความชื้น'], true),
    { label: 'QC กำลังตรวจ — pH, ความชื้น (45%)', side: 'qc', percent: 45 },
  );
});

test('current rule4 beats rule5: QC partial + lab pending → still shows QC progress', () => {
  const p = { status: 'inProgress', items: [{ batchNo: 'B-1' }] };
  const r = buildCurrent(p, { filled: 1, total: 2, percent: 45 }, ['pH'], false);
  assert.strictEqual(r.label, 'QC กำลังตรวจ — pH (45%)');
});

test('current rule5: QC 100% but lab pending → wait Lab', () => {
  const p = { status: 'inProgress', items: [{ batchNo: 'B-1' }] };
  assert.deepStrictEqual(
    buildCurrent(p, { filled: 2, total: 2, percent: 100 }, ['pH'], false),
    { label: 'รอผลตรวจจาก Lab', side: 'lab' },
  );
});

test('current rule6: QC 100% and lab done → wait QC confirm', () => {
  const p = { status: 'inProgress', items: [{ batchNo: 'B-1' }] };
  assert.deepStrictEqual(
    buildCurrent(p, { filled: 2, total: 2, percent: 100 }, ['pH'], true),
    { label: 'รอ QC ยืนยันผล', side: 'qc' },
  );
});

test('current rule6: no lab item, QC 100% → wait QC confirm', () => {
  const p = { status: 'inProgress', items: [{ batchNo: 'B-2' }] };
  assert.deepStrictEqual(
    buildCurrent(p, { filled: 1, total: 1, percent: 100 }, ['pH'], true),
    { label: 'รอ QC ยืนยันผล', side: 'qc' },
  );
});

test('current rule7: both received', () => {
  const p = { status: 'pendingReview', items: [], labReceivedAt: '2026-06-10', qcReceivedAt: '2026-06-10' };
  assert.deepStrictEqual(buildCurrent(p, QC0, [], true), { label: 'Lab & QC รับแล้ว' });
});

test('current rule8: only QC received', () => {
  const p = { status: 'pendingReview', items: [], qcReceivedAt: '2026-06-10' };
  assert.deepStrictEqual(buildCurrent(p, QC0, [], true), { label: 'QC รับแล้ว · Lab รอรับ' });
});

test('current rule8: only Lab received', () => {
  const p = { status: 'pendingReview', items: [], labReceivedAt: '2026-06-10' };
  assert.deepStrictEqual(buildCurrent(p, QC0, [], true), { label: 'Lab รับแล้ว · QC รอรับ' });
});

test('current rule9: sampleSent', () => {
  assert.deepStrictEqual(
    buildCurrent({ status: 'sampleSent', items: [] }, QC0, [], true),
    { label: 'ส่งตัวอย่างแล้ว — รอรับ' },
  );
});

test('current rule10: deliveringQC', () => {
  assert.deepStrictEqual(
    buildCurrent({ status: 'deliveringQC', items: [] }, QC0, [], true),
    { label: 'กำลังนำส่ง QC' },
  );
});

test('current: sampleSent + lab item + lab not done → still ส่งตัวอย่างแล้ว (rule 5 gated by testing)', () => {
  const p = { status: 'sampleSent', items: [{ batchNo: 'B-1' }] };
  assert.deepStrictEqual(buildCurrent(p, QC0, [], false), { label: 'ส่งตัวอย่างแล้ว — รอรับ' });
});

test('current: pendingReview + QC received + lab item + lab not done → QC รับแล้ว · Lab รอรับ (not รอผลตรวจจาก Lab)', () => {
  const p = { status: 'pendingReview', items: [{ batchNo: 'B-1' }], qcReceivedAt: '2026-06-10' };
  assert.deepStrictEqual(buildCurrent(p, QC0, [], false), { label: 'QC รับแล้ว · Lab รอรับ' });
});
