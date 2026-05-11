import { useState, useRef, useEffect } from "react";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import { QrCode, Camera, X, Clock, CheckCircle2 } from "lucide-react";
import AppSidebar from "@/components/lis/AppSidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useSamples } from "@/context/SampleContext";
import { api } from "@/lib/api";
import { getStandardForSample } from "@/data/stockData";
import type { SampleItem } from "@/components/lis/SampleColumn";
import type { Petition } from "@/types/petition.types";

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

const READER_ID = "receive-sample-qr-reader";

interface ScannedPayload {
  id?: unknown;
  petitionId?: unknown;
  petitionNo?: unknown;
  sampleId?: unknown;
  itemSeq?: unknown;
}

function parseScannedPayload(raw: string): { code: string; payload: ScannedPayload | null } {
  const text = raw.trim();
  if (!text) return { code: "", payload: null };

  try {
    const payload = JSON.parse(text) as ScannedPayload;
    const value = payload.id ?? payload.petitionId ?? payload.petitionNo ?? payload.sampleId;
    return { code: value ? String(value).trim() : text, payload };
  } catch {
    // QR may be plain text or a URL.
  }

  try {
    const url = new URL(text);
    const parts = url.pathname.split("/").filter(Boolean);
    return { code: decodeURIComponent(parts[parts.length - 1] || text).trim(), payload: null };
  } catch {
    return { code: text, payload: null };
  }
}

async function fetchPetitionByCode(code: string): Promise<Petition> {
  try {
    const res = await api.get<Petition>(`/petitions/scan/${encodeURIComponent(code)}`);
    return res.data.data;
  } catch {
    const res = await api.get<Petition>(`/petitions/${encodeURIComponent(code)}`);
    return res.data.data;
  }
}

