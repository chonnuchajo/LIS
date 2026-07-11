import { describe, it, expect } from "vitest";
import {
  ageHours, isSameLocalDay, countByStatus, statusDonutData, deptWorkloadData,
  normalDonutData, requestTrendData, completedIn, computeKpi,
  buildLabWorklist, buildQcStaffWorklist, labWorklistCounts, qcStaffWorklistCounts,
  paginateLabWorklist, assignedWeekdayData,
  simpleMethodCoverageData, standardTimeCoverageData,
  type MetricsCtx,
} from "./dashboardMetrics";
import type { Petition } from "@/types/petition.types";

const NOW = new Date(2026, 6, 6, 15, 0).getTime(); // 6 Jul 2026 15:00 local

function pet(over: Partial<Petition>): Petition {
  return {
    _id: over._id ?? Math.random().toString(36),
    petitionNo: "P-1", dept: "production", status: "inProgress",
    submittedBy: { name: "somchai", submittedAt: "2026-07-06T01:00:00Z" },
    items: [{ seq: 1, sampleName: "S", batchNo: "B" }],
    createdAt: "2026-07-06T01:00:00.000Z", updatedAt: "2026-07-06T01:00:00.000Z",
    ...over,
  } as Petition;
}

function toCounts(rows: { label: string; value: number }[]): Record<string, number> {
  return Object.fromEntries(rows.map((row) => [row.label, row.value]));
}

const methods = [
  { _id: "m-gc", code: "GC", label: "GC", requiresMachine: true, machinePrefix: "GC", defaultTimes: 3, order: 1, active: true, builtIn: true },
  { _id: "m-hplc", code: "HPLC", label: "HPLC", requiresMachine: true, machinePrefix: "HPLC", defaultTimes: 1, order: 2, active: true, builtIn: true },
  { _id: "m-titration", code: "TITRATION", label: "Titration", requiresMachine: false, machinePrefix: "", defaultTimes: 1, order: 3, active: true, builtIn: false },
];

describe("date helpers", () => {
  it("ageHours computes elapsed hours, clamped >= 0", () => {
    const twoHoursAgo = new Date(NOW - 2 * 3600_000).toISOString();
    expect(ageHours(twoHoursAgo, NOW)).toBe(2);
    expect(ageHours(null, NOW)).toBeNull();
  });
  it("isSameLocalDay true for same calendar day", () => {
    expect(isSameLocalDay(new Date(2026, 6, 6, 9).toISOString(), NOW)).toBe(true);
    expect(isSameLocalDay(new Date(2026, 6, 5, 9).toISOString(), NOW)).toBe(false);
  });
});

describe("aggregations", () => {
  const list = [
    pet({ status: "inProgress" }), pet({ status: "inProgress" }),
    pet({ status: "success" }), pet({ status: "sampleSent" }),
    pet({ dept: "rm", status: "success" }),
  ];
  it("countByStatus tallies each status", () => {
    expect(countByStatus(list).inProgress).toBe(2);
    expect(countByStatus(list).success).toBe(2);
    expect(countByStatus(list).sampleSent).toBe(1);
  });
  it("statusDonutData returns only non-zero slices with labels+colors", () => {
    const d = statusDonutData(list);
    expect(d.every((s) => s.value > 0)).toBe(true);
    expect(d.find((s) => s.key === "inProgress")?.value).toBe(2);
    expect(d.find((s) => s.key === "inProgress")?.label).toBeTruthy();
  });
  it("deptWorkloadData groups by dept label", () => {
    const d = deptWorkloadData(list);
    expect(d.find((x) => x.dept === "production")?.count).toBe(4);
    expect(d.find((x) => x.dept === "rm")?.count).toBe(1);
  });
  it("normalDonutData splits abnormal vs normal by flags", () => {
    const flags = { [list[0]._id]: true };
    const d = normalDonutData(list, flags);
    expect(d.find((x) => x.key === "abnormal")?.value).toBe(1);
    expect(d.find((x) => x.key === "normal")?.value).toBe(4);
  });
  it("requestTrendData buckets last N days by createdAt", () => {
    const d = requestTrendData(list, NOW, 7);
    expect(d).toHaveLength(7);
    expect(d[d.length - 1].count).toBe(5); // all created today
  });
  it("completedIn counts success/approved on a given local day offset", () => {
    const today = [
      pet({ status: "success", completedAt: new Date(NOW).toISOString() }),
      pet({ status: "approved", completedAt: new Date(NOW).toISOString() }),
      pet({ status: "success", completedAt: new Date(NOW - 86400_000).toISOString() }),
    ];
    expect(completedIn(today, NOW, 0)).toBe(2);
    expect(completedIn(today, NOW, 1)).toBe(1);
  });
});

