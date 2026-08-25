import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

import StockDeduction from "../StockDeduction";

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  getMethods: vi.fn(),
  getSolvents: vi.fn(),
  getStandards: vi.fn(),
  getStockTransactions: vi.fn(),
  getStockUnit: vi.fn(),
  getStockUnits: vi.fn(),
  getPendingStockDeductions: vi.fn(),
  deductStockUnitMg: vi.fn(),
}));

const toastMock = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ api: apiMock }));
vi.mock("sonner", () => ({ toast: toastMock }));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { email: "qa@example.com", name: "QA Tester" } }),
}));

vi.mock("@/components/lis/AppLayout", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/lis/PageHeader", () => ({
  default: ({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) => (
    <header>
      {title}
      {description}
      {actions}
    </header>
  ),
}));

vi.mock("@/components/lis/StockQrScanner", () => ({
  default: ({ open, onDecoded, onScanned }: {
    open: boolean;
    onDecoded?: (result: { raw: string; value: string; scanMode: "qr" }) => void;
    onScanned: (qrId: string) => void;
  }) => (
    open ? (
      <button
        type="button"
        onClick={() => {
          onDecoded?.({ raw: "https://app-plant.icpladda.com/LIS/stock/view?qrId=u_scan", value: "u_scan", scanMode: "qr" });
          onScanned("u_scan");
        }}
      >
        mock scan
      </button>
    ) : null
  ),
}));

vi.mock("@/hooks/useAccessibleTabs", () => ({
  useAccessibleTabs: () => ({
    tabs: [
      { key: "in-use", label: "กำลังใช้งานอยู่" },
      { key: "history", label: "ประวัติการตัด stock" },
    ],
    defaultKey: "in-use",
  }),
}));

vi.mock("@/components/lis/stock/StandardsInUseTable", () => ({
  default: () => <div>in-use-table</div>,
}));

function stockUnit(overrides: Record<string, unknown> = {}) {
  return {
    _id: "unit-1",
    qrId: "u_scan",
    itemCode: "1",
    itemName: "2,4-D Acid",
    kind: "sealed",
    type: "primary",
    lotNo: "123",
    exp: "2026-08-30T00:00:00.000Z",
    volume: { initial: 100, remaining: 100, unit: "mg" },
    status: "active",
    ...overrides,
  };
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}{location.search}</div>;
}

