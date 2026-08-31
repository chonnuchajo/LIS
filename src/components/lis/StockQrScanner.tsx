import { type TouchEvent, useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeScannerState, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { AlertCircle, Flashlight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { decodeQrCanvasWithTryHarder } from "@/lib/qrTryHarderDecoder";
import { parseScannedQrId } from "@/lib/stockUnit";

const READER_ID = "stock-qr-reader";
const QR_DECODE_MISS_THRESHOLD = 24;
const QR_SCAN_FPS = 15;
const BARCODE_SCAN_FPS = 10;
const QR_VIEWFINDER_RATIO = 0.8;
const QR_VIEWFINDER_MIN_SIZE = 220;
const QR_VIEWFINDER_MAX_SIZE = 360;
const QR_FALLBACK_CANVAS_SIZE = 720;
const QR_FALLBACK_SCAN_INTERVAL_MS = 280;
const QR_FALLBACK_CROP_RATIOS = [0.96, 0.78, 0.62] as const;
const QR_FALLBACK_FRAME_MODES = ["normal", "contrast", "binary"] as const;
const QR_FALLBACK_FRAMES = QR_FALLBACK_CROP_RATIOS.flatMap((cropRatio) => (
  QR_FALLBACK_FRAME_MODES.map((mode) => ({ cropRatio, mode }))
));

type ScanMode = "qr" | "barcode";
type QrFallbackFrameMode = typeof QR_FALLBACK_FRAME_MODES[number];
type ExtendedTrackCapabilities = MediaTrackCapabilities & {
  torch?: boolean;
  zoom?: { min?: number; max?: number; step?: number };
};
type ExtendedConstraintSet = MediaTrackConstraintSet & {
  exposureMode?: string;
  focusMode?: string;
  torch?: boolean;
  whiteBalanceMode?: string;
  zoom?: number;
};

export interface DecodedScanResult {
  raw: string;
  value: string;
  scanMode: ScanMode;
}

const QR_FORMATS = [Html5QrcodeSupportedFormats.QR_CODE];
const BARCODE_FORMATS = [
  Html5QrcodeSupportedFormats.CODABAR,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.UPC_EAN_EXTENSION,
];

function preferredCameraConstraints(facingMode: MediaTrackConstraints["facingMode"]): MediaTrackConstraints {
  return {
    facingMode,
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  };
}

function cameraIdConstraints(cameraId: string): MediaTrackConstraints {
  return {
    deviceId: { exact: cameraId },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  };
}

function qrViewfinderDimensions(viewfinderWidth: number, viewfinderHeight: number) {
  const minDimension = Math.max(1, Math.min(viewfinderWidth, viewfinderHeight));
  const minSize = Math.min(QR_VIEWFINDER_MIN_SIZE, minDimension);
  const targetSize = Math.round(minDimension * QR_VIEWFINDER_RATIO);
  const size = Math.round(Math.min(QR_VIEWFINDER_MAX_SIZE, Math.max(minSize, targetSize)));
  return { width: size, height: size };
}

function getReaderVideoElement(): HTMLVideoElement | null {
  return document.getElementById(READER_ID)?.querySelector("video") ?? null;
}

function canReadVideoFrame(video: HTMLVideoElement) {
  return video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0;
}

function otsuThreshold(histogram: number[], total: number) {
  let sum = 0;
  for (let level = 0; level < histogram.length; level += 1) {
    sum += level * histogram[level];
  }

  let backgroundWeight = 0;
  let backgroundSum = 0;
  let maxVariance = 0;
  let threshold = 128;

  for (let level = 0; level < histogram.length; level += 1) {
    backgroundWeight += histogram[level];
    if (backgroundWeight === 0) continue;

    const foregroundWeight = total - backgroundWeight;
    if (foregroundWeight === 0) break;

    backgroundSum += level * histogram[level];
    const backgroundMean = backgroundSum / backgroundWeight;
    const foregroundMean = (sum - backgroundSum) / foregroundWeight;
    const variance = backgroundWeight * foregroundWeight * (backgroundMean - foregroundMean) ** 2;

    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = level;
    }
  }

  return threshold;
}

function binarizeFallbackCanvas(context: CanvasRenderingContext2D, size: number) {
  const image = context.getImageData(0, 0, size, size);
  const { data } = image;
  const histogram = Array.from({ length: 256 }, () => 0);

  for (let index = 0; index < data.length; index += 4) {
    const luminance = Math.round((data[index] * 0.299) + (data[index + 1] * 0.587) + (data[index + 2] * 0.114));
    histogram[luminance] += 1;
  }

  const threshold = otsuThreshold(histogram, size * size);

  for (let index = 0; index < data.length; index += 4) {
    const luminance = Math.round((data[index] * 0.299) + (data[index + 1] * 0.587) + (data[index + 2] * 0.114));
    const value = luminance > threshold ? 255 : 0;
    data[index] = value;
    data[index + 1] = value;
    data[index + 2] = value;
    data[index + 3] = 255;
  }

  context.putImageData(image, 0, 0);
}

function drawFallbackFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement, cropRatio: number, mode: QrFallbackFrameMode) {
  if (!canReadVideoFrame(video)) return false;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return false;

  if (canvas.width !== QR_FALLBACK_CANVAS_SIZE || canvas.height !== QR_FALLBACK_CANVAS_SIZE) {
    canvas.width = QR_FALLBACK_CANVAS_SIZE;
    canvas.height = QR_FALLBACK_CANVAS_SIZE;
  }

  const sourceSize = Math.max(1, Math.min(video.videoWidth, video.videoHeight) * cropRatio);
  const sourceX = (video.videoWidth - sourceSize) / 2;
  const sourceY = (video.videoHeight - sourceSize) / 2;

  context.save();
  context.clearRect(0, 0, QR_FALLBACK_CANVAS_SIZE, QR_FALLBACK_CANVAS_SIZE);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.filter = mode === "normal" ? "none" : "grayscale(1) contrast(1.65) brightness(1.08)";
  context.drawImage(
    video,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    0,
    0,
    QR_FALLBACK_CANVAS_SIZE,
    QR_FALLBACK_CANVAS_SIZE,
  );
  context.restore();

  if (mode === "binary") {
    binarizeFallbackCanvas(context, QR_FALLBACK_CANVAS_SIZE);
  }

  return true;
}

