import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { flushSync } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Activity, CalendarClock, ChevronDown, ChevronUp, Download, FileCheck2, FileText, ImageIcon, ListTodo, RefreshCw, UserRound } from "lucide-react";
import AppLayout from "@/components/lis/AppLayout";
import PageHeader from "@/components/lis/PageHeader";
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
import { openPrintPdf } from "@/lib/print";
import type { PrintDocType } from "@/lib/printConfig";
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

function barTrackClass(track: "qc" | "lab" | "stage", done: boolean) {
  if (!done) return "bg-grey-200";
  if (track === "lab") return "bg-amber-500";
  if (track === "qc") return "bg-primary-500";
  return "bg-grey-400";
}

function timelineTickVisibilityClass(index: number, total: number) {
  if (total <= 7) return "";
  const compactVisible = index === 0 || index === total - 1 || (index % 2 === 0 && index < total - 2);
  return compactVisible ? "" : "hidden 2xl:block";
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="min-w-0 border-l border-black-50 pl-4 first:border-l-0 first:pl-0"><p className="text-xs text-grey-500">{label}</p><p className="mt-1 truncate text-sm font-semibold text-black-500" title={value}>{value}</p>{hint && <p className="mt-1 text-xs text-grey-500">{hint}</p>}</div>;
}

function summarizeItemValues<T>(items: T[], pickValue: (item: T) => string | null | undefined): string {
  const values = Array.from(new Set(
    items
      .map((item) => pickValue(item)?.trim())
      .filter((value): value is string => !!value),
  ));
  return values.length ? values.join(", ") : "-";
}

