const { openWorkUnits, bottleneckCounts, buildLiveSection } = require('./execSummary');

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
});
