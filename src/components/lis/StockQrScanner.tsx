import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeScannerState, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseScannedQrId } from "@/lib/stockUnit";

const READER_ID = "stock-qr-reader";

type ScanMode = "qr" | "barcode";

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

interface Props {
  open: boolean;
  title?: string;
  showManualEntry?: boolean;
  scanMode?: ScanMode;
  onClose: () => void;
  onScanned: (qrId: string) => void;
}

/** เน€เธเธดเธ”เธเธฅเนเธญเธเธญเนเธฒเธ QR เธเธงเธ” เนเธฅเนเธงเธเธทเธ qrId; เธกเธต fallback เธเธฃเธญเธ id เธกเธทเธญ */
export default function StockQrScanner({ open, title = "สแกน QR ขวด", showManualEntry = true, scanMode = "qr", onClose, onScanned }: Props) {
  const [phase, setPhase] = useState<"scanning" | "no-camera" | "error">("scanning");
  const [errorMsg, setErrorMsg] = useState("");
  const [manual, setManual] = useState("");
  const [zoomCaps, setZoomCaps] = useState<{ min: number; max: number; step: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    if (open) {
      setPhase("scanning");
      setErrorMsg("");
      setManual("");
      setZoomCaps(null);
      setZoom(1);
      firedRef.current = false;
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
      // qrbox เนเธซเธเนเธ•เธฒเธกเธเธญ (~80%) โ’ QR เธ—เธตเนเนเธซเธเนเธเธถเนเธเน€เธ•เนเธกเธเธฃเธญเธเนเธ”เนเธเธฒเธเธฃเธฐเธขเธฐเธเธเธ•เธด ~15โ€“20เธเธก.
      // เนเธกเนเธ•เนเธญเธเน€เธญเธฒเน€เธเนเธฒเนเธเธฅเนเธเธเธเธฅเนเธญเธเนเธเธเธฑเธชเนเธกเนเธ•เธดเธ” (เธเธฅเนเธญเธเธซเธฅเธฑเธเนเธเธเธฑเธชเนเธเธฅเนเธเธงเนเธฒ ~10เธเธก.เนเธกเนเนเธ”เน)
      const config = {
        fps: 10,
        qrbox: (vw: number, vh: number) => {
          if (scanMode === "barcode") {
            return {
              width: Math.round(vw * 0.9),
              height: Math.round(Math.min(vh * 0.35, 220)),
            };
          }
          const side = Math.round(Math.min(vw, vh) * 0.8);
          return { width: side, height: side };
        },
      };
      const onScan = (text: string) => {
        if (!active || firedRef.current) return;
        const scannedValue = scanMode === "barcode" ? text.trim() : parseScannedQrId(text);
        if (!scannedValue) return;
        firedRef.current = true;
        onScanned(scannedValue);
      };
      const startWith = (source: MediaTrackConstraints | string) =>
        scanner.start(source, config, onScan, () => {});
      // เธ”เธถเธเนเธเธเธฑเธชเธ•เนเธญเน€เธเธทเนเธญเธ + เน€เธเธดเธ” slider เธเธนเธก เนเธซเนเธเธฑเธ QR เธ—เธตเนเธญเธขเธนเนเนเธเธฅ/เน€เธฅเนเธเนเธ”เนเธ”เธตเธเธถเนเธ
      const tuneCamera = async () => {
        try {
          await scanner.applyVideoConstraints({
            advanced: [{ focusMode: "continuous" }],
          } as unknown as MediaTrackConstraints);
        } catch {
          /* เธเธฅเนเธญเธเนเธกเนเธฃเธญเธเธฃเธฑเธ focusMode โ€” เธเนเธฒเธก */
        }
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
              /* เนเธเนเธเนเธฒ min */
            }
            if (active) {
              setZoomCaps({ min, max, step });
              setZoom(current);
            }
          }
        } catch {
          /* เธเธฅเนเธญเธเนเธกเนเธฃเธญเธเธฃเธฑเธ zoom โ€” เนเธกเนเนเธชเธ”เธ slider */
        }
      };
      try {
        try {
          await startWith({
            facingMode: { exact: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          } as MediaTrackConstraints);
        } catch {
          const cameras = await Html5Qrcode.getCameras();
          if (cameras.length === 0) {
            if (active) setPhase("no-camera");
            return;
          }
          const back = cameras.find((c) => /back|environment|rear|เธซเธฅเธฑเธ|ๅ|่้ข/i.test(c.label));
          const cam = back ?? cameras[cameras.length - 1];
          await startWith(cam.id);
        }
        if (!active) {
          scanner.stop().catch(() => {});
          return;
        }
        scannerRef.current = scanner;
        await tuneCamera();
      } catch {
        if (active) {
          setPhase("error");
          setErrorMsg(showManualEntry ? "เนเธกเนเธชเธฒเธกเธฒเธฃเธ–เน€เธเธดเธ”เธเธฅเนเธญเธเนเธ”เน โ€” เนเธเนเธเนเธญเธเธเธฃเธญเธ id เธ”เนเธฒเธเธฅเนเธฒเธเนเธ—เธเนเธ”เน" : "เนเธกเนเธชเธฒเธกเธฒเธฃเธ–เน€เธเธดเธ”เธเธฅเนเธญเธเนเธ”เน");
        }
      }
    })();

    return () => {
      active = false;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        try {
          const state = s.getState();
          if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
            s.stop().catch(() => {});
          }
        } catch {
          /* ignore */
        }
      }
    };
    // onScanned intentionally omitted โ€” captured in closure; matches QrReceiveModal
    // and avoids camera restarts if a parent passes an unstable handler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, phase, showManualEntry, scanMode]);

  if (!open) return null;

  const submitManual = () => {
    const scannedValue = scanMode === "barcode" ? manual.trim() : parseScannedQrId(manual);
    if (scannedValue) onScanned(scannedValue);
  };

  const onZoom = (v: number) => {
    setZoom(v);
    scannerRef.current
      ?.applyVideoConstraints({ advanced: [{ zoom: v }] } as unknown as MediaTrackConstraints)
      .catch(() => {});
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h2 className="text-base font-bold">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className={phase === "scanning" ? "block" : "hidden"}>
            <div id={READER_ID} className="w-full rounded-lg overflow-hidden border" />
            <p className="mt-2 text-center text-sm text-muted-foreground">
              เน€เธฅเนเธเธเธฅเนเธญเธเนเธเธ—เธตเน QR เธเธเธเธงเธ” โ€” เธ–เธทเธญเธซเนเธฒเธ ~15โ€“20 เธเธก. เนเธกเนเธ•เนเธญเธเน€เธญเธฒเน€เธเนเธฒเนเธเธฅเน
            </p>
            {zoomCaps && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-muted-foreground shrink-0">เธเธนเธก</span>
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
                  {zoom.toFixed(1)}ร—
                </span>
              </div>
            )}
          </div>
          {phase !== "scanning" && <div id={READER_ID} className="hidden" />}

          {phase === "no-camera" && (
            <p className="text-center text-sm text-muted-foreground">เนเธกเนเธเธเธเธฅเนเธญเธเนเธเธญเธธเธเธเธฃเธ“เนเธเธตเน</p>
          )}
          {phase === "error" && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-center text-sm text-destructive flex items-center gap-2 justify-center">
              <AlertCircle className="w-4 h-4" /> {errorMsg}
            </div>
          )}

          {showManualEntry && (
            <div className="border-t pt-4 space-y-2">
              <Label>เธซเธฃเธทเธญเธเธฃเธญเธ/เธงเธฒเธ qrId เน€เธญเธ</Label>
              <div className="flex gap-2">
                <Input
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && manual.trim()) submitManual(); }}
                  placeholder="u_xxxxxxxx เธซเธฃเธทเธญ URL"
                />
                <Button onClick={submitManual} disabled={!manual.trim()}>เธ•เธเธฅเธ</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
