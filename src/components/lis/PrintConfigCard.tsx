import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getPrintDocType, validatePrintConfig, type PrintConfig, type PrintConfigInput } from "@/lib/printConfig";
import { toast } from "sonner";

interface Props {
  config: PrintConfig;
  printers: string[];
  saving: boolean;
  onSave: (slug: PrintConfig["slug"], input: PrintConfigInput) => void;
}

export default function PrintConfigCard({ config, printers, saving, onSave }: Props) {
  const [printerName, setPrinterName] = useState(config.printerName);
  const [cupsPrinterUrl, setCupsPrinterUrl] = useState(config.cupsPrinterUrl ?? "");
  const [copies, setCopies] = useState(config.copies);
  const [paperSize, setPaperSize] = useState(config.paperSize);

  useEffect(() => {
    setPrinterName(config.printerName);
    setCupsPrinterUrl(config.cupsPrinterUrl ?? "");
    setCopies(config.copies);
    setPaperSize(config.paperSize);
  }, [config]);

  const meta = getPrintDocType(config.slug);

  function handleSave() {
    const input: PrintConfigInput = { printerName, cupsPrinterUrl, copies, paperSize };
    const err = validatePrintConfig(input);
    if (err) { toast.error(err); return; }
    onSave(config.slug, input);
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <h3 className="text-sm font-semibold">{meta?.label ?? config.slug}</h3>

        <div className="space-y-1">
          <Label className="text-xs">เครื่องพิมพ์ local บน server</Label>
          <Select value={printerName || undefined} onValueChange={setPrinterName}>
            <SelectTrigger><SelectValue placeholder="เลือกเครื่องพิมพ์" /></SelectTrigger>
            <SelectContent>
              {printers.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">CUPS printer URL</Label>
          <Input
            value={cupsPrinterUrl}
            onChange={(e) => setCupsPrinterUrl(e.target.value)}
            placeholder="https://192.168.0.237:631/printers/PRINTER_NAME"
          />
          <p className="text-xs text-muted-foreground">
            ถ้ากรอก URL นี้ ระบบจะส่งพิมพ์ผ่าน CUPS แทนเครื่องพิมพ์ local
          </p>
        </div>

        <div className="flex gap-3">
          <div className="space-y-1">
            <Label className="text-xs">จำนวนชุด</Label>
            <Input type="number" min={1} max={99} value={copies}
              onChange={(e) => setCopies(Math.min(99, Math.max(1, parseInt(e.target.value || "1", 10))))}
              className="w-20" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">ขนาดกระดาษ</Label>
            <Select value={paperSize} onValueChange={(v) => setPaperSize(v as PrintConfig["paperSize"])}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="A4">A4</SelectItem>
                <SelectItem value="label-6x4">ฉลาก 6x4 นิ้ว</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "กำลังบันทึก…" : "บันทึก"}
        </Button>
      </CardContent>
    </Card>
  );
}
