import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ParameterItem, QCProgressMap } from "@/lib/api";
import type { Petition, PetitionAuditLogEntry } from "@/types/petition.types";
import PetitionTimelineDetailPage from "./PetitionTimelineDetailPage";

const at = (hour: number, minute = 0) => new Date(2026, 6, 13, hour, minute).toISOString();

const mocks = vi.hoisted(() => {
  const petition: Petition = {
    _id: "petition-1",
    petitionNo: "P-2607-001",
    dept: "production",
    status: "inProgress",
    submittedBy: { name: "Requester", submittedAt: "2026-07-13T01:00:00.000Z" },
    assignedTo: { employeeId: "E001", name: "Analyst", assignedAt: "2026-07-13T04:00:00.000Z" },
    qcReceivedAt: "2026-07-13T03:00:00.000Z",
    items: [{ seq: 1, sampleName: "Sample A", batchNo: "BATCH-002", sampleId: "sample-1" }],
    createdAt: "2026-07-13T01:00:00.000Z",
    updatedAt: "2026-07-13T01:00:00.000Z",
  } as Petition;
  const parameter: ParameterItem = {
    _id: "parameter-1",
    name: "Required checks",
    scope: "qc",
    status: "active",
    applyAll: true,
    valueFields: [
      { label: "Viscosity", type: "number", required: true },
      { label: "Color", type: "text", required: true },
    ],
  };
  return {
    petition,
    parameter,
    user: { employeeId: "E001", name: "Analyst", roles: ["admin"] },
    auditLogs: [{
      _id: "audit-1",
      petitionId: "petition-1",
      petitionNo: "P-2607-001",
      event: "resultEntered",
      actor: "Analyst",
      metadata: { parameterName: "Required checks" },
      createdAt: "2026-07-13T05:00:00.000Z",
    }] as PetitionAuditLogEntry[],
    getParameters: vi.fn<() => Promise<ParameterItem[]>>(),
    getQCProgress: vi.fn<() => Promise<QCProgressMap>>(),
    getQCResults: vi.fn(),
    refreshPetition: vi.fn(),
    refreshAudit: vi.fn(),
    activityError: null as string | null,
    labRequests: [] as Array<{ _id: string }>,
  };
});

