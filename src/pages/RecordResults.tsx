import { useState } from "react";
import AppLayout from "@/components/lis/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, CheckCircle, FlaskConical, Calculator, FileText } from "lucide-react";
import { toast } from "sonner";
import { useSamples } from "@/context/SampleContext";
import COADialog from "@/components/lis/COADialog";
import type { SampleItem } from "@/components/lis/SampleColumn";
import PageHeader from "@/components/lis/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/lis/DataTable";

const RecordResults = () => {
  const { testingSamples, doneSamples, approvals, approveLab, physicalResults } = useSamples();
  const [approvalActions, setApprovalActions] = useState<Record<string, "approved" | "rejected">>({});
  const [coaSample, setCoaSample] = useState<SampleItem | null>(null);

  const allSamples = [
    ...testingSamples,
    ...doneSamples,
  ];

  const getAnalysisStatus = (sample: typeof allSamples[0]) => {
    const approval = approvals[sample.id];
    if (approval?.labApproved) return "approved";
    const pct = sample.aiPercent ?? 0;
    if (pct >= 100) return "done";
    if (pct >= 80) return "calculating";
    return "analyzing";
  };

  const handleDropdownApprove = (sampleId: string, action: "approved" | "rejected") => {
    setApprovalActions(prev => ({ ...prev, [sampleId]: action }));
    if (action === "approved") {
      approveLab(sampleId);
      toast.success(`อนุมัติผลการทดสอบ ${sampleId} — แสดง Pre-result และส่งไปยัง QC`);
    } else {
      toast.error(`ไม่อนุมัติผลการทดสอบ ${sampleId}`);
    }
  };

  const handleGenerateCOA = (sample: SampleItem) => {
    setCoaSample(sample);
  };

  const columns: DataTableColumn<SampleItem>[] = [
    { key: "id", header: "เลขตัวอย่าง", className: "font-semibold text-primary", cell: (s) => s.id },
    { key: "name", header: "ชื่อยา", cell: (s) => s.name },
    { key: "analyst", header: "ผู้วิเคราะห์", className: "hidden lg:table-cell", cell: (s) => s.receiver || "-" },
    { key: "instrument", header: "เครื่องมือ", className: "hidden lg:table-cell", cell: (s) => s.instrument || "-" },
    {
      key: "status",
      header: "สถานะ",
      className: "hidden md:table-cell",
      cell: (s) => {
        const status = getAnalysisStatus(s);
        if (status === "approved")
          return (
            <Badge className="bg-lis-stat-green text-lis-stat-green-icon gap-1">
              <CheckCircle className="w-3 h-3" />Pre-result → QC
            </Badge>
          );
        if (status === "analyzing")
          return (
            <Badge className="bg-lis-stat-amber text-lis-stat-amber-icon gap-1">
              <FlaskConical className="w-3 h-3" />กำลังวิเคราะห์
            </Badge>
          );
        if (status === "calculating")
          return (
            <Badge className="bg-lis-stat-blue text-lis-stat-blue-icon gap-1">
              <Calculator className="w-3 h-3" />กำลังคำนวณผล
            </Badge>
          );
        return (
          <Badge className="bg-lis-stat-green text-lis-stat-green-icon gap-1">
            <CheckCircle className="w-3 h-3" />พร้อมอนุมัติ
          </Badge>
        );
      },
    },
    {
      key: "approval",
      header: "การอนุมัติ",
      cell: (s) => {
        const status = getAnalysisStatus(s);
        const isReady = status === "done";
        const isApproved = status === "approved";
        return isApproved ? (
          <span className="text-xs text-lis-stat-green-icon font-medium flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" /> อนุมัติแล้ว
          </span>
        ) : (
          <Select
            disabled={!isReady}
            onValueChange={(val) => handleDropdownApprove(s.id, val as "approved" | "rejected")}
          >
            <SelectTrigger className={`h-8 w-36 text-xs ${isReady ? "border-lis-stat-green-icon text-lis-stat-green-icon" : "bg-muted text-muted-foreground cursor-not-allowed"}`}>
              <SelectValue placeholder={isReady ? "เลือกการอนุมัติ" : "รอผลเสร็จ"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="approved">✅ อนุมัติผล</SelectItem>
              <SelectItem value="rejected">❌ ไม่อนุมัติ</SelectItem>
            </SelectContent>
          </Select>
        );
      },
    },
    {
      key: "coa",
      header: "ไฟล์ COA",
      className: "hidden md:table-cell",
      cell: (s) =>
        getAnalysisStatus(s) === "approved" ? (
          <Button size="sm" variant="outline" onClick={() => handleGenerateCOA(s)} className="gap-1 text-xs">
            <FileText className="w-3.5 h-3.5" />สร้าง COA
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        ),
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title={
            <span className="inline-flex items-center gap-2">
              <ClipboardList className="w-6 h-6" />
              บันทึกผลการทดสอบ
            </span>
          }
          description={`รายการทดสอบประจำวันนี้ — หัวหน้าแล็บอนุมัติผลก่อนแสดง Pre-result และส่งไปยัง QC · ${allSamples.length} รายการ`}
        />

        <DataTable
          columns={columns}
          data={allSamples}
          rowKey={(s) => s.id}
          emptyTitle="ไม่มีรายการทดสอบวันนี้"
          tableClassName="min-w-[600px]"
        />
      </div>
      <COADialog
        open={!!coaSample}
        onOpenChange={(o) => !o && setCoaSample(null)}
        sample={coaSample}
        physical={coaSample ? physicalResults[coaSample.id] : undefined}
      />
    </AppLayout>
  );
};

export default RecordResults;
