import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CoaDetailPage from "../CoaDetailPage";

const mocks = vi.hoisted(() => ({
  user: null as Record<string, unknown> | null,
  getCoaDocument: vi.fn(),
  submitCoaDocument: vi.fn(),
  approveCoaDocument: vi.fn(),
  rejectCoaDocument: vi.fn(),
  reviseCoaDocument: vi.fn(),
  cancelCoaDocument: vi.fn(),
  recordCoaPrintEvent: vi.fn(),
}));

vi.mock("@/components/lis/AppLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/lis/PrintPreviewDialog", () => ({
  default: ({ children, onPrinted, open }: { children: React.ReactNode; open: boolean; onPrinted?: (meta: { copies: number; outputMode: "local" | "server" }) => void }) => (
    <div>{children}{open && <button onClick={() => onPrinted?.({ copies: 2, outputMode: "local" })}>Complete print</button>}</div>
  ),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("@/lib/api", () => ({
  api: {
    getCoaDocument: mocks.getCoaDocument,
    submitCoaDocument: mocks.submitCoaDocument,
    approveCoaDocument: mocks.approveCoaDocument,
    rejectCoaDocument: mocks.rejectCoaDocument,
    reviseCoaDocument: mocks.reviseCoaDocument,
    cancelCoaDocument: mocks.cancelCoaDocument,
    recordCoaPrintEvent: mocks.recordCoaPrintEvent,
  },
}));

function documentWith(status: string) {
  return {
    _id: "c1",
    coaNo: status === "draft" ? null : "00012026",
    revision: 0,
    status,
    petitionId: "p1",
    petitionNoSnapshot: "P-2608-0001",
    selectedItemSeqs: [1],
    customerSnapshot: { name: "Customer A" },
    sampleSnapshots: [{ itemSeq: 1, sampleName: "Sample A" }],
    resultSnapshots: [{ itemSeq: 1, testItem: "pH", result: "7.0" }],
    audit: [],
  };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/coa/c1"]}>
        <Routes><Route path="/coa/:id" element={<CoaDetailPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const qcHead = {
  name: "QC Head",
  email: "qc@example.com",
  role: "qc-head",
  roles: ["qc-head", "qc-staff"],
  permissions: ["coa.approve"],
  position: "QC Head",
};

beforeEach(() => {
  mocks.user = { name: "QC Staff", email: "staff@example.com", role: "qc-staff", roles: ["qc-staff"], permissions: [], position: "QC Staff" };
  mocks.getCoaDocument.mockResolvedValue(documentWith("pendingApproval"));
  mocks.submitCoaDocument.mockResolvedValue(documentWith("pendingApproval"));
  mocks.approveCoaDocument.mockResolvedValue(documentWith("approved"));
  mocks.rejectCoaDocument.mockResolvedValue(documentWith("rejected"));
  mocks.reviseCoaDocument.mockResolvedValue({ _id: "c2" });
  mocks.cancelCoaDocument.mockResolvedValue(documentWith("cancelled"));
  mocks.recordCoaPrintEvent.mockResolvedValue(documentWith("printed"));
});

describe("CoaDetailPage", () => {
  it("disables print before approval", async () => {
    renderPage();

    expect(await screen.findByText("P-2608-0001")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /พิมพ์ COA/ })).toBeDisabled();
  });

  it("does not show approval actions to a non-QC Head", async () => {
    renderPage();

    await screen.findByText("P-2608-0001");
    expect(screen.queryByRole("button", { name: /QC Head อนุมัติ/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ไม่อนุมัติ" })).not.toBeInTheDocument();
  });

  it("does not treat an unselected QC Head role as an approval grant", async () => {
    mocks.user = { ...qcHead, role: "qc-staff", permissions: [], position: "QC Staff" };
    renderPage();

    await screen.findByText("P-2608-0001");
    expect(screen.queryByRole("button", { name: /QC Head อนุมัติ/ })).not.toBeInTheDocument();
  });

  it("does not treat a QC Head position without an approval signal as an approval grant", async () => {
    mocks.user = { name: "QC Staff", email: "staff@example.com", role: "qc-staff", roles: ["qc-staff"], permissions: [], position: "QC Head" };
    renderPage();

    await screen.findByText("P-2608-0001");
    expect(screen.queryByRole("button", { name: /QC Head อนุมัติ/ })).not.toBeInTheDocument();
  });

  it("shows approval actions for the coa.approve permission", async () => {
    mocks.user = { name: "QC Approver", email: "approver@example.com", role: "qc-staff", roles: ["qc-staff"], permissions: ["coa.approve"], position: "QC Staff" };
    renderPage();

    expect(await screen.findByRole("button", { name: /QC Head อนุมัติ/ })).toBeInTheDocument();
  });

  it("shows approval actions for the active QC Head role without approval permissions", async () => {
    mocks.user = { name: "QC Head", email: "qc@example.com", role: "qc-head", roles: ["qc-head", "qc-staff"], permissions: [], position: "QC Staff" };
    renderPage();

    expect(await screen.findByRole("button", { name: /QC Head อนุมัติ/ })).toBeInTheDocument();
  });

  it("shows QC Head approval actions and sends the authenticated actor", async () => {
    mocks.user = qcHead;
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /QC Head อนุมัติ/ }));

    await waitFor(() => expect(mocks.approveCoaDocument).toHaveBeenCalledWith("c1", {
      _user: { ...qcHead, activeRole: "qc-head" },
    }));
    expect(screen.getByRole("button", { name: "ไม่อนุมัติ" })).toBeInTheDocument();
  });

  it("sends the authenticated actor when submitting", async () => {
    mocks.getCoaDocument.mockResolvedValue(documentWith("draft"));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "ส่งอนุมัติ" }));

    await waitFor(() => expect(mocks.submitCoaDocument).toHaveBeenCalledWith("c1", {
      _user: { ...mocks.user, activeRole: "qc-staff" },
    }));
  });

  it("records successful print events with the authenticated actor", async () => {
    mocks.getCoaDocument.mockResolvedValue(documentWith("approved"));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /พิมพ์ COA/ }));
    fireEvent.click(screen.getByRole("button", { name: "Complete print" }));

    await waitFor(() => expect(mocks.recordCoaPrintEvent).toHaveBeenCalledWith("c1", {
      event: "printDialogOpened",
      copies: 2,
      outputMode: "local",
      _user: { ...mocks.user, activeRole: "qc-staff" },
    }));
  });

  it("requires a reason before rejecting and sends it with the authenticated actor", async () => {
    mocks.user = qcHead;
    renderPage();

    const reject = await screen.findByRole("button", { name: "ไม่อนุมัติ" });
    expect(reject).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText(/เหตุผล/), { target: { value: "  ผลไม่ผ่าน  " } });
    expect(reject).toBeEnabled();
    fireEvent.click(reject);

    await waitFor(() => expect(mocks.rejectCoaDocument).toHaveBeenCalledWith("c1", {
      reason: "  ผลไม่ผ่าน  ",
      _user: { ...qcHead, activeRole: "qc-head" },
    }));
  });

  it("requires a reason before cancelling and sends it with the authenticated actor", async () => {
    mocks.user = qcHead;
    mocks.getCoaDocument.mockResolvedValue(documentWith("approved"));
    renderPage();

    const cancel = await screen.findByRole("button", { name: "ยกเลิก COA" });
    expect(cancel).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText(/เหตุผล/), { target: { value: "ยกเลิกตามคำขอลูกค้า" } });
    expect(cancel).toBeEnabled();
    fireEvent.click(cancel);

    await waitFor(() => expect(mocks.cancelCoaDocument).toHaveBeenCalledWith("c1", {
      reason: "ยกเลิกตามคำขอลูกค้า",
      _user: { ...qcHead, activeRole: "qc-head" },
    }));
  });
});