function decodeFallbackFrame(canvas: HTMLCanvasElement, frameIndex: number) {
  const video = getReaderVideoElement();
  if (!video) return "";

  const frame = QR_FALLBACK_FRAMES[frameIndex % QR_FALLBACK_FRAMES.length];
  try {
    if (!drawFallbackFrame(video, canvas, frame.cropRatio, frame.mode)) return "";
    return decodeQrCanvasWithTryHarder(canvas);
  } catch {
    return "";
  }
}

function touchDistance(touches: TouchList) {
  const first = touches[0];
  const second = touches[1];
  if (!first || !second) return 0;
  return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
}

interface Props {
  open: boolean;
  title?: string;
  showManualEntry?: boolean;
  scanMode?: ScanMode;
  onClose: () => void;
  onDecoded?: (result: DecodedScanResult) => void;
  onScanned: (qrId: string) => void;
}

function scanHint(scanMode: ScanMode) {
  if (scanMode === "barcode") {
    return "เล็งกล้องไปที่ Barcode ให้เส้นอยู่ในกรอบ — ถือให้นิ่งและมีแสงเพียงพอ";
  }
  return "เล็งกล้องไปที่ QR บนขวด — ถือห่าง ~15–20 ซม. ไม่ต้องเอาเข้าใกล้";
}

function cameraErrorMessage(scanMode: ScanMode, showManualEntry: boolean) {
  const target = scanMode === "barcode" ? "Barcode" : "QR";
  if (showManualEntry) {
    return `เปิดกล้องไม่ได้ กรุณาอนุญาตการใช้งานกล้องในเบราว์เซอร์ หรือกรอก/วาง ${target} ด้านล่างแทน`;
  }
  return `เปิดกล้องไม่ได้ กรุณาอนุญาตการใช้งานกล้องในเบราว์เซอร์ แล้วลองใหม่อีกครั้ง หรือปิดหน้าต่างนี้แล้วกรอก ${target} ในช่องค้นหา`;
}

function cameraErrorDetail(error: unknown) {
  if (!error) return "";
  if (error instanceof Error) {
    const name = error.name && error.name !== "Error" ? error.name : "";
    const message = error.message || "";
    if (name && message) return `${name} — ${message}`;
    return name || message;
  }
  return String(error);
}

