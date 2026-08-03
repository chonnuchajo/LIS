import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import StockDeduction from "../StockDeduction";

const apiMock = vi.hoisted(() => ({
  getStockTransactions: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ api: apiMock }));

vi.mock("@/components/lis/AppLayout", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/lis/PageHeader", () => ({
  default: ({ title, description }: { title: ReactNode; description?: ReactNode }) => (
    <header>
      {title}
      {description}
    </header>
  ),
}));

vi.mock("@/components/lis/stock/StockRequisitionButton", () => ({
  default: () => null,
}));

vi.mock("@/hooks/useAccessibleTabs", () => ({
  useAccessibleTabs: () => ({
    tabs: [
      { key: "in-use", label: "กำลังใช้งานอยู่" },
      { key: "history", label: "ประวัติการตัด stock" },
    ],
    isVisible: () => true,
    visibleKeys: ["in-use", "history"],
    defaultKey: "in-use",
  }),
}));

vi.mock("@/components/lis/stock/StandardsInUseTable", () => ({
  default: () => <div>in-use-table</div>,
}));

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <StockDeduction />
    </QueryClientProvider>,
  );
}

describe("StockDeduction item display", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.getStockTransactions.mockResolvedValue([
      {
        _id: "tx-1",
        itemType: "standard",
        itemId: "std-1",
        itemCode: "STD-001",
        itemName: "ABAMECTIN",
        action: "deduct",
        volumeDelta: -45,
        unit: "mg",
        createdAt: "2026-07-10T01:00:00.000Z",
      },
    ]);
  });

  it("shows the substance name in the item column without showing the stock code", async () => {
    renderPage();

    const historyTab = await screen.findByRole("tab", { name: "ประวัติการตัด stock" });
    fireEvent.mouseDown(historyTab);
    fireEvent.click(historyTab);

    expect(await screen.findByText("ABAMECTIN")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("STD-001")).not.toBeInTheDocument());
  });

  it("opens deduction details from a clicked row and shows the resolution action", async () => {
    renderPage();

    const historyTab = await screen.findByRole("tab", { name: "ประวัติการตัด stock" });
    fireEvent.mouseDown(historyTab);
    fireEvent.click(historyTab);

    fireEvent.click(await screen.findByText("ABAMECTIN"));

    expect(await screen.findByRole("heading", { name: "รายละเอียดการเบิก" })).toBeInTheDocument();
    expect(screen.getAllByText("ABAMECTIN").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "แจ้งหมด/ปัญหา" })).toBeInTheDocument();
  });
});
