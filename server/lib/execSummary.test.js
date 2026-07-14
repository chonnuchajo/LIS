const {
  openWorkUnits, bottleneckCounts, buildLiveSection, buildStatsSection, percentile, stageDurations,
} = require('./execSummary');

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

  // --- Real-data bug: stage must come from the FURTHEST progress reached, not
  // the first missing timestamp. Real petitions have gaps (a receive scan that
  // was never recorded) even after later milestones completed — see P-2606-0010.

  it('derives waitingFinal (not waitingReceive) for a petition with no receive timestamps at all but Lab+QC both finished', () => {
    // Real shape: P-2606-0010, status 'success'. sampleSentAt is set but neither
    // labReceivedAt nor qcReceivedAt was ever recorded — yet labCompletedAt,
    // labApprovedAt and qcCompletedAt prove the work is long done. The petition
    // is legitimately only waiting on the head's Final Result (approvedAt null).
    // The old "first missing timestamp" walk read the null labReceivedAt as
    // "still waiting to be received" and emitted a phantom waitingReceive unit
    // alongside the correct waitingFinal one.
    const petition = {
      _id: 'real1', petitionNo: 'P-2606-0010', dept: 'fg', status: 'success', items: [labItem],
      sampleSentAt: hoursAgo(50),
      // labReceivedAt / qcReceivedAt intentionally absent — never scanned
      labCompletedAt: hoursAgo(30),
      labApprovedAt: hoursAgo(29),
      qcCompletedAt: hoursAgo(20),
      // approvedAt intentionally absent — still open, waiting on Final Result
    };
    const units = openWorkUnits([petition], { now: NOW, qcBaseline: EMPTY_BASELINE });
    expect(units).toHaveLength(1);
    expect(units[0].stage).toBe('waitingFinal');
    expect(units.some((u) => u.stage === 'waitingReceive')).toBe(false);

    const counts = bottleneckCounts(units);
    expect(counts.find((c) => c.stage === 'waitingReceive').count).toBe(0);
  });

  it('reads a Lab track missing labReceivedAt but with labCompletedAt set as waitingLabApprove, not waitingReceive', () => {
    const petition = {
      _id: 'real2', petitionNo: 'P-REAL2', dept: 'fg', status: 'inProgress', items: [labItem],
      sampleSentAt: hoursAgo(40),
      // labReceivedAt intentionally absent
      labCompletedAt: hoursAgo(10),
      // labApprovedAt absent — still waiting on the Lab head to release the result
    };
    const [labUnit] = openWorkUnits([petition], { now: NOW, qcBaseline: EMPTY_BASELINE })
      .filter((u) => u.track === 'lab');
    expect(labUnit.stage).toBe('waitingLabApprove');
  });

  // --- CRITICAL regression: the QC "shared wait" de-dup guard was left keyed to
  // the OLD "first missing timestamp" premise (labTrack && !labReceived) after the
  // Lab track was switched to a furthest-progress reverse walk. Once Lab's stage
  // can be waitingLabApprove/labTesting/nothing-at-all while labReceivedAt is still
  // null, that guard's premise ("Lab must have emitted waitingReceive") is false,
  // and it wrongly swallows QC's own, genuinely distinct waitingReceive unit — in
  // the worst case (Lab fully approved) the petition emits NO unit at all and
  // disappears from the entire live dashboard.

  it('emits a qc/waitingReceive unit (petition not absent) when Lab is already approved but QC has not received', () => {
    // Lab track is fully done (labApprovedAt set) — its branch emits NOTHING.
    // QC has not received the sample at all (no qcReceivedAt, no qcCompletedAt).
    // Under the old guard this petition emitted ZERO work units and vanished.
    const petition = {
      _id: 'crit1', petitionNo: 'P-CRIT1', dept: 'fg', status: 'inProgress', items: [labItem],
      sampleSentAt: hoursAgo(10),
      // labReceivedAt / qcReceivedAt intentionally absent — never scanned
      labApprovedAt: hoursAgo(1),
      // qcCompletedAt intentionally absent
    };
    const units = openWorkUnits([petition], { now: NOW, qcBaseline: EMPTY_BASELINE });
    expect(units).toHaveLength(1);
    expect(units[0].track).toBe('qc');
    expect(units[0].stage).toBe('waitingReceive');
  });

  it('emits BOTH lab/labTesting and qc/waitingReceive when Lab is assigned and mid-testing but QC has not received', () => {
    // Lab is mid-testing (assignedAt set, labReceivedAt still null — a receive scan
    // that was never recorded) so its branch emits labTesting, NOT waitingReceive.
    // QC's own receive lag must therefore surface as its own unit, not be
    // suppressed as if it were the same shared wait Lab already reported.
    const petition = {
      _id: 'crit2', petitionNo: 'P-CRIT2', dept: 'fg', status: 'inProgress', items: [labItem],
      sampleSentAt: hoursAgo(6),
      assignedTo: { name: 'ก', assignedAt: hoursAgo(6) },
      assignedMachines: [{ estimatedMinutes: 999 }],
      // labReceivedAt / qcReceivedAt intentionally absent
    };
    const units = openWorkUnits([petition], { now: NOW, qcBaseline: EMPTY_BASELINE });
    expect(units.map((u) => `${u.track}/${u.stage}`).sort()).toEqual(['lab/labTesting', 'qc/waitingReceive']);
  });

  it('emits BOTH lab/waitingLabApprove and qc/waitingReceive when Lab has finished testing but QC has not received', () => {
    const petition = {
      _id: 'crit3', petitionNo: 'P-CRIT3', dept: 'fg', status: 'inProgress', items: [labItem],
      sampleSentAt: hoursAgo(20),
      labCompletedAt: hoursAgo(2),
      // labReceivedAt / qcReceivedAt / labApprovedAt intentionally absent
    };
    const units = openWorkUnits([petition], { now: NOW, qcBaseline: EMPTY_BASELINE });
    expect(units.map((u) => `${u.track}/${u.stage}`).sort()).toEqual(['lab/waitingLabApprove', 'qc/waitingReceive']);
  });

  // --- Finding 2: the live waitingFinal Math.max must be gated on the petition
  // actually having a Lab track, mirroring stageDurations' finalResultStart — a
  // QC-only petition carrying a stray, later labApprovedAt must still be measured
  // from qcCompletedAt alone, or the live tile disagrees with the stats bar.

  it('measures the live waitingFinal unit from qcCompletedAt alone for a QC-only petition, even with a stray later labApprovedAt', () => {
    const petition = {
      _id: 'crit4', petitionNo: 'P-CRIT4', dept: 'fg', status: 'success', items: [qcItem],
      qcReceivedAt: hoursAgo(6), qcCompletedAt: hoursAgo(2),
      labApprovedAt: hoursAgo(1), // stray — this petition has no Lab track at all
    };
    const units = openWorkUnits([petition], { now: NOW, qcBaseline: EMPTY_BASELINE });
    expect(units).toHaveLength(1);
    expect(units[0].stage).toBe('waitingFinal');
    expect(units[0].elapsedMin).toBe(120); // from qcCompletedAt (2h ago), NOT labApprovedAt (1h ago)
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
      total: 2, urgent: 1, overdue: 1, atRisk: 0, waitingHead: 1, abnormal: 1, unassigned: 0,
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

  // --- Task 7 review finding: alert-tile ids must come from the same sources as
  // the counts, NOT from the (smaller) action queue. `counts.urgent` and
  // `counts.abnormal` in particular cover ALL open petitions with that flag —
  // including ones still comfortably inside their time baseline, which the
  // action queue deliberately excludes so it isn't noisy. If `ids` were ever
  // derived from `actionQueue` again, these petitions would silently disappear
  // from `ids.urgent` / `ids.abnormal` while `counts` stayed unchanged.

  const atRiskPetition = {
    _id: 'ar1', petitionNo: 'P-AR1', dept: 'fg', status: 'inProgress', items: [labItem],
    qcReceivedAt: hoursAgo(9), qcCompletedAt: hoursAgo(8),
    labReceivedAt: hoursAgo(4.5), assignedTo: { name: 'ก', assignedAt: hoursAgo(4.5) },
    assignedMachines: [{ estimatedMinutes: 300 }], // elapsed 270 = 90% of baseline → atRisk
  };
  const unassignedPetition = {
    _id: 'un1', petitionNo: 'P-UN1', dept: 'fg', status: 'pendingReview', items: [labItem],
    qcReceivedAt: hoursAgo(31), qcCompletedAt: hoursAgo(30),
    labReceivedAt: hoursAgo(30), // >24h with nobody assigned
  };
  // Urgent but mid-testing well inside its baseline (state 'ok') — the action
  // queue drops 'ok' testing-stage units on purpose, so this petition never
  // appears in actionQueue even though counts.urgent covers it.
  const comfortableUrgent = {
    _id: 'u1', petitionNo: 'P-U1', dept: 'fg', status: 'inProgress', items: [labItem], priority: 1,
    qcReceivedAt: hoursAgo(9), qcCompletedAt: hoursAgo(8),
    labReceivedAt: hoursAgo(1), assignedTo: { name: 'ข', assignedAt: hoursAgo(1) },
    assignedMachines: [{ estimatedMinutes: 999 }], // elapsed 60, baseline 999 → ok
  };
  // Abnormal-flagged but likewise mid-testing well inside its baseline — the
  // abnormalFlags map has no representation in actionQueue at all.
  const comfortableAbnormal = {
    _id: 'ab1', petitionNo: 'P-AB1', dept: 'fg', status: 'inProgress', items: [labItem],
    qcReceivedAt: hoursAgo(9), qcCompletedAt: hoursAgo(8),
    labReceivedAt: hoursAgo(1), assignedTo: { name: 'ค', assignedAt: hoursAgo(1) },
    assignedMachines: [{ estimatedMinutes: 999 }], // elapsed 60, baseline 999 → ok
  };

  it('keeps ids.urgent and ids.abnormal covering petitions the action queue excludes', () => {
    const petitions = [
      overdue, waitingFinal, atRiskPetition, unassignedPetition, comfortableUrgent, comfortableAbnormal,
    ];
    const live = buildLiveSection(petitions, {
      now: NOW, qcBaseline: EMPTY_BASELINE, abnormalFlags: { ab1: true },
    });

    // Both comfortable petitions must be absent from the action queue — that's
    // the whole premise of this regression: the queue is not a valid source.
    const queueIds = new Set(live.actionQueue.map((u) => u.petitionId));
    expect(queueIds.has('u1')).toBe(false);
    expect(queueIds.has('ab1')).toBe(false);

    // Yet the alert-tile ids must still carry them.
    expect(live.ids.urgent).toEqual(expect.arrayContaining(['u1']));
    expect(live.ids.abnormal).toEqual(expect.arrayContaining(['ab1']));
  });

  it('never lets a count and its id list disagree in length, for every alert-tile key', () => {
    const petitions = [
      overdue, waitingFinal, atRiskPetition, unassignedPetition, comfortableUrgent, comfortableAbnormal,
    ];
    const live = buildLiveSection(petitions, {
      now: NOW, qcBaseline: EMPTY_BASELINE, abnormalFlags: { ab1: true },
    });

    expect(live.counts).toEqual({
      total: 6, urgent: 2, overdue: 1, atRisk: 1, unassigned: 1, waitingHead: 1, abnormal: 1,
    });
    expect(live.ids).toEqual({
      total: ['a', 'b', 'ar1', 'un1', 'u1', 'ab1'],
      urgent: ['a', 'u1'],
      overdue: ['a'],
      atRisk: ['ar1'],
      unassigned: ['un1'],
      waitingHead: ['b'],
      abnormal: ['ab1'],
    });

    for (const key of Object.keys(live.counts)) {
      expect(live.ids[key]).toHaveLength(live.counts[key]);
    }
  });

  it('counts a petition overdue on both tracks once, matching the single id the tile links to', () => {
    // A petition open on both Lab and QC tracks, both independently overdue, still
    // produces two work units — but counts.overdue must be PETITION-level (1), not
    // a work-unit count (2), because the tile's number and the ids it drill-downs
    // into must always agree: a head who sees "2" but only gets 1 highlighted card
    // back is looking at a lie. bottleneckCounts (a per-stage view) is the one place
    // that legitimately still counts work units — untouched here.
    const qcBaselineWithData = {
      avgMinutesByParam: { p1: 30 },
      paramIdsByCommonName: { [labItem.commonName]: ['p1'] },
    };
    const bothTracksOverdue = {
      _id: 'both1', petitionNo: 'P-BOTH1', dept: 'fg', status: 'inProgress', items: [labItem],
      labReceivedAt: hoursAgo(9), assignedTo: { name: 'ก', assignedAt: hoursAgo(9) },
      assignedMachines: [{ estimatedMinutes: 60 }], // lab: elapsed 540, baseline 60 → overdue
      qcReceivedAt: hoursAgo(20), // qc: elapsed 1200, baseline 30 (via qcBaselineWithData) → overdue
    };
    const units = openWorkUnits([bothTracksOverdue], { now: NOW, qcBaseline: qcBaselineWithData });
    expect(units.filter((u) => u.state === 'overdue').map((u) => u.track).sort()).toEqual(['lab', 'qc']);

    const live = buildLiveSection([bothTracksOverdue], {
      now: NOW, qcBaseline: qcBaselineWithData, abnormalFlags: {},
    });
    expect(live.counts.overdue).toBe(1);
    expect(live.ids.overdue).toEqual(['both1']);

    // The invariant this whole fix exists for: every tile's count equals the
    // length of the id list it links to, for every key, with no exceptions.
    for (const key of Object.keys(live.counts)) {
      expect(live.ids[key]).toHaveLength(live.counts[key]);
    }
  });

  // --- windowStart: the dashboard's day-range picker scopes the alert tiles and the
  // bottleneck bars to petitions SUBMITTED inside the window, while the action queue
  // deliberately stays all-time — an old petition still stuck is exactly the work a
  // head must not lose sight of just because they narrowed the range to a day.
  describe('windowStart', () => {
    const daysAgo = (d) => new Date(NOW - d * 86400000).toISOString();
    const fresh = {
      _id: 'f1', petitionNo: 'P-F1', dept: 'fg', status: 'inProgress', items: [labItem], priority: 1,
      createdAt: daysAgo(2),
      qcReceivedAt: hoursAgo(9), qcCompletedAt: hoursAgo(8),
      labReceivedAt: hoursAgo(9), assignedTo: { name: 'ก', assignedAt: hoursAgo(9) },
      assignedMachines: [{ estimatedMinutes: 60 }], // overdue
    };
    const stale = {
      _id: 's1', petitionNo: 'P-S1', dept: 'fg', status: 'inProgress', items: [labItem],
      createdAt: daysAgo(40),
      qcReceivedAt: hoursAgo(50), qcCompletedAt: hoursAgo(49),
      labReceivedAt: hoursAgo(50), assignedTo: { name: 'ข', assignedAt: hoursAgo(50) },
      assignedMachines: [{ estimatedMinutes: 60 }], // overdue too, but submitted long ago
    };
    const windowStart = NOW - 7 * 86400000;

    it('counts only petitions submitted inside the window in the alert tiles', () => {
      const live = buildLiveSection([fresh, stale], {
        now: NOW, qcBaseline: EMPTY_BASELINE, abnormalFlags: {}, windowStart,
      });
      expect(live.counts.total).toBe(1);
      expect(live.counts.overdue).toBe(1);
      expect(live.ids.total).toEqual(['f1']);
      expect(live.ids.overdue).toEqual(['f1']);
    });

    it('counts only petitions submitted inside the window in the bottleneck bars', () => {
      const live = buildLiveSection([fresh, stale], {
        now: NOW, qcBaseline: EMPTY_BASELINE, abnormalFlags: {}, windowStart,
      });
      const labTesting = live.bottleneck.find((b) => b.stage === 'labTesting');
      expect(labTesting.count).toBe(1);
    });

    it('keeps an older still-open petition in the action queue regardless of the window', () => {
      const live = buildLiveSection([fresh, stale], {
        now: NOW, qcBaseline: EMPTY_BASELINE, abnormalFlags: {}, windowStart,
      });
      expect(live.actionQueue.map((u) => u.petitionNo).sort()).toEqual(['P-F1', 'P-S1']);
    });

    it('scopes by the day the sample was sent, so an old form sent recently still counts', () => {
      // "ยื่นในช่วง" means the sample reached the lab in the window — same clock the
      // inflow line uses. A form drafted 40 days ago but delivered yesterday is new
      // work, and must show up in the tiles for a 7-day range.
      const oldFormSentYesterday = {
        ...stale, _id: 'os1', petitionNo: 'P-OS1', createdAt: daysAgo(40), sampleSentAt: daysAgo(1),
      };
      const live = buildLiveSection([oldFormSentYesterday], {
        now: NOW, qcBaseline: EMPTY_BASELINE, abnormalFlags: {}, windowStart,
      });
      expect(live.ids.total).toEqual(['os1']);
    });

    it('keeps a petition with no createdAt visible rather than hiding it from the tiles', () => {
      // Missing createdAt is a data gap, not evidence the petition is out of range —
      // dropping it would make open work silently vanish from the dashboard.
      const undated = { ...stale, _id: 'u0', petitionNo: 'P-U0', createdAt: undefined };
      const live = buildLiveSection([undated], {
        now: NOW, qcBaseline: EMPTY_BASELINE, abnormalFlags: {}, windowStart,
      });
      expect(live.ids.total).toEqual(['u0']);
    });

    it('falls back to the all-time view when no window is given', () => {
      const live = buildLiveSection([fresh, stale], {
        now: NOW, qcBaseline: EMPTY_BASELINE, abnormalFlags: {},
      });
      expect(live.counts.total).toBe(2);
    });
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

describe('stageDurations waitingFinal', () => {
  // Finding 3: Lab and QC tracks are independent. A lab-track petition's QC side
  // routinely finishes AFTER the Lab head has already signed off. The Final-Result
  // wait must start at the LATER of the two — same rule openWorkUnits already uses
  // for the live view — or the stats bar silently absorbs the leftover QC testing
  // time into what should be a short "waiting on the head" number.

  it('measures waitingFinal from qcCompletedAt (not labApprovedAt) when QC finishes after the Lab head signs', () => {
    const petition = {
      _id: 'wf1', petitionNo: 'P-WF1', dept: 'fg', status: 'approved', items: [labItem],
      labApprovedAt: '2026-07-11T01:00:00.000Z', // Lab head signs at 01:00
      qcCompletedAt: '2026-07-11T03:00:00.000Z', // QC finishes later, at 03:00
      approvedAt: '2026-07-11T04:00:00.000Z',    // Final Result issued at 04:00
    };
    const { waitingFinal } = stageDurations(petition);
    // From qcCompletedAt (03:00) → approvedAt (04:00) = 60 min, NOT from
    // labApprovedAt (01:00) → approvedAt (04:00) = 180 min.
    expect(waitingFinal).toBe(60);
  });

  it('still measures waitingFinal from labApprovedAt when the Lab head signs after QC finished', () => {
    const petition = {
      _id: 'wf2', petitionNo: 'P-WF2', dept: 'fg', status: 'approved', items: [labItem],
      qcCompletedAt: '2026-07-11T01:00:00.000Z', // QC finishes first
      labApprovedAt: '2026-07-11T03:00:00.000Z', // Lab head signs later
      approvedAt: '2026-07-11T04:00:00.000Z',
    };
    const { waitingFinal } = stageDurations(petition);
    expect(waitingFinal).toBe(60); // 03:00 → 04:00
  });

  it('measures waitingFinal from qcCompletedAt alone for a QC-only petition (unchanged behavior)', () => {
    const petition = {
      _id: 'wf3', petitionNo: 'P-WF3', dept: 'fg', status: 'approved', items: [qcItem],
      qcCompletedAt: '2026-07-11T03:00:00.000Z',
      approvedAt: '2026-07-11T04:00:00.000Z',
    };
    const { waitingFinal } = stageDurations(petition);
    expect(waitingFinal).toBe(60);
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
    const { turnaround } = buildStatsSection(closed, closed, opts);
    const receive = turnaround.find((t) => t.stage === 'waitingReceive');
    expect(receive.avgMin).toBe(120); // (60 + 180) / 2
    expect(receive.count).toBe(2);
    const qcTesting = turnaround.find((t) => t.stage === 'qcTesting');
    expect(qcTesting.avgMin).toBe(90); // (120 + 60) / 2
  });

  it('reports one throughput row per day in the window, newest last', () => {
    const { throughput } = buildStatsSection(closed, closed, opts);
    expect(throughput).toHaveLength(7);
    expect(throughput.at(-1).date).toBe('2026-07-13');
    expect(throughput.find((d) => d.date === '2026-07-11')).toEqual({ date: '2026-07-11', created: 1, completed: 1 });
  });

  // --- Finding 1: "created" must count petitions created in the window regardless
  // of whether they are closed yet, NOT be filled from the same closed-only array
  // that feeds "completed". Otherwise created <= completed always, and an open
  // petition never shows up on the day it actually arrived.

  it('counts a petition created today but not yet approved in today\'s created bucket, and in no completed bucket', () => {
    const openToday = {
      _id: 'open1', petitionNo: 'P-OPEN1', dept: 'fg', status: 'inProgress',
      items: [{ seq: 1, batchNo: 'B002', commonName: 'ยาเขียว' }],
      createdAt: '2026-07-13T02:00:00.000Z',
      sampleSentAt: '2026-07-13T02:00:00.000Z',
      // approvedAt intentionally absent — still open
    };
    const { throughput } = buildStatsSection([], [openToday], opts);
    const today = throughput.find((d) => d.date === '2026-07-13');
    expect(today).toEqual({ date: '2026-07-13', created: 1, completed: 0 });
    expect(throughput.every((d) => d.completed === 0)).toBe(true);
  });

  it('lets inflow exceed outflow when more petitions arrive than close in the window', () => {
    // Three petitions created inside the window; only one of them has also closed.
    // With created wrongly sourced from the closed array (the bug), Σcreated could
    // never exceed Σcompleted — this pins the case that used to be impossible.
    const closedToday = {
      _id: 'cw1', petitionNo: 'P-CW1', dept: 'fg', status: 'approved',
      items: [{ seq: 1, batchNo: 'B002', commonName: 'ยาเขียว' }],
      createdAt: '2026-07-13T01:00:00.000Z',
      sampleSentAt: '2026-07-13T01:00:00.000Z',
      approvedAt: '2026-07-13T05:00:00.000Z',
    };
    const openA = {
      _id: 'ow1', petitionNo: 'P-OW1', dept: 'fg', status: 'inProgress',
      items: [{ seq: 1, batchNo: 'B002', commonName: 'ยาเขียว' }],
      createdAt: '2026-07-13T02:00:00.000Z',
      sampleSentAt: '2026-07-13T02:00:00.000Z',
    };
    const openB = {
      _id: 'ow2', petitionNo: 'P-OW2', dept: 'fg', status: 'sampleSent',
      items: [{ seq: 1, batchNo: 'B002', commonName: 'ยาเขียว' }],
      createdAt: '2026-07-13T03:00:00.000Z',
      sampleSentAt: '2026-07-13T03:00:00.000Z',
    };
    const { throughput } = buildStatsSection([closedToday], [closedToday, openA, openB], opts);
    const totalCreated = throughput.reduce((sum, d) => sum + d.created, 0);
    const totalCompleted = throughput.reduce((sum, d) => sum + d.completed, 0);
    expect(totalCreated).toBe(3);
    expect(totalCompleted).toBe(1);
    expect(totalCreated).toBeGreaterThan(totalCompleted);
  });

  // --- "คำขอใหม่" = งานที่เข้ามาถึงแล็บ, ไม่ใช่ใบที่เพิ่งถูกร่างไว้ในระบบ · จุดเริ่มคือ
  // sampleSentAt (ตัวอย่างถูกนำส่ง) ไม่ใช่ createdAt — ใบที่ยื่นวันนี้แต่ส่งตัวอย่าง
  // อีกวัน ต้องไปโผล่ในวันที่ส่งตัวอย่าง

  it('counts a petition on the day its sample was sent, not the day the form was drafted', () => {
    const draftedThenSent = {
      _id: 'ds1', petitionNo: 'P-DS1', dept: 'fg', status: 'sampleSent',
      items: [{ seq: 1, batchNo: 'B002', commonName: 'ยาเขียว' }],
      createdAt: '2026-07-09T02:00:00.000Z',
      sampleSentAt: '2026-07-12T02:00:00.000Z',
    };
    const { throughput } = buildStatsSection([], [draftedThenSent], opts);
    expect(throughput.find((d) => d.date === '2026-07-09').created).toBe(0);
    expect(throughput.find((d) => d.date === '2026-07-12').created).toBe(1);
  });

  it('leaves a petition whose sample has not been sent out of the inflow entirely', () => {
    const notSentYet = {
      _id: 'ns1', petitionNo: 'P-NS1', dept: 'fg', status: 'pendingReview',
      items: [{ seq: 1, batchNo: 'B002', commonName: 'ยาเขียว' }],
      createdAt: '2026-07-13T02:00:00.000Z',
      // sampleSentAt intentionally absent — ยังไม่ได้นำส่งตัวอย่าง
    };
    const { throughput } = buildStatsSection([], [notSentYet], opts);
    expect(throughput.every((d) => d.created === 0)).toBe(true);
  });

  it('derives abnormal and rework rates from the closed set', () => {
    const { quality } = buildStatsSection(closed, closed, opts);
    expect(quality).toEqual({ closed: 2, abnormal: 1, abnormalRate: 0.5, reworked: 1, reworkRate: 0.5 });
  });

  it('splits workload between the Lab assignee and the QC testers', () => {
    const { workload } = buildStatsSection(closed, closed, opts);
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
    const { workload } = buildStatsSection([labPetition], [labPetition], opts);
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
    const { workload } = buildStatsSection([qcOnlyWithAssignee], [qcOnlyWithAssignee], opts);
    expect(workload.lab).toEqual([]);
  });

  it('returns empty structures when nothing closed in the window', () => {
    const { turnaround, quality, workload } = buildStatsSection([], [], opts);
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
    const { turnaround } = buildStatsSection([withReceipt, missingReceipt], [withReceipt, missingReceipt], opts);
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
    const { turnaround } = buildStatsSection([normal, outOfOrder], [normal, outOfOrder], opts);
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
    const { turnaround } = buildStatsSection([labPetition, qcOnlyPetition], [labPetition, qcOnlyPetition], opts);
    const byStage = Object.fromEntries(turnaround.map((t) => [t.stage, t]));
    // If the QC-only petition were counted as a 0-minute Lab stage instead of being
    // excluded, these averages would be halved (30/90/30) and counts would be 2.
    expect(byStage.pendingAssign).toMatchObject({ avgMin: 60, count: 1 });
    expect(byStage.labTesting).toMatchObject({ avgMin: 180, count: 1 });
    expect(byStage.waitingLabApprove).toMatchObject({ avgMin: 60, count: 1 });
  });
});
