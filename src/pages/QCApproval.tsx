import { useState } from "react";
import AppSidebar from "@/components/lis/AppSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ShieldCheck, CheckCircle, XCircle, FileText, Send } from "lucide-react";
import { toast } from "sonner";
import { useSamples } from "@/context/SampleContext";

const QCApproval = () => {
  const { doneSamples, approvals, approveQC } = useSamples();
  const [qcNotes, setQcNotes] = useState<Record<string, string>>({});
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [pdfSampleId, setPdfSampleId] = useState("");

  const handleQcSelect = (sampleId: string, status: "approved" | "rejected") => {
    const note = qcNotes[sampleId] || "";
    approveQC(sampleId, status, note);
    toast.success(`QC ${status === "approved" ? "อนุมัติ" : "ไม่อนุมัติ"} ${sampleId}`);
  };

  const handleGeneratePdf = (sampleId: string) => {
    setPdfSampleId(sampleId);
    setPdfDialogOpen(true);
  };

  const handleConfirmSend = (sampleId: string) => {
    toast.success(`ยืนยันส่งผลทดสอบ ${sampleId} แล้ว`);
  };

  const handleDownloadPdf = () => {
    toast.success(`สร้างไฟล์ PDF ผลทดลอง ${pdfSampleId} สำเร็จ`);
    setPdfDialogOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="w-6 h-6" />
            QC Approval
          </h1>
          <p className="text-sm text-muted-foreground">ตรวจสอบและอนุมัติผลการทดสอบจาก QC</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">รายการรออนุมัติ QC</CardTitle>
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
                    <TableHead>% AI</TableHead>
                    <TableHead>สถานะ QC</TableHead>
                    <TableHead>หมายเหตุ</TableHead>
                    <TableHead>ไฟล์ผลทดลอง</TableHead>
                    <TableHead>ยืนยัน</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {doneSamples.map(sample => {
                    const approval = approvals[sample.id];
                    const qcStatus = approval?.qcStatus || "pending";

                    return (
                      <TableRow key={sample.id}>
                        <TableCell className="font-semibold text-primary">{sample.id}</TableCell>
                        <TableCell>{sample.name}</TableCell>
                        <TableCell>{sample.receiver || "-"}</TableCell>
                        <TableCell>{sample.instrument || "-"}</TableCell>
                        <TableCell>
                          {sample.preResult !== undefined ? (
                            <span className="font-semibold">{sample.preResult}%</span>
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          {qcStatus === "approved" ? (
                            <Badge className="bg-lis-stat-green text-lis-stat-green-icon gap-1">
                              <CheckCircle className="w-3 h-3" /> ผ่าน
                            </Badge>
                          ) : qcStatus === "rejected" ? (
                            <Badge className="bg-destructive/10 text-destructive gap-1">
                              <XCircle className="w-3 h-3" /> ไม่ผ่าน
                            </Badge>
                          ) : (
                            <Select onValueChange={(val) => handleQcSelect(sample.id, val as "approved" | "rejected")}>
                              <SelectTrigger className="h-8 w-32 text-xs">
                                <SelectValue placeholder="เลือกผล" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="approved">✅ ผ่าน</SelectItem>
                                <SelectItem value="rejected">❌ ไม่ผ่าน</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          {qcStatus === "pending" ? (
                            <Input
                              placeholder="พิมพ์หมายเหตุ..."
                              className="h-8 text-xs"
                              value={qcNotes[sample.id] || ""}
                              onChange={e => setQcNotes(prev => ({ ...prev, [sample.id]: e.target.value }))}
                            />
                          ) : (
                            <span className="text-xs">{approval?.qcNote || "-"}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {qcStatus !== "pending" ? (
                            <Button size="sm" variant="outline" className="gap-1" onClick={() => handleGeneratePdf(sample.id)}>
                              <FileText className="w-3.5 h-3.5" /> สร้าง PDF
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">รอ QC</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {qcStatus === "approved" ? (
                            <Button size="sm" className="gap-1 bg-primary" onClick={() => handleConfirmSend(sample.id)}>
                              <Send className="w-3.5 h-3.5" /> ยืนยัน
                            </Button>
                          ) : qcStatus === "rejected" ? (
                            <span className="text-xs text-destructive">ไม่ผ่าน QC</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">รอ QC</span>
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

        {/* PDF Generation Dialog */}
        <Dialog open={pdfDialogOpen} onOpenChange={setPdfDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                สร้างไฟล์ผลทดลอง
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">เลขตัวอย่าง: <strong>{pdfSampleId}</strong></p>
              {(() => {
                const sample = doneSamples.find(s => s.id === pdfSampleId);
                const approval = approvals[pdfSampleId];
                return sample ? (
                  <div className="space-y-2 p-3 rounded-lg bg-accent/50 text-sm">
                    <p>ชื่อยา: <strong>{sample.name}</strong></p>
                    <p>ผู้วิเคราะห์: <strong>{sample.receiver}</strong></p>
                    <p>เครื่องมือ: <strong>{sample.instrument}</strong></p>
                    <p>% AI: <strong>{sample.preResult}%</strong></p>
                    <p>สถานะ QC: <strong>{approval?.qcStatus === "approved" ? "ผ่าน" : "ไม่ผ่าน"}</strong></p>
                    {approval?.qcNote && <p>หมายเหตุ: <strong>{approval.qcNote}</strong></p>}
                  </div>
                ) : null;
              })()}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPdfDialogOpen(false)}>ยกเลิก</Button>
              <Button onClick={handleDownloadPdf} className="gap-1">
                <FileText className="w-4 h-4" /> ดาวน์โหลด PDF
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default QCApproval;
