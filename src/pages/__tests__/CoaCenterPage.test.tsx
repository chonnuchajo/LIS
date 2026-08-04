import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import CoaCenterPage from "../CoaCenterPage";

vi.mock("@/components/lis/AppLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: {
      name: "Lab User",
      email: "lab@example.com",
      role: "lab-staff",
      roles: ["lab-staff"],
      permissions: [],
    },
  }),
}));
vi.mock("@/lib/api", () => ({
  api: {
    getCoaDocuments: vi.fn().mockResolvedValue({
      items: [
        {
          _id: "c1",
          coaNo: "00012026",
          revision: 0,
          status: "approved",
          petitionId: "p1",
          petitionNoSnapshot: "P-2608-0001",
          selectedItemSeqs: [1],
          sampleSnapshots: [{ itemSeq: 1, sampleName: "Sample A" }],
          resultSnapshots: [],
          print: { printCount: 0 },
        },
      ],
    }),
    getEligibleCoaPetitions: vi.fn().mockResolvedValue({ items: [] }),
  },
}));

describe("CoaCenterPage", () => {
  it("renders COA list and create action", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <CoaCenterPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("ออกเอกสาร COA")).toBeInTheDocument();
    expect(await screen.findByText("00012026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /สร้าง COA/ })).toBeInTheDocument();
  });
});
