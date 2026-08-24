import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import StandardUnitsPanel from "./StandardUnitsPanel";
import type { StockStandardItem, StockUnitItem } from "@/types/stock";

const apiMock = vi.hoisted(() => ({
  getStockUnits: vi.fn(),
  discardStockUnit: vi.fn(),
  updateStockUnit: vi.fn(),
}));
const buildStockLabelHtmlMock = vi.hoisted(() => vi.fn(async (unit: StockUnitItem) => `<label ${unit.qrId} />`));
const stockRawLabelPreviewDialogMock = vi.hoisted(() => vi.fn(() => null));

vi.mock("@/lib/api", () => ({ api: apiMock }));
vi.mock("@/lib/stockLabel", () => ({ buildStockLabelHtml: buildStockLabelHtmlMock }));
vi.mock("@/components/lis/StockRawLabelPreviewDialog", () => ({ default: stockRawLabelPreviewDialogMock }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const standard: StockStandardItem = {
  _id: "std1",
  code: "STD-001",
  name: "ABAMECTIN",
  unit: "ml",
  volume: 0,
  threshold: 0,
  frequency: { value: 1, unit: "day" },
};

function makeUnit(overrides: Partial<StockUnitItem>): StockUnitItem {
  return {
    _id: "unit1",
    qrId: "u1",
    itemCode: "STD-001",
    itemName: "ABAMECTIN",
    type: "primary",
    lotNo: "LOT-1",
    exp: "2027-12-31T00:00:00.000Z",
    volume: { initial: 100, remaining: 100, unit: "ml" },
    receivedDate: "2026-01-01T00:00:00.000Z",
    status: "active",
    ...overrides,
  };
}

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <StandardUnitsPanel standard={standard} />
    </QueryClientProvider>,
  );
}

