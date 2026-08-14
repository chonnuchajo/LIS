import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import StandardUnitsPanel from "./StandardUnitsPanel";
import type { StockStandardItem } from "@/types/stock";

const apiMock = vi.hoisted(() => ({
  getStockUnits: vi.fn(),
}));
const stockRawLabelPreviewDialogMock = vi.hoisted(() => vi.fn(() => null));

vi.mock("@/lib/api", () => ({ api: apiMock }));
vi.mock("@/lib/stockLabel", () => ({ buildStockLabelHtml: vi.fn(async () => "<label />") }));
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

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <StandardUnitsPanel standard={standard} />
    </QueryClientProvider>,
  );
}

describe("StandardUnitsPanel print confirmation", () => {
  it("keeps stock reprint as a manual confirmation dialog", async () => {
    apiMock.getStockUnits.mockResolvedValue([
      {
        _id: "unit1",
        qrId: "u1",
        itemCode: "STD-001",
        itemName: "ABAMECTIN",
        type: "primary",
        lotNo: "LOT-1",
        exp: "2027-12-31T00:00:00.000Z",
        volume: { initial: 100, remaining: 100, unit: "ml" },
      },
    ]);

    renderPanel();

    const row = (await screen.findByText("LOT-1")).closest("tr");
    expect(row).not.toBeNull();
    const buttons = within(row as HTMLTableRowElement).getAllByRole("button");
    fireEvent.click(buttons[1]);

    await waitFor(() => {
      const latestProps = stockRawLabelPreviewDialogMock.mock.calls.at(-1)?.[0];
      expect(latestProps).toMatchObject({ open: true, labels: ["<label />"] });
      expect(latestProps.autoPrint).not.toBe(true);
    });
  });
});
