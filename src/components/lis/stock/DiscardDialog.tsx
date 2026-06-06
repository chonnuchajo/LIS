import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { unitDerivedStatus } from "@/lib/stockUnit";
import type { StockUnitItem } from "@/types/stock";

interface Props {
  qrId: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function DiscardDialog({ qrId, onClose, onSaved }: Props) {
  const [unit, setUnit] = useState<StockUnitItem | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let on = true;
    api.getStockUnit(qrId)
      .then((u) => { if (on) setUnit(u); })
      .catch((e) => { if (on) setLoadErr((e as Error).message); });
    return () => { on = false; };
  }, [qrId]);

  const already = unit ? unitDerivedStatus(unit) === "discarded" : false;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.discardStockUnit(qrId, { reason: reason || undefined });
      toast.success("ทิ้งขวดแล้ว — QR นี้ใช้ต่อไม่ได้");
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
            <DialogTitle>ทิ้งขวด</DialogTitle>
            <DialogDescription>{qrId}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {loadErr && <p className="text-sm text-destructive">{loadErr}</p>}
            {unit && (
              <div className="text-sm text-muted-foreground">
                {unit.itemName} ({unit.itemCode}) · {unit.kind === "working" ? "working" : "คงคลัง"} · Lot {unit.lotNo || "-"}
              </div>
            )}
            {already && <p className="text-sm text-destructive font-medium">ขวดนี้ถูกทิ้งไปแล้ว</p>}
            <div>
              <Label>เหตุผล</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เช่น หมดอายุ / ปนเปื้อน" disabled={already} />
            </div>
            <p className="text-xs text-muted-foreground">เมื่อทิ้งแล้ว QR ของขวดนี้จะใช้งานต่อไม่ได้ถาวร</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
            <Button type="submit" variant="destructive" disabled={busy || already || !unit}>{busy ? "กำลังบันทึก..." : "ยืนยันทิ้ง"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