const SendSample = () => {
  const { sentSamples, sentItems, receiveSample, refetch } = useSamples();
  const [receivedSamples, setReceivedSamples] = useState<ReceivedSample[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const stopCamera = () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (scanner) {
      try {
        const state = scanner.getState();
        if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
          scanner.stop().catch(() => {});
        }
      } catch {
        // Scanner may already be stopped.
      }
    }
    setScanning(false);
  };

  const startCamera = () => {
    setScanning(true);
    return;
    toast.info("กำลังเปิดกล้อง...");
    window.setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode(READER_ID);
        scannerRef.current = scanner;
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        const onScan = (decodedText: string) => {
          stopCamera();
          setScannerOpen(false);
          handleScannedText(decodedText);
        };

        try {
          await scanner.start({ facingMode: { ideal: "environment" } }, config, onScan, () => {});
        } catch {
          const cameras = await Html5Qrcode.getCameras();
          if (cameras.length === 0) throw new Error("No camera found");
          const backCamera = cameras.find((camera) =>
            /back|environment|rear|หลัง/i.test(camera.label),
          );
          await scanner.start((backCamera ?? cameras[0]).id, config, onScan, () => {});
        }

        toast.info("เปิดกล้องแล้ว กรุณาสแกน QR Code");
      } catch (error) {
        console.error("receive scanner open error:", error);
        scannerRef.current = null;
        setScanning(false);
        toast.error("ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการใช้กล้องหรือเลือกอุปกรณ์ที่มีกล้อง");
      }
    }, 0);
  };

  useEffect(() => {
    if (!scannerOpen || !scanning) return;
    let active = true;

    const timer = window.setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode(READER_ID);
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        const onScan = (decodedText: string) => {
          if (!active) return;
          stopCamera();
          setScannerOpen(false);
          handleScannedText(decodedText);
        };
        const startWith = (source: MediaTrackConstraints | string) =>
          scanner.start(source, config, onScan, () => {});

        try {
          await startWith({ facingMode: { exact: "environment" } });
        } catch {
          const cameras = await Html5Qrcode.getCameras();
          if (cameras.length === 0) throw new Error("No camera found");
          const backCamera = cameras.find((camera) =>
            /back|environment|rear|หลัง/i.test(camera.label),
          );
          const fallbackCamera = backCamera ?? (cameras.length > 1 ? cameras[cameras.length - 1] : cameras[0]);
          await startWith(fallbackCamera.id);
        }

        if (!active) {
          scanner.stop().catch(() => {});
          return;
        }
        scannerRef.current = scanner;
        toast.info("เปิดกล้องแล้ว กรุณาสแกน QR Code");
      } catch (error) {
        if (!active) return;
        console.error("receive scanner open error:", error);
        scannerRef.current = null;
        setScanning(false);
        toast.error("ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการใช้กล้องหรือเลือกอุปกรณ์ที่มีกล้อง");
      }
    }, 100);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannerOpen, scanning]);

  const handleScannedData = (sample: SampleItem, updateContext = true) => {
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
    if (updateContext) receiveSample(sample); // Remove from sent list
    toast.success(`สแกนสำเร็จ: ${sample.name}`);
  };

  const updateInstrument = (index: number, value: string) => {
    setReceivedSamples(prev => prev.map((s, i) => i === index ? { ...s, instrument: value } : s));
  };

  const receiveScannedSample = async (sample: SampleItem) => {
    try {
      await api.patch<SampleItem>(`/samples/${encodeURIComponent(sample.id)}`, {
        ...sample,
        status: "physical",
      });
    } catch {
      await api.createSample({ ...sample, status: "physical" });
    }
    await refetch();
  };

  const handleScannedText = async (raw: string) => {
    const { code, payload } = parseScannedPayload(raw);
    if (!code) {
      toast.error("ไม่พบข้อมูลใน QR Code");
      return;
    }

    try {
      const legacyId = payload?.sampleId ?? payload?.id;
      const localSample = [
        ...sentSamples,
        ...sentItems.map(item => ({
          id: item.id,
          name: item.name,
          status: "sent" as const,
          date: item.date,
          time: item.time,
          sender: item.sender,
        })),
      ].find(sample => sample.id === legacyId || sample.id === code);

      if (localSample) {
        handleScannedData(localSample, false);
        await receiveScannedSample(localSample);
        return;
      }

      const petition = await fetchPetitionByCode(code);
      const itemSeq = Number(payload?.itemSeq);
      const item = petition.items.find(it => payload?.sampleId && it.sampleId === String(payload.sampleId))
        ?? petition.items.find(it => Number.isFinite(itemSeq) && it.seq === itemSeq)
        ?? petition.items[0];

      if (!item) {
        toast.error("ไม่พบรายการตัวอย่างในคำร้องนี้");
        return;
      }

      const now = new Date();
      const sample: SampleItem = {
        id: item.sampleId || `${petition.petitionNo}-${item.seq}`,
        name: [item.sampleName, item.commonName].filter(Boolean).join(" "),
        status: "sent",
        date: now.toLocaleDateString("th-TH"),
        time: now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
        sender: petition.sampleSubmittedBy || petition.requester.fullName,
      };

      handleScannedData(sample, false);
      await receiveScannedSample(sample);
      try {
        await api.patch<Petition>(`/petitions/${petition._id}/receive`);
      } catch {
        try {
          await api.patch<Petition>(`/petitions/${petition._id}`, { status: "pendingReview" });
        } catch (statusErr) {
          console.error("update petition status error:", statusErr);
        }
      }
    } catch (error) {
      console.error("receive scan error:", error);
      toast.error("สแกนไม่สำเร็จ ไม่พบคำร้องหรือตัวอย่างจาก QR Code นี้");
    }
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

        {/* Sent items with status */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              ตัวอย่างที่ส่งแล้ว (รอรับเข้าระบบ)
              <Badge className="bg-primary/10 text-primary">{sentItems.length + sentSamples.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sentItems.length === 0 && sentSamples.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">รับตัวอย่างครบแล้ว</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {sentItems.map(s => (
                  <Card key={s.id} className="p-3 min-w-[220px] shadow-sm space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-primary">{s.id}</p>
                      {s.status === "sending" ? (
                        <Badge variant="outline" className="text-xs gap-1 text-amber-600 border-amber-300">
                          <Clock className="w-3 h-3" /> กำลังส่ง
                        </Badge>
                      ) : (
                        <Badge className="text-xs gap-1 bg-green-100 text-green-700 border-green-300">
                          <CheckCircle2 className="w-3 h-3" /> ส่งแล้ว
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-foreground">{s.name}</p>
                    <p className="text-xs text-muted-foreground">📅 {s.date} ⏰ {s.time}</p>
                    <p className="text-xs text-muted-foreground">👤 {s.sender}</p>
                  </Card>
                ))}
                {sentSamples.map(s => (
                  <Card key={s.id} className="p-3 min-w-[220px] shadow-sm space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-primary">{s.id}</p>
                      <Badge className="text-xs gap-1 bg-green-100 text-green-700 border-green-300">
                        <CheckCircle2 className="w-3 h-3" /> ส่งแล้ว
                      </Badge>
                    </div>
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
                <div id={READER_ID} className={`h-full w-full ${scanning ? "block" : "hidden"}`} />
                {!scanning && (
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
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default SendSample;
