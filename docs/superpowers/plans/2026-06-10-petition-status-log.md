# Petition `status_log` API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a derived, human-readable `status_log` (`{ current, timeline }`) to the petitions API via a new `GET /api/petitions/status-log/:id` endpoint — no DB schema change.

**Architecture:** A pure-function module `server/lib/petitionStatusLog.js` computes the current status label and a timeline from data the route loads (`Petition`, `PetitionAuditLog`, `QCTestResult`, `Parameter`, `PhysicalResult`). The route is thin: load inputs, call `buildStatusLog`, return JSON. QC progress % is a lightweight server heuristic (item × QC-param granularity), intentionally approximate vs. the frontend field/unit bar.

**Tech Stack:** Node.js / Express 4 / Mongoose 8. Tests use Node's built-in `node:test` + `node:assert` (CommonJS), run with `node --test lib/<file>.test.js` from `server/` — matching every existing `server/lib/*.test.js`.

**Spec:** `docs/superpowers/specs/2026-06-10-petition-status-log-design.md`

---

## File Structure

- **Create** `server/lib/petitionStatusLog.js` — pure functions: `isLabBatch`, `hasFilledValue`, `qcParamAppliesToItem`, `computeQcHeuristic`, `enteredParamNames`, `buildCurrent`, `timelineLabel`, `buildTimeline`, `buildStatusLog`. No DB access.
- **Create** `server/lib/petitionStatusLog.test.js` — `node:test` unit tests for all of the above.
- **Modify** `server/routes/petitions.js` — add requires + `GET /status-log/:id` route, declared **before** the generic `GET /:id` (so Express does not match `status-log` as an `:id`).

Each task appends to the same module file; tests grow alongside.

---

## Task 1: QC heuristic + helpers

**Files:**
- Create: `server/lib/petitionStatusLog.js`
- Test: `server/lib/petitionStatusLog.test.js`

- [ ] **Step 1: Write the failing test**

Create `server/lib/petitionStatusLog.test.js`:

```js
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
    { itemSeq: 1, parameterId: 'pX', values: { v: '7' } }, // extra not in matched set
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && node --test lib/petitionStatusLog.test.js`
Expected: FAIL — `Cannot find module './petitionStatusLog'`.

- [ ] **Step 3: Write minimal implementation**

Create `server/lib/petitionStatusLog.js`:

```js
// Derives a human-readable status_log ({ current, timeline }) for a petition.
// Pure functions — NO DB access. The route loads inputs and calls buildStatusLog.

// Lab batch rule (mirrors src/types/petition.types.ts isLabBatch):
// last char of trimmed batchNo is '1' or '6'.
function isLabBatch(batchNo) {
  const last = String(batchNo ?? '').trim().slice(-1);
  return last === '1' || last === '6';
}

// True if a QCTestResult.values object has at least one non-empty field value.
function hasFilledValue(values) {
  if (!values || typeof values !== 'object') return false;
  return Object.values(values).some((v) => v != null && String(v).trim() !== '');
}

// Lightweight QC-applicability check (heuristic — intentionally OMITS
// productType / subCategory / itemGroup / simple-method dimensions that the
// frontend matchParametersForItem uses).
function qcParamAppliesToItem(param, item) {
  if (param.applyAll) return true;
  const commonName = String(item.commonName ?? '').trim().toUpperCase();
  if (commonName && (param.commonNames ?? []).some((c) => String(c).trim().toUpperCase() === commonName)) {
    return true;
  }
  const sampleName = String(item.sampleName ?? '').trim();
  if (sampleName && (param.itemNames ?? []).some((n) => String(n).trim() === sampleName)) {
    return true;
  }
  const testNames = String(item.testItems ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (testNames.length && testNames.includes(String(param.name ?? '').trim().toLowerCase())) {
    return true;
  }
  return false;
}

// { filled, total, percent } at the (item × QC-param) granularity.
function computeQcHeuristic(petition, qcResults, parameters) {
  const items = petition.items ?? [];
  const qcParams = (parameters ?? []).filter(
    (p) => p.status === 'active' && (p.scope ?? 'qc') !== 'lab',
  );

  let total = 0;
  for (const item of items) {
    for (const p of qcParams) {
      if (qcParamAppliesToItem(p, item)) total += 1;
    }
  }

  const filledKeys = new Set();
  for (const r of qcResults ?? []) {
    if (hasFilledValue(r.values)) filledKeys.add(`${r.itemSeq}__${r.parameterId}`);
  }
  let filled = filledKeys.size;
  if (total > 0 && filled > total) filled = total; // cap so percent never exceeds 100
  const percent = total > 0 ? Math.round((filled / total) * 100) : 0;
  return { filled, total, percent };
}

// Distinct QC parameter names that have >=1 filled value, ordered by first enteredAt.
function enteredParamNames(qcResults) {
  const rows = (qcResults ?? [])
    .filter((r) => hasFilledValue(r.values))
    .slice()
    .sort((a, b) => new Date(a.enteredAt ?? 0) - new Date(b.enteredAt ?? 0));
  const seen = new Set();
  const names = [];
  for (const r of rows) {
    const name = String(r.parameterName ?? r.parameterId ?? '').trim();
    if (name && !seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names;
}

module.exports = {
  isLabBatch,
  hasFilledValue,
  qcParamAppliesToItem,
  computeQcHeuristic,
  enteredParamNames,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && node --test lib/petitionStatusLog.test.js`
