import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import StockPublicViewPage from "../StockPublicViewPage";

const apiMock = vi.hoisted(() => ({
  getPublicStockItem: vi.fn(),
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
    expect(screen.getByRole("link", { name: /^เบิก stock/ })).toHaveAttribute("href", "/stock-deduction?qrId=u_abc123");
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
    expect(screen.getByText("ยังไม่มีรูปขวด")).toBeInTheDocument();
  });
});
