import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import type { StockUnitItem } from "@/types/stock";

interface Props {
  qrId: string;
  onClose: () => void;
  onSaved: () => void;
}

/** แจ้งประสิทธิภาพลดลง → ทิ้ง working ตัวเดียว หรือทั้งขวด (ขวดแม่ + working ทุกตัว) */
export default function PerformanceDropDialog({ qrId, onClose, onSaved }: Props) {
  const [unit, setUnit] = useState<StockUnitItem | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [scope, setScope] = useState<"unit" | "whole">("unit");
  const [reason, setReason] = useState("ประสิทธิภาพลดลง");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let on = true;
    api.getStockUnit(qrId)
      .then((u) => { if (on) setUnit(u); })
      .catch((e) => { if (on) setLoadErr((e as Error).message); });
    return () => { on = false; };
  }, [qrId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.discardStockUnit(qrId, { reason: reason || undefined, cascade: scope === "whole" });
      toast.success(scope === "whole" ? `ทิ้งทั้งขวดแล้ว (${res.count} รายการ)` : "ทิ้ง working แล้ว");
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
            <DialogTitle>แจ้งประสิทธิภาพลดลง</DialogTitle>
            <DialogDescription>{qrId}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {loadErr && <p className="text-sm text-destructive">{loadErr}</p>}
            {unit && (
              <div className="text-sm text-muted-foreground">
                {unit.itemName} ({unit.itemCode}) · {unit.kind === "working" ? "working" : "คงคลัง"} · Lot {unit.lotNo || "-"}
              </div>
            )}
            <div>
              <Label className="mb-1.5 block">ขอบเขตการทิ้ง</Label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="scope" checked={scope === "unit"} onChange={() => setScope("unit")} />
                  ทิ้งเฉพาะ{unit?.kind === "working" ? " working นี้" : "ขวดนี้"}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="scope" checked={scope === "whole"} onChange={() => setScope("whole")} />
                  ทิ้งทั้งขวด (ขวดแม่ + working ลูกทุกตัว)
                </label>
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block">เหตุผล</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">เมื่อทิ้งแล้ว QR ที่ทิ้งจะใช้งานต่อไม่ได้ถาวร</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
            <Button type="submit" variant="destructive" disabled={busy || !unit}>
              {busy ? "กำลังบันทึก..." : "ยืนยันทิ้ง"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
