import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Maximize2, Minus, Plus, Printer, ZoomIn, ZoomOut } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { printDocument } from "@/lib/print";
import {
  defaultPrinterFor,
  docTypeToKind,
  getPrintDocType,
  getPrintOutputModeForDocType,
  type PrintDocType,
  type PrintOutputMode,
} from "@/lib/printConfig";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  docType: PrintDocType;
  css?: string;
  children: React.ReactNode;
  onPrinted?: (meta: { copies: number; outputMode: PrintOutputMode }) => void;
}

const BOX_CHROME = 18;
const MIN_PREVIEW_HEIGHT = 180;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.1;

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(value.toFixed(2))));
}

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")
  );
}

function getSheetSize(printEl: HTMLDivElement | null, contentEl: HTMLDivElement) {
  const firstSheet = printEl?.querySelector<HTMLElement>(
    "section, .label-page, .lr-page, .pr-page1, .pr-page2, .rr-page, .gr-page1",
  );
  const target = firstSheet ?? printEl ?? contentEl;
  return {
    width: target.scrollWidth || target.offsetWidth || contentEl.scrollWidth,
    height: target.scrollHeight || target.offsetHeight || contentEl.scrollHeight,
  };
}

function ScaledPreview({
  printRef,
  previewClassName,
  children,
}: {
  printRef: React.RefObject<HTMLDivElement>;
  previewClassName?: string;
  children: React.ReactNode;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [naturalHeight, setNaturalHeight] = useState(0);
  const [naturalWidth, setNaturalWidth] = useState(0);
  const scale = fitScale * zoom;

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const content = contentRef.current;
    if (!outer || !content) return;

    const measure = () => {
      const availW = outer.clientWidth - BOX_CHROME;
      const availH = Math.max(MIN_PREVIEW_HEIGHT, outer.clientHeight - BOX_CHROME);
      const natW = content.scrollWidth;
      const natH = content.scrollHeight;
      const sheet = getSheetSize(printRef.current, content);
      const widthScale = sheet.width > 0 ? availW / sheet.width : 1;
      const heightScale = sheet.height > 0 ? availH / sheet.height : 1;
      setFitScale(Math.min(widthScale, heightScale));
      setNaturalWidth(natW);
      setNaturalHeight(natH);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    ro.observe(content);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [children, printRef]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isShortcut = event.ctrlKey || event.metaKey;
      const activeEditable = isEditableTarget(document.activeElement);
      if (!isShortcut && activeEditable) return;

      if (event.key === "+" || (isShortcut && event.key === "=")) {
        event.preventDefault();
        setZoom((value) => clampZoom(value + ZOOM_STEP));
        return;
      }

      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        setZoom((value) => clampZoom(value - ZOOM_STEP));
        return;
      }

      if (event.key === "0") {
        event.preventDefault();
        setZoom(1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const outer = outerRef.current;
    if (!outer) return;

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setZoom((value) => clampZoom(value + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)));
    };

    outer.addEventListener("wheel", handleWheel, { passive: false });
    return () => outer.removeEventListener("wheel", handleWheel);
  }, []);

  const zoomPercent = Math.round(zoom * 100);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => setZoom((value) => clampZoom(value - ZOOM_STEP))}
          disabled={zoom <= MIN_ZOOM}
          aria-label="ย่อ"
          title="ย่อ"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="w-12 text-center text-sm tabular-nums text-muted-foreground">{zoomPercent}%</span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => setZoom((value) => clampZoom(value + ZOOM_STEP))}
          disabled={zoom >= MAX_ZOOM}
          aria-label="ขยาย"
          title="ขยาย"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setZoom(1)}>
          <Maximize2 className="h-3.5 w-3.5" />
          พอดีหน้า
        </Button>
      </div>
      <div ref={outerRef} className={`min-h-0 flex-1 overflow-auto rounded border p-3 ${previewClassName ?? "bg-neutral-100"}`}>
        <div className="mx-auto" style={{ width: naturalWidth * scale, height: naturalHeight * scale }}>
          <div
            ref={contentRef}
            style={{
              width: "max-content",
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            <div ref={printRef}>{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PrintPreviewDialog({
  open,
  onOpenChange,
  docType,
  css,
  children,
  onPrinted,
}: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const [copies, setCopies] = useState(1);
  const [printing, setPrinting] = useState(false);
  const [selectedPrinterId, setSelectedPrinterId] = useState("");
  const meta = getPrintDocType(docType);
  const widthClass = docType === "sample-label" ? "sm:max-w-2xl" : "sm:max-w-4xl";
  const outputMode = getPrintOutputModeForDocType(docType);

  const { data: configs } = useQuery({
    queryKey: ["printer-configs"],
    queryFn: api.getPrinterConfigs,
    enabled: open,
  });

  const printerKind = docTypeToKind(docType);
  const serverPrinters = useMemo(
    () => (configs ?? []).filter((printer) => printer.kind === printerKind && printer.cupsPrinterUrl?.trim()),
    [configs, printerKind],
  );
  const cfg = selectedPrinterId
    ? serverPrinters.find((printer) => printer.id === selectedPrinterId)
    : defaultPrinterFor(configs, printerKind);
  const serverConfigured = Boolean(cfg?.cupsPrinterUrl?.trim());
  const configured = outputMode === "local" || serverConfigured;
  const printerTarget = outputMode === "local" ? "เครื่องนี้" : (cfg?.label?.trim() || cfg?.cupsPrinterUrl?.trim());

  useEffect(() => {
    if (!open || outputMode !== "server") return;
    if (selectedPrinterId && serverPrinters.some((printer) => printer.id === selectedPrinterId)) return;
    const fallback = defaultPrinterFor(configs, printerKind) ?? serverPrinters[0];
    setSelectedPrinterId(fallback?.id ?? "");
  }, [configs, open, outputMode, printerKind, selectedPrinterId, serverPrinters]);

  async function handlePrint(mode: PrintOutputMode = outputMode) {
    if (mode === "server" && !serverConfigured) {
      toast.error("ยังไม่ได้ตั้งค่าเครื่องพิมพ์ Server สำหรับเอกสารนี้");
      return;
    }
    setPrinting(true);
    try {
      const res = await printDocument(docType, printRef.current, {
        css,
        copies,
        outputMode: mode,
        printerConfigId: mode === "server" ? cfg?.id : undefined,
      });
      onPrinted?.({ copies, outputMode: mode });
      if (mode === "local") {
        toast.success("เปิด print dialog ของเครื่องนี้แล้ว");
      } else {
        toast.success(`ส่งพิมพ์ไปยัง ${res.printer} (${res.copies} ชุด)`);
      }
      if (mode === "server") onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "พิมพ์ไม่สำเร็จ");
    } finally {
      setPrinting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${widthClass} flex max-h-[90vh] min-h-[70vh] flex-col overflow-hidden`}>
        <DialogHeader className="shrink-0">
          <DialogTitle>ตัวอย่างก่อนพิมพ์ — {meta?.label ?? docType}</DialogTitle>
        </DialogHeader>

        <ScaledPreview printRef={printRef} previewClassName={docType === "coa" ? "bg-sky-50" : undefined}>{children}</ScaledPreview>

        {!configured && (
          <p className="shrink-0 text-sm text-red-600">
            ยังไม่ได้ตั้งค่าเครื่องพิมพ์สำหรับเอกสารนี้{" "}
            <Link to="/settings" className="underline" onClick={() => onOpenChange(false)}>
              ไปหน้าตั้งค่าระบบ
            </Link>
          </p>
        )}

        <DialogFooter className="shrink-0 items-center gap-3 sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="print-copies" className="text-sm">
              จำนวนชุด
            </Label>
            <div className="flex items-center">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-r-none"
                onClick={() => setCopies((value) => Math.max(1, value - 1))}
                disabled={copies <= 1}
                aria-label="ลดจำนวนชุด"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                id="print-copies"
                type="text"
                inputMode="numeric"
                value={copies}
                onChange={(e) =>
                  setCopies(Math.min(99, Math.max(1, parseInt(e.target.value.replace(/\D/g, "") || "1", 10))))
                }
                className="w-12 rounded-none text-center"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-l-none"
                onClick={() => setCopies((value) => Math.min(99, value + 1))}
                disabled={copies >= 99}
                aria-label="เพิ่มจำนวนชุด"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {outputMode === "server" && serverPrinters.length > 0 && (
              <Select value={cfg?.id ?? ""} onValueChange={setSelectedPrinterId}>
                <SelectTrigger className="h-9 w-[220px]">
                  <SelectValue placeholder="เลือกเครื่องพิมพ์" />
                </SelectTrigger>
                <SelectContent>
                  {serverPrinters.map((printer) => (
                    <SelectItem key={printer.id} value={printer.id}>
                      {printer.label?.trim() || printer.cupsPrinterUrl}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {configured && <span className="break-all text-sm text-muted-foreground">→ {printerTarget}</span>}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              ปิด
            </Button>
            <Button onClick={() => void handlePrint()} disabled={!configured || printing} className="gap-2">
              <Printer className="h-4 w-4" />
              {printing ? "กำลังพิมพ์..." : outputMode === "local" ? "พิมพ์จากเครื่องนี้" : "พิมพ์ผ่าน Server"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
