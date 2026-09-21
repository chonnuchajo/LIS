import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SolventUnitsPanel from "./SolventUnitsPanel";
import type { StockSolventItem, StockUnitItem } from "@/types/stock";

const apiMock = vi.hoisted(() => ({
  getStockUnits: vi.fn(),
  getStockTransactions: vi.fn(),
}));

const buildSolventLabelHtmlMock = vi.hoisted(() => vi.fn(async () => "<solvent-label />"));
const stockRawLabelPreviewDialogMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", () => ({ api: apiMock }));
vi.mock("@/lib/stockLabel", () => ({
  buildSolventLabelHtml: buildSolventLabelHtmlMock,
}));
vi.mock("@/components/lis/StockRawLabelPreviewDialog", () => ({
  default: (props: { open: boolean; labels: string[] }) => {
    stockRawLabelPreviewDialogMock(props);
    return props.open ? <div data-testid="stock-label-preview">{props.labels.join("\n")}</div> : null;
  },
}));

function renderPanel(overrides: Partial<StockSolventItem> = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const solvent: StockSolventItem = {
    _id: "solvent-1",
    name: "Acetone",
    barcodes: [],
    sizeLiter: 18,
    qty: 2,
    price: 3000,
    note: "ปกติ",
    ...overrides,
  };
  return render(
    <QueryClientProvider client={client}>
      <SolventUnitsPanel solvent={solvent} />
    </QueryClientProvider>,
  );
}

describe("SolventUnitsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.getStockTransactions.mockResolvedValue([]);
  });

  it("shows per-bottle details from stored solvent units and reprints one sticker", async () => {
    const unit: StockUnitItem & { itemType: "solvent"; itemId: string } = {
      _id: "unit-1",
      qrId: "u-solvent-1",
      itemType: "solvent",
      itemId: "solvent-1",
      itemCode: "solvent-1",
      itemName: "Acetone",
      kind: "sealed",
      type: "",
      lotNo: "LOT-A",
      lotBottleNo: 1,
      exp: "2027-01-01T00:00:00.000Z",
      receivedDate: "2026-08-20T00:00:00.000Z",
      volume: { initial: 18000, remaining: 18000, unit: "ml" },
      status: "active",
    };
    apiMock.getStockUnits.mockResolvedValue([unit]);

    renderPanel();

    expect(apiMock.getStockUnits).toHaveBeenCalledWith({ itemType: "solvent", itemId: "solvent-1" });
    const row = (await screen.findByText("LOT-A")).closest("tr");
    expect(row).not.toBeNull();
    expect(within(row as HTMLTableRowElement).getByText("18 L")).toBeInTheDocument();

    fireEvent.click(within(row as HTMLTableRowElement).getByRole("button", { name: "ปริ้น sticker ขวดที่ 1" }));

    await waitFor(() => expect(buildSolventLabelHtmlMock).toHaveBeenCalledWith(expect.objectContaining({
      name: "Acetone",
      idForQr: "u-solvent-1",
      lotNo: "LOT-A",
      exp: "2027-01-01T00:00:00.000Z",
      receivedDate: "2026-08-20T00:00:00.000Z",
      bottleNo: 1,
      sizeLabel: "18 L",
    })));
    expect(await screen.findByTestId("stock-label-preview")).toHaveTextContent("<solvent-label />");
  });

  it("falls back to recent receive history for legacy solvent stock", async () => {
    apiMock.getStockUnits.mockResolvedValue([]);
    apiMock.getStockTransactions.mockResolvedValue([
      {
        _id: "tx-1",
        itemType: "solvent",
        itemId: "solvent-1",
        itemName: "Acetone",
        action: "receive",
        delta: 2,
        note: "lot B-001 · exp 2028-02-03 · ขนาด 18 L · ราคา 3000 บาท",
        createdAt: "2026-08-20T00:00:00.000Z",
      },
    ]);

    renderPanel();

    await waitFor(() => expect(apiMock.getStockTransactions).toHaveBeenCalledWith({
      itemType: "solvent",
      itemId: "solvent-1",
      action: "receive",
      limit: 1000,
    }));
    const rows = await screen.findAllByText("B-001");
    expect(rows).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "ปริ้น sticker ทุกขวด" }));

    await waitFor(() => expect(buildSolventLabelHtmlMock).toHaveBeenCalledTimes(2));
    expect(buildSolventLabelHtmlMock).toHaveBeenNthCalledWith(1, expect.objectContaining({ idForQr: "solvent-1", bottleNo: 1, lotNo: "B-001" }));
    expect(buildSolventLabelHtmlMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ idForQr: "solvent-1", bottleNo: 2, lotNo: "B-001" }));
  });
});
