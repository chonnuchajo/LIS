import React from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import KpiRow from "./KpiRow";
import type { MetricsCtx } from "@/lib/dashboardMetrics";
import type { KpiId } from "@/lib/dashboardProfiles";
import DailyCheckProgressCard from "./DailyCheckProgressCard";

const KPI_IDS: KpiId[] = [
  "urgentTotal",
  "usersTotal",
  "usersActive",
  "rolesTotal",
  "activeTotal",
  "dailyCheckPending",
  "assignedToMe",
  "inProgress",
  "completedToday",
  "methodGaps",
  "masterItemsTotal",
];

const ctx: MetricsCtx = {
  petitions: [],
  now: Date.now(),
  abnormalFlags: {},
  returnedFlags: {},
  pendingQcCount: 0,
  assignedToMeCount: 0,
  usersTotal: 0,
  usersActive: 0,
  rolesTotal: 0,
  dailyCheckPending: 0,
  dailyCheckDone: 0,
  dailyCheckTotal: 0,
  dailyCheckLoading: false,
  stockLow: 0,
  stockExpiring: 0,
  withdrawalsToday: 0,
  withdrawalsYesterday: 0,
  qcApprovedToday: 0,
  qcApprovedYesterday: 0,
  methodGaps: 0,
  masterItemsTotal: 0,
  labInventorySummary: {
    nearEmpty: 0,
    outOfStock: 0,
    nearExpiry: 0,
    todayDeductions: 0,
    rows: [],
  },
  labInventoryLoading: false,
  deductionTrend: [],
  simpleMethodCoverage: [],
  standardTimeCoverage: [],
  configCoverageLoading: false,
};

describe("KpiRow", () => {
  it.each([
    [5, "md:grid-cols-3"],
    [6, "md:grid-cols-3"],
    [7, "md:grid-cols-4"],
    [8, "md:grid-cols-4"],
    [9, "md:grid-cols-3"],
    [10, "md:grid-cols-4"],
    [11, "md:grid-cols-4"],
  ] as const)("uses the requested desktop grid for %i cards", (count, gridClass) => {
    const { container } = render(
      <MemoryRouter>
        <KpiRow kpis={KPI_IDS.slice(0, count)} ctx={ctx} />
      </MemoryRouter>,
    );

    expect(container.firstElementChild).toHaveClass("grid-cols-2", gridClass);
  });

  it("renders widget cards three per row and can place extra cards after the first KPI", () => {
    const { container } = render(
      <MemoryRouter>
        <KpiRow
          kpis={[
            "labHeadAll",
            "completedToday",
            "pendingAssign",
            "labHeadWaitingReceive",
            "labHeadPendingApproval",
          ]}
          ctx={ctx}
          presentation="widgets"
          extraCards={<DailyCheckProgressCard done={4} pending={2} total={6} />}
          extraCardsAfter={1}
        />
      </MemoryRouter>,
    );

    const grid = container.firstElementChild;
    expect(grid).toHaveClass("md:grid-cols-6");
    expect(grid).not.toHaveClass("md:grid-cols-4");
    expect(grid).not.toHaveClass("xl:grid-cols-8");

    const childText = Array.from(grid?.children ?? []).map((child) => child.textContent ?? "");
    expect(childText).toHaveLength(6);
    expect(childText[0]).toContain("งานทั้งหมด");
    expect(childText[1]).toContain("Daily Check");
    expect(childText[2]).toContain("เสร็จวันนี้");
    expect(childText[3]).toContain("รอ assign");
    expect(childText[4]).toContain("รอรับ");
    expect(childText[5]).toContain("รอออกผล");

    expect(grid?.children[0]).toHaveClass("md:col-span-2");
    expect(grid?.children[0]).not.toHaveClass("col-span-2");
    expect(grid?.children[1]).toHaveClass("md:col-span-2");
    expect(grid?.children[1]).not.toHaveClass("col-span-2");
  });

  it("keeps widget rows with four or fewer cards on the compact grid", () => {
    const { container } = render(
      <MemoryRouter>
        <KpiRow
          kpis={["assignedToMe", "inProgress", "completedToday"]}
          ctx={ctx}
          presentation="widgets"
          extraCards={<div data-testid="daily-check-card">Daily Check</div>}
        />
      </MemoryRouter>,
    );

    const grid = container.firstElementChild;
    expect(grid).toHaveClass("md:grid-cols-8");
    expect(grid).not.toHaveClass("md:grid-cols-4");
    expect(grid).not.toHaveClass("md:grid-cols-6");
  });
});
