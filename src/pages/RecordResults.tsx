import { useState } from "react";
import AppSidebar from "@/components/lis/AppSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, CheckCircle, FlaskConical, Calculator, FileText } from "lucide-react";
import { toast } from "sonner";
import { useSamples } from "@/context/SampleContext";
import COADialog from "@/components/lis/COADialog";
import type { SampleItem } from "@/components/lis/SampleColumn";

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

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="w-6 h-6" />
            บันทึกผลการทดสอบ
          </h1>
          <p className="text-sm text-muted-foreground">รายการทดสอบประจำวันนี้ — หัวหน้าแล็บอนุมัติผลก่อนแสดง Pre-result และส่งไปยัง QC</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              รายการทดสอบวันนี้
              <Badge className="bg-primary/10 text-primary">{allSamples.length} รายการ</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>เลขตัวอย่าง</TableHead>
                    <TableHead>ชื่อยา</TableHead>
                    <TableHead>ผู้วิเคราะห์</TableHead>
                    <TableHead>เครื่องมือ</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead>การอนุมัติ</TableHead>
                    <TableHead>ไฟล์ COA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allSamples.map(sample => {
                    const status = getAnalysisStatus(sample);
                    const isReady = status === "done";
                    const isApproved = status === "approved";

                    return (
                      <TableRow key={sample.id}>
                        <TableCell className="font-semibold text-primary">{sample.id}</TableCell>
                        <TableCell>{sample.name}</TableCell>
                        <TableCell>{sample.receiver || "-"}</TableCell>
                        <TableCell>{sample.instrument || "-"}</TableCell>
                        <TableCell>
                          {isApproved ? (
                            <Badge className="bg-lis-stat-green text-lis-stat-green-icon gap-1">
                              <CheckCircle className="w-3 h-3" />Pre-result → QC
                            </Badge>
                          ) : status === "analyzing" ? (
                            <Badge className="bg-lis-stat-amber text-lis-stat-amber-icon gap-1">
                              <FlaskConical className="w-3 h-3" />กำลังวิเคราะห์
                            </Badge>
                          ) : status === "calculating" ? (
                            <Badge className="bg-lis-stat-blue text-lis-stat-blue-icon gap-1">
                              <Calculator className="w-3 h-3" />กำลังคำนวณผล
                            </Badge>
                          ) : (
                            <Badge className="bg-lis-stat-green text-lis-stat-green-icon gap-1">
                              <CheckCircle className="w-3 h-3" />พร้อมอนุมัติ
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {isApproved ? (
                            <span className="text-xs text-lis-stat-green-icon font-medium flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5" /> อนุมัติแล้ว
                            </span>
                          ) : (
                            <Select
                              disabled={!isReady}
                              onValueChange={(val) => handleDropdownApprove(sample.id, val as "approved" | "rejected")}
                            >
                              <SelectTrigger className={`h-8 w-36 text-xs ${isReady ? "border-lis-stat-green-icon text-lis-stat-green-icon" : "bg-muted text-muted-foreground cursor-not-allowed"}`}>
                                <SelectValue placeholder={isReady ? "เลือกการอนุมัติ" : "รอผลเสร็จ"} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="approved">✅ อนุมัติผล</SelectItem>
                                <SelectItem value="rejected">❌ ไม่อนุมัติ</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell>
                          {isApproved ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleGenerateCOA(sample)}
                              className="gap-1 text-xs"
                            >
                              <FileText className="w-3.5 h-3.5" />สร้าง COA
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
      <COADialog
        open={!!coaSample}
        onOpenChange={(o) => !o && setCoaSample(null)}
        sample={coaSample}
        physical={coaSample ? physicalResults[coaSample.id] : undefined}
      />
    </div>
  );
};

export default RecordResults;
