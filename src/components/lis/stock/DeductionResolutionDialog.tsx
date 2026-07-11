import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import {
  DEDUCTION_RESOLUTION_LABELS,
  DEDUCTION_RESOLUTION_OPTIONS,
  isDeductionResolutionReady,
} from "@/lib/deductionResolution";
import type { DeductionResolutionReason, StockTransactionItem } from "@/types/stock";

interface Props {
  transaction: StockTransactionItem;
  onClose: () => void;
  onSaved: (transaction: StockTransactionItem) => void;
}

export default function DeductionResolutionDialog({ transaction, onClose, onSaved }: Props) {
  const [reason, setReason] = useState<DeductionResolutionReason | "">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const ready = isDeductionResolutionReady(reason, note);

  const submit = async () => {
    if (!ready || !reason) return;
    setBusy(true);
    try {
      const updated = await api.resolveStockDeduction(transaction._id, {
        reason,
        note: note.trim() || undefined,
      });
      toast.success("แจ้งหมด/ปัญหาแล้ว");
      onSaved(updated);
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            แจ้งหมด/ปัญหา
          </DialogTitle>
          <DialogDescription>
            {transaction.itemName || transaction.itemCode || transaction.itemId}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div>
            <Label className="mb-1.5 block">เหตุผล</Label>
            <Select value={reason} onValueChange={(value) => setReason(value as DeductionResolutionReason)}>
              <SelectTrigger>
                <SelectValue placeholder="เลือกเหตุผล" />
              </SelectTrigger>
              <SelectContent>
                {DEDUCTION_RESOLUTION_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {DEDUCTION_RESOLUTION_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-1.5 block">
              {reason === "ineffective" || reason === "other" ? "ระบุเหตุผล" : "เหตุผลเพิ่มเติม"}
            </Label>
            <Input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={reason === "ineffective" || reason === "other" ? "กรุณาระบุเหตุผล" : "ไม่บังคับ"}
            />
            {(reason === "ineffective" || reason === "other") && !note.trim() ? (
              <p className="mt-1 text-xs text-destructive">กรุณาระบุเหตุผล</p>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button type="button" disabled={!ready || busy} onClick={submit}>
            {busy ? "กำลังบันทึก..." : "แจ้งหมด/ปัญหา"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
