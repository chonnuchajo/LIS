import { describe, it, expect } from "vitest";
import {
  ageHours, isSameLocalDay, countByStatus, statusDonutData, deptWorkloadData,
  normalDonutData, requestTrendData, completedIn, computeKpi, type MetricsCtx,
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
    usersTotal: 10, usersActive: 7, rolesTotal: 4, dailyCheckPending: 1,
    stockLow: 3, stockExpiring: 2, withdrawalsToday: 5, withdrawalsYesterday: 3,
    qcApprovedToday: 6, qcApprovedYesterday: 4, methodGaps: 9, masterItemsTotal: 120,
  };
  it("status counts", () => {
    expect(computeKpi("inProgress", ctx).value).toBe(1);
    expect(computeKpi("waitingReceive", ctx).value).toBe(1);
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
  });
  it("normalRateApprox = round(100*(1-abnormal/total))", () => {
    expect(computeKpi("normalRateApprox", ctx).value).toBe(67); // 1 abnormal of 3
  });
});
