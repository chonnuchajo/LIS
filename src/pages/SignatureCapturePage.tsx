import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2, Eraser, Save, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/lis/AppLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import {
  SIGNATURE_DEVICE_UNSUPPORTED_MESSAGE,
  canManageSignature,
  isSignatureDeviceSupported,
} from "@/lib/signatureAccess";

type Point = { x: number; y: number };

const CANVAS_HEIGHT = 280;

function pointFromEvent(canvas: HTMLCanvasElement, event: ReactPointerEvent<HTMLCanvasElement>): Point {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function prepareContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const rect = canvas.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;
  const width = Math.max(280, Math.floor(rect.width));
  const height = Math.max(220, Math.floor(rect.height || CANVAS_HEIGHT));

  canvas.width = Math.floor(width * pixelRatio);
  canvas.height = Math.floor(height * pixelRatio);
  canvas.style.height = `${height}px`;

  const context = canvas.getContext("2d");
  if (!context) return null;
  context.scale(pixelRatio, pixelRatio);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = 3;
  context.strokeStyle = "#111827";
  return context;
}

const SignatureCapturePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const [deviceSupported, setDeviceSupported] = useState(() => isSignatureDeviceSupported());
  const [hasInk, setHasInk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState(user?.signatureUrl || "");

  const canAddSignature = canManageSignature(user);

  const resetCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    prepareContext(canvas);
    setHasInk(false);
  }, []);

  useEffect(() => {
    const supported = isSignatureDeviceSupported();
    setDeviceSupported(supported);
    if (!supported) toast.error(SIGNATURE_DEVICE_UNSUPPORTED_MESSAGE);
  }, []);

  useLayoutEffect(() => {
    if (!canAddSignature || !deviceSupported) return;
    resetCanvas();
    window.addEventListener("resize", resetCanvas);
    return () => window.removeEventListener("resize", resetCanvas);
  }, [canAddSignature, deviceSupported, resetCanvas]);

  const startDrawing = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!deviceSupported || saving) return;
    const canvas = event.currentTarget;
    const point = pointFromEvent(canvas, event);
    drawingRef.current = true;
    lastPointRef.current = point;
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const draw = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = event.currentTarget;
    const context = canvas.getContext("2d");
    const lastPoint = lastPointRef.current;
    if (!context || !lastPoint) return;

    const point = pointFromEvent(canvas, event);
    context.beginPath();
    context.moveTo(lastPoint.x, lastPoint.y);
    context.lineTo(point.x, point.y);
    context.stroke();
    lastPointRef.current = point;
    setHasInk(true);
    event.preventDefault();
  };

  const stopDrawing = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    drawingRef.current = false;
    lastPointRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const saveSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasInk) {
      toast.error("กรุณาเซ็นก่อนบันทึก");
      return;
    }

    setSaving(true);
    try {
      const result = await api.saveMySignature(canvas.toDataURL("image/png"));
      setSignatureUrl(result.signatureUrl || "");
      toast.success("บันทึกลายเซ็นแล้ว");
    } catch (error) {
      const message = error instanceof Error ? error.message : "บันทึกลายเซ็นไม่สำเร็จ";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (!canAddSignature) {
    return (
      <AppLayout title="ลายเซ็น">
        <Alert variant="destructive" className="max-w-xl">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>ไม่มีสิทธิ์เพิ่มลายเซ็น</AlertTitle>
          <AlertDescription>เมนูนี้ใช้ได้เฉพาะ admin, LAB HEAD และ QC HEAD</AlertDescription>
        </Alert>
      </AppLayout>
    );
  }

  if (!deviceSupported) {
    return (
      <AppLayout title="ลายเซ็น">
        <Alert variant="destructive" className="max-w-xl">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>อุปกรณ์นี้ไม่รองรับ</AlertTitle>
          <AlertDescription>{SIGNATURE_DEVICE_UNSUPPORTED_MESSAGE}</AlertDescription>
        </Alert>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="เพิ่มลายเซ็น" mainClassName="p-4 sm:p-6 overflow-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>เพิ่มลายเซ็น</CardTitle>
            <CardDescription>เซ็นด้วยนิ้วหรือ Apple Pencil แล้วกดบันทึก</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {signatureUrl ? (
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="mb-2 text-sm font-medium text-foreground">ลายเซ็นปัจจุบัน</p>
                <img src={signatureUrl} alt="ลายเซ็นปัจจุบัน" className="max-h-24 rounded bg-white object-contain p-2" />
              </div>
            ) : null}

            <div className="rounded-xl border bg-white p-2 shadow-inner">
              <canvas
                ref={canvasRef}
                aria-label="พื้นที่เซ็นลายเซ็น"
                className="h-[280px] w-full touch-none rounded-lg bg-white"
                onPointerDown={startDrawing}
                onPointerMove={draw}
                onPointerUp={stopDrawing}
                onPointerCancel={stopDrawing}
                onPointerLeave={(event) => {
                  if (drawingRef.current) stopDrawing(event);
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">ระบบรองรับ Tablet, iPad และโทรศัพท์เท่านั้น ถ้าเปิดบนคอมพิวเตอร์จะถูกบล็อก</p>
          </CardContent>
          <CardFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button type="button" variant="outline" onClick={() => navigate(-1)} className="w-full sm:w-auto">
              กลับ
            </Button>
            <div className="flex w-full gap-2 sm:w-auto">
              <Button type="button" variant="outline" onClick={resetCanvas} className="flex-1 sm:flex-none" disabled={saving}>
                <Eraser />
                ล้าง
              </Button>
              <Button type="button" onClick={saveSignature} className="flex-1 sm:flex-none" disabled={saving || !hasInk}>
                {saving ? <CheckCircle2 /> : <Save />}
                {saving ? "กำลังบันทึก" : "บันทึกลายเซ็น"}
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </AppLayout>
  );
};

export default SignatureCapturePage;
