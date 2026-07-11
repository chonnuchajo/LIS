import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  roles: ["lab-analyze", "lab-inventory", "lab-data-config"] as string[],
}));

const ctx = vi.hoisted(() => ({
  now: Date.now(),
  abnormalFlags: {},
  returnedFlags: {},
  labInventorySummary: { nearEmpty: 0, outOfStock: 0, nearExpiry: 0, todayDeductions: 0, rows: [] },
  labInventoryLoading: false,
  simpleMethodCoverage: [],
  standardTimeCoverage: [],
  configCoverageLoading: false,
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { email: "analyst@example.com", roles: state.roles } }),
}));
vi.mock("@/hooks/useDashboardData", () => ({
  useDashboardData: () => ({ petitions: [], ctx, refresh: vi.fn() }),
}));
vi.mock("@/lib/accessControlSource", () => ({
  loadAccessControl: () => Promise.resolve({ roles: [] }),
}));
vi.mock("@/lib/accessNav", () => ({
  getAccessibleNavItemsForRoles: () => [],
}));
vi.mock("@/components/lis/AppLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/components/dashboard/DashboardHeader", () => ({ default: () => <div>Header</div> }));
vi.mock("@/components/dashboard/KpiRow", () => ({ default: () => <div data-testid="kpis">KPIs</div> }));
vi.mock("@/components/dashboard/DailyCheckProgressCard", () => ({ default: () => <div>Daily checks</div> }));
vi.mock("@/components/dashboard/ActionTable", () => ({ default: () => <div data-testid="primary-content">Primary content</div> }));
vi.mock("@/components/dashboard/WorkflowSummary", () => ({ default: () => <div>Workflow</div> }));
vi.mock("@/components/dashboard/AnalyticsSection", () => ({ default: () => <div>Analytics</div> }));
vi.mock("@/components/dashboard/ActivityTimeline", () => ({ default: () => <div>Activity</div> }));
vi.mock("@/components/dashboard/ConfigCoveragePies", () => ({ default: () => <div data-testid="config-coverage">Config coverage</div> }));
vi.mock("@/components/dashboard/LabInventorySummary", () => ({ default: () => <div data-testid="inventory-summary">Inventory summary</div> }));
vi.mock("@/components/dashboard/GenericMenuGrid", () => ({ default: () => <div>Menu</div> }));

import RoleDashboard from "./RoleDashboard";

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <RoleDashboard />
    </QueryClientProvider>,
  );
}

function domOrder(container: HTMLElement, testIds: string[]) {
  return testIds.map((testId) => {
    const node = screen.getByTestId(testId);
    return Array.prototype.indexOf.call(container.querySelectorAll("*"), node);
  });
}

describe("RoleDashboard overlays", () => {
  beforeEach(() => {
    state.roles = ["lab-analyze", "lab-inventory", "lab-data-config"];
  });

  it("keeps Lab Analyze primary content before config and inventory overlays", () => {
    const { container } = renderDashboard();

    expect(domOrder(container, ["primary-content", "config-coverage", "inventory-summary"]))
      .toEqual([...domOrder(container, ["primary-content", "config-coverage", "inventory-summary"])].sort((a, b) => a - b));
  });

  it("places the primary Lab Inventory card directly after KPIs", () => {
    state.roles = ["lab-inventory"];
    const { container } = renderDashboard();

    expect(domOrder(container, ["kpis", "inventory-summary", "primary-content"]))
      .toEqual([...domOrder(container, ["kpis", "inventory-summary", "primary-content"])].sort((a, b) => a - b));
  });
});
