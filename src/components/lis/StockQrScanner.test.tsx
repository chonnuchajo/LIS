import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import StockQrScanner from "./StockQrScanner";

const scannerState = vi.hoisted(() => ({
  successCallbacks: [] as Array<(text: string) => void>,
  constructorCalls: [] as unknown[][],
  startConfigs: [] as unknown[],
}));

const html5QrcodeMock = vi.hoisted(() => vi.fn().mockImplementation((...args: unknown[]) => {
  scannerState.constructorCalls.push(args);
  return {
    start: vi.fn(async (_source: unknown, config: unknown, onSuccess: (text: string) => void) => {
      scannerState.startConfigs.push(config);
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
    getCameras: vi.fn(async () => [{ id: "back-camera", label: "Back camera" }]),
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
});
