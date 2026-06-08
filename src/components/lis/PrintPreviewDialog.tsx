import { useLayoutEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Laptop, Minus, Plus, Printer } from "lucide-react";
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
import { api } from "@/lib/api";
import { openBrowserPrintPreview, printDocument } from "@/lib/print";
import {
  getPrintDocType,
  isPrinterConfigured,
  type PrintDocType,
} from "@/lib/printConfig";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  docType: PrintDocType;
  css?: string;
  children: React.ReactNode;
}

const BOX_CHROME = 18;

function ScaledPreview({
  printRef,
  children,
}: {
  printRef: React.RefObject<HTMLDivElement>;
  children: React.ReactNode;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [naturalHeight, setNaturalHeight] = useState(0);
  const [naturalWidth, setNaturalWidth] = useState(0);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const content = contentRef.current;
    if (!outer || !content) return;

    const measure = () => {
      const avail = outer.clientWidth - BOX_CHROME;
      const natW = content.scrollWidth;
      setScale(natW > 0 ? avail / natW : 1);
      setNaturalWidth(natW);
      setNaturalHeight(content.scrollHeight);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    return () => ro.disconnect();
  }, [children]);

  return (
    <div ref={outerRef} className="flex justify-center">
      <div className="overflow-hidden rounded border bg-white p-2">
        <div style={{ width: naturalWidth * scale, height: naturalHeight * scale }}>
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
}: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const [copies, setCopies] = useState(1);
  const [printing, setPrinting] = useState(false);
  const meta = getPrintDocType(docType);
  const widthClass = docType === "sample-label" ? "sm:max-w-2xl" : "sm:max-w-4xl";

  const { data: configs } = useQuery({
    queryKey: ["print-config"],
    queryFn: api.getPrintConfigs,
    enabled: open,
  });

  const cfg = configs?.find((item) => item.slug === docType);
  const configured = isPrinterConfigured(cfg);
  const printerTarget = cfg?.cupsPrinterUrl?.trim() || cfg?.printerName;

  async function handlePrint() {
    setPrinting(true);
    try {
      const res = await printDocument(docType, printRef.current, { css, copies });
      toast.success(`ส่งพิมพ์ไปยัง ${res.printer} (${res.copies} ชุด)`);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "พิมพ์ไม่สำเร็จ");
    } finally {
      setPrinting(false);
    }
  }

  function handleBrowserPreview() {
    try {
      openBrowserPrintPreview(meta?.label ?? docType, printRef.current, { css });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "เปิด print preview ไม่สำเร็จ");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${widthClass} max-h-[90vh] overflow-y-auto overflow-x-hidden`}>
        <DialogHeader>
          <DialogTitle>ตัวอย่างก่อนพิมพ์ — {meta?.label ?? docType}</DialogTitle>
        </DialogHeader>

        <ScaledPreview printRef={printRef}>{children}</ScaledPreview>

        {!configured && (
          <p className="text-sm text-red-600">
            ยังไม่ได้ตั้งค่าเครื่องพิมพ์สำหรับเอกสารนี้{" "}
            <Link to="/settings" className="underline" onClick={() => onOpenChange(false)}>
              ไปหน้าตั้งค่าระบบ
            </Link>
          </p>
        )}

        <DialogFooter className="items-center gap-3 sm:justify-between">
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
            {configured && <span className="break-all text-sm text-muted-foreground">→ {printerTarget}</span>}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              ปิด
            </Button>
            <Button variant="outline" onClick={handleBrowserPreview} className="gap-2">
              <Laptop className="h-4 w-4" />
              Windows Preview
            </Button>
            <Button onClick={handlePrint} disabled={!configured || printing} className="gap-2">
              <Printer className="h-4 w-4" />
              {printing ? "กำลังพิมพ์..." : "พิมพ์"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
