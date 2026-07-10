import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, Filter } from "lucide-react";
import AppLayout from "@/components/lis/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import PageHeader from "@/components/lis/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/lis/DataTable";
import StockRequisitionButton from "@/components/lis/stock/StockRequisitionButton";
import { ANALYSIS_ROOM_SLUG } from "@/lib/analysisInstruments";
import { deductionAmount } from "@/lib/stockDeduction";
import { getRoomCatalog } from "@/lib/roomEquipment";
import type { StockTransactionItem } from "@/types/stock";

const analysisInstruments =
  getRoomCatalog(ANALYSIS_ROOM_SLUG)?.instruments.map((i) => ({ id: i.id, name: i.name, group: i.group })) ?? [];

const StockDeduction = () => {
  const [type, setType] = useState<string>("");

  const { data = [], isLoading } = useQuery({
    queryKey: ["stock-deductions", type],
    queryFn: () =>
      api.getStockTransactions({
        action: "deduct",
        itemType: type || undefined,
        limit: 200,
      }),
  });

  const columns: DataTableColumn<StockTransactionItem>[] = [
    {
      key: "time",
      header: "เวลา",
      className: "text-xs whitespace-nowrap",
      cell: (t) => new Date(t.createdAt).toLocaleString("th-TH"),
    },
    { key: "type", header: "หมวด", cell: (t) => <Badge variant="outline">{t.itemType}</Badge> },
    {
      key: "item",
      header: "รายการ",
      cell: (t) => <div className="font-medium">{t.itemName}</div>,
    },
    {
      key: "delta",
      header: "จำนวนที่ตัด",
      className: "text-right font-mono",
      cell: (t) => {
        const { text, sub } = deductionAmount(t);
        return (
          <>
            <div className="text-destructive">{text}</div>
            {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
          </>
        );
      },
    },
    {
      key: "remaining",
      header: "คงเหลือ",
      className: "text-sm",
      cell: (t) => (
        <>
          {t.beforeQty ?? "-"} → <strong>{t.afterQty ?? "-"}</strong>
          {t.unit ? <span className="text-xs text-muted-foreground"> {t.unit}</span> : null}
        </>
      ),
    },
    { key: "user", header: "ผู้ดำเนินการ", className: "text-xs", cell: (t) => t.userName || t.userEmail || "-" },
    { key: "note", header: "หมายเหตุ", className: "text-xs text-muted-foreground", cell: (t) => t.note || "" },
  ];

  return (
    <AppLayout>
      <PageHeader
        className="mb-6"
        title={
          <span className="inline-flex items-center gap-2">
            <History className="w-6 h-6" />
            การเบิก stock
          </span>
        }
        description="เบิกสารเคมีให้เครื่อง และดูประวัติการตัด stock"
        actions={<StockRequisitionButton roomSlug={ANALYSIS_ROOM_SLUG} instruments={analysisInstruments} />}
      />

      <div className="mb-3 flex items-center justify-end gap-2">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={type || "all"} onValueChange={(v) => setType(v === "all" ? "" : v)}>
          <SelectTrigger className="h-9 w-full sm:w-44">
            <SelectValue placeholder="ทุกหมวด" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกหมวด</SelectItem>
            <SelectItem value="standard">Standards</SelectItem>
            <SelectItem value="solvent">สารเคมี</SelectItem>
            <SelectItem value="glassware">เครื่องแก้ว</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DataTable
        columns={columns}
        data={data}
        rowKey={(t) => t._id}
        isLoading={isLoading}
        emptyTitle="ยังไม่มีรายการตัด stock"
        tableClassName="min-w-[760px]"
      />
    </AppLayout>
  );
};

export default StockDeduction;
