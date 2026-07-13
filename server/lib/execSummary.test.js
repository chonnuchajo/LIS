const { openWorkUnits, bottleneckCounts, buildLiveSection, buildStatsSection, percentile } = require('./execSummary');

const NOW = Date.parse('2026-07-13T10:00:00.000Z');
const hoursAgo = (h) => new Date(NOW - h * 3600000).toISOString();
const EMPTY_BASELINE = { avgMinutesByParam: {}, paramIdsByCommonName: {} };

// batch ลงท้าย '1' = lab batch (มีรางLab) · ลงท้าย '2' = QC อย่างเดียว
const labItem = { seq: 1, batchNo: 'B001', commonName: 'ยาเขียว' };
const qcItem = { seq: 1, batchNo: 'B002', commonName: 'ยาเขียว' };

describe('openWorkUnits', () => {
  it('marks Lab testing overdue when elapsed passes the summed machine estimate', () => {
    const petition = {
      _id: 'p1', petitionNo: 'P-1', dept: 'fg', status: 'inProgress', items: [labItem],
      qcReceivedAt: hoursAgo(5), qcCompletedAt: hoursAgo(4),
      labReceivedAt: hoursAgo(5),
      assignedTo: { name: 'สมชาย', assignedAt: hoursAgo(5) },
      assignedMachines: [{ estimatedMinutes: 60 }, { estimatedMinutes: 120 }], // baseline = 180 นาที
    };
    const [unit] = openWorkUnits([petition], { now: NOW, qcBaseline: EMPTY_BASELINE })
      .filter((u) => u.track === 'lab');
    expect(unit.stage).toBe('labTesting');
    expect(unit.baselineMin).toBe(180);
    expect(unit.elapsedMin).toBe(300);
    expect(unit.overdueMin).toBe(120);
    expect(unit.state).toBe('overdue');
    expect(unit.assigneeName).toBe('สมชาย');
  });

  it('treats work at exactly the baseline as on time, not overdue', () => {
    const petition = {
      _id: 'p2', petitionNo: 'P-2', dept: 'fg', status: 'inProgress', items: [labItem],
      qcReceivedAt: hoursAgo(3), qcCompletedAt: hoursAgo(2),
      labReceivedAt: hoursAgo(3),
      assignedTo: { name: 'สมชาย', assignedAt: hoursAgo(3) },
      assignedMachines: [{ estimatedMinutes: 180 }],
    };
    const [unit] = openWorkUnits([petition], { now: NOW, qcBaseline: EMPTY_BASELINE })
      .filter((u) => u.track === 'lab');
    expect(unit.state).toBe('ok');
    expect(unit.overdueMin).toBeNull();
  });

  it('marks work at 80% of the baseline as at risk', () => {
    const petition = {
      _id: 'p3', petitionNo: 'P-3', dept: 'fg', status: 'inProgress', items: [labItem],
      qcReceivedAt: hoursAgo(4), qcCompletedAt: hoursAgo(3),
      labReceivedAt: hoursAgo(4), // 240 นาที
      assignedTo: { name: 'สมชาย', assignedAt: hoursAgo(4) },
      assignedMachines: [{ estimatedMinutes: 300 }], // 80% = 240
    };
    const [unit] = openWorkUnits([petition], { now: NOW, qcBaseline: EMPTY_BASELINE })
      .filter((u) => u.track === 'lab');
    expect(unit.state).toBe('atRisk');
  });

  it('reports an unassigned Lab petition older than 24h without calling it overdue', () => {
    const petition = {
      _id: 'p4', petitionNo: 'P-4', dept: 'rm', status: 'pendingReview', items: [labItem],
      qcReceivedAt: hoursAgo(30), qcCompletedAt: hoursAgo(29),
      labReceivedAt: hoursAgo(30),
    };
    const [unit] = openWorkUnits([petition], { now: NOW, qcBaseline: EMPTY_BASELINE })
      .filter((u) => u.track === 'lab');
    expect(unit.stage).toBe('pendingAssign');
    expect(unit.state).toBe('unassigned');
    expect(unit.baselineMin).toBeNull();
    expect(unit.overdueMin).toBeNull();
  });

  it('reports noBaseline for QC testing on a product with no history', () => {
    const petition = {
      _id: 'p5', petitionNo: 'P-5', dept: 'fg', status: 'inProgress', items: [qcItem],
      qcReceivedAt: hoursAgo(2),
    };
    const [unit] = openWorkUnits([petition], { now: NOW, qcBaseline: EMPTY_BASELINE });
    expect(unit.track).toBe('qc');
    expect(unit.stage).toBe('qcTesting');
    expect(unit.state).toBe('noBaseline');
  });

  it('emits a waitingFinal unit once every track the petition has is done', () => {
    const petition = {
      _id: 'p6', petitionNo: 'P-6', dept: 'fg', status: 'success', items: [qcItem],
      qcReceivedAt: hoursAgo(6), qcCompletedAt: hoursAgo(2),
    };
    const units = openWorkUnits([petition], { now: NOW, qcBaseline: EMPTY_BASELINE });
    expect(units).toHaveLength(1);
    expect(units[0].stage).toBe('waitingFinal');
    expect(units[0].elapsedMin).toBe(120);
  });

  it('emits waitingLabApprove while the Lab head has not released the result', () => {
    const petition = {
      _id: 'p7', petitionNo: 'P-7', dept: 'fg', status: 'inProgress', items: [labItem],
      qcReceivedAt: hoursAgo(8), qcCompletedAt: hoursAgo(7),
      labReceivedAt: hoursAgo(8), assignedTo: { name: 'ก', assignedAt: hoursAgo(8) },
      labCompletedAt: hoursAgo(3),
    };
    const stages = openWorkUnits([petition], { now: NOW, qcBaseline: EMPTY_BASELINE }).map((u) => u.stage);
    expect(stages).toEqual(['waitingLabApprove']);
  });

  it('ignores petitions that are already approved or rejected', () => {
    const approved = { _id: 'p8', petitionNo: 'P-8', dept: 'fg', status: 'approved', items: [qcItem], approvedAt: hoursAgo(1) };
    const rejected = { _id: 'p9', petitionNo: 'P-9', dept: 'fg', status: 'rejected', items: [qcItem] };
    expect(openWorkUnits([approved, rejected], { now: NOW, qcBaseline: EMPTY_BASELINE })).toEqual([]);
  });

  // --- extra coverage beyond the brief's own cases ---

  it('emits both a lab unit and a qc unit for a petition open on both tracks at once', () => {
    // Lab batch (B001 → labTrack) whose Lab side is mid-testing (received+assigned,
    // not yet completed) AND whose QC side is also mid-testing (received, not
    // completed). A regression that collapses this to a single unit per petition
    // would silently drop half the open work from the live view.
    const petition = {
      _id: 'p10', petitionNo: 'P-10', dept: 'fg', status: 'inProgress', items: [labItem],
      qcReceivedAt: hoursAgo(3),
      labReceivedAt: hoursAgo(3), assignedTo: { name: 'สมชาย', assignedAt: hoursAgo(3) },
      assignedMachines: [{ estimatedMinutes: 999 }],
    };
    const units = openWorkUnits([petition], { now: NOW, qcBaseline: EMPTY_BASELINE });
    expect(units.map((u) => u.track).sort()).toEqual(['lab', 'qc']);
    expect(units.map((u) => u.stage).sort()).toEqual(['labTesting', 'qcTesting']);
  });

  it('keeps stages with no baseline by nature at state ok, never noBaseline', () => {
    // waitingReceive / waitingLabApprove / waitingFinal have no expected duration by
    // design (queued, waiting on a person) — noBaseline must stay reserved for a
    // *testing* stage whose duration genuinely could not be determined. Mislabeling
    // "waiting for the head's signature" as noBaseline would read as a missing time
    // standard when the truth is the work simply has nobody assigned to a clock yet.
    const waitingReceivePetition = {
      _id: 'p11', petitionNo: 'P-11', dept: 'fg', status: 'sampleSent', items: [qcItem],
      sampleSentAt: hoursAgo(2),
    };
    const waitingLabApprovePetition = {
      _id: 'p12', petitionNo: 'P-12', dept: 'fg', status: 'inProgress', items: [labItem],
      qcReceivedAt: hoursAgo(8), qcCompletedAt: hoursAgo(7),
      labReceivedAt: hoursAgo(8), assignedTo: { name: 'ก', assignedAt: hoursAgo(8) },
      labCompletedAt: hoursAgo(3),
    };
    const waitingFinalPetition = {
      _id: 'p13', petitionNo: 'P-13', dept: 'fg', status: 'success', items: [qcItem],
      qcReceivedAt: hoursAgo(6), qcCompletedAt: hoursAgo(2),
    };
    const units = openWorkUnits(
      [waitingReceivePetition, waitingLabApprovePetition, waitingFinalPetition],
      { now: NOW, qcBaseline: EMPTY_BASELINE },
    );
    const byStage = Object.fromEntries(units.map((u) => [u.stage, u.state]));
    expect(byStage.waitingReceive).toBe('ok');
    expect(byStage.waitingLabApprove).toBe('ok');
    expect(byStage.waitingFinal).toBe('ok');
  });

  // --- Finding 1: a lagging QC receive must not be swallowed by the "shared
  // wait" de-dup guard once Lab has already received the sample ---

  it('emits its own qc/waitingReceive unit once Lab has received but QC has not', () => {
    // Lab and QC receive independently (PATCH /petitions/:id/receive side=lab|qc).
    // Once Lab has received, a missing QC receive is a genuinely different, QC-only
    // wait — not the shared "nobody has received it yet" state — so it must surface.
    const petition = {
      _id: 'p14', petitionNo: 'P-14', dept: 'fg', status: 'inProgress', items: [labItem],
      sampleSentAt: hoursAgo(5),
      labReceivedAt: hoursAgo(5), assignedTo: { name: 'ก', assignedAt: hoursAgo(5) },
      assignedMachines: [{ estimatedMinutes: 999 }],
      // qcReceivedAt intentionally absent
    };
    const units = openWorkUnits([petition], { now: NOW, qcBaseline: EMPTY_BASELINE });
    const qcWait = units.find((u) => u.track === 'qc' && u.stage === 'waitingReceive');
    expect(qcWait).toBeDefined();
    expect(qcWait.state).toBe('ok');
    expect(qcWait.baselineMin).toBeNull();
  });

  it('emits exactly one waitingReceive unit when neither Lab nor QC has received yet', () => {
    // Pins the existing anti-double-count behavior: while both sides are still
    // waiting on the very same event, the shared wait must be reported once, not
    // once per track.
    const petition = {
      _id: 'p15', petitionNo: 'P-15', dept: 'fg', status: 'sampleSent', items: [labItem],
      sampleSentAt: hoursAgo(2),
      // neither labReceivedAt nor qcReceivedAt set
    };
    const units = openWorkUnits([petition], { now: NOW, qcBaseline: EMPTY_BASELINE });
    const waitingReceiveUnits = units.filter((u) => u.stage === 'waitingReceive');
    expect(waitingReceiveUnits).toHaveLength(1);
    expect(waitingReceiveUnits[0].track).toBe('lab');
  });

  it('still emits qc/waitingReceive for a QC-only petition (no Lab track) that has not received', () => {
    const petition = {
      _id: 'p16', petitionNo: 'P-16', dept: 'fg', status: 'sampleSent', items: [qcItem],
      sampleSentAt: hoursAgo(1),
    };
    const units = openWorkUnits([petition], { now: NOW, qcBaseline: EMPTY_BASELINE });
    expect(units).toHaveLength(1);
    expect(units[0].track).toBe('qc');
    expect(units[0].stage).toBe('waitingReceive');
  });
});

