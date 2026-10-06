import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CoaDocument, CoaSourceResult } from "@/types/coa.types";
import CoaCreateDialog from "./CoaCreateDialog";

const mocks = vi.hoisted(() => ({ eligible: vi.fn(), source: vi.fn(), createManual: vi.fn(), created: vi.fn(), openChange: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: { getEligibleCoaPetitions: mocks.eligible, getCoaSourceData: mocks.source, createManualCoaDocument: mocks.createManual } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { name: "QC Staff", email: "qc@example.com", role: "qc-staff", roles: ["qc-staff"] } }) }));

const request = {
  _id: "request-1", petitionId: "p1", selectedItemSeqs: [1], status: "requested", revision: 0,
  sampleSnapshots: [{ itemSeq: 1, commonName: "Glyphosate 48% SL" }], resultSnapshots: [],
} as CoaDocument;
const erpRequest = {
  _id: "external-coa-request-SO1-10000", petitionId: "external-coa-request-SO1-10000", selectedItemSeqs: [10000], status: "requested", revision: 0,
  petitionNoSnapshot: "SO1", customerSnapshot: { name: "Customer ERP" },
  sampleSnapshots: [{ itemSeq: 10000, sampleName: "Trade ERP", commonName: "Glyphosate 48% SL" }], resultSnapshots: [],
  externalCoaRequest: { saleOrderNo: "SO1", line: 10000, itemNo: "FC-1", appearance: "เม็ดยาสีแดง" },
} as CoaDocument;
const resultOptions: CoaSourceResult[] = [
  { itemSeq: 1, kind: "result", key: "ai", label: "%AI / ชุดที่ 1", testItem: "%AI content", result: "48.1", unit: "%" },
  { itemSeq: 1, kind: "result", key: "physical", label: "กายภาพ - ลักษณะ / ขั้นที่ 1 ชุดที่ 1", testItem: "กายภาพ - ลักษณะ", result: "เม็ดทรงกระบอก" },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.eligible.mockResolvedValue({ items: [{ _id: "p1", petitionNo: "P-1", items: [{ seq: 1, sampleName: "Trade A", commonName: "Glyphosate 48% SL", batchNo: "B-1", productionDate: "2026-09-01" }] }] });
  mocks.source.mockResolvedValue({ results: resultOptions, customerSnapshot: { name: "Requester", company: "ICP" } });
  mocks.createManual.mockResolvedValue({ ...request, _id: "coa-1", status: "draft" });
});

function renderDialog(currentRequest: CoaDocument = request) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<CoaCreateDialog open request={currentRequest} onCreated={mocks.created} onOpenChange={mocks.openChange} />, {
    wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  });
}

