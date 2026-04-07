import { useState } from "react";
import { Scale, CheckCircle2, Clock, RotateCcw, List, ClipboardList } from "lucide-react";
import AppSidebar from "@/components/lis/AppSidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface ScaleRecord {
  weights100: [string, string, string];
  weights10: [string, string, string];
  status100: "pass" | "fail" | "";
  status10: "pass" | "fail" | "";
  avg100?: number;
  avg10?: number;
  checkedAt?: string;
  recorder: string;
}

interface HistoryEntry {
  scaleId: string;
  scaleName: string;
  model: string;
  weights100: [string, string, string];
  weights10: [string, string, string];
  avg100: number;
  avg10: number;
  status100: "pass" | "fail";
  status10: "pass" | "fail";
  checkedAt: string;
  date: string;
  recorder: string;
}

const SCALES = [
  { id: "scale-1", name: "เครื่องชั่ง 1", model: "Balance A" },
  { id: "scale-2", name: "เครื่องชั่ง 2", model: "Balance B" },
  { id: "scale-3", name: "เครื่องชั่ง 3", model: "Balance C" },
  { id: "scale-4", name: "เครื่องชั่ง 4", model: "Balance D" },
  { id: "scale-5", name: "เครื่องชั่ง 5", model: "Balance E" },
];

const TOLERANCE = 0.05;

const emptyRecord = (): ScaleRecord => ({
  weights100: ["", "", ""],
  weights10: ["", "", ""],
  status100: "",
  status10: "",
  recorder: "",
});

