import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Scale, CheckCircle2, Clock, RotateCcw, List, ClipboardList, Filter } from "lucide-react";
import AppLayout from "@/components/lis/AppLayout";
import PageHeader from "@/components/lis/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { api, type DailyCheckRecord } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

interface ScaleDraft {
  weights100: [string, string, string];
  weights10: [string, string, string];
  status100: "pass" | "fail" | "";
  status10: "pass" | "fail" | "";
  avg100?: number;
  avg10?: number;
  checkedAt?: string;
}

const SCALES = [
  { id: "scale-1", name: "เครื่องชั่ง 1", model: "Balance A" },
  { id: "scale-2", name: "เครื่องชั่ง 2", model: "Balance B" },
  { id: "scale-3", name: "เครื่องชั่ง 3", model: "Balance C" },
  { id: "scale-4", name: "เครื่องชั่ง 4", model: "Balance D" },
  { id: "scale-5", name: "เครื่องชั่ง 5", model: "Balance E" },
];

const TOLERANCE = 0.05;

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

const fmtDate = (s: string) => {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
};

const emptyDraft = (): ScaleDraft => ({
  weights100: ["", "", ""],
  weights10: ["", "", ""],
  status100: "",
  status10: "",
});

const DailyCheck = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const todayLabel = new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });

  const [drafts, setDrafts] = useState<Record<string, ScaleDraft>>({});

  // Filters
  const [filterDate, setFilterDate] = useState<string>(todayStr());
  const [filterScale, setFilterScale] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "pass" | "fail">("all");

  // วันนี้ (สำหรับแสดง record ของวันนี้บนการ์ดเช็ค)
  const { data: todayRecords = [] } = useQuery({
    queryKey: ["daily-checks", "today"],
    queryFn: () => api.getDailyChecks({ date: todayStr() }),
    refetchOnWindowFocus: true,
  });

  // History (filtered)
  const { data: historyRecords = [], isLoading: historyLoading } = useQuery({
    queryKey: ["daily-checks", "history", filterDate, filterScale, filterStatus],
    queryFn: () =>
      api.getDailyChecks({
        date: filterDate || todayStr(),
        scaleId: filterScale === "all" ? undefined : filterScale,
        status: filterStatus === "all" ? undefined : filterStatus,
      }),
  });

  const latestByScale = useMemo(() => {
    const map: Record<string, DailyCheckRecord> = {};
    for (const r of todayRecords) {
      if (!map[r.scaleId]) map[r.scaleId] = r;
    }
    return map;
  }, [todayRecords]);

  const createMutation = useMutation({
    mutationFn: api.createDailyCheck,
    onSuccess: (_data, vars) => {
      const scale = SCALES.find(s => s.id === vars.scaleId)!;
      const allPass = vars.status100 === "pass" && vars.status10 === "pass";
      if (allPass) toast.success(`${scale.name} ผ่านการ Calibrate`);
      else toast.warning(`${scale.name} ไม่ผ่านการ Calibrate`);

      queryClient.invalidateQueries({ queryKey: ["daily-checks"] });
      // เคลียร์ draft ของ scale นั้น — watcher จะปลดแจ้งเตือนเองเมื่อครบ
      setDrafts(prev => {
        const c = { ...prev };
        delete c[vars.scaleId];
        return c;
      });
    },
    onError: (err: Error) => toast.error(err.message || "บันทึกไม่สำเร็จ"),
  });

  const getDraft = (id: string): ScaleDraft => drafts[id] || emptyDraft();

  const updateWeight = (id: string, type: "100" | "10", index: number, value: string) => {
    const r = getDraft(id);
    if (type === "100") {
      const w = [...r.weights100] as [string, string, string];
      w[index] = value;
      setDrafts(prev => ({ ...prev, [id]: { ...r, weights100: w, status100: "", status10: "", checkedAt: undefined } }));
    } else {
      const w = [...r.weights10] as [string, string, string];
      w[index] = value;
      setDrafts(prev => ({ ...prev, [id]: { ...r, weights10: w, status100: "", status10: "", checkedAt: undefined } }));
    }
  };

  const calcAvg = (vals: string[]): number | null => {
    const nums = vals.map(v => parseFloat(v)).filter(n => !isNaN(n));
    if (nums.length !== 3) return null;
    return nums.reduce((a, b) => a + b, 0) / 3;
  };

  const evaluate = (avg: number, target: number): "pass" | "fail" =>
    Math.abs(avg - target) <= TOLERANCE ? "pass" : "fail";

  const handleCheck = (id: string) => {
    const r = getDraft(id);
    if (r.weights100.some(v => !v) || r.weights10.some(v => !v)) {
      toast.error("กรุณากรอกค่าน้ำหนักให้ครบทั้ง 6 ค่า");
      return;
    }
    if (!user?.name) {
      toast.error("ไม่พบชื่อผู้ใช้งานปัจจุบัน");
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
    const scale = SCALES.find(s => s.id === id)!;

    createMutation.mutate({
      scaleId: id,
      scaleName: scale.name,
      model: scale.model,
      weights100: r.weights100,
      weights10: r.weights10,
      avg100, avg10,
      status100: s100, status10: s10,
      tolerance: TOLERANCE,
      recorder: user.name,
      recorderId: user.id,
      recorderEmail: user.email,
    });
  };

  const handleRecheck = (id: string) => {
    setDrafts(prev => ({ ...prev, [id]: emptyDraft() }));
  };

  const checkedCount = Object.keys(latestByScale).length;
  const passCount = Object.values(latestByScale).filter(r => r.status === "pass").length;

  return (
    <AppLayout title="Daily Check">
      <PageHeader
        className="mb-6"
        title="Daily Check"
        description={`Calibrate เครื่องชั่ง ประจำวัน — ${todayLabel}`}
        actions={
          <>
            <Badge variant="outline" className="text-sm gap-1 py-1 px-3">
              <Clock className="w-3.5 h-3.5" /> ตรวจแล้ว {checkedCount}/{SCALES.length}
            </Badge>
            <Badge className="text-sm gap-1 py-1 px-3 bg-green-100 text-green-700 border-green-300">
              <CheckCircle2 className="w-3.5 h-3.5" /> ผ่าน {passCount}/{SCALES.length}
            </Badge>
          </>
        }
      />

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
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {SCALES.map(scale => {
              const todayRec = latestByScale[scale.id];
              const r = getDraft(scale.id);
              const isCheckedToday = !!todayRec;
              const showResult = isCheckedToday && !drafts[scale.id]?.weights100.some(v => v);
              const allPass = todayRec?.status === "pass";

              return (
                <Card
                  key={scale.id}
                  className={`shadow-sm transition-all ${
                    showResult ? (allPass ? "border-green-200 bg-green-50/30" : "border-red-200 bg-red-50/30") : ""
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Scale className="w-4 h-4 text-primary" />
                        {scale.name}
                      </CardTitle>
                      {showResult && todayRec && (
                        <Badge className={`text-xs gap-1 ${allPass ? "bg-green-100 text-green-700 border-green-300" : "bg-red-100 text-red-700 border-red-300"}`}>
                          {allPass ? <><CheckCircle2 className="w-3 h-3" /> ผ่าน</> : "ไม่ผ่าน"}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{scale.model}</p>
                    {showResult && todayRec && (
                      <p className="text-xs text-muted-foreground">ตรวจล่าสุด: {fmtTime(todayRec.checkedAt)} โดย {todayRec.recorder}</p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* 100g x3 */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                        น้ำหนักมาตรฐาน 100 g (3 ครั้ง)
                        {showResult && todayRec?.status100 === "pass" && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                        {showResult && todayRec?.status100 === "fail" && <span className="text-red-500 text-xs">ไม่ผ่าน</span>}
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[0, 1, 2].map(i => (
                          <Input
                            key={i}
                            type="number"
                            step="0.001"
                            placeholder={showResult && todayRec ? todayRec.weights100[i] : `ครั้งที่ ${i + 1}`}
                            value={r.weights100[i]}
                            onChange={e => updateWeight(scale.id, "100", i, e.target.value)}
                            disabled={createMutation.isPending}
                            className="text-xs h-8"
                          />
                        ))}
                      </div>
                      {showResult && todayRec && (
                        <p className={`text-xs mt-1 ${todayRec.status100 === "pass" ? "text-green-600" : "text-red-600"}`}>
                          ค่าเฉลี่ย: {todayRec.avg100.toFixed(4)} g {todayRec.status100 === "pass" ? "อยู่ในเกณฑ์" : "เกินเกณฑ์"} (±{TOLERANCE}g)
                        </p>
                      )}
                    </div>

                    {/* 10g x3 */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                        น้ำหนักมาตรฐาน 10 g (3 ครั้ง)
                        {showResult && todayRec?.status10 === "pass" && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                        {showResult && todayRec?.status10 === "fail" && <span className="text-red-500 text-xs">ไม่ผ่าน</span>}
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[0, 1, 2].map(i => (
                          <Input
                            key={i}
                            type="number"
                            step="0.001"
                            placeholder={showResult && todayRec ? todayRec.weights10[i] : `ครั้งที่ ${i + 1}`}
                            value={r.weights10[i]}
                            onChange={e => updateWeight(scale.id, "10", i, e.target.value)}
                            disabled={createMutation.isPending}
                            className="text-xs h-8"
                          />
                        ))}
                      </div>
                      {showResult && todayRec && (
                        <p className={`text-xs mt-1 ${todayRec.status10 === "pass" ? "text-green-600" : "text-red-600"}`}>
                          ค่าเฉลี่ย: {todayRec.avg10.toFixed(4)} g {todayRec.status10 === "pass" ? "อยู่ในเกณฑ์" : "เกินเกณฑ์"} (±{TOLERANCE}g)
                        </p>
                      )}
                    </div>

                    {/* Recorder (auto from logged-in user) */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">ผู้บันทึก</label>
                      <Input
                        value={user?.name ?? ""}
                        readOnly
                        disabled
                        className="text-xs h-8 bg-muted/40"
                      />
                    </div>

                    {showResult ? (
                      <Button variant="outline" className="w-full gap-2" onClick={() => handleRecheck(scale.id)}>
                        <RotateCcw className="w-4 h-4" /> บันทึกซ้ำ
                      </Button>
                    ) : (
                      <Button
                        className="w-full gap-2"
                        onClick={() => handleCheck(scale.id)}
                        disabled={createMutation.isPending}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {createMutation.isPending && createMutation.variables?.scaleId === scale.id ? "กำลังบันทึก..." : "บันทึกผล Calibrate"}
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
            <CardHeader className="space-y-3">
              <CardTitle className="text-base flex items-center gap-2">
                <List className="w-4 h-4 text-primary" />
                ประวัติการ Calibrate
              </CardTitle>

              {/* Filters */}
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Filter className="w-3 h-3" /> วันที่
                  </label>
                  <Input
                    type="date"
                    value={filterDate}
                    onChange={e => setFilterDate(e.target.value)}
                    className="h-8 text-xs w-[160px]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-muted-foreground">เครื่องชั่ง</label>
                  <Select value={filterScale} onValueChange={setFilterScale}>
                    <SelectTrigger className="h-8 text-xs w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทั้งหมด</SelectItem>
                      {SCALES.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-muted-foreground">สถานะ</label>
                  <Select value={filterStatus} onValueChange={v => setFilterStatus(v as "all" | "pass" | "fail")}>
                    <SelectTrigger className="h-8 text-xs w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทั้งหมด</SelectItem>
                      <SelectItem value="pass">ผ่าน</SelectItem>
                      <SelectItem value="fail">ไม่ผ่าน</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    setFilterDate(todayStr());
                    setFilterScale("all");
                    setFilterStatus("all");
                  }}
                >
                  รีเซ็ตตัวกรอง
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <p className="text-sm text-muted-foreground text-center py-8">กำลังโหลด...</p>
              ) : historyRecords.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">ไม่พบรายการในช่วงที่เลือก</p>
              ) : (
                <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
                  <Table className="min-w-[1000px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>วันที่</TableHead>
                        <TableHead>เวลา</TableHead>
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
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyRecords.map(h => {
                        const allPass = h.status === "pass";
                        return (
                          <TableRow key={h._id}>
                            <TableCell className="text-xs whitespace-nowrap">{fmtDate(h.date)}</TableCell>
                            <TableCell className="text-xs whitespace-nowrap">{fmtTime(h.checkedAt)}</TableCell>
                            <TableCell className="font-medium whitespace-nowrap">{h.scaleName}</TableCell>
                            {[0, 1, 2].map(i => (
                              <TableCell key={`100-${i}`} className="text-center text-xs">{h.weights100[i]}</TableCell>
                            ))}
                            <TableCell className={`text-center text-xs font-semibold ${h.status100 === "pass" ? "text-green-600" : "text-red-600"}`}>
                              {h.avg100.toFixed(4)}
                            </TableCell>
                            {[0, 1, 2].map(i => (
                              <TableCell key={`10-${i}`} className="text-center text-xs">{h.weights10[i]}</TableCell>
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
    </AppLayout>
  );
};

export default DailyCheck;