Expected: PASS — all tests, `fail 0`.

- [ ] **Step 5: Commit**

```bash
git add server/lib/petitionStatusLog.js server/lib/petitionStatusLog.test.js
git commit -m "feat(petition): QC progress heuristic for status_log"
```

---

## Task 2: `buildCurrent` (10-rule current status)

**Files:**
- Modify: `server/lib/petitionStatusLog.js`
- Test: `server/lib/petitionStatusLog.test.js`

- [ ] **Step 1: Write the failing test**

Append to `server/lib/petitionStatusLog.test.js`:

```js
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
  const p = { status: 'inProgress', items: [{ batchNo: 'B-1' }] }; // lab batch (ends 1)
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
  const p = { status: 'inProgress', items: [{ batchNo: 'B-2' }] }; // not lab (ends 2)
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && node --test lib/petitionStatusLog.test.js`
Expected: FAIL — `buildCurrent is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `server/lib/petitionStatusLog.js`, add this function **above** `module.exports`:

```js
// Current detailed status. First matching rule wins (see spec table).
// qc = output of computeQcHeuristic; paramNames = enteredParamNames(...);
// labDone = every lab sampleId has a completed PhysicalResult (route-computed).
function buildCurrent(petition, qc, paramNames, labDone) {
  const status = petition.status;
  const testing = status === 'inProgress';
  const hasLabItem = (petition.items ?? []).some((it) => isLabBatch(it.batchNo ?? ''));

  if (status === 'approved') return { label: 'หัวหน้า QC อนุมัติ — ปิดงาน' };
  if (status === 'rejected') return { label: 'ส่งกลับให้แก้ไข' };
  if (status === 'success') return { label: 'เสร็จสิ้น — รอหัวหน้า QC ยืนยัน', side: 'qc' };

  // rule 4 — active QC entry (partial); shown before lab-waiting so progress isn't masked
  if (testing && qc.filled > 0 && qc.filled < qc.total) {
    const names = (paramNames ?? []).length ? ` — ${paramNames.join(', ')}` : '';
    return { label: `QC กำลังตรวจ${names} (${qc.percent}%)`, side: 'qc', percent: qc.percent };
  }
  // rule 5 — lab must finish before final QC confirm
  if (hasLabItem && !labDone) {
    return { label: 'รอผลตรวจจาก Lab', side: 'lab' };
  }
  // rule 6 — QC done (and lab done / none) → final per-sample QC confirm
  if (testing && qc.total > 0 && qc.filled >= qc.total) {
    return { label: 'รอ QC ยืนยันผล', side: 'qc' };
  }

  const labReceived = !!petition.labReceivedAt;
  const qcReceived = !!petition.qcReceivedAt;
  if (labReceived && qcReceived) return { label: 'Lab & QC รับแล้ว' };
  if (labReceived || qcReceived) {
    const who = qcReceived ? 'QC' : 'Lab';
    const other = qcReceived ? 'Lab' : 'QC';
    return { label: `${who} รับแล้ว · ${other} รอรับ` };
  }
  if (status === 'sampleSent') return { label: 'ส่งตัวอย่างแล้ว — รอรับ' };
  return { label: 'กำลังนำส่ง QC' };
}
```

Then add `buildCurrent` to the `module.exports` object.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && node --test lib/petitionStatusLog.test.js`
Expected: PASS — `fail 0`.

- [ ] **Step 5: Commit**

```bash
git add server/lib/petitionStatusLog.js server/lib/petitionStatusLog.test.js
git commit -m "feat(petition): current status label derivation (10 rules)"
```

---

## Task 3: `buildTimeline` (audit event → label)

**Files:**
- Modify: `server/lib/petitionStatusLog.js`
- Test: `server/lib/petitionStatusLog.test.js`

