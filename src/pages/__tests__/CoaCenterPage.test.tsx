import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
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
          createdAt: new Date().toISOString(),
        },
        {
          _id: "c2",
          coaNo: "00022026",
          revision: 0,
          status: "approved",
          petitionId: "p2",
          petitionNoSnapshot: "P-2608-0002",
          selectedItemSeqs: [1],
          sampleSnapshots: [{ itemSeq: 1, sampleName: "Sample B" }],
          resultSnapshots: [],
          print: { printCount: 0 },
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
    }),
    getEligibleCoaPetitions: vi.fn().mockResolvedValue({ items: [] }),
  },
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CoaCenterPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("CoaCenterPage", () => {
  it("renders COA list and create action", async () => {
    const { container } = renderPage();

    expect(await screen.findByText("ออกเอกสาร COA")).toBeInTheDocument();
    expect(await screen.findByText("00012026")).toBeInTheDocument();
    expect(container.querySelector(".bg-sky-50")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /สร้าง COA/ })).toBeInTheDocument();
  });

  it("defaults to today's COA requests and can switch to all requests", async () => {
    renderPage();

    expect(await screen.findByText("00012026")).toBeInTheDocument();
    expect(screen.queryByText("00022026")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /คำขอ COA ทั้งหมด/ }));

    expect(await screen.findByText("00022026")).toBeInTheDocument();
  });
});
