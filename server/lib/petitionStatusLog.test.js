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

// ─── Task 2: buildCurrent (dual-track) ───────────────────────────────────────
const { buildCurrent } = require('./petitionStatusLog');

const QC0 = { filled: 0, total: 0, percent: 0 };
const ASSIGNEE = { name: 'สมชาย', assignedBy: 'แอดมิน' };

// terminal / pre-receive — single label, no tracks
test('current: approved', () => {
  assert.deepStrictEqual(
    buildCurrent({ status: 'approved', items: [] }, QC0, [], true),
    { label: 'หัวหน้า QC อนุมัติ — ปิดงาน' },
  );
});

test('current: rejected', () => {
  assert.deepStrictEqual(
    buildCurrent({ status: 'rejected', items: [] }, QC0, [], true),
    { label: 'ส่งกลับให้แก้ไข' },
  );
});

test('current: success', () => {
  assert.deepStrictEqual(
    buildCurrent({ status: 'success', items: [] }, QC0, [], true),
    { label: 'เสร็จสิ้น — รอหัวหน้า QC ยืนยัน', side: 'qc' },
  );
});

test('current: sampleSent, neither received → single label', () => {
  assert.deepStrictEqual(
    buildCurrent({ status: 'sampleSent', items: [{ batchNo: 'B-1' }] }, QC0, [], false),
    { label: 'ส่งตัวอย่างแล้ว — รอรับ' },
  );
});

test('current: deliveringQC, neither received → single label', () => {
  assert.deepStrictEqual(
    buildCurrent({ status: 'deliveringQC', items: [] }, QC0, [], true),
    { label: 'กำลังนำส่ง QC' },
  );
});

// dual-track — one side received
test('current: only QC received, no lab item → QC track only', () => {
  const p = { status: 'pendingReview', items: [{ batchNo: 'B-2' }], qcReceivedAt: 'T' };
  assert.deepStrictEqual(buildCurrent(p, QC0, [], true), {
    label: 'QC รับแล้ว',
    tracks: { qc: { label: 'QC รับแล้ว' } },
  });
});

test('current: only QC received, has lab item → QC รับแล้ว | Lab รอรับ', () => {
  const p = { status: 'pendingReview', items: [{ batchNo: 'B-1' }], qcReceivedAt: 'T' };
  assert.deepStrictEqual(buildCurrent(p, QC0, [], false), {
    label: 'QC รับแล้ว | Lab รอรับ',
    tracks: { qc: { label: 'QC รับแล้ว' }, lab: { label: 'Lab รอรับ' } },
  });
});

test('current: only Lab received, has lab item → QC รอรับ | Lab รับแล้ว', () => {
  const p = { status: 'pendingReview', items: [{ batchNo: 'B-1' }], labReceivedAt: 'T' };
  assert.deepStrictEqual(buildCurrent(p, QC0, [], false), {
    label: 'QC รอรับ | Lab รับแล้ว',
    tracks: { qc: { label: 'QC รอรับ' }, lab: { label: 'Lab รับแล้ว' } },
  });
});

// assignment shows ONLY on the assignee's side (derived from dept/position)
const LAB_ASSIGNEE = { name: 'อนล', department: 'Lab/วิเคราะห์', position: 'Lab Analyst' };

// QC-side assignee → assign line on QC, Lab is just "รับแล้ว"
test('current: both received + QC-assignee + not started → QC มอบหมาย | Lab รับแล้ว', () => {
  const p = {
    status: 'pendingReview', items: [{ batchNo: 'B-1' }],
    qcReceivedAt: 'T', labReceivedAt: 'T', assignedTo: ASSIGNEE, reviewHistory: [],
  };
  assert.deepStrictEqual(buildCurrent(p, QC0, [], false), {
    label: 'QC มอบหมายงานแล้ว รอเจ้าหน้าที่รับงาน | Lab รับแล้ว',
    tracks: {
      qc: { label: 'QC มอบหมายงานแล้ว รอเจ้าหน้าที่รับงาน' },
      lab: { label: 'Lab รับแล้ว' },
    },
  });
});

// Lab-side assignee → assign line on Lab, QC is just "รับแล้ว" (the P-2606-0001 case)
test('current: both received + Lab-assignee + not started → QC รับแล้ว | Lab มอบหมาย', () => {
  const p = {
    status: 'pendingReview', items: [{ batchNo: 'B-1' }],
    qcReceivedAt: 'T', labReceivedAt: 'T', assignedTo: LAB_ASSIGNEE, reviewHistory: [],
  };
  assert.deepStrictEqual(buildCurrent(p, QC0, [], false), {
    label: 'QC รับแล้ว | Lab มอบหมายงานแล้ว รอเจ้าหน้าที่รับงาน',
    tracks: {
      qc: { label: 'QC รับแล้ว' },
      lab: { label: 'Lab มอบหมายงานแล้ว รอเจ้าหน้าที่รับงาน' },
    },
  });
});

