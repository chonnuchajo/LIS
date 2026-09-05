import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProductionPetitionNewPage from "./ProductionPetitionNewPage";

const createPetitionMock = vi.hoisted(() => vi.fn());
const createLabRequestMock = vi.hoisted(() => vi.fn());
const apiGetMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/usePetition", () => ({
  createPetition: createPetitionMock,
  createLabRequest: createLabRequestMock,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: apiGetMock,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

function renderPage() {
  const query = new URLSearchParams({
    department: "Production",
    requesterName: "สมชาย",
    sampleName: "สินค้า A",
    commonName: "สาร A",
    batchNo: "B2",
    productionDate: "2026-08-01",
    quantity: "1 L",
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <MemoryRouter initialEntries={[`/petitions/ProductionIntegrationPetitionNewPage?${query.toString()}`]}>
      <QueryClientProvider client={client}>
        <ProductionPetitionNewPage integrationMode publicMode />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("ProductionPetitionNewPage approval QR timing", () => {
  beforeEach(() => {
    createPetitionMock.mockReset();
    createLabRequestMock.mockReset();
    apiGetMock.mockReset();
    Object.defineProperty(window, "scrollTo", { writable: true, value: vi.fn() });
    apiGetMock.mockResolvedValue({ data: { data: [] } });
    createPetitionMock.mockResolvedValue({
      _id: "p1",
      petitionNo: "P-1",
      dept: "production",
      status: "sampleSent",
      submittedBy: { name: "สมชาย", submittedAt: "2026-08-01T00:00:00.000Z" },
      items: [{ seq: 1, sampleName: "สินค้า A", commonName: "สาร A", batchNo: "B2", productionDate: "2026-08-01", sampleId: "S1" }],
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    });
  });

  it("does not show QR label preview immediately after save", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /บันทึก/ }));

    await screen.findByText("บันทึกคำขอสำเร็จ");
    expect(screen.queryByText("Preview สติกเกอร์")).not.toBeInTheDocument();
    await waitFor(() => expect(createPetitionMock).toHaveBeenCalledTimes(1));
  });
});
