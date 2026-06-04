import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Thermometer, Droplets, CheckCircle2, Clock, RotateCcw,
  List, ClipboardList, Filter, Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { api, type EnvCheckRecord, type LiveTempHum } from "@/lib/api";
import { ENV_ROOMS, evaluateEnv, type EnvRoom } from "@/lib/dailyCheckEnv";
import { useAuth } from "@/context/AuthContext";

interface EnvDraft {
  temperature: string;
  humidity: string;
  note: string;
  prefilledFrom?: string; // receivedAt ของค่าสดที่ pre-fill ไว้ (กันการ pre-fill ซ้ำ)
}

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
const emptyDraft = (): EnvDraft => ({ temperature: "", humidity: "", note: "" });

const EnvironmentCheckPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const todayLabel = new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });

  const [drafts, setDrafts] = useState<Record<string, EnvDraft>>({});

  const [filterDate, setFilterDate] = useState<string>(todayStr());
  const [filterRoom, setFilterRoom] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "pass" | "fail">("all");

  const { data: todayRecords = [] } = useQuery({
    queryKey: ["env-checks", "today"],
    queryFn: () => api.getEnvChecks({ date: todayStr() }),
    refetchOnWindowFocus: true,
  });

  const { data: liveReadings = [] } = useQuery({
    queryKey: ["temphum", "live"],
    queryFn: api.getLiveTempHum,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  const { data: historyRecords = [], isLoading: historyLoading } = useQuery({
    queryKey: ["env-checks", "history", filterDate, filterRoom, filterStatus],
    queryFn: () =>
      api.getEnvChecks({
        date: filterDate || todayStr(),
        room: filterRoom === "all" ? undefined : filterRoom,
        status: filterStatus === "all" ? undefined : filterStatus,
      }),
  });

  const liveByBoard = useMemo(() => {
    const map: Record<string, LiveTempHum> = {};
    for (const r of liveReadings) map[r.board] = r;
    return map;
  }, [liveReadings]);

  const latestByRoom = useMemo(() => {
    const map: Record<string, EnvCheckRecord> = {};
    for (const r of todayRecords) if (!map[r.room]) map[r.room] = r;
    return map;
  }, [todayRecords]);

  const liveForRoom = (room: EnvRoom): LiveTempHum | undefined =>
    room.boardId ? liveByBoard[room.boardId] : undefined;

  const getDraft = (room: EnvRoom): EnvDraft => {
    const existing = drafts[room.slug];
    if (existing) return existing;
    // pre-fill ครั้งแรกจากค่าสด (ถ้ามี)
    const live = liveForRoom(room);
    if (live && (live.temp != null || live.hum != null)) {
      return {
        temperature: live.temp != null ? String(live.temp) : "",
        humidity: live.hum != null ? String(live.hum) : "",
        note: "",
        prefilledFrom: live.receivedAt,
      };
    }
    return emptyDraft();
  };

  const setField = (slug: string, patch: Partial<EnvDraft>) =>
    setDrafts((prev) => ({ ...prev, [slug]: { ...(prev[slug] ?? emptyDraft()), ...patch } }));

  const pullLatest = (room: EnvRoom) => {
    const live = liveForRoom(room);
    if (!live) {
      toast.error("ยังไม่มีค่าจากเซนเซอร์");
      return;
    }
    setField(room.slug, {
      temperature: live.temp != null ? String(live.temp) : "",
      humidity: live.hum != null ? String(live.hum) : "",
      prefilledFrom: live.receivedAt,
    });
  };

  const createMutation = useMutation({
    mutationFn: api.createEnvCheck,
    onSuccess: (_data, vars) => {
      const room = ENV_ROOMS.find((r) => r.slug === vars.room)!;
      const pass = evaluateEnv(vars.temperature, vars.humidity, room).status === "pass";
      if (pass) toast.success(`${room.label} อยู่ในเกณฑ์`);
      else toast.warning(`${room.label} เกินเกณฑ์`);
      queryClient.invalidateQueries({ queryKey: ["env-checks"] });
      setDrafts((prev) => {
        const c = { ...prev };
        delete c[vars.room];
        return c;
      });
    },
    onError: (err: Error) => toast.error(err.message || "บันทึกไม่สำเร็จ"),
  });

  const handleSave = (room: EnvRoom) => {
    const d = getDraft(room);
    if (d.temperature === "" || d.humidity === "") {
      toast.error("กรุณากรอกอุณหภูมิและความชื้น");
      return;
    }
    const temperature = parseFloat(d.temperature);
    const humidity = parseFloat(d.humidity);
    if (isNaN(temperature) || isNaN(humidity)) {
      toast.error("ค่าอุณหภูมิ/ความชื้นไม่ถูกต้อง");
      return;
    }
    if (!user?.name) {
      toast.error("ไม่พบชื่อผู้ใช้งานปัจจุบัน");
      return;
    }
    createMutation.mutate({
      room: room.slug,
      roomName: room.label,
      temperature,
      humidity,
      tempMin: room.tempMin,
      tempMax: room.tempMax,
      humidityMax: room.humidityMax,
      note: d.note.trim(),
      recorder: user.name,
      recorderId: user.id,
      recorderEmail: user.email,
    });
  };

  const handleRecheck = (slug: string) =>
    setDrafts((prev) => ({ ...prev, [slug]: emptyDraft() }));

  const checkedCount = Object.keys(latestByRoom).length;
  const passCount = Object.values(latestByRoom).filter((r) => r.status === "pass").length;

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            อุณหภูมิ/ความชื้น — ตรวจประจำวัน
          </h2>
          <p className="text-sm text-muted-foreground">ประจำวัน — {todayLabel}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="outline" className="text-sm gap-1 py-1 px-3">
            <Clock className="w-3.5 h-3.5" /> ตรวจแล้ว {checkedCount}/{ENV_ROOMS.length}
          </Badge>
          <Badge className="text-sm gap-1 py-1 px-3 bg-green-100 text-green-700 border-green-300">
            <CheckCircle2 className="w-3.5 h-3.5" /> ผ่าน {passCount}/{ENV_ROOMS.length}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {ENV_ROOMS.map((room) => {
              const todayRec = latestByRoom[room.slug];
              const d = getDraft(room);
              const live = liveForRoom(room);
              const isCheckedToday = !!todayRec;
              const dirty = !!drafts[room.slug] && (drafts[room.slug].temperature !== "" || drafts[room.slug].humidity !== "");
              const showResult = isCheckedToday && !dirty;
              const allPass = todayRec?.status === "pass";

              const tNum = parseFloat(d.temperature);
              const hNum = parseFloat(d.humidity);
              const liveEval =
                !showResult && !isNaN(tNum) && !isNaN(hNum)
                  ? evaluateEnv(tNum, hNum, room)
                  : null;
              const outOfRange = liveEval?.status === "fail";

              return (
                <Card
                  key={room.slug}
                  className={`shadow-sm transition-all ${
                    showResult ? (allPass ? "border-green-200 bg-green-50/30" : "border-red-200 bg-red-50/30") : ""
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Thermometer className="w-4 h-4 text-primary" />
                        {room.label}
                      </CardTitle>
                      {showResult && todayRec && (
                        <Badge className={`text-xs gap-1 ${allPass ? "bg-green-100 text-green-700 border-green-300" : "bg-red-100 text-red-700 border-red-300"}`}>
                          {allPass ? <><CheckCircle2 className="w-3 h-3" /> ผ่าน</> : "ไม่ผ่าน"}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      เกณฑ์ {room.tempMin}–{room.tempMax}°C / ≤{room.humidityMax}%RH
                    </p>
                    {showResult && todayRec && (
                      <p className="text-xs text-muted-foreground">
                        ตรวจล่าสุด: {fmtTime(todayRec.checkedAt)} โดย {todayRec.recorder}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* แหล่งค่า */}
                    {!showResult && (
                      <div className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2.5 py-1.5">
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Radio className={`w-3.5 h-3.5 ${live ? "text-green-500" : "text-muted-foreground/50"}`} />
                          {live
                            ? `เซนเซอร์ • อัปเดต ${live.receivedAt ? fmtTime(live.receivedAt) : "-"}`
                            : "ไม่มีเซนเซอร์ — กรอกเอง"}
                        </span>
                        {live && (
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => pullLatest(room)}>
                            ดึงค่าล่าสุด
                          </Button>
                        )}
                      </div>
                    )}

                    {/* อุณหภูมิ */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                        <Thermometer className="w-3.5 h-3.5" /> อุณหภูมิ (°C)
                      </label>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder={showResult && todayRec ? String(todayRec.temperature) : "เช่น 22.5"}
                        value={d.temperature}
                        onChange={(e) => setField(room.slug, { temperature: e.target.value })}
                        disabled={createMutation.isPending}
                        className="text-sm h-9"
                      />
                    </div>

                    {/* ความชื้น */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                        <Droplets className="w-3.5 h-3.5" /> ความชื้น (%RH)
                      </label>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder={showResult && todayRec ? String(todayRec.humidity) : "เช่น 55"}
                        value={d.humidity}
                        onChange={(e) => setField(room.slug, { humidity: e.target.value })}
                        disabled={createMutation.isPending}
                        className="text-sm h-9"
                      />
                    </div>

                    {liveEval && (
                      <p className={`text-xs ${liveEval.status === "pass" ? "text-green-600" : "text-red-600"}`}>
                        {liveEval.status === "pass" ? "อยู่ในเกณฑ์" : "เกินเกณฑ์"}
                        {liveEval.tempStatus === "fail" ? " • อุณหภูมิ" : ""}
                        {liveEval.humidityStatus === "fail" ? " • ความชื้น" : ""}
                      </p>
                    )}

                    {/* หมายเหตุ (แนะนำเมื่อเกินเกณฑ์) */}
                    {!showResult && (
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">
                          หมายเหตุ {outOfRange && <span className="text-red-500">(ควรระบุการแก้ไขเมื่อเกินเกณฑ์)</span>}
                        </label>
                        <Textarea
                          rows={2}
                          placeholder="บันทึกเพิ่มเติม / การแก้ไข"
                          value={d.note}
                          onChange={(e) => setField(room.slug, { note: e.target.value })}
                          disabled={createMutation.isPending}
                          className="text-sm"
                        />
                      </div>
                    )}

                    {showResult && todayRec?.note && (
                      <p className="text-xs text-muted-foreground">หมายเหตุ: {todayRec.note}</p>
                    )}

                    {/* ผู้บันทึก */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">ผู้บันทึก</label>
                      <Input value={user?.name ?? ""} readOnly disabled className="text-xs h-8 bg-muted/40" />
                    </div>

                    {showResult ? (
                      <Button variant="outline" className="w-full gap-2" onClick={() => handleRecheck(room.slug)}>
                        <RotateCcw className="w-4 h-4" /> บันทึกซ้ำ
                      </Button>
                    ) : (
                      <Button
                        className="w-full gap-2"
                        onClick={() => handleSave(room)}
                        disabled={createMutation.isPending}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {createMutation.isPending && createMutation.variables?.room === room.slug ? "กำลังบันทึก..." : "บันทึกผล"}
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
                ประวัติการตรวจอุณหภูมิ/ความชื้น
              </CardTitle>
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Filter className="w-3 h-3" /> วันที่
                  </label>
                  <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="h-8 text-xs w-[160px]" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-muted-foreground">ห้อง</label>
                  <Select value={filterRoom} onValueChange={setFilterRoom}>
                    <SelectTrigger className="h-8 text-xs w-[160px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทั้งหมด</SelectItem>
                      {ENV_ROOMS.map((r) => (
                        <SelectItem key={r.slug} value={r.slug}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-muted-foreground">สถานะ</label>
                  <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as "all" | "pass" | "fail")}>
                    <SelectTrigger className="h-8 text-xs w-[120px]"><SelectValue /></SelectTrigger>
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
                  onClick={() => { setFilterDate(todayStr()); setFilterRoom("all"); setFilterStatus("all"); }}
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
                  <Table className="min-w-[760px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>วันที่</TableHead>
                        <TableHead>เวลา</TableHead>
                        <TableHead>ห้อง</TableHead>
                        <TableHead className="text-center">อุณหภูมิ (°C)</TableHead>
                        <TableHead className="text-center">ความชื้น (%RH)</TableHead>
                        <TableHead className="text-center">สถานะ</TableHead>
                        <TableHead>หมายเหตุ</TableHead>
                        <TableHead>ผู้บันทึก</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyRecords.map((h) => {
                        const allPass = h.status === "pass";
                        return (
                          <TableRow key={h._id}>
                            <TableCell className="text-xs whitespace-nowrap">{fmtDate(h.date)}</TableCell>
                            <TableCell className="text-xs whitespace-nowrap">{fmtTime(h.checkedAt)}</TableCell>
                            <TableCell className="font-medium whitespace-nowrap">{h.roomName}</TableCell>
                            <TableCell className={`text-center text-xs font-semibold ${h.tempStatus === "pass" ? "text-green-600" : "text-red-600"}`}>
                              {h.temperature}
                            </TableCell>
                            <TableCell className={`text-center text-xs font-semibold ${h.humidityStatus === "pass" ? "text-green-600" : "text-red-600"}`}>
                              {h.humidity}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className={`text-xs ${allPass ? "bg-green-100 text-green-700 border-green-300" : "bg-red-100 text-red-700 border-red-300"}`}>
                                {allPass ? "ผ่าน" : "ไม่ผ่าน"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs max-w-[180px] truncate">{h.note || "-"}</TableCell>
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
    </>
  );
};

export default EnvironmentCheckPage;
