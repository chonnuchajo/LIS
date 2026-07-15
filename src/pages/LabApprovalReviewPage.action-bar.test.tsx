import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import LabApprovalReviewPage from "./LabApprovalReviewPage";

vi.mock("@/components/lis/AppLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

vi.mock("@/components/lis/PageHeader", () => ({
  default: ({ title, actions }: { title: React.ReactNode; actions?: React.ReactNode }) => (
    <header>
      <h1>{title}</h1>
      {actions}
    </header>
  ),
}));

vi.mock("@/hooks/usePetition", () => ({
  usePetition: () => ({
    data: {
      _id: "p1",
      petitionNo: "P-2607-0002",
      dept: "rm",
      status: "inProgress",
      submittedBy: { name: "Requester A", submittedAt: "2026-07-13T00:00:00.000Z" },
      items: [{ seq: 1, sampleName: "Sample A", batchNo: "RM-1", sampleId: "S-1" }],
      createdAt: "2026-07-13T00:00:00.000Z",
      updatedAt: "2026-07-13T00:00:00.000Z",
    },
    loading: false,
    error: null,
  }),
  useLabRequestsByPetition: () => ({
    data: [],
    refresh: vi.fn(),
  }),
  saveLabAgreementReview: vi.fn(async () => ({})),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { name: "Lab Head", roles: ["lab-head"] } }),
}));

vi.mock("@/context/ConfirmDialog", () => ({
  useConfirm: () => vi.fn(async () => true),
  releaseBodyPointerLock: vi.fn(),
}));

vi.mock("@/hooks/useCanAccessPath", () => ({
  useCanAccessPath: () => (path: string) => path === "/lab-approval",
}));

vi.mock("@/hooks/useItemGroupMembership", () => ({
  useItemGroupMembership: () => new Map(),
}));

vi.mock("@/lib/api", () => ({
  api: {
    getParameters: vi.fn(async () => []),
    getQCResults: vi.fn(async () => []),
    getAbnormalFlags: vi.fn(async () => ({ p1: false })),
    labApprovePetition: vi.fn(async () => ({})),
    labRejectPetition: vi.fn(async () => ({})),
  },
}));

vi.mock("@/lib/qcApprovalRows", () => ({
  buildApprovalGroups: () => [],
}));

vi.mock("@/components/petition/LabResultGroups", () => ({
  default: () => <section aria-label="lab result groups" />,
}));

vi.mock("@/components/review/LabAgreementReviewDialog", () => ({
  default: () => null,
}));

vi.mock("@/components/review/LabAgreementReviewView", () => ({
  default: () => <section aria-label="lab agreement review" />,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/lab-approval/p1"]}>
      <Routes>
        <Route path="/lab-approval/:id" element={<LabApprovalReviewPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("LabApprovalReviewPage action bar", () => {
  it("keeps the fixed decision bar above TV overscan at the viewport bottom", async () => {
    renderPage();

    const approveButton = await screen.findByRole("button", { name: /^ออกผล Lab$/ });
    const actionBar = approveButton.closest(".fixed");

    expect(actionBar).not.toBeNull();
    expect(actionBar).toHaveClass("bottom-3");
    expect(actionBar).not.toHaveClass("bottom-0");
    expect(actionBar).toHaveClass("pb-[calc(env(safe-area-inset-bottom)+0.75rem)]");
    expect(screen.queryByRole("button", { name: /ส่งกลับให้แก้/ })).not.toBeInTheDocument();
  });
});
