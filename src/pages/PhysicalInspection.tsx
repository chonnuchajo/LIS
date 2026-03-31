import { useState, useRef } from "react";
import { FlaskConical, Camera, Droplets, Palette, CheckCircle2, Clock } from "lucide-react";
import AppSidebar from "@/components/lis/AppSidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useSamples } from "@/context/SampleContext";

interface PhysicalResult {
  sampleId: string;
  density?: string;
  dissolution?: string;
  colorMatch?: "match" | "mismatch" | "";
  colorNote?: string;
  photoUrl?: string;
  status: "pending" | "completed";
}

const PhysicalInspection = () => {
  const { sentItems, sentSamples } = useSamples();
  const [results, setResults] = useState<Record<string, PhysicalResult>>({});
  const [photoDialog, setPhotoDialog] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Combine all samples that are being sent or already sent
  const allSamples = [
    ...sentItems.map(s => ({ id: s.id, name: s.name, sender: s.sender, date: s.date, time: s.time, sampleStatus: s.status })),
    ...sentSamples.map(s => ({ id: s.id, name: s.name, sender: s.sender || "", date: s.date, time: s.time, sampleStatus: "sent" as const })),
  ];

  const getResult = (id: string): PhysicalResult => results[id] || { sampleId: id, status: "pending" };

  const updateResult = (id: string, updates: Partial<PhysicalResult>) => {
    setResults(prev => ({
      ...prev,
      [id]: { ...getResult(id), sampleId: id, ...updates },
    }));
  };

  const handlePhotoUpload = (sampleId: string, file: File) => {
    const url = URL.createObjectURL(file);
    updateResult(sampleId, { photoUrl: url });
    toast.success("อัปโหลดรูปเทียบสีสำเร็จ");
    setPhotoDialog(null);
  };

  const markCompleted = (id: string) => {
    const r = getResult(id);
    if (!r.density || !r.dissolution || !r.colorMatch) {
      toast.error("กรุณากรอกข้อมูลให้ครบก่อนบันทึก");
      return;
    }
    updateResult(id, { status: "completed" });
    toast.success(`บันทึกผลตรวจกายภาพ ${id} สำเร็จ`);
  };

  const pendingCount = allSamples.filter(s => getResult(s.id).status === "pending").length;
  const completedCount = allSamples.filter(s => getResult(s.id).status === "completed").length;

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">การตรวจกายภาพ</h1>
            <p className="text-sm text-muted-foreground">ตรวจสอบ Density, การละลาย และเทียบสีกับแบชก่อนหน้า</p>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-sm gap-1 py-1 px-3">
              <Clock className="w-3.5 h-3.5" /> รอตรวจ {pendingCount}
            </Badge>
            <Badge className="text-sm gap-1 py-1 px-3 bg-green-100 text-green-700 border-green-300">
              <CheckCircle2 className="w-3.5 h-3.5" /> ตรวจแล้ว {completedCount}
            </Badge>
          </div>
        </div>

        {allSamples.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <FlaskConical className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
              <p className="text-muted-foreground">ยังไม่มีตัวอย่างที่ต้องตรวจกายภาพ</p>
              <p className="text-xs text-muted-foreground mt-1">ตัวอย่างจะปรากฏเมื่อมีการส่งตัวอย่างจากหน้า "การส่งตัวอย่าง"</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {allSamples.map(sample => {
              const r = getResult(sample.id);
              const isCompleted = r.status === "completed";
              return (
                <Card key={sample.id} className={`shadow-sm transition-all ${isCompleted ? "border-green-200 bg-green-50/30" : ""}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FlaskConical className="w-4 h-4 text-primary" />
                        {sample.id}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {sample.sampleStatus === "sending" ? (
                          <Badge variant="outline" className="text-xs gap-1 text-amber-600 border-amber-300">
                            <Clock className="w-3 h-3" /> กำลังส่ง
                          </Badge>
                        ) : (
                          <Badge className="text-xs gap-1 bg-blue-100 text-blue-700 border-blue-300">
                            <CheckCircle2 className="w-3 h-3" /> ส่งถึงแล้ว
                          </Badge>
                        )}
                        {isCompleted && (
                          <Badge className="text-xs gap-1 bg-green-100 text-green-700 border-green-300">
                            <CheckCircle2 className="w-3 h-3" /> ตรวจแล้ว
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-foreground font-medium">{sample.name}</p>
                    <p className="text-xs text-muted-foreground">ผู้ส่ง: {sample.sender} · {sample.date} {sample.time}</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Density */}
                    <div className="flex items-center gap-3">
                      <Droplets className="w-5 h-5 text-blue-500 shrink-0" />
                      <div className="flex-1">
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Density (g/mL) @ 30°C</label>
                        <Input
                          type="number"
                          step="0.001"
                          placeholder="เช่น 1.024"
                          value={r.density || ""}
                          onChange={e => updateResult(sample.id, { density: e.target.value })}
                          disabled={isCompleted}
                        />
                      </div>
                    </div>

                    {/* Dissolution */}
                    <div className="flex items-center gap-3">
                      <FlaskConical className="w-5 h-5 text-purple-500 shrink-0" />
                      <div className="flex-1">
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">การละลาย</label>
                        <Select
                          value={r.dissolution || ""}
                          onValueChange={v => updateResult(sample.id, { dissolution: v })}
                          disabled={isCompleted}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="เลือกผลการละลาย" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="complete">ละลายหมด</SelectItem>
                            <SelectItem value="partial">ละลายบางส่วน</SelectItem>
                            <SelectItem value="not-dissolved">ไม่ละลาย</SelectItem>
                            <SelectItem value="suspension">แขวนลอย (Suspension)</SelectItem>
                            <SelectItem value="emulsion">อิมัลชัน (Emulsion)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Color comparison */}
                    <div className="flex items-start gap-3">
                      <Palette className="w-5 h-5 text-orange-500 shrink-0 mt-1" />
                      <div className="flex-1 space-y-2">
                        <label className="text-xs font-medium text-muted-foreground block">เทียบสีกับแบชก่อน</label>
                        <div className="flex gap-2">
                          <Select
                            value={r.colorMatch || ""}
                            onValueChange={v => updateResult(sample.id, { colorMatch: v as "match" | "mismatch" })}
                            disabled={isCompleted}
                          >
                            <SelectTrigger className="w-[160px]">
                              <SelectValue placeholder="เลือก" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="match">สีตรงกัน ✅</SelectItem>
                              <SelectItem value="mismatch">สีไม่ตรง ⚠️</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => {
                              setPhotoDialog(sample.id);
                              setTimeout(() => fileInputRef.current?.click(), 100);
                            }}
                            disabled={isCompleted}
                          >
                            <Camera className="w-4 h-4" />
                            {r.photoUrl ? "เปลี่ยนรูป" : "ถ่ายรูปเทียบสี"}
                          </Button>
                        </div>
                        {r.photoUrl && (
                          <img src={r.photoUrl} alt="Color comparison" className="w-full max-w-[200px] rounded-lg border border-border" />
                        )}
                        {r.colorMatch === "mismatch" && (
                          <Textarea
                            placeholder="หมายเหตุ (สีต่างอย่างไร)"
                            value={r.colorNote || ""}
                            onChange={e => updateResult(sample.id, { colorNote: e.target.value })}
                            disabled={isCompleted}
                            className="text-sm"
                          />
                        )}
                      </div>
                    </div>

                    {/* Action */}
                    {!isCompleted && (
                      <Button className="w-full gap-2" onClick={() => markCompleted(sample.id)}>
                        <CheckCircle2 className="w-4 h-4" /> บันทึกผลตรวจกายภาพ
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Hidden file input for photo upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file && photoDialog) handlePhotoUpload(photoDialog, file);
            e.target.value = "";
          }}
        />
      </main>
    </div>
  );
};

export default PhysicalInspection;