describe('bottleneckCounts', () => {
  it('counts open units per stage in workflow order', () => {
    const units = [
      { stage: 'qcTesting' }, { stage: 'qcTesting' }, { stage: 'waitingReceive' },
    ];
    expect(bottleneckCounts(units)).toEqual([
      { stage: 'waitingReceive', label: 'รอรับตัวอย่าง', count: 1 },
      { stage: 'pendingAssign', label: 'รอ assign', count: 0 },
      { stage: 'labTesting', label: 'Lab กำลังทดสอบ', count: 0 },
      { stage: 'qcTesting', label: 'QC กำลังทดสอบ', count: 2 },
      { stage: 'waitingLabApprove', label: 'รอออกผล Lab', count: 0 },
      { stage: 'waitingFinal', label: 'รอออก Final Result', count: 0 },
    ]);
  });
});

describe('buildLiveSection', () => {
  const overdue = {
    _id: 'a', petitionNo: 'P-A', dept: 'fg', status: 'inProgress', items: [labItem], priority: 1,
    qcReceivedAt: hoursAgo(9), qcCompletedAt: hoursAgo(8),
    labReceivedAt: hoursAgo(9), assignedTo: { name: 'ก', assignedAt: hoursAgo(9) },
    assignedMachines: [{ estimatedMinutes: 60 }],
  };
  const waitingFinal = {
    _id: 'b', petitionNo: 'P-B', dept: 'fg', status: 'success', items: [qcItem],
    qcReceivedAt: hoursAgo(6), qcCompletedAt: hoursAgo(1),
  };

  it('summarizes the counts a head needs at a glance', () => {
    const live = buildLiveSection([overdue, waitingFinal], {
      now: NOW, qcBaseline: EMPTY_BASELINE, abnormalFlags: { a: true, b: false },
    });
    expect(live.counts).toEqual({
      urgent: 1, overdue: 1, atRisk: 0, waitingHead: 1, abnormal: 1, unassigned: 0,
    });
  });

  it('puts the most overdue work at the top of the action queue', () => {
    const live = buildLiveSection([waitingFinal, overdue], {
      now: NOW, qcBaseline: EMPTY_BASELINE, abnormalFlags: {},
    });
    expect(live.actionQueue.map((u) => u.petitionNo)).toEqual(['P-A', 'P-B']);
  });

  it('breaks a same-state tie by putting the more-overdue unit first', () => {
    // Both units land in the 'overdue' state bucket (same rank), so the sort must
    // fall through to the overdueMin-descending tie-break — untested until now
    // because the only prior overdue-vs-overdue comparison never reached this branch.
    const lessOverdue = {
      _id: 'c', petitionNo: 'P-C', dept: 'fg', status: 'inProgress', items: [labItem],
      qcReceivedAt: hoursAgo(9), qcCompletedAt: hoursAgo(8),
      labReceivedAt: hoursAgo(5), assignedTo: { name: 'ก', assignedAt: hoursAgo(5) },
      assignedMachines: [{ estimatedMinutes: 60 }], // elapsed 300, overdueMin 240
    };
    const moreOverdue = {
      _id: 'd', petitionNo: 'P-D', dept: 'fg', status: 'inProgress', items: [labItem],
      qcReceivedAt: hoursAgo(9), qcCompletedAt: hoursAgo(8),
      labReceivedAt: hoursAgo(10), assignedTo: { name: 'ก', assignedAt: hoursAgo(10) },
      assignedMachines: [{ estimatedMinutes: 60 }], // elapsed 600, overdueMin 540
    };
    const live = buildLiveSection([lessOverdue, moreOverdue], {
      now: NOW, qcBaseline: EMPTY_BASELINE, abnormalFlags: {},
    });
    const overdueOnly = live.actionQueue.filter((u) => u.state === 'overdue');
    expect(overdueOnly.map((u) => u.petitionNo)).toEqual(['P-D', 'P-C']);
  });
});

