import { useEffect, useState } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { StockUnitItem } from "@/types/stock";

interface Props {
  qrId: string;
  onClose: () => void;
  onSaved: () => void;
}

const REASONS = ["ประสิทธิภาพลดลง", "หมดอายุ", "ปนเปื้อน", "ใช้งานไม่ได้", "อื่นๆ"] as const;

/** แจ้งสถานะขวด standard รายขวด → แจ้งหมด (empty) หรือแจ้งปัญหา/ทิ้งขวด (discard) */
export default function PerformanceDropDialog({ qrId, onClose, onSaved }: Props) {
  const [unit, setUnit] = useState<StockUnitItem | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [outcome, setOutcome] = useState<"empty" | "discard">("discard");
  const [reasonKey, setReasonKey] = useState<string>(REASONS[0]);
  const [customReason, setCustomReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let on = true;
    api.getStockUnit(qrId)
      .then((u) => { if (on) setUnit(u); })
      .catch((e) => { if (on) setLoadErr((e as Error).message); });
    return () => { on = false; };
  }, [qrId]);

  const isWorking = unit?.kind === "working";
  const reason = outcome === "discard"
    ? (reasonKey === "อื่นๆ" ? (customReason.trim() || "อื่นๆ") : reasonKey)
    : undefined;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.discardStockUnit(qrId, { reason, outcome });
      toast.success(outcome === "empty" ? "แจ้งหมดแล้ว" : "แจ้งปัญหา/ทิ้งขวดแล้ว");
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
      <DialogContent className="max-w-[95vw] rounded-2xl sm:max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" /> แจ้งสถานะขวด
            </DialogTitle>
            <DialogDescription>แจ้งหมด หรือแจ้งปัญหา/ทิ้งขวดนี้</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {loadErr && <p className="text-sm text-destructive">{loadErr}</p>}

            {/* ชื่อ + ปริมาณคงเหลือ */}
            {unit && (
              <div className="rounded-xl border bg-muted/40 p-3">
                <div className="font-medium">{unit.itemName}</div>
                <div className="mt-0.5 text-sm text-muted-foreground">
                  เหลือ <span className="font-medium text-foreground">{unit.volume?.remaining ?? "-"} {unit.volume?.unit}</span>
                  {" · "}{isWorking ? "working" : "คงคลัง"}
                  {unit.lotNo ? ` · Lot ${unit.lotNo}` : ""}
                </div>
              </div>
            )}

            {/* การแจ้ง */}
            <div>
              <Label className="mb-1.5 block">การแจ้ง</Label>
              <div className="space-y-2">
                {([
                  { v: "empty", label: "แจ้งหมด (ขวดนี้ใช้หมดแล้ว)" },
                  { v: "discard", label: "แจ้งปัญหา / ทิ้งขวด (ระบุเหตุผล)" },
                ] as const).map((opt) => (
                  <label
                    key={opt.v}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm transition-colors",
                      outcome === opt.v ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                    )}
                  >
                    <input type="radio" name="outcome" checked={outcome === opt.v} onChange={() => setOutcome(opt.v)} />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {/* เหตุผล */}
            {outcome === "discard" && (
              <div>
                <Label className="mb-1.5 block">เหตุผล</Label>
                <Select value={reasonKey} onValueChange={setReasonKey}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
                {reasonKey === "อื่นๆ" && (
                  <Input
                    className="mt-2"
                    autoFocus
                    placeholder="ระบุเหตุผล..."
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                  />
                )}
              </div>
            )}

            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              เมื่อยืนยันแล้ว QR ที่แจ้งจะใช้งานต่อไม่ได้ถาวร
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
            <Button type="submit" variant="destructive" disabled={busy || !unit}>
              {busy ? "กำลังบันทึก..." : "ยืนยัน"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
