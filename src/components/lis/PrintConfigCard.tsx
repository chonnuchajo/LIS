import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

  useEffect(() => {
    setPrinterName(config.printerName);
    setCupsPrinterUrl(config.cupsPrinterUrl ?? "");
  }, [config]);

  const meta = getPrintDocType(config.slug);

  function handleSave() {
    const input: PrintConfigInput = {
      printerName,
      cupsPrinterUrl,
      copies: config.copies,
      paperSize: config.paperSize,
    };
    const err = validatePrintConfig(input);
    if (err) {
      toast.error(err);
      return;
    }
    onSave(config.slug, input);
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <h3 className="text-sm font-semibold">{meta?.label ?? config.slug}</h3>

        <div className="space-y-1">
          <Label className="text-xs">เครื่องพิมพ์ local บน server</Label>
          <Select value={printerName || undefined} onValueChange={setPrinterName}>
            <SelectTrigger>
              <SelectValue placeholder="เลือกเครื่องพิมพ์" />
            </SelectTrigger>
            <SelectContent>
              {printers.map((printer) => (
                <SelectItem key={printer} value={printer}>
                  {printer}
                </SelectItem>
              ))}
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

        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "กำลังบันทึก..." : "บันทึก"}
        </Button>
      </CardContent>
    </Card>
  );
}
