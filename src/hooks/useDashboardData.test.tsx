import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DASHBOARD_PROFILES } from "@/lib/dashboardProfiles";

const state = vi.hoisted(() => ({
  user: { email: "analyst@example.com", roles: ["lab-analyze", "lab-inventory"] },
}));

const apiMock = vi.hoisted(() => ({
  getSolvents: vi.fn(),
  getStandards: vi.fn(),
  getGlassware: vi.fn(),
  getStockUnits: vi.fn(),
  getStockTransactions: vi.fn(),
  getDailyCheckTodaySummary: vi.fn(),
  getEnvCheckTodaySummary: vi.fn(),
  getEquipmentChecks: vi.fn(),
  getStandardTimeSummary: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: state.user }),
}));

vi.mock("@/context/SampleContext", () => ({
  useSamples: () => ({ doneSamples: [], approvals: {} }),
}));

vi.mock("@/hooks/usePetition", () => ({
  usePetitionList: () => ({ data: { items: [] }, loading: false, refresh: vi.fn() }),
}));

vi.mock("@/lib/api", () => ({ api: apiMock }));

import { useDashboardData } from "./useDashboardData";

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useDashboardData inventory deductions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.getSolvents.mockResolvedValue([]);
    apiMock.getStandards.mockResolvedValue([]);
    apiMock.getGlassware.mockResolvedValue([]);
    apiMock.getStockUnits.mockResolvedValue([]);
    apiMock.getDailyCheckTodaySummary.mockResolvedValue({ count: 0, scaleIds: [] });
    apiMock.getEnvCheckTodaySummary.mockResolvedValue({ count: 0, rooms: [] });
    apiMock.getEquipmentChecks.mockResolvedValue([]);
    apiMock.getStandardTimeSummary.mockResolvedValue({ byInstrument: [] });
    apiMock.getStockTransactions.mockImplementation(({ skip = 0 }) => Promise.resolve(
      skip === 0
        ? Array.from({ length: 500 }, (_, index) => ({ _id: `tx-${index}`, action: "deduct", createdAt: "2026-07-11T01:00:00.000Z" }))
        : [{ _id: "tx-500", action: "deduct", createdAt: "2026-07-11T01:00:00.000Z" }],
    ));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads all date-bounded deduction pages when Lab Analyze also holds Lab Inventory", async () => {
    renderHook(() => useDashboardData(DASHBOARD_PROFILES["lab-analyze"]), { wrapper });

    await waitFor(() => expect(apiMock.getStockTransactions).toHaveBeenCalledTimes(2));

    expect(apiMock.getSolvents).toHaveBeenCalledTimes(1);
    expect(apiMock.getStandards).toHaveBeenCalledTimes(1);
    expect(apiMock.getGlassware).toHaveBeenCalledTimes(1);
    expect(apiMock.getStockUnits).toHaveBeenCalledTimes(1);
    expect(apiMock.getStockTransactions).toHaveBeenNthCalledWith(1, expect.objectContaining({
      action: "deduct",
      limit: 500,
      skip: 0,
      createdFrom: expect.any(String),
      createdTo: expect.any(String),
    }));
    expect(apiMock.getStockTransactions).toHaveBeenNthCalledWith(2, expect.objectContaining({
      action: "deduct",
      limit: 500,
      skip: 500,
      createdFrom: expect.any(String),
      createdTo: expect.any(String),
    }));
  });
});

describe("useDashboardData clock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 13, 23, 59, 59));
    state.user = { email: "qc@example.com", roles: ["qc-staff"] };
  });

  afterEach(() => {
    vi.useRealTimers();
    state.user = { email: "analyst@example.com", roles: ["lab-analyze", "lab-inventory"] };
  });

  it("updates metrics now at the next local midnight", () => {
    const { result } = renderHook(() => useDashboardData(DASHBOARD_PROFILES["qc-staff"]), { wrapper });
    const initialNow = result.current.ctx.now;

    act(() => {
      vi.advanceTimersByTime(1_001);
    });

    expect(result.current.ctx.now).toBeGreaterThan(initialNow);
    expect(new Date(result.current.ctx.now).getDate()).toBe(14);
  });
});
