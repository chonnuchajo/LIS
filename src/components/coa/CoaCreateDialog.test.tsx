import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CoaDocument, CoaSourceResult } from "@/types/coa.types";
import CoaCreateDialog from "./CoaCreateDialog";

const mocks = vi.hoisted(() => ({ eligible: vi.fn(), source: vi.fn(), create: vi.fn(), createManual: vi.fn(), created: vi.fn(), openChange: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: { getEligibleCoaPetitions: mocks.eligible, getCoaSourceData: mocks.source, createCoaDocument: mocks.create, createManualCoaDocument: mocks.createManual } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { name: "QC Staff", email: "qc@example.com", role: "qc-staff", roles: ["qc-staff"] } }) }));

const request = {
  _id: "request-1", petitionId: "p1", selectedItemSeqs: [1], status: "requested", revision: 0,
  sampleSnapshots: [{ itemSeq: 1, commonName: "Glyphosate 48% SL" }], resultSnapshots: [],
} as CoaDocument;
const resultOptions: CoaSourceResult[] = [
  { itemSeq: 1, kind: "result", key: "ai-1", label: "%AI / ชุดที่ 1", result: "48.1", unit: "%" },
  { itemSeq: 1, kind: "result", key: "ai-2", label: "%AI / ชุดที่ 2", result: "48.3", unit: "%" },
  { itemSeq: 1, kind: "result", key: "physical", label: "กายภาพ - สี", result: "สีส้ม" },
  { itemSeq: 1, kind: "result", key: "density", label: "ค่า ถพ.", result: "1.182", unit: "g/cm³" },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.eligible.mockResolvedValue({ items: [{ _id: "p1", petitionNo: "P-1", items: [{ seq: 1, sampleName: "Trade A", commonName: "Glyphosate 48% SL", batchNo: "B-1" }] }] });
  mocks.source.mockResolvedValue({ results: resultOptions });
  mocks.create.mockResolvedValue({ ...request, _id: "coa-1", status: "draft" });
});

const erpRequest = {
  _id: "external-coa-request-SO1-10000", petitionId: "external-coa-request-SO1-10000", selectedItemSeqs: [10000], status: "requested", revision: 0,
  petitionNoSnapshot: "SO1", customerSnapshot: { name: "Customer ERP" },
  sampleSnapshots: [{ itemSeq: 10000, sampleName: "Trade ERP", commonName: "Glyphosate 48% SL" }], resultSnapshots: [],
  externalCoaRequest: { saleOrderNo: "SO1", line: 10000, itemNo: "FC-1", appearance: "เม็ดยาสีแดง" },
} as CoaDocument;

function renderDialog(currentRequest: CoaDocument = request) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<CoaCreateDialog open request={currentRequest} onCreated={mocks.created} onOpenChange={mocks.openChange} />, {
    wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  });
}

async function selectResults() {
  fireEvent.click(await screen.findByRole("checkbox", { name: /%AI \/ ชุดที่ 2/ }));
  fireEvent.click(screen.getByRole("checkbox", { name: /กายภาพ - สี/ }));
  fireEvent.click(screen.getByRole("checkbox", { name: /ค่า ถพ./ }));
}

