import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ReceiveCart from "./ReceiveCart";

const apiMock = vi.hoisted(() => ({
  getStandards: vi.fn(),
  getSolvents: vi.fn(),
  getGlassware: vi.fn(),
  registerStockBarcode: vi.fn(),
  receiveStockUnits: vi.fn(),
  receiveSolvent: vi.fn(),
  receiveGlassware: vi.fn(),
}));
const stockRawLabelPreviewDialogMock = vi.hoisted(() => vi.fn(() => null));
const stockQrScannerMock = vi.hoisted(() => vi.fn(({
  open,
  scanMode,
  onScanned,
}: {
  open: boolean;
  scanMode?: string;
  onScanned: (value: string) => void;
}) => (open ? (
  <div role="dialog" aria-label="camera barcode scanner">
    <span>{scanMode}</span>
    <button type="button" onClick={() => onScanned("654694")}>mock camera barcode</button>
  </div>
) : null)));

vi.mock("@/lib/api", () => ({ api: apiMock }));
vi.mock("@/lib/stockLabel", () => ({
  buildStockLabelHtml: vi.fn(async () => "<label />"),
  buildSolventLabelHtml: vi.fn(async () => "<label />"),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/lis/StockRawLabelPreviewDialog", () => ({ default: stockRawLabelPreviewDialogMock }));
vi.mock("@/components/lis/StockQrScanner", () => ({ default: stockQrScannerMock }));
vi.mock("@/components/lis/stock/StockPhotoUploader", () => ({
  default: ({ label, onChange }: { label?: string; onChange: (urls: string[]) => void }) => (
    <button data-testid="photo-upload" type="button" onClick={() => onChange(["/LIS/uploads/qc-photos/cart.webp"])}>
      {label || "photo upload"}
    </button>
  ),
}));

function renderCart() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ReceiveCart />
    </QueryClientProvider>,
  );
}

function mockStockLists() {
  apiMock.getStandards.mockResolvedValue([
    { _id: "std1", code: "STD-001", name: "ABAMECTIN", unit: "ml", volume: 0, threshold: 0, frequency: { value: 1, unit: "day" } },
  ]);
  apiMock.getSolvents.mockResolvedValue([]);
  apiMock.getGlassware.mockResolvedValue([]);
}

async function scanReceiveBarcode(value: string) {
  const barcodeInput = await screen.findByRole("textbox", { name: /Barcode/ });
  fireEvent.change(barcodeInput, { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: /Barcode/ }));
}

describe("ReceiveCart photos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.registerStockBarcode.mockResolvedValue({ barcode: "654694", category: "standard", itemId: "std1" });
  });

  it("opens a registration popup for a newly scanned receive barcode", async () => {
    mockStockLists();
    renderCart();

    await scanReceiveBarcode("654694");

    expect(await screen.findByRole("dialog", { name: /Barcode/ })).toBeInTheDocument();
    expect(screen.getByText("654694")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /\(0/, hidden: true })).toBeDisabled();
  });

  it("opens the camera scanner and routes camera barcode scans into registration", async () => {
    mockStockLists();
    renderCart();

    fireEvent.click(await screen.findByRole("button", { name: /กล้อง|camera/i }));

    await waitFor(() => expect(stockQrScannerMock.mock.calls.some(([props]) => (
      props.open === true && props.scanMode === "barcode"
    ))).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "mock camera barcode" }));

    expect(await screen.findByRole("dialog", { name: /Barcode/ })).toBeInTheDocument();
    expect(screen.getByText("654694")).toBeInTheDocument();
  });

  it("registers a new receive barcode before receiving the selected stock item", async () => {
    mockStockLists();
    apiMock.receiveStockUnits.mockResolvedValue([
      { _id: "unit1", qrId: "u1", itemCode: "STD-001", itemName: "ABAMECTIN", volume: { initial: 100, remaining: 100, unit: "ml" } },
    ]);

    renderCart();

    await scanReceiveBarcode("654694");
    const dialog = await screen.findByRole("dialog", { name: /Barcode/ });
    fireEvent.click(within(dialog).getByRole("combobox"));
    fireEvent.click(await screen.findByText("Standard"));
    fireEvent.click(await screen.findByText("STD-001 ABAMECTIN"));
    fireEvent.click(within(dialog).getByRole("button", { name: /Barcode/ }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /Barcode/ })).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "primary" }));
    fireEvent.change(screen.getByPlaceholderText("required"), { target: { value: "LOT-1" } });
    fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: "2027-12-31" } });
    fireEvent.click(screen.getByRole("button", { name: /\(1/ }));

    await waitFor(() => expect(apiMock.registerStockBarcode).toHaveBeenCalled());
    expect(apiMock.registerStockBarcode).toHaveBeenCalledWith({ barcode: "654694", category: "standard", itemId: "std1" });
    expect(apiMock.receiveStockUnits).toHaveBeenCalled();
  });

  it("sends bottle photo URLs from the bulk receive cart", async () => {
    mockStockLists();
    apiMock.receiveStockUnits.mockResolvedValue([
      { _id: "unit1", qrId: "u1", itemCode: "STD-001", itemName: "ABAMECTIN", volume: { initial: 100, remaining: 100, unit: "ml" } },
    ]);

    renderCart();

    await scanReceiveBarcode("STD-001");
    fireEvent.change(screen.getByPlaceholderText("required"), { target: { value: "LOT-1" } });
    fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: "2027-12-31" } });
    fireEvent.click(screen.getByRole("button", { name: "primary" }));
    fireEvent.click(await screen.findByTestId("photo-upload"));
    fireEvent.click(screen.getByRole("button", { name: /\(1/ }));

    await waitFor(() => expect(apiMock.receiveStockUnits).toHaveBeenCalled());
    expect(apiMock.receiveStockUnits).toHaveBeenCalledWith(
      "std1",
      expect.objectContaining({
        type: "primary",
        bottles: [
          {
            exp: "2027-12-31",
            photoUrls: ["/LIS/uploads/qc-photos/cart.webp"],
          },
        ],
      }),
    );
  });

  it("auto-prints labels after receiving from the cart", async () => {
    mockStockLists();
    apiMock.receiveStockUnits.mockResolvedValue([
      { _id: "unit1", qrId: "u1", itemCode: "STD-001", itemName: "ABAMECTIN", volume: { initial: 100, remaining: 100, unit: "ml" } },
    ]);

    renderCart();

    await scanReceiveBarcode("STD-001");
    fireEvent.change(screen.getByPlaceholderText("required"), { target: { value: "LOT-1" } });
    fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: "2027-12-31" } });
    fireEvent.click(screen.getByRole("button", { name: "primary" }));
    fireEvent.click(screen.getByRole("button", { name: /\(1/ }));

    await waitFor(() => {
      const latestProps = stockRawLabelPreviewDialogMock.mock.calls.at(-1)?.[0];
      expect(latestProps).toMatchObject({ open: true, labels: ["<label />"], autoPrint: true });
    });
  });
});
