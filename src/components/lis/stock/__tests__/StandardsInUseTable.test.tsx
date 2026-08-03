import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import StandardsInUseTable from "../StandardsInUseTable";

const apiMock = vi.hoisted(() => ({
  getStandardsInUse: vi.fn(),
  resolveStockDeduction: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ api: apiMock }));
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { email: "owner@icpladda.com", name: "สมชาย" } }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const NOW = "2026-08-03T00:00:00.000Z";
const DAY = 24 * 60 * 60 * 1000;

const item = (over: Record<string, unknown>) => ({
  _id: "tx1",
  itemCode: "STD-001",
  itemName: "ABAMECTIN",
  qrId: "u_abc",
  weights: [10],
  totalMg: 10,
  instrumentGroup: "gc",
  note: "",
  withdrawnAt: "2026-08-01T00:00:00.000Z",
  frequency: "1/1 week",
  dueAt: null,
  userEmail: "owner@icpladda.com",
  userName: "สมชาย",
  ...over,
});

function renderTable() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <StandardsInUseTable />
    </QueryClientProvider>,
  );
}

describe("StandardsInUseTable", () => {
  beforeEach(() => vi.clearAllMocks());

  it("แสดงสถานะตามความถี่ และขึ้น 'ยังไม่ได้ตั้งความถี่' เมื่อไม่มี dueAt", async () => {
    apiMock.getStandardsInUse.mockResolvedValue({
      serverTime: NOW,
      items: [
        item({ _id: "a", itemName: "ATRAZINE", dueAt: new Date(Date.parse(NOW) - DAY).toISOString() }),
        item({ _id: "b", itemName: "DIURON", dueAt: null, frequency: "" }),
      ],
    });
    renderTable();

    expect(await screen.findByText("ATRAZINE")).toBeInTheDocument();
    expect(screen.getByText("หมดอายุ")).toBeInTheDocument();
    expect(screen.getByText("ยังไม่ได้ตั้งความถี่")).toBeInTheDocument();
  });

  it("เจ้าของกดรับทราบได้ → ยิง resolve ด้วย reason expired", async () => {
    apiMock.getStandardsInUse.mockResolvedValue({
      serverTime: NOW,
      items: [item({ _id: "a", dueAt: new Date(Date.parse(NOW) - DAY).toISOString() })],
    });
    apiMock.resolveStockDeduction.mockResolvedValue({});
    renderTable();

    fireEvent.click(await screen.findByRole("button", { name: "รับทราบ" }));

    await waitFor(() =>
      expect(apiMock.resolveStockDeduction).toHaveBeenCalledWith("a", expect.objectContaining({ reason: "expired" })),
    );
  });

  it("คนที่ไม่ได้เบิกไม่เห็นปุ่ม แต่เห็นว่ารอใครรับทราบ", async () => {
    apiMock.getStandardsInUse.mockResolvedValue({
      serverTime: NOW,
      items: [item({
        _id: "a",
        dueAt: new Date(Date.parse(NOW) - DAY).toISOString(),
        userEmail: "other@icpladda.com",
        userName: "สมหญิง",
      })],
    });
    renderTable();

    expect(await screen.findByText("รอ สมหญิง รับทราบ")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "รับทราบ" })).not.toBeInTheDocument();
  });
});
