import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { buildStockLabelHtml } from "@/lib/stockLabel";
import type { StockStandardItem, StockUnitItem } from "@/types/stock";

interface Props {
  standard: StockStandardItem;
  onClose: () => void;
  onSaved: () => void;
}

export default function ReceiveBottlesDialog({ standard, onClose, onSaved }: Props) {
  const [lotNo, setLotNo] = useState("");
  const [sizeMl, setSizeMl] = useState("100");
  const [count, setCount] = useState("1");
  const [sameExp, setSameExp] = useState(true);
  const [commonExp, setCommonExp] = useState("");
  const [perExp, setPerExp] = useState<string[]>([""]);
  const [printAfter, setPrintAfter] = useState(true);
  const [busy, setBusy] = useState(false);

  const n = Math.max(1, Number(count) || 1);
  const ensurePerExp = (len: number) => {
    setPerExp((prev) => {
      const next = [...prev];
      while (next.length < len) next.push("");
      next.length = len;
      return next;
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const size = Number(sizeMl);
    if (!Number.isFinite(size) || size <= 0) { toast.error("กรุณาระบุขนาด/ขวด"); return; }
    const bottles = sameExp
      ? Array.from({ length: n }, () => ({ exp: commonExp || undefined }))
      : perExp.slice(0, n).map((exp) => ({ exp: exp || undefined }));
    setBusy(true);
    try {
      const created = await api.receiveStockUnits(standard._id, {
        lotNo, sizeMl: size, unit: "ml", bottles,
      });
      toast.success(`รับเข้า ${created.length} ขวดแล้ว`);
      if (printAfter) await printLabels(created);
      onSaved();
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const printLabels = async (units: StockUnitItem[]) => {
    for (const u of units) {
      try {
        const html = await buildStockLabelHtml(u, window.location.origin);
        await api.printDocument({ docType: "stock-label", html });
      } catch (err) {
        toast.error(`ปริ้นลาเบล ${u.qrId} ไม่สำเร็จ: ${(err as Error).message}`);
      }
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
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Lot No</Label><Input value={lotNo} onChange={(e) => setLotNo(e.target.value)} /></div>
              <div><Label>ขนาด/ขวด (ml)</Label><Input type="number" value={sizeMl} onChange={(e) => setSizeMl(e.target.value)} /></div>
            </div>
            <div>
              <Label>จำนวนขวด</Label>
              <Input type="number" min="1" value={count}
                onChange={(e) => { setCount(e.target.value); ensurePerExp(Math.max(1, Number(e.target.value) || 1)); }} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={sameExp} onChange={(e) => setSameExp(e.target.checked)} className="h-4 w-4" /> EXP เท่ากันทุกขวด
            </label>
            {sameExp ? (
              <div><Label>EXP (ทุกขวด)</Label><Input type="date" value={commonExp} onChange={(e) => setCommonExp(e.target.value)} /></div>
            ) : (
              <div className="space-y-2">
                {Array.from({ length: n }, (_, i) => (
                  <div key={i}>
                    <Label>EXP ขวดที่ {i + 1}</Label>
                    <Input type="date" value={perExp[i] ?? ""}
                      onChange={(e) => setPerExp((prev) => { const x = [...prev]; x[i] = e.target.value; return x; })} />
                  </div>
                ))}
              </div>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={printAfter} onChange={(e) => setPrintAfter(e.target.checked)} className="h-4 w-4" /> ปริ้นลาเบลหลังรับเข้า
            </label>
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
