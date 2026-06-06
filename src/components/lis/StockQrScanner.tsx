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
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    if (open) {
      setPhase("scanning");
      setErrorMsg("");
      setManual("");
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
      try {
        try {
          await startWith({ facingMode: { exact: "environment" } });
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
