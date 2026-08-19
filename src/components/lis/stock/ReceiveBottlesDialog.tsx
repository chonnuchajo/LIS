import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/lib/api";
import { buildStockLabelHtml } from "@/lib/stockLabel";
import StockPhotoUploader from "@/components/lis/stock/StockPhotoUploader";
import type { StockStandardItem, StockUnitItem } from "@/types/stock";

interface Props {
  standard: StockStandardItem;
  onClose: () => void;
  onSaved: () => void;
  onPreviewLabels: (labels: string[], options?: { autoPrint?: boolean }) => void;
}

export default function ReceiveBottlesDialog({ standard, onClose, onSaved, onPreviewLabels }: Props) {
  const [lotNo, setLotNo] = useState("");
  const [purity, setPurity] = useState("");
  const [type, setType] = useState<"primary" | "supplier" | "working" | "">("");
  const [sizeMl, setSizeMl] = useState("100");
  const [count, setCount] = useState("1");
  const [sameExp, setSameExp] = useState(true);
  const [commonExp, setCommonExp] = useState("");
  const [perExp, setPerExp] = useState<string[]>([""]);
  const [perPhotoUrls, setPerPhotoUrls] = useState<string[][]>([[]]);
  const [printAfter, setPrintAfter] = useState(true);
  const [busy, setBusy] = useState(false);

  const n = Math.max(1, Number(count) || 1);
  const ensureBottleFields = (len: number) => {
    setPerExp((prev) => {
      const next = [...prev];
      while (next.length < len) next.push("");
      next.length = len;
      return next;
    });
    setPerPhotoUrls((prev) => {
      const next = prev.map((urls) => [...urls]);
      while (next.length < len) next.push([]);
      next.length = len;
      return next;
    });
  };

  const setBottlePhotoUrls = (index: number, photoUrls: string[]) => {
    setPerPhotoUrls((prev) => {
      const next = prev.map((urls) => [...urls]);
      while (next.length <= index) next.push([]);
      next[index] = photoUrls;
      return next;
    });
  };

  const buildLabels = async (units: StockUnitItem[]) => {
    const labels: string[] = [];
    for (const u of units) {
      try {
        labels.push(await buildStockLabelHtml(u));
      } catch (err) {
        toast.error(`ปริ้นลาเบล ${u.qrId} ไม่สำเร็จ: ${(err as Error).message}`);
      }
    }
    return labels;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const size = Number(sizeMl);
    if (!Number.isFinite(size) || size <= 0) { toast.error("กรุณาระบุขนาด/ขวด"); return; }
    const cnt = Number(count);
    if (!Number.isInteger(cnt) || cnt < 1) { toast.error("จำนวนขวดต้องเป็นจำนวนเต็มบวก"); return; }
    if (!lotNo.trim()) { toast.error("กรุณาระบุ Lot No"); return; }
    if (!purity.trim()) { toast.error("กรุณาระบุ % Purity"); return; }
    if (sameExp) {
      if (!commonExp) { toast.error("กรุณาระบุ EXP"); return; }
    } else if (Array.from({ length: cnt }, (_, i) => !perExp[i]).some(Boolean)) {
      toast.error("กรุณาระบุ EXP"); return;
    }
    if (type !== "primary" && type !== "supplier" && type !== "working") { toast.error("ต้องเลือกประเภท Barcode"); return; }
    const bottles = Array.from({ length: n }, (_, i) => {
      const photoUrls = (perPhotoUrls[i] ?? []).filter(Boolean);
      return {
        exp: sameExp ? commonExp || undefined : perExp[i] || undefined,
        ...(photoUrls.length ? { photoUrls } : {}),
      };
    });
    setBusy(true);
    try {
      const created = await api.receiveStockUnits(standard._id, {
        lotNo: lotNo.trim(), purity: purity.trim(), sizeMl: size, unit: "ml", type, bottles,
      });
      toast.success(`รับเข้า ${created.length} ขวดแล้ว`);
      onSaved();
      if (printAfter) {
        const labels = await buildLabels(created);
        if (labels.length > 0) onPreviewLabels(labels, { autoPrint: true });
      }
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>รับเข้าขวด — {standard.name}</DialogTitle>
            <DialogDescription>{standard.code}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div>
              <Label>ประเภท</Label>
              <div className="flex gap-2 mt-1">
                {(["primary", "working", "supplier"] as const).map((t) => (
                  <Button key={t} type="button" variant={type === t ? "default" : "outline"} size="sm"
                    onClick={() => setType(t)}>{t}</Button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div><Label htmlFor="receive-standard-lot">Lot No</Label><Input id="receive-standard-lot" value={lotNo} onChange={(e) => setLotNo(e.target.value)} placeholder="required" required /></div>
              <div><Label htmlFor="receive-standard-purity">% Purity</Label><Input id="receive-standard-purity" value={purity} onChange={(e) => setPurity(e.target.value)} placeholder="เช่น 99.5" inputMode="decimal" required /></div>
              <div><Label>ขนาด/ขวด (ml)</Label><Input type="number" value={sizeMl} onChange={(e) => setSizeMl(e.target.value)} /></div>
            </div>
            <div>
              <Label>จำนวนขวด</Label>
              <Input type="number" min="1" value={count}
                onChange={(e) => { setCount(e.target.value); ensureBottleFields(Math.max(1, Number(e.target.value) || 1)); }} />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="sameExp" checked={sameExp} onCheckedChange={(v) => setSameExp(v === true)} />
              <label htmlFor="sameExp" className="text-sm cursor-pointer">EXP เท่ากันทุกขวด</label>
            </div>
            {sameExp ? (
              <div><Label>EXP (ทุกขวด)</Label><Input type="date" value={commonExp} onChange={(e) => setCommonExp(e.target.value)} required /></div>
            ) : (
              <div className="space-y-2">
                {Array.from({ length: n }, (_, i) => (
                  <div key={i}>
                    <Label>EXP ขวดที่ {i + 1}</Label>
                    <Input type="date" value={perExp[i] ?? ""}
                      required
                      onChange={(e) => setPerExp((prev) => { const x = [...prev]; x[i] = e.target.value; return x; })} />
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-2">
              {Array.from({ length: n }, (_, i) => (
                <StockPhotoUploader
                  key={i}
                  label={`รูปขวดที่ ${i + 1} (ไม่บังคับ)`}
                  value={perPhotoUrls[i] ?? []}
                  onChange={(photoUrls) => setBottlePhotoUrls(i, photoUrls)}
                  disabled={busy}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="printAfter" checked={printAfter} onCheckedChange={(v) => setPrintAfter(v === true)} />
              <label htmlFor="printAfter" className="text-sm cursor-pointer">ปริ้นลาเบลหลังรับเข้า</label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
            <Button type="submit" disabled={busy}>{busy ? "กำลังบันทึก..." : "รับเข้า"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
