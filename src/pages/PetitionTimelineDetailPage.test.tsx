import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
      { label: "Photo evidence", type: "photo", required: true },
      { label: "Optional note", type: "text", required: false },
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

function selectFirstTimelineDayTab() {
  const timelineTablist = screen.queryByRole("tablist", { name: "Timeline days" });
  const firstDayTab = timelineTablist
    ? within(timelineTablist).queryAllByRole("tab").find((tab) => tab.textContent !== "ภาพรวม")
    : null;
  if (firstDayTab) fireEvent.click(firstDayTab);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 6, 13, 18, 0, 0));
  vi.clearAllMocks();
  mocks.user = { employeeId: "E001", name: "Analyst", roles: ["admin"] };
  mocks.activityError = null;
  mocks.labRequests = [];
  Object.assign(mocks.petition, {
    status: "inProgress",
    approvedAt: null,
    submittedBy: { name: "Requester", submittedAt: "2026-07-13T01:00:00.000Z" },
    assignedTo: { employeeId: "E001", name: "Analyst", assignedAt: "2026-07-13T04:00:00.000Z" },
    qcReceivedAt: "2026-07-13T03:00:00.000Z",
    qcCompletedAt: undefined,
    qcReceivedBy: undefined,
    labReceivedBy: undefined,
    labCompletedAt: undefined,
    labApprovedAt: undefined,
    firstResultAt: undefined,
    items: [{ seq: 1, sampleName: "Sample A", commonName: "ABAMECTIN 1.8% W/V EC", batchNo: "BATCH-002", lotNo: "LOT-88", sampleId: "sample-1" }],
    createdAt: "2026-07-13T01:00:00.000Z",
    updatedAt: "2026-07-13T01:00:00.000Z",
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
      { label: "Photo evidence", type: "photo", required: true },
      { label: "Optional note", type: "text", required: false },
    ],
  };
  mocks.getParameters.mockResolvedValue([mocks.parameter]);
  mocks.getQCProgress.mockResolvedValue({ "petition-1": [{ itemSeq: 1, parameterId: "parameter-1", filledLabels: ["Viscosity"] }] });
  mocks.getQCResults.mockResolvedValue([]);
  mocks.downloadPrintPdf.mockResolvedValue(new Blob(["pdf"], { type: "application/pdf" }));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PetitionTimelineDetailPage", () => {
  it("renders one petition's header, required task progress, and same-day timeline", async () => {
    renderDetail();

    expect(await screen.findByRole("heading", { name: "P-2607-001" })).toBeInTheDocument();
    expect(await screen.findByText("40%")).toBeInTheDocument();
    expect(screen.queryByText(/required fields/i)).not.toBeInTheDocument();
    const progressBar = screen.getByRole("progressbar", { name: "Progress" });
    expect(progressBar).toHaveAttribute("aria-valuenow", "40");
    expect(progressBar.firstElementChild).toHaveClass("bg-gradient-to-r", "from-red-500", "to-amber-400");
    selectFirstTimelineDayTab();
    expect(screen.getByText("08:00")).toBeInTheDocument();
    expect(screen.getByText("17:00")).toBeInTheDocument();
    expect(screen.queryByText("20:00")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Parameter ที่ต้องตรวจสอบ")).toHaveTextContent("Required checks");
    expect(screen.getByLabelText("Parameter ที่ต้องตรวจสอบ")).toHaveTextContent("1/2");
    expect(screen.getByLabelText("petition timeline")).not.toHaveTextContent("Required checks");
  });

  it("shows a red progress bar up to 33 percent", async () => {
    mocks.getQCProgress.mockResolvedValue({ "petition-1": [{ itemSeq: 1, parameterId: "parameter-1", filledLabels: [] }] });
    renderDetail();

    expect(await screen.findByText("20%")).toBeInTheDocument();
    const progressBar = screen.getByRole("progressbar", { name: "Progress" });
    expect(progressBar).toHaveAttribute("aria-valuenow", "20");
    expect(progressBar.firstElementChild).toHaveClass("bg-red-500");
    expect(progressBar.firstElementChild).not.toHaveClass("bg-gradient-to-r");
  });

  it("shows a progress gradient ending in green at 100 percent", async () => {
    Object.assign(mocks.petition, { status: "approved", approvedAt: "2026-07-13T08:00:00.000Z" });
    renderDetail();

    expect(await screen.findByText("100%")).toBeInTheDocument();
    const progressBar = screen.getByRole("progressbar", { name: "Progress" });
    expect(progressBar).toHaveAttribute("aria-valuenow", "100");
    expect(progressBar.firstElementChild).toHaveClass("bg-gradient-to-r", "from-red-500", "via-amber-400", "to-green-500");
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
    const tasksCard = screen.getByLabelText("Parameter ที่ต้องตรวจสอบ");
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

    expect(await screen.findByRole("heading", { name: "P-2607-001" })).toBeInTheDocument();
    selectFirstTimelineDayTab();
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

  it("shows an overview tab for multi-day timelines and hides inactive rows in daily tabs", async () => {
    Object.assign(mocks.petition, {
      submittedBy: { name: "Requester", submittedAt: "2026-07-12T01:00:00.000Z" },
      createdAt: "2026-07-12T01:00:00.000Z",
      qcReceivedAt: "2026-07-12T03:00:00.000Z",
      qcCompletedAt: "2026-07-13T04:00:00.000Z",
    });
    renderDetail();

    const timelineCard = await screen.findByLabelText("petition timeline");
    expect(screen.getByRole("tab", { name: "ภาพรวม" })).toHaveAttribute("aria-selected", "true");
    expect(timelineCard).toHaveTextContent("ยื่นคำขอ");

    fireEvent.click(screen.getByRole("tab", { name: "13 ก.ค." }));

    expect(screen.getByRole("tab", { name: "13 ก.ค." })).toHaveAttribute("aria-selected", "true");
    expect(timelineCard).toHaveTextContent("QC กำลังวิเคราะห์");
    expect(timelineCard).not.toHaveTextContent("ยื่นคำขอ");
  });

  it("right-aligns overview tick labels near the end so date and end time do not overlap", async () => {
    Object.assign(mocks.petition, {
      status: "success",
      submittedBy: { name: "Requester", submittedAt: "2026-07-13T01:00:00.000Z" },
      createdAt: "2026-07-13T01:00:00.000Z",
      qcReceivedAt: "2026-07-13T03:00:00.000Z",
      qcCompletedAt: "2026-07-14T06:18:00.000Z",
    });
    renderDetail();

    expect(await screen.findByRole("tab", { name: "ภาพรวม" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("14 ก.ค. 08:00")).toHaveClass("right-1");
    expect(screen.getByText("13:18")).toHaveClass("right-1");
  });

  it("hides most overview tick labels and lines across long multi-day timelines", async () => {
    Object.assign(mocks.petition, {
      status: "success",
      submittedBy: { name: "Requester", submittedAt: "2026-06-24T01:00:00.000Z" },
      createdAt: "2026-06-24T01:00:00.000Z",
      qcReceivedAt: "2026-06-24T01:00:00.000Z",
      qcCompletedAt: "2026-07-01T09:39:00.000Z",
    });
    renderDetail();

    expect(await screen.findByRole("tab", { name: "ภาพรวม" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("24 มิ.ย. 08:00")).not.toHaveClass("hidden");
    expect(screen.getByText("25 มิ.ย. 08:00")).toHaveClass("hidden");
    expect(screen.getByText("25 มิ.ย. 08:00").closest("div")).toHaveClass("hidden");
    expect(screen.getByText("01 ก.ค. 08:00")).toHaveClass("hidden");
    expect(screen.getByText("01 ก.ค. 08:00").closest("div")).toHaveClass("hidden");
    expect(screen.getByText("16:39")).not.toHaveClass("hidden");
  });

  it("shows overview day ticks only for days with timeline actions", async () => {
    Object.assign(mocks.petition, {
      status: "success",
      submittedBy: { name: "Requester", submittedAt: "2026-06-24T01:00:00.000Z" },
      createdAt: "2026-06-24T01:00:00.000Z",
      qcReceivedAt: "2026-06-24T01:00:00.000Z",
      qcCompletedAt: "2026-07-02T01:00:00.000Z",
    });
    renderDetail();

    expect(await screen.findByRole("tab", { name: "ภาพรวม" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("24 มิ.ย. 08:00")).toBeInTheDocument();
    expect(screen.queryByText("27 มิ.ย. 08:00")).not.toBeInTheDocument();
    expect(screen.queryByText("30 มิ.ย. 08:00")).not.toBeInTheDocument();
    expect(screen.getByText("02 ก.ค. 08:00")).toBeInTheDocument();
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

    expect(await screen.findByText(/โหลดข้อมูล parameter ไม่สำเร็จ/)).toBeInTheDocument();
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

  it("shows approved document actions with distinct border colors", async () => {
    Object.assign(mocks.petition, { status: "approved", approvedAt: "2026-07-13T08:00:00.000Z" });
    mocks.labRequests = [{ _id: "lab-request-1" }];
    renderDetail();

    await screen.findByRole("button", { name: "Final Report" });
    const documentButtons = Array.from(screen.getByLabelText("Documents").querySelectorAll("button"));
    expect(documentButtons).toHaveLength(3);
    expect(documentButtons[0]).toHaveClass("border-primary-500");
    expect(documentButtons[1]).toHaveClass("border-yellow-500");
    expect(documentButtons[2]).toHaveClass("border-red-500");
  });

  it("shows Pre Report with its own green border color", async () => {
    Object.assign(mocks.petition, {
      qcCompletedAt: "2026-07-13T06:00:00.000Z",
      labCompletedAt: "2026-07-13T07:00:00.000Z",
    });
    mocks.labRequests = [{ _id: "lab-request-1" }];
    mocks.getQCProgress.mockResolvedValue({
      "petition-1": [{ itemSeq: 1, parameterId: "parameter-1", filledLabels: ["Viscosity", "Color"] }],
    });
    renderDetail();

    expect(await screen.findByRole("button", { name: "Pre Report" })).toHaveClass("border-green-500");
  });

  it("does not show Pre Report while in progress before all required fields are recorded", async () => {
    renderDetail();

    expect(await screen.findByRole("heading", { name: "P-2607-001" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pre Report" })).not.toBeInTheDocument();
  });

  it("does not show Pre Report after QC completion until Lab is complete", async () => {
    Object.assign(mocks.petition, { qcCompletedAt: "2026-07-13T06:00:00.000Z" });
    mocks.getQCProgress.mockResolvedValue({
      "petition-1": [{ itemSeq: 1, parameterId: "parameter-1", filledLabels: ["Viscosity", "Color"] }],
    });
    renderDetail();

    expect(await screen.findByRole("heading", { name: "P-2607-001" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pre Report" })).not.toBeInTheDocument();
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

  it("แท่งที่ยังทำไม่เสร็จใช้สีอ่อนและปลายขวาตรง", async () => {
    renderDetail();

    const bar = await screen.findByLabelText("QC กำลังวิเคราะห์ (ช่วงเวลา)");
    expect(bar).toHaveClass("bg-primary-200");
    expect(bar).toHaveClass("rounded-r-none");
    expect(bar).not.toHaveClass("bg-primary-500");
  });

  it("แท่งที่ทำเสร็จแล้วใช้สีเข้มและปลายมน", async () => {
    Object.assign(mocks.petition, { qcCompletedAt: "2026-07-13T06:00:00.000Z" });
    renderDetail();

    const bar = await screen.findByLabelText("QC กำลังวิเคราะห์ (ช่วงเวลา)");
    expect(bar).toHaveClass("bg-primary-500");
    expect(bar).not.toHaveClass("rounded-r-none");
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

  it("สลับแท็บแล้ว Metric และการ์ด Parameter ที่ต้องตรวจสอบเปลี่ยนตามตัวอย่างที่เลือก", async () => {
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
    expect(screen.getByLabelText("Parameter ที่ต้องตรวจสอบ")).toHaveTextContent("Sample A");
    expect(screen.getByLabelText("Parameter ที่ต้องตรวจสอบ")).not.toHaveTextContent("Sample B");

    fireEvent.click(screen.getByRole("tab", { name: "EMAMECTIN 1.9% EC" }));

    expect(screen.getByRole("tab", { name: "EMAMECTIN 1.9% EC" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("BATCH-003")).toBeInTheDocument();
    expect(screen.queryByText("BATCH-002")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Parameter ที่ต้องตรวจสอบ")).toHaveTextContent("Sample B");
    expect(screen.getByLabelText("Parameter ที่ต้องตรวจสอบ")).not.toHaveTextContent("Sample A");
  });

  it("ไม่แสดงปุ่ม Pre Report เมื่อคำร้องทดสอบเสร็จสิ้น แต่ QC และ Lab ยังไม่ complete", async () => {
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

  it("ไม่แสดงปุ่ม Pre Report เมื่อผล Lab ออกแล้วแต่ QC ยังไม่ complete", async () => {
    Object.assign(mocks.petition, {
      status: "inProgress",
      labApprovedAt: "2026-07-13T07:00:00.000Z",
      labCompletedAt: "2026-07-13T06:00:00.000Z",
    });
    renderDetail();

    expect(await screen.findByRole("heading", { name: "P-2607-001" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pre Report" })).not.toBeInTheDocument();
  });

  it("แสดงปุ่ม Pre Report เมื่อ QC และ Lab complete แล้ว", async () => {
    Object.assign(mocks.petition, {
      qcCompletedAt: "2026-07-13T06:00:00.000Z",
      labCompletedAt: "2026-07-13T07:00:00.000Z",
    });
    renderDetail();

    expect(await screen.findByRole("button", { name: "Pre Report" })).toBeInTheDocument();
  });
});

describe("สีประจำแถวของกราฟ timeline", () => {
  it("จุด milestone แต่ละจุดมีสีของตัวเอง ไม่ซ้ำกัน", async () => {
    Object.assign(mocks.petition, {
      labReceivedAt: "2026-07-13T04:30:00.000Z",
      qcCompletedAt: "2026-07-13T05:30:00.000Z",
      labCompletedAt: "2026-07-13T06:00:00.000Z",
      labApprovedAt: "2026-07-13T07:00:00.000Z",
    });
    renderDetail();

    expect(await screen.findByLabelText("ยื่นคำขอ (จุด)")).toHaveClass("bg-violet-500");
    expect(screen.getByLabelText("ส่งตัวอย่าง (จุด)")).toHaveClass("bg-orange-500");
    expect(screen.getByLabelText("QC รับตัวอย่าง (จุด)")).toHaveClass("bg-sky-500");
    expect(screen.getByLabelText("Lab รับตัวอย่าง (จุด)")).toHaveClass("bg-lime-600");
  });

  it("แท่ง Pre Result ไม่ใช้สีเดียวกับแท่ง Lab กำลังวิเคราะห์", async () => {
    Object.assign(mocks.petition, {
      labReceivedAt: "2026-07-13T04:30:00.000Z",
      qcCompletedAt: "2026-07-13T05:30:00.000Z",
      labCompletedAt: "2026-07-13T06:00:00.000Z",
      labApprovedAt: "2026-07-13T07:00:00.000Z",
    });
    renderDetail();

    expect(await screen.findByLabelText("Pre Result (ช่วงเวลา)")).toHaveClass("bg-cyan-500");
    expect(screen.getByLabelText("Lab กำลังวิเคราะห์ (ช่วงเวลา)")).toHaveClass("bg-amber-500");
  });

  it("จุดที่ยังไม่ถึงยังเป็นสีเทา", async () => {
    Object.assign(mocks.petition, {
      qcReceivedAt: undefined,
      receivedAt: undefined,
      labReceivedAt: undefined,
      assignedTo: undefined,
    });
    renderDetail();

    expect(await screen.findByLabelText("QC รับตัวอย่าง (จุด)")).toHaveClass("bg-grey-300");
  });
});