describe("CoaCreateDialog", () => {
  it("prefills every Lab value as editable COA rows and saves the edited form", async () => {
    renderDialog();
    expect(await screen.findByDisplayValue("เม็ดทรงกระบอก")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /กายภาพ/ })).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("48% ± 2.40")).toBeInTheDocument();
    expect(screen.getByLabelText("Batch No. *")).toHaveValue("B-1");
    expect(screen.queryByLabelText("บริษัท")).not.toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue("เม็ดทรงกระบอก"), { target: { value: "เม็ดสีแดง" } });
    fireEvent.change(screen.getByLabelText("Batch No. *"), { target: { value: "B-2" } });
    fireEvent.click(screen.getAllByRole("button", { name: "ลบผลนี้" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "เพิ่มผล" }));
    const testItems = screen.getAllByLabelText("รายการทดสอบ *");
    fireEvent.change(testItems[testItems.length - 1], { target: { value: "pH" } });
    const resultsInputs = screen.getAllByLabelText("ผลทดสอบ *");
    expect(screen.getByRole("button", { name: "สร้างร่าง COA" })).toBeDisabled();
    fireEvent.change(resultsInputs[resultsInputs.length - 1], { target: { value: "7.0" } });
    fireEvent.click(screen.getByRole("button", { name: "สร้างร่าง COA" }));
    await waitFor(() => expect(mocks.created).toHaveBeenCalledWith(expect.objectContaining({ _id: "coa-1" })));
    expect(mocks.createManual).toHaveBeenCalledWith(expect.objectContaining({
      petitionId: "p1",
      selectedItemSeqs: [1],
      customerSnapshot: { name: "Requester", company: "ICP" },
      sampleSnapshots: [expect.objectContaining({ itemSeq: 1, sampleName: "Trade A", batchNo: "B-2", productionDate: "2026-09-01" })],
      resultSnapshots: [
        { itemSeq: 1, testItem: "กายภาพ - ลักษณะ", result: "เม็ดสีแดง", criteria: "", unit: "", method: "" },
        { itemSeq: 1, testItem: "pH", result: "7.0", criteria: "", unit: "", method: "" },
      ],
      externalCoaRequest: undefined,
    }));
    expect(mocks.openChange).toHaveBeenCalledWith(false);
  });

  it("keeps the form when saving fails and blocks a sample without result rows", async () => {
    mocks.createManual.mockRejectedValueOnce(new Error("บันทึกไม่สำเร็จ"));
    renderDialog();
    fireEvent.click((await screen.findAllByRole("button", { name: "ลบผลนี้" }))[0]);
    fireEvent.click(screen.getByRole("button", { name: "ลบผลนี้" }));
    expect(screen.getByRole("button", { name: "สร้างร่าง COA" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "เพิ่มผล" }));
    fireEvent.change(screen.getByLabelText("รายการทดสอบ *"), { target: { value: "pH" } });
    fireEvent.change(screen.getByLabelText("ผลทดสอบ *"), { target: { value: "7.1" } });
    fireEvent.click(screen.getByRole("button", { name: "สร้างร่าง COA" }));
    expect(await screen.findByText("บันทึกไม่สำเร็จ")).toBeInTheDocument();
    expect(screen.getByLabelText("ผลทดสอบ *")).toHaveValue("7.1");
    expect(mocks.openChange).not.toHaveBeenCalled();
  });

  it("offers a manual result template when the Lab has no values and retries a failed load", async () => {
    mocks.source.mockRejectedValueOnce(new Error("โหลดผลไม่สำเร็จ"));
    mocks.source.mockResolvedValue({ results: [] });
    renderDialog();
    fireEvent.click(await screen.findByRole("button", { name: "โหลดผลอีกครั้ง" }));
    expect(await screen.findByText(/ไม่พบค่าพารามิเตอร์จากผล Lab/)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Appearance")).toBeInTheDocument();
    expect(screen.getByDisplayValue("%AI content")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "สร้างร่าง COA" })).toBeDisabled();
  });

  it("matches an ERP request to a petition by common name and keeps ERP names", async () => {
    mocks.eligible.mockResolvedValueOnce({ items: [{ _id: "p1", petitionNo: "P-1", items: [{ seq: 1, sampleName: "Trade A", commonName: "glyphosate 48% sl", batchNo: "B-1", productionDate: "2026-09-01" }] }] });
    renderDialog(erpRequest);
    expect(await screen.findByText(/จับคู่กับคำร้อง P-1/)).toBeInTheDocument();
    expect(await screen.findByLabelText("ชื่อการค้า *")).toHaveValue("Trade ERP");
    expect(await screen.findByDisplayValue("เม็ดทรงกระบอก")).toBeInTheDocument();
    expect(screen.getByDisplayValue("เม็ดยาสีแดง")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "สร้างร่าง COA" }));
    await waitFor(() => expect(mocks.createManual).toHaveBeenCalled());
    expect(mocks.createManual).toHaveBeenCalledWith(expect.objectContaining({
      petitionId: "p1",
      customerSnapshot: { name: "Customer ERP", company: "ICP" },
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
      petitionId: undefined,
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
});