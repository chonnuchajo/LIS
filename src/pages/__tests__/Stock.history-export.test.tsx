import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import StockPage from "../Stock";

const apiMock = vi.hoisted(() => ({
  getStockTransactions: vi.fn(),
  getStandards: vi.fn(),
  getSolvents: vi.fn(),
  exportStockStandardHistory: vi.fn(),
  exportStockSolventHistory: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ api: apiMock }));

vi.mock("@/components/lis/AppLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/lis/PageHeader", () => ({
  default: ({ title }: { title: React.ReactNode }) => <header>{title}</header>,
}));

vi.mock("@/components/lis/stock/ReceiveCart", () => ({ default: () => null }));
vi.mock("@/components/lis/StockQrScanner", () => ({ default: () => null }));
vi.mock("@/components/lis/stock/StandardDetailDrawer", () => ({ default: () => null }));
vi.mock("@/components/lis/stock/StandardUnitsPanel", () => ({ default: () => null }));
vi.mock("@/components/lis/stock/ReceiveBottlesDialog", () => ({ default: () => null }));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { email: "tester@example.com", name: "Tester", role: "admin", roles: ["admin"] } }),
}));

vi.mock("@/hooks/useAccessibleTabs", () => ({
  useAccessibleTabs: () => ({
    defaultKey: "history",
    tabs: [{ key: "history", label: "ประวัติ" }],
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
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

function isoDateForCurrentMonth(day: number) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-${String(day).padStart(2, "0")}`;
}

function currentMonthDayButton(day: number) {
  const monthName = new Intl.DateTimeFormat("en-US", { month: "long" }).format(new Date());
  const button = screen.getAllByRole("gridcell").find((element) => (
    element.getAttribute("aria-label")?.includes(`${monthName} ${day}`)
    || (element.textContent?.trim() === String(day) && !String(element.className).includes("day-outside"))
  ));
  if (!button) throw new Error(`Date button not found for ${monthName} ${day}`);
  return button;
}

describe("Stock history export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.getStockTransactions.mockResolvedValue([]);
    apiMock.getStandards.mockResolvedValue([{ _id: "std1", code: "STD-001", name: "Pesticide Mix" }]);
    apiMock.getSolvents.mockResolvedValue([{ _id: "sol1", name: "Methanol" }]);
    apiMock.exportStockStandardHistory.mockResolvedValue(new Blob(["xlsx"]));
    apiMock.exportStockSolventHistory.mockResolvedValue(new Blob(["doc"]));
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:stock-export") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens an export dialog with standard and solvent-specific controls", async () => {
    renderStock();

    fireEvent.click(await screen.findByRole("button", { name: "Export stock" }));

    const dialog = screen.getByRole("dialog", { name: "Export stock" });
    expect(within(dialog).getByText("ประเภท export")).toBeInTheDocument();
    expect(within(dialog).getByText("Standard")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("เลือก standard")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "เลือกช่วงวันที่ export" })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "สารเคมี" }));

    expect(within(dialog).getByLabelText("เลือกสารเคมี")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("วันที่")).toHaveAttribute("type", "date");
  });

  it("exports selected solvent history for the selected date", async () => {
    renderStock();

    fireEvent.click(await screen.findByRole("button", { name: "Export stock" }));
    const dialog = screen.getByRole("dialog", { name: "Export stock" });
    fireEvent.click(within(dialog).getByRole("button", { name: "สารเคมี" }));
    fireEvent.change(within(dialog).getByLabelText("เลือกสารเคมี"), { target: { value: "sol1" } });
    fireEvent.change(within(dialog).getByLabelText("วันที่"), { target: { value: "2026-06-08" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Export" }));

    await waitFor(() => expect(apiMock.exportStockSolventHistory).toHaveBeenCalledWith({
      solventId: "sol1",
      date: "2026-06-08",
    }));
  });


  it("exports selected standard history for the selected date range", async () => {
    renderStock();

    fireEvent.click(await screen.findByRole("button", { name: "Export stock" }));
    const dialog = screen.getByRole("dialog", { name: "Export stock" });
    fireEvent.change(within(dialog).getByLabelText("เลือก standard"), { target: { value: "std1" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "เลือกช่วงวันที่ export" }));
    await screen.findByRole("grid");
    fireEvent.click(currentMonthDayButton(5));
    fireEvent.click(currentMonthDayButton(16));
    fireEvent.click(within(dialog).getByRole("button", { name: "Export" }));

    await waitFor(() => expect(apiMock.exportStockStandardHistory).toHaveBeenCalledWith({
      itemId: "std1",
      startDate: isoDateForCurrentMonth(5),
      endDate: isoDateForCurrentMonth(16),
    }));
  });
});




