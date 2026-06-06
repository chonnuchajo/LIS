import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Minus, Trash2, Printer, Pencil, X } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { buildStockLabelHtml } from "@/lib/stockLabel";
import { unitDerivedStatus } from "@/lib/stockUnit";
import type { StockStandardItem, StockUnitItem } from "@/types/stock";
import WithdrawDialog from "./WithdrawDialog";
import DiscardDialog from "./DiscardDialog";
import EditUnitDialog from "./EditUnitDialog";

const STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  empty: "bg-slate-100 text-slate-600",
  discarded: "bg-destructive/15 text-destructive",
  expired: "bg-amber-100 text-amber-700",
};
const STATUS_LABEL: Record<string, string> = {
  active: "ใช้งานได้", empty: "หมด", discarded: "ทิ้งแล้ว", expired: "หมดอายุ",
};

export default function UnitsDrawer({ standard, onClose }: { standard: StockStandardItem; onClose: () => void }) {
  const qc = useQueryClient();
  const [withdrawQr, setWithdrawQr] = useState<string | null>(null);
  const [discardQr, setDiscardQr] = useState<string | null>(null);
  const [editUnit, setEditUnit] = useState<StockUnitItem | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["stock", "units", standard.code],
    queryFn: () => api.getStockUnits({ itemCode: standard.code }),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["stock", "units", standard.code] });
    qc.invalidateQueries({ queryKey: ["stock", "units"] });
    qc.invalidateQueries({ queryKey: ["stock", "transactions"] });
  };

  const reprint = async (u: StockUnitItem) => {
    try {
      const html = await buildStockLabelHtml(u, window.location.origin);
      await api.printDocument({ docType: "stock-label", html });
      toast.success("ส่งปริ้นแล้ว");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={onClose}>
      <div className="bg-background w-full max-w-2xl h-full overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b sticky top-0 bg-background">
          <div>
            <div className="font-bold">{standard.name}</div>
            <div className="text-xs text-muted-foreground">{standard.code} · รายขวด</div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow>
                <TableHead>qrId</TableHead>
                <TableHead>ชนิด</TableHead>
                <TableHead>Lot</TableHead>
                <TableHead className="text-right">คงเหลือ</TableHead>
                <TableHead>EXP</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead className="text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-6">กำลังโหลด...</TableCell></TableRow>
              ) : data.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">ยังไม่มีขวด — กดรับเข้า</TableCell></TableRow>
              ) : data.map((u) => {
                const st = unitDerivedStatus(u);
                const canWithdraw = u.kind === "sealed" && st === "active";
                const canDiscard = st !== "discarded";
                return (
                  <TableRow key={u._id}>
                    <TableCell className="font-mono text-xs">{u.qrId}</TableCell>
                    <TableCell><Badge variant="outline">{u.kind === "working" ? "working" : "คงคลัง"}</Badge></TableCell>
                    <TableCell className="text-xs">{u.lotNo || "-"}</TableCell>
                    <TableCell className="text-right">{u.volume?.remaining ?? "-"} {u.volume?.unit}</TableCell>
                    <TableCell className="text-xs">{u.exp ? new Date(u.exp).toLocaleDateString("th-TH") : "-"}</TableCell>
                    <TableCell><Badge className={`text-xs ${STATUS_BADGE[st]}`}>{STATUS_LABEL[st]}</Badge></TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {canWithdraw && <Button size="icon" variant="ghost" title="แบ่ง working" onClick={() => setWithdrawQr(u.qrId)}><Minus className="w-4 h-4" /></Button>}
                        {st !== "discarded" && <Button size="icon" variant="ghost" title="แก้ไขข้อมูล" onClick={() => setEditUnit(u)}><Pencil className="w-4 h-4" /></Button>}
                        <Button size="icon" variant="ghost" title="ปริ้นซ้ำ" onClick={() => reprint(u)}><Printer className="w-4 h-4" /></Button>
                        {canDiscard && <Button size="icon" variant="ghost" title="ทิ้ง" onClick={() => setDiscardQr(u.qrId)}><Trash2 className="w-4 h-4 text-destructive" /></Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {withdrawQr && <WithdrawDialog qrId={withdrawQr} onClose={() => setWithdrawQr(null)} onSaved={refresh} />}
      {discardQr && <DiscardDialog qrId={discardQr} onClose={() => setDiscardQr(null)} onSaved={refresh} />}
      {editUnit && <EditUnitDialog unit={editUnit} onClose={() => setEditUnit(null)} onSaved={refresh} />}
    </div>
  );
}
