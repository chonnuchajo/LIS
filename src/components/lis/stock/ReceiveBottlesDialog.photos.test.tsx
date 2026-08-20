import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ReceiveBottlesDialog from "./ReceiveBottlesDialog";
import type { StockStandardItem } from "@/types/stock";

const apiMock = vi.hoisted(() => ({
  receiveStockUnits: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ api: apiMock }));
vi.mock("@/lib/stockLabel", () => ({ buildStockLabelHtml: vi.fn(async () => "<label />") }));
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

describe("ReceiveBottlesDialog receive flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defaults standard receive type to primary", async () => {
    apiMock.receiveStockUnits.mockResolvedValue([]);
    render(
      <ReceiveBottlesDialog
        standard={standard}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onPreviewLabels={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("required"), { target: { value: "LOT-1" } });
    fireEvent.change(screen.getByPlaceholderText("เช่น 99.5"), { target: { value: "99.5" } });
    fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: "2027-12-31" } });
    fireEvent.click(document.querySelector('button[type="submit"]') as HTMLButtonElement);

    await waitFor(() => expect(apiMock.receiveStockUnits).toHaveBeenCalled());
    expect(apiMock.receiveStockUnits).toHaveBeenCalledWith(
      "std1",
      expect.objectContaining({ type: "primary", unit: "mg" }),
    );
  });

  it("does not offer photo upload or send photo URLs when receiving a standard bottle", async () => {
    apiMock.receiveStockUnits.mockResolvedValue([
      {
        _id: "unit1",
        qrId: "u1",
        itemCode: "STD-001",
        itemName: "ABAMECTIN",
        volume: { initial: 100, remaining: 100, unit: "ml" },
      },
    ]);

    const onPreviewLabels = vi.fn();

    render(
      <ReceiveBottlesDialog
        standard={standard}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onPreviewLabels={onPreviewLabels}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "primary" }));
    expect(screen.queryByText(/รูปขวด/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("required"), { target: { value: "LOT-1" } });
    fireEvent.change(screen.getByPlaceholderText("เช่น 99.5"), { target: { value: "99.5" } });
    fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: "2027-12-31" } });
    fireEvent.click(screen.getByRole("button", { name: "รับเข้า" }));

    await waitFor(() => expect(apiMock.receiveStockUnits).toHaveBeenCalled());
    expect(apiMock.receiveStockUnits).toHaveBeenCalledWith(
      "std1",
      expect.objectContaining({
        type: "primary",
        unit: "mg",
        purity: "99.5",
        bottles: [
          {
            exp: "2027-12-31",
          },
        ],
      }),
    );
    const payload = apiMock.receiveStockUnits.mock.calls[0][1];
    expect(payload.bottles[0]).not.toHaveProperty("photoUrls");
    expect(onPreviewLabels).toHaveBeenCalledWith(["<label />"], { autoPrint: true });
  });
});
