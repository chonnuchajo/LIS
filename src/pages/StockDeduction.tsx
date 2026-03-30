import { useState, useRef, useEffect } from "react";
import { ClipboardList, QrCode, Barcode } from "lucide-react";
import AppSidebar from "@/components/lis/AppSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const mockDeductions = [
  { id: "DED-001", sample: "Paracetamol 500 mg", standard: "Paracetamol RS", lotNo: "STD-2024-001", usedAmount: "25 mg", date: "27/03/2567", operator: "สมชาย" },
  { id: "DED-002", sample: "Amoxicillin 250 mg", standard: "Amoxicillin RS", lotNo: "STD-2024-002", usedAmount: "30 mg", date: "27/03/2567", operator: "สมหญิง" },
  { id: "DED-003", sample: "Ibuprofen 400 mg", standard: "Ibuprofen RS", lotNo: "STD-2024-003", usedAmount: "20 mg", date: "26/03/2567", operator: "สมชาย" },
];

const StockDeduction = () => {
  const [deductions] = useState(mockDeductions);
  const [scanMode, setScanMode] = useState<"qr" | "barcode" | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      toast.error("ไม่สามารถเปิดกล้องได้");
      setScanMode(null);
    }
  };

  useEffect(() => {
    if (scanMode) {
      startCamera();
    }
    return () => stopCamera();
  }, [scanMode]);

  const handleCloseScan = () => {
    stopCamera();
    setScanMode(null);
  };

  const handleSimulateScan = () => {
    toast.success(`สแกน${scanMode === "qr" ? "QR Code" : "Barcode"} สำเร็จ — ตัดสต็อก Standard เรียบร้อย`);
    handleCloseScan();
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">การบันทึก Standard</h1>
            <p className="text-sm text-muted-foreground">บันทึกรายการ Standard ที่ใช้ในการวิเคราะห์</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setScanMode("qr")} variant="outline" className="gap-2">
              <QrCode className="w-4 h-4" />
              สแกน QR Code
            </Button>
            <Button onClick={() => setScanMode("barcode")} variant="outline" className="gap-2">
              <Barcode className="w-4 h-4" />
              สแกน Barcode
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="w-5 h-5" />
              รายการบันทึก Standard
              <Badge className="bg-primary/10 text-primary">{deductions.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {deductions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>ยังไม่มีรายการบันทึก</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>รหัส</TableHead>
                    <TableHead>ตัวอย่าง</TableHead>
                    <TableHead>Standard ที่ใช้</TableHead>
                    <TableHead>Lot No.</TableHead>
                    <TableHead>ปริมาณที่ใช้</TableHead>
                    <TableHead>วันที่</TableHead>
                    <TableHead>ผู้ดำเนินการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deductions.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="font-semibold text-primary">{item.id}</TableCell>
                      <TableCell>{item.sample}</TableCell>
                      <TableCell>{item.standard}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.lotNo}</Badge>
                      </TableCell>
                      <TableCell>{item.usedAmount}</TableCell>
                      <TableCell className="text-sm">{item.date}</TableCell>
                      <TableCell>{item.operator}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Scan Dialog */}
        <Dialog open={!!scanMode} onOpenChange={(open) => { if (!open) handleCloseScan(); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {scanMode === "qr" ? <QrCode className="w-5 h-5" /> : <Barcode className="w-5 h-5" />}
                {scanMode === "qr" ? "สแกน QR Code" : "สแกน Barcode"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-48 border-2 border-primary rounded-lg" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                วาง{scanMode === "qr" ? "QR Code" : "Barcode"} ไว้ในกรอบเพื่อสแกน
              </p>
              <Button onClick={handleSimulateScan} className="w-full">
                จำลองการสแกน (Demo)
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default StockDeduction;
