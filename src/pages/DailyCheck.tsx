import { useState } from "react";
import { Scale, CheckCircle2, Clock, RotateCcw } from "lucide-react";
import AppSidebar from "@/components/lis/AppSidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface ScaleRecord {
  weight100: string;
  weight10: string;
  status100: "pass" | "fail" | "";
  status10: "pass" | "fail" | "";
  checkedAt?: string;
}

const SCALES = [
  { id: "scale-1", name: "เครื่องชั่ง 1", model: "Balance A" },
  { id: "scale-2", name: "เครื่องชั่ง 2", model: "Balance B" },
  { id: "scale-3", name: "เครื่องชั่ง 3", model: "Balance C" },
  { id: "scale-4", name: "เครื่องชั่ง 4", model: "Balance D" },
  { id: "scale-5", name: "เครื่องชั่ง 5", model: "Balance E" },
];

const TOLERANCE = 0.05; // ±0.05g tolerance

const DailyCheck = () => {
  const today = new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
  const [records, setRecords] = useState<Record<string, ScaleRecord>>({});

  const getRecord = (id: string): ScaleRecord =>
    records[id] || { weight100: "", weight10: "", status100: "", status10: "" };

  const updateRecord = (id: string, updates: Partial<ScaleRecord>) => {
    setRecords(prev => ({
      ...prev,
      [id]: { ...getRecord(id), ...updates },
    }));
  };

  const evaluate = (value: string, target: number): "pass" | "fail" | "" => {
    if (!value) return "";
    const num = parseFloat(value);
    if (isNaN(num)) return "";
    return Math.abs(num - target) <= TOLERANCE ? "pass" : "fail";
  };

  const handleCheck = (id: string) => {
    const r = getRecord(id);
    if (!r.weight100 || !r.weight10) {
      toast.error("กรุณากรอกค่าน้ำหนักทั้ง 2 ค่า");
      return;
    }
    const s100 = evaluate(r.weight100, 100);
    const s10 = evaluate(r.weight10, 10);
    if (!s100 || !s10) {
      toast.error("ค่าน้ำหนักไม่ถูกต้อง");
      return;
    }
    const now = new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
    updateRecord(id, { status100: s100, status10: s10, checkedAt: now });
    if (s100 === "pass" && s10 === "pass") {
      toast.success(`${SCALES.find(s => s.id === id)?.name} ผ่านการ Calibrate`);
    } else {
      toast.warning(`${SCALES.find(s => s.id === id)?.name} ไม่ผ่านการ Calibrate`);
    }
  };

  const handleReset = (id: string) => {
    setRecords(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  const checkedCount = Object.values(records).filter(r => r.checkedAt).length;
  const passCount = Object.values(records).filter(r => r.status100 === "pass" && r.status10 === "pass").length;

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Daily Check</h1>
            <p className="text-sm text-muted-foreground">Calibrate เครื่องชั่ง ประจำวัน — {today}</p>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-sm gap-1 py-1 px-3">
              <Clock className="w-3.5 h-3.5" /> ตรวจแล้ว {checkedCount}/{SCALES.length}
            </Badge>
            <Badge className="text-sm gap-1 py-1 px-3 bg-green-100 text-green-700 border-green-300">
              <CheckCircle2 className="w-3.5 h-3.5" /> ผ่าน {passCount}/{SCALES.length}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {SCALES.map(scale => {
            const r = getRecord(scale.id);
            const isChecked = !!r.checkedAt;
            const allPass = r.status100 === "pass" && r.status10 === "pass";

            return (
              <Card
                key={scale.id}
                className={`shadow-sm transition-all ${isChecked ? (allPass ? "border-green-200 bg-green-50/30" : "border-red-200 bg-red-50/30") : ""}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Scale className="w-4 h-4 text-primary" />
                      {scale.name}
                    </CardTitle>
                    {isChecked && (
                      <div className="flex items-center gap-2">
                        {allPass ? (
                          <Badge className="text-xs gap-1 bg-green-100 text-green-700 border-green-300">
                            <CheckCircle2 className="w-3 h-3" /> ผ่าน
                          </Badge>
                        ) : (
                          <Badge className="text-xs gap-1 bg-red-100 text-red-700 border-red-300">
                            ไม่ผ่าน
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{scale.model}</p>
                  {r.checkedAt && (
                    <p className="text-xs text-muted-foreground">ตรวจเมื่อ: {r.checkedAt}</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* 100g */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                      น้ำหนักมาตรฐาน 100 g
                      {r.status100 === "pass" && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                      {r.status100 === "fail" && <span className="text-red-500 text-xs">❌ ไม่ผ่าน</span>}
                    </label>
                    <Input
                      type="number"
                      step="0.001"
                      placeholder="กรอกค่าที่อ่านได้ (g)"
                      value={r.weight100}
                      onChange={e => updateRecord(scale.id, { weight100: e.target.value, status100: "", status10: getRecord(scale.id).status10 === "" ? "" : getRecord(scale.id).status10, checkedAt: undefined })}
                      disabled={isChecked}
                    />
                    {r.status100 === "pass" && <p className="text-xs text-green-600 mt-0.5">ค่าอยู่ในเกณฑ์ (±{TOLERANCE}g)</p>}
                    {r.status100 === "fail" && <p className="text-xs text-red-600 mt-0.5">ค่าเกินเกณฑ์ (±{TOLERANCE}g)</p>}
                  </div>

                  {/* 10g */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                      น้ำหนักมาตรฐาน 10 g
                      {r.status10 === "pass" && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                      {r.status10 === "fail" && <span className="text-red-500 text-xs">❌ ไม่ผ่าน</span>}
                    </label>
                    <Input
                      type="number"
                      step="0.001"
                      placeholder="กรอกค่าที่อ่านได้ (g)"
                      value={r.weight10}
                      onChange={e => updateRecord(scale.id, { weight10: e.target.value, status100: getRecord(scale.id).status100 === "" ? "" : getRecord(scale.id).status100, status10: "", checkedAt: undefined })}
                      disabled={isChecked}
                    />
                    {r.status10 === "pass" && <p className="text-xs text-green-600 mt-0.5">ค่าอยู่ในเกณฑ์ (±{TOLERANCE}g)</p>}
                    {r.status10 === "fail" && <p className="text-xs text-red-600 mt-0.5">ค่าเกินเกณฑ์ (±{TOLERANCE}g)</p>}
                  </div>

                  {!isChecked ? (
                    <Button className="w-full gap-2" onClick={() => handleCheck(scale.id)}>
                      <CheckCircle2 className="w-4 h-4" /> บันทึกผล Calibrate
                    </Button>
                  ) : (
                    <Button variant="outline" className="w-full gap-2" onClick={() => handleReset(scale.id)}>
                      <RotateCcw className="w-4 h-4" /> ตรวจใหม่
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default DailyCheck;
