import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import StockQrScanner from "../StockQrScanner";

const html5QrMock = vi.hoisted(() => {
  const start = vi.fn().mockResolvedValue(undefined);
  const stop = vi.fn().mockResolvedValue(undefined);
  const applyVideoConstraints = vi.fn().mockResolvedValue(undefined);
  const getRunningTrackCapabilities = vi.fn().mockReturnValue({});
  const getRunningTrackSettings = vi.fn().mockReturnValue({});
  const getState = vi.fn().mockReturnValue(0);
  const getCameras = vi.fn().mockResolvedValue([
    { id: "front-camera", label: "Front Camera" },
    { id: "back-camera", label: "Back Camera" },
  ]);

  return {
    start,
    stop,
    applyVideoConstraints,
    getRunningTrackCapabilities,
    getRunningTrackSettings,
    getState,
    getCameras,
  };
});

vi.mock("html5-qrcode", () => ({
  Html5Qrcode: Object.assign(vi.fn().mockImplementation(() => html5QrMock), {
    getCameras: html5QrMock.getCameras,
  }),
  Html5QrcodeScannerState: { SCANNING: 2, PAUSED: 3 },
  Html5QrcodeSupportedFormats: {
    QR_CODE: 0,
    CODABAR: 1,
    CODE_39: 2,
    CODE_93: 3,
    CODE_128: 4,
    ITF: 5,
    EAN_13: 6,
    EAN_8: 7,
    UPC_A: 8,
    UPC_E: 9,
    UPC_EAN_EXTENSION: 10,
  },
}));

describe("StockQrScanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    html5QrMock.getRunningTrackCapabilities.mockReturnValue({});
    html5QrMock.getRunningTrackSettings.mockReturnValue({});
  });

  it("starts QR scanning with a large viewfinder and high-resolution environment camera constraints", async () => {
    render(
      <StockQrScanner
        open
        onClose={() => {}}
        onScanned={() => {}}
      />,
    );

    await waitFor(() => expect(html5QrMock.start).toHaveBeenCalled());

    expect(html5QrMock.start.mock.calls[0][1]).toMatchObject({
      fps: 15,
      aspectRatio: 1.0,
      disableFlip: false,
      videoConstraints: {
        facingMode: { exact: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    });
    expect(html5QrMock.start.mock.calls[0][1]).toHaveProperty("qrbox");
    expect((html5QrMock.start.mock.calls[0][1] as { qrbox: (width: number, height: number) => { width: number; height: number } }).qrbox(360, 320)).toEqual({
      width: 256,
      height: 256,
    });
  });

  it("keeps high-resolution constraints when falling back to a listed back camera", async () => {
    html5QrMock.start
      .mockRejectedValueOnce(new Error("exact environment camera unavailable"))
      .mockResolvedValueOnce(undefined);

    render(
      <StockQrScanner
        open
        onClose={() => {}}
        onScanned={() => {}}
      />,
    );

    await waitFor(() => expect(html5QrMock.start).toHaveBeenCalledTimes(2));

    expect(html5QrMock.start.mock.calls[1][0]).toBe("back-camera");
    expect(html5QrMock.start.mock.calls[1][1]).toMatchObject({
      videoConstraints: {
        deviceId: { exact: "back-camera" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    });
  });

  it("applies initial QR zoom when the camera supports zoom", async () => {
    html5QrMock.getRunningTrackCapabilities.mockReturnValue({ zoom: { min: 1, max: 4, step: 0.1 } });
    html5QrMock.getRunningTrackSettings.mockReturnValue({ zoom: 1 });

    render(
      <StockQrScanner
        open
        onClose={() => {}}
        onScanned={() => {}}
      />,
    );

    await waitFor(() => {
      expect(html5QrMock.applyVideoConstraints).toHaveBeenCalledWith({ advanced: [{ zoom: 2 }] });
    });
  });

  it("zooms the camera with a two-finger pinch gesture without page panning", async () => {
    html5QrMock.getRunningTrackCapabilities.mockReturnValue({ zoom: { min: 1, max: 4, step: 0.1 } });
    html5QrMock.getRunningTrackSettings.mockReturnValue({ zoom: 1 });

    render(
      <StockQrScanner
        open
        onClose={() => {}}
        onScanned={() => {}}
      />,
    );

    expect(await screen.findByText("2.0×")).toBeInTheDocument();
    const cameraFrame = screen.getByTestId("stock-qr-camera-frame");

    expect(cameraFrame).toHaveClass("touch-none", "overscroll-contain");
    html5QrMock.applyVideoConstraints.mockClear();

    fireEvent.touchStart(cameraFrame, {
      touches: [
        { clientX: 0, clientY: 0 },
        { clientX: 100, clientY: 0 },
      ],
    });
    fireEvent.touchMove(cameraFrame, {
      touches: [
        { clientX: 0, clientY: 0 },
        { clientX: 150, clientY: 0 },
      ],
    });

    expect(html5QrMock.applyVideoConstraints).toHaveBeenCalledWith({ advanced: [{ zoom: 3 }] });
    expect(screen.getByText("3.0×")).toBeInTheDocument();
  });

  it("reports both raw decoded QR text and parsed qrId", async () => {
    const onDecoded = vi.fn();
    const onScanned = vi.fn();

    render(
      <StockQrScanner
        open
        onClose={() => {}}
        onDecoded={onDecoded}
        onScanned={onScanned}
      />,
    );

    await waitFor(() => expect(html5QrMock.start).toHaveBeenCalled());
    const successCallback = html5QrMock.start.mock.calls[0][2] as (text: string) => void;
    successCallback("https://app-plant.icpladda.com/LIS/stock/view?qrId=u_scan");

    expect(onDecoded).toHaveBeenCalledWith({
      raw: "https://app-plant.icpladda.com/LIS/stock/view?qrId=u_scan",
      value: "u_scan",
      scanMode: "qr",
    });
    expect(onScanned).toHaveBeenCalledWith("u_scan");
  });

  it("parses a manually pasted stock link into qrId", async () => {
    const onDecoded = vi.fn();
    const onScanned = vi.fn();

    render(
      <StockQrScanner
        open
        onClose={() => {}}
        onDecoded={onDecoded}
        onScanned={onScanned}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("u_xxxxxxxx หรือ URL"), {
      target: { value: "https://app-plant.icpladda.com/LIS/stock/view?qrId=u_ea3be3c6fb7b" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ตกลง" }));

    expect(onDecoded).toHaveBeenCalledWith({
      raw: "https://app-plant.icpladda.com/LIS/stock/view?qrId=u_ea3be3c6fb7b",
      value: "u_ea3be3c6fb7b",
      scanMode: "qr",
    });
    expect(onScanned).toHaveBeenCalledWith("u_ea3be3c6fb7b");
  });
});
