import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CoaDocument, CoaSourceResult } from "@/types/coa.types";
import CoaCreateDialog from "./CoaCreateDialog";

const mocks = vi.hoisted(() => ({ eligible: vi.fn(), source: vi.fn(), create: vi.fn(), created: vi.fn(), openChange: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: { getEligibleCoaPetitions: mocks.eligible, getCoaSourceData: mocks.source, createCoaDocument: mocks.create } }));
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

function renderDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<CoaCreateDialog open request={request} onCreated={mocks.created} onOpenChange={mocks.openChange} />, {
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