describe("StandardUnitsPanel bulk actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.discardStockUnit.mockResolvedValue({ status: "discarded", qrId: "u1" });
    stockRawLabelPreviewDialogMock.mockClear();
    buildStockLabelHtmlMock.mockClear();
  });

  it("keeps stock reprint as a manual confirmation dialog", async () => {
    apiMock.getStockUnits.mockResolvedValue([
      makeUnit({ _id: "unit1", qrId: "u1", lotNo: "LOT-1" }),
    ]);

    renderPanel();

    const row = (await screen.findByText("LOT-1")).closest("tr");
    expect(row).not.toBeNull();
    const buttons = within(row as HTMLTableRowElement).getAllByRole("button");
    fireEvent.click(buttons[1]);

    await waitFor(() => {
      const latestProps = stockRawLabelPreviewDialogMock.mock.calls.at(-1)?.[0];
      expect(latestProps).toMatchObject({ open: true, labels: ["<label u1 />"] });
      expect(latestProps.autoPrint).not.toBe(true);
    });
  });

  it("lets legacy standard bottles edit Code from the bottle dialog", async () => {
    apiMock.getStockUnits.mockResolvedValue([
      makeUnit({ _id: "unit1", qrId: "u1", labelCode: "", labelRunNo: 1, labelRunYear: 2026 }),
    ]);
    apiMock.updateStockUnit.mockResolvedValue(makeUnit({ _id: "unit1", qrId: "u1", labelCode: "016902" }));

    renderPanel();

    expect(await screen.findByRole("columnheader", { name: "Code" })).toBeInTheDocument();
    const row = (await screen.findByText("016901")).closest("tr");
    expect(row).not.toBeNull();
    fireEvent.click(within(row as HTMLTableRowElement).getAllByRole("button")[0]);

    const dialog = await screen.findByRole("dialog", { name: "แก้ไขข้อมูลขวด" });
    const codeInput = within(dialog).getByLabelText("Code");
    expect(codeInput).toHaveValue("6901");
    fireEvent.change(codeInput, { target: { value: "6902" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "บันทึก" }));

    await waitFor(() => expect(apiMock.updateStockUnit).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ labelCode: "016902" }),
    ));
  });

  it("shows mg volume fields with two decimals and 0.01 step in the bottle dialog", async () => {
    apiMock.getStockUnits.mockResolvedValue([
      makeUnit({ volume: { initial: 100.01, remaining: 100, unit: "mg" } }),
    ]);

    renderPanel();

    const row = (await screen.findByText("LOT-1")).closest("tr");
    expect(row).not.toBeNull();
    fireEvent.click(within(row as HTMLTableRowElement).getAllByRole("button")[0]);

    const dialog = await screen.findByRole("dialog", { name: "แก้ไขข้อมูลขวด" });
    const [initialInput, remainingInput] = within(dialog).getAllByRole("spinbutton") as HTMLInputElement[];

    expect(initialInput).toHaveDisplayValue("100.01");
    expect(initialInput).toHaveAttribute("step", "0.01");
    expect(remainingInput).toHaveDisplayValue("100.00");
    expect(remainingInput).toHaveAttribute("step", "0.01");

    fireEvent.change(remainingInput, { target: { value: "99.9" } });
    fireEvent.blur(remainingInput);

    expect(remainingInput).toHaveDisplayValue("99.90");
  });

  it("selects multiple bottles and prints selected labels in one preview", async () => {
    const unit1 = makeUnit({ _id: "unit1", qrId: "u1", lotNo: "LOT-1", receivedDate: "2026-01-01T00:00:00.000Z" });
    const unit2 = makeUnit({ _id: "unit2", qrId: "u2", lotNo: "LOT-2", receivedDate: "2026-01-02T00:00:00.000Z" });
    const unit3 = makeUnit({ _id: "unit3", qrId: "u3", lotNo: "LOT-3", receivedDate: "2026-01-03T00:00:00.000Z" });
    apiMock.getStockUnits.mockResolvedValue([unit1, unit2, unit3]);

    renderPanel();

    fireEvent.click(await screen.findByRole("checkbox", { name: "เลือกขวด 1" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "เลือกขวด 3" }));
    expect(screen.getByText("เลือกแล้ว 2 ขวด")).toBeInTheDocument();

    const printSelectedButton = screen.getByRole("button", { name: "ปริ้นที่เลือก" });
    expect(printSelectedButton).not.toHaveTextContent("ปริ้นที่เลือก");
    fireEvent.click(printSelectedButton);

    await waitFor(() => expect(buildStockLabelHtmlMock).toHaveBeenCalledTimes(2));
    expect(buildStockLabelHtmlMock).toHaveBeenNthCalledWith(1, unit1);
    expect(buildStockLabelHtmlMock).toHaveBeenNthCalledWith(2, unit3);
    await waitFor(() => {
      const latestProps = stockRawLabelPreviewDialogMock.mock.calls.at(-1)?.[0];
      expect(latestProps).toMatchObject({ open: true, labels: ["<label u1 />", "<label u3 />"] });
      expect(latestProps.autoPrint).not.toBe(true);
    });
  });

  it("selects all visible bottles from the header checkbox", async () => {
    apiMock.getStockUnits.mockResolvedValue([
      makeUnit({ _id: "unit1", qrId: "u1", lotNo: "LOT-1", receivedDate: "2026-01-01T00:00:00.000Z" }),
      makeUnit({ _id: "unit2", qrId: "u2", lotNo: "LOT-2", receivedDate: "2026-01-02T00:00:00.000Z" }),
    ]);

    renderPanel();

    fireEvent.click(await screen.findByRole("checkbox", { name: "เลือกขวดทั้งหมด" }));

    expect(screen.getByText("เลือกแล้ว 2 ขวด")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "เลือกขวด 1" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "เลือกขวด 2" })).toBeChecked();
  });

  it("reports the same discard reason for all selected bottles", async () => {
    apiMock.getStockUnits.mockResolvedValue([
      makeUnit({ _id: "unit1", qrId: "u1", lotNo: "LOT-1", receivedDate: "2026-01-01T00:00:00.000Z" }),
      makeUnit({ _id: "unit2", qrId: "u2", lotNo: "LOT-2", receivedDate: "2026-01-02T00:00:00.000Z" }),
    ]);

    renderPanel();

    fireEvent.click(await screen.findByRole("checkbox", { name: "เลือกขวด 1" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "เลือกขวด 2" }));
    const reportSelectedButton = screen.getByRole("button", { name: "แจ้งหมด/ปัญหาที่เลือก" });
    expect(reportSelectedButton).not.toHaveTextContent("แจ้งหมด/ปัญหาที่เลือก");
    fireEvent.click(reportSelectedButton);

    const dialog = await screen.findByRole("dialog", { name: "แจ้งสถานะขวด" });
    expect(within(dialog).getByText("ABAMECTIN · 2 ขวดที่เลือก")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "ยืนยัน" }));

    await waitFor(() => expect(apiMock.discardStockUnit).toHaveBeenCalledTimes(2));
    expect(apiMock.discardStockUnit).toHaveBeenNthCalledWith(1, "u1", { outcome: "discard", reason: "ประสิทธิภาพลดลง" });
    expect(apiMock.discardStockUnit).toHaveBeenNthCalledWith(2, "u2", { outcome: "discard", reason: "ประสิทธิภาพลดลง" });
  });
});
