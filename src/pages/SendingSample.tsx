import { useState, useMemo } from "react";
import { Send, Plus, Trash2, QrCode, Download, Printer, ScanLine, CheckCircle2, Clock, FlaskConical, Droplets, Palette, User } from "lucide-react";
import AppLayout from "@/components/lis/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useSamples } from "@/context/SampleContext";
import type { SentItem } from "@/context/SampleContext";
import { useAuth } from "@/context/AuthContext";
import QRCode from "qrcode";

// 10cm x 5cm at 96 DPI ≈ 378 x 189px, use 2x for sharpness
const LABEL_W = 756;
const LABEL_H = 378;

const generateLabelImage = async (
  id: string,
  name: string,
  sender: string,
  batchNo: string,
  mfgDate: string,
  sendDate: string,
  note: string,
): Promise<string> => {
  const canvas = document.createElement("canvas");
  canvas.width = LABEL_W;
  canvas.height = LABEL_H;
  const ctx = canvas.getContext("2d")!;

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, LABEL_W, LABEL_H);

  // Border
  ctx.strokeStyle = "#d1d5db";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, LABEL_W - 2, LABEL_H - 2);

  // --- Left side: text info ---
  const leftPad = 24;
  let y = 36;
  const lineH = 32;

  // Sample ID header
  ctx.fillStyle = "#1a1a2e";
  ctx.font = "700 22px Kanit, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(id, leftPad, y);
  y += lineH + 4;

  // Helper for label-value pairs
  const drawField = (label: string, value: string) => {
    ctx.fillStyle = "#6b7280";
    ctx.font = "14px Kanit, sans-serif";
    ctx.fillText(label, leftPad, y);
    ctx.fillStyle = "#111827";
    ctx.font = "700 16px Kanit, sans-serif";
    ctx.fillText(value, leftPad + 130, y);
    y += lineH;
  };

  drawField("ชื่อยา:", name);
  drawField("เลขแบช:", batchNo);
  drawField("วันที่ผลิต:", mfgDate);
  drawField("วันที่ส่งตัวอย่าง:", sendDate);
  drawField("ผู้ส่งตัวอย่าง:", sender);

  if (note) {
    drawField("หมายเหตุ:", note);
  }

  // --- Right side: QR Code ---
  const qrSize = 200;
  const qrX = LABEL_W - qrSize - 30;
  const qrY = (LABEL_H - qrSize - 30) / 2;

  const qrDataUrl = await QRCode.toDataURL(
    JSON.stringify({ id, name, sender, batchNo, mfgDate }),
    { width: qrSize, margin: 1, color: { dark: "#1a1a2e", light: "#ffffff" } },
  );
  const qrImg = new Image();
  await new Promise<void>((resolve) => {
    qrImg.onload = () => resolve();
    qrImg.src = qrDataUrl;
  });
  ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

  // QR label text
  ctx.fillStyle = "#6b7280";
  ctx.font = "12px Kanit, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Scan QR Code", qrX + qrSize / 2, qrY + qrSize + 18);

  return canvas.toDataURL("image/png");
};

