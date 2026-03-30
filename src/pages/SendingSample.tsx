import { useState } from "react";
import { Send, Plus, Trash2, QrCode, Download, Printer, ScanLine, CheckCircle2, Clock } from "lucide-react";
import AppSidebar from "@/components/lis/AppSidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useSamples } from "@/context/SampleContext";
import type { SentItem } from "@/context/SampleContext";
import QRCode from "qrcode";

const generateQRBarcodeImage = async (id: string, name: string, sender: string): Promise<string> => {
  const canvas = document.createElement("canvas");
  const width = 400;
  const height = 280;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#1a1a2e";
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(id, width / 2, 22);
  ctx.font = "12px sans-serif";
  ctx.fillStyle = "#555";
  ctx.fillText(name, width / 2, 40);

  const qrDataUrl = await QRCode.toDataURL(JSON.stringify({ id, name, sender }), {
    width: 140, margin: 1, color: { dark: "#1a1a2e", light: "#ffffff" },
  });
  const qrImg = new Image();
  await new Promise<void>((resolve) => { qrImg.onload = () => resolve(); qrImg.src = qrDataUrl; });
  ctx.drawImage(qrImg, (width - 140) / 2, 50, 140, 140);

  const barcodeY = 200;
  const barcodeHeight = 45;
  ctx.fillStyle = "#1a1a2e";
  const chars = id.replace(/-/g, "");
  const barWidth = Math.floor((width - 60) / (chars.length * 11));
  let x = 30;
  for (let i = 0; i < chars.length; i++) {
    const code = chars.charCodeAt(i);
    const pattern = [(code >> 6) & 1, 1, (code >> 5) & 1, 1, (code >> 4) & 1, (code >> 3) & 1, 1, (code >> 2) & 1, (code >> 1) & 1, code & 1, 0];
    for (const bit of pattern) {
      if (bit) ctx.fillRect(x, barcodeY, barWidth, barcodeHeight);
      x += barWidth;
    }
  }

  ctx.fillStyle = "#333";
  ctx.font = "11px monospace";
  ctx.textAlign = "center";
  ctx.fillText(id, width / 2, barcodeY + barcodeHeight + 16);

  return canvas.toDataURL("image/png");
};

