import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { History, Filter, Pencil, ScanLine, Trash2 } from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/lis/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { useAccessibleTabs } from "@/hooks/useAccessibleTabs";
import { api } from "@/lib/api";
import PageHeader from "@/components/lis/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/lis/DataTable";
import StockRequisitionButton from "@/components/lis/stock/StockRequisitionButton";
import StockQrScanner, { type DecodedScanResult } from "@/components/lis/StockQrScanner";
import StandardsInUseTable from "@/components/lis/stock/StandardsInUseTable";
import DeductionResolutionDialog from "@/components/lis/stock/DeductionResolutionDialog";
import { ANALYSIS_ROOM_SLUG } from "@/lib/analysisInstruments";
import { DEDUCTION_RESOLUTION_LABELS } from "@/lib/deductionResolution";
import { requisitionUser } from "@/lib/standardRequisition";
import { canManageStockDeduction, deductionAmount } from "@/lib/stockDeduction";
import { formatStockQuantity } from "@/lib/stockQuantity";
import { getRoomCatalog } from "@/lib/roomEquipment";
import type { StockTransactionItem } from "@/types/stock";

const analysisInstruments =
  getRoomCatalog(ANALYSIS_ROOM_SLUG)?.instruments.map((i) => ({ id: i.id, name: i.name, group: i.group })) ?? [];

const StockDeduction = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { tabs, defaultKey } = useAccessibleTabs("/stock-deduction");
  const [type, setType] = useState<string>("");
  const [selected, setSelected] = useState<StockTransactionItem | null>(null);
  const [resolving, setResolving] = useState<StockTransactionItem | null>(null);
  const [editing, setEditing] = useState<StockTransactionItem | null>(null);
  const [deleting, setDeleting] = useState<StockTransactionItem | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedQrId, setScannedQrId] = useState<string | null>(null);
  const [lastScanResult, setLastScanResult] = useState<DecodedScanResult | null>(null);
  const queryQrId = searchParams.get("qrId")?.trim() || null;
  const initialQrId = scannedQrId ?? queryQrId;
  const clearInitialQrId = useCallback(() => {
    if (scannedQrId) {
      setScannedQrId(null);
      return;
    }
    if (!queryQrId) return;
    const next = new URLSearchParams(searchParams);
    next.delete("qrId");
    setSearchParams(next, { replace: true });
  }, [queryQrId, scannedQrId, searchParams, setSearchParams]);

  const applyScannedQrId = useCallback((qrId: string) => {
    setScannedQrId(qrId);
    setScannerOpen(false);
    if (queryQrId) {
      const next = new URLSearchParams(searchParams);
      next.delete("qrId");
      setSearchParams(next, { replace: true });
      }
    }, [queryQrId, searchParams, setSearchParams]);

  const refreshStockDeductions = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["stock-deductions"] });
    queryClient.invalidateQueries({ queryKey: ["stock", "transactions"] });
    queryClient.invalidateQueries({ queryKey: ["stock", "units"] });
    queryClient.invalidateQueries({ queryKey: ["stock", "in-use"] });
    queryClient.invalidateQueries({ queryKey: ["stock", "standards"] });
    queryClient.invalidateQueries({ queryKey: ["stock", "solvents"] });
    queryClient.invalidateQueries({ queryKey: ["stock", "glassware"] });
  }, [queryClient]);

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
          {formatStockQuantity(t.beforeQty)} → <strong>{formatStockQuantity(t.afterQty)}</strong>
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
    {
      key: "actions",
      header: "จัดการ",
      className: "text-right",
      cell: (t) => canManageStockDeduction(t, user) ? (
        <div
          className="flex justify-end gap-1"
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
        >
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label={`แก้ไขการเบิก ${t.itemName || t.itemCode || t._id}`}
            onClick={() => setEditing(t)}
          >
            <Pencil className="mr-1 h-3.5 w-3.5" /> แก้ไข
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            aria-label={`ลบการเบิก ${t.itemName || t.itemCode || t._id}`}
            onClick={() => setDeleting(t)}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" /> ลบ
          </Button>
        </div>
      ) : null,
    },
  ];

  const handleResolved = (updated: StockTransactionItem) => {
    setSelected((current) => (current?._id === updated._id ? updated : current));
    refreshStockDeductions();
  };

  const handleEdited = (updated: StockTransactionItem) => {
    setSelected((current) => (current?._id === updated._id ? updated : current));
    setEditing(null);
    refreshStockDeductions();
  };

  const deleteDeduction = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.deleteStockDeduction(deleting._id, { _user: requisitionUser(user) });
      toast.success("ลบการเบิกแล้ว");
      setSelected((current) => (current?._id === deleting._id ? null : current));
      setDeleting(null);
      refreshStockDeductions();
    } catch (err) {
      toast.error((err as Error).message || "ลบการเบิกไม่สำเร็จ");
    } finally {
      setDeleteBusy(false);
    }
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
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => setScannerOpen(true)}>
              <ScanLine className="mr-1 h-4 w-4" /> สแกน QR ข้างขวด
            </Button>
            <StockRequisitionButton
              roomSlug={ANALYSIS_ROOM_SLUG}
              instruments={analysisInstruments}
              initialQrId={initialQrId}
              onInitialQrConsumed={clearInitialQrId}
            />
          </>
        }
      />

      {lastScanResult && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <div className="font-medium">ค่าที่ scanner อ่านได้ล่าสุด</div>
          <div className="mt-1 break-all text-xs">raw: {lastScanResult.raw}</div>
          <div className="mt-1 break-all text-xs">qrId: {lastScanResult.value}</div>
        </div>
      )}

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
            tableClassName="min-w-[980px]"
          />
        </TabsContent>
      </Tabs>
      <StockQrScanner
        open={scannerOpen}
        title="สแกน QR ข้างขวดเพื่อเบิก"
        showManualEntry={false}
        onClose={() => setScannerOpen(false)}
        onDecoded={setLastScanResult}
        onScanned={applyScannedQrId}
      />

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
      {editing && (
        <DeductionEditDialog
          transaction={editing}
          user={user}
          onClose={() => setEditing(null)}
          onSaved={handleEdited}
        />
      )}
      <DeductionDeleteDialog
        transaction={deleting}
        busy={deleteBusy}
        onCancel={() => setDeleting(null)}
        onConfirm={deleteDeduction}
      />
    </AppLayout>
  );
};

