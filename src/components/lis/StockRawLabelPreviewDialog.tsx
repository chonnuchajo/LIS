import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Minus, Plus, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { defaultPrinterFor } from "@/lib/printConfig";
import { printRawHtmlDocument } from "@/lib/print";

type Props = { open: boolean; labels: string[]; onOpenChange: (open: boolean) => void; onPrinted?: () => void };

function clampCopies(value: number) {
  return Math.min(99, Math.max(1, value));
}

export default function StockRawLabelPreviewDialog({ open, labels, onOpenChange, onPrinted }: Props) {
  const [copies, setCopies] = useState(1);
  const [selectedPrinterId, setSelectedPrinterId] = useState("");
  const [printing, setPrinting] = useState(false);
  const { data: configs } = useQuery({ queryKey: ["printer-configs"], queryFn: api.getPrinterConfigs, enabled: open });
  const stickerPrinters = useMemo(() => (configs ?? []).filter((printer) => printer.kind === "sticker" && printer.cupsPrinterUrl?.trim()), [configs]);
  const stickerPrinterKey = useMemo(
    () => stickerPrinters.map((printer) => `${printer.id}:${printer.isDefault}:${printer.cupsPrinterUrl}`).join("|"),
    [stickerPrinters],
  );
  const defaultPrinterId = defaultPrinterFor(configs, "sticker")?.id ?? stickerPrinters[0]?.id ?? "";
  const selectedPrinter = stickerPrinters.find((printer) => printer.id === selectedPrinterId);
  const effectivePrinterId = selectedPrinter?.id ?? defaultPrinterId;

  useEffect(() => {
    if (open) setSelectedPrinterId(defaultPrinterId);
  }, [defaultPrinterId, open, stickerPrinterKey]);

  async function handlePrint() {
    if (labels.length === 0) return;
    if (!effectivePrinterId) {
      toast.error("ยังไม่ได้ตั้งค่าเครื่องพิมพ์ Sticker");
      return;
    }

    setPrinting(true);
    try {
      for (const html of labels) {
        await printRawHtmlDocument("stock-label", html, { copies, outputMode: "server", printerConfigId: effectivePrinterId });
      }
      toast.success(`ส่งพิมพ์ฉลาก ${labels.length} รายการ${copies > 1 ? ` (${copies} ชุด)` : ""}`);
      onPrinted?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "พิมพ์ฉลากไม่สำเร็จ");
    } finally {
      setPrinting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] min-h-[70vh] flex-col overflow-hidden sm:max-w-3xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>ตัวอย่างฉลาก Stock</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-hidden">
          {labels.length > 1 && (
            <p className="text-sm text-muted-foreground">
              แสดงตัวอย่างฉลากแรกจากทั้งหมด {labels.length} ฉลาก
            </p>
          )}
          <div className="flex h-full min-h-[320px] items-center justify-center overflow-auto rounded-md border bg-muted/40 p-4">
            {labels[0] ? (
              <div
                className="max-w-full bg-white text-black shadow-sm"
                dangerouslySetInnerHTML={{ __html: labels[0] }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">ไม่มีฉลากสำหรับพรีวิว</p>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0 items-center gap-3 sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="stock-label-copies" className="text-sm">จำนวนชุด</Label>
              <div className="flex items-center">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-r-none"
                  onClick={() => setCopies((value) => clampCopies(value - 1))}
                  disabled={copies <= 1 || printing}
                  aria-label="ลดจำนวนชุด"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  id="stock-label-copies"
                  inputMode="numeric"
                  value={copies}
                  onChange={(event) => setCopies(clampCopies(parseInt(event.target.value.replace(/\D/g, "") || "1", 10)))}
                  className="w-12 rounded-none text-center"
                  disabled={printing}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-l-none"
                  onClick={() => setCopies((value) => clampCopies(value + 1))}
                  disabled={copies >= 99 || printing}
                  aria-label="เพิ่มจำนวนชุด"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Select value={effectivePrinterId} onValueChange={setSelectedPrinterId} disabled={printing || stickerPrinters.length === 0}>
              <SelectTrigger className="h-9 w-[240px]">
                <SelectValue placeholder="เลือกเครื่องพิมพ์ Sticker" />
              </SelectTrigger>
              <SelectContent>
                {stickerPrinters.map((printer) => (
                  <SelectItem key={printer.id} value={printer.id}>
                    {printer.label?.trim() || printer.cupsPrinterUrl}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={printing}>
              ปิด
            </Button>
            <Button onClick={() => void handlePrint()} disabled={labels.length === 0 || !effectivePrinterId || printing} className="gap-2">
              <Printer className="h-4 w-4" />
              {printing ? "กำลังพิมพ์..." : "พิมพ์ฉลาก"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
