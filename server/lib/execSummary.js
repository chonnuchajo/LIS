const { isLabBatch, isPetitionComplete } = require('./petitionStatusLog');
const { qcBaselineMinutes, qcReceivedAtOf, qcDurationMinutes } = require('./qcParamBaseline');

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

    // ── Lab track — stage comes from the FURTHEST progress reached, walking the
    // states in reverse so a later milestone always wins over an earlier missing
    // timestamp. Real petitions have gaps (e.g. a receive scan that was never
    // recorded) even after later stages completed — see P-2606-0010, where
    // labReceivedAt is null but labApprovedAt proves the Lab track is done.
    if (labTrack) {
      if (labApproved) {
        // Lab track done — nothing to emit.
      } else if (labCompleted) {
        const elapsed = minutesSince(labCompleted, now);
        units.push(unit(petition, 'lab', 'waitingLabApprove', elapsed, null, 'ok'));
      } else if (assignedAt) {
        const elapsed = minutesSince(labReceived || assignedAt, now);
        units.push(unit(petition, 'lab', 'labTesting', elapsed, labBaselineMinutes(petition)));
      } else if (labReceived) {
        const elapsed = minutesSince(labReceived, now);
        const state = elapsed >= UNASSIGNED_ALERT_MIN ? 'unassigned' : 'ok';
        units.push(unit(petition, 'lab', 'pendingAssign', elapsed, null, state));
      } else {
        const elapsed = minutesSince(petition.sampleSentAt, now);
        if (elapsed != null) units.push(unit(petition, 'lab', 'waitingReceive', elapsed, null, 'ok'));
      }
    }

    // ── QC track — same furthest-progress principle: qcCompletedAt wins over a
    // missing qcReceivedAt (a receive scan that was never recorded).
    if (qcCompleted) {
      // QC track done — nothing to emit.
    } else if (qcReceived) {
      const elapsed = minutesSince(qcReceived, now);
      units.push(unit(petition, 'qc', 'qcTesting', elapsed, qcBaselineMinutes(petition, qcBaseline)));
    } else {
      // The "nobody has received it yet" wait is shared across tracks — suppress the
      // QC copy only while Lab is ALSO still waiting (Lab's unit already reports it).
      // Once Lab has received and QC hasn't, this is a distinct, QC-only lag (Lab and
      // QC receive independently via PATCH /petitions/:id/receive side=lab|qc) and
      // must get its own unit — otherwise a stuck QC receive is invisible.
      const sharedWaitAlreadyReported = labTrack && !labReceived;
      const elapsed = minutesSince(petition.sampleSentAt, now);
      if (elapsed != null && !sharedWaitAlreadyReported) units.push(unit(petition, 'qc', 'waitingReceive', elapsed, null, 'ok'));
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

/** ตัด id ซ้ำออกโดยรักษาลำดับเดิม — หนึ่งใบอาจมี 2 work unit (lab+qc) แต่ต้องนับ/แสดงครั้งเดียว */
function uniqueIds(ids) {
  const seen = new Set();
  const result = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

function buildLiveSection(petitions, { now, qcBaseline, abnormalFlags = {} }) {
  const units = openWorkUnits(petitions, { now, qcBaseline });
  const openPetitions = (petitions || []).filter(isOpen);

  // แหล่งเดียวกันสำหรับทั้ง counts และ ids — เพื่อไม่ให้ตัวเลขกับ id ที่ลิงก์ไปเพี้ยนกัน
  const urgentPetitions = openPetitions.filter((p) => p.priority === 1);
  const overdueUnits = units.filter((u) => u.state === 'overdue');
  const atRiskUnits = units.filter((u) => u.state === 'atRisk');
  const unassignedUnits = units.filter((u) => u.state === 'unassigned');
  const waitingHeadUnits = units.filter((u) => u.stage === 'waitingLabApprove' || u.stage === 'waitingFinal');
  const abnormalPetitions = openPetitions.filter((p) => abnormalFlags[String(p._id)]);

  // ids ก่อน แล้วนับจาก ids.length เสมอ — เพื่อให้ตัวเลขบน tile กับใบที่ลิงก์ไป
  // highlight ตรงกันโดยโครงสร้าง (ไม่ใช่บังเอิญ) แม้ใบเดียวจะมีหลาย work unit
  // (เช่น lab-batch ที่เกินเวลาทั้งราง Lab และ QC พร้อมกัน) ก็ต้องนับครั้งเดียว
  const ids = {
    urgent: uniqueIds(urgentPetitions.map((p) => String(p._id))),
    overdue: uniqueIds(overdueUnits.map((u) => u.petitionId)),
    atRisk: uniqueIds(atRiskUnits.map((u) => u.petitionId)),
    unassigned: uniqueIds(unassignedUnits.map((u) => u.petitionId)),
    waitingHead: uniqueIds(waitingHeadUnits.map((u) => u.petitionId)),
    abnormal: uniqueIds(abnormalPetitions.map((p) => String(p._id))),
  };

  const counts = Object.fromEntries(Object.entries(ids).map(([key, list]) => [key, list.length]));

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

  return { counts, ids, bottleneck: bottleneckCounts(units), actionQueue };
}

function diffMinutes(from, to) {
  const a = toDate(from);
  const b = toDate(to);
  if (!a || !b) return null;
  const minutes = (b.getTime() - a.getTime()) / MS_PER_MIN;
  return minutes >= 0 ? minutes : null;
}

/** nearest-rank percentile — p90 ของ 10 ตัวอย่าง = ตัวที่ 9 (เรียงน้อยไปมาก) */
function percentile(values, ratio) {
  const list = (values || []).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!list.length) return null;
  const rank = Math.max(1, Math.ceil(ratio * list.length));
  return list[rank - 1];
}

function localDateKey(ms) {
  const d = new Date(ms);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/** เวลาที่แต่ละใบใช้ในแต่ละด่าน — ใบที่ timestamp ไม่ครบจะไม่ถูกนับในด่านนั้น (ไม่ทำให้ค่าเฉลี่ยเป็น NaN) */
function stageDurations(petition) {
  const qcReceived = qcReceivedAtOf(petition);
  const labTrack = hasLabTrack(petition);
  return {
    waitingReceive: diffMinutes(petition.sampleSentAt, labTrack ? petition.labReceivedAt : qcReceived),
    pendingAssign: labTrack ? diffMinutes(petition.labReceivedAt, petition.assignedTo?.assignedAt) : null,
    labTesting: labTrack ? diffMinutes(petition.labReceivedAt, petition.labCompletedAt) : null,
    qcTesting: qcDurationMinutes(petition),
    waitingLabApprove: labTrack ? diffMinutes(petition.labCompletedAt, petition.labApprovedAt) : null,
    waitingFinal: diffMinutes(
      labTrack ? petition.labApprovedAt : petition.qcCompletedAt,
      petition.approvedAt,
    ),
  };
}

function totalMinutes(petition) {
  return diffMinutes(petition.createdAt, petition.approvedAt);
}

function averageOf(values) {
  const list = (values || []).filter((n) => Number.isFinite(n));
  if (!list.length) return null;
  return list.reduce((a, b) => a + b, 0) / list.length;
}

function round(value) {
  return value == null ? null : Math.round(value);
}

function buildStatsSection(closedPetitions, { now, days, abnormalFlags = {}, qcTesterNames = {} }) {
  const petitions = closedPetitions || [];

  // ── turnaround ต่อด่าน
  const samplesByStage = Object.fromEntries(STAGE_ORDER.map((stage) => [stage, []]));
  for (const petition of petitions) {
    const durations = stageDurations(petition);
    for (const stage of STAGE_ORDER) {
      const value = durations[stage];
      if (value != null) samplesByStage[stage].push(value);
    }
  }
  const turnaround = STAGE_ORDER.map((stage) => ({
    stage,
    label: STAGE_LABELS[stage],
    avgMin: round(averageOf(samplesByStage[stage])),
    p90Min: round(percentile(samplesByStage[stage], 0.9)),
    count: samplesByStage[stage].length,
  }));

  // ── throughput รายวัน (วันนี้อยู่ท้ายสุด)
  const buckets = new Map();
  for (let i = days - 1; i >= 0; i -= 1) {
    buckets.set(localDateKey(now - i * 86400000), { created: 0, completed: 0 });
  }
  for (const petition of petitions) {
    const createdKey = petition.createdAt ? localDateKey(new Date(petition.createdAt).getTime()) : null;
    if (createdKey && buckets.has(createdKey)) buckets.get(createdKey).created += 1;
    const doneKey = petition.approvedAt ? localDateKey(new Date(petition.approvedAt).getTime()) : null;
    if (doneKey && buckets.has(doneKey)) buckets.get(doneKey).completed += 1;
  }
  const throughput = Array.from(buckets, ([date, value]) => ({ date, ...value }));

  // ── คุณภาพ
  const closed = petitions.length;
  const abnormal = petitions.filter((p) => abnormalFlags[String(p._id)]).length;
  const reworked = petitions.filter((p) => !!p.revisionOf).length;
  const quality = {
    closed,
    abnormal,
    abnormalRate: closed ? abnormal / closed : 0,
    reworked,
    reworkRate: closed ? reworked / closed : 0,
  };

  // ── ภาระงานต่อคน
  const labByName = new Map();
  const qcByName = new Map();
  const push = (map, name, minutes) => {
    if (!name) return;
    if (!map.has(name)) map.set(name, []);
    map.get(name).push(minutes);
  };
  for (const petition of petitions) {
    // Assignment is a Lab-only concept in real operation — an assignedTo on a
    // QC-only petition is stray data. Crediting it would both inflate a Lab
    // analyst's load with QC-only work and double-count the petition, which is
    // already credited to its QC testers below via qcTesterNames.
    if (hasLabTrack(petition)) {
      push(labByName, petition.assignedTo?.name, totalMinutes(petition));
    }
    for (const name of qcTesterNames[String(petition._id)] || []) {
      push(qcByName, name, qcDurationMinutes(petition));
    }
  }
  const toWorkloadRows = (map) => Array.from(map, ([name, samples]) => ({
    name,
    completed: samples.length,
    avgMinutes: round(averageOf(samples)),
  })).sort((a, b) => b.completed - a.completed);

  return {
    turnaround,
    throughput,
    quality,
    workload: { lab: toWorkloadRows(labByName), qc: toWorkloadRows(qcByName) },
  };
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
  buildStatsSection,
  percentile,
  stageDurations,
};
