import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import StockQrScanner from "./StockQrScanner";

const scannerState = vi.hoisted(() => ({
  successCallbacks: [] as Array<(text: string) => void>,
  errorCallbacks: [] as Array<(message: string) => void>,
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
    start: vi.fn(async (
      source: unknown,
      config: unknown,
      onSuccess: (text: string) => void,
      onError: (message: string) => void,
    ) => {
      scannerState.startSources.push(source);
      scannerState.startConfigs.push(config);
      const startError = scannerState.startErrors.length > 0 ? scannerState.startErrors.shift() : null;
      if (startError) throw startError;
      scannerState.successCallbacks.push(onSuccess);
      scannerState.errorCallbacks.push(onError);
      return null;
    }),
    pause: vi.fn(),
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
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn() },
    });
    scannerState.successCallbacks = [];
    scannerState.errorCallbacks = [];
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
    act(() => {
      scannerState.successCallbacks[0](" 654694 ");
    });

    expect(onScanned).toHaveBeenCalledWith("654694");
    expect(scannerState.constructorCalls[0][1]).toMatchObject({
      useBarCodeDetectorIfSupported: true,
      verbose: false,
      formatsToSupport: expect.arrayContaining([5, 9, 14]),
    });
  });

  it("passes only a library-supported camera selector as the start source", async () => {
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

    expect(scannerState.startSources[0]).toEqual({
      facingMode: "environment",
    });
    expect(Object.keys(scannerState.startSources[0] as Record<string, unknown>)).toEqual(["facingMode"]);
    expect(scannerState.startConfigs[0]).toMatchObject({
      videoConstraints: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    });
  });

  it("scans the full QR camera frame with high-resolution environment constraints", async () => {
    render(
      <StockQrScanner
        open
        title="สแกน QR ข้างขวดเพื่อเบิก"
        showManualEntry={false}
        onClose={vi.fn()}
        onScanned={vi.fn()}
      />,
    );

    await waitFor(() => expect(scannerState.startSources).toHaveLength(1));

    expect(scannerState.startSources[0]).toEqual({ facingMode: "environment" });
    expect(scannerState.startConfigs[0]).toMatchObject({
      fps: 15,
      disableFlip: false,
      videoConstraints: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30, max: 30 },
      },
    });
    expect(scannerState.startConfigs[0]).not.toHaveProperty("qrbox");
    expect(scannerState.startConfigs[0]).not.toHaveProperty("aspectRatio");
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

  it("shows QR guidance after repeated decode misses instead of staying silent", async () => {
    render(
      <StockQrScanner
        open
        title="สแกน QR ข้างขวดเพื่อเบิก"
        showManualEntry={false}
        onClose={vi.fn()}
        onScanned={vi.fn()}
      />,
    );

    await waitFor(() => expect(scannerState.errorCallbacks).toHaveLength(1));
    act(() => {
      for (let index = 0; index < 24; index += 1) {
        scannerState.errorCallbacks[0]("No QR code found");
      }
    });

    expect(await screen.findByText(/ยังอ่าน QR ไม่ได้/)).toBeInTheDocument();
    expect(screen.getByText(/ยังอ่าน QR ไม่ได้ — ให้ QR อยู่ในภาพกล้อง/)).toBeInTheDocument();
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
