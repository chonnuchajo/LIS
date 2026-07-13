import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Activity, CalendarClock, ChevronDown, ChevronUp, FileCheck2, FileText, ImageIcon, ListTodo, Printer, RefreshCw, UserRound } from "lucide-react";
import AppLayout from "@/components/lis/AppLayout";
import PageHeader from "@/components/lis/PageHeader";
import PrintPreviewDialog from "@/components/lis/PrintPreviewDialog";
import PetitionPrintTemplate from "@/components/petition/PetitionPrintTemplate";
import ResultReportPrintTemplate from "@/components/petition/ResultReportPrintTemplate";
import SampleLabelPrintTemplate from "@/components/petition/SampleLabelPrintTemplate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useItemGroupMembership } from "@/hooks/useItemGroupMembership";
import { useLabRequestsByPetition, usePetition, usePetitionAuditLog } from "@/hooks/usePetition";
import { api, type ParameterItem, type QCProgressEntry } from "@/lib/api";
import { findSgParameter } from "@/lib/formSpecificGravity";
import { buildTimelineDetailModel } from "@/lib/petitionTimelineDetail";
import { canPrintPreReport } from "@/lib/petitionPrintability";
import { canSeePetition, isLabRole, petitionHasLabReadableItem } from "@/lib/petitionVisibility";
import { normalizeRoles } from "@/lib/roles";
import { petitionStatusBadge } from "@/lib/statusBadge";
import { cn } from "@/lib/utils";

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

function timelinePercent(value: string | null, startAt: string, endAt: string): number | null {
  if (!value) return null;
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  const at = new Date(value).getTime();
  if ([start, end, at].some(Number.isNaN) || end <= start) return null;
  return Math.max(0, Math.min(100, ((at - start) / (end - start)) * 100));
}

function taskStateLabel(state: "pending" | "inProgress" | "recorded" | "approved") {
  if (state === "approved") return "อนุมัติแล้ว";
  if (state === "recorded") return "บันทึกครบ";
  if (state === "inProgress") return "กำลังบันทึก";
  return "รอดำเนินการ";
}

function taskStateClass(state: "pending" | "inProgress" | "recorded" | "approved") {
  if (state === "approved") return "bg-green-100 text-green-700";
  if (state === "recorded") return "bg-blue-100 text-blue-700";
  if (state === "inProgress") return "bg-amber-100 text-amber-700";
  return "bg-grey-100 text-grey-700";
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="min-w-0 border-l border-black-50 pl-4 first:border-l-0 first:pl-0"><p className="text-xs text-grey-500">{label}</p><p className="mt-1 truncate text-sm font-semibold text-black-500">{value}</p>{hint && <p className="mt-1 text-xs text-grey-500">{hint}</p>}</div>;
}