- [ ] **Step 1: Write the failing test**

Append to `server/lib/petitionStatusLog.test.js`:

```js
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
    { event: 'reviewed', createdAt: '8', actor: 'x' },                                  // skipped
    { event: 'updated', createdAt: '9', actor: 'x' },                                   // skipped
    { event: 'statusChanged', toStatus: 'inProgress', createdAt: '10', actor: 'x' },    // skipped
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && node --test lib/petitionStatusLog.test.js`
Expected: FAIL — `buildTimeline is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `server/lib/petitionStatusLog.js`, add **above** `module.exports`:

```js
// Maps one audit-log row to a Thai milestone label, or null to skip it.
function timelineLabel(log, petition) {
  const md = log.metadata || {};
  switch (log.event) {
    case 'created':
      return 'ยื่นคำขอ';
    case 'received':
      return md.side === 'lab' ? 'Lab รับตัวอย่าง' : 'QC รับตัวอย่าง';
    case 'assigned':
      return petition?.assignedTo?.name
        ? `มอบหมายให้ ${petition.assignedTo.name}`
        : (log.note || 'มอบหมาย');
    case 'resultEntered': {
      const p = md.parameterName || md.parameterId || '';
      return p ? `QC บันทึกผล — ${p}` : 'QC บันทึกผล';
    }
    case 'resultUpdated': {
      const p = md.parameterName || md.parameterId || '';
      return p ? `QC แก้ไขผล — ${p}` : 'QC แก้ไขผล';
    }
    case 'statusChanged':
      if (log.toStatus === 'sampleSent') return 'ส่งตัวอย่าง';
      if (log.toStatus === 'success') return 'เสร็จสิ้น — รอหัวหน้า QC ยืนยัน';
      if (log.toStatus === 'approved') return 'หัวหน้า QC อนุมัติ — ปิดงาน';
      if (log.toStatus === 'rejected') return 'ส่งกลับให้แก้ไข';
      return null; // other status transitions are not milestones
    default:
      return null; // reviewed / updated / deleted → skipped
  }
}

// Builds the milestone timeline from audit logs (assumed already ascending by createdAt).
function buildTimeline(auditLogs, petition) {
  const out = [];
  for (const log of auditLogs ?? []) {
    const label = timelineLabel(log, petition);
    if (!label) continue;
    const entry = { label, at: log.createdAt, actor: log.actor };
    if (log.event === 'received' && log.metadata?.side) entry.side = log.metadata.side;
    out.push(entry);
  }
  return out;
}
```

Then add `timelineLabel` and `buildTimeline` to `module.exports`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && node --test lib/petitionStatusLog.test.js`
Expected: PASS — `fail 0`.

- [ ] **Step 5: Commit**

```bash
git add server/lib/petitionStatusLog.js server/lib/petitionStatusLog.test.js
git commit -m "feat(petition): timeline label mapping for status_log"
```

---

## Task 4: `buildStatusLog` wrapper + route wiring

**Files:**
- Modify: `server/lib/petitionStatusLog.js`
- Modify: `server/routes/petitions.js` (requires near top; new route before `GET /:id` at line ~243)
- Test: `server/lib/petitionStatusLog.test.js`

- [ ] **Step 1: Write the failing test**

Append to `server/lib/petitionStatusLog.test.js`:

```js
const { buildStatusLog } = require('./petitionStatusLog');

test('buildStatusLog: combines current + timeline', () => {
  const petition = {
    status: 'inProgress',
    items: [{ seq: 1, commonName: 'NaOH' }],
    assignedTo: { name: 'ก' },
  };
  const auditLogs = [{ event: 'created', createdAt: '1', actor: 'u' }];
  const parameters = [
    { _id: 'p1', name: 'pH', status: 'active', scope: 'qc', commonNames: ['NaOH'] },
    { _id: 'p2', name: 'ความชื้น', status: 'active', scope: 'qc', commonNames: ['NaOH'] },
  ];
  const qcResults = [{ itemSeq: 1, parameterId: 'p1', parameterName: 'pH', values: { v: '7' }, enteredAt: '1' }];
  const out = buildStatusLog(petition, auditLogs, qcResults, parameters, true);
  assert.strictEqual(out.current.label, 'QC กำลังตรวจ — pH (50%)');
  assert.strictEqual(out.current.percent, 50);
  assert.deepStrictEqual(out.timeline.map((t) => t.label), ['ยื่นคำขอ']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && node --test lib/petitionStatusLog.test.js`
Expected: FAIL — `buildStatusLog is not a function`.

- [ ] **Step 3: Write minimal implementation (lib)**

