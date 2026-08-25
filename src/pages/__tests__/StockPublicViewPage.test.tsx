import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import StockPublicViewPage from "../StockPublicViewPage";

const apiMock = vi.hoisted(() => ({
  getPublicStockItem: vi.fn(),
  getStockTransactions: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ api: apiMock }));

function renderPage(route: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={[route]}>
      <QueryClientProvider client={client}>
        <StockPublicViewPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("StockPublicViewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.getStockTransactions.mockResolvedValue([]);
  });

  it("shows public standard details and a stock deduction link", async () => {
    apiMock.getPublicStockItem.mockResolvedValue({
      kind: "standard",
      qrId: "u_abc123",
      itemCode: "STD-001",
      itemName: "Standard A",
      type: "primary",
      lotNo: "L1",
      lotBottleNo: 2,
      exp: "2027-01-01",
      volume: { initial: 100, remaining: 75, unit: "mg" },
      status: "active",
      photoUrls: ["/LIS/uploads/qc-photos/a.webp"],
    });

    renderPage("/stock/view?qrId=https%3A%2F%2Fapp-plant.icpladda.com%2FLIS%2Fstock%2Fview%3FqrId%3Du_abc123");

    expect(await screen.findByText("Standard A")).toBeInTheDocument();
    expect(screen.getByText("75 mg")).toBeInTheDocument();
    expect(screen.getByText("ขวดที่ 2")).toBeInTheDocument();
    expect(screen.queryByText("qrId")).not.toBeInTheDocument();
    expect(screen.queryByText("u_abc123")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^เบิก stock/ })).toHaveAttribute("href", "/stock-deduction?qrId=u_abc123");
  });

  it("shows bottle transaction history instead of bottle photos", async () => {
    apiMock.getPublicStockItem.mockResolvedValue({
      kind: "standard",
      qrId: "u_abc123",
      itemCode: "STD-001",
      itemName: "Standard A",
      type: "primary",
      lotNo: "L1",
      lotBottleNo: 2,
      exp: "2027-01-01",
      volume: { initial: 100, remaining: 75, unit: "mg" },
      status: "active",
      photoUrls: ["/LIS/uploads/qc-photos/a.webp"],
    });
    apiMock.getStockTransactions.mockResolvedValue([
      {
        _id: "tx1",
        itemType: "standard",
        itemId: "std1",
        itemCode: "STD-001",
        itemName: "Standard A",
        action: "deduct",
        qrId: "u_abc123",
        volumeDelta: -25,
        weights: [10, 15],
        unit: "mg",
        userName: "Lab User",
        note: "QC sample",
        createdAt: "2026-08-25T01:00:00.000Z",
      },
    ]);

    renderPage("/stock/view?qrId=u_abc123");

    expect(await screen.findByText("ประวัติขวดนี้")).toBeInTheDocument();
    expect(apiMock.getStockTransactions).toHaveBeenCalledWith({ qrId: "u_abc123", limit: 20 });
    expect(screen.getByText("deduct")).toBeInTheDocument();
    expect(screen.getByText("25 mg")).toBeInTheDocument();
    expect(screen.getByText("10 + 15")).toBeInTheDocument();
    expect(screen.getByText("Lab User")).toBeInTheDocument();
    expect(screen.getByText("QC sample")).toBeInTheDocument();
    expect(screen.queryByText("รูปขวด")).not.toBeInTheDocument();
  });

  it("blocks discarded standards without details or deduction links", async () => {
    apiMock.getPublicStockItem.mockResolvedValue({
      kind: "standard",
      qrId: "u_discarded",
      itemCode: "STD-002",
      itemName: "Discarded Standard",
      type: "primary",
      lotNo: "L2",
      lotBottleNo: 1,
      exp: "2027-01-01",
      volume: { initial: 100, remaining: 100, unit: "mg" },
      status: "discarded",
      photoUrls: ["/LIS/uploads/qc-photos/discarded.webp"],
    });

    renderPage("/stock/view?qrId=u_discarded");

    expect(await screen.findByText("Discarded Standard")).toBeInTheDocument();
    expect(screen.getByText("ขวดนี้ได้แจ้งทิ้งไปแล้ว ห้ามใช้")).toBeInTheDocument();
    expect(screen.queryByText("100 mg")).not.toBeInTheDocument();
    expect(screen.queryByText("Lot No")).not.toBeInTheDocument();
    expect(screen.queryByText("รูปขวด")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /เบิก stock/ })).not.toBeInTheDocument();
  });

  it("shows public solvent remaining quantity", async () => {
    apiMock.getPublicStockItem.mockResolvedValue({
      kind: "solvent",
      id: "sol1",
      qrId: "sol1",
      name: "Methanol",
      sizeLiter: 2.5,
      qty: 4,
      note: "flammable",
      photoUrls: [],
    });

    renderPage("/stock/view?qrId=sol1");

    expect(await screen.findByRole("heading", { name: "Methanol" })).toBeInTheDocument();
    expect(screen.getAllByText("4 ขวด").length).toBeGreaterThan(0);
    expect(screen.queryByText("qrId")).not.toBeInTheDocument();
    expect(screen.queryByText("sol1")).not.toBeInTheDocument();
    expect(screen.getByText("ประวัติสารเคมีนี้")).toBeInTheDocument();
    expect(screen.getByText("ยังไม่มี transaction ของรายการนี้")).toBeInTheDocument();
    expect(screen.queryByText("รูปขวด")).not.toBeInTheDocument();
  });

  it("loads solvent bottle history by scanned unit qrId", async () => {
    apiMock.getPublicStockItem.mockResolvedValue({
      kind: "solvent",
      id: "sol1",
      qrId: "u_sol_1",
      name: "Methanol",
      sizeLiter: 2.5,
      qty: 1,
      status: "active",
      lotNo: "B-001",
      lotBottleNo: 1,
      exp: "2027-01-01T00:00:00.000Z",
      photoUrls: [],
    });
    apiMock.getStockTransactions.mockResolvedValue([]);

    renderPage("/stock/view?qrId=u_sol_1");

    expect(await screen.findByRole("heading", { name: "Methanol" })).toBeInTheDocument();
    expect(apiMock.getStockTransactions).toHaveBeenCalledWith({ itemType: "solvent", qrId: "u_sol_1", limit: 20 });
  });
});
