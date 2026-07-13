const { isLabBatch, isPetitionComplete } = require('./petitionStatusLog');
const { qcBaselineMinutes, qcReceivedAtOf } = require('./qcParamBaseline');

const MS_PER_MIN = 60000;
const AT_RISK_RATIO = 0.8;
const UNASSIGNED_ALERT_MIN = 24 * 60;
const ACTION_QUEUE_LIMIT = 20;

const STAGE_ORDER = [
  'waitingReceive', 'pendingAssign', 'labTesting', 'qcTesting', 'waitingLabApprove', 'waitingFinal',
];

const STAGE_LABELS = {
  waitingReceive: 'รอรับตัวอย่าง',
  pendingAssign: 'รอ assign',
  labTesting: 'Lab กำลังทดสอบ',
  qcTesting: 'QC กำลังทดสอบ',
  waitingLabApprove: 'รอออกผล Lab',
  waitingFinal: 'รอออก Final Result',
};

function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function minutesSince(value, now) {
  const d = toDate(value);
  return d ? Math.max(0, (now - d.getTime()) / MS_PER_MIN) : null;
}

function hasLabTrack(petition) {
  return ((petition || {}).items || []).some((item) => isLabBatch(item.batchNo || ''));
}

/** เวลามาตรฐานของงาน Lab = ผลรวมของทุกเครื่องที่ assign (สมมติทำเรียงกัน ไม่ใช่ขนาน) */
function labBaselineMinutes(petition) {
  const machines = (petition || {}).assignedMachines || [];
  const values = machines
    .map((m) => Number(m.estimatedMinutes))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0);
}

// state bands (baselineMin != null):
//   elapsed >  baseline            → overdue (overdueMin = elapsed - baseline)
//   baseline*0.8 <= elapsed < baseline → atRisk
//   otherwise                      → ok
// The upper bound on atRisk matters: at elapsed === baseline exactly ("used up
// 100% of the allotted time but not a minute over"), this must read as ok, not
// atRisk — that boundary case is asserted by the "exactly the baseline" test.
function classify(elapsedMin, baselineMin) {
  if (baselineMin == null) return { state: 'noBaseline', overdueMin: null };
  if (elapsedMin > baselineMin) return { state: 'overdue', overdueMin: elapsedMin - baselineMin };
  if (elapsedMin >= baselineMin * AT_RISK_RATIO && elapsedMin < baselineMin) {
    return { state: 'atRisk', overdueMin: null };
  }
  return { state: 'ok', overdueMin: null };
}

function unit(petition, track, stage, elapsedMin, baselineMin, overrideState) {
  // ด่านที่ "ไม่มีเกณฑ์เวลา" โดยธรรมชาติ (รอรับ / รอลายเซ็นหัวหน้า) ไม่ควรถูกติดป้ายว่า
  // noBaseline — มันแค่เข้าคิวรอคน ไม่ใช่ขาดข้อมูลเกณฑ์ · noBaseline สงวนไว้ให้ด่าน
  // ทดสอบที่หาเวลามาตรฐานไม่ได้จริง ๆ เท่านั้น
  const { state, overdueMin } = overrideState
    ? { state: overrideState, overdueMin: null }
    : classify(elapsedMin, baselineMin);
  return {
    petitionId: String(petition._id),
    petitionNo: petition.petitionNo,
    dept: petition.dept,
    priority: petition.priority === 1 ? 1 : 0,
    track,
    stage,
    stageLabel: STAGE_LABELS[stage],
    assigneeName: petition.assignedTo?.name || '',
    elapsedMin: Math.round(elapsedMin),
    baselineMin: baselineMin == null ? null : Math.round(baselineMin),
    overdueMin: overdueMin == null ? null : Math.round(overdueMin),
    state,
  };
}

function isOpen(petition) {
  const p = petition || {};
  return !p.approvedAt && p.status !== 'rejected' && p.status !== 'approved';
}