export default StockDeduction;

function deductionAmountValue(transaction: StockTransactionItem): number {
  const value = transaction.volumeDelta ?? transaction.delta;
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.abs(amount) : 0;
}

function formatAmountInput(value: number): string {
  return Number.isFinite(value) && value > 0 ? String(value) : "";
}

function unitLabel(transaction: StockTransactionItem): string {
  return transaction.unit || transaction.volumeUnit || (transaction.weights?.length ? "mg" : "");
}

function DeductionEditDialog({
  transaction,
  user,
  onClose,
  onSaved,
}: {
  transaction: StockTransactionItem;
  user: { email?: string; name?: string } | null;
  onClose: () => void;
  onSaved: (transaction: StockTransactionItem) => void;
}) {
  const initialWeights = transaction.weights?.length ? transaction.weights : [];
  const [amount, setAmount] = useState(formatAmountInput(deductionAmountValue(transaction)));
  const [weights, setWeights] = useState(initialWeights.map((weight) => formatAmountInput(weight)));
  const [note, setNote] = useState(transaction.note || "");
  const [busy, setBusy] = useState(false);
  const isWeightMode = weights.length > 0;
  const weightNumbers = weights.map((weight) => Number(weight));
  const parsedAmount = isWeightMode
    ? weightNumbers.reduce((total, weight) => total + (Number.isFinite(weight) ? weight : 0), 0)
    : Number(amount);
  const hasInvalidWeights = isWeightMode && weightNumbers.some((weight) => !Number.isFinite(weight) || weight <= 0);
  const canSave = Number.isFinite(parsedAmount) && parsedAmount > 0 && !hasInvalidWeights;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      const updated = await api.updateStockDeduction(transaction._id, {
        ...(isWeightMode ? { weights: weightNumbers } : { amount: parsedAmount }),
        note,
        _user: requisitionUser(user),
      });
      toast.success("แก้ไขการเบิกแล้ว");
      onSaved(updated);
    } catch (err) {
      toast.error((err as Error).message || "แก้ไขการเบิกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>แก้ไขการเบิก</DialogTitle>
          <DialogDescription>
            {transaction.itemName || transaction.itemCode || transaction._id}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {isWeightMode ? (
            <div className="space-y-2">
              <Label>น้ำหนักที่ตัด ({unitLabel(transaction) || "mg"})</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {weights.map((weight, index) => (
                  <Input
                    key={`${transaction._id}-weight-${index}`}
                    type="number"
                    min="0"
                    step="any"
                    value={weight}
                    aria-label={`น้ำหนักที่ ${index + 1}`}
                    onChange={(event) => setWeights((current) => current.map((value, valueIndex) => (
                      valueIndex === index ? event.target.value : value
                    )))}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">รวม {formatStockQuantity(parsedAmount)} {unitLabel(transaction) || "mg"}</p>
              {hasInvalidWeights && <p className="text-sm text-destructive">กรุณากรอกน้ำหนักทุกช่องให้มากกว่า 0</p>}
            </div>
          ) : (
            <div>
              <Label className="mb-1.5 block">จำนวนที่ตัด {unitLabel(transaction) ? `(${unitLabel(transaction)})` : ""}</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
          )}
          <div>
            <Label className="mb-1.5 block">หมายเหตุ</Label>
            <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="optional" />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>ยกเลิก</Button>
          <Button type="button" onClick={save} disabled={!canSave || busy}>
            {busy ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeductionDeleteDialog({
  transaction,
  busy,
  onCancel,
  onConfirm,
}: {
  transaction: StockTransactionItem | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  return (
    <Dialog open={Boolean(transaction)} onOpenChange={(open) => { if (!open && !busy) onCancel(); }}>
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ลบการเบิก?</DialogTitle>
          <DialogDescription>
            {transaction
              ? `รายการ "${transaction.itemName || transaction.itemCode || transaction._id}" จะถูกลบ และคืนจำนวนกลับเข้า stock`
              : "ยืนยันการลบการเบิก"}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>ยกเลิก</Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={busy}>
            {busy ? "กำลังลบ..." : "ลบ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
                value={`${formatStockQuantity(transaction.beforeQty)} → ${formatStockQuantity(transaction.afterQty)}${transaction.unit ? ` ${transaction.unit}` : ""}`}
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
