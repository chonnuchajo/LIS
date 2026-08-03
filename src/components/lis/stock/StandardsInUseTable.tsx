// ตาราง "กำลังใช้งานอยู่" — standard ที่เบิกไปแล้วยังไม่ปิด พร้อมนาฬิกาตามความถี่/1 ครั้ง
// ปิดแถวได้ 2 ทาง: กดรับทราบตอนหมดอายุ (เฉพาะคนเบิก) หรือปุ่ม "แจ้งหมด/ปัญหา" ใน drawer ของหน้าแม่
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/lis/DataTable";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import {
  canAcknowledge,
  dueDistanceLabel,
  inUseStatus,
  sortInUse,
  type InUseStatus,
} from "@/lib/standardInUse";
import type { StandardInUseItem } from "@/types/stock";

const STATUS_LABEL: Record<InUseStatus, string> = {
  expired: "หมดอายุ",
  dueSoon: "ใกล้ครบกำหนด",
  active: "กำลังใช้งาน",
  noFrequency: "ยังไม่ได้ตั้งความถี่",
};

const STATUS_CLASS: Record<InUseStatus, string> = {
  expired: "border-destructive/40 bg-destructive/10 text-destructive",
  dueSoon: "border-amber-400/50 bg-amber-50 text-amber-700",
  active: "",
  noFrequency: "text-muted-foreground",
};

export default function StandardsInUseTable() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["stock", "in-use"],
    queryFn: api.getStandardsInUse,
    refetchInterval: 60_000,
  });

  const ack = useMutation({
    mutationFn: (row: StandardInUseItem) =>
      api.resolveStockDeduction(row._id, {
        reason: "expired",
        _user: { email: user?.email, name: user?.name },
      }),
    onMutate: (row: StandardInUseItem) => setPendingId(row._id),
    onSettled: () => setPendingId(null),
    onSuccess: () => {
      toast.success("รับทราบแล้ว");
      qc.invalidateQueries({ queryKey: ["stock", "in-use"] });
      qc.invalidateQueries({ queryKey: ["stock-deductions"] });
      qc.invalidateQueries({ queryKey: ["stock", "transactions"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const now = new Date(data?.serverTime || Date.now());
  const rows = sortInUse(data?.items ?? [], now);

  const columns: DataTableColumn<StandardInUseItem>[] = [
    {
      key: "item",
      header: "สาร",
      cell: (r) => (
        <>
          <div className="font-medium">{r.itemName || r.itemCode}</div>
          <div className="text-xs text-muted-foreground">{r.totalMg} mg · {r.weights.length} น้ำหนัก</div>
        </>
      ),
    },
    {
      key: "instrument",
      header: "เครื่อง",
      className: "text-xs",
      cell: (r) => (r.instrumentGroup ? r.instrumentGroup.toUpperCase() : "-"),
    },
    {
      key: "withdrawn",
      header: "เบิกเมื่อ",
      className: "text-xs whitespace-nowrap",
      cell: (r) => (r.withdrawnAt ? new Date(r.withdrawnAt).toLocaleString("th-TH") : "-"),
    },
    {
      key: "due",
      header: "ครบกำหนด",
      className: "text-xs whitespace-nowrap",
      cell: (r) => (
        <>
          <div>{r.dueAt ? new Date(r.dueAt).toLocaleDateString("th-TH") : "-"}</div>
          <div className="text-muted-foreground">{dueDistanceLabel(r.dueAt, now)}</div>
        </>
      ),
    },
    {
      key: "status",
      header: "สถานะ",
      cell: (r) => {
        const status = inUseStatus(r, now);
        return <Badge variant="outline" className={STATUS_CLASS[status]}>{STATUS_LABEL[status]}</Badge>;
      },
    },
    {
      key: "user",
      header: "ผู้เบิก",
      className: "text-xs",
      cell: (r) => r.userName || r.userEmail || "-",
    },
    {
      key: "action",
      header: "",
      className: "text-right",
      cell: (r) => {
        if (canAcknowledge(r, user, now)) {
          return (
            <Button
              size="sm"
              disabled={pendingId === r._id}
              onClick={(e) => { e.stopPropagation(); ack.mutate(r); }}
            >
              {pendingId === r._id ? "กำลังบันทึก..." : "รับทราบ"}
            </Button>
          );
        }
        if (inUseStatus(r, now) === "expired") {
          return (
            <span className="text-xs text-muted-foreground">
              รอ {r.userName || r.userEmail || "ผู้เบิก"} รับทราบ
            </span>
          );
        }
        return null;
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      rowKey={(r) => r._id}
      isLoading={isLoading}
      isError={isError}
      onRetry={() => refetch()}
      emptyTitle="ยังไม่มี standard ที่กำลังใช้งาน"
      emptyDescription="รายการที่เบิกแล้วยังไม่ปิดจะมาอยู่ที่นี่"
      tableClassName="min-w-[880px]"
    />
  );
}
