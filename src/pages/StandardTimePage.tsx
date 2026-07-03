import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Save, Search } from "lucide-react";
import { toast } from "sonner";

import AppLayout from "@/components/lis/AppLayout";
import PageHeader from "@/components/lis/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, type StandardTimeItem } from "@/lib/api";

type Draft = Pick<
  StandardTimeItem,
  | "mobilePhaseTopUpMin"
  | "samplePrepPerBatchMin"
  | "standardPrepMin"
  | "instrumentSetupMin"
  | "machineRunTotalMin"
  | "dataProcessingMin"
  | "recordResultMin"
  | "reportingMin"
  | "standardTimeMin"
  | "note"
>;

const numberFields: Array<keyof Draft> = [
  "mobilePhaseTopUpMin",
  "samplePrepPerBatchMin",
  "standardPrepMin",
  "instrumentSetupMin",
  "machineRunTotalMin",
  "dataProcessingMin",
  "recordResultMin",
  "reportingMin",
  "standardTimeMin",
];

function fmtMin(value?: number | null) {
  if (value == null) return "-";
  return `${Math.round(value)} นาที`;
}

function draftOf(item: StandardTimeItem): Draft {
  return {
    mobilePhaseTopUpMin: item.mobilePhaseTopUpMin ?? null,
    samplePrepPerBatchMin: item.samplePrepPerBatchMin ?? null,
    standardPrepMin: item.standardPrepMin ?? null,
    instrumentSetupMin: item.instrumentSetupMin ?? null,
    machineRunTotalMin: item.machineRunTotalMin ?? null,
    dataProcessingMin: item.dataProcessingMin ?? null,
    recordResultMin: item.recordResultMin ?? null,
    reportingMin: item.reportingMin ?? null,
    standardTimeMin: item.standardTimeMin ?? null,
    note: item.note ?? "",
  };
}

export default function StandardTimePage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [machineType, setMachineType] = useState("");
  const [hasData, setHasData] = useState("true");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  const query = useQuery({
    queryKey: ["standard-times", search, machineType, hasData],
    queryFn: () =>
      api.getStandardTimes({
        limit: 300,
        search: search.trim() || undefined,
        machineType: machineType || undefined,
        hasData: hasData === "all" ? undefined : hasData === "true",
      }),
  });
  const summaryQuery = useQuery({
    queryKey: ["standard-times", "summary"],
    queryFn: api.getStandardTimeSummary,
  });

  const items = query.data?.items ?? [];
  const summary = summaryQuery.data?.byInstrument ?? [];
  const totals = useMemo(() => {
    const withData = summary.reduce((sum, row) => sum + row.withData, 0);
    const total = summary.reduce((sum, row) => sum + row.total, 0);
    return { total, withData };
  }, [summary]);

  const save = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Draft }) => api.updateStandardTime(id, data),
    onSuccess: () => {
      toast.success("บันทึก Standard Time แล้ว");
      queryClient.invalidateQueries({ queryKey: ["standard-times"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const setDraftValue = (item: StandardTimeItem, key: keyof Draft, value: string) => {
    setDrafts((prev) => {
      const next = { ...(prev[item._id] ?? draftOf(item)) };
      next[key] = key === "note" ? value : (value === "" ? null : Number(value)) as never;
      return { ...prev, [item._id]: next };
    });
  };

  return (
    <AppLayout title="Standard Time">
      <div className="space-y-4">
        <PageHeader
          title={<span className="inline-flex items-center gap-2"><Clock className="h-6 w-6" />Standard Time</span>}
          description="ตั้งค่าเวลามาตรฐานของแต่ละการวิเคราะห์ เพื่อใช้คำนวณเวลางานตอน Assign คำขอ"
        />

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">ทั้งหมด</div>
            <div className="text-2xl font-semibold">{totals.total}</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">มีเวลาแล้ว</div>
            <div className="text-2xl font-semibold">{totals.withData}</div>
          </div>
          {summary.slice(0, 3).map((row) => (
            <div key={row._id} className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">{row._id}</div>
              <div className="text-lg font-semibold">{fmtMin(row.avgStandardTimeMin)}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1 md:max-w-sm">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาชื่อสาร / เครื่อง / column" className="pl-8" />
          </div>
          <NativeSelect value={machineType} onChange={(e) => setMachineType(e.target.value)} className="md:w-40">
            <option value="">ทุกเครื่อง</option>
            <option value="GC">GC</option>
            <option value="HPLC">HPLC</option>
          </NativeSelect>
          <NativeSelect value={hasData} onChange={(e) => setHasData(e.target.value)} className="md:w-44">
            <option value="true">มีเวลาแล้ว</option>
            <option value="false">ยังไม่มีเวลา</option>
            <option value="all">ทั้งหมด</option>
          </NativeSelect>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <Table className="min-w-[1180px]">
            <TableHeader>
              <TableRow>
                <TableHead>เครื่อง</TableHead>
                <TableHead>รายการวิเคราะห์</TableHead>
                <TableHead className="w-24 text-right">Prep</TableHead>
                <TableHead className="w-24 text-right">Std</TableHead>
                <TableHead className="w-24 text-right">Setup</TableHead>
                <TableHead className="w-24 text-right">Run</TableHead>
                <TableHead className="w-24 text-right">Process</TableHead>
                <TableHead className="w-24 text-right">Record</TableHead>
                <TableHead className="w-24 text-right">Report</TableHead>
                <TableHead className="w-28 text-right">รวม</TableHead>
                <TableHead>หมายเหตุ</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isLoading ? (
                <TableRow><TableCell colSpan={12} className="py-8 text-center text-muted-foreground">กำลังโหลด...</TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={12} className="py-8 text-center text-muted-foreground">ไม่พบข้อมูล</TableCell></TableRow>
              ) : items.map((item) => {
                const draft = drafts[item._id] ?? draftOf(item);
                const dirty = drafts[item._id] !== undefined;
                return (
                  <TableRow key={item._id}>
                    <TableCell>
                      <div className="font-medium">{item.instrument}</div>
                      <Badge variant="outline">{item.machineType || "-"}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{item.analysisName}</div>
                      <div className="text-xs text-muted-foreground">{item.columnDimension || "-"}</div>
                    </TableCell>
                    {numberFields.slice(1).map((key) => (
                      <TableCell key={key}>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft[key] ?? ""}
                          onChange={(e) => setDraftValue(item, key, e.target.value)}
                          className="h-8 text-right"
                        />
                      </TableCell>
                    ))}
                    <TableCell>
                      <Input
                        value={draft.note ?? ""}
                        onChange={(e) => setDraftValue(item, "note", e.target.value)}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant={dirty ? "primary" : "ghost"}
                        disabled={!dirty || save.isPending}
                        onClick={() => save.mutate({ id: item._id, data: draft })}
                        title="บันทึก"
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  );
}
