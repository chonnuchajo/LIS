import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import CoaDetailPage from "../CoaDetailPage";

vi.mock("@/components/lis/AppLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/lis/PrintPreviewDialog", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/lib/api", () => ({
  api: {
    getCoaDocument: vi.fn().mockResolvedValue({
      _id: "c1",
      coaNo: null,
      revision: 0,
      status: "pendingApproval",
      petitionId: "p1",
      petitionNoSnapshot: "P-2608-0001",
      selectedItemSeqs: [1],
      customerSnapshot: { name: "Customer A" },
      sampleSnapshots: [{ itemSeq: 1, sampleName: "Sample A" }],
      resultSnapshots: [{ itemSeq: 1, testItem: "pH", result: "7.0" }],
      audit: [],
    }),
  },
}));

describe("CoaDetailPage", () => {
  it("disables print before approval", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/coa/c1"]}>
          <Routes><Route path="/coa/:id" element={<CoaDetailPage />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("P-2608-0001")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /พิมพ์ COA/ })).toBeDisabled();
  });
});