const SendingSample = () => {
  const { pendingItems, sentItems, physicalResults, addPendingItem, removePendingItem, markAsSending, confirmSentByScan } = useSamples();
  const { user } = useAuth();
  const [sampleName, setSampleName] = useState("");
  const [senderName, setSenderName] = useState("");
  const [batchNo, setBatchNo] = useState("");
  const [mfgDate, setMfgDate] = useState("");
  const [note, setNote] = useState("");
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
      batchNo: batchNo.trim(),
      mfgDate: mfgDate.trim(),
      note: note.trim(),
      userEmail: user?.email,
    });
    setSampleName("");
    setBatchNo("");
    setMfgDate("");
    setNote("");
    toast.success(`เพิ่มตัวอย่าง "${sampleName.trim()}" แล้ว`);
  };

  const handleSendAll = async () => {
    if (pendingItems.length === 0) {
      toast.warning("ไม่มีตัวอย่างในรายการ");
      return;
    }
    const newSentItems: SentItem[] = [];
    for (const item of pendingItems) {
      const qrBarcodeDataUrl = await generateLabelImage(
        item.id, item.name, item.sender, item.batchNo, item.mfgDate, item.date, item.note,
      );
      newSentItems.push({ ...item, qrBarcodeDataUrl, status: "sending" });
    }
    markAsSending(newSentItems);
    toast.success(`เตรียมส่งตัวอย่างทั้งหมด ${newSentItems.length} รายการ`);
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
    printWindow.document.write(`<html><head><title>พิมพ์ Label - ${id}</title><style>body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh}img{width:10cm;height:5cm}@media print{body{margin:0}img{width:10cm;height:5cm}}</style></head><body><img src="${dataUrl}" alt="${id}" onload="window.print();window.close();" /></body></html>`);
    printWindow.document.close();
  };

  const printAllImages = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const html = sentItems.map(item =>
      `<div style="page-break-after:always;display:flex;justify-content:center;align-items:center;min-height:100vh"><img src="${item.qrBarcodeDataUrl}" alt="${item.id}" style="width:10cm;height:5cm" /></div>`
    ).join("");
    printWindow.document.write(`<html><head><title>พิมพ์ทั้งหมด</title><style>body{margin:0}@media print{body{margin:0}}</style></head><body>${html}</body><script>window.onload=function(){window.print();window.close()}</script></html>`);
    printWindow.document.close();
  };

  const sendingCount = sentItems.filter(i => i.status === "sending").length;
  const sentCount = sentItems.filter(i => i.status === "sent").length;

  // ตัวอย่างที่ user ปัจจุบันส่ง (กรองตาม email)
  const myItems = useMemo(() => {
    if (!user) return [];
    return sentItems.filter(i => i.userEmail === user.email);
  }, [sentItems, user]);

  const myAnalyzedItems = useMemo(() =>
    myItems.map(i => ({ item: i, result: physicalResults[i.id] }))
      .filter(x => x.result),
    [myItems, physicalResults]
  );

  return (
    <AppLayout>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">การส่งตัวอย่าง</h1>
            <p className="text-sm text-muted-foreground">
              เพิ่มรายการตัวอย่างเพื่อส่งเข้าห้องปฏิบัติการ
              {user && <span className="ml-2 text-primary">· {user.email}</span>}
            </p>
          </div>
          {sendingCount > 0 && (
            <Button onClick={() => setScanDialogOpen(true)} className="gap-2">
              <ScanLine className="w-4 h-4" />
              สแกนยืนยันส่ง ({sendingCount})
            </Button>
          )}
        </div>

        {/* My analysis summary - only mine */}
        <Card className="mb-6 border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-primary" />
              ผลวิเคราะห์ตัวอย่างของฉัน
              <Badge className="bg-primary/10 text-primary">{myAnalyzedItems.length}</Badge>
              {!user && <Badge variant="outline" className="text-xs ml-2">ยังไม่ได้เข้าสู่ระบบ</Badge>}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              <User className="w-3 h-3 inline mr-1" />
              แสดงเฉพาะตัวอย่างที่บัญชีของคุณส่ง — ผู้ใช้อื่นจะไม่เห็นข้อมูลนี้
            </p>
          </CardHeader>
          <CardContent>
            {!user ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                กรุณาเข้าสู่ระบบเพื่อดูผลวิเคราะห์ของคุณ
              </p>
            ) : myItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                คุณยังไม่ได้ส่งตัวอย่างเข้าระบบ
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>รหัส</TableHead>
                    <TableHead>ชื่อยา</TableHead>
                    <TableHead>เลขแบช</TableHead>
                    <TableHead className="gap-1">
                      <Droplets className="w-3.5 h-3.5 inline text-blue-500" /> Density (g/mL)
                    </TableHead>
                    <TableHead>กายภาพ</TableHead>
                    <TableHead>การละลาย</TableHead>
                    <TableHead className="gap-1">
                      <Palette className="w-3.5 h-3.5 inline text-orange-500" /> สี
                    </TableHead>
                    <TableHead>สถานะ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myItems.map(item => {
                    const r = physicalResults[item.id];
                    const renderStatus = (val?: "normal" | "abnormal") => {
                      if (!val) return <span className="text-muted-foreground text-xs">—</span>;
                      return val === "normal" ? (
                        <Badge className="bg-green-100 text-green-700 border-green-300 text-xs">ปกติ</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-700 border-red-300 text-xs">ผิดปกติ</Badge>
                      );
                    };
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-semibold text-primary">{item.id}</TableCell>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>{item.batchNo || "-"}</TableCell>
                        <TableCell className="font-mono">
                          {r?.density ? `${r.density}` : <span className="text-muted-foreground text-xs">รอตรวจ</span>}
                        </TableCell>
                        <TableCell>{renderStatus(r?.physicalStatus)}</TableCell>
                        <TableCell>
                          {r?.dissolutionValue && <div className="text-xs font-mono">{r.dissolutionValue}</div>}
                          {renderStatus(r?.dissolutionStatus)}
                        </TableCell>
                        <TableCell>
                          {r?.colorMatch === "match" ? (
                            <Badge className="bg-green-100 text-green-700 border-green-300 text-xs">ตรงกัน</Badge>
                          ) : r?.colorMatch === "mismatch" ? (
                            <Badge className="bg-red-100 text-red-700 border-red-300 text-xs">ไม่ตรง</Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {r?.status === "completed" ? (
                            <Badge className="bg-green-100 text-green-700 border-green-300 text-xs gap-1">
                              <CheckCircle2 className="w-3 h-3" /> ตรวจเสร็จ
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs gap-1 text-amber-600 border-amber-300">
                              <Clock className="w-3 h-3" /> รอผล
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Add sample form */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">เพิ่มตัวอย่าง</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">ชื่อยา</label>
                <Input placeholder="เช่น Paracetamol 500 mg" value={sampleName} onChange={e => setSampleName(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">เลขแบช</label>
                <Input placeholder="เช่น B2026-001" value={batchNo} onChange={e => setBatchNo(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">วันที่ผลิต</label>
                <Input type="date" value={mfgDate} onChange={e => setMfgDate(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">ผู้ส่งตัวอย่าง</label>
                <Input placeholder="เช่น บริษัท ABC จำกัด" value={senderName} onChange={e => setSenderName(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">หมายเหตุ</label>
                <Input placeholder="หมายเหตุ (ถ้ามี)" value={note} onChange={e => setNote(e.target.value)} />
              </div>
              <div className="flex items-end">
                <Button onClick={handleAdd} className="gap-2 w-full">
                  <Plus className="w-4 h-4" /> เพิ่มรายการ
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending list */}
        <Card className="mb-6">
          <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                    <TableHead>รหัส</TableHead>
                    <TableHead>ชื่อยา</TableHead>
                    <TableHead>เลขแบช</TableHead>
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
                      <TableCell>{item.batchNo || "-"}</TableCell>
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

        {/* Sent items with label */}
        {sentItems.length > 0 && (
          <Card>
            <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-base flex items-center gap-2">
                <QrCode className="w-5 h-5" />
                รายการตัวอย่าง — Label (10×5 cm)
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                    <p className="text-xs text-muted-foreground">ผู้ส่ง: {item.sender} | แบช: {item.batchNo || "-"}</p>
                    <img
                      src={item.qrBarcodeDataUrl}
                      alt={`Label - ${item.id}`}
                      className="w-full rounded border border-border cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ aspectRatio: "2/1" }}
                      onClick={() => setPreviewImage(item.qrBarcodeDataUrl)}
                    />
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => downloadImage(item.qrBarcodeDataUrl, `${item.id}-label.png`)}>
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
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>Label Preview (10×5 cm)</DialogTitle></DialogHeader>
            {previewImage && <img src={previewImage} alt="Preview" className="w-full rounded" style={{ aspectRatio: "2/1" }} />}
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
              <p className="text-sm text-muted-foreground">สแกน QR Code ที่จุดเช็คอินเพื่อยืนยันว่าส่งตัวอย่างถึงแล้ว</p>
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
    </AppLayout>
  );
};

export default SendingSample;
