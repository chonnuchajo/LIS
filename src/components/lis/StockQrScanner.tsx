import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeScannerState, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseScannedQrId } from "@/lib/stockUnit";

const READER_ID = "stock-qr-reader";
const QR_DECODE_MISS_THRESHOLD = 24;
const QR_INITIAL_ZOOM = 2;

type ScanMode = "qr" | "barcode";

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
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const firedRef = useRef(false);
  const decodeMissCountRef = useRef(0);
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
      firedRef.current = false;
      decodeMissCountRef.current = 0;
    }
  }, [open]);

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
        fps: 10,
        qrbox: (vw: number, vh: number) => {
          return {
            width: Math.round(vw * 0.9),
            height: Math.round(Math.min(vh * 0.35, 220)),
          };
        },
      } : {
        fps: 10,
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
        onDecodedRef.current?.({ raw: text, value: scannedValue, scanMode });
        onScannedRef.current(scannedValue);
      };
      const onDecodeMiss = () => {
        if (!active || firedRef.current || scanMode !== "qr") return;
        decodeMissCountRef.current += 1;
        if (decodeMissCountRef.current === QR_DECODE_MISS_THRESHOLD) {
          setScanFeedback("ยังอ่าน QR ไม่ได้ — จัด QR ให้อยู่กลางกรอบ ถอย/ขยับช้า ๆ ให้ภาพคม แล้วลองเปิดไฟเพิ่ม");
        }
      };
      const startWith = (
        source: MediaTrackConstraints | string,
        startConfig: typeof config & { videoConstraints?: MediaTrackConstraints } = config,
      ) => scanner.start(source, startConfig, onScan, onDecodeMiss);
      const tuneCamera = async () => {
        await scanner.applyVideoConstraints({
          advanced: [{ focusMode: "continuous" }],
        } as unknown as MediaTrackConstraints).catch(() => undefined);
        try {
          const caps = scanner.getRunningTrackCapabilities() as MediaTrackCapabilities & {
            zoom?: { min: number; max: number; step?: number };
          };
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
            if (scanMode === "qr") {
              const targetZoom = Math.min(max, Math.max(min, QR_INITIAL_ZOOM));
              if (targetZoom > current) {
                await scanner.applyVideoConstraints({ advanced: [{ zoom: targetZoom }] } as unknown as MediaTrackConstraints).catch(() => undefined);
                current = targetZoom;
              }
            }
            if (active) {
              setZoomCaps({ min, max, step });
              setZoom(current);
            }
          }
        } catch {
          if (active) setZoomCaps(null);
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
  }, [open, phase, showManualEntry, scanMode]);

  if (!open) return null;

  const submitManual = () => {
    const scannedValue = scanMode === "barcode" ? manual.trim() : parseScannedQrId(manual);
    if (scannedValue) {
      onDecodedRef.current?.({ raw: manual.trim(), value: scannedValue, scanMode });
      onScannedRef.current(scannedValue);
    }
  };

  const retryCamera = () => {
    setErrorMsg("");
    setErrorDetail("");
    setScanFeedback("");
    setZoomCaps(null);
    setZoom(1);
    firedRef.current = false;
    decodeMissCountRef.current = 0;
    setPhase("scanning");
  };

  const onZoom = (value: number) => {
    setZoom(value);
    scannerRef.current
      ?.applyVideoConstraints({ advanced: [{ zoom: value }] } as unknown as MediaTrackConstraints)
      .catch(() => {});
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
            <div className="relative overflow-hidden rounded-lg border bg-black">
              <div id={READER_ID} className="w-full" />
              {scanMode === "qr" && (
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-[68%] max-h-72 min-h-44 w-[68%] max-w-72 min-w-44 rounded-2xl border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.16)]" />
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
