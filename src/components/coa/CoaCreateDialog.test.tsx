import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CoaDocument } from "@/types/coa.types";
import CoaCreateDialog from "./CoaCreateDialog";

const mocks = vi.hoisted(() => ({ eligible: vi.fn(), source: vi.fn(), create: vi.fn(), created: vi.fn(), openChange: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: { getEligibleCoaPetitions: mocks.eligible, getCoaSourceData: mocks.source, createCoaDocument: mocks.create } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { name: "QC Staff", email: "qc@example.com", role: "qc-staff", roles: ["qc-staff"] } }) }));

const request = {
  _id: "request-1", petitionId: "p1", selectedItemSeqs: [1], status: "requested", revision: 0,
  sampleSnapshots: [{ itemSeq: 1, commonName: "Glyphosate 48% SL" }], resultSnapshots: [],
} as CoaDocument;
const resultOptions = [
  { itemSeq: 1, kind: "ai", key: "ai-1", label: "%AI / ชุดที่ 1", result: "48.1%" },
  { itemSeq: 1, kind: "ai", key: "ai-2", label: "%AI / ชุดที่ 2", result: "48.3%" },
  { itemSeq: 1, kind: "appearance", key: "physical", label: "กายภาพ", result: "ของเหลวใส สีส้ม", suggestedEnglish: "Clear liquid, Orange" },
  { itemSeq: 1, kind: "density", key: "density", label: "ค่า ถพ.", result: "1.182" },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.eligible.mockResolvedValue({ items: [{ _id: "p1", petitionNo: "P-1", items: [{ seq: 1, sampleName: "Trade A", commonName: "Glyphosate 48% SL", batchNo: "B-1" }] }] });
  mocks.source.mockResolvedValue({ results: resultOptions });
  mocks.create.mockResolvedValue({ ...request, _id: "coa-1", status: "draft" });
});

function renderDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<CoaCreateDialog open request={request} onCreated={mocks.created} onOpenChange={mocks.openChange} />, {
    wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  });
}

async function selectResults() {
  fireEvent.change(await screen.findByLabelText("ผล %AI จากพารามิเตอร์"), { target: { value: "ai-2" } });
  fireEvent.change(screen.getByLabelText("ผลกายภาพจากพารามิเตอร์"), { target: { value: "physical" } });
  fireEvent.change(screen.getByLabelText("ผล Density จากพารามิเตอร์"), { target: { value: "density" } });
}

describe("CoaCreateDialog", () => {
  it("prefills the clicked request and creates a draft with chosen parameter sources and reviewed English", async () => {
    renderDialog();
    await selectResults();
    expect(mocks.source).toHaveBeenCalledWith("p1", [1]);
    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(screen.getByLabelText("Specification ภาษาอังกฤษ")).toHaveValue("Clear liquid, Orange");
    expect(screen.getByRole("button", { name: "สร้างร่าง COA" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Specification ภาษาอังกฤษ"), { target: { value: "Clear orange liquid" } });
    fireEvent.change(screen.getByLabelText("ยืนยันผลกายภาพ"), { target: { value: "Conform" } });
    fireEvent.click(screen.getByRole("button", { name: "สร้างร่าง COA" }));
    await waitFor(() => expect(mocks.created).toHaveBeenCalledWith(expect.objectContaining({ _id: "coa-1" })));
    expect(mocks.create).toHaveBeenCalledWith({
      petitionId: "p1", selectedItemSeqs: [1],
      formSelections: [{ itemSeq: 1, aiKey: "ai-2", appearanceKey: "physical", appearanceSource: "ของเหลวใส สีส้ม", appearanceSpecification: "Clear orange liquid", appearanceResult: "Conform", densityKey: "density" }],
      _user: expect.objectContaining({ email: "qc@example.com" }),
    });
    expect(mocks.openChange).toHaveBeenCalledWith(false);
  });

  it("rejects Thai specification and keeps the form open with chosen values when creation fails", async () => {
    mocks.create.mockRejectedValueOnce(new Error("ผลกายภาพเปลี่ยนแล้ว กรุณาตรวจ Specification ใหม่"));
    renderDialog();
    await selectResults();
    fireEvent.change(screen.getByLabelText("ยืนยันผลกายภาพ"), { target: { value: "Not conform" } });
    fireEvent.change(screen.getByLabelText("Specification ภาษาอังกฤษ"), { target: { value: "ของเหลวใส" } });
    expect(screen.getByRole("button", { name: "สร้างร่าง COA" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Specification ภาษาอังกฤษ"), { target: { value: "Cloudy liquid" } });
    fireEvent.click(screen.getByRole("button", { name: "สร้างร่าง COA" }));
    expect(await screen.findByText(/ผลกายภาพเปลี่ยนแล้ว/)).toBeInTheDocument();
    expect(screen.getByLabelText("Specification ภาษาอังกฤษ")).toHaveValue("Cloudy liquid");
    expect(mocks.openChange).not.toHaveBeenCalled();
    expect(mocks.created).not.toHaveBeenCalled();
  });

  it("blocks missing parameter results and retries a failed source load", async () => {
    mocks.source.mockRejectedValueOnce(new Error("โหลดผลไม่สำเร็จ"));
    mocks.source.mockResolvedValue({ results: [] });
    renderDialog();
    fireEvent.click(await screen.findByRole("button", { name: "โหลดผลอีกครั้ง" }));
    expect(await screen.findByText(/ยังไม่มีผล %AI หรือผลกายภาพครบ/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "สร้างร่าง COA" })).toBeDisabled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
