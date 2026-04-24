import { useRef, useState } from "react";
import { FlaskConical, Camera, Droplets, Palette, CheckCircle2, Clock, Package } from "lucide-react";
import AppSidebar from "@/components/lis/AppSidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useSamples } from "@/context/SampleContext";

const PhysicalInspection = () => {
  const { sentItems, sentSamples, physicalResults, upsertPhysicalResult } = useSamples();
  const [photoDialog, setPhotoDialog] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allSamples = [
    ...sentItems.map(s => ({ id: s.id, name: s.name, sender: s.sender, date: s.date, time: s.time, sampleStatus: s.status })),
    ...sentSamples.map(s => ({ id: s.id, name: s.name, sender: s.sender || "", date: s.date, time: s.time, sampleStatus: "sent" as const })),
  ];

  const getResult = (id: string) => physicalResults[id] || { sampleId: id, status: "pending" as const };
  const updateResult = (id: string, updates: Parameters<typeof upsertPhysicalResult>[1]) => upsertPhysicalResult(id, updates);

  const handlePhotoUpload = (sampleId: string, file: File) => {
    const url = URL.createObjectURL(file);
    updateResult(sampleId, { photoUrl: url });
    toast.success("อัปโหลดรูปเทียบสีสำเร็จ");
    setPhotoDialog(null);
  };

  const markCompleted = (id: string) => {
    const r = getResult(id);
    if (!r.density || !r.dissolutionValue || !r.dissolutionStatus || !r.colorMatch) {
      toast.error("กรุณากรอกข้อมูลให้ครบก่อนบันทึก");
      return;
    }
    // กายภาพรวม: ถือว่า "ปกติ" เมื่อ dissolution ปกติ และ สีตรงกัน
    const physicalStatus: "normal" | "abnormal" =
      r.dissolutionStatus === "normal" && r.colorMatch === "match" ? "normal" : "abnormal";
    updateResult(id, { status: "completed", physicalStatus, completedAt: new Date().toISOString() });
    toast.success(`บันทึกผลตรวจกายภาพ ${id} สำเร็จ`);
  };

  const pendingCount = allSamples.filter(s => getResult(s.id).status === "pending").length;
  const completedCount = allSamples.filter(s => getResult(s.id).status === "completed").length;
  const sendingCount = allSamples.filter(s => s.sampleStatus === "sending").length;
  const sentCount = allSamples.filter(s => s.sampleStatus === "sent").length;

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">การตรวจกายภาพ</h1>
            <p className="text-sm text-muted-foreground">ตรวจสอบ Density, การละลาย และเทียบสีกับแบชก่อนหน้า</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline" className="text-sm gap-1 py-1 px-3 text-amber-600 border-amber-300">
              <Package className="w-3.5 h-3.5" /> รอรับเข้าระบบ {sendingCount}
            </Badge>
            <Badge variant="outline" className="text-sm gap-1 py-1 px-3 text-blue-600 border-blue-300">
              <CheckCircle2 className="w-3.5 h-3.5" /> รับแล้ว {sentCount}
            </Badge>
            <Badge variant="outline" className="text-sm gap-1 py-1 px-3">
              <Clock className="w-3.5 h-3.5" /> รอตรวจ {pendingCount}
            </Badge>
            <Badge className="text-sm gap-1 py-1 px-3 bg-green-100 text-green-700 border-green-300">
              <CheckCircle2 className="w-3.5 h-3.5" /> ตรวจแล้ว {completedCount}
            </Badge>
          </div>
        </div>

        {/* Sent items waiting to be received */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              ตัวอย่างที่ส่งแล้ว (รอรับเข้าระบบ)
              <Badge className="bg-primary/10 text-primary">{sentItems.length + sentSamples.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sentItems.length === 0 && sentSamples.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">ยังไม่มีตัวอย่างที่ส่งเข้ามา</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {sentItems.map(s => (
                  <Card key={`si-${s.id}`} className="p-3 min-w-[220px] shadow-sm space-y-1">
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
                  <Card key={`ss-${s.id}`} className="p-3 min-w-[220px] shadow-sm space-y-1">
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

                    {/* Dissolution - number input + normal/abnormal dropdown */}
                    <div className="flex items-center gap-3">
                      <FlaskConical className="w-5 h-5 text-purple-500 shrink-0" />
                      <div className="flex-1">
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">การละลาย</label>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="กรอกค่าการละลาย"
                            value={r.dissolutionValue || ""}
                            onChange={e => updateResult(sample.id, { dissolutionValue: e.target.value })}
                            disabled={isCompleted}
                            className="flex-1"
                          />
                          <Select
                            value={r.dissolutionStatus || ""}
                            onValueChange={v => updateResult(sample.id, { dissolutionStatus: v as "normal" | "abnormal" })}
                            disabled={isCompleted}
                          >
                            <SelectTrigger className="w-[130px]">
                              <SelectValue placeholder="สถานะ" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="normal">ปกติ ✅</SelectItem>
                              <SelectItem value="abnormal">ผิดปกติ ⚠️</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
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
