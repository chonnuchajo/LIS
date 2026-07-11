import { describe, it, expect } from "vitest";
import {
  ageHours, isSameLocalDay, countByStatus, statusDonutData, deptWorkloadData,
  normalDonutData, requestTrendData, completedIn, computeKpi,
  buildLabWorklist, buildQcStaffWorklist, labWorklistCounts, qcStaffWorklistCounts,
  paginateLabWorklist, assignedWeekdayData,
  labInventorySummaryData, deductionTrendData,
  type MetricsCtx,
} from "./dashboardMetrics";
import type { Petition } from "@/types/petition.types";
import type {
  StockGlasswareItem,
  StockSolventItem,
  StockStandardItem,
  StockTransactionItem,
  StockUnitItem,
} from "@/types/stock";

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

function stockStandard(over: Partial<StockStandardItem>): StockStandardItem {
  return {
    _id: over._id ?? "std-id",
    code: over.code ?? "STD",
    name: over.name ?? "Standard",
    primary: { qty: 0, ordered: 0, sizeMg: null, exp: "", usesPerBottle: null, pricePerUnit: 0, totalPrice: 0 },
    supplier: { qty: 0, sizeMg: null, exp: "" },
    working: { qty: 0, sizeMg: null, exp: "" },
    usagePerUseMg: null,
    frequency: "",
    storageTemp: "",
    status: "",
    expiryStatus: "",
    ...over,
  };
}

function stockUnit(over: Partial<StockUnitItem>): StockUnitItem {
  return {
    _id: over._id ?? "unit-id",
    qrId: over.qrId ?? "qr-id",
    itemCode: over.itemCode ?? "STD",
    itemName: over.itemName ?? "Standard",
    kind: over.kind ?? "sealed",
    source: over.source ?? "primary",
    type: over.type ?? "primary",
    parentId: over.parentId ?? null,
    lotNo: over.lotNo ?? "",
    exp: over.exp ?? null,
    volume: over.volume ?? { initial: 100, remaining: 100, unit: "mg" },
    status: over.status ?? "active",
    receivedDate: over.receivedDate ?? null,
    withdrawnDate: over.withdrawnDate ?? null,
    discardedAt: over.discardedAt ?? null,
    discardReason: over.discardReason ?? "",
    ...over,
  };
}

function solvent(over: Partial<StockSolventItem>): StockSolventItem {
  return {
    _id: over._id ?? "solvent-id",
    name: over.name ?? "Solvent",
    sizeLiter: over.sizeLiter ?? 1,
    qty: over.qty ?? 0,
    price: over.price ?? 0,
    note: over.note ?? "",
    ...over,
  };
}

function glassware(over: Partial<StockGlasswareItem>): StockGlasswareItem {
  return {
    _id: over._id ?? "glass-id",
    name: over.name ?? "Glassware",
    qty: over.qty ?? 0,
    pricePerPiece: over.pricePerPiece ?? 0,
    note: over.note ?? "",
    ...over,
  };
}

function stockTxn(over: Partial<StockTransactionItem>): StockTransactionItem {
  return {
    _id: over._id ?? "tx-id",
    itemType: over.itemType ?? "standard",
    itemId: over.itemId ?? "item-id",
    itemName: over.itemName ?? "Item",
    action: over.action ?? "deduct",
    createdAt: over.createdAt ?? new Date(NOW).toISOString(),
    ...over,
  };
}

function toRowCounts(rows: { key: string; value: number }[]): Record<string, number> {
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

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

describe("Lab Inventory dashboard metrics", () => {
  it("labInventorySummaryData counts near empty, out of stock, near expiry, and today's deductions", () => {
    const now = new Date(2026, 6, 6, 15, 0).getTime();
    const summary = labInventorySummaryData({
      standards: [
        stockStandard({ _id: "std-near", code: "STD-NEAR", name: "Near standard" }),
        stockStandard({ _id: "std-out", code: "STD-OUT", name: "Out standard" }),
        stockStandard({ _id: "std-exp", code: "STD-EXP", name: "Expiring standard" }),
      ],
      units: [
        stockUnit({ _id: "u-near", qrId: "qr-near", itemCode: "STD-NEAR", exp: "2026-09-01" }),
        stockUnit({ _id: "u-out", qrId: "qr-out", itemCode: "STD-OUT", exp: "2026-06-01" }),
        stockUnit({ _id: "u-exp-1", qrId: "qr-exp-1", itemCode: "STD-EXP", exp: "2026-07-20" }),
        stockUnit({ _id: "u-exp-2", qrId: "qr-exp-2", itemCode: "STD-EXP", exp: "2026-09-01" }),
      ],
      solvents: [
        solvent({ _id: "sol-near", name: "Near solvent", qty: 1 }),
        solvent({ _id: "sol-out", name: "Out solvent", qty: 0 }),
        solvent({ _id: "sol-ok", name: "Ok solvent", qty: 2 }),
      ],
      glassware: [
        glassware({ _id: "glass-out", name: "Out glass", qty: 0 }),
        glassware({ _id: "glass-ok", name: "Ok glass", qty: 1 }),
      ],
      deductions: [
        stockTxn({ _id: "tx-today-1", action: "deduct", createdAt: new Date(2026, 6, 6, 9).toISOString() }),
        stockTxn({ _id: "tx-today-2", action: "deduct", createdAt: new Date(2026, 6, 6, 14).toISOString() }),
        stockTxn({ _id: "tx-receive", action: "receive", createdAt: new Date(2026, 6, 6, 10).toISOString() }),
        stockTxn({ _id: "tx-yesterday", action: "deduct", createdAt: new Date(2026, 6, 5, 10).toISOString() }),
      ],
      now,
    });

    expect(summary.nearEmpty).toBe(2);
    expect(summary.outOfStock).toBe(3);
    expect(summary.nearExpiry).toBe(1);
    expect(summary.todayDeductions).toBe(2);
    expect(toRowCounts(summary.rows)).toEqual({
      nearEmpty: 2,
      outOfStock: 3,
      nearExpiry: 1,
      todayDeductions: 2,
    });
  });

  it("deductionTrendData buckets only deduction transactions by local day", () => {
    const now = new Date(2026, 6, 6, 15, 0).getTime();
    const rows = deductionTrendData([
      stockTxn({ _id: "today-1", action: "deduct", createdAt: new Date(2026, 6, 6, 8).toISOString() }),
      stockTxn({ _id: "today-2", action: "deduct", createdAt: new Date(2026, 6, 6, 11).toISOString() }),
      stockTxn({ _id: "yesterday", action: "deduct", createdAt: new Date(2026, 6, 5, 11).toISOString() }),
      stockTxn({ _id: "receive-today", action: "receive", createdAt: new Date(2026, 6, 6, 12).toISOString() }),
    ], now, 3);

    expect(rows.map((row) => row.count)).toEqual([0, 1, 2]);
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
