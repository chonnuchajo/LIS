import { useState, useRef, useEffect } from "react";
import { QrCode, Camera, X, Plus } from "lucide-react";
import AppSidebar from "@/components/lis/AppSidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useSamples } from "@/context/SampleContext";
import { getStandardForSample } from "@/data/stockData";
import type { SampleItem } from "@/components/lis/SampleColumn";

interface ReceivedSample {
  runNo: string;
  sampleId: string;
  name: string;
  receiver: string;
  receivedDate: string;
  receivedTime: string;
  instrument: string;
  standardLotNo: string;
  standardName: string;
}

const instruments = [
  { value: "GC-01", label: "GC-01" },
  { value: "GC-02", label: "GC-02" },
  { value: "GC-03", label: "GC-03" },
  { value: "HPLC-01", label: "HPLC-01" },
  { value: "HPLC-02", label: "HPLC-02" },
  { value: "HPLC-03", label: "HPLC-03" },
];

const SendSample = () => {
  const { sentSamples, sentItems, receiveSample } = useSamples();
  const [receivedSamples, setReceivedSamples] = useState<ReceivedSample[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setScanning(true);
      toast.info("กล้องเปิดแล้ว กรุณาสแกน QR Code");
      setTimeout(() => simulateScan(), 3000);
    } catch {
      toast.error("ไม่สามารถเปิดกล้องได้");
      simulateScan();
    }
  };

  const simulateScan = () => {
    if (sentSamples.length === 0) {
      toast.warning("ไม่มีตัวอย่างรอรับเข้าระบบแล้ว");
      stopCamera();
      setScannerOpen(false);
      return;
    }
    const sample = sentSamples[0];
    handleScannedData(sample);
    stopCamera();
    setScannerOpen(false);
  };

  const handleScannedData = (sample: SampleItem) => {
    const now = new Date();
    const standard = getStandardForSample(sample.name);
    const runNo = `RCV-${now.getFullYear()}-${String(receivedSamples.length + 1).padStart(3, "0")}`;

    const newSample: ReceivedSample = {
      runNo,
      sampleId: sample.id,
      name: sample.name,
      receiver: "แอดมิน",
      receivedDate: now.toLocaleDateString("th-TH"),
      receivedTime: now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
      instrument: "",
      standardLotNo: standard?.lotNo || "ไม่พบ Standard",
      standardName: standard?.name || "-",
    };

    setReceivedSamples(prev => [...prev, newSample]);
    receiveSample(sample); // Remove from sent list
    toast.success(`สแกนสำเร็จ: ${sample.name}`);
  };

  const updateInstrument = (index: number, value: string) => {
    setReceivedSamples(prev => prev.map((s, i) => i === index ? { ...s, instrument: value } : s));
  };

  useEffect(() => { return () => stopCamera(); }, []);

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">การรับตัวอย่าง</h1>
            <p className="text-sm text-muted-foreground">รับตัวอย่างเข้าระบบโดยการสแกน QR Code</p>
          </div>
          <Button className="gap-2" onClick={() => setScannerOpen(true)}>
            <QrCode className="w-4 h-4" />
            สแกน QR Code
          </Button>
        </div>

        {/* Sent samples waiting */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              ตัวอย่างที่ส่งแล้ว (รอรับเข้าระบบ)
              <Badge className="bg-primary/10 text-primary">{sentSamples.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sentSamples.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">รับตัวอย่างครบแล้ว</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {sentSamples.map(s => (
                  <Card key={s.id} className="p-3 min-w-[200px] shadow-sm">
                    <p className="text-sm font-semibold text-primary">{s.id}</p>
                    <p className="text-sm text-foreground">{s.name}</p>
                    <p className="text-xs text-muted-foreground">📅 {s.date} ⏰ {s.time}</p>
                    <p className="text-xs text-muted-foreground">👤 {s.sender}</p>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Received samples table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              รายการตัวอย่างที่รับแล้ว
              <Badge className="bg-primary/10 text-primary">{receivedSamples.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {receivedSamples.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <QrCode className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>ยังไม่มีรายการ กรุณาสแกน QR Code เพื่อรับตัวอย่าง</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>เลขที่รับ</TableHead>
                      <TableHead>ชื่อยาตัวอย่าง</TableHead>
                      <TableHead>ผู้รับตัวอย่าง</TableHead>
                      <TableHead>วันที่/เวลา</TableHead>
                      <TableHead>เครื่องมือ GC/HPLC</TableHead>
                      <TableHead>LOT NO. Standard (FIFO)</TableHead>
                      <TableHead>ชื่อ Standard</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receivedSamples.map((sample, idx) => (
                      <TableRow key={sample.runNo}>
                        <TableCell className="font-semibold text-primary">{sample.runNo}</TableCell>
                        <TableCell>{sample.name}</TableCell>
                        <TableCell>{sample.receiver}</TableCell>
                        <TableCell className="text-xs">{sample.receivedDate}<br />{sample.receivedTime}</TableCell>
                        <TableCell>
                          <Select value={sample.instrument} onValueChange={(v) => updateInstrument(idx, v)}>
                            <SelectTrigger className="w-[130px]">
                              <SelectValue placeholder="เลือกเครื่อง" />
                            </SelectTrigger>
                            <SelectContent>
                              {instruments.map(inst => (
                                <SelectItem key={inst.value} value={inst.value}>{inst.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{sample.standardLotNo}</Badge></TableCell>
                        <TableCell className="text-sm">{sample.standardName}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* QR Scanner Dialog */}
        <Dialog open={scannerOpen} onOpenChange={(open) => { if (!open) stopCamera(); setScannerOpen(open); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Camera className="w-5 h-5" /> สแกน QR Code ตัวอย่าง
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="relative aspect-square bg-accent rounded-xl overflow-hidden flex items-center justify-center">
                {scanning ? (
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center space-y-3">
                    <QrCode className="w-16 h-16 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">กดปุ่มด้านล่างเพื่อเปิดกล้อง</p>
                  </div>
                )}
                {scanning && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-48 h-48 border-2 border-primary rounded-lg animate-pulse" />
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                {!scanning ? (
                  <Button className="flex-1 gap-2" onClick={startCamera}>
                    <Camera className="w-4 h-4" /> เปิดกล้อง
                  </Button>
                ) : (
                  <Button variant="destructive" className="flex-1 gap-2" onClick={stopCamera}>
                    <X className="w-4 h-4" /> หยุดสแกน
                  </Button>
                )}
                <Button variant="outline" className="gap-2" onClick={simulateScan}>
                  <Plus className="w-4 h-4" /> จำลองสแกน
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default SendSample;
