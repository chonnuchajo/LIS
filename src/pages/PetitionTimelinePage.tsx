import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock, ChevronRight, RefreshCw, Search, X } from "lucide-react";
import AppLayout from "@/components/lis/AppLayout";
import PageHeader from "@/components/lis/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useItemGroupMembership } from "@/hooks/useItemGroupMembership";
import { usePetitionList } from "@/hooks/usePetition";
import { api, type ParameterItem } from "@/lib/api";
import {
  buildPetitionTimelineRow,
  buildTimelineSummary,
  buildTimelineTicks,
  buildTimelineWindow,
  timelinePercent,
  type PetitionTimelineRow,
  type TimelineTone,
} from "@/lib/petitionTimeline";
import { canSeePetition, isLabRole, petitionHasLabReadableItem } from "@/lib/petitionVisibility";
import { normalizeRoles } from "@/lib/roles";
import { petitionStatusBadge } from "@/lib/statusBadge";
import { cn } from "@/lib/utils";
import { PETITION_DEPT_LABELS, PETITION_STATUS_CONFIG, PETITION_STATUSES, type Petition } from "@/types/petition.types";

const PAGE_SIZE = 100;
const TONE_CLASS: Record<TimelineTone, string> = { intake: "bg-sky-500", receive: "bg-emerald-500", testing: "bg-blue-500", lab: "bg-violet-500", final: "bg-amber-500", closed: "bg-green-600", blocked: "bg-red-500" };
const TONE_SOFT_CLASS: Record<TimelineTone, string> = { intake: "border-sky-200 bg-sky-50 text-sky-700", receive: "border-emerald-200 bg-emerald-50 text-emerald-700", testing: "border-blue-200 bg-blue-50 text-blue-700", lab: "border-violet-200 bg-violet-50 text-violet-700", final: "border-amber-200 bg-amber-50 text-amber-700", closed: "border-green-200 bg-green-50 text-green-700", blocked: "border-red-200 bg-red-50 text-red-700" };

function lower(value?: string | null) { return (value ?? "").trim().toLowerCase(); }
function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}
function sampleLine(petition: Petition) {
  const names = petition.items.map((item) => item.sampleName).filter(Boolean);
  const primary = names[0] ?? "-";
  return names.length > 1 ? `${primary} +อีก ${names.length - 1}` : primary;
}
function rowMatchesSearch(row: PetitionTimelineRow, query: string) {
  const q = lower(query);
  if (!q) return true;
  const petition = row.petition;
  return [petition.petitionNo, petition.submittedBy?.name, petition.assignedTo?.name, ...petition.items.flatMap((item) => [item.sampleName, item.commonName, item.batchNo, item.lotNo, item.sampleId])].map(lower).some((value) => value.includes(q));
}
function rowInDateRange(row: PetitionTimelineRow, from: string, to: string) {
  const start = new Date(row.startAt).getTime();
  const end = new Date(row.endAt).getTime();
  const fromTime = from ? new Date(`${from}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
  const toTime = to ? new Date(`${to}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;
  return end >= fromTime && start <= toTime;
}
function StatCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return <Card className="border-black-50 shadow-none"><CardContent className="p-4"><p className="text-sm font-medium text-grey-600">{label}</p><p className="mt-2 text-3xl font-bold text-black-500">{value}</p><p className="mt-1 text-xs text-grey-500">{hint}</p></CardContent></Card>;
}