describe('percentile', () => {
  it('takes the nearest-rank value so p90 of ten samples is the ninth', () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)).toBe(9);
  });

  it('returns null for an empty sample set', () => {
    expect(percentile([], 0.9)).toBeNull();
  });
});

describe('buildStatsSection', () => {
  const closed = [
    {
      _id: 'd1', petitionNo: 'P-D1', dept: 'fg', status: 'approved',
      items: [{ seq: 1, batchNo: 'B002', commonName: 'ยาเขียว' }],
      createdAt: '2026-07-11T00:00:00.000Z',
      sampleSentAt: '2026-07-11T00:00:00.000Z',
      qcReceivedAt: '2026-07-11T01:00:00.000Z',   // รอรับ 60 นาที
      qcCompletedAt: '2026-07-11T03:00:00.000Z',  // ทดสอบ 120 นาที
      approvedAt: '2026-07-11T04:00:00.000Z',     // รอ final 60 นาที
      assignedTo: { name: 'สมชาย', assignedAt: '2026-07-11T01:00:00.000Z' },
    },
    {
      _id: 'd2', petitionNo: 'P-D2', dept: 'fg', status: 'approved',
      items: [{ seq: 1, batchNo: 'B002', commonName: 'ยาเขียว' }],
      createdAt: '2026-07-12T00:00:00.000Z',
      sampleSentAt: '2026-07-12T00:00:00.000Z',
      qcReceivedAt: '2026-07-12T03:00:00.000Z',   // รอรับ 180 นาที
      qcCompletedAt: '2026-07-12T04:00:00.000Z',  // ทดสอบ 60 นาที
      approvedAt: '2026-07-12T05:00:00.000Z',
      revisionOf: 'old-one',                      // ใบนี้เป็นงานทำใหม่
    },
  ];

  const opts = {
    now: Date.parse('2026-07-13T10:00:00.000Z'),
    days: 7,
    abnormalFlags: { d1: true, d2: false },
    qcTesterNames: { d1: ['สมหญิง'], d2: ['สมหญิง'] },
  };

  it('averages each stage across the closed petitions', () => {
    const { turnaround } = buildStatsSection(closed, opts);
    const receive = turnaround.find((t) => t.stage === 'waitingReceive');
    expect(receive.avgMin).toBe(120); // (60 + 180) / 2
    expect(receive.count).toBe(2);
    const qcTesting = turnaround.find((t) => t.stage === 'qcTesting');
    expect(qcTesting.avgMin).toBe(90); // (120 + 60) / 2
  });

  it('reports one throughput row per day in the window, newest last', () => {
    const { throughput } = buildStatsSection(closed, opts);
    expect(throughput).toHaveLength(7);
    expect(throughput.at(-1).date).toBe('2026-07-13');
    expect(throughput.find((d) => d.date === '2026-07-11')).toEqual({ date: '2026-07-11', created: 1, completed: 1 });
  });

  it('derives abnormal and rework rates from the closed set', () => {
    const { quality } = buildStatsSection(closed, opts);
    expect(quality).toEqual({ closed: 2, abnormal: 1, abnormalRate: 0.5, reworked: 1, reworkRate: 0.5 });
  });

  it('splits workload between the Lab assignee and the QC testers', () => {
    const { workload } = buildStatsSection(closed, opts);
    // d1 is batch B002 (QC-only, no Lab track) — its assignedTo is stray data and
    // must NOT be credited to workload.lab, even though it is credited to workload.qc.
    expect(workload.lab).toEqual([]);
    expect(workload.qc).toEqual([{ name: 'สมหญิง', completed: 2, avgMinutes: 90 }]);
  });

  it('credits a Lab-batch petition with an assignee to workload.lab', () => {
    const labPetition = {
      _id: 'w1', petitionNo: 'P-W1', dept: 'fg', status: 'approved',
      items: [{ seq: 1, batchNo: 'B001', commonName: 'ยาแดง' }], // ends in '1' → Lab track
      createdAt: '2026-07-09T00:00:00.000Z',
      approvedAt: '2026-07-09T05:00:00.000Z', // totalMinutes = 5h = 300 min
      assignedTo: { name: 'สมศักดิ์', assignedAt: '2026-07-09T01:00:00.000Z' },
    };
    const { workload } = buildStatsSection([labPetition], opts);
    expect(workload.lab).toEqual([{ name: 'สมศักดิ์', completed: 1, avgMinutes: 300 }]);
  });

  it('does not credit a QC-only petition with a stray assignedTo to workload.lab', () => {
    // Product-owner decision: assignment is a Lab-only concept in real operation, so
    // an assignedTo on a QC-only petition is stray data — counting it would both
    // inflate a Lab analyst's load with QC-only work AND double-count the petition,
    // which is already credited to its QC testers via qcTesterNames.
    const qcOnlyWithAssignee = {
      _id: 'w2', petitionNo: 'P-W2', dept: 'fg', status: 'approved',
      items: [{ seq: 1, batchNo: 'B002', commonName: 'ยาเขียว' }], // QC-only, no Lab track
      createdAt: '2026-07-10T00:00:00.000Z',
      approvedAt: '2026-07-10T02:00:00.000Z',
      assignedTo: { name: 'สมชาย', assignedAt: '2026-07-10T00:30:00.000Z' }, // stray data
    };
    const { workload } = buildStatsSection([qcOnlyWithAssignee], opts);
    expect(workload.lab).toEqual([]);
  });

  it('returns empty structures when nothing closed in the window', () => {
    const { turnaround, quality, workload } = buildStatsSection([], opts);
    expect(turnaround.every((t) => t.count === 0 && t.avgMin === null)).toBe(true);
    expect(quality).toEqual({ closed: 0, abnormal: 0, abnormalRate: 0, reworked: 0, reworkRate: 0 });
    expect(workload).toEqual({ lab: [], qc: [] });
  });

  // --- extra coverage beyond the brief's own cases ---

  it('excludes a petition missing a stage timestamp from that stage average instead of poisoning it with NaN', () => {
    const withReceipt = {
      _id: 'e1', petitionNo: 'P-E1', dept: 'fg', status: 'approved',
      items: [{ seq: 1, batchNo: 'B002', commonName: 'ยาเขียว' }],
      createdAt: '2026-07-08T00:00:00.000Z',
      sampleSentAt: '2026-07-08T00:00:00.000Z',
      qcReceivedAt: '2026-07-08T01:40:00.000Z',   // waitingReceive = 100 min
      qcCompletedAt: '2026-07-08T02:40:00.000Z',  // qcTesting = 60 min
      approvedAt: '2026-07-08T03:00:00.000Z',
    };
    const missingReceipt = {
      _id: 'e2', petitionNo: 'P-E2', dept: 'fg', status: 'approved',
      items: [{ seq: 1, batchNo: 'B002', commonName: 'ยาเขียว' }],
      createdAt: '2026-07-08T00:00:00.000Z',
      sampleSentAt: '2026-07-08T00:00:00.000Z',
      // qcReceivedAt intentionally missing — never received according to the data
    };
    const { turnaround } = buildStatsSection([withReceipt, missingReceipt], opts);
    const receive = turnaround.find((t) => t.stage === 'waitingReceive');
    expect(receive.avgMin).toBe(100);
    expect(Number.isNaN(receive.avgMin)).toBe(false);
    expect(receive.count).toBe(1);
  });

  it('never lets an out-of-order timestamp pair contribute a negative duration to the average', () => {
    const normal = {
      _id: 'e1', petitionNo: 'P-E1', dept: 'fg', status: 'approved',
      items: [{ seq: 1, batchNo: 'B002', commonName: 'ยาเขียว' }],
      createdAt: '2026-07-08T00:00:00.000Z',
      sampleSentAt: '2026-07-08T00:00:00.000Z',
      qcReceivedAt: '2026-07-08T01:40:00.000Z', // waitingReceive = 100 min
    };
    const outOfOrder = {
      _id: 'e3', petitionNo: 'P-E3', dept: 'fg', status: 'approved',
      items: [{ seq: 1, batchNo: 'B002', commonName: 'ยาเขียว' }],
      createdAt: '2026-07-09T00:00:00.000Z',
      sampleSentAt: '2026-07-09T05:00:00.000Z',
      qcReceivedAt: '2026-07-09T04:00:00.000Z', // recorded BEFORE it was sent — a data glitch
    };
    const { turnaround } = buildStatsSection([normal, outOfOrder], opts);
    const receive = turnaround.find((t) => t.stage === 'waitingReceive');
    // If the glitch leaked through as -60, the average would be 20 (or 50 if clamped
    // to 0) instead of 100, and count would be 2 instead of 1.
    expect(receive.avgMin).toBe(100);
    expect(receive.count).toBe(1);
  });

  it('keeps a Lab-only stage null for a QC-only petition instead of counting it as zero', () => {
    const labPetition = {
      _id: 'e4', petitionNo: 'P-E4', dept: 'fg', status: 'approved',
      items: [{ seq: 1, batchNo: 'B001', commonName: 'ยาแดง' }], // ends in '1' → Lab track
      createdAt: '2026-07-05T00:00:00.000Z',
      sampleSentAt: '2026-07-05T00:00:00.000Z',
      labReceivedAt: '2026-07-05T01:00:00.000Z',
      assignedTo: { name: 'สมศักดิ์', assignedAt: '2026-07-05T02:00:00.000Z' }, // pendingAssign = 60
      labCompletedAt: '2026-07-05T04:00:00.000Z', // labTesting = 180
      labApprovedAt: '2026-07-05T05:00:00.000Z',  // waitingLabApprove = 60
      approvedAt: '2026-07-05T06:00:00.000Z',
    };
    const qcOnlyPetition = {
      _id: 'e5', petitionNo: 'P-E5', dept: 'fg', status: 'approved',
      items: [{ seq: 1, batchNo: 'B002', commonName: 'ยาเขียว' }], // QC-only, no Lab track
      createdAt: '2026-07-06T00:00:00.000Z',
      sampleSentAt: '2026-07-06T00:00:00.000Z',
      qcReceivedAt: '2026-07-06T00:30:00.000Z',
      qcCompletedAt: '2026-07-06T01:30:00.000Z',
      approvedAt: '2026-07-06T02:00:00.000Z',
    };
    const { turnaround } = buildStatsSection([labPetition, qcOnlyPetition], opts);
    const byStage = Object.fromEntries(turnaround.map((t) => [t.stage, t]));
    // If the QC-only petition were counted as a 0-minute Lab stage instead of being
    // excluded, these averages would be halved (30/90/30) and counts would be 2.
    expect(byStage.pendingAssign).toMatchObject({ avgMin: 60, count: 1 });
    expect(byStage.labTesting).toMatchObject({ avgMin: 180, count: 1 });
    expect(byStage.waitingLabApprove).toMatchObject({ avgMin: 60, count: 1 });
  });
});
