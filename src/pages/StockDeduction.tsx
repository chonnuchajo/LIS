import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, Filter } from "lucide-react";
import AppLayout from "@/components/lis/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import PageHeader from "@/components/lis/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/lis/DataTable";
import type { StockTransactionItem } from "@/types/stock";

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
      cell: (t) => (
        <>
          <div className="font-medium">{t.itemName}</div>
          {t.itemCode && <div className="text-xs text-muted-foreground">{t.itemCode}</div>}
        </>
      ),
    },
    { key: "tier", header: "Tier", cell: (t) => (t.tier ? <Badge variant="outline">{t.tier}</Badge> : "-") },
    {
      key: "delta",
      header: "จำนวนที่ตัด",
      className: "text-right font-mono text-destructive",
      cell: (t) => `${t.delta != null ? t.delta : "-"} ${t.unit || ""}`,
    },
    {
      key: "remaining",
      header: "คงเหลือ",
      className: "text-sm",
      cell: (t) => (
        <>
          {t.beforeQty ?? "-"} → <strong>{t.afterQty ?? "-"}</strong>
        </>
      ),
    },
    {
      key: "sample",
      header: "Sample ID",
      className: "text-xs",
      cell: (t) => (t.sampleId ? <Badge variant="outline">{t.sampleId}</Badge> : "-"),
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
              ประวัติการตัด Stock
            </span>
          }
          description={`รายการตัด stock จากการใช้งานในห้องปฏิบัติการ — บันทึกใน MongoDB · ${data.length} รายการ`}
          actions={
            <div className="flex items-center gap-2">
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
          }
        />

        <DataTable
          columns={columns}
          data={data}
          rowKey={(t) => t._id}
          isLoading={isLoading}
          emptyTitle="ยังไม่มีรายการตัด stock"
          tableClassName="min-w-[900px]"
        />
    </AppLayout>
  );
};

export default StockDeduction;
