import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import StockQrScanner from "./StockQrScanner";

const scannerState = vi.hoisted(() => ({
  successCallbacks: [] as Array<(text: string) => void>,
  constructorCalls: [] as unknown[][],
  startConfigs: [] as unknown[],
  startSources: [] as unknown[],
  startErrors: [] as Array<Error | null>,
  cameras: [{ id: "back-camera", label: "Back camera" }],
}));

function cameraError(name: string, message: string) {
  const error = new Error(message);
  error.name = name;
  return error;
}

const html5QrcodeMock = vi.hoisted(() => vi.fn().mockImplementation((...args: unknown[]) => {
  scannerState.constructorCalls.push(args);
  return {
    start: vi.fn(async (source: unknown, config: unknown, onSuccess: (text: string) => void) => {
      scannerState.startSources.push(source);
      scannerState.startConfigs.push(config);
      const startError = scannerState.startErrors.length > 0 ? scannerState.startErrors.shift() : null;
      if (startError) throw startError;
      scannerState.successCallbacks.push(onSuccess);
      return null;
    }),
    stop: vi.fn(async () => {}),
    getState: vi.fn(() => 2),
    applyVideoConstraints: vi.fn(async () => {}),
    getRunningTrackCapabilities: vi.fn(() => ({})),
    getRunningTrackSettings: vi.fn(() => ({})),
  };
}));

vi.mock("html5-qrcode", () => ({
  Html5Qrcode: Object.assign(html5QrcodeMock, {
    getCameras: vi.fn(async () => scannerState.cameras),
  }),
  Html5QrcodeScannerState: { SCANNING: 2, PAUSED: 3 },
  Html5QrcodeSupportedFormats: {
    QR_CODE: 0,
    CODABAR: 2,
    CODE_39: 3,
    CODE_93: 4,
    CODE_128: 5,
    ITF: 8,
    EAN_13: 9,
    EAN_8: 10,
    UPC_A: 14,
    UPC_E: 15,
    UPC_EAN_EXTENSION: 16,
  },
}));

describe("StockQrScanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scannerState.successCallbacks = [];
    scannerState.constructorCalls = [];
    scannerState.startConfigs = [];
    scannerState.startSources = [];
    scannerState.startErrors = [];
    scannerState.cameras = [{ id: "back-camera", label: "Back camera" }];
  });

  it("returns raw text and enables 1D formats in barcode mode", async () => {
    const onScanned = vi.fn();

    render(
      <StockQrScanner
        open
        scanMode="barcode"
        title="Scan Barcode"
        onClose={vi.fn()}
        onScanned={onScanned}
      />,
    );

    await waitFor(() => expect(scannerState.successCallbacks).toHaveLength(1));
    scannerState.successCallbacks[0](" 654694 ");

    expect(onScanned).toHaveBeenCalledWith("654694");
    expect(scannerState.constructorCalls[0][1]).toMatchObject({
      useBarCodeDetectorIfSupported: true,
      verbose: false,
      formatsToSupport: expect.arrayContaining([5, 9, 14]),
    });
  });

  it("starts with an ideal rear camera instead of requiring an exact rear camera", async () => {
    render(
      <StockQrScanner
        open
        scanMode="barcode"
        title="สแกน Barcode ด้วยกล้อง"
        showManualEntry={false}
        onClose={vi.fn()}
        onScanned={vi.fn()}
      />,
    );

    await waitFor(() => expect(scannerState.startSources).toHaveLength(1));

    expect(scannerState.startSources[0]).toMatchObject({
      facingMode: { ideal: "environment" },
    });
    expect(scannerState.startSources[0]).not.toMatchObject({
      facingMode: { exact: "environment" },
    });
  });

  it("shows barcode-specific guidance in readable Thai", async () => {
    render(
      <StockQrScanner
        open
        scanMode="barcode"
        title="สแกน Barcode ด้วยกล้อง"
        showManualEntry={false}
        onClose={vi.fn()}
        onScanned={vi.fn()}
      />,
    );

    await waitFor(() => expect(scannerState.successCallbacks).toHaveLength(1));

    expect(screen.getByText(/เล็งกล้องไปที่ Barcode/)).toBeInTheDocument();
    expect(screen.queryByText(/QR บนขวด/)).not.toBeInTheDocument();
  });

  it("shows a readable Thai camera error when barcode camera start fails", async () => {
    scannerState.startErrors = [
      cameraError("NotReadableError", "camera is already in use"),
      cameraError("NotReadableError", "camera is already in use"),
    ];

    render(
      <StockQrScanner
        open
        scanMode="barcode"
        title="สแกน Barcode ด้วยกล้อง"
        showManualEntry={false}
        onClose={vi.fn()}
        onScanned={vi.fn()}
      />,
    );

    expect(await screen.findByText(/เปิดกล้องไม่ได้/)).toBeInTheDocument();
    expect(screen.getByText(/อนุญาตการใช้งานกล้อง/)).toBeInTheDocument();
  });

  it("shows the actual camera error detail and can retry after a failed start", async () => {
    scannerState.startErrors = [
      cameraError("NotReadableError", "camera is already in use"),
      cameraError("NotReadableError", "camera is already in use"),
    ];

    render(
      <StockQrScanner
        open
        scanMode="barcode"
        title="สแกน Barcode ด้วยกล้อง"
        showManualEntry={false}
        onClose={vi.fn()}
        onScanned={vi.fn()}
      />,
    );

    expect(await screen.findByText("รายละเอียด: NotReadableError — camera is already in use")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "ลองเปิดกล้องอีกครั้ง" }));

    await waitFor(() => expect(scannerState.successCallbacks).toHaveLength(1));
  });

  it("does not contain known Thai mojibake sequences", () => {
    const source = readFileSync(resolve("src/components/lis/StockQrScanner.tsx"), "utf8");

    expect(source).not.toMatch(/เธ|เน[€-]|โ€”|ร—/);
  });
});
