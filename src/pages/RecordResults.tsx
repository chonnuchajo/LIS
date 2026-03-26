import { useState, useEffect } from "react";
import AppSidebar from "@/components/lis/AppSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardList, CheckCircle, Clock, FlaskConical, Calculator } from "lucide-react";
import { toast } from "sonner";
import { useSamples } from "@/context/SampleContext";

const RecordResults = () => {
  const { testingSamples, approvals, approveLab } = useSamples();

  const todaySamples = [...testingSamples];

  // Simulate analysis status: items with aiPercent >= 100 are "calculating", others are "analyzing"
  // For demo: aiPercent >= 100 = done (ready to approve), 80-99 = calculating, <80 = analyzing
  const getAnalysisStatus = (aiPercent: number | undefined) => {
    const pct = aiPercent ?? 0;
    if (pct >= 100) return "done";
    if (pct >= 80) return "calculating";
    return "analyzing";
  };

  const handleApprove = (sampleId: string) => {
    approveLab(sampleId);
    toast.success(`อนุมัติผลการทดสอบ ${sampleId} — แสดง Pre-result และส่งไปยัง QC`);
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
              <Badge className="bg-primary/10 text-primary">{todaySamples.length} รายการ</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>เลขตัวอย่าง</TableHead>
                  <TableHead>ชื่อยา</TableHead>
                  <TableHead>ผู้วิเคราะห์</TableHead>
                  <TableHead>เครื่องมือ</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>การอนุมัติ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todaySamples.map(sample => {
                  const approval = approvals[sample.id];
                  const isLabApproved = approval?.labApproved;
                  const status = getAnalysisStatus(sample.aiPercent);
                  const isReady = status === "done";

                  return (
                    <TableRow key={sample.id}>
                      <TableCell className="font-semibold text-primary">{sample.id}</TableCell>
                      <TableCell>{sample.name}</TableCell>
                      <TableCell>{sample.receiver || "-"}</TableCell>
                      <TableCell>{sample.instrument || "-"}</TableCell>
                      <TableCell>
                        {isLabApproved ? (
                          <Badge className="bg-lis-stat-green text-lis-stat-green-icon gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Pre-result → QC
                          </Badge>
                        ) : status === "analyzing" ? (
                          <Badge className="bg-lis-stat-amber text-lis-stat-amber-icon gap-1">
                            <FlaskConical className="w-3 h-3" />
                            กำลังวิเคราะห์
                          </Badge>
                        ) : status === "calculating" ? (
                          <Badge className="bg-lis-stat-blue text-lis-stat-blue-icon gap-1">
                            <Calculator className="w-3 h-3" />
                            กำลังคำนวณผล
                          </Badge>
                        ) : (
                          <Badge className="bg-lis-stat-green text-lis-stat-green-icon gap-1">
                            <CheckCircle className="w-3 h-3" />
                            พร้อมอนุมัติ
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {isLabApproved ? (
                          <span className="text-xs text-lis-stat-green-icon font-medium flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" /> อนุมัติแล้ว
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            disabled={!isReady}
                            onClick={() => handleApprove(sample.id)}
                            className={`gap-1 ${isReady
                              ? "bg-lis-stat-green-icon hover:bg-lis-stat-green-icon/90 text-white"
                              : "bg-muted text-muted-foreground cursor-not-allowed"
                            }`}
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            อนุมัติผล
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default RecordResults;