const SendingSample = () => {
  const { pendingItems, sentItems, addPendingItem, removePendingItem, markAsSending, confirmSentByScan } = useSamples();
  const [sampleName, setSampleName] = useState("");
  const [senderName, setSenderName] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [scanDialogOpen, setScanDialogOpen] = useState(false);

  const handleAdd = () => {
    if (!sampleName.trim() || !senderName.trim()) {
      toast.error("กรุณากรอกชื่อตัวอย่างและชื่อผู้ส่ง");
      return;
    }
    const now = new Date();
    const id = `SMP-${now.getFullYear()}-${String(pendingItems.length + sentItems.length + 1).padStart(3, "0")}`;
    addPendingItem({
      id,
      name: sampleName.trim(),
      sender: senderName.trim(),
      date: now.toLocaleDateString("th-TH"),
      time: now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
    });
    setSampleName("");
    toast.success(`เพิ่มตัวอย่าง "${sampleName.trim()}" แล้ว`);
  };

  const handleSendAll = async () => {
    if (pendingItems.length === 0) {
      toast.warning("ไม่มีตัวอย่างในรายการ");
      return;
    }
    const newSentItems: SentItem[] = [];
    for (const item of pendingItems) {
      const qrBarcodeDataUrl = await generateQRBarcodeImage(item.id, item.name, item.sender);
      newSentItems.push({ ...item, qrBarcodeDataUrl, status: "sending" });
    }
    markAsSending(newSentItems);
    toast.success(`เตรียมส่งตัวอย่างทั้งหมด ${newSentItems.length} รายการ — กรุณาสแกน QR/Barcode ที่จุดเช็คอิน`);
  };

  const handleScanConfirm = (sampleId: string) => {
    confirmSentByScan(sampleId);
    toast.success(`สแกนยืนยันส่งตัวอย่าง ${sampleId} สำเร็จ`);
  };

  const simulateScanAll = () => {
    const sendingItems = sentItems.filter(i => i.status === "sending");
    if (sendingItems.length === 0) {
      toast.warning("ไม่มีตัวอย่างที่รอสแกน");
      return;
    }
    sendingItems.forEach(item => confirmSentByScan(item.id));
    toast.success(`สแกนยืนยันทั้งหมด ${sendingItems.length} รายการสำเร็จ`);
    setScanDialogOpen(false);
  };

  const downloadImage = (dataUrl: string, filename: string) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    a.click();
  };

  const printImage = (dataUrl: string, id: string) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`<html><head><title>พิมพ์ QR/Barcode - ${id}</title><style>body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh}img{max-width:100%}@media print{body{margin:0}}</style></head><body><img src="${dataUrl}" alt="${id}" onload="window.print();window.close();" /></body></html>`);
    printWindow.document.close();
  };

  const printAllImages = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const html = sentItems.map(item =>
      `<div style="page-break-after:always;display:flex;justify-content:center;align-items:center;min-height:100vh"><img src="${item.qrBarcodeDataUrl}" alt="${item.id}" style="max-width:100%" /></div>`
    ).join("");
    printWindow.document.write(`<html><head><title>พิมพ์ทั้งหมด</title><style>body{margin:0}@media print{body{margin:0}}</style></head><body>${html}</body><script>window.onload=function(){window.print();window.close()}</script></html>`);
    printWindow.document.close();
  };

  const sendingCount = sentItems.filter(i => i.status === "sending").length;
  const sentCount = sentItems.filter(i => i.status === "sent").length;

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">การส่งตัวอย่าง</h1>
            <p className="text-sm text-muted-foreground">เพิ่มรายการตัวอย่างเพื่อส่งเข้าห้องปฏิบัติการ</p>
          </div>
          {sendingCount > 0 && (
            <Button onClick={() => setScanDialogOpen(true)} className="gap-2">
              <ScanLine className="w-4 h-4" />
              สแกนยืนยันส่ง ({sendingCount})
            </Button>
          )}
        </div>

        {/* Add sample form */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">เพิ่มตัวอย่าง</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium text-foreground mb-1 block">ชื่อตัวอย่าง</label>
                <Input placeholder="เช่น Paracetamol 500 mg" value={sampleName} onChange={e => setSampleName(e.target.value)} />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium text-foreground mb-1 block">ชื่อผู้ส่ง</label>
                <Input placeholder="เช่น บริษัท ABC จำกัด" value={senderName} onChange={e => setSenderName(e.target.value)} />
              </div>
              <Button onClick={handleAdd} className="gap-2">
                <Plus className="w-4 h-4" /> เพิ่มรายการ
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Pending list */}
        <Card className="mb-6">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              รายการตัวอย่างที่จะส่ง
              <Badge className="bg-primary/10 text-primary">{pendingItems.length}</Badge>
            </CardTitle>
            {pendingItems.length > 0 && (
              <Button onClick={handleSendAll} className="gap-2">
                <Send className="w-4 h-4" /> ส่งตัวอย่างทั้งหมด
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {pendingItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Send className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">ยังไม่มีรายการ กรุณาเพิ่มตัวอย่างด้านบน</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>รหัสตัวอย่าง</TableHead>
                    <TableHead>ชื่อตัวอย่าง</TableHead>
                    <TableHead>ผู้ส่ง</TableHead>
                    <TableHead>วันที่/เวลา</TableHead>
                    <TableHead className="w-[80px]">ลบ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingItems.map((item, idx) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-semibold text-primary">{item.id}</TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.sender}</TableCell>
                      <TableCell className="text-xs">{item.date}<br />{item.time}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => removePendingItem(idx)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Sent items with QR/Barcode */}
        {sentItems.length > 0 && (
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <QrCode className="w-5 h-5" />
                รายการตัวอย่าง — QR Code & Barcode
                <Badge variant="outline" className="text-xs">กำลังส่ง {sendingCount}</Badge>
                <Badge className="bg-primary/10 text-primary text-xs">ส่งแล้ว {sentCount}</Badge>
              </CardTitle>
              {sentItems.length > 0 && (
                <Button onClick={printAllImages} variant="outline" className="gap-2">
                  <Printer className="w-4 h-4" /> พิมพ์ทั้งหมด
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {sentItems.map(item => (
                  <Card key={item.id} className="p-3 space-y-2 shadow-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-primary">{item.id}</p>
                      {item.status === "sending" ? (
                        <Badge variant="outline" className="text-xs gap-1 text-amber-600 border-amber-300">
                          <Clock className="w-3 h-3" /> กำลังส่ง
                        </Badge>
                      ) : (
                        <Badge className="text-xs gap-1 bg-green-100 text-green-700 border-green-300">
                          <CheckCircle2 className="w-3 h-3" /> ส่งแล้ว
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-foreground">{item.name}</p>
                    <p className="text-xs text-muted-foreground">ผู้ส่ง: {item.sender}</p>
                    <img
                      src={item.qrBarcodeDataUrl}
                      alt={`QR & Barcode - ${item.id}`}
                      className="w-full rounded border border-border cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setPreviewImage(item.qrBarcodeDataUrl)}
                    />
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => downloadImage(item.qrBarcodeDataUrl, `${item.id}-qr-barcode.png`)}>
                        <Download className="w-3 h-3" /> ดาวน์โหลด
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => printImage(item.qrBarcodeDataUrl, item.id)}>
                        <Printer className="w-3 h-3" /> พิมพ์
                      </Button>
                      {item.status === "sending" && (
                        <Button size="sm" className="gap-1" onClick={() => handleScanConfirm(item.id)}>
                          <ScanLine className="w-3 h-3" /> สแกน
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Preview dialog */}
        <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>QR Code & Barcode</DialogTitle></DialogHeader>
            {previewImage && <img src={previewImage} alt="Preview" className="w-full rounded" />}
          </DialogContent>
        </Dialog>

        {/* Scan confirm dialog */}
        <Dialog open={scanDialogOpen} onOpenChange={setScanDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ScanLine className="w-5 h-5" /> สแกนยืนยันการส่งตัวอย่าง
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">สแกน QR Code หรือ Barcode ที่จุดเช็คอินเพื่อยืนยันว่าส่งตัวอย่างถึงแล้ว</p>
              <div className="space-y-2">
                {sentItems.filter(i => i.status === "sending").map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div>
                      <p className="text-sm font-semibold text-primary">{item.id}</p>
                      <p className="text-xs text-muted-foreground">{item.name}</p>
                    </div>
                    <Button size="sm" className="gap-1" onClick={() => handleScanConfirm(item.id)}>
                      <ScanLine className="w-3 h-3" /> สแกนยืนยัน
                    </Button>
                  </div>
                ))}
              </div>
              <Button className="w-full gap-2" variant="outline" onClick={simulateScanAll}>
                <QrCode className="w-4 h-4" /> จำลองสแกนทั้งหมด
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default SendingSample;
