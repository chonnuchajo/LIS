import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    items: [{ seq: 1, sampleName: "Sample A", commonName: "ABAMECTIN 1.8% W/V EC", batchNo: "BATCH-002", lotNo: "LOT-88", sampleId: "sample-1" }],
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
    downloadPrintPdf: vi.fn(),
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
  api: {
    getParameters: mocks.getParameters,
    getQCProgress: mocks.getQCProgress,
    getQCResults: mocks.getQCResults,
    downloadPrintPdf: mocks.downloadPrintPdf,
  },
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
  Object.assign(mocks.petition, {
    status: "inProgress",
    approvedAt: null,
    qcReceivedBy: undefined,
    labReceivedBy: undefined,
    items: [{ seq: 1, sampleName: "Sample A", commonName: "ABAMECTIN 1.8% W/V EC", batchNo: "BATCH-002", lotNo: "LOT-88", sampleId: "sample-1" }],
  });
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
  mocks.downloadPrintPdf.mockResolvedValue(new Blob(["pdf"], { type: "application/pdf" }));
});

describe("PetitionTimelineDetailPage", () => {
  it("renders one petition's header, required task progress, and same-day timeline", async () => {
    renderDetail();

    expect(await screen.findByRole("heading", { name: "P-2607-001" })).toBeInTheDocument();
    expect(await screen.findByText("50%")).toBeInTheDocument();
    expect(screen.getByText("08:00")).toBeInTheDocument();
    expect(screen.getByText("17:00")).toBeInTheDocument();
    expect(screen.queryByText("20:00")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Tasks")).toHaveTextContent("Required checks");
    expect(screen.getByLabelText("petition timeline")).not.toHaveTextContent("Required checks");
  });

  it("shows petition and item details instead of requester and assignee metrics", async () => {
    renderDetail();

    expect(await screen.findByRole("heading", { name: "P-2607-001" })).toBeInTheDocument();
    expect(screen.getByLabelText("เลขคำขอ")).toHaveTextContent("P-2607-001");
    expect(document.querySelector("header")).not.toHaveTextContent("Timeline");
    expect(document.querySelector("header")).not.toHaveTextContent("P-2607-001");
    expect(screen.getByText("คำร้องโดย Requester · ผู้รับผิดชอบ Analyst")).toBeInTheDocument();
    expect(screen.getByText("ABAMECTIN 1.8% W/V EC")).toBeInTheDocument();
    expect(screen.getByText("BATCH-002")).toBeInTheDocument();
    expect(screen.queryByText("Lot")).not.toBeInTheDocument();
    expect(screen.queryByText("LOT-88")).not.toBeInTheDocument();
    expect(screen.queryByText("ผู้ยื่นคำร้อง")).not.toBeInTheDocument();
    expect(screen.queryByText("ผู้รับงาน")).not.toBeInTheDocument();
  });

  it("keeps timeline panels in the required desktop and mobile order", async () => {
    renderDetail();

    expect(await screen.findByRole("heading", { name: "P-2607-001" })).toBeInTheDocument();
    const timelineCard = screen.getByLabelText("petition timeline");
    const tasksCard = screen.getByLabelText("Tasks");
    const activityCard = screen.getByLabelText("Recent Activity");
    const documentsCard = screen.getByLabelText("Documents");

    const panelGrid = document.querySelector(".xl\\:grid-cols-\\[minmax\\(0\\,1fr\\)_260px\\]");
    expect(panelGrid).toBeInTheDocument();
    expect(panelGrid).toHaveClass("2xl:grid-cols-[minmax(0,1fr)_320px]");
    const columns = Array.from(panelGrid?.children ?? []);
    expect(columns).toHaveLength(2);
    expect(Array.from(columns[0]?.children ?? [])).toEqual([timelineCard, tasksCard]);
    expect(Array.from(columns[1]?.children ?? [])).toEqual([activityCard, documentsCard]);
  });

  it("fits the project timeline panel without horizontal scrolling", async () => {
    renderDetail();

    const timelineCard = await screen.findByLabelText("petition timeline");
    expect(timelineCard.querySelector(".overflow-x-auto")).not.toBeInTheDocument();
    expect(Array.from(timelineCard.querySelectorAll("[class]")).some((node) => (node.getAttribute("class") ?? "").includes("min-w-[760px]"))).toBe(false);
  });

  it("reduces dense timeline tick labels before the wide desktop breakpoint", async () => {
    renderDetail();

    expect(await screen.findByText("16:00")).toHaveClass("hidden", "2xl:block");
    expect(screen.getByText("17:00")).not.toHaveClass("hidden");
  });

  it("shows day tabs for project timelines that span multiple days", async () => {
    Object.assign(mocks.petition, {
      qcReceivedAt: "2026-07-12T03:00:00.000Z",
      firstResultAt: "2026-07-13T02:00:00.000Z",
    });
    renderDetail();

    expect(await screen.findByRole("tab", { name: "12 ก.ค." })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "13 ก.ค." }));
    expect(screen.getByRole("tab", { name: "13 ก.ค." })).toHaveAttribute("aria-selected", "true");
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

    expect(await screen.findByRole("button", { name: "ป้ายนำส่งตัวอย่าง" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ใบคำขอรับบริการ" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Final Report" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pre Report" })).not.toBeInTheDocument();
  });

  it("does not show Pre Report before all required fields are recorded", async () => {
    Object.assign(mocks.petition, { status: "success" });
    renderDetail();

    expect(await screen.findByRole("heading", { name: "P-2607-001" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pre Report" })).not.toBeInTheDocument();
  });

  it("shows Pre Report after all required fields are recorded before final approval", async () => {
    Object.assign(mocks.petition, { status: "success" });
    mocks.getQCProgress.mockResolvedValue({
      "petition-1": [{ itemSeq: 1, parameterId: "parameter-1", filledLabels: ["Viscosity", "Color"] }],
    });
    renderDetail();

    expect(await screen.findByRole("button", { name: "Pre Report" })).toBeInTheDocument();
  });

  it("keeps the sample label document available after QC receives the sample", async () => {
    Object.assign(mocks.petition, { qcReceivedBy: "QC Receiver" });
    renderDetail();

    expect(await screen.findByRole("button", { name: "ป้ายนำส่งตัวอย่าง" })).toBeInTheDocument();
  });

  it("keeps document actions disabled until document data is ready", async () => {
    let resolveResults: ((value: []) => void) | undefined;
    mocks.getQCResults.mockReturnValue(new Promise((resolve) => { resolveResults = resolve; }));
    renderDetail();

    const labelButton = await screen.findByRole("button", { name: "ป้ายนำส่งตัวอย่าง" });
    expect(mocks.getQCResults).toHaveBeenCalledOnce();
    expect(labelButton).toBeDisabled();

    await act(async () => {
      resolveResults?.([]);
    });
    await waitFor(() => expect(labelButton).not.toBeDisabled());

    fireEvent.click(labelButton);
    expect(await screen.findByTestId("print-preview")).toBeInTheDocument();
  });

  it("opens timeline document actions in a print preview popup", async () => {
    renderDetail();

    const documentsCard = await screen.findByLabelText("Documents");
    await waitFor(() => expect(screen.getByRole("button", { name: "ป้ายนำส่งตัวอย่าง" })).not.toBeDisabled());
    expect(screen.queryByTestId("print-preview")).not.toBeInTheDocument();

    fireEvent.click(documentsCard.querySelector("button") as HTMLButtonElement);

    const preview = await screen.findByTestId("print-preview");
    expect(preview).toHaveTextContent("P-2607-001");
    expect(mocks.downloadPrintPdf).not.toHaveBeenCalled();
  });

  it("แสดงจุดรับตัวอย่างแยก QC/Lab และไม่มีแถวสถานะเก่าอีกต่อไป", async () => {
    renderDetail();

    expect(await screen.findByRole("heading", { name: "P-2607-001" })).toBeInTheDocument();
    const timelineCard = screen.getByLabelText("petition timeline");
    expect(timelineCard).toHaveTextContent("QC รับตัวอย่าง");
    expect(timelineCard).not.toHaveTextContent("QC ครบ");
    expect(timelineCard).not.toHaveTextContent("Lab ครบ");
    expect(timelineCard).not.toHaveTextContent("บันทึกผล");
  });

  it("จุด milestone ไม่ลากเส้นยาวมาจากขอบซ้ายของแถว", async () => {
    renderDetail();

    const dot = await screen.findByLabelText("QC รับตัวอย่าง (จุด)");
    expect(dot.parentElement?.children).toHaveLength(1);
  });

  const twoItems = [
    { seq: 1, sampleName: "Sample A", commonName: "ABAMECTIN 1.8% W/V EC", batchNo: "BATCH-002", lotNo: "LOT-88", sampleId: "sample-1" },
    { seq: 2, sampleName: "Sample B", commonName: "EMAMECTIN 1.9% EC", batchNo: "BATCH-003", lotNo: "LOT-99", sampleId: "sample-2" },
  ];

  it("ไม่แสดงแถบแท็บตัวอย่างเมื่อคำขอมีตัวอย่างเดียว", async () => {
    renderDetail();

    expect(await screen.findByRole("heading", { name: "P-2607-001" })).toBeInTheDocument();
    expect(screen.queryByRole("tablist", { name: "ตัวอย่างในคำขอ" })).not.toBeInTheDocument();
  });

  it("แสดงแท็บตัวอย่างชื่อ commonName เมื่อคำขอมีหลายตัวอย่าง", async () => {
    Object.assign(mocks.petition, { items: twoItems });
    renderDetail();

    expect(await screen.findByRole("tab", { name: "ABAMECTIN 1.8% W/V EC" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "EMAMECTIN 1.9% EC" })).toHaveAttribute("aria-selected", "false");
  });

  it("สลับแท็บแล้ว Metric และการ์ด Tasks เปลี่ยนตามตัวอย่างที่เลือก", async () => {
    Object.assign(mocks.petition, { items: twoItems });
    mocks.getQCProgress.mockResolvedValue({
      "petition-1": [
        { itemSeq: 1, parameterId: "parameter-1", filledLabels: ["Viscosity"] },
        { itemSeq: 2, parameterId: "parameter-1", filledLabels: [] },
      ],
    });
    renderDetail();

    // อย่าใช้ getByText(commonName) — ชื่อสารโผล่ทั้งในปุ่มแท็บและใน Metric จะได้ 2 element
    expect(await screen.findByRole("tab", { name: "ABAMECTIN 1.8% W/V EC" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("BATCH-002")).toBeInTheDocument();
    expect(screen.getByLabelText("Tasks")).toHaveTextContent("Sample A");
    expect(screen.getByLabelText("Tasks")).not.toHaveTextContent("Sample B");

    fireEvent.click(screen.getByRole("tab", { name: "EMAMECTIN 1.9% EC" }));

    expect(screen.getByRole("tab", { name: "EMAMECTIN 1.9% EC" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("BATCH-003")).toBeInTheDocument();
    expect(screen.queryByText("BATCH-002")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Tasks")).toHaveTextContent("Sample B");
    expect(screen.getByLabelText("Tasks")).not.toHaveTextContent("Sample A");
  });

  it("ยังไม่ให้ปุ่ม Pre Report เมื่อตัวอย่างที่เลือกกรอกครบ แต่ตัวอย่างอื่นยังไม่ครบ", async () => {
    Object.assign(mocks.petition, { status: "success", items: twoItems });
    mocks.getQCProgress.mockResolvedValue({
      "petition-1": [
        { itemSeq: 1, parameterId: "parameter-1", filledLabels: ["Viscosity", "Color"] },
        { itemSeq: 2, parameterId: "parameter-1", filledLabels: [] },
      ],
    });
    renderDetail();

    expect(await screen.findByRole("tab", { name: "ABAMECTIN 1.8% W/V EC" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pre Report" })).not.toBeInTheDocument();
  });
});