describe("Lab Data Config coverage pies", () => {
  it("simpleMethodCoverageData separates GC, HPLC, GC + HPLC, and unassigned slots", () => {
    const masterItems = [
      { itemNo: "P1", commonName: "ALPHA 10% EC" },
      { itemNo: "P2", commonName: "BETA 20% SC" },
      { itemNo: "P3", commonName: "GAMMA 5% + DELTA 10% EC" },
      { itemNo: "P4", commonName: "EPSILON 1% SL" },
      { itemNo: "P5", commonName: "ZETA 1% SL" },
    ];
    const simpleMethods = [
      { itemNo: "P1", methods: [["GC"]] },
      { itemNo: "P2", methods: [["HPLC"]] },
      { itemNo: "P3", methods: [["GC", "HPLC"], []] },
      { itemNo: "P4", methods: [["TITRATION"]] },
    ];

    expect(toCounts(simpleMethodCoverageData(masterItems, simpleMethods, methods))).toEqual({
      GC: 1,
      HPLC: 1,
      "GC + HPLC": 1,
      "ยังไม่ได้กำหนด": 3,
    });
  });

  it("simpleMethodCoverageData reads legacy instruments through slot compatibility", () => {
    const masterItems = [{ itemNo: "LEGACY", commonName: "ALPHA 10% EC + BETA 20% SC" }];
    const simpleMethods = [{ itemNo: "LEGACY", instruments: ["GC", "HPLC"] }];

    expect(toCounts(simpleMethodCoverageData(masterItems, simpleMethods, methods))).toEqual({
      GC: 1,
      HPLC: 1,
    });
  });

  it("standardTimeCoverageData returns per-instrument configured rows and one unassigned slice", () => {
    const summary = [
      { _id: "GC7890A", total: 4, withData: 3 },
      { _id: "HPLC1260", total: 2, withData: 2 },
      { _id: "GC8890", total: 1, withData: 0 },
    ];

    expect(toCounts(standardTimeCoverageData(summary))).toEqual({
      GC7890A: 3,
      HPLC1260: 2,
      "ยังไม่กำหนด": 2,
    });
  });
});

describe("computeKpi", () => {
  const ctx: MetricsCtx = {
    petitions: [
      pet({ _id: "a", status: "inProgress" }),
      pet({ _id: "b", status: "success", completedAt: new Date(NOW).toISOString() }),
      pet({ _id: "c", status: "sampleSent" }),
    ],
    now: NOW,
    abnormalFlags: { a: true }, returnedFlags: { c: true },
    pendingQcCount: 4, assignedToMeCount: 2,
    usersTotal: 10, usersActive: 7, rolesTotal: 4,
    dailyCheckPending: 1, dailyCheckDone: 37, dailyCheckTotal: 38, dailyCheckLoading: false,
    stockLow: 3, stockExpiring: 2, withdrawalsToday: 5, withdrawalsYesterday: 3,
    qcApprovedToday: 6, qcApprovedYesterday: 4, methodGaps: 9, masterItemsTotal: 120,
    simpleMethodCoverage: [],
    standardTimeCoverage: [],
    configCoverageLoading: false,
  };
  it("status counts", () => {
    expect(computeKpi("inProgress", ctx).value).toBe(1);
    expect(computeKpi("waitingReceive", ctx).value).toBe(1);
    expect(computeKpi("waitingReview", ctx).value).toBe(1);
    expect(computeKpi("petitionsTotal", ctx).value).toBe(3);
  });
  it("flags + passthrough ctx numbers", () => {
    expect(computeKpi("abnormalResults", ctx).value).toBe(1);
    expect(computeKpi("returnedTotal", ctx).value).toBe(1);
    expect(computeKpi("usersActive", ctx).value).toBe(7);
    expect(computeKpi("methodGaps", ctx).value).toBe(9);
  });
  it("time-based KPIs carry delta today-minus-yesterday", () => {
    expect(computeKpi("withdrawalsToday", ctx)).toEqual({ value: 5, delta: 2 });
    expect(computeKpi("qcApprovedToday", ctx)).toEqual({ value: 6, delta: 2 });
    expect(computeKpi("approvedToday", ctx)).toEqual({ value: 6, delta: 2 });
  });
  it("normalRateApprox = round(100*(1-abnormal/total))", () => {
    expect(computeKpi("normalRateApprox", ctx).value).toBe(67); // 1 abnormal of 3
  });
});

