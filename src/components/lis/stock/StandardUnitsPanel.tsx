import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Minus, Trash2, Printer, Pencil, Plus, ChevronRight, ChevronDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { buildStockLabelHtml } from "@/lib/stockLabel";
import { unitDerivedStatus, buildUnitTree } from "@/lib/stockUnit";
import type { StockStandardItem, StockUnitItem } from "@/types/stock";
import WithdrawDialog from "./WithdrawDialog";
import DiscardDialog from "./DiscardDialog";
import EditUnitDialog from "./EditUnitDialog";
import ReceiveBottlesDialog from "./ReceiveBottlesDialog";

const STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  empty: "bg-slate-100 text-slate-600",
  discarded: "bg-destructive/15 text-destructive",
  expired: "bg-amber-100 text-amber-700",
};
const STATUS_LABEL: Record<string, string> = {
  active: "ใช้งานได้", empty: "หมด", discarded: "ทิ้งแล้ว", expired: "หมดอายุ",
};

/** ตารางจัดการขวดรายตัวของสารมาตรฐาน (เพิ่ม/แก้/แบ่ง/ปริ้นซ้ำ/ทิ้ง) — ใช้ทั้งใน
 *  UnitsDrawer และฝังในฟอร์มแก้ไข Standard. ปุ่มทุกอันเป็น type="button"
 *  เพื่อไม่ให้ submit ฟอร์มที่ครอบอยู่ (ตอนฝังในฟอร์มแก้ไข Standard) */
export default function StandardUnitsPanel({ standard }: { standard: StockStandardItem }) {
  const qc = useQueryClient();
  const [withdrawQr, setWithdrawQr] = useState<string | null>(null);
  const [discardQr, setDiscardQr] = useState<string | null>(null);
  const [editUnit, setEditUnit] = useState<StockUnitItem | null>(null);
  const [receiving, setReceiving] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (rootId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(rootId) ? next.delete(rootId) : next.add(rootId);
      return next;
    });

  const { data = [], isLoading } = useQuery({
    queryKey: ["stock", "units", standard.code],
    queryFn: () => api.getStockUnits({ itemCode: standard.code }),
  });

  // จัดเป็น tree: ref (sealed) เป็น root, working เป็นลูก 1.1/1.2; ซ่อน discarded ใน helper
  const rows = buildUnitTree(data);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["stock", "units", standard.code] });
    qc.invalidateQueries({ queryKey: ["stock", "units"] });
    qc.invalidateQueries({ queryKey: ["stock", "transactions"] });
  };

  const reprint = async (u: StockUnitItem) => {
    try {
      const html = await buildStockLabelHtml(u);
      await api.printDocument({ docType: "stock-label", html });
      toast.success("ส่งปริ้นแล้ว");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div>
      <div className="flex justify-end mb-2">
        <Button type="button" size="sm" variant="outline" onClick={() => setReceiving(true)}>
          <Plus className="w-4 h-4 mr-1" /> เพิ่มขวด (รับเข้า)
        </Button>
      </div>
      <div className="overflow-x-auto">
        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 text-center">#</TableHead>
              <TableHead>ชนิด</TableHead>
              <TableHead>ที่มา</TableHead>
              <TableHead>Lot</TableHead>
              <TableHead className="text-right">คงเหลือ</TableHead>
              <TableHead>EXP</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead className="text-right">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-6">กำลังโหลด...</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">ยังไม่มีขวด — กดเพิ่มขวด</TableCell></TableRow>
            ) : rows.map((row) => {
              const u = row.unit;
              if (row.depth === 1 && !expanded.has(row.rootId)) return null;
              const st = unitDerivedStatus(u);
              const canWithdraw = u.kind === "sealed" && st === "active";
              const canDiscard = st !== "discarded";
              const isChild = row.depth === 1;
              return (
                <TableRow key={u._id} className={isChild ? "bg-muted/30" : undefined}>
                  <TableCell className="text-center text-muted-foreground">
                    <div className={`flex items-center gap-1 ${isChild ? "pl-5" : ""}`}>
                      {row.depth === 0 && row.hasChildren ? (
                        <button type="button" onClick={() => toggle(row.rootId)} className="text-muted-foreground hover:text-foreground" title={expanded.has(row.rootId) ? "พับ" : "กาง"}>
                          {expanded.has(row.rootId) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      ) : row.depth === 0 ? (
                        <span className="inline-block w-4" />
                      ) : null}
                      <span>{row.label}</span>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{u.kind === "working" ? "working" : "คงคลัง"}</Badge></TableCell>
                  <TableCell className="text-xs">
                    {u.source === "primary" ? "primary" : u.source === "supply" ? "supply" : "-"}
                  </TableCell>
                  <TableCell className="text-xs">{u.lotNo || "-"}</TableCell>
                  <TableCell className="text-right">{u.volume?.remaining ?? "-"} {u.volume?.unit}</TableCell>
                  <TableCell className="text-xs">{u.exp ? new Date(u.exp).toLocaleDateString("th-TH") : "-"}</TableCell>
                  <TableCell><Badge className={`text-xs ${STATUS_BADGE[st]}`}>{STATUS_LABEL[st]}</Badge></TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {canWithdraw && <Button type="button" size="icon" variant="ghost" title="แบ่ง working" onClick={() => setWithdrawQr(u.qrId)}><Minus className="w-4 h-4" /></Button>}
                      {st !== "discarded" && <Button type="button" size="icon" variant="ghost" title="แก้ไขข้อมูล" onClick={() => setEditUnit(u)}><Pencil className="w-4 h-4" /></Button>}
                      <Button type="button" size="icon" variant="ghost" title="ปริ้นซ้ำ" onClick={() => reprint(u)}><Printer className="w-4 h-4" /></Button>
                      {canDiscard && <Button type="button" size="icon" variant="ghost" title="ทิ้ง" onClick={() => setDiscardQr(u.qrId)}><Trash2 className="w-4 h-4 text-destructive" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {receiving && <ReceiveBottlesDialog standard={standard} onClose={() => setReceiving(false)} onSaved={refresh} />}
      {withdrawQr && <WithdrawDialog qrId={withdrawQr} onClose={() => setWithdrawQr(null)} onSaved={refresh} />}
      {discardQr && <DiscardDialog qrId={discardQr} onClose={() => setDiscardQr(null)} onSaved={refresh} />}
      {editUnit && <EditUnitDialog unit={editUnit} onClose={() => setEditUnit(null)} onSaved={refresh} />}
    </div>
  );
}
