import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Printer, Pencil, Plus, TriangleAlert } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import StockRawLabelPreviewDialog from "@/components/lis/StockRawLabelPreviewDialog";
import { api } from "@/lib/api";
import { buildStockLabelHtml } from "@/lib/stockLabel";
import { unitDerivedStatus, visibleBottles } from "@/lib/stockUnit";
import type { StockStandardItem, StockUnitItem } from "@/types/stock";
import EditUnitDialog from "./EditUnitDialog";
import ReceiveBottlesDialog from "./ReceiveBottlesDialog";
import PerformanceDropDialog from "./PerformanceDropDialog";

const STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  empty: "bg-slate-100 text-slate-600",
  discarded: "bg-destructive/15 text-destructive",
  expired: "bg-amber-100 text-amber-700",
};
const STATUS_LABEL: Record<string, string> = {
  active: "ใช้งานได้", empty: "หมด", discarded: "ทิ้งแล้ว", expired: "หมดอายุ",
};

type PreviewLabelOptions = { autoPrint?: boolean };

/** ตารางจัดการขวดรายตัวของสารมาตรฐาน (เพิ่ม/แก้/แบ่ง/ปริ้นซ้ำ/ทิ้ง) — ใช้ทั้งใน
 *  StandardDetailDrawer และฝังในฟอร์มแก้ไข Standard. ปุ่มทุกอันเป็น type="button"
 *  เพื่อไม่ให้ submit ฟอร์มที่ครอบอยู่ (ตอนฝังในฟอร์มแก้ไข Standard)
 *  ส่ง onEdit เมื่อต้องการปุ่มแก้ไขข้างปุ่มเพิ่มขวด (ใช้ใน drawer); ไม่ส่ง = ไม่มีปุ่ม */
export default function StandardUnitsPanel({ standard, onEdit }: { standard: StockStandardItem; onEdit?: () => void }) {
  const qc = useQueryClient();
  const [editUnit, setEditUnit] = useState<StockUnitItem | null>(null);
  const [receiving, setReceiving] = useState(false);
  const [reportQr, setReportQr] = useState<string | null>(null);
  const [pendingLabels, setPendingLabels] = useState<string[]>([]);
  const [labelPreviewOpen, setLabelPreviewOpen] = useState(false);
  const [autoPrintLabels, setAutoPrintLabels] = useState(false);
  const [labelPrintJobId, setLabelPrintJobId] = useState(0);

  const { data = [], isLoading } = useQuery({
    queryKey: ["stock", "units", standard.code],
    queryFn: () => api.getStockUnits({ itemCode: standard.code }),
  });

  // รายการขวดแบบเรียบ (ไม่มี parent-child) — ซ่อน discarded ใน helper
  const rows = visibleBottles(data);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["stock", "units", standard.code] });
    qc.invalidateQueries({ queryKey: ["stock", "units"] });
    qc.invalidateQueries({ queryKey: ["stock", "transactions"] });
  };

  const previewLabels = (labels: string[], options?: PreviewLabelOptions) => {
    setPendingLabels(labels);
    setAutoPrintLabels(options?.autoPrint === true);
    setLabelPrintJobId((id) => id + 1);
    setLabelPreviewOpen(true);
  };

  const reprint = async (u: StockUnitItem) => {
    try {
      const html = await buildStockLabelHtml(u);
      previewLabels([html]);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div>
      <div className="flex justify-end gap-2 mb-2">
        {onEdit && (
          <Button type="button" size="sm" variant="outline" onClick={onEdit}>
            <Pencil className="w-4 h-4 mr-1" /> แก้ไข
          </Button>
        )}
        <Button type="button" size="sm" variant="outline" onClick={() => setReceiving(true)}>
          <Plus className="w-4 h-4 mr-1" /> เพิ่มขวด (รับเข้า)
        </Button>
      </div>
      <div className="overflow-x-auto">
        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 text-center">#</TableHead>
              <TableHead>ประเภท</TableHead>
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
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">ยังไม่มีขวด — กดเพิ่มขวด</TableCell></TableRow>
            ) : rows.map((u, i) => {
              const st = unitDerivedStatus(u);
              return (
                <TableRow key={u._id}>
                  <TableCell className="text-center text-muted-foreground">{i + 1}</TableCell>
                  <TableCell><Badge variant="outline">{u.type || "primary"}</Badge></TableCell>
                  <TableCell className="text-xs">{u.lotNo || "-"}</TableCell>
                  <TableCell className="text-right">{u.volume?.remaining ?? "-"} {u.volume?.unit}</TableCell>
                  <TableCell className="text-xs">{u.exp ? new Date(u.exp).toLocaleDateString("th-TH") : "-"}</TableCell>
                  <TableCell><Badge className={`text-xs ${STATUS_BADGE[st]}`}>{STATUS_LABEL[st]}</Badge></TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {st !== "discarded" && <Button type="button" size="icon" variant="ghost" title="แก้ไขข้อมูล" onClick={() => setEditUnit(u)}><Pencil className="w-4 h-4" /></Button>}
                      <Button type="button" size="icon" variant="ghost" title="ปริ้นซ้ำ" onClick={() => reprint(u)}><Printer className="w-4 h-4" /></Button>
                      {st !== "discarded" && st !== "empty" && (
                        <Button type="button" size="icon" variant="ghost" title="แจ้งหมด/ปัญหา" onClick={() => setReportQr(u.qrId)}>
                          <TriangleAlert className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {receiving && <ReceiveBottlesDialog standard={standard} onClose={() => setReceiving(false)} onSaved={refresh} onPreviewLabels={previewLabels} />}
      {editUnit && <EditUnitDialog unit={editUnit} onClose={() => setEditUnit(null)} onSaved={refresh} />}
      {reportQr && <PerformanceDropDialog qrId={reportQr} onClose={() => setReportQr(null)} onSaved={() => { setReportQr(null); refresh(); }} />}
      <StockRawLabelPreviewDialog
        open={labelPreviewOpen}
        labels={pendingLabels}
        autoPrint={autoPrintLabels}
        autoPrintKey={labelPrintJobId}
        onOpenChange={(open) => {
          setLabelPreviewOpen(open);
          if (!open) {
            setPendingLabels([]);
            setAutoPrintLabels(false);
          }
        }}
        onPrinted={() => {
          setPendingLabels([]);
          setAutoPrintLabels(false);
        }}
      />
    </div>
  );
}
