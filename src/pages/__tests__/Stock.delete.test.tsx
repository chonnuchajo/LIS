import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import StockPage from "../Stock";

const apiMock = vi.hoisted(() => ({
  getStandards: vi.fn(),
  getStockUnits: vi.fn(),
  deleteStandard: vi.fn(),
  getSolvents: vi.fn(),
  getGlassware: vi.fn(),
  getStockTransactions: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ api: apiMock }));

vi.mock("@/components/lis/AppLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/lis/PageHeader", () => ({
  default: ({ title }: { title: React.ReactNode }) => <header>{title}</header>,
}));

vi.mock("@/components/lis/StockQrScanner", () => ({
  default: () => null,
}));

vi.mock("@/components/lis/stock/StandardDetailDrawer", () => ({
  default: () => <div data-testid="standard-detail-drawer" />,
}));

vi.mock("@/components/lis/stock/StandardUnitsPanel", () => ({
  default: () => null,
}));

vi.mock("@/components/lis/stock/ReceiveBottlesDialog", () => ({
  default: () => null,
}));

vi.mock("@/components/lis/stock/ReceiveCart", () => ({
  default: () => null,
}));

vi.mock("@/hooks/useAccessibleTabs", () => ({
  useAccessibleTabs: () => ({
    defaultKey: "standard",
    tabs: [{ key: "standard", label: "Standards" }],
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function renderStock() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <StockPage />
    </QueryClientProvider>,
  );
}

describe("StockPage delete actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.getStandards.mockResolvedValue([
      {
        _id: "std-1",
        code: "STD-001",
        name: "Pesticide Standard",
        primary: { qty: 0, ordered: 0, sizeMg: null, exp: "", usesPerBottle: null, pricePerUnit: 0, totalPrice: 0 },
        supplier: { qty: 0, sizeMg: null, exp: "" },
        working: { qty: 0, sizeMg: null, exp: "" },
        usagePerUseMg: null,
        frequency: "",
        storageTemp: "",
        status: "",
        expiryStatus: "",
      },
    ]);
    apiMock.getStockUnits.mockResolvedValue([]);
    apiMock.deleteStandard.mockResolvedValue({ success: true });
    apiMock.getSolvents.mockResolvedValue([]);
    apiMock.getGlassware.mockResolvedValue([]);
    apiMock.getStockTransactions.mockResolvedValue([]);
  });

  it("confirms and deletes a standard through the MongoDB-backed API", async () => {
    renderStock();

    expect(await screen.findByRole("cell", { name: "Pesticide Standard" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "ลบ Standard Pesticide Standard" }));
    expect(screen.queryByTestId("standard-detail-drawer")).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "ลบ" }));

    await waitFor(() => expect(apiMock.deleteStandard).toHaveBeenCalledWith("std-1"));
  });

  it("opens the detail drawer when clicking a standard row", async () => {
    renderStock();

    fireEvent.click(await screen.findByRole("cell", { name: "Pesticide Standard" }));

    expect(await screen.findByTestId("standard-detail-drawer")).toBeInTheDocument();
  });
});