describe("qc staff worklist helpers", () => {
  const receivedNewest = new Date(2026, 6, 6, 11).toISOString();
  const participantOlder = new Date(2026, 6, 6, 9).toISOString();
  const doneEarly = new Date(2026, 6, 6, 8).toISOString();
  const doneLate = new Date(2026, 6, 6, 14).toISOString();
  const yesterday = new Date(2026, 6, 5, 14).toISOString();
  const user = { employeeId: "QC1", name: "QC A" };
  const participants = {
    "in-participant": ["QC A"],
    "review-tester": ["QC A"],
    "review-other": ["QC B"],
  };

  const list = [
    pet({ _id: "waiting-receive", status: "sampleSent", sampleSentAt: doneEarly }),
    pet({
      _id: "in-received",
      status: "inProgress",
      qcReceivedAt: receivedNewest,
      qcReceivedBy: "QC B",
    }),
    pet({
      _id: "in-participant",
      status: "inProgress",
      assignedTo: { employeeId: "E2", name: "B", assignedAt: participantOlder },
    }),
    pet({ _id: "in-unrelated", status: "inProgress" }),
    pet({ _id: "review-mine", status: "success", completedAt: doneLate, qcCompletedBy: "QC A" }),
    pet({ _id: "review-tester", status: "success", completedAt: doneEarly }),
    pet({ _id: "review-other", status: "success", completedAt: doneLate, qcCompletedBy: "QC B" }),
    pet({ _id: "approved-today", status: "approved", approvedAt: new Date(NOW).toISOString() }),
    pet({ _id: "approved-yesterday", status: "approved", approvedAt: yesterday }),
  ];

  it("filters QC staff rows by clicked KPI state", () => {
    expect(buildQcStaffWorklist(list, "waitingReceive", user, NOW, participants).map((p) => p._id))
      .toEqual(["waiting-receive"]);
    expect(buildQcStaffWorklist(list, "inProgress", user, NOW, participants).map((p) => p._id))
      .toEqual(["in-received", "in-participant"]);
    expect(buildQcStaffWorklist(list, "waitingReview", user, NOW, participants).map((p) => p._id))
      .toEqual(["review-mine", "review-tester"]);
    expect(buildQcStaffWorklist(list, "approvedToday", user, NOW, participants).map((p) => p._id))
      .toEqual(["approved-today"]);
  });

  it("qcStaffWorklistCounts matches the QC staff dashboard filters", () => {
    expect(qcStaffWorklistCounts(list, user, NOW, participants)).toEqual({
      waitingReceive: 1,
      inProgress: 2,
      waitingReview: 2,
      approvedToday: 1,
    });
  });
});

