import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { standardStatusMeta } from "@/lib/standardStatus";
import { cn } from "@/lib/utils";
import type { StockUnitItem } from "@/types/stock";

interface Props {
  qrId: string;
  onClose: () => void;
}

const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("th-TH") : "-");
const fmtDateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }) : "-";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

/** รายละเอียด working standard (อ่านอย่างเดียว) — เปิดจากเมนู ⋮ */
export default function StandardUnitDetailDialog({ qrId, onClose }: Props) {
  const [unit, setUnit] = useState<StockUnitItem | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let on = true;
    api.getStockUnit(qrId)
      .then((u) => { if (on) setUnit(u); })
      .catch((e) => { if (on) setErr((e as Error).message); });
    return () => { on = false; };
  }, [qrId]);

  const meta = unit ? standardStatusMeta(unit) : null;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[95vw] rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{unit?.itemName ?? "รายละเอียด Standard"}</DialogTitle>
          <DialogDescription>{unit?.itemCode ?? qrId}</DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {err && <p className="text-sm text-destructive">{err}</p>}
          {unit && (
            <>
              <div className="mb-2 flex items-center gap-2">
                {meta && <Badge className={cn("text-xs", meta.cls)}>{meta.label}</Badge>}
                <Badge variant="outline" className="text-xs">{unit.kind === "working" ? "working" : "คงคลัง"}</Badge>
              </div>
              <div className="divide-y">
                <Row label="ปริมาณ" value={`${unit.volume?.remaining ?? "-"} / ${unit.volume?.initial ?? "-"} ${unit.volume?.unit ?? ""}`} />
                <Row label="Lot" value={unit.lotNo || "-"} />
                <Row label="วันหมดอายุ (EXP)" value={fmtDate(unit.exp)} />
                <Row label="ครบความถี่" value={fmtDate(unit.frequencyDue)} />
                <Row label="วันแบ่ง" value={fmtDateTime(unit.withdrawnDate)} />
                <Row label="ผู้แบ่ง" value={unit.createdBy?.name || unit.createdBy?.email || "-"} />
                {unit.status === "discarded" && (
                  <>
                    <Row label="ทิ้งเมื่อ" value={fmtDateTime(unit.discardedAt)} />
                    <Row label="เหตุผลที่ทิ้ง" value={unit.discardReason || "-"} />
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>ปิด</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