export default function PetitionTimelinePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const roles = normalizeRoles(user);
  const isAdmin = roles.includes("admin");
  const isLabUser = roles.some(isLabRole);
  const groupMembership = useItemGroupMembership();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [parameters, setParameters] = useState<ParameterItem[]>([]);
  const [paramsLoaded, setParamsLoaded] = useState(false);
  const serverSearch = search.trim();
  const { data, loading, error, refresh } = usePetitionList({ page: isAdmin ? page : 1, limit: isAdmin ? PAGE_SIZE : 500, status: status || undefined, search: serverSearch || undefined }, { refetchOnFocus: true });

  useEffect(() => { setPage(1); }, [from, serverSearch, status, to]);
  useEffect(() => {
    if (!isLabUser) { setParamsLoaded(true); return; }
    let alive = true;
    setParamsLoaded(false);
    api.getParameters().then((items) => { if (alive) setParameters(items); }).catch(() => { if (alive) setParameters([]); }).finally(() => { if (alive) setParamsLoaded(true); });
    return () => { alive = false; };
  }, [isLabUser]);

  const displayParameters = useMemo(() => isLabUser ? parameters.filter((p) => p.scope === "lab" || (p.scope === "qc" && p.shareWithLab === true)) : parameters, [isLabUser, parameters]);
  const visiblePetitions = useMemo(() => {
    const items = data?.items ?? [];
    if (isAdmin) return items;
    let visible = items.filter((petition) => canSeePetition(petition, user));
    if (isLabUser && paramsLoaded) visible = visible.filter((petition) => petitionHasLabReadableItem(petition, displayParameters, groupMembership));
    return visible;
  }, [data?.items, displayParameters, groupMembership, isAdmin, isLabUser, paramsLoaded, user]);
  const rows = useMemo(() => visiblePetitions.map((petition) => buildPetitionTimelineRow(petition)), [visiblePetitions]);
  const filteredRows = useMemo(() => rows.filter((row) => rowMatchesSearch(row, search) && rowInDateRange(row, from, to)), [from, rows, search, to]);
  const timelineWindow = useMemo(() => buildTimelineWindow(filteredRows), [filteredRows]);
  const ticks = useMemo(() => buildTimelineTicks(timelineWindow), [timelineWindow]);
  const summary = useMemo(() => buildTimelineSummary(filteredRows), [filteredRows]);
  const totalCount = isAdmin && !from && !to ? data?.total ?? filteredRows.length : filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const recent = useMemo(() => filteredRows.flatMap((row) => row.milestones.filter((milestone) => milestone.done && milestone.at).map((milestone) => ({ row, milestone }))).sort((a, b) => new Date(b.milestone.at!).getTime() - new Date(a.milestone.at!).getTime()).slice(0, 5), [filteredRows]);
  const hasFilters = !!search || !!status || !!from || !!to;
  const showLoading = loading || (isLabUser && !paramsLoaded);

  return <AppLayout title="Timeline คำร้อง"><div className="space-y-4">
    <PageHeader title="Timeline คำร้อง" description="ดูช่วงเวลาการดำเนินงานของคำร้องแต่ละใบจากข้อมูลที่มีในระบบ" actions={<Button variant="primary-outline" size="sm" onClick={refresh}><RefreshCw className="h-4 w-4" />รีเฟรช</Button>} />
    {error && <div className="flex items-center justify-between gap-3 rounded-[10px] border border-red-500 bg-red-50 p-3 text-sm text-red-500"><span>โหลด timeline ไม่สำเร็จ: {error}</span><Button variant="danger-outline" size="sm" onClick={refresh}>ลองใหม่</Button></div>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="คำร้องที่เห็น" value={summary.total} hint="ตามสิทธิ์และตัวกรองปัจจุบัน" /><StatCard label="กำลังดำเนินการ" value={summary.inProgress} hint="ยังไม่ปิดงานหรือยังรอยืนยัน" /><StatCard label="เสร็จสิ้น/ปิดงาน" value={summary.closed} hint="ทดสอบครบ ออกผล หรือส่งกลับแล้ว" /><StatCard label="รอเกิน 24 ชม." value={summary.waiting} hint="ไม่มี milestone ใหม่เกินหนึ่งวัน" /></div>
    <form className="grid gap-3 rounded-2xl border border-black-50 bg-white p-4 lg:grid-cols-[minmax(260px,1fr)_180px_150px_150px_auto]">
      <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-500" /><Input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="ค้นหาเลขคำร้อง ผู้ยื่น ตัวอย่าง หรือ batch" className="pl-9" /></div>
      <NativeSelect value={status} onChange={(event) => setStatus(event.target.value)}><option value="">ทุกสถานะ</option>{PETITION_STATUSES.map((item) => <option key={item} value={item}>{PETITION_STATUS_CONFIG[item].label}</option>)}</NativeSelect>
      <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="วันที่เริ่มต้น" /><Input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="วันที่สิ้นสุด" />
      {hasFilters && <Button type="button" variant="ghost" onClick={() => { setSearch(""); setStatus(""); setFrom(""); setTo(""); }}><X className="h-4 w-4" />ล้าง</Button>}
    </form>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]"><Card className="border-black-50 shadow-none"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="h-4 w-4 text-primary-500" />แผนภาพระยะเวลาคำร้อง</CardTitle></CardHeader><CardContent>
      {showLoading ? <div className="rounded-[10px] border border-dashed border-grey-200 py-12 text-center text-grey-500">กำลังโหลด timeline...</div> : filteredRows.length === 0 ? <div className="rounded-[10px] border border-dashed border-grey-200 py-12 text-center"><p className="text-sm font-medium text-black-500">{hasFilters ? "ไม่พบคำร้องตามตัวกรอง" : "ยังไม่มีคำร้องที่คุณมีสิทธิ์เห็น"}</p><p className="mt-1 text-xs text-grey-500">ลองเปลี่ยนคำค้นหา สถานะ หรือช่วงวันที่</p></div> : <div className="space-y-3"><div className="overflow-x-auto"><div className="min-w-[980px]"><div className="grid grid-cols-[300px_minmax(640px,1fr)] border-b border-black-50 pb-2 text-xs text-grey-500"><div>คำร้อง</div><div className="relative h-8">{ticks.map((tick) => { const left = timelinePercent(tick.at, timelineWindow); return left == null ? null : <div key={tick.key} className={cn("absolute top-0 h-full border-l", tick.major ? "border-grey-300" : "border-grey-100")} style={{ left: `${left}%` }}><span className="ml-1 whitespace-nowrap">{tick.label}</span></div>; })}</div></div>
        <div className="divide-y divide-black-50">{filteredRows.map((row) => { const statusBadge = petitionStatusBadge(row.petition); const todayLeft = timelinePercent(timelineWindow.todayAt, timelineWindow); return <button key={row.petition._id} type="button" className="grid w-full grid-cols-[300px_minmax(640px,1fr)] gap-0 py-3 text-left hover:bg-grey-50/60" onClick={() => navigate(`/petitions/${row.petition._id}`)}><div className="min-w-0 pr-4"><div className="flex items-center gap-2"><p className="truncate text-sm font-semibold text-primary-500">{row.petition.petitionNo}</p><ChevronRight className="h-4 w-4 shrink-0 text-grey-400" /></div><div className="mt-1 flex flex-wrap items-center gap-1.5"><Badge variant={statusBadge.variant}>{statusBadge.label}</Badge><Badge variant="blue-soft">{PETITION_DEPT_LABELS[row.petition.dept]}</Badge>{row.isIdle && <Badge variant="yellow-soft">รอเกิน 24 ชม.</Badge>}</div><p className="mt-1 truncate text-xs text-grey-600">{sampleLine(row.petition)}</p><p className="truncate text-xs text-grey-500">ผู้ยื่น {row.petition.submittedBy?.name ?? "-"} · ผู้รับงาน {row.petition.assignedTo?.name ?? "ยังไม่มี"}</p></div><div className="relative min-h-16" style={{ minHeight: `${Math.max(64, 22 + row.segments.length * 8)}px` }}><div className="absolute inset-x-0 top-7 h-px bg-grey-100" />{todayLeft != null && <div className="absolute inset-y-0 border-l border-red-300" style={{ left: `${todayLeft}%` }} />}{row.segments.map((segment, index) => { const left = timelinePercent(segment.startAt, timelineWindow); const right = timelinePercent(segment.endAt, timelineWindow); return left == null || right == null ? null : <div key={segment.key} className={cn("absolute h-3 rounded-full", TONE_CLASS[segment.tone], segment.current && "animate-pulse")} style={{ left: `${left}%`, width: `${Math.max(1, right - left)}%`, top: `${18 + index * 8}px` }} title={`${segment.label}: ${formatDateTime(segment.startAt)} - ${formatDateTime(segment.endAt)}`} />; })}{row.milestones.map((milestone) => { const left = timelinePercent(milestone.at, timelineWindow); return left == null ? null : <span key={milestone.key} className={cn("absolute top-1 h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-white shadow-sm", TONE_CLASS[milestone.tone])} style={{ left: `${left}%` }} title={`${milestone.label}: ${formatDateTime(milestone.at)}`} />; })}</div></button>; })}</div></div></div>
        {isAdmin && data && totalCount > PAGE_SIZE && <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><span className="text-grey-500">หน้า {page} / {totalPages} · ทั้งหมด {totalCount} รายการ</span><div className="flex items-center gap-2"><Button variant="primary-outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>ก่อนหน้า</Button><Button variant="primary-outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>ถัดไป</Button></div></div>}
      </div>}
    </CardContent></Card>
    <div className="space-y-4"><Card className="border-black-50 shadow-none"><CardHeader className="pb-3"><CardTitle className="text-base">กิจกรรมล่าสุด</CardTitle></CardHeader><CardContent className="space-y-3">{recent.length === 0 ? <p className="py-6 text-center text-sm text-grey-500">ยังไม่มีกิจกรรมจากคำร้องที่แสดง</p> : recent.map(({ row, milestone }) => <button key={`${row.petition._id}-${milestone.key}-${milestone.at}`} type="button" className="flex w-full gap-3 rounded-lg p-2 text-left hover:bg-grey-50" onClick={() => navigate(`/petitions/${row.petition._id}`)}><span className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", TONE_CLASS[milestone.tone])} /><span className="min-w-0"><span className="block truncate text-sm font-medium text-black-500">{row.petition.petitionNo} · {milestone.label}</span><span className="block text-xs text-grey-500">{formatDateTime(milestone.at)}</span></span></button>)}</CardContent></Card>
      <Card className="border-black-50 shadow-none"><CardHeader className="pb-3"><CardTitle className="text-base">Legend</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2">{Object.entries({ intake: "นำส่ง", receive: "รับ/Assign", testing: "ตรวจวิเคราะห์", lab: "ออกผล Lab", final: "รอ Final", closed: "ปิดงาน", blocked: "ส่งกลับ" } satisfies Record<TimelineTone, string>).map(([tone, label]) => <span key={tone} className={cn("inline-flex items-center rounded-full border px-2 py-1 text-xs", TONE_SOFT_CLASS[tone as TimelineTone])}>{label}</span>)}</CardContent></Card>
    </div></div>
  </div></AppLayout>;
}
