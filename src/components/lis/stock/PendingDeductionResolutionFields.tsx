import { AlertTriangle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DEDUCTION_RESOLUTION_LABELS,
  DEDUCTION_RESOLUTION_OPTIONS,
} from "@/lib/deductionResolution";
import type { DeductionResolutionReason, StockTransactionItem } from "@/types/stock";

interface Props {
  transaction: StockTransactionItem;
  reason: DeductionResolutionReason | "";
  note: string;
  onReasonChange: (reason: DeductionResolutionReason) => void;
  onNoteChange: (note: string) => void;
}

export default function PendingDeductionResolutionFields({
  transaction,
  reason,
  note,
  onReasonChange,
  onNoteChange,
}: Props) {
  return (
    <Alert>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>มีรายการเบิกก่อนหน้ายังไม่ได้แจ้งหมด/ปัญหา</AlertTitle>
      <AlertDescription>
        <div className="mt-2 flex flex-col gap-3">
          <p>
            {transaction.itemName || transaction.itemCode || transaction.itemId}
            {transaction.createdAt ? ` · ${new Date(transaction.createdAt).toLocaleString("th-TH")}` : ""}
          </p>
          <div>
            <Label className="mb-1.5 block">เหตุผลก่อนเบิกใหม่</Label>
            <Select value={reason} onValueChange={(value) => onReasonChange(value as DeductionResolutionReason)}>
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
            <Label className="mb-1.5 block">{reason === "ineffective" || reason === "other" ? "ระบุเหตุผล" : "เหตุผลเพิ่มเติม"}</Label>
            <Input
              value={note}
              onChange={(event) => onNoteChange(event.target.value)}
              placeholder={reason === "ineffective" || reason === "other" ? "กรุณาระบุเหตุผล" : "ไม่บังคับ"}
            />
            {(reason === "ineffective" || reason === "other") && !note.trim() ? (
              <p className="mt-1 text-xs text-destructive">กรุณาระบุเหตุผล</p>
            ) : null}
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}