// started (accepted via startTesting) — only the assignee side flips to รับงานแล้ว
test('current: QC-assignee + startTesting → QC รับงานแล้ว | Lab รับแล้ว', () => {
  const p = {
    status: 'inProgress', items: [{ batchNo: 'B-1' }],
    qcReceivedAt: 'T', labReceivedAt: 'T', assignedTo: ASSIGNEE,
    reviewHistory: [{ action: 'startTesting' }],
  };
  assert.deepStrictEqual(buildCurrent(p, QC0, [], false), {
    label: 'QC สมชาย รับงานแล้ว · กำลังตรวจ | Lab รับแล้ว',
    tracks: {
      qc: { label: 'QC สมชาย รับงานแล้ว · กำลังตรวจ' },
      lab: { label: 'Lab รับแล้ว' },
    },
  });
});

test('current: Lab-assignee + startTesting → QC รับแล้ว | Lab รับงานแล้ว', () => {
  const p = {
    status: 'inProgress', items: [{ batchNo: 'B-1' }],
    qcReceivedAt: 'T', labReceivedAt: 'T', assignedTo: LAB_ASSIGNEE,
    reviewHistory: [{ action: 'startTesting' }],
  };
  assert.deepStrictEqual(buildCurrent(p, QC0, [], false), {
    label: 'QC รับแล้ว | Lab อนล รับงานแล้ว · กำลังตรวจ',
    tracks: {
      qc: { label: 'QC รับแล้ว' },
      lab: { label: 'Lab อนล รับงานแล้ว · กำลังตรวจ' },
    },
  });
});

// QC actively entering values → QC track shows progress regardless of assignee side
test('current: QC entering values (Lab-assignee) → QC % | Lab รับงานแล้ว', () => {
  const p = {
    status: 'inProgress', items: [{ batchNo: 'B-1' }],
    qcReceivedAt: 'T', labReceivedAt: 'T', assignedTo: LAB_ASSIGNEE, reviewHistory: [],
  };
  assert.deepStrictEqual(buildCurrent(p, { filled: 1, total: 2, percent: 45 }, ['pH', 'ความชื้น'], false), {
    label: 'QC กำลังตรวจ — pH, ความชื้น (45%) | Lab อนล รับงานแล้ว · กำลังตรวจ',
    tracks: {
      qc: { label: 'QC กำลังตรวจ — pH, ความชื้น (45%)', percent: 45 },
      lab: { label: 'Lab อนล รับงานแล้ว · กำลังตรวจ' },
    },
  });
});

// QC done, lab still running
test('current: QC 100% + lab not done (Lab-assignee) → QC ตรวจครบ | Lab รับงานแล้ว', () => {
  const p = {
    status: 'inProgress', items: [{ batchNo: 'B-1' }],
    qcReceivedAt: 'T', labReceivedAt: 'T', assignedTo: LAB_ASSIGNEE, reviewHistory: [],
  };
  assert.deepStrictEqual(buildCurrent(p, { filled: 2, total: 2, percent: 100 }, ['pH'], false), {
    label: 'QC ตรวจครบ — รอยืนยัน | Lab อนล รับงานแล้ว · กำลังตรวจ',
    tracks: {
      qc: { label: 'QC ตรวจครบ — รอยืนยัน' },
      lab: { label: 'Lab อนล รับงานแล้ว · กำลังตรวจ' },
    },
  });
});

// dual-track — lab done drops the lab track → QC drives alone
test('current: QC 100% + lab done → QC ตรวจครบ only (lab track dropped)', () => {
  const p = {
    status: 'inProgress', items: [{ batchNo: 'B-1' }],
    qcReceivedAt: 'T', labReceivedAt: 'T', assignedTo: ASSIGNEE, reviewHistory: [],
  };
  assert.deepStrictEqual(buildCurrent(p, { filled: 2, total: 2, percent: 100 }, ['pH'], true), {
    label: 'QC ตรวจครบ — รอยืนยัน',
    tracks: { qc: { label: 'QC ตรวจครบ — รอยืนยัน' } },
  });
});

// no lab item → only QC track ever
test('current: no lab item, QC entering → QC track only', () => {
  const p = {
    status: 'inProgress', items: [{ batchNo: 'B-2' }],
    qcReceivedAt: 'T', assignedTo: ASSIGNEE, reviewHistory: [],
  };
  assert.deepStrictEqual(buildCurrent(p, { filled: 1, total: 2, percent: 50 }, ['pH'], true), {
    label: 'QC กำลังตรวจ — pH (50%)',
    tracks: { qc: { label: 'QC กำลังตรวจ — pH (50%)', percent: 50 } },
  });
});

