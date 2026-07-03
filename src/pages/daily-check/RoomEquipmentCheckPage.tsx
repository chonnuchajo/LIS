import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FlaskConical,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import { toast } from "sonner";

import ChemicalRequisitionDialog from "@/components/lis/daily-check/ChemicalRequisitionDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { ANALYSIS_ROOM_SLUG } from "@/lib/analysisInstruments";
import {
  groupRequisitionsByInstrument,
  todayStr as reqTodayStr,
} from "@/lib/chemicalRequisition";
import { getRoomBySlug } from "@/lib/dailyCheckRooms";
import { api, type EquipmentCheckRecord, type EquipmentReading } from "@/lib/api";
import { getRoomCatalog } from "@/lib/roomEquipment";

type StatusVal = "normal" | "abnormal" | "";

interface CheckDraft {
  status: StatusVal;
  readingValues: Record<string, string>;
  note: string;
}

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

const emptyDraft = (): CheckDraft => ({ status: "", readingValues: {}, note: "" });

interface RoomEquipmentCheckPageProps {
  roomSlug: string;
}

const RoomEquipmentCheckPage = ({ roomSlug }: RoomEquipmentCheckPageProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const todayLabel = new Date().toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const room = getRoomBySlug(roomSlug);
  const catalog = getRoomCatalog(roomSlug);
  const [drafts, setDrafts] = useState<Record<string, CheckDraft>>({});
  const [reqDialog, setReqDialog] = useState<{ open: boolean; presetInstrumentId?: string }>({
    open: false,
  });

  const { data: todayRecords = [] } = useQuery({
    queryKey: ["equipment-checks", "today", roomSlug, todayStr()],
    queryFn: () => api.getEquipmentChecks({ room: roomSlug, date: todayStr() }),
    refetchOnWindowFocus: true,
    enabled: !!catalog,
  });

  const latestByInstrument = useMemo(() => {
    const map: Record<string, EquipmentCheckRecord> = {};
    for (const row of todayRecords) {
      if (!map[row.instrumentId]) map[row.instrumentId] = row;
    }
    return map;
  }, [todayRecords]);

  const createMutation = useMutation({
    mutationFn: api.createEquipmentCheck,
    onSuccess: (_data, vars) => {
      if (vars.status === "normal") toast.success(`${vars.instrumentName} ใช้งานได้ปกติ`);
      else toast.warning(`${vars.instrumentName} ผิดปกติ - บันทึกแล้ว`);
      queryClient.invalidateQueries({ queryKey: ["equipment-checks"] });
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[vars.instrumentId];
        return next;
      });
    },
    onError: (err: Error) => toast.error(err.message || "บันทึกไม่สำเร็จ"),
  });

  const isAnalysis = roomSlug === ANALYSIS_ROOM_SLUG;

  const { data: requisitions = [] } = useQuery({
    queryKey: ["chemical-requisitions", roomSlug, reqTodayStr()],
    queryFn: () => api.getChemicalRequisitions({ room: roomSlug, date: reqTodayStr() }),
    enabled: isAnalysis,
    refetchOnWindowFocus: true,
  });

  const reqByInstrument = useMemo(
    () => groupRequisitionsByInstrument(requisitions),
    [requisitions],
  );

  const deleteReqMutation = useMutation({
    mutationFn: (id: string) => api.deleteChemicalRequisition(id),
    onSuccess: () => {
      toast.success("ยกเลิกการเบิกแล้ว (คืนสต็อก)");
      queryClient.invalidateQueries({ queryKey: ["chemical-requisitions"] });
      queryClient.invalidateQueries({ queryKey: ["stock", "solvents"] });
      queryClient.invalidateQueries({ queryKey: ["stock", "transactions"] });
    },
    onError: (err: Error) => toast.error(err.message || "ยกเลิกไม่สำเร็จ"),
  });

  const onReqSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["chemical-requisitions"] });
    queryClient.invalidateQueries({ queryKey: ["stock", "solvents"] });
    queryClient.invalidateQueries({ queryKey: ["stock", "transactions"] });
  };

  if (!room || !catalog) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        ไม่พบห้องที่ระบุ
      </p>
    );
  }

  const instruments = catalog.instruments;
  const groups = catalog.groups;
  const total = instruments.length;
  const RoomIcon = room.icon;

  const getDraft = (id: string): CheckDraft => drafts[id] || emptyDraft();

  const setStatus = (id: string, status: StatusVal) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...getDraft(id), status } }));

  const setReading = (id: string, key: string, value: string) =>
    setDrafts((prev) => {
      const draft = getDraft(id);
      return {
        ...prev,
        [id]: { ...draft, readingValues: { ...draft.readingValues, [key]: value } },
      };
    });

  const setNote = (id: string, note: string) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...getDraft(id), note } }));

  const handleSave = (instrumentId: string) => {
    const instrument = instruments.find((row) => row.id === instrumentId);
    if (!instrument) return;

    const draft = getDraft(instrumentId);
    if (draft.status !== "normal" && draft.status !== "abnormal") {
      toast.error("กรุณาเลือกสถานะ (ปกติ / ผิดปกติ)");
      return;
    }
    if (!user?.name) {
      toast.error("ไม่พบชื่อผู้ใช้งานปัจจุบัน");
      return;
    }

    const readings: EquipmentReading[] = [];
    for (const field of instrument.readings) {
      const raw = draft.readingValues[field.key];
      const value = parseFloat(raw);
      if (raw == null || raw === "" || Number.isNaN(value)) {
        toast.error(`กรุณากรอกค่า ${field.label} เป็นตัวเลข`);
        return;
      }
      readings.push({ key: field.key, label: field.label, value, unit: field.unit });
    }

    createMutation.mutate({
      roomSlug,
      instrumentId: instrument.id,
      instrumentName: instrument.name,
      brand: instrument.brand,
      status: draft.status,
      readings,
      note: draft.note,
      recorder: user.name,
      recorderId: user.id ?? "",
      recorderEmail: user.email ?? "",
    });
  };

  const handleRecheck = (id: string) =>
    setDrafts((prev) => ({ ...prev, [id]: emptyDraft() }));

  const checkedCount = Object.keys(latestByInstrument).length;
  const normalCount = Object.values(latestByInstrument).filter((row) => row.status === "normal").length;

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {room.label} - เช็กการทำงานเครื่องมือ
          </h2>
          <p className="text-sm text-muted-foreground">ประจำวัน - {todayLabel}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="outline" className="gap-1 px-3 py-1 text-sm">
            <Clock className="h-3.5 w-3.5" /> ตรวจแล้ว {checkedCount}/{total}
          </Badge>
          <Badge className="gap-1 border-green-300 bg-green-100 px-3 py-1 text-sm text-green-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> ปกติ {normalCount}/{total}
          </Badge>
        </div>
      </div>

      {isAnalysis && (
        <Card className="mb-6 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FlaskConical className="h-4 w-4 text-primary" />
              เบิกสารเคมีวันนี้
            </CardTitle>
            <Button size="sm" onClick={() => setReqDialog({ open: true })}>
              <Plus className="mr-1 h-4 w-4" />
              เบิกสารเคมี
            </Button>
          </CardHeader>
          <CardContent>
            {requisitions.length === 0 ? (
              <p className="text-sm text-muted-foreground">ยังไม่มีการเบิกวันนี้</p>
            ) : (
              <ul className="divide-y">
                {requisitions.map((req) => (
                  <li key={req._id} className="flex items-center gap-2 py-1.5 text-sm">
                    <span className="w-12 text-xs tabular-nums text-muted-foreground">
                      {req.createdAt ? fmtTime(req.createdAt) : ""}
                    </span>
                    <span className="font-medium">{req.solventName}</span>
                    <span className="text-muted-foreground">x {req.qty} ขวด</span>
                    <span className="text-muted-foreground">to {req.instrumentName}</span>
                    {req.requestedBy?.name && (
                      <span className="text-xs text-muted-foreground">
                        by {req.requestedBy.name}
                      </span>
                    )}
                    <button
                      type="button"
                      className="ml-auto text-muted-foreground hover:text-destructive"
                      title="ยกเลิกการเบิก (คืนสต็อก)"
                      disabled={deleteReqMutation.isPending}
                      onClick={() => {
                        if (window.confirm(`ยกเลิกการเบิก ${req.solventName} x ${req.qty} ขวด และคืนสต็อก?`)) {
                          deleteReqMutation.mutate(req._id);
                        }
                      }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        {groups.map((group) => {
          const items = instruments.filter((instrument) => instrument.group === group.key);
          if (items.length === 0) return null;

          return (
            <div key={group.key} className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">{group.label}</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((instrument) => {
                  const todayRec = latestByInstrument[instrument.id];
                  const draft = getDraft(instrument.id);
                  const isCheckedToday = Boolean(todayRec);
                  const isDirty = Boolean(drafts[instrument.id]) && (
                    draft.status !== "" ||
                    draft.note !== "" ||
                    Object.values(draft.readingValues).some((value) => value !== "")
                  );
                  const showResult = isCheckedToday && !isDirty;
                  const normal = todayRec?.status === "normal";

                  return (
                    <Card
                      key={instrument.id}
                      className={`shadow-sm transition-all ${
                        showResult
                          ? normal
                            ? "border-green-200 bg-green-50/30"
                            : "border-red-200 bg-red-50/30"
                          : ""
                      }`}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <RoomIcon className="h-4 w-4 text-primary" />
                            {instrument.name}
                          </CardTitle>
                          {showResult && todayRec && (
                            <Badge
                              className={`gap-1 text-xs ${
                                normal
                                  ? "border-green-300 bg-green-100 text-green-700"
                                  : "border-red-300 bg-red-100 text-red-700"
                              }`}
                            >
                              {normal ? (
                                <>
                                  <CheckCircle2 className="h-3 w-3" /> ปกติ
                                </>
                              ) : (
                                <>
                                  <AlertTriangle className="h-3 w-3" /> ผิดปกติ
                                </>
                              )}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {instrument.id}
                          {instrument.brand ? ` · ${instrument.brand}` : ""}
                        </p>
                        {showResult && todayRec && (
                          <p className="text-xs text-muted-foreground">
                            ตรวจล่าสุด: {fmtTime(todayRec.checkedAt)} โดย {todayRec.recorder}
                          </p>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-muted-foreground">
                            สถานะการทำงาน
                          </label>
                          <div className="grid grid-cols-2 gap-1.5">
                            <Button
                              type="button"
                              variant={draft.status === "normal" ? "default" : "outline"}
                              className="h-8 gap-1 text-xs"
                              disabled={createMutation.isPending}
                              onClick={() => setStatus(instrument.id, "normal")}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> ปกติ
                            </Button>
                            <Button
                              type="button"
                              variant={draft.status === "abnormal" ? "destructive" : "outline"}
                              className="h-8 gap-1 text-xs"
                              disabled={createMutation.isPending}
                              onClick={() => setStatus(instrument.id, "abnormal")}
                            >
                              <AlertTriangle className="h-3.5 w-3.5" /> ผิดปกติ
                            </Button>
                          </div>
                        </div>

                        {instrument.readings.map((field) => (
                          <div key={field.key}>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">
                              {field.label}
                              {field.unit ? ` (${field.unit})` : ""}
                            </label>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder={
                                showResult && todayRec
                                  ? String(todayRec.readings.find((row) => row.key === field.key)?.value ?? "")
                                  : field.label
                              }
                              value={draft.readingValues[field.key] ?? ""}
                              onChange={(e) => setReading(instrument.id, field.key, e.target.value)}
                              disabled={createMutation.isPending}
                              className="h-8 text-xs"
                            />
                          </div>
                        ))}

                        <div>
                          <label className="mb-1 block text-xs font-medium text-muted-foreground">
                            หมายเหตุ
                          </label>
                          <Input
                            value={draft.note}
                            placeholder={showResult && todayRec?.note ? todayRec.note : "-"}
                            onChange={(e) => setNote(instrument.id, e.target.value)}
                            disabled={createMutation.isPending}
                            className="h-8 text-xs"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-medium text-muted-foreground">
                            ผู้บันทึก
                          </label>
                          <Input value={user?.name ?? ""} readOnly disabled className="h-8 bg-muted/40 text-xs" />
                        </div>

                        {isAnalysis && (
                          <div className="border-t pt-3">
                            <div className="mb-1.5 flex items-center justify-between">
                              <span className="text-xs font-medium text-muted-foreground">
                                สารเคมีที่เบิกวันนี้
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 gap-1 text-xs"
                                onClick={() => setReqDialog({ open: true, presetInstrumentId: instrument.id })}
                              >
                                <Plus className="h-3.5 w-3.5" />
                                เบิกให้เครื่องนี้
                              </Button>
                            </div>
                            {(reqByInstrument[instrument.id] ?? []).length === 0 ? (
                              <p className="text-xs text-muted-foreground/70">-</p>
                            ) : (
                              <ul className="space-y-0.5">
                                {(reqByInstrument[instrument.id] ?? []).map((req) => (
                                  <li key={req._id} className="text-xs text-muted-foreground">
                                    {req.solventName} x {req.qty} ขวด
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}

                        {showResult ? (
                          <Button
                            variant="outline"
                            className="w-full gap-2"
                            onClick={() => handleRecheck(instrument.id)}
                          >
                            <RotateCcw className="h-4 w-4" /> บันทึกซ้ำ
                          </Button>
                        ) : (
                          <Button
                            className="w-full gap-2"
                            onClick={() => handleSave(instrument.id)}
                            disabled={createMutation.isPending}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            {createMutation.isPending && createMutation.variables?.instrumentId === instrument.id
                              ? "กำลังบันทึก..."
                              : "บันทึกผล"}
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
      </div>

      {reqDialog.open && (
        <ChemicalRequisitionDialog
          roomSlug={roomSlug}
          instruments={instruments.map((instrument) => ({
            id: instrument.id,
            name: instrument.name,
          }))}
          presetInstrumentId={reqDialog.presetInstrumentId}
          onClose={() => setReqDialog({ open: false })}
          onSaved={onReqSaved}
        />
      )}
    </>
  );
};

export default RoomEquipmentCheckPage;