function renderPage(initialEntry = "/stock-deduction") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <QueryClientProvider client={client}>
        <LocationProbe />
        <StockDeduction />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("StockDeduction scan form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.getStockTransactions.mockResolvedValue([]);
    apiMock.getSolvents.mockResolvedValue([]);
    apiMock.getStandards.mockResolvedValue([
      { _id: "std-1", code: "1", name: "2,4-D Acid" },
    ]);
    apiMock.getStockUnit.mockResolvedValue(stockUnit());
    apiMock.getStockUnits.mockResolvedValue([stockUnit()]);
    apiMock.getPendingStockDeductions.mockResolvedValue([]);
    apiMock.getMethods.mockResolvedValue([
      { code: "GC-001", requiresMachine: true, machinePrefix: "GC" },
    ]);
    apiMock.get.mockImplementation((path: string) => {
      if (path === "/master-items") return Promise.resolve({ data: { data: [{ itemNo: "A1", commonName: "2,4-D Acid" }] } });
      if (path === "/simple-methods") return Promise.resolve({ data: { data: [{ itemNo: "A1", methods: [["GC-001"]] }] } });
      return Promise.resolve({ data: { data: [] } });
    });
  });

  it("keeps the standard deduction form open after scanning a bottle QR", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /สแกน QR ข้างขวด/ }));
    fireEvent.click(screen.getByRole("button", { name: "mock scan" }));

    expect(await screen.findByText("ค่าที่ scanner อ่านได้ล่าสุด")).toBeInTheDocument();
    expect(screen.getByText("raw: https://app-plant.icpladda.com/LIS/stock/view?qrId=u_scan")).toBeInTheDocument();
    expect(screen.getByText("qrId: u_scan")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "เบิก Standard" })).toBeInTheDocument();
    expect(await screen.findByText("2,4-D Acid (1)")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /GC\s*\(3\)/ })).toBeInTheDocument();
    expect(screen.getByText(/Lot 123 · เหลือ 100 mg/)).toBeInTheDocument();
  });

  it("opens scanner results without writing qrId into the URL", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /สแกน QR ข้างขวด/ }));
    fireEvent.click(screen.getByRole("button", { name: "mock scan" }));

    expect(screen.getByTestId("location")).toHaveTextContent("/stock-deduction");
    expect(screen.getByTestId("location")).not.toHaveTextContent("qrId=");
    expect(await screen.findByRole("heading", { name: "เบิก Standard" })).toBeInTheDocument();
  });

  it("still opens the standard form from a direct qrId URL", async () => {
    renderPage("/stock-deduction?qrId=u_scan");

    expect(await screen.findByRole("heading", { name: "เบิก Standard" })).toBeInTheDocument();
    expect(await screen.findByText("2,4-D Acid (1)")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/stock-deduction");
    expect(screen.getByTestId("location")).not.toHaveTextContent("qrId=");
  });

  it("shows an expiry popup instead of opening the form for an expired scanned bottle", async () => {
    const expiredUnit = stockUnit({ exp: "2026-08-20T00:00:00.000Z" });
    apiMock.getStockUnit.mockResolvedValue(expiredUnit);
    apiMock.getStockUnits.mockResolvedValue([expiredUnit]);

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /สแกน QR ข้างขวด/ }));
    fireEvent.click(screen.getByRole("button", { name: "mock scan" }));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith("ขวดนี้หมดอายุแล้วเมื่อ 20/08/2026"));
    expect(screen.queryByRole("heading", { name: "เบิก Standard" })).not.toBeInTheDocument();
  });

  it("shows an expiry popup when the scanned bottle already has an expired deduction resolution", async () => {
    apiMock.getStockTransactions.mockImplementation((params?: { qrId?: string }) => {
      if (params?.qrId === "u_scan") {
        return Promise.resolve([
          {
            _id: "tx-expired",
            itemType: "standard",
            itemId: "std-1",
            action: "deduct",
            qrId: "u_scan",
            createdAt: "2026-08-18T10:00:00.000Z",
            deductionResolution: { reason: "expired", resolvedAt: "2026-08-19T00:00:00.000Z" },
          },
        ]);
      }
      return Promise.resolve([]);
    });

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /สแกน QR ข้างขวด/ }));
    fireEvent.click(screen.getByRole("button", { name: "mock scan" }));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith("ขวดนี้หมดอายุแล้วเมื่อ 19/08/2026"));
    expect(screen.queryByRole("heading", { name: "เบิก Standard" })).not.toBeInTheDocument();
  });

  it("shows an empty popup instead of opening the form for an empty scanned bottle", async () => {
    const emptyUnit = stockUnit({
      status: "empty",
      volume: { initial: 100, remaining: 0, unit: "mg" },
      updatedAt: "2026-08-21T10:00:00.000Z",
    });
    apiMock.getStockUnit.mockResolvedValue(emptyUnit);
    apiMock.getStockUnits.mockResolvedValue([emptyUnit]);

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /สแกน QR ข้างขวด/ }));
    fireEvent.click(screen.getByRole("button", { name: "mock scan" }));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith("ขวดนี้หมดแล้วเมื่อ 21/08/2026"));
    expect(screen.queryByRole("heading", { name: "เบิก Standard" })).not.toBeInTheDocument();
  });

  it("shows an ineffective popup instead of opening the form for a discarded scanned bottle", async () => {
    const ineffectiveUnit = stockUnit({ status: "discarded", discardReason: "ไม่มีประสิทธิภาพ" });
    apiMock.getStockUnit.mockResolvedValue(ineffectiveUnit);
    apiMock.getStockUnits.mockResolvedValue([ineffectiveUnit]);

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /สแกน QR ข้างขวด/ }));
    fireEvent.click(screen.getByRole("button", { name: "mock scan" }));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith("ขวดนี้ไม่มีประสิทธิภาพแล้วไม่ควรใช้งาน"));
    expect(screen.queryByRole("heading", { name: "เบิก Standard" })).not.toBeInTheDocument();
  });

  it("opens the standard deduction form again when scanning the same bottle QR", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /สแกน QR ข้างขวด/ }));
    fireEvent.click(screen.getByRole("button", { name: "mock scan" }));
    expect(await screen.findByRole("heading", { name: "เบิก Standard" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "ยกเลิก" }));
    expect(screen.queryByRole("heading", { name: "เบิก Standard" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /สแกน QR ข้างขวด/ }));
    fireEvent.click(screen.getByRole("button", { name: "mock scan" }));

    expect(await screen.findByRole("heading", { name: "เบิก Standard" })).toBeInTheDocument();
  });
});
