import { useState } from "react";
import AppSidebar from "@/components/lis/AppSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ShieldCheck, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useSamples } from "@/context/SampleContext";

const qcRecommendations = [
  "ส่งวิเคราะห์ซ้ำ",
  "ปรับปรุงสูตร",
  "ตรวจสอบเครื่องมือ",
  "เปลี่ยน Standard Lot",
];

const QCApproval = () => {
  const { doneSamples, approvals, approveQC } = useSamples();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [qcAction, setQcAction] = useState<"approved" | "rejected">("approved");
  const [qcNote, setQcNote] = useState("");

  const handleOpenDialog = (sampleId: string, action: "approved" | "rejected") => {
    setSelectedId(sampleId);
    setQcAction(action);
    setQcNote("");
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    approveQC(selectedId, qcAction, qcNote);
    toast.success(`QC ${qcAction === "approved" ? "อนุมัติ" : "ไม่อนุมัติ"} ${selectedId}`);
    setDialogOpen(false);
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>เลขตัวอย่าง</TableHead>
                  <TableHead>ชื่อยา</TableHead>
                  <TableHead>ผู้วิเคราะห์</TableHead>
                  <TableHead>เครื่องมือ</TableHead>
                  <TableHead>Pre-result %AI</TableHead>
                  <TableHead>สถานะ QC</TableHead>
                  <TableHead>หมายเหตุ</TableHead>
                  <TableHead>การดำเนินการ</TableHead>
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
                        {qcStatus === "approved" && (
                          <Badge className="bg-lis-stat-green text-lis-stat-green-icon gap-1">
                            <CheckCircle className="w-3 h-3" /> ผ่าน
                          </Badge>
                        )}
                        {qcStatus === "rejected" && (
                          <Badge className="bg-destructive/10 text-destructive gap-1">
                            <XCircle className="w-3 h-3" /> ไม่ผ่าน
                          </Badge>
                        )}
                        {qcStatus === "pending" && (
                          <Badge variant="outline" className="text-muted-foreground">รอตรวจสอบ</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs max-w-[150px]">{approval?.qcNote || "-"}</TableCell>
                      <TableCell>
                        {qcStatus === "pending" ? (
                          <div className="flex gap-1">
                            <Button size="sm" variant="default" className="gap-1" onClick={() => handleOpenDialog(sample.id, "approved")}>
                              <CheckCircle className="w-3.5 h-3.5" /> ผ่าน
                            </Button>
                            <Button size="sm" variant="destructive" className="gap-1" onClick={() => handleOpenDialog(sample.id, "rejected")}>
                              <XCircle className="w-3.5 h-3.5" /> ไม่ผ่าน
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">ดำเนินการแล้ว</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {qcAction === "approved" ? "ยืนยันอนุมัติ QC" : "ไม่อนุมัติ — กรุณาระบุเหตุผล"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">ตัวอย่าง: <strong>{selectedId}</strong></p>
              {qcAction === "rejected" && (
                <Select value={qcNote} onValueChange={setQcNote}>
                  <SelectTrigger><SelectValue placeholder="เลือกข้อแนะนำ" /></SelectTrigger>
                  <SelectContent>
                    {qcRecommendations.map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Textarea
                placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
                value={qcAction === "approved" ? qcNote : undefined}
                onChange={e => setQcNote(e.target.value)}
                rows={2}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>ยกเลิก</Button>
              <Button
                variant={qcAction === "approved" ? "default" : "destructive"}
                onClick={handleSubmit}
              >
                {qcAction === "approved" ? "ยืนยันอนุมัติ" : "ยืนยันไม่อนุมัติ"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default QCApproval;