export default function PetitionTimelineDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const groupMembership = useItemGroupMembership();
  const { data: petition, loading, error, refresh } = usePetition(id);
  const { data: auditLogs, loading: activityLoading, error: activityError, refresh: refreshActivity } = usePetitionAuditLog(petition?._id, 0);
  const { data: labRequests } = useLabRequestsByPetition(petition?._id);
  const [parameters, setParameters] = useState<ParameterItem[]>([]);
  const [progressEntries, setProgressEntries] = useState<QCProgressEntry[]>([]);
  const [parametersLoaded, setParametersLoaded] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [taskReloadKey, setTaskReloadKey] = useState(0);
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [qcResults, setQcResults] = useState<import("@/types/petition.types").QCTestResult[]>([]);
  const [documentLoading, setDocumentLoading] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [documentDataLoaded, setDocumentDataLoaded] = useState(false);
  const [labelPrintOpen, setLabelPrintOpen] = useState(false);
  const [servicePrintOpen, setServicePrintOpen] = useState(false);
  const [preReportOpen, setPreReportOpen] = useState(false);
  const [finalReportOpen, setFinalReportOpen] = useState(false);
  const documentLoadVersion = useRef(0);
  const roles = normalizeRoles(user);
  const isAdmin = roles.includes("admin");
  const isLabUser = roles.some(isLabRole);

  useEffect(() => {
    if (!petition?._id) {
      setParameters([]);
      setProgressEntries([]);
      setParametersLoaded(false);
      return;
    }
    let alive = true;
    setParametersLoaded(false);
    setTaskError(null);
    setParameters([]);
    setProgressEntries([]);
    Promise.all([api.getParameters(), api.getQCProgress([petition._id])])
      .then(([nextParameters, progress]) => {
        if (!alive) return;
        setParameters(nextParameters ?? []);
        setProgressEntries(progress[petition._id] ?? []);
      })
      .catch((loadError: Error) => {
        if (alive) setTaskError(loadError.message || "โหลดข้อมูลงานไม่สำเร็จ");
      })
      .finally(() => {
        if (alive) setParametersLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [petition?._id, taskReloadKey]);

  useEffect(() => {
    documentLoadVersion.current += 1;
    setQcResults([]);
    setDocumentLoading(false);
    setDocumentError(null);
    setDocumentDataLoaded(false);
    setLabelPrintOpen(false);
    setServicePrintOpen(false);
    setPreReportOpen(false);
    setFinalReportOpen(false);
  }, [id]);

  const visibleParameters = useMemo(
    () => isLabUser
      ? parameters.filter((parameter) => parameter.scope === "lab" || (parameter.scope === "qc" && parameter.shareWithLab === true))
      : parameters,
    [isLabUser, parameters],
  );

  const canViewPetition = useMemo(() => {
    if (!petition || !parametersLoaded) return false;
    if (isAdmin) return true;
    if (!canSeePetition(petition, user)) return false;
    return !isLabUser || petitionHasLabReadableItem(petition, visibleParameters, groupMembership);
  }, [groupMembership, isAdmin, isLabUser, parametersLoaded, petition, user, visibleParameters]);

  const model = useMemo(
    () => petition && canViewPetition
      ? buildTimelineDetailModel({ petition, parameters: visibleParameters, progressEntries, auditLogs, itemGroupIds: groupMembership })
      : null,
    [auditLogs, canViewPetition, groupMembership, petition, progressEntries, visibleParameters],
  );

  if (loading || (petition && !parametersLoaded)) {
    return <AppLayout><div className="rounded-[8px] border border-dashed border-grey-200 py-12 text-center text-sm text-grey-500">กำลังโหลดข้อมูล Timeline...</div></AppLayout>;
  }

  if (error || !petition) {
    return <AppLayout><div className="flex items-center justify-between gap-3 rounded-[8px] border border-red-200 bg-red-50 p-4 text-sm text-red-600"><span>โหลด Timeline ไม่สำเร็จ: {error ?? "ไม่พบคำร้อง"}</span><Button variant="danger-outline" size="sm" onClick={refresh}><RefreshCw className="h-4 w-4" />ลองใหม่</Button></div></AppLayout>;
  }

  if (!canViewPetition || !model) {
    return <AppLayout><div className="rounded-[8px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">คุณไม่มีสิทธิ์ดูข้อมูล Timeline ของคำร้องนี้</div></AppLayout>;
  }

  const statusBadge = petitionStatusBadge(petition);
  const activities = showAllActivities ? model.activities : model.activities.slice(0, 5);
  const progressLabel = model.progress.percent == null ? "-" : `${model.progress.percent}%`;
  const sgParameter = findSgParameter(parameters);
  const canShowPreReport = canPrintPreReport(petition)
    && model.progress.total > 0
    && model.progress.filled >= model.progress.total;

  async function loadDocumentData(): Promise<boolean> {
    if (documentDataLoaded) return true;
    if (documentLoading) return false;
    const loadVersion = documentLoadVersion.current;
    setDocumentLoading(true);
    setDocumentError(null);
    try {
      const results = await api.getQCResults(petition._id);
      if (documentLoadVersion.current !== loadVersion) return false;
      setQcResults(results);
      setDocumentDataLoaded(true);
      return true;
    } catch (loadError) {
      if (documentLoadVersion.current !== loadVersion) return false;
      setDocumentError(loadError instanceof Error ? loadError.message : "โหลดข้อมูลเอกสารไม่สำเร็จ");
      return false;
    } finally {
      if (documentLoadVersion.current === loadVersion) setDocumentLoading(false);
    }
  }

  const refreshTasks = () => setTaskReloadKey((value) => value + 1);

  function refreshTimeline() {
    refresh();
    refreshActivity();
    refreshTasks();
  }

  async function openDocument(setOpen: (open: boolean) => void) {
    if (await loadDocumentData()) setOpen(true);
  }

  return <AppLayout title={`Timeline ${petition.petitionNo}`}><div className="space-y-4">
    <PageHeader title={petition.petitionNo} onBack={() => navigate("/petition-timeline")} actions={<Button variant="primary-outline" size="sm" onClick={refreshTimeline}><RefreshCw className="h-4 w-4" />รีเฟรช</Button>} />

    <Card className="border-black-50 shadow-none"><CardContent className="grid gap-5 p-5 xl:grid-cols-[112px_minmax(0,1fr)]">
      <div className="flex aspect-square items-center justify-center rounded-[8px] border border-dashed border-grey-300 bg-grey-50 text-grey-400" aria-label="พื้นที่รูปตัวอย่าง"><ImageIcon className="h-8 w-8" /></div>
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2"><Badge variant={statusBadge.variant}>{statusBadge.label}</Badge></div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label="ผู้ยื่นคำร้อง" value={petition.submittedBy?.name || "-"} />
          <Metric label="ผู้รับงาน" value={petition.assignedTo?.name || "ยังไม่มอบหมาย"} />
          <Metric label={model.header.startKind === "received" ? "Start time" : "เวลายื่นคำร้อง"} value={formatDateTime(model.header.startAt)} />
          <Metric label="End time" value={formatDateTime(model.header.endAt)} hint={model.header.endKind === "actual" ? "เวลาจริง" : model.header.endKind === "estimated" ? "ค่าประมาณ" : "กำลังดำเนินการ"} />
          <Metric label="Progress" value={progressLabel} hint={model.progress.total ? `${model.progress.filled}/${model.progress.total} required fields` : "ไม่มี required parameter"} />
        </div>
        {model.progress.percent != null && <div className="h-2 overflow-hidden rounded-full bg-grey-100"><div className="h-full bg-primary-500 transition-[width]" style={{ width: `${model.progress.percent}%` }} /></div>}
      </div>
    </CardContent></Card>

    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <Card aria-label="Project Timeline" className="border-black-50 shadow-none"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="h-4 w-4 text-primary-500" />Project Timeline</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><div className="min-w-[760px] space-y-3"><div className="relative ml-36 h-9 border-b border-black-50 text-xs text-grey-500">{model.timeline.ticks.map((tick) => { const left = timelinePercent(tick.at, model.timeline.startAt, model.timeline.endAt); return left == null ? null : <div key={tick.key} className="absolute top-0 h-full border-l border-grey-200" style={{ left: `${left}%` }}><span className="ml-1 whitespace-nowrap">{tick.label}</span></div>; })}</div>
          {model.timeline.stages.map((stage) => { const progress = timelinePercent(stage.at, model.timeline.startAt, model.timeline.endAt); return <div key={stage.key} className="grid grid-cols-[144px_minmax(0,1fr)] items-center gap-3"><span className="text-sm text-grey-700">{stage.label}</span><div className="relative h-6 rounded bg-grey-50">{progress != null && <><div className={cn("absolute left-0 top-2 h-2 rounded-full", stage.done ? "bg-primary-400" : "bg-grey-200")} style={{ width: `${progress}%` }} /><span className={cn("absolute top-1 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-white", stage.done ? "bg-primary-600" : "bg-grey-300")} style={{ left: `${progress}%` }} /></>}</div></div>; })}
        </div></div></CardContent></Card>

        <Card aria-label="Tasks" className="border-black-50 shadow-none"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><ListTodo className="h-4 w-4 text-primary-500" />Tasks</CardTitle></CardHeader><CardContent className="space-y-3">
          {taskError ? <div className="flex items-center justify-between gap-3 rounded-[8px] border border-red-200 bg-red-50 p-3 text-sm text-red-600"><span>โหลดข้อมูลงานไม่สำเร็จ: {taskError}</span><Button variant="danger-outline" size="sm" onClick={refreshTasks}>ลองใหม่</Button></div> : model.tasks.length === 0 ? <p className="py-4 text-center text-sm text-grey-500">ไม่มี parameter ที่ require สำหรับคำร้องนี้</p> : model.tasks.map((task) => <div key={task.key} className="grid gap-2 border-b border-black-50 pb-3 last:border-b-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_110px_100px]"><div className="min-w-0"><p className="truncate text-sm font-medium text-black-500">{task.parameterName}</p><p className="mt-1 text-xs text-grey-500">{task.sampleName}</p></div><div className="self-center"><div className="h-2 overflow-hidden rounded-full bg-grey-100"><div className="h-full bg-primary-500" style={{ width: `${(task.filled / task.total) * 100}%` }} /></div><p className="mt-1 text-xs text-grey-500">{task.filled}/{task.total}</p></div><span className={cn("self-center justify-self-start rounded px-2 py-1 text-xs font-medium", taskStateClass(task.state))}>{taskStateLabel(task.state)}</span></div>)}
        </CardContent></Card>
      </div>

      <div className="space-y-4">
      <Card aria-label="Recent Activity" className="border-black-50 shadow-none"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4 text-primary-500" />Recent Activity</CardTitle></CardHeader><CardContent className="space-y-3">
        {activityError ? <div className="space-y-2 rounded-[8px] border border-red-200 bg-red-50 p-3 text-sm text-red-600"><p>โหลดกิจกรรมไม่สำเร็จ: {activityError}</p><Button variant="danger-outline" size="sm" onClick={refreshActivity}>ลองใหม่</Button></div> : activityLoading ? <p className="py-4 text-center text-sm text-grey-500">กำลังโหลดกิจกรรม...</p> : activities.length === 0 ? <p className="py-4 text-center text-sm text-grey-500">ยังไม่มีกิจกรรมของคำร้องนี้</p> : <div className="space-y-3">{activities.map((activity) => <div key={activity.key} className="border-b border-black-50 pb-3 last:border-b-0 last:pb-0"><p className="text-sm font-medium text-black-500">{activity.label}</p><div className="mt-1 flex items-center gap-2 text-xs text-grey-500"><UserRound className="h-3.5 w-3.5" /><span>{activity.actor || "ระบบ"}</span><span>{formatDateTime(activity.at)}</span></div></div>)}</div>}
        {model.activities.length > 5 && !activityError && <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowAllActivities((value) => !value)}>{showAllActivities ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}{showAllActivities ? "แสดงน้อยลง" : "ดูทั้งหมด"}</Button>}
      </CardContent></Card>

      <Card aria-label="Documents" className="border-black-50 shadow-none"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4 text-primary-500" />Documents</CardTitle></CardHeader><CardContent className="space-y-2">
        <Button variant="primary-outline" className="w-full justify-start" disabled={documentLoading} onClick={() => { void openDocument(setLabelPrintOpen); }}><Printer className="h-4 w-4" />พิมพ์ฉลาก</Button>
        {(labRequests?.length ?? 0) > 0 && <Button variant="primary-outline" className="w-full justify-start" disabled={documentLoading} onClick={() => { void openDocument(setServicePrintOpen); }}><FileText className="h-4 w-4" />พิมพ์ใบคำขอรับบริการ</Button>}
        {canShowPreReport && <Button variant="primary-outline" className="w-full justify-start" disabled={documentLoading} onClick={() => { void openDocument(setPreReportOpen); }}><FileText className="h-4 w-4" />Pre Report</Button>}
        {petition.status === "approved" && <Button variant="primary-outline" className="w-full justify-start" disabled={documentLoading} onClick={() => { void openDocument(setFinalReportOpen); }}><FileCheck2 className="h-4 w-4" />Final Report</Button>}
        {documentLoading && <p className="text-xs text-grey-500">กำลังโหลดข้อมูลเอกสาร...</p>}
        {documentError && <p className="text-xs text-red-600">โหลดข้อมูลเอกสารไม่สำเร็จ: {documentError}</p>}
      </CardContent></Card>
      </div>
    </div>

    {labelPrintOpen && <PrintPreviewDialog open={labelPrintOpen} onOpenChange={setLabelPrintOpen} docType="sample-label"><SampleLabelPrintTemplate petition={petition} /></PrintPreviewDialog>}
    {servicePrintOpen && labRequests?.[0] && <PrintPreviewDialog open={servicePrintOpen} onOpenChange={setServicePrintOpen} docType="service-request"><PetitionPrintTemplate labRequest={labRequests[0]} petition={petition} qcResults={qcResults} sgParam={sgParameter} /></PrintPreviewDialog>}
    {preReportOpen && <PrintPreviewDialog open={preReportOpen} onOpenChange={setPreReportOpen} docType="coa"><ResultReportPrintTemplate kind="pre" petition={petition} labRequests={labRequests ?? []} qcResults={qcResults} /></PrintPreviewDialog>}
    {finalReportOpen && <PrintPreviewDialog open={finalReportOpen} onOpenChange={setFinalReportOpen} docType="coa"><ResultReportPrintTemplate kind="final" petition={petition} labRequests={labRequests ?? []} qcResults={qcResults} /></PrintPreviewDialog>}
  </div></AppLayout>;
}