// ─── Task 3: buildTimeline / timelineLabel ───────────────────────────────────
const { buildTimeline, timelineLabel } = require('./petitionStatusLog');

test('timeline: maps milestone events in order; skips non-milestones', () => {
  const petition = { assignedTo: { name: 'สมชาย' } };
  const logs = [
    { event: 'created', createdAt: '1', actor: 'u1' },
    { event: 'statusChanged', toStatus: 'sampleSent', createdAt: '2', actor: 'u1' },
    { event: 'received', metadata: { side: 'qc' }, createdAt: '3', actor: 'qc1' },
    { event: 'received', metadata: { side: 'lab' }, createdAt: '4', actor: 'lab1' },
    { event: 'assigned', createdAt: '5', actor: 'm1' },
    { event: 'resultEntered', metadata: { parameterName: 'pH' }, createdAt: '6', actor: 'qc1' },
    { event: 'resultUpdated', metadata: { parameterName: 'pH' }, createdAt: '7', actor: 'qc1' },
    { event: 'reviewed', createdAt: '8', actor: 'x' },
    { event: 'updated', createdAt: '9', actor: 'x' },
    { event: 'statusChanged', toStatus: 'inProgress', createdAt: '10', actor: 'x' },
    { event: 'statusChanged', toStatus: 'success', createdAt: '11', actor: 'x' },
    { event: 'statusChanged', toStatus: 'approved', createdAt: '12', actor: 'boss' },
  ];
  assert.deepStrictEqual(buildTimeline(logs, petition).map((t) => t.label), [
    'ยื่นคำขอ',
    'ส่งตัวอย่าง',
    'QC รับตัวอย่าง',
    'Lab รับตัวอย่าง',
    'มอบหมายให้ สมชาย',
    'QC บันทึกผล — pH',
    'QC แก้ไขผล — pH',
    'เสร็จสิ้น — รอหัวหน้า QC ยืนยัน',
    'หัวหน้า QC อนุมัติ — ปิดงาน',
  ]);
});

test('timeline: received carries side; entries carry at + actor', () => {
  const logs = [{ event: 'received', metadata: { side: 'lab' }, createdAt: 'T', actor: 'lab1' }];
  assert.deepStrictEqual(buildTimeline(logs, {}), [
    { label: 'Lab รับตัวอย่าง', at: 'T', actor: 'lab1', side: 'lab' },
  ]);
});

test('timelineLabel: rejected status change', () => {
  assert.strictEqual(timelineLabel({ event: 'statusChanged', toStatus: 'rejected' }, {}), 'ส่งกลับให้แก้ไข');
});

test('timelineLabel: assigned falls back to note when no assignee name', () => {
  assert.strictEqual(timelineLabel({ event: 'assigned', note: 'มอบหมายให้ ก' }, {}), 'มอบหมายให้ ก');
});

test('timelineLabel: resultEntered with no param name', () => {
  assert.strictEqual(timelineLabel({ event: 'resultEntered', metadata: {} }, {}), 'QC บันทึกผล');
});

test('timelineLabel: unknown event → null (skipped)', () => {
  assert.strictEqual(timelineLabel({ event: 'deleted' }, {}), null);
});

// ─── Task 4: buildStatusLog ──────────────────────────────────────────────────
const { buildStatusLog } = require('./petitionStatusLog');

test('buildStatusLog: combines dual-track current + timeline', () => {
  const petition = {
    status: 'inProgress',
    items: [{ seq: 1, commonName: 'NaOH', batchNo: 'B-2' }], // non-lab batch → no lab track
    qcReceivedAt: 'T',
    assignedTo: { name: 'ก', assignedBy: 'แอดมิน' },
    reviewHistory: [],
  };
  const auditLogs = [{ event: 'created', createdAt: '1', actor: 'u' }];
  const parameters = [
    { _id: 'p1', name: 'pH', status: 'active', scope: 'qc', commonNames: ['NaOH'] },
    { _id: 'p2', name: 'ความชื้น', status: 'active', scope: 'qc', commonNames: ['NaOH'] },
  ];
  const qcResults = [{ itemSeq: 1, parameterId: 'p1', parameterName: 'pH', values: { v: '7' }, enteredAt: '1' }];
  const out = buildStatusLog(petition, auditLogs, qcResults, parameters, true);
  assert.strictEqual(out.current.label, 'QC กำลังตรวจ — pH (50%)');
  assert.strictEqual(out.current.tracks.qc.percent, 50);
  assert.strictEqual(out.current.tracks.lab, undefined);
  assert.deepStrictEqual(out.timeline.map((t) => t.label), ['ยื่นคำขอ']);
});