export default function StockQrScanner({
  open,
  title = "สแกน QR ขวด",
  showManualEntry = true,
  scanMode = "qr",
  onClose,
  onDecoded,
  onScanned,
}: Props) {
  const [phase, setPhase] = useState<"scanning" | "no-camera" | "error">("scanning");
  const [errorMsg, setErrorMsg] = useState("");
  const [errorDetail, setErrorDetail] = useState("");
  const [manual, setManual] = useState("");
  const [scanFeedback, setScanFeedback] = useState("");
  const [zoomCaps, setZoomCaps] = useState<{ min: number; max: number; step: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const firedRef = useRef(false);
  const decodeMissCountRef = useRef(0);
  const fallbackCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fallbackFrameIndexRef = useRef(0);
  const fallbackIntervalRef = useRef<number | null>(null);
  const zoomCapsRef = useRef<{ min: number; max: number; step: number } | null>(null);
  const zoomRef = useRef(1);
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const onScannedRef = useRef(onScanned);
  const onDecodedRef = useRef(onDecoded);

  useEffect(() => {
    onScannedRef.current = onScanned;
  }, [onScanned]);

  useEffect(() => {
    onDecodedRef.current = onDecoded;
  }, [onDecoded]);

  useEffect(() => {
    if (open) {
      setPhase("scanning");
      setErrorMsg("");
      setErrorDetail("");
      setManual("");
      setScanFeedback("");
      setZoomCaps(null);
      setZoom(1);
      setTorchSupported(false);
      setTorchOn(false);
      firedRef.current = false;
      decodeMissCountRef.current = 0;
      fallbackFrameIndexRef.current = 0;
      zoomCapsRef.current = null;
      zoomRef.current = 1;
    }
  }, [open]);

  const setZoomCapsState = useCallback((caps: { min: number; max: number; step: number } | null) => {
    zoomCapsRef.current = caps;
    setZoomCaps(caps);
  }, []);

  const setZoomState = useCallback((value: number) => {
    zoomRef.current = value;
    setZoom(value);
  }, []);

  const stopFallbackScan = useCallback(() => {
    if (fallbackIntervalRef.current !== null) {
      window.clearInterval(fallbackIntervalRef.current);
      fallbackIntervalRef.current = null;
    }
    fallbackCanvasRef.current = null;
  }, []);

  const startFallbackScan = useCallback((onScan: (text: string) => void) => {
    stopFallbackScan();
    if (scanMode !== "qr") return;

    fallbackCanvasRef.current = document.createElement("canvas");
    fallbackIntervalRef.current = window.setInterval(() => {
      if (firedRef.current) {
        stopFallbackScan();
        return;
      }

      const canvas = fallbackCanvasRef.current;
      if (!canvas) return;

      const text = decodeFallbackFrame(canvas, fallbackFrameIndexRef.current);
      fallbackFrameIndexRef.current = (fallbackFrameIndexRef.current + 1) % QR_FALLBACK_FRAMES.length;
      if (text) onScan(text);
    }, QR_FALLBACK_SCAN_INTERVAL_MS);
  }, [scanMode, stopFallbackScan]);

  const clampZoom = useCallback((value: number) => {
    const caps = zoomCapsRef.current;
    if (!caps) return value;
    const clamped = Math.min(caps.max, Math.max(caps.min, value));
    return Number(clamped.toFixed(2));
  }, []);

  const applyZoom = useCallback((value: number) => {
    const next = clampZoom(value);
    setZoomState(next);
    scannerRef.current
      ?.applyVideoConstraints({ advanced: [{ zoom: next } as ExtendedConstraintSet] } as unknown as MediaTrackConstraints)
      .catch(() => {});
  }, [clampZoom, setZoomState]);

  const toggleTorch = useCallback(() => {
    const scanner = scannerRef.current;
    if (!scanner) return;

    const next = !torchOn;
    setTorchOn(next);
    scanner
      .applyVideoConstraints({ advanced: [{ torch: next } as ExtendedConstraintSet] } as unknown as MediaTrackConstraints)
      .catch(() => setTorchOn(!next));
  }, [torchOn]);

  useEffect(() => {
    if (!open || phase !== "scanning") return;
    let active = true;

    (async () => {
      const scanner = new Html5Qrcode(READER_ID, {
        formatsToSupport: scanMode === "barcode" ? BARCODE_FORMATS : QR_FORMATS,
        useBarCodeDetectorIfSupported: true,
        verbose: false,
      });
      const config = scanMode === "barcode" ? {
        fps: BARCODE_SCAN_FPS,
        qrbox: (vw: number, vh: number) => {
          return {
            width: Math.round(vw * 0.9),
            height: Math.round(Math.min(vh * 0.35, 220)),
          };
        },
      } : {
        fps: QR_SCAN_FPS,
        qrbox: qrViewfinderDimensions,
        aspectRatio: 1.0,
        disableFlip: false,
      };
      const preferredVideoConstraints = preferredCameraConstraints({ ideal: "environment" });
      const exactEnvironmentVideoConstraints = preferredCameraConstraints({ exact: "environment" });
      const onScan = (text: string) => {
        if (!active || firedRef.current) return;
        const scannedValue = scanMode === "barcode" ? text.trim() : parseScannedQrId(text);
        if (!scannedValue) return;
        firedRef.current = true;
        decodeMissCountRef.current = 0;
        setScanFeedback("");
        stopFallbackScan();
        onDecodedRef.current?.({ raw: text, value: scannedValue, scanMode });
        onScannedRef.current(scannedValue);
      };
      const onDecodeMiss = () => {
        if (!active || firedRef.current || scanMode !== "qr") return;
        decodeMissCountRef.current += 1;
        if (decodeMissCountRef.current === QR_DECODE_MISS_THRESHOLD) {
          setScanFeedback("ยังอ่าน QR ไม่ได้ — จัด QR ให้อยู่กลางกรอบ ลดเงาสะท้อน ขยับช้า ๆ ให้ภาพคม หรือเปิดไฟช่วยสแกนถ้ามี");
        }
      };
      const startWith = (
        source: MediaTrackConstraints | string,
        startConfig: typeof config & { videoConstraints?: MediaTrackConstraints } = config,
      ) => scanner.start(source, startConfig, onScan, onDecodeMiss);
      const tuneCamera = async () => {
        await scanner.applyVideoConstraints({
          advanced: [{ focusMode: "continuous", exposureMode: "continuous", whiteBalanceMode: "continuous" } as ExtendedConstraintSet],
        } as unknown as MediaTrackConstraints).catch(() => undefined);
        try {
          const caps = scanner.getRunningTrackCapabilities() as ExtendedTrackCapabilities;
          if (active) setTorchSupported(scanMode === "qr" && caps.torch === true);
          if (caps?.zoom && typeof caps.zoom.max === "number") {
            const min = caps.zoom.min ?? 1;
            const max = caps.zoom.max;
            const step = caps.zoom.step || 0.1;
            let current = min;
            try {
              current = (scanner.getRunningTrackSettings() as MediaTrackSettings & { zoom?: number })?.zoom ?? min;
            } catch {
              current = min;
            }
            if (active) {
              setZoomCapsState({ min, max, step });
              setZoomState(current);
            }
          } else if (active) {
            setZoomCapsState(null);
          }
        } catch {
          if (active) {
            setZoomCapsState(null);
            setTorchSupported(false);
          }
        }
      };
      let lastStartError: unknown = null;
      try {
        try {
          if (scanMode === "qr") {
            await startWith({ facingMode: { exact: "environment" } }, {
              ...config,
              videoConstraints: exactEnvironmentVideoConstraints,
            });
          } else {
            await startWith({ facingMode: "environment" }, {
              ...config,
              videoConstraints: preferredVideoConstraints,
            });
          }
        } catch (error) {
          lastStartError = error;
          try {
            const cameras = await Html5Qrcode.getCameras();
            if (cameras.length === 0) {
              if (active) setPhase("no-camera");
              return;
            }
            const back = cameras.find((camera) => /back|environment|rear|หลัง|後|背面/i.test(camera.label));
            const camera = back ?? cameras[cameras.length - 1];
            await startWith(camera.id, {
              ...config,
              videoConstraints: cameraIdConstraints(camera.id),
            });
          } catch (fallbackError) {
            lastStartError = fallbackError;
            throw fallbackError;
          }
        }
        if (!active) {
          scanner.stop().catch(() => {});
          return;
        }
        scannerRef.current = scanner;
        await tuneCamera();
        startFallbackScan(onScan);
      } catch (error) {
        if (active) {
          setPhase("error");
          setErrorMsg(cameraErrorMessage(scanMode, showManualEntry));
          setErrorDetail(cameraErrorDetail(error || lastStartError));
        }
      }
    })();

    return () => {
      active = false;
      stopFallbackScan();
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) {
        try {
          const state = scanner.getState();
          if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
            scanner.stop().catch(() => {});
          }
        } catch {
          return;
        }
      }
    };
  }, [open, phase, scanMode, setZoomCapsState, setZoomState, showManualEntry, startFallbackScan, stopFallbackScan]);

  if (!open) return null;

  const submitManual = () => {
    const scannedValue = scanMode === "barcode" ? manual.trim() : parseScannedQrId(manual);
    if (scannedValue) {
      onDecodedRef.current?.({ raw: manual.trim(), value: scannedValue, scanMode });
      onScannedRef.current(scannedValue);
    }
  };

  const retryCamera = () => {
    stopFallbackScan();
    setErrorMsg("");
    setErrorDetail("");
    setScanFeedback("");
    setZoomCapsState(null);
    setZoomState(1);
    setTorchSupported(false);
    setTorchOn(false);
    firedRef.current = false;
    decodeMissCountRef.current = 0;
    fallbackFrameIndexRef.current = 0;
    setPhase("scanning");
  };

  const onZoom = (value: number) => {
    applyZoom(value);
  };

  const onCameraTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (!zoomCaps || event.touches.length !== 2) return;
    const distance = touchDistance(event.touches);
    if (distance <= 0) return;
    event.preventDefault();
    pinchRef.current = { distance, zoom };
  };

  const onCameraTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (!zoomCaps || !pinchRef.current || event.touches.length !== 2) return;
    const distance = touchDistance(event.touches);
    if (distance <= 0) return;
    event.preventDefault();
    applyZoom(pinchRef.current.zoom * (distance / pinchRef.current.distance));
  };

  const clearPinch = () => {
    pinchRef.current = null;
  };

  const manualLabel = scanMode === "barcode" ? "หรือกรอก/วาง Barcode เอง" : "หรือวางลิงก์/qrId เอง";
  const manualPlaceholder = scanMode === "barcode" ? "Barcode" : "u_xxxxxxxx หรือ URL";

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h2 className="text-base font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="ปิดหน้าต่างสแกน">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className={phase === "scanning" ? "block" : "hidden"}>
            <div
              data-testid="stock-qr-camera-frame"
              className="relative touch-none overflow-hidden overscroll-contain rounded-lg border bg-black"
              style={{ touchAction: "none" }}
              onTouchStart={onCameraTouchStart}
              onTouchMove={onCameraTouchMove}
              onTouchEnd={clearPinch}
              onTouchCancel={clearPinch}
            >
              <div id={READER_ID} className="w-full" />
              {scanMode === "qr" && (
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-[80%] max-h-80 min-h-44 w-[80%] max-w-80 min-w-44 rounded-2xl border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.16)]" />
                </div>
              )}
            </div>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              {scanHint(scanMode)}
            </p>
            {scanFeedback && (
              <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs text-amber-700">
                {scanFeedback}
              </p>
            )}
            {torchSupported && (
              <Button
                type="button"
                size="sm"
                variant={torchOn ? "default" : "outline"}
                onClick={toggleTorch}
                className="mt-3 w-full"
              >
                <Flashlight className="h-4 w-4" aria-hidden="true" />
                {torchOn ? "ปิดไฟช่วยสแกน" : "เปิดไฟช่วยสแกน"}
              </Button>
            )}
            {zoomCaps && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-muted-foreground shrink-0">ซูม</span>
                <input
                  type="range"
                  min={zoomCaps.min}
                  max={zoomCaps.max}
                  step={zoomCaps.step}
                  value={zoom}
                  onChange={(e) => onZoom(Number(e.target.value))}
                  className="flex-1 accent-lis-sidebar"
                />
                <span className="text-xs text-muted-foreground w-10 text-right tabular-nums">
                  {zoom.toFixed(1)}×
                </span>
              </div>
            )}
          </div>

          {phase === "no-camera" && (
            <p className="text-center text-sm text-muted-foreground">ไม่พบกล้องในอุปกรณ์นี้</p>
          )}
          {phase === "error" && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-center text-sm text-destructive space-y-2">
              <div className="flex items-center gap-2 justify-center">
                <AlertCircle className="w-4 h-4" />
                <span>{errorMsg}</span>
              </div>
              {errorDetail && <div className="text-xs opacity-90">รายละเอียด: {errorDetail}</div>}
              <Button type="button" size="sm" variant="outline" onClick={retryCamera}>
                ลองเปิดกล้องอีกครั้ง
              </Button>
            </div>
          )}

          {showManualEntry && (
            <div className="border-t pt-4 space-y-2">
              <Label>{manualLabel}</Label>
              <div className="flex gap-2">
                <Input
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && manual.trim()) submitManual(); }}
                  placeholder={manualPlaceholder}
                />
                <Button onClick={submitManual} disabled={!manual.trim()}>ตกลง</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