const DailyCheck = () => {
  const today = new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
  const [records, setRecords] = useState<Record<string, ScaleRecord>>({});
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const getRecord = (id: string): ScaleRecord => records[id] || emptyRecord();

  const updateWeight = (id: string, type: "100" | "10", index: number, value: string) => {
    const r = getRecord(id);
    if (type === "100") {
      const w = [...r.weights100] as [string, string, string];
      w[index] = value;
      setRecords(prev => ({ ...prev, [id]: { ...r, weights100: w, status100: "", status10: "", checkedAt: undefined } }));
    } else {
      const w = [...r.weights10] as [string, string, string];
      w[index] = value;
      setRecords(prev => ({ ...prev, [id]: { ...r, weights10: w, status100: "", status10: "", checkedAt: undefined } }));
    }
  };

  const updateRecorder = (id: string, value: string) => {
    const r = getRecord(id);
    setRecords(prev => ({ ...prev, [id]: { ...r, recorder: value } }));
  };

  const calcAvg = (vals: string[]): number | null => {
    const nums = vals.map(v => parseFloat(v)).filter(n => !isNaN(n));
    if (nums.length !== 3) return null;
    return nums.reduce((a, b) => a + b, 0) / 3;
  };

  const evaluate = (avg: number, target: number): "pass" | "fail" => {
    return Math.abs(avg - target) <= TOLERANCE ? "pass" : "fail";
  };

  const handleCheck = (id: string) => {
    const r = getRecord(id);
    if (r.weights100.some(v => !v) || r.weights10.some(v => !v)) {
      toast.error("กรุณากรอกค่าน้ำหนักให้ครบทั้ง 6 ค่า");
      return;
    }
    if (!r.recorder.trim()) {
      toast.error("กรุณากรอกชื่อผู้บันทึก");
      return;
    }
    const avg100 = calcAvg(r.weights100);
    const avg10 = calcAvg(r.weights10);
    if (avg100 === null || avg10 === null) {
      toast.error("ค่าน้ำหนักไม่ถูกต้อง");
      return;
    }
    const s100 = evaluate(avg100, 100);
    const s10 = evaluate(avg10, 10);
    const now = new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

    const scale = SCALES.find(s => s.id === id)!;
    setRecords(prev => ({
      ...prev,
      [id]: { ...r, status100: s100, status10: s10, avg100, avg10, checkedAt: now },
    }));

    setHistory(prev => [
      {
        scaleId: id,
        scaleName: scale.name,
        model: scale.model,
        weights100: r.weights100,
        weights10: r.weights10,
        avg100,
        avg10,
        status100: s100,
        status10: s10,
        checkedAt: now,
        date: today,
        recorder: r.recorder,
      },
      ...prev.filter(h => h.scaleId !== id),
    ]);

    if (s100 === "pass" && s10 === "pass") {
      toast.success(`${scale.name} ผ่านการ Calibrate`);
    } else {
      toast.warning(`${scale.name} ไม่ผ่านการ Calibrate`);
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

        <Tabs defaultValue="check" className="space-y-4">
          <TabsList>
            <TabsTrigger value="check" className="gap-1.5">
              <ClipboardList className="w-4 h-4" /> บันทึกผล
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5">
              <List className="w-4 h-4" /> รายการบันทึก
            </TabsTrigger>
          </TabsList>

          <TabsContent value="check">
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
                          <Badge className={`text-xs gap-1 ${allPass ? "bg-green-100 text-green-700 border-green-300" : "bg-red-100 text-red-700 border-red-300"}`}>
                            {allPass ? <><CheckCircle2 className="w-3 h-3" /> ผ่าน</> : "ไม่ผ่าน"}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{scale.model}</p>
                      {r.checkedAt && <p className="text-xs text-muted-foreground">ตรวจเมื่อ: {r.checkedAt}</p>}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* 100g x3 */}
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                          น้ำหนักมาตรฐาน 100 g (3 ครั้ง)
                          {r.status100 === "pass" && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                          {r.status100 === "fail" && <span className="text-red-500 text-xs">❌ ไม่ผ่าน</span>}
                        </label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {[0, 1, 2].map(i => (
                            <Input
                              key={i}
                              type="number"
                              step="0.001"
                              placeholder={`ครั้งที่ ${i + 1}`}
                              value={r.weights100[i]}
                              onChange={e => updateWeight(scale.id, "100", i, e.target.value)}
                              disabled={isChecked}
                              className="text-xs h-8"
                            />
                          ))}
                        </div>
                        {r.avg100 !== undefined && (
                          <p className={`text-xs mt-1 ${r.status100 === "pass" ? "text-green-600" : "text-red-600"}`}>
                            ค่าเฉลี่ย: {r.avg100.toFixed(4)} g {r.status100 === "pass" ? "✓ อยู่ในเกณฑ์" : "✗ เกินเกณฑ์"} (±{TOLERANCE}g)
                          </p>
                        )}
                      </div>

                      {/* 10g x3 */}
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                          น้ำหนักมาตรฐาน 10 g (3 ครั้ง)
                          {r.status10 === "pass" && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                          {r.status10 === "fail" && <span className="text-red-500 text-xs">❌ ไม่ผ่าน</span>}
                        </label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {[0, 1, 2].map(i => (
                            <Input
                              key={i}
                              type="number"
                              step="0.001"
                              placeholder={`ครั้งที่ ${i + 1}`}
                              value={r.weights10[i]}
                              onChange={e => updateWeight(scale.id, "10", i, e.target.value)}
                              disabled={isChecked}
                              className="text-xs h-8"
                            />
                          ))}
                        </div>
                        {r.avg10 !== undefined && (
                          <p className={`text-xs mt-1 ${r.status10 === "pass" ? "text-green-600" : "text-red-600"}`}>
                            ค่าเฉลี่ย: {r.avg10.toFixed(4)} g {r.status10 === "pass" ? "✓ อยู่ในเกณฑ์" : "✗ เกินเกณฑ์"} (±{TOLERANCE}g)
                          </p>
                        )}
                      </div>

                      {/* Recorder */}
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">ผู้บันทึก</label>
                        <Input
                          placeholder="ชื่อผู้บันทึก"
                          value={r.recorder}
                          onChange={e => updateRecorder(scale.id, e.target.value)}
                          disabled={isChecked}
                          className="text-xs h-8"
                        />
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
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <List className="w-4 h-4 text-primary" />
                  รายการบันทึก Calibrate ประจำวัน — {today}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">ยังไม่มีรายการบันทึก</p>
                ) : (
                  <div className="overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>เครื่องชั่ง</TableHead>
                          <TableHead className="text-center">100g #1</TableHead>
                          <TableHead className="text-center">100g #2</TableHead>
                          <TableHead className="text-center">100g #3</TableHead>
                          <TableHead className="text-center">เฉลี่ย 100g</TableHead>
                          <TableHead className="text-center">10g #1</TableHead>
                          <TableHead className="text-center">10g #2</TableHead>
                          <TableHead className="text-center">10g #3</TableHead>
                          <TableHead className="text-center">เฉลี่ย 10g</TableHead>
                          <TableHead className="text-center">สถานะ</TableHead>
                          <TableHead>ผู้บันทึก</TableHead>
                          <TableHead>เวลา</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {history.map(h => {
                          const allPass = h.status100 === "pass" && h.status10 === "pass";
                          return (
                            <TableRow key={h.scaleId}>
                              <TableCell className="font-medium whitespace-nowrap">{h.scaleName}</TableCell>
                              {h.weights100.map((v, i) => (
                                <TableCell key={`100-${i}`} className="text-center text-xs">{v}</TableCell>
                              ))}
                              <TableCell className={`text-center text-xs font-semibold ${h.status100 === "pass" ? "text-green-600" : "text-red-600"}`}>
                                {h.avg100.toFixed(4)}
                              </TableCell>
                              {h.weights10.map((v, i) => (
                                <TableCell key={`10-${i}`} className="text-center text-xs">{v}</TableCell>
                              ))}
                              <TableCell className={`text-center text-xs font-semibold ${h.status10 === "pass" ? "text-green-600" : "text-red-600"}`}>
                                {h.avg10.toFixed(4)}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge className={`text-xs ${allPass ? "bg-green-100 text-green-700 border-green-300" : "bg-red-100 text-red-700 border-red-300"}`}>
                                  {allPass ? "ผ่าน" : "ไม่ผ่าน"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs whitespace-nowrap">{h.recorder}</TableCell>
                              <TableCell className="text-xs whitespace-nowrap">{h.checkedAt}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default DailyCheck;
