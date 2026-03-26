import { useState, useEffect } from "react";
import AppSidebar from "@/components/lis/AppSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardList, CheckCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { useSamples } from "@/context/SampleContext";

const RecordResults = () => {
  const { testingSamples, doneSamples, approvals, approveLab } = useSamples();
  const [timers, setTimers] = useState<Record<string, number>>({});

  // All samples that are testing (analysis complete = aiPercent === 100 means ready for approval)
  const todaySamples = [...testingSamples];

  useEffect(() => {
    const interval = setInterval(() => {
      setTimers(prev => {
        const next = { ...prev };
        todaySamples.forEach(s => {
          const approval = approvals[s.id];
          if (approval?.labApproved && approval.labApprovedAt) {
            const elapsed = Math.floor((Date.now() - approval.labApprovedAt.getTime()) / 1000);
            const remaining = Math.max(0, 1800 - elapsed);
            next[s.id] = remaining;
          }
        });
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [todaySamples, approvals]);

  const handleApprove = (sampleId: string) => {
    approveLab(sampleId);
    toast.success(`อนุมัติผลการทดสอบ ${sampleId} แล้ว`);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
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
          <p className="text-sm text-muted-foreground">รายการทดสอบประจำวันนี้ — หัวหน้าแล็บอนุมัติผลก่อนแสดง Pre-result</p>
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
                  <TableHead>%AI Progress</TableHead>
                  <TableHead>สถานะการอนุมัติ</TableHead>
                  <TableHead>การดำเนินการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todaySamples.map(sample => {
                  const approval = approvals[sample.id];
                  const isLabApproved = approval?.labApproved;
                  const isReady = (sample.aiPercent ?? 0) >= 100;
                  const remaining = timers[sample.id];

                  return (
                    <TableRow key={sample.id}>
                      <TableCell className="font-semibold text-primary">{sample.id}</TableCell>
                      <TableCell>{sample.name}</TableCell>
                      <TableCell>{sample.receiver || "-"}</TableCell>
                      <TableCell>{sample.instrument || "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-accent rounded-full overflow-hidden max-w-[120px]">
                            <div
                              className="h-full rounded-full bg-lis-status-progress transition-all"
                              style={{ width: `${sample.aiPercent ?? 0}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium">{sample.aiPercent ?? 0}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {isLabApproved ? (
                          <Badge className="bg-lis-stat-green text-lis-stat-green-icon gap-1">
                            <CheckCircle className="w-3 h-3" />
                            อนุมัติแล้ว
                          </Badge>
                        ) : isReady ? (
                          <Badge className="bg-lis-stat-amber text-lis-stat-amber-icon gap-1">
                            <Clock className="w-3 h-3" />
                            รออนุมัติ (30 นาที)
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">กำลังวิเคราะห์</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {!isLabApproved && isReady ? (
                          <Button size="sm" onClick={() => handleApprove(sample.id)} className="gap-1">
                            <CheckCircle className="w-3.5 h-3.5" />
                            อนุมัติผล
                          </Button>
                        ) : isLabApproved && remaining !== undefined && remaining > 0 ? (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(remaining)}
                          </span>
                        ) : null}
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
