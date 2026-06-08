import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import { AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseScannedQrId } from "@/lib/stockUnit";

const READER_ID = "stock-qr-reader";

interface Props {
  open: boolean;
  title?: string;
  onClose: () => void;
  onScanned: (qrId: string) => void;
}

/** เปิดกล้องอ่าน QR ขวด แล้วคืน qrId; มี fallback กรอก id มือ */
export default function StockQrScanner({ open, title = "สแกน QR ขวด", onClose, onScanned }: Props) {
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
      const scanner = new Html5Qrcode(READER_ID);
      const config = { fps: 10, qrbox: { width: 250, height: 250 } };
      const onScan = (text: string) => {
        if (!active || firedRef.current) return;
        const qrId = parseScannedQrId(text);
        if (!qrId) return;
        firedRef.current = true;
        onScanned(qrId);
      };
      const startWith = (source: MediaTrackConstraints | string) =>
        scanner.start(source, config, onScan, () => {});
      // ดึงโฟกัสต่อเนื่อง + เปิด slider ซูม ให้จับ QR ที่อยู่ไกล/เล็กได้ดีขึ้น
      const tuneCamera = async () => {
        try {
          await scanner.applyVideoConstraints({
            advanced: [{ focusMode: "continuous" }],
          } as unknown as MediaTrackConstraints);
        } catch {
          /* กล้องไม่รองรับ focusMode — ข้าม */
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
              /* ใช้ค่า min */
            }
            if (active) {
              setZoomCaps({ min, max, step });
              setZoom(current);
            }
          }
        } catch {
          /* กล้องไม่รองรับ zoom — ไม่แสดง slider */
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
          const back = cameras.find((c) => /back|environment|rear|หลัง|后|背面/i.test(c.label));
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
          setErrorMsg("ไม่สามารถเปิดกล้องได้ — ใช้ช่องกรอก id ด้านล่างแทนได้");
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
    // onScanned intentionally omitted — captured in closure; matches QrReceiveModal
    // and avoids camera restarts if a parent passes an unstable handler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, phase]);

  if (!open) return null;

  const submitManual = () => {
    const qrId = parseScannedQrId(manual);
    if (qrId) onScanned(qrId);
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
            <p className="mt-2 text-center text-sm text-muted-foreground">เล็งกล้องไปที่ QR บนขวด</p>
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
          {phase !== "scanning" && <div id={READER_ID} className="hidden" />}

          {phase === "no-camera" && (
            <p className="text-center text-sm text-muted-foreground">ไม่พบกล้องในอุปกรณ์นี้</p>
          )}
          {phase === "error" && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-center text-sm text-destructive flex items-center gap-2 justify-center">
              <AlertCircle className="w-4 h-4" /> {errorMsg}
            </div>
          )}

          <div className="border-t pt-4 space-y-2">
            <Label>หรือกรอก/วาง qrId เอง</Label>
            <div className="flex gap-2">
              <Input
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && manual.trim()) submitManual(); }}
                placeholder="u_xxxxxxxx หรือ URL"
              />
              <Button onClick={submitManual} disabled={!manual.trim()}>ตกลง</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