In `server/lib/petitionStatusLog.js`, add **above** `module.exports`:

```js
// Top-level: assemble { current, timeline } from route-loaded inputs.
function buildStatusLog(petition, auditLogs, qcResults, parameters, labDone) {
  const qc = computeQcHeuristic(petition, qcResults, parameters);
  const paramNames = enteredParamNames(qcResults);
  const current = buildCurrent(petition, qc, paramNames, !!labDone);
  const timeline = buildTimeline(auditLogs, petition);
  return { current, timeline };
}
```

Then add `buildStatusLog` to `module.exports`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && node --test lib/petitionStatusLog.test.js`
Expected: PASS — all tests across Tasks 1–4, `fail 0`.

- [ ] **Step 5: Wire the route**

In `server/routes/petitions.js`, add requires after the existing model requires (the block around lines 4–10, where `PhysicalResult` is already required):

```js
const QCTestResult = require('../models/QCTestResult');
const Parameter = require('../models/Parameter');
const { buildStatusLog, isLabBatch } = require('../lib/petitionStatusLog');
```

Then add this route **immediately after** the existing `GET /:id/audit-logs` handler and **before** `GET /:id` (i.e. right after the block ending near line 240):

```js
// GET /api/petitions/status-log/:id → derived human-readable status + timeline
router.get('/status-log/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const petition = mongoose.Types.ObjectId.isValid(id)
      ? await Petition.findById(id).lean()
      : await Petition.findOne({ petitionNo: id }).lean();
    if (!petition) return res.status(404).json({ error: { message: 'ไม่พบคำร้อง' } });

    const [auditLogs, qcResults, parameters] = await Promise.all([
      PetitionAuditLog.find({ petitionId: petition._id }).sort({ createdAt: 1 }).lean(),
      QCTestResult.find({ petitionId: String(petition._id) }).lean(),
      Parameter.find({ status: 'active' }).lean(),
    ]);

    // labDone: every lab sampleId has a completed PhysicalResult
    const labSampleIds = (petition.items || [])
      .filter((it) => isLabBatch(it.batchNo || ''))
      .map((it) => it.sampleId || `${petition.petitionNo}-${it.seq}`)
      .filter(Boolean);
    let labDone = true;
    if (labSampleIds.length > 0) {
      const physResults = await PhysicalResult.find({ sampleId: { $in: labSampleIds } }).lean();
      labDone = labSampleIds.every(
        (sid) => physResults.find((p) => p.sampleId === sid)?.status === 'completed',
      );
    }

    res.json(buildStatusLog(petition, auditLogs, qcResults, parameters, labDone));
  } catch (err) {
    res.status(400).json({ error: { message: err.message } });
  }
});
```

- [ ] **Step 6: Verify the route file loads (syntax/require check)**

Run: `cd server && node -e "require('./routes/petitions'); console.log('petitions route OK')"`
Expected: prints `petitions route OK` with no error.

- [ ] **Step 7: Manual smoke test (requires running backend + DB)**

Start the backend (`cd server && npm run dev`), then with a real petition id or petitionNo:

Run: `curl -s http://localhost:3001/api/petitions/status-log/<petitionNoOrId>`
Expected: JSON `{ "current": { "label": ... }, "timeline": [ ... ] }`. A bad id returns `404 {"error":{"message":"ไม่พบคำร้อง"}}`.

(If no backend/DB is available in this environment, note that Step 6 covers wiring correctness and the lib tests cover all logic; mark Step 7 as deferred to manual verification rather than blocking.)

- [ ] **Step 8: Commit**

```bash
git add server/lib/petitionStatusLog.js server/lib/petitionStatusLog.test.js server/routes/petitions.js
git commit -m "feat(petition): GET /status-log/:id derived status_log endpoint"
```

---

## Self-Review Notes

- **Spec coverage:** Architecture/endpoint → Task 4 Step 5. Timeline table → Task 3. Current 10-rule table → Task 2. QC heuristic → Task 1. labDone (Rule 5 predicate) → Task 4 route. Testing section → tests in every task.
- **Route ordering:** `GET /status-log/:id` is declared before generic `GET /:id` (Task 4 Step 5) — required so Express does not treat `status-log` as `:id`.
- **Type consistency:** `buildStatusLog(petition, auditLogs, qcResults, parameters, labDone)` and `computeQcHeuristic(petition, qcResults, parameters)` signatures match between spec, lib, and route call sites. `QCTestResult.petitionId` is a String of the petition `_id` (confirmed in model + qc-results audit path) → queried with `String(petition._id)`.
- **No frontend in scope** (API only), per spec "Out of scope".
```
