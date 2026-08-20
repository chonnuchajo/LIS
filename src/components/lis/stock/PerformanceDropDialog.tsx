import { useEffect, useState, type FormEvent } from "react";
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
  qrId?: string;
  units?: StockUnitItem[];
  onClose: () => void;
  onSaved: () => void;
}

const REASONS = ["ประสิทธิภาพลดลง", "หมดอายุ", "ปนเปื้อน", "ใช้งานไม่ได้", "อื่นๆ"] as const;

export default function PerformanceDropDialog({ qrId, units, onClose, onSaved }: Props) {
  const [loadedUnits, setLoadedUnits] = useState<StockUnitItem[]>(units ?? []);
  const [loadErr, setLoadErr] = useState("");
  const [outcome, setOutcome] = useState<"empty" | "discard">("discard");
  const [reasonKey, setReasonKey] = useState<string>(REASONS[0]);
  const [customReason, setCustomReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (units) {
      setLoadedUnits(units);
      setLoadErr("");
      return;
    }
    if (!qrId) {
      setLoadedUnits([]);
      setLoadErr("ไม่พบข้อมูลขวดที่ต้องแจ้งสถานะ");
      return;
    }
    let on = true;
    api.getStockUnit(qrId)
      .then((unit) => { if (on) setLoadedUnits([unit]); })
      .catch((error) => { if (on) setLoadErr((error as Error).message); });
    return () => { on = false; };
  }, [qrId, units]);

  const targetQrIds = loadedUnits.length > 0 ? loadedUnits.map((unit) => unit.qrId) : qrId ? [qrId] : [];
  const firstUnit = loadedUnits[0];
  const isWorking = loadedUnits.length === 1 && firstUnit?.kind === "working";
  const reason = outcome === "discard"
    ? (reasonKey === "อื่นๆ" ? (customReason.trim() || "อื่นๆ") : reasonKey)
    : undefined;
  const count = targetQrIds.length;
  const lotSummary = Array.from(new Set(loadedUnits.map((unit) => unit.lotNo).filter(Boolean))).join(", ");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (targetQrIds.length === 0) {
      toast.error("ไม่พบขวดที่ต้องแจ้งสถานะ");
      return;
    }
    setBusy(true);
    try {
      await Promise.all(targetQrIds.map((targetQrId) => api.discardStockUnit(targetQrId, { reason, outcome })));
      const suffix = count > 1 ? ` ${count} ขวด` : "";
      toast.success(outcome === "empty" ? `แจ้งหมดแล้ว${suffix}` : `แจ้งปัญหา/ทิ้งขวดแล้ว${suffix}`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-[95vw] rounded-2xl sm:max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" /> แจ้งสถานะขวด
            </DialogTitle>
            <DialogDescription>
              {count > 1 ? `แจ้งหมด หรือแจ้งปัญหา/ทิ้ง ${count} ขวดที่เลือก` : "แจ้งหมด หรือแจ้งปัญหา/ทิ้งขวดนี้"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {loadErr && <p className="text-sm text-destructive">{loadErr}</p>}

            {loadedUnits.length === 1 && firstUnit && (
              <div className="rounded-xl border bg-muted/40 p-3">
                <div className="font-medium">{firstUnit.itemName}</div>
                <div className="mt-0.5 text-sm text-muted-foreground">
                  เหลือ <span className="font-medium text-foreground">{firstUnit.volume?.remaining ?? "-"} {firstUnit.volume?.unit}</span>
                  {" · "}{isWorking ? "working" : "คงคลัง"}
                  {firstUnit.lotNo ? ` · Lot ${firstUnit.lotNo}` : ""}
                </div>
              </div>
            )}

            {loadedUnits.length > 1 && firstUnit && (
              <div className="rounded-xl border bg-muted/40 p-3">
                <div className="font-medium">{firstUnit.itemName} · {loadedUnits.length} ขวดที่เลือก</div>
                <div className="mt-0.5 text-sm text-muted-foreground">
                  {lotSummary ? `Lot ${lotSummary}` : "หลาย Lot"}
                </div>
              </div>
            )}

            <div>
              <Label className="mb-1.5 block">การแจ้ง</Label>
              <div className="space-y-2">
                {([
                  { v: "empty", label: count > 1 ? "แจ้งหมด (ขวดที่เลือกใช้หมดแล้ว)" : "แจ้งหมด (ขวดนี้ใช้หมดแล้ว)" },
                  { v: "discard", label: count > 1 ? "แจ้งปัญหา / ทิ้งขวดที่เลือก (ระบุเหตุผล)" : "แจ้งปัญหา / ทิ้งขวด (ระบุเหตุผล)" },
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
            <Button type="submit" variant="destructive" disabled={busy || targetQrIds.length === 0}>
              {busy ? "กำลังบันทึก..." : "ยืนยัน"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