/** หนึ่งใบให้ได้หลาย unit ได้ — Lab กับ QC เดินขนานกัน */
function openWorkUnits(petitions, { now, qcBaseline }) {
  const units = [];

  for (const petition of petitions || []) {
    if (!isOpen(petition)) continue;

    const labTrack = hasLabTrack(petition);
    const qcReceived = qcReceivedAtOf(petition);
    const labReceived = toDate(petition.labReceivedAt);
    const assignedAt = toDate(petition.assignedTo?.assignedAt);
    const labCompleted = toDate(petition.labCompletedAt);
    const labApproved = toDate(petition.labApprovedAt);
    const qcCompleted = toDate(petition.qcCompletedAt);

    // ── Lab track
    if (labTrack) {
      if (!labReceived) {
        const elapsed = minutesSince(petition.sampleSentAt, now);
        if (elapsed != null) units.push(unit(petition, 'lab', 'waitingReceive', elapsed, null, 'ok'));
      } else if (!assignedAt) {
        const elapsed = minutesSince(labReceived, now);
        const state = elapsed >= UNASSIGNED_ALERT_MIN ? 'unassigned' : 'ok';
        units.push(unit(petition, 'lab', 'pendingAssign', elapsed, null, state));
      } else if (!labCompleted) {
        const elapsed = minutesSince(labReceived, now);
        units.push(unit(petition, 'lab', 'labTesting', elapsed, labBaselineMinutes(petition)));
      } else if (!labApproved) {
        const elapsed = minutesSince(labCompleted, now);
        units.push(unit(petition, 'lab', 'waitingLabApprove', elapsed, null, 'ok'));
      }
    }

    // ── QC track
    if (!qcReceived) {
      const elapsed = minutesSince(petition.sampleSentAt, now);
      if (elapsed != null && !labTrack) units.push(unit(petition, 'qc', 'waitingReceive', elapsed, null, 'ok'));
    } else if (!qcCompleted) {
      const elapsed = minutesSince(qcReceived, now);
      units.push(unit(petition, 'qc', 'qcTesting', elapsed, qcBaselineMinutes(petition, qcBaseline)));
    }

    // ── รอ Final Result (ทุกรางที่ใบนี้มี ทดสอบครบแล้ว)
    if (isPetitionComplete(petition)) {
      const startedAt = Math.max(
        qcCompleted ? qcCompleted.getTime() : 0,
        labApproved ? labApproved.getTime() : 0,
      );
      if (startedAt > 0) {
        units.push(unit(petition, 'final', 'waitingFinal', (now - startedAt) / MS_PER_MIN, null, 'ok'));
      }
    }
  }

  return units;
}

function bottleneckCounts(units) {
  return STAGE_ORDER.map((stage) => ({
    stage,
    label: STAGE_LABELS[stage],
    count: (units || []).filter((u) => u.stage === stage).length,
  }));
}

function buildLiveSection(petitions, { now, qcBaseline, abnormalFlags = {} }) {
  const units = openWorkUnits(petitions, { now, qcBaseline });
  const openPetitions = (petitions || []).filter(isOpen);

  const counts = {
    urgent: openPetitions.filter((p) => p.priority === 1).length,
    overdue: units.filter((u) => u.state === 'overdue').length,
    atRisk: units.filter((u) => u.state === 'atRisk').length,
    unassigned: units.filter((u) => u.state === 'unassigned').length,
    waitingHead: units.filter((u) => u.stage === 'waitingLabApprove' || u.stage === 'waitingFinal').length,
    abnormal: openPetitions.filter((p) => abnormalFlags[String(p._id)]).length,
  };

  // งานที่กำลังทดสอบและยังอยู่ในเกณฑ์ (state 'ok') ไม่ต้องรบกวนหัวหน้า — แต่ด่านที่
  // "รอคนมาทำ" ต้องโผล่เสมอ แม้จะยังไม่เกินเวลา เพราะมันคือคิวที่รอการตัดสินใจ
  const QUEUE_STAGES = new Set(['waitingReceive', 'waitingLabApprove', 'waitingFinal']);

  // เรียง: เกินเวลามากสุด → ค้างไม่มี assign → เสี่ยงเลท → ที่เหลือตามอายุ
  const rank = { overdue: 0, unassigned: 1, atRisk: 2, noBaseline: 3, ok: 4 };
  const actionQueue = [...units]
    .filter((u) => u.state !== 'ok' || QUEUE_STAGES.has(u.stage))
    .sort((a, b) => {
      const byState = rank[a.state] - rank[b.state];
      if (byState !== 0) return byState;
      if (a.overdueMin != null && b.overdueMin != null) return b.overdueMin - a.overdueMin;
      return b.elapsedMin - a.elapsedMin;
    })
    .slice(0, ACTION_QUEUE_LIMIT);

  return { counts, bottleneck: bottleneckCounts(units), actionQueue };
}

module.exports = {
  STAGE_ORDER,
  STAGE_LABELS,
  ACTION_QUEUE_LIMIT,
  hasLabTrack,
  labBaselineMinutes,
  openWorkUnits,
  bottleneckCounts,
  buildLiveSection,
};
