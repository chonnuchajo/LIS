import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Filter } from "lucide-react";
import AppLayout from "@/components/lis/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAccessibleTabs } from "@/hooks/useAccessibleTabs";
import { api } from "@/lib/api";
import PageHeader from "@/components/lis/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/lis/DataTable";
import StockRequisitionButton from "@/components/lis/stock/StockRequisitionButton";
import StandardsInUseTable from "@/components/lis/stock/StandardsInUseTable";
import DeductionResolutionDialog from "@/components/lis/stock/DeductionResolutionDialog";
import { ANALYSIS_ROOM_SLUG } from "@/lib/analysisInstruments";
import { DEDUCTION_RESOLUTION_LABELS } from "@/lib/deductionResolution";
import { deductionAmount } from "@/lib/stockDeduction";
import { getRoomCatalog } from "@/lib/roomEquipment";
import type { StockTransactionItem } from "@/types/stock";

const analysisInstruments =
  getRoomCatalog(ANALYSIS_ROOM_SLUG)?.instruments.map((i) => ({ id: i.id, name: i.name, group: i.group })) ?? [];

const StockDeduction = () => {
  const queryClient = useQueryClient();
  const { tabs, defaultKey } = useAccessibleTabs("/stock-deduction");
  const [type, setType] = useState<string>("");
  const [selected, setSelected] = useState<StockTransactionItem | null>(null);
  const [resolving, setResolving] = useState<StockTransactionItem | null>(null);

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
    {
      key: "resolution",
      header: "การแจ้ง",
      className: "text-xs",
      cell: (t) => t.deductionResolution ? (
        <Badge variant="secondary">{DEDUCTION_RESOLUTION_LABELS[t.deductionResolution.reason]}</Badge>
      ) : t.itemType === "glassware" ? (
        <span className="text-muted-foreground">-</span>
      ) : (
        <Badge variant="outline">ยังไม่ได้แจ้ง</Badge>
      ),
    },
    { key: "user", header: "ผู้ดำเนินการ", className: "text-xs", cell: (t) => t.userName || t.userEmail || "-" },
    { key: "note", header: "หมายเหตุ", className: "text-xs text-muted-foreground", cell: (t) => t.note || "" },
  ];

  const handleResolved = (updated: StockTransactionItem) => {
    setSelected((current) => (current?._id === updated._id ? updated : current));
    queryClient.invalidateQueries({ queryKey: ["stock-deductions"] });
    queryClient.invalidateQueries({ queryKey: ["stock", "transactions"] });
    queryClient.invalidateQueries({ queryKey: ["stock", "units"] });
  };

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

      <Tabs key={defaultKey} defaultValue={defaultKey}>
        <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
          <TabsList className="mb-4 w-max">
            {tabs.map((t) => (
              <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="in-use">
          <StandardsInUseTable />
        </TabsContent>

        <TabsContent value="history">
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
            onRowClick={(row) => setSelected(row)}
            emptyTitle="ยังไม่มีรายการตัด stock"
            tableClassName="min-w-[860px]"
          />
        </TabsContent>
      </Tabs>

      <DeductionDetailSheet
        transaction={selected}
        onClose={() => setSelected(null)}
        onResolve={(transaction) => setResolving(transaction)}
      />
      {resolving && (
        <DeductionResolutionDialog
          transaction={resolving}
          onClose={() => setResolving(null)}
          onSaved={handleResolved}
        />
      )}
    </AppLayout>
  );
};

export default StockDeduction;

function DeductionDetailSheet({
  transaction,
  onClose,
  onResolve,
}: {
  transaction: StockTransactionItem | null;
  onClose: () => void;
  onResolve: (transaction: StockTransactionItem) => void;
}) {
  const amount = transaction ? deductionAmount(transaction) : null;
  const resolution = transaction?.deductionResolution;
  const canResolve = Boolean(transaction && transaction.itemType !== "glassware" && !resolution);

  return (
    <Sheet open={Boolean(transaction)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border p-5 pr-16 text-left">
          <SheetTitle>รายละเอียดการเบิก</SheetTitle>
          <SheetDescription>
            {transaction?.itemName || transaction?.itemCode || transaction?.itemId || "-"}
          </SheetDescription>
        </SheetHeader>

        {transaction && amount ? (
          <div className="flex flex-col gap-5 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{transaction.itemType}</Badge>
              {transaction.qrId ? <Badge variant="secondary">QR {transaction.qrId}</Badge> : null}
              {resolution ? (
                <Badge variant="secondary">แจ้งแล้ว: {DEDUCTION_RESOLUTION_LABELS[resolution.reason]}</Badge>
              ) : transaction.itemType !== "glassware" ? (
                <Badge variant="outline">ยังไม่ได้แจ้ง</Badge>
              ) : null}
            </div>

            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <DetailItem label="รายการ" value={transaction.itemName || "-"} />
              <DetailItem label="รหัส" value={transaction.itemCode || "-"} />
              <DetailItem label="เวลา" value={new Date(transaction.createdAt).toLocaleString("th-TH")} />
              <DetailItem label="จำนวนที่ตัด" value={amount.sub ? `${amount.text} (${amount.sub})` : amount.text} />
              <DetailItem
                label="คงเหลือ"
                value={`${transaction.beforeQty ?? "-"} → ${transaction.afterQty ?? "-"}${transaction.unit ? ` ${transaction.unit}` : ""}`}
              />
              <DetailItem label="เครื่อง" value={transaction.instrumentName || transaction.instrumentGroup?.toUpperCase() || "-"} />
              <DetailItem label="ผู้ดำเนินการ" value={transaction.userName || transaction.userEmail || "-"} />
              <DetailItem label="หมายเหตุ" value={transaction.note || "-"} />
            </dl>

            {resolution ? (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <div className="font-medium">แจ้งหมด/ปัญหาแล้ว</div>
                <div className="mt-1 text-muted-foreground">
                  {DEDUCTION_RESOLUTION_LABELS[resolution.reason]}
                  {resolution.note ? ` — ${resolution.note}` : ""}
                </div>
              </div>
            ) : canResolve ? (
              <Button type="button" onClick={() => onResolve(transaction)}>
                แจ้งหมด/ปัญหา
              </Button>
            ) : null}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words font-medium">{value}</dd>
    </div>
  );
}