type TimelineDocumentKey = "sample-label" | "service-request" | "pre-report" | "final-report";

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
  const [pdfLoadingDoc, setPdfLoadingDoc] = useState<TimelineDocumentKey | null>(null);
  const [activeTimelineDayKey, setActiveTimelineDayKey] = useState<string | null>(null);
  const labelDocumentRef = useRef<HTMLDivElement>(null);
  const serviceDocumentRef = useRef<HTMLDivElement>(null);
  const preReportDocumentRef = useRef<HTMLDivElement>(null);
  const finalReportDocumentRef = useRef<HTMLDivElement>(null);
  const documentLoadVersion = useRef(0);
  const documentLoadState = useRef<{ loaded: boolean; promise: Promise<boolean> | null }>({ loaded: false, promise: null });
  const petitionId = petition?._id;
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
    setPdfLoadingDoc(null);
    setActiveTimelineDayKey(null);
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
      ? buildTimelineDetailModel({ petition, parameters: visibleParameters, progressEntries, auditLogs, qcResults, itemGroupIds: groupMembership })
      : null,
    [auditLogs, canViewPetition, groupMembership, petition, progressEntries, qcResults, visibleParameters],
  );

  const loadDocumentData = useCallback(async (): Promise<boolean> => {
    if (!petitionId) return false;
    if (documentLoadState.current.loaded) return true;
    if (documentLoadState.current.promise) return documentLoadState.current.promise;

    const loadVersion = documentLoadVersion.current;
    setDocumentLoading(true);
    setDocumentError(null);
    const promise = api.getQCResults(petitionId)
      .then((results) => {
        if (documentLoadVersion.current !== loadVersion) return false;
        documentLoadState.current.loaded = true;
        setQcResults(results);
        return true;
      })
      .catch((loadError: unknown) => {
        if (documentLoadVersion.current !== loadVersion) return false;
        setDocumentError(loadError instanceof Error ? loadError.message : "โหลดข้อมูลเอกสารไม่สำเร็จ");
        return false;
      })
      .finally(() => {
        documentLoadState.current.promise = null;
        if (documentLoadVersion.current === loadVersion) setDocumentLoading(false);
      });

    documentLoadState.current.promise = promise;
    return promise;
  }, [petitionId]);

  useEffect(() => {
    documentLoadVersion.current += 1;
    documentLoadState.current = { loaded: false, promise: null };
    setQcResults([]);
    setDocumentLoading(false);
    setDocumentError(null);
    void loadDocumentData();
  }, [loadDocumentData, taskReloadKey]);

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
  const commonNameSummary = summarizeItemValues(petition.items ?? [], (item) => item.commonName);
  const batchSummary = summarizeItemValues(petition.items ?? [], (item) => item.batchNo);
  const lotSummary = summarizeItemValues(petition.items ?? [], (item) => item.lotNo);
  const responsibleName = petition.assignedTo?.name || "ยังไม่มอบหมาย";
  const timelineDays = model.timeline.days.length
    ? model.timeline.days
    : [{
        key: "timeline",
        label: "Timeline",
        startAt: model.timeline.startAt,
        endAt: model.timeline.endAt,
        ticks: model.timeline.ticks,
        rows: model.timeline.rows.map((row) => ({
          ...row,
          visible: true,
          segmentStartAt: row.startAt ?? row.at,
          segmentEndAt: row.endAt ?? row.at,
          continuesBefore: false,
          continuesAfter: false,
        })),
      }];
  const activeTimelineDay = timelineDays.find((day) => day.key === activeTimelineDayKey) ?? timelineDays[0];

  const refreshTasks = () => setTaskReloadKey((value) => value + 1);

  function refreshTimeline() {
    refresh();
    refreshActivity();
    refreshTasks();
  }

  function printableElement(ref: RefObject<HTMLDivElement>): HTMLElement | null {
    return (ref.current?.firstElementChild as HTMLElement | null) ?? ref.current;
  }

  async function openDocumentPdf(key: TimelineDocumentKey, docType: PrintDocType, ref: RefObject<HTMLDivElement>, fileName: string) {
    flushSync(() => setPdfLoadingDoc(key));
    setDocumentError(null);
    try {
      if (!(await loadDocumentData())) return;
      await openPrintPdf(docType, printableElement(ref), { fileName });
    } catch (pdfError: unknown) {
      const message = pdfError instanceof Error ? pdfError.message : "เปิด PDF ไม่สำเร็จ";
      setDocumentError(message);
      toast.error(message);
    } finally {
      setPdfLoadingDoc(null);
    }
  }

  return <AppLayout title={`Timeline ${petition.petitionNo}`}><div className="space-y-4">
    <PageHeader title="" onBack={() => navigate("/petition-timeline")} actions={<Button variant="primary-outline" size="sm" onClick={refreshTimeline}><RefreshCw className="h-4 w-4" />รีเฟรช</Button>} />

    <Card className="border-black-50 shadow-none"><CardContent className="grid gap-5 p-5 xl:grid-cols-[112px_minmax(0,1fr)]">
      <div className="flex aspect-square items-center justify-center rounded-[8px] border border-dashed border-grey-300 bg-grey-50 text-grey-400" aria-label="พื้นที่รูปตัวอย่าง"><ImageIcon className="h-8 w-8" /></div>
      <div className="min-w-0 space-y-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
            <div aria-label="เลขคำขอ" className="min-w-0">
              <h2 className="truncate text-2xl font-bold leading-tight text-black-500 sm:text-3xl">{petition.petitionNo}</h2>
            </div>
          </div>
          <p className="text-xs text-grey-400">คำร้องโดย {petition.submittedBy?.name || "-"} · ผู้รับผิดชอบ {responsibleName}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <Metric label="Common name" value={commonNameSummary} />
          <Metric label="เลข Batch" value={batchSummary} />
          <Metric label="Lot" value={lotSummary} />
          <Metric label={model.header.startKind === "received" ? "Start time" : "เวลายื่นคำร้อง"} value={formatDateTime(model.header.startAt)} />
          <Metric label="End time" value={formatDateTime(model.header.endAt)} hint={model.header.endKind === "actual" ? "เวลาจริง" : model.header.endKind === "estimated" ? "ค่าประมาณ" : "กำลังดำเนินการ"} />
          <Metric label="Progress" value={progressLabel} hint={model.progress.total ? `${model.progress.filled}/${model.progress.total} required fields` : "ไม่มี required parameter"} />
        </div>
        {model.progress.percent != null && <div className="h-2 overflow-hidden rounded-full bg-grey-100"><div className="h-full bg-primary-500 transition-[width]" style={{ width: `${model.progress.percent}%` }} /></div>}
      </div>
    </CardContent></Card>

    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px] 2xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <Card aria-label="Project Timeline" className="border-black-50 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="h-4 w-4 text-primary-500" />Project Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            {timelineDays.length > 1 && <div role="tablist" aria-label="Timeline days" className="mb-3 flex flex-wrap gap-2">{timelineDays.map((day) => <button key={day.key} type="button" role="tab" aria-selected={day.key === activeTimelineDay.key} className={cn("rounded-[8px] border px-3 py-1.5 text-xs font-medium transition-colors", day.key === activeTimelineDay.key ? "border-primary-500 bg-primary-50 text-primary-600" : "border-black-50 bg-white text-grey-600 hover:bg-grey-50")} onClick={() => setActiveTimelineDayKey(day.key)}>{day.label}</button>)}</div>}
            <div className="space-y-3">
              <div className="grid grid-cols-[minmax(5.75rem,7rem)_minmax(0,1fr)] items-end gap-2 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-3">
                <div aria-hidden="true" />
                <div className="relative min-w-0 border-b border-black-50 pb-5 text-xs text-grey-500">
                  {activeTimelineDay.ticks.map((tick, index) => {
                    const left = timelinePercent(tick.at, activeTimelineDay.startAt, activeTimelineDay.endAt);
                    return left == null ? null : <div key={tick.key} className="absolute top-0 h-full border-l border-grey-200" style={{ left: `${left}%` }}><span className={cn("absolute top-0 whitespace-nowrap", left > 92 ? "right-1" : "left-1", timelineTickVisibilityClass(index, activeTimelineDay.ticks.length))}>{tick.label}</span></div>;
                  })}
                </div>
              </div>
              {activeTimelineDay.rows.map((row) => {
                const progress = row.visible && row.kind === "milestone" ? timelinePercent(row.at, activeTimelineDay.startAt, activeTimelineDay.endAt) : null;
                const start = row.visible && row.kind === "bar" ? timelinePercent(row.segmentStartAt, activeTimelineDay.startAt, activeTimelineDay.endAt) : null;
                const end = row.visible && row.kind === "bar" ? timelinePercent(row.segmentEndAt, activeTimelineDay.startAt, activeTimelineDay.endAt) : null;
                const width = start != null && end != null ? Math.max(1, end - start) : null;
                return <div key={row.key} className="grid grid-cols-[minmax(5.75rem,7rem)_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-3"><span className="min-w-0 truncate text-sm text-grey-700" title={row.label}>{row.label}</span><div className="relative min-w-0 h-6 rounded bg-grey-50">{row.visible && row.kind === "milestone" && progress != null && <><div className={cn("absolute left-0 top-2 h-2 rounded-full", row.done ? "bg-primary-400" : "bg-grey-200")} style={{ width: `${progress}%` }} /><span aria-label={`${row.label} (จุด)`} className={cn("absolute top-1 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-white", row.done ? "bg-primary-600" : "bg-grey-300")} style={{ left: `${progress}%` }} /></>}{row.visible && row.kind === "bar" && start != null && width != null && <div aria-label={`${row.label} (ช่วงเวลา)`} title={row.continuesBefore || row.continuesAfter ? "ต่อเนื่องข้ามวัน" : undefined} className={cn("absolute top-2 h-2 rounded-full", barTrackClass(row.track, row.done), row.continuesBefore && "rounded-l-none", row.continuesAfter && "rounded-r-none")} style={{ left: `${start}%`, width: `${width}%` }} />}</div></div>;
              })}
            </div>
          </CardContent>
        </Card>

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
        <Button variant="primary-outline" className="w-full justify-start" disabled={documentLoading || pdfLoadingDoc !== null} onClick={() => { void openDocumentPdf("sample-label", "sample-label", labelDocumentRef, `${petition.petitionNo}-sample-label.pdf`); }}><Download className="h-4 w-4" />ป้ายนำส่งตัวอย่าง</Button>
        {(labRequests?.length ?? 0) > 0 && <Button variant="primary-outline" className="w-full justify-start" disabled={documentLoading || pdfLoadingDoc !== null} onClick={() => { void openDocumentPdf("service-request", "service-request", serviceDocumentRef, `${petition.petitionNo}-service-request.pdf`); }}><Download className="h-4 w-4" />ใบคำขอรับบริการ</Button>}
        {canShowPreReport && <Button variant="primary-outline" className="w-full justify-start" disabled={documentLoading || pdfLoadingDoc !== null} onClick={() => { void openDocumentPdf("pre-report", "coa", preReportDocumentRef, `${petition.petitionNo}-pre-report.pdf`); }}><Download className="h-4 w-4" />Pre Report</Button>}
        {petition.status === "approved" && <Button variant="primary-outline" className="w-full justify-start" disabled={documentLoading || pdfLoadingDoc !== null} onClick={() => { void openDocumentPdf("final-report", "coa", finalReportDocumentRef, `${petition.petitionNo}-final-report.pdf`); }}><FileCheck2 className="h-4 w-4" />Final Report</Button>}
        {documentLoading && <p className="text-xs text-grey-500">กำลังโหลดข้อมูลเอกสาร...</p>}
        {documentError && <p className="text-xs text-red-600">โหลดข้อมูลเอกสารไม่สำเร็จ: {documentError}</p>}
      </CardContent></Card>
      </div>
    </div>

    {pdfLoadingDoc && <div className="fixed left-[-10000px] top-0 opacity-0 pointer-events-none" aria-hidden="true">
      {pdfLoadingDoc === "sample-label" && <div ref={labelDocumentRef}><SampleLabelPrintTemplate petition={petition} /></div>}
      {pdfLoadingDoc === "service-request" && labRequests?.[0] && <div ref={serviceDocumentRef}><PetitionPrintTemplate labRequest={labRequests[0]} petition={petition} qcResults={qcResults} sgParam={sgParameter} /></div>}
      {pdfLoadingDoc === "pre-report" && <div ref={preReportDocumentRef}><ResultReportPrintTemplate kind="pre" petition={petition} labRequests={labRequests ?? []} qcResults={qcResults} /></div>}
      {pdfLoadingDoc === "final-report" && <div ref={finalReportDocumentRef}><ResultReportPrintTemplate kind="final" petition={petition} labRequests={labRequests ?? []} qcResults={qcResults} /></div>}
    </div>}
  </div></AppLayout>;
}
