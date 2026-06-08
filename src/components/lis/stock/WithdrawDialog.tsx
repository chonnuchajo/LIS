import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { buildStockLabelHtml } from "@/lib/stockLabel";
import { unitDerivedStatus } from "@/lib/stockUnit";
import type { StockUnitItem } from "@/types/stock";

interface Props {
  qrId: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function WithdrawDialog({ qrId, onClose, onSaved }: Props) {
  const [unit, setUnit] = useState<StockUnitItem | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [ml, setMl] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let on = true;
    api.getStockUnit(qrId)
      .then((u) => { if (on) setUnit(u); })
      .catch((e) => { if (on) setLoadErr((e as Error).message); });
    return () => { on = false; };
  }, [qrId]);

  const derived = unit ? unitDerivedStatus(unit) : null;
  const blocked =
    !unit ? "" :
    unit.kind !== "sealed" ? "แบ่งได้เฉพาะขวดคงคลัง (sealed)" :
    derived === "discarded" ? "ขวดนี้ถูกทิ้งแล้ว ใช้งานต่อไม่ได้" :
    derived === "empty" ? "ขวดนี้หมดแล้ว" :
    derived === "expired" ? "ขวดนี้หมดอายุแล้ว" : "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(ml);
    if (!Number.isFinite(amt) || amt <= 0) { toast.error("กรุณาระบุปริมาณ"); return; }
    if (unit && amt > (unit.volume?.remaining ?? 0)) { toast.error("ปริมาณคงเหลือไม่พอ"); return; }
    setBusy(true);
    try {
      const { working } = await api.withdrawStockUnit(qrId, { ml: amt, note: note || undefined });
      toast.success(`แบ่ง working ${amt} ml แล้ว`);
      try {
        const html = await buildStockLabelHtml(working);
        await api.printDocument({ docType: "stock-label", html });
      } catch (err) {
        toast.error(`ปริ้นลาเบล working ไม่สำเร็จ: ${(err as Error).message}`);
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>แบ่งใช้ → working</DialogTitle>
            <DialogDescription>{qrId}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {loadErr && <p className="text-sm text-destructive">{loadErr}</p>}
            {unit && (
              <div className="text-sm text-muted-foreground">
                {unit.itemName} ({unit.itemCode}) · Lot {unit.lotNo || "-"} · คงเหลือ <b>{unit.volume?.remaining}</b> {unit.volume?.unit}
              </div>
            )}
            {blocked && <p className="text-sm text-destructive font-medium">{blocked}</p>}
            <div>
              <Label>ปริมาณที่แบ่ง (ml)</Label>
              <Input type="number" min="1" value={ml} onChange={(e) => setMl(e.target.value)} disabled={!!blocked} />
            </div>
            <div>
              <Label>หมายเหตุ</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" disabled={!!blocked} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
            <Button type="submit" disabled={busy || !!blocked || !unit}>{busy ? "กำลังบันทึก..." : "แบ่ง working"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