vi.mock("@/components/lis/AppLayout", () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/lis/PageHeader", () => ({
  default: ({ title, onBack, actions }: { title: ReactNode; onBack?: () => void; actions?: ReactNode }) => (
    <header><button type="button" onClick={onBack}>Back</button><h1>{title}</h1>{actions}</header>
  ),
}));
vi.mock("@/components/lis/PrintPreviewDialog", () => ({
  default: ({ children }: { children: ReactNode }) => <div data-testid="print-preview">{children}</div>,
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("@/hooks/useItemGroupMembership", () => ({ useItemGroupMembership: () => new Map() }));
vi.mock("@/hooks/usePetition", () => ({
  usePetition: () => ({ data: mocks.petition, loading: false, error: null, refresh: mocks.refreshPetition }),
  usePetitionAuditLog: () => ({ data: mocks.auditLogs, loading: false, error: mocks.activityError, refresh: mocks.refreshAudit }),
  useLabRequestsByPetition: () => ({ data: mocks.labRequests, loading: false, error: null, refresh: vi.fn() }),
}));
vi.mock("@/lib/api", () => ({
  api: { getParameters: mocks.getParameters, getQCProgress: mocks.getQCProgress, getQCResults: mocks.getQCResults },
}));

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={["/petition-timeline/petition-1"]} future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <Routes><Route path="/petition-timeline/:id" element={<PetitionTimelineDetailPage />} /></Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { employeeId: "E001", name: "Analyst", roles: ["admin"] };
  mocks.activityError = null;
  mocks.labRequests = [];
  Object.assign(mocks.petition, { status: "inProgress", approvedAt: null, qcReceivedBy: undefined, labReceivedBy: undefined });
  mocks.parameter = {
    _id: "parameter-1",
    name: "Required checks",
    scope: "qc",
    status: "active",
    applyAll: true,
    valueFields: [
      { label: "Viscosity", type: "number", required: true },
      { label: "Color", type: "text", required: true },
    ],
  };
  mocks.getParameters.mockResolvedValue([mocks.parameter]);
  mocks.getQCProgress.mockResolvedValue({ "petition-1": [{ itemSeq: 1, parameterId: "parameter-1", filledLabels: ["Viscosity"] }] });
  mocks.getQCResults.mockResolvedValue([]);
});

describe("PetitionTimelineDetailPage", () => {
  it("renders one petition's header, required task progress, and same-day timeline", async () => {
    renderDetail();

    expect(await screen.findByRole("heading", { name: "P-2607-001" })).toBeInTheDocument();
    expect(await screen.findByText("50%")).toBeInTheDocument();
    expect(screen.getByText("08:00")).toBeInTheDocument();
    expect(screen.getByText("20:00")).toBeInTheDocument();
    expect(screen.getByText("Required checks")).toBeInTheDocument();
  });

  it("keeps timeline panels in the required desktop and mobile order", async () => {
    renderDetail();

    expect(await screen.findByRole("heading", { name: "P-2607-001" })).toBeInTheDocument();
    const timelineCard = screen.getByLabelText("Project Timeline");
    const tasksCard = screen.getByLabelText("Tasks");
    const activityCard = screen.getByLabelText("Recent Activity");
    const documentsCard = screen.getByLabelText("Documents");

    const panelGrid = document.querySelector(".xl\\:grid-cols-\\[minmax\\(0\\,1fr\\)_320px\\]");
    expect(panelGrid).toBeInTheDocument();
    const columns = Array.from(panelGrid?.children ?? []);
    expect(columns).toHaveLength(2);
    expect(Array.from(columns[0]?.children ?? [])).toEqual([timelineCard, tasksCard]);
    expect(Array.from(columns[1]?.children ?? [])).toEqual([activityCard, documentsCard]);
  });

  it("retries activity loading without blanking header and task panels", async () => {
    mocks.activityError = "network";
    renderDetail();

    expect(await screen.findByText(/โหลดกิจกรรมไม่สำเร็จ/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ลองใหม่" }));
    expect(mocks.refreshAudit).toHaveBeenCalledOnce();
    expect(screen.getByRole("heading", { name: "P-2607-001" })).toBeInTheDocument();
  });

  it("reloads task data when its retry action is selected", async () => {
    mocks.getParameters
      .mockRejectedValueOnce(new Error("parameters unavailable"))
      .mockResolvedValueOnce([mocks.parameter]);
    renderDetail();

    expect(await screen.findByText(/โหลดข้อมูลงานไม่สำเร็จ/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ลองใหม่" }));

    await waitFor(() => expect(mocks.getParameters).toHaveBeenCalledTimes(2));
    expect(mocks.getQCProgress).toHaveBeenCalledTimes(2);
  });

  it("does not render Lab-only tasks while parameter visibility is unresolved", async () => {
    mocks.user = { employeeId: "L001", name: "Lab", roles: ["lab"] };
    mocks.parameter = {
      ...mocks.parameter,
      name: "Lab-only required parameter",
      scope: "lab",
    };
    mocks.getParameters.mockReturnValue(new Promise<ParameterItem[]>(() => {}));
    renderDetail();

    expect(await screen.findByText(/กำลังโหลดข้อมูล Timeline/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "P-2607-001" })).not.toBeInTheDocument();
    expect(screen.queryByText("Lab-only required parameter")).not.toBeInTheDocument();
  });

  it("shows the same eligible document actions as the petition detail page", async () => {
    Object.assign(mocks.petition, { status: "approved", approvedAt: "2026-07-13T08:00:00.000Z" });
    mocks.labRequests = [{ _id: "lab-request-1" }];
    renderDetail();

    expect(await screen.findByRole("button", { name: "พิมพ์ฉลาก" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "พิมพ์ใบคำขอรับบริการ" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Final Report" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pre Report" })).not.toBeInTheDocument();
  });

  it("keeps the sample label document available after QC receives the sample", async () => {
    Object.assign(mocks.petition, { qcReceivedBy: "QC Receiver" });
    renderDetail();

    expect(await screen.findByRole("button", { name: "พิมพ์ฉลาก" })).toBeInTheDocument();
  });

  it("waits for document data before opening a print preview", async () => {
    let resolveResults: ((value: []) => void) | undefined;
    mocks.getQCResults.mockReturnValue(new Promise((resolve) => { resolveResults = resolve; }));
    renderDetail();

    fireEvent.click(await screen.findByRole("button", { name: "พิมพ์ฉลาก" }));
    expect(mocks.getQCResults).toHaveBeenCalledOnce();
    expect(screen.queryByTestId("print-preview")).not.toBeInTheDocument();

    resolveResults?.([]);
    expect(await screen.findByTestId("print-preview")).toBeInTheDocument();
  });
});
