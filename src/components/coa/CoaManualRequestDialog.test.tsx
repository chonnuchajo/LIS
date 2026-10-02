import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CoaManualRequestDialog from "./CoaManualRequestDialog";

const mocks = vi.hoisted(() => ({ eligible: vi.fn(), createManual: vi.fn(), created: vi.fn(), openChange: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: { getEligibleCoaPetitions: mocks.eligible, createManualCoaDocument: mocks.createManual } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { name: "QC Staff", email: "qc@example.com", role: "qc-staff", roles: ["qc-staff"] } }) }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.eligible.mockResolvedValue({ items: [{ _id: "p1", petitionNo: "P-1", items: [{ seq: 1, sampleName: "Trade A", commonName: "Wrong Name", batchNo: "B-1", productionDate: "2026-09-01" }] }] });
  mocks.createManual.mockResolvedValue({ _id: "coa-1", status: "draft", entryMode: "manual" });
});

function renderDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<CoaManualRequestDialog open onCreated={mocks.created} onOpenChange={mocks.openChange} />, {
    wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  });
}

describe("CoaManualRequestDialog", () => {
  it("prefills petition data, lets the user correct it, and sends typed values", async () => {
    renderDialog();
    fireEvent.click(await screen.findByRole("button", { name: /P-1/ }));
    fireEvent.click(screen.getByRole("checkbox"));
    const createButton = screen.getByRole("button", { name: "สร้างร่าง COA" });
    expect(createButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("ชื่อสามัญ *"), { target: { value: "Glyphosate 48% SL" } });
    fireEvent.change(screen.getByLabelText("รายการทดสอบ *"), { target: { value: "%AI content" } });
    fireEvent.change(screen.getByLabelText("ผลทดสอบ *"), { target: { value: "47.9%" } });
    expect(createButton).toBeEnabled();
    fireEvent.click(createButton);

    await waitFor(() => expect(mocks.created).toHaveBeenCalledWith(expect.objectContaining({ _id: "coa-1" })));
    expect(mocks.createManual).toHaveBeenCalledWith(expect.objectContaining({
      petitionId: "p1",
      selectedItemSeqs: [1],
      sampleSnapshots: [expect.objectContaining({ itemSeq: 1, commonName: "Glyphosate 48% SL", batchNo: "B-1" })],
      resultSnapshots: [expect.objectContaining({ itemSeq: 1, testItem: "%AI content", result: "47.9%" })],
    }));
    expect(mocks.openChange).toHaveBeenCalledWith(false);
  });
});