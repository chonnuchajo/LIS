import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, AlertTriangle, RotateCcw, List, ClipboardList, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { api, type EquipmentCheckRecord, type EquipmentReading } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { getRoomCatalog } from "@/lib/roomEquipment";
import { getRoomBySlug } from "@/lib/dailyCheckRooms";

type StatusVal = "normal" | "abnormal" | "";

interface CheckDraft {
  status: StatusVal;
  readingValues: Record<string, string>; // reading.key -> input string
  note: string;
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

const emptyDraft = (): CheckDraft => ({ status: "", readingValues: {}, note: "" });

interface RoomEquipmentCheckPageProps {
  roomSlug: string;
}

const RoomEquipmentCheckPage = ({ roomSlug }: RoomEquipmentCheckPageProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const todayLabel = new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });

  const room = getRoomBySlug(roomSlug);
  const catalog = getRoomCatalog(roomSlug);

  const [drafts, setDrafts] = useState<Record<string, CheckDraft>>({});
  const [filterDate, setFilterDate] = useState<string>(todayStr());
  const [filterInstrument, setFilterInstrument] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "normal" | "abnormal">("all");

  const { data: todayRecords = [] } = useQuery({
    queryKey: ["equipment-checks", "today", roomSlug, todayStr()],
    queryFn: () => api.getEquipmentChecks({ room: roomSlug, date: todayStr() }),
    refetchOnWindowFocus: true,
    enabled: !!catalog,
  });

  const { data: historyRecords = [], isLoading: historyLoading } = useQuery({
    queryKey: ["equipment-checks", "history", roomSlug, filterDate, filterInstrument, filterStatus],
    queryFn: () =>
      api.getEquipmentChecks({
        room: roomSlug,
        date: filterDate || todayStr(),
        instrumentId: filterInstrument === "all" ? undefined : filterInstrument,
        status: filterStatus === "all" ? undefined : filterStatus,
      }),
    enabled: !!catalog,
  });

  // latest record per instrument for today.
  // GET /equipment-checks sorts checkedAt desc (newest-first), so first-wins keeps the latest.
  const latestByInstrument = useMemo(() => {
    const map: Record<string, EquipmentCheckRecord> = {};
    for (const r of todayRecords) {
      if (!map[r.instrumentId]) map[r.instrumentId] = r;
    }
    return map;
  }, [todayRecords]);

  const createMutation = useMutation({
    mutationFn: api.createEquipmentCheck,
    onSuccess: (_data, vars) => {
      if (vars.status === "normal") toast.success(`${vars.instrumentName} ใช้งานได้ปกติ`);
      else toast.warning(`${vars.instrumentName} ผิดปกติ — บันทึกแล้ว`);
      queryClient.invalidateQueries({ queryKey: ["equipment-checks"] });
      setDrafts((prev) => {
        const c = { ...prev };
        delete c[vars.instrumentId];
        return c;
      });
    },
    onError: (err: Error) => toast.error(err.message || "บันทึกไม่สำเร็จ"),
  });

  // all hooks above; safe to early-return now
  if (!room || !catalog) {
    return <p className="py-12 text-center text-sm text-muted-foreground">ไม่พบห้องที่ระบุ</p>;
  }

  const instruments = catalog.instruments;
  const groups = catalog.groups;
  const TOTAL = instruments.length;
  const RoomIcon = room.icon;

  const getDraft = (id: string): CheckDraft => drafts[id] || emptyDraft();

  const setStatus = (id: string, status: StatusVal) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...getDraft(id), status } }));

  const setReading = (id: string, key: string, value: string) =>
    setDrafts((prev) => {
      const d = getDraft(id);
      return { ...prev, [id]: { ...d, readingValues: { ...d.readingValues, [key]: value } } };
    });

  const setNote = (id: string, note: string) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...getDraft(id), note } }));

  const handleSave = (instrumentId: string) => {
    const instrument = instruments.find((i) => i.id === instrumentId)!;
    const d = getDraft(instrumentId);
    if (d.status !== "normal" && d.status !== "abnormal") {
      toast.error("กรุณาเลือกสถานะ (ปกติ / ผิดปกติ)");
      return;
    }
    if (!user?.name) {
      toast.error("ไม่พบชื่อผู้ใช้งานปัจจุบัน");
      return;
    }
    const readings: EquipmentReading[] = [];
    for (const f of instrument.readings) {
      const raw = d.readingValues[f.key];
      const value = parseFloat(raw);
      if (raw == null || raw === "" || Number.isNaN(value)) {
        toast.error(`กรุณากรอกค่า ${f.label} เป็นตัวเลข`);
        return;
      }
      readings.push({ key: f.key, label: f.label, value, unit: f.unit });
    }

    createMutation.mutate({
      roomSlug,
      instrumentId: instrument.id,
      instrumentName: instrument.name,
      brand: instrument.brand,
      status: d.status,
      readings,
      note: d.note,
      recorder: user.name,
      recorderId: user.id ?? "",
      recorderEmail: user.email ?? "",
    });
  };

  const handleRecheck = (id: string) =>
    setDrafts((prev) => ({ ...prev, [id]: emptyDraft() }));

  const checkedCount = Object.keys(latestByInstrument).length;
  const normalCount = Object.values(latestByInstrument).filter((r) => r.status === "normal").length;

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {room.label} — เช็กการทำงานเครื่องมือ
          </h2>
          <p className="text-sm text-muted-foreground">ประจำวัน — {todayLabel}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="outline" className="text-sm gap-1 py-1 px-3">
            <Clock className="w-3.5 h-3.5" /> ตรวจแล้ว {checkedCount}/{TOTAL}
          </Badge>
          <Badge className="text-sm gap-1 py-1 px-3 bg-green-100 text-green-700 border-green-300">
            <CheckCircle2 className="w-3.5 h-3.5" /> ปกติ {normalCount}/{TOTAL}
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

        <TabsContent value="check" className="space-y-6">
          {groups.map((group) => {
            const items = instruments.filter((i) => i.group === group.key);
            if (items.length === 0) return null;
            return (
              <div key={group.key} className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground">{group.label}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {items.map((instrument) => {
                    const todayRec = latestByInstrument[instrument.id];
                    const d = getDraft(instrument.id);
                    const isCheckedToday = !!todayRec;
                    const isDirty = !!drafts[instrument.id] &&
                      (d.status !== "" || d.note !== "" || Object.values(d.readingValues).some((v) => v !== ""));
                    const showResult = isCheckedToday && !isDirty;
                    const normal = todayRec?.status === "normal";

                    return (
                      <Card
                        key={instrument.id}
                        className={`shadow-sm transition-all ${
                          showResult ? (normal ? "border-green-200 bg-green-50/30" : "border-red-200 bg-red-50/30") : ""
                        }`}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                              <RoomIcon className="w-4 h-4 text-primary" />
                              {instrument.name}
                            </CardTitle>
                            {showResult && todayRec && (
                              <Badge className={`text-xs gap-1 ${normal ? "bg-green-100 text-green-700 border-green-300" : "bg-red-100 text-red-700 border-red-300"}`}>
                                {normal ? <><CheckCircle2 className="w-3 h-3" /> ปกติ</> : <><AlertTriangle className="w-3 h-3" /> ผิดปกติ</>}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {instrument.id}{instrument.brand ? ` · ${instrument.brand}` : ""}
                          </p>
                          {showResult && todayRec && (
                            <p className="text-xs text-muted-foreground">ตรวจล่าสุด: {fmtTime(todayRec.checkedAt)} โดย {todayRec.recorder}</p>
                          )}
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* status */}
                          <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">สถานะการทำงาน</label>
                            <div className="grid grid-cols-2 gap-1.5">
                              <Button
                                type="button"
                                variant={d.status === "normal" ? "default" : "outline"}
                                className="h-8 text-xs gap-1"
                                disabled={createMutation.isPending}
                                onClick={() => setStatus(instrument.id, "normal")}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" /> ปกติ
                              </Button>
                              <Button
                                type="button"
                                variant={d.status === "abnormal" ? "destructive" : "outline"}
                                className="h-8 text-xs gap-1"
                                disabled={createMutation.isPending}
                                onClick={() => setStatus(instrument.id, "abnormal")}
                              >
                                <AlertTriangle className="w-3.5 h-3.5" /> ผิดปกติ
                              </Button>
                            </div>
                          </div>

                          {/* readings */}
                          {instrument.readings.map((f) => (
                            <div key={f.key}>
                              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                                {f.label}{f.unit ? ` (${f.unit})` : ""}
                              </label>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder={showResult && todayRec ? String(todayRec.readings.find((r) => r.key === f.key)?.value ?? "") : f.label}
                                value={d.readingValues[f.key] ?? ""}
                                onChange={(e) => setReading(instrument.id, f.key, e.target.value)}
                                disabled={createMutation.isPending}
                                className="text-xs h-8"
                              />
                            </div>
                          ))}

                          {/* note */}
                          <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">หมายเหตุ</label>
                            <Input
                              value={d.note}
                              placeholder={showResult && todayRec?.note ? todayRec.note : "—"}
                              onChange={(e) => setNote(instrument.id, e.target.value)}
                              disabled={createMutation.isPending}
                              className="text-xs h-8"
                            />
                          </div>

                          {/* recorder */}
                          <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">ผู้บันทึก</label>
                            <Input value={user?.name ?? ""} readOnly disabled className="text-xs h-8 bg-muted/40" />
                          </div>

                          {showResult ? (
                            <Button variant="outline" className="w-full gap-2" onClick={() => handleRecheck(instrument.id)}>
                              <RotateCcw className="w-4 h-4" /> บันทึกซ้ำ
                            </Button>
                          ) : (
                            <Button
                              className="w-full gap-2"
                              onClick={() => handleSave(instrument.id)}
                              disabled={createMutation.isPending}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              {createMutation.isPending && createMutation.variables?.instrumentId === instrument.id ? "กำลังบันทึก..." : "บันทึกผล"}
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader className="space-y-3">
              <CardTitle className="text-base flex items-center gap-2">
                <List className="w-4 h-4 text-primary" />
                ประวัติการเช็กเครื่องมือ
              </CardTitle>

              <div className="flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Filter className="w-3 h-3" /> วันที่
                  </label>
                  <Input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="h-8 text-xs w-[160px]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-muted-foreground">เครื่องมือ</label>
                  <Select value={filterInstrument} onValueChange={setFilterInstrument}>
                    <SelectTrigger className="h-8 text-xs w-[200px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทั้งหมด</SelectItem>
                      {instruments.map((i) => (
                        <SelectItem key={i.id} value={i.id}>{i.name} ({i.id})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-muted-foreground">สถานะ</label>
                  <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as "all" | "normal" | "abnormal")}>
                    <SelectTrigger className="h-8 text-xs w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทั้งหมด</SelectItem>
                      <SelectItem value="normal">ปกติ</SelectItem>
                      <SelectItem value="abnormal">ผิดปกติ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    setFilterDate(todayStr());
                    setFilterInstrument("all");
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
                  <Table className="min-w-[760px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>วันที่</TableHead>
                        <TableHead>เวลา</TableHead>
                        <TableHead>เครื่องมือ</TableHead>
                        <TableHead className="text-center">สถานะ</TableHead>
                        <TableHead className="text-center">ค่าที่วัด</TableHead>
                        <TableHead>หมายเหตุ</TableHead>
                        <TableHead>ผู้บันทึก</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyRecords.map((h) => {
                        const normal = h.status === "normal";
                        return (
                          <TableRow key={h._id}>
                            <TableCell className="text-xs whitespace-nowrap">{fmtDate(h.date)}</TableCell>
                            <TableCell className="text-xs whitespace-nowrap">{fmtTime(h.checkedAt)}</TableCell>
                            <TableCell className="font-medium whitespace-nowrap">{h.instrumentName} <span className="text-muted-foreground">({h.instrumentId})</span></TableCell>
                            <TableCell className="text-center">
                              <Badge className={`text-xs ${normal ? "bg-green-100 text-green-700 border-green-300" : "bg-red-100 text-red-700 border-red-300"}`}>
                                {normal ? "ปกติ" : "ผิดปกติ"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center text-xs whitespace-nowrap">
                              {h.readings.length
                                ? h.readings.map((r) => `${r.label} ${r.value} ${r.unit}`).join(", ")
                                : "—"}
                            </TableCell>
                            <TableCell className="text-xs">{h.note || "—"}</TableCell>
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

export default RoomEquipmentCheckPage;
