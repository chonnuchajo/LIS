import { useState } from "react";
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
  unit: StockUnitItem;
  onClose: () => void;
  onSaved: () => void;
}

/** yyyy-mm-dd สำหรับ <input type="date"> จากค่า ISO/Date string */
function toDateInput(v?: string | null): string {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export default function EditUnitDialog({ unit, onClose, onSaved }: Props) {
  const [lotNo, setLotNo] = useState(unit.lotNo ?? "");
  const [source, setSource] = useState<"primary" | "supply" | "">(unit.source ?? "");
  const [exp, setExp] = useState(toDateInput(unit.exp));
  const [initial, setInitial] = useState(String(unit.volume?.initial ?? ""));
  const [remaining, setRemaining] = useState(String(unit.volume?.remaining ?? ""));
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const init = Number(initial);
    const rem = Number(remaining);
    if (!Number.isFinite(init) || init < 0) { toast.error("ปริมาณตั้งต้นไม่ถูกต้อง"); return; }
    if (!Number.isFinite(rem) || rem < 0) { toast.error("ปริมาณคงเหลือไม่ถูกต้อง"); return; }
    if (rem > init) { toast.error("คงเหลือมากกว่าปริมาณตั้งต้นไม่ได้"); return; }
    setBusy(true);
    try {
      await api.updateStockUnit(unit.qrId, {
        lotNo,
        exp: exp || null,
        source,
        volume: { initial: init, remaining: rem },
      });
      toast.success("บันทึกข้อมูลขวดแล้ว");
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
            <DialogTitle>แก้ไขข้อมูลขวด</DialogTitle>
            <DialogDescription>{unit.itemName} ({unit.itemCode}) · {unit.qrId}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div>
              <Label>Lot No</Label>
              <Input value={lotNo} onChange={(e) => setLotNo(e.target.value)} placeholder="optional" />
            </div>
            <div>
              <Label>ที่มา</Label>
              <div className="flex gap-2 mt-1">
                <Button type="button" variant={source === "primary" ? "default" : "outline"} size="sm"
                  onClick={() => setSource("primary")}>primary</Button>
                <Button type="button" variant={source === "supply" ? "default" : "outline"} size="sm"
                  onClick={() => setSource("supply")}>supply</Button>
                <Button type="button" variant={source === "" ? "default" : "outline"} size="sm"
                  onClick={() => setSource("")}>ไม่ระบุ</Button>
              </div>
            </div>
            <div>
              <Label>EXP (รายขวด)</Label>
              <Input type="date" value={exp} onChange={(e) => setExp(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>ปริมาณตั้งต้น ({unit.volume?.unit})</Label>
                <Input type="number" min="0" value={initial} onChange={(e) => setInitial(e.target.value)} />
              </div>
              <div>
                <Label>คงเหลือ ({unit.volume?.unit})</Label>
                <Input type="number" min="0" value={remaining} onChange={(e) => setRemaining(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
            <Button type="submit" disabled={busy}>{busy ? "กำลังบันทึก..." : "บันทึก"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