describe("lab analyze worklist helpers", () => {
  const assignedOlder = new Date(2026, 6, 5, 9).toISOString();
  const assignedNewer = new Date(2026, 6, 6, 10).toISOString();
  const doneEarly = new Date(2026, 6, 6, 8).toISOString();
  const doneLate = new Date(2026, 6, 6, 14).toISOString();
  const yesterday = new Date(2026, 6, 5, 14).toISOString();

  const list = [
    pet({
      _id: "older",
      petitionNo: "P-old",
      status: "inProgress",
      assignedTo: { employeeId: "", name: "A", assignedAt: assignedOlder },
      labReceivedAt: assignedOlder,
    }),
    pet({
      _id: "newer",
      petitionNo: "P-new",
      status: "inProgress",
      assignedTo: { employeeId: "E1", name: "A", assignedAt: assignedNewer },
      labReceivedAt: assignedNewer,
    }),
    pet({
      _id: "other",
      petitionNo: "P-other",
      status: "inProgress",
      assignedTo: { employeeId: "E2", name: "B", assignedAt: assignedNewer },
      labReceivedAt: assignedNewer,
    }),
    pet({
      _id: "not-progress",
      petitionNo: "P-pending",
      status: "pendingReview",
      assignedTo: { employeeId: "E1", name: "A", assignedAt: assignedNewer },
    }),
    pet({
      _id: "sent-result",
      petitionNo: "P-sent",
      status: "inProgress",
      assignedTo: { employeeId: "E1", name: "A", assignedAt: assignedNewer },
      labReceivedAt: assignedNewer,
      labCompletedAt: doneLate,
    }),
    pet({
      _id: "done-early",
      petitionNo: "P-done-1",
      status: "inProgress",
      assignedTo: { employeeId: "E1", name: "A", assignedAt: assignedOlder },
      labCompletedAt: doneEarly,
    }),
    pet({
      _id: "done-late",
      petitionNo: "P-done-2",
      status: "inProgress",
      assignedTo: { employeeId: "E1", name: "A", assignedAt: assignedNewer },
      labCompletedAt: doneLate,
    }),
    pet({
      _id: "done-other",
      petitionNo: "P-done-other",
      status: "inProgress",
      assignedTo: { employeeId: "E2", name: "B", assignedAt: assignedNewer },
      labCompletedAt: doneLate,
    }),
    pet({
      _id: "done-yesterday",
      petitionNo: "P-done-3",
      status: "inProgress",
      assignedTo: { employeeId: "E1", name: "A", assignedAt: assignedOlder },
      labCompletedAt: yesterday,
    }),
  ];

  it("buildLabWorklist returns my assigned open work newest first", () => {
    expect(buildLabWorklist(list, "assignedToMe", { employeeId: "E1", name: "A" }, NOW).map((p) => p._id))
      .toEqual(["newer", "not-progress", "older"]);
  });

  it("buildLabWorklist returns my accepted in-progress lab work newest first", () => {
    expect(buildLabWorklist(list, "inProgress", { employeeId: "E1", name: "A" }, NOW).map((p) => p._id))
      .toEqual(["newer", "older"]);
  });

  it("buildLabWorklist returns my lab-completed-today work newest first", () => {
    expect(buildLabWorklist(list, "completedToday", { employeeId: "E1", name: "A" }, NOW).map((p) => p._id))
      .toEqual(["sent-result", "done-late", "done-early"]);
  });

  it("labWorklistCounts matches the lab dashboard worklist filters", () => {
    expect(labWorklistCounts(list, { employeeId: "E1", name: "A" }, NOW)).toEqual({
      assignedToMe: 3,
      inProgress: 2,
      completedToday: 3,
    });
  });

  it("paginateLabWorklist returns 4 rows per page and clamps page bounds", () => {
    expect(paginateLabWorklist([1, 2, 3, 4, 5], 1).pageRows).toEqual([1, 2, 3, 4]);
    expect(paginateLabWorklist([1, 2, 3, 4, 5], 2).pageRows).toEqual([5]);
    expect(paginateLabWorklist([1, 2, 3, 4, 5], 99).page).toBe(2);
    expect(paginateLabWorklist([], 1)).toEqual({ pageRows: [], page: 1, totalPages: 1, total: 0 });
  });

  it("assignedWeekdayData shows Monday-Saturday by default and Sunday only when assigned", () => {
    const monday = pet({
      _id: "mon",
      assignedTo: { employeeId: "E1", name: "A", assignedAt: new Date(2026, 6, 6, 9).toISOString() },
    });
    const sunday = pet({
      _id: "sun",
      assignedTo: { employeeId: "E1", name: "A", assignedAt: new Date(2026, 6, 12, 9).toISOString() },
    });

    expect(assignedWeekdayData([monday]).map((d) => d.key)).toEqual(["mon", "tue", "wed", "thu", "fri", "sat"]);
    expect(assignedWeekdayData([monday, sunday]).map((d) => d.key)).toEqual(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
    expect(assignedWeekdayData([monday, sunday]).find((d) => d.key === "sun")?.count).toBe(1);
  });
});