describe("CoaCreateDialog", () => {
  it("prefills the request and creates a draft using only the selected parameter keys", async () => {
    renderDialog();
    expect(screen.getByRole("button", { name: "สร้างร่าง COA" })).toBeDisabled();
    await selectResults();
    expect(mocks.source).toHaveBeenCalledWith("p1", [1]);
    expect(screen.getByRole("checkbox", { name: /Trade A/ })).toBeChecked();
    expect(screen.getByText("ผล: 48.3 %")).toBeInTheDocument();
    expect(screen.getByText("ผล: 1.182 g/cm³")).toBeInTheDocument();
    expect(screen.queryByLabelText("Specification ภาษาอังกฤษ")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "สร้างร่าง COA" }));
    await waitFor(() => expect(mocks.created).toHaveBeenCalledWith(expect.objectContaining({ _id: "coa-1" })));
    expect(mocks.create).toHaveBeenCalledWith({
      petitionId: "p1", selectedItemSeqs: [1],
      formSelections: [{ itemSeq: 1, resultKeys: ["ai-2", "physical", "density"] }],
      _user: expect.objectContaining({ email: "qc@example.com" }),
    });
    expect(mocks.openChange).toHaveBeenCalledWith(false);
  });

  it("shows editable COA form data and sends corrected snapshots", async () => {
    mocks.source.mockResolvedValueOnce({
      results: resultOptions,
      customerSnapshot: { name: "Requester", company: "ICP" },
      sampleSnapshots: [{ itemSeq: 1, sampleName: "Trade A", commonName: "Glyphosate 48% SL", batchNo: "B-1", productionDate: "2026-09-01" }],
    });
    renderDialog();
    fireEvent.click(await screen.findByRole("checkbox", { name: /%AI \/ ชุดที่ 2/ }));
    expect(screen.getByLabelText("Batch No. *")).toHaveValue("B-1");
    expect(screen.getByLabelText("บริษัท")).toHaveValue("ICP");
    fireEvent.change(screen.getByLabelText("Batch No. *"), { target: { value: "B-2" } });
    fireEvent.change(screen.getByLabelText("ผลทดสอบ *"), { target: { value: "48.0" } });
    fireEvent.click(screen.getByRole("button", { name: "สร้างร่าง COA" }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalled());
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      customerSnapshot: { name: "Requester", company: "ICP" },
      sampleSnapshots: [expect.objectContaining({ itemSeq: 1, batchNo: "B-2", productionDate: "2026-09-01" })],
      resultSnapshots: [{ itemSeq: 1, testItem: "%AI / ชุดที่ 2", result: "48.0", criteria: "", unit: "%", method: "" }],
    }));
  });

  it("matches an ERP request to a petition by common name and keeps ERP names", async () => {
    mocks.eligible.mockResolvedValueOnce({ items: [{ _id: "p1", petitionNo: "P-1", items: [{ seq: 1, sampleName: "Trade A", commonName: "glyphosate 48% sl", batchNo: "B-1", productionDate: "2026-09-01" }] }] });
    renderDialog(erpRequest);
    expect(await screen.findByText(/จับคู่กับคำร้อง P-1/)).toBeInTheDocument();
    await waitFor(() => expect(mocks.source).toHaveBeenCalledWith("p1", [1]));
    expect(await screen.findByLabelText("ชื่อตัวอย่าง *")).toHaveValue("Trade ERP");
    expect(screen.getByLabelText("Batch No. *")).toHaveValue("B-1");
    fireEvent.click(await screen.findByRole("checkbox", { name: /%AI \/ ชุดที่ 2/ }));
    fireEvent.click(screen.getByRole("button", { name: "สร้างร่าง COA" }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalled());
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      petitionId: "p1",
      externalCoaRequest: { saleOrderNo: "SO1", line: 10000, itemNo: "FC-1" },
      sampleSnapshots: [expect.objectContaining({ sampleName: "Trade ERP", batchNo: "B-1" })],
    }));
  });

  it("lets an unmatched ERP request be filled manually", async () => {
    mocks.eligible.mockResolvedValueOnce({ items: [] });
    mocks.createManual.mockResolvedValueOnce({ ...erpRequest, _id: "coa-erp", status: "draft" });
    renderDialog(erpRequest);
    expect(await screen.findByText(/ยังไม่พบคำร้องที่ตรงกัน/)).toBeInTheDocument();
    expect(screen.getByLabelText("ชื่อสามัญ *")).toHaveValue("Glyphosate 48% SL");
    expect(screen.getByDisplayValue("เม็ดยาสีแดง")).toBeInTheDocument();
    expect(screen.getByDisplayValue("48% ± 2.40")).toBeInTheDocument();
    const createButton = screen.getByRole("button", { name: "สร้างร่าง COA" });
    expect(createButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Batch No. *"), { target: { value: "B-9" } });
    fireEvent.change(screen.getByLabelText("วันที่ผลิต *"), { target: { value: "2026-09-01" } });
    const results = screen.getAllByLabelText("ผลทดสอบ *");
    fireEvent.change(results[0], { target: { value: "Conform" } });
    fireEvent.change(results[1], { target: { value: "48.1" } });
    fireEvent.click(createButton);
    await waitFor(() => expect(mocks.createManual).toHaveBeenCalled());
    expect(mocks.createManual).toHaveBeenCalledWith(expect.objectContaining({
      selectedItemSeqs: [10000],
      customerSnapshot: { name: "Customer ERP" },
      sampleSnapshots: [expect.objectContaining({ sampleName: "Trade ERP", batchNo: "B-9", productionDate: "2026-09-01" })],
      resultSnapshots: [
        expect.objectContaining({ testItem: "Appearance", result: "Conform", criteria: "เม็ดยาสีแดง" }),
        expect.objectContaining({ testItem: "%AI content", result: "48.1", criteria: "48% ± 2.40" }),
      ],
      externalCoaRequest: { saleOrderNo: "SO1", line: 10000, itemNo: "FC-1" },
    }));
  });

  it("allows a single generic parameter and retains the selection when saving fails", async () => {
    mocks.source.mockResolvedValueOnce({ results: [{ itemSeq: 1, key: "ph", kind: "result", label: "pH", result: "7.1" }] });
    mocks.create.mockRejectedValueOnce(new Error("บันทึกไม่สำเร็จ"));
    renderDialog();
    fireEvent.click(await screen.findByRole("checkbox", { name: /pH/ }));
    expect(screen.getByRole("button", { name: "สร้างร่าง COA" })).toBeEnabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /pH/ }));
    expect(screen.getByRole("button", { name: "สร้างร่าง COA" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /pH/ }));
    fireEvent.click(screen.getByRole("button", { name: "สร้างร่าง COA" }));
    expect(await screen.findByText("บันทึกไม่สำเร็จ")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /pH/ })).toBeChecked();
    expect(mocks.openChange).not.toHaveBeenCalled();
    expect(mocks.created).not.toHaveBeenCalled();
  });

  it("blocks missing parameter results and retries a failed source load", async () => {
    mocks.source.mockRejectedValueOnce(new Error("โหลดผลไม่สำเร็จ"));
    mocks.source.mockResolvedValue({ results: [] });
    renderDialog();
    fireEvent.click(await screen.findByRole("button", { name: "โหลดผลอีกครั้ง" }));
    expect(await screen.findByText(/ไม่พบค่าพารามิเตอร์ที่ใช้ใน COA/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "สร้างร่าง COA" })).toBeDisabled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
