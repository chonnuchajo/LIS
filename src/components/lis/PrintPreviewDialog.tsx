import { useLayoutEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Printer } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { printDocument } from "@/lib/print";
import {
  getPrintDocType, isPrinterConfigured, type PrintDocType,
} from "@/lib/printConfig";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  docType: PrintDocType;
  /** CSS เสริมสำหรับ template ที่ไม่ได้ฝัง <style> ไว้ใน children (เช่น COA) */
  css?: string;
  children: React.ReactNode; // template ที่จะ preview + พิมพ์
}

/**
 * ย่อเนื้อหา preview ให้พอดีความกว้างที่มีเสมอ (กันเลื่อนซ้ายขวา) — เอกสารบางชนิด
 * กว้างเกินกรอบ dialog (เช่น ใบคำขอหน้า 2 เป็น A4 แนวนอน 297mm). transform scale
 * อยู่ที่ตัวครอบ *นอก* printRef จึงไม่ถูกจับตอน serialize → ของจริงที่ส่งไปพิมพ์ขนาดเท่าเดิม.
 */
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

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const content = contentRef.current;
    if (!outer || !content) return;
    const measure = () => {
      // scrollWidth/Height = ขนาด layout จริง ไม่ขึ้นกับ transform ที่ใส่ไว้
      const avail = outer.clientWidth;
      const natW = content.scrollWidth;
      setScale(natW > avail ? avail / natW : 1);
      setNaturalHeight(content.scrollHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    return () => ro.disconnect();
  }, [children]);

  return (
    <div ref={outerRef} className="overflow-x-hidden rounded border bg-white p-2">
      {/* จองความสูงตามขนาดที่ย่อแล้ว เพื่อไม่ให้เหลือที่ว่างด้านล่าง */}
      <div style={{ height: naturalHeight * scale }}>
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
  );
}

export default function PrintPreviewDialog({ open, onOpenChange, docType, css, children }: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const [copies, setCopies] = useState(1);
  const [printing, setPrinting] = useState(false);
  const meta = getPrintDocType(docType);

  const { data: configs } = useQuery({
    queryKey: ["print-config"],
    queryFn: api.getPrintConfigs,
    enabled: open,
  });
  const cfg = configs?.find((c) => c.slug === docType);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>ตัวอย่างก่อนพิมพ์ — {meta?.label ?? docType}</DialogTitle>
        </DialogHeader>

        <ScaledPreview printRef={printRef}>{children}</ScaledPreview>

        {!configured && (
          <p className="text-sm text-red-600">
            ยังไม่ได้ตั้งค่าเครื่องพิมพ์สำหรับเอกสารนี้ —{" "}
            <Link to="/settings" className="underline" onClick={() => onOpenChange(false)}>
              ไปหน้าตั้งค่าระบบ
            </Link>
          </p>
        )}

        <DialogFooter className="items-center gap-3 sm:justify-between">
          <div className="flex items-center gap-2">
            <Label htmlFor="print-copies" className="text-sm">จำนวนชุด</Label>
            <Input
              id="print-copies"
              type="number"
              min={1}
              max={99}
              value={copies}
              onChange={(e) => setCopies(Math.min(99, Math.max(1, parseInt(e.target.value || "1", 10))))}
              className="w-20"
            />
            {configured && <span className="text-sm text-muted-foreground">→ {printerTarget}</span>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>ปิด</Button>
            <Button onClick={handlePrint} disabled={!configured || printing} className="gap-2">
              <Printer className="w-4 h-4" /> {printing ? "กำลังพิมพ์…" : "พิมพ์"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
