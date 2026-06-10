import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock,
  Droplets,
  FileSearch,
  FlaskConical,
  Hourglass,
  PlayCircle,
  ScanLine,
  UserCheck,
} from "lucide-react";
import HomeHeader from "@/components/home/HomeHeader";
import StatCard from "@/components/lis/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { isAssignedTo } from "@/lib/assignment";
import { useAuth } from "@/context/AuthContext";
import { useSamples } from "@/context/SampleContext";
import { usePetitionList } from "@/hooks/usePetition";
import { useCanAccessPath } from "@/hooks/useCanAccessPath";
import {
  PETITION_DEPT_LABELS,
  PETITION_STATUS_CONFIG,
  type Petition,
  type PetitionStatus,
} from "@/types/petition.types";

const LAB_BATCH_LAST_DIGITS = new Set(["1", "6"]);
// Lab process: รอ assign → รับงาน (assigned) → กำลังทดสอบ → เสร็จสิ้น (ส่งผลแล้ว)
// — sampleSent ตัดออก เพราะเป็นช่วงก่อน QC รับ (lab ทำอะไรไม่ได้)
const LAB_QUEUE_STATUSES: PetitionStatus[] = ["pendingReview", "inProgress"];

const isLabBatchNo = (batchNo?: string | null) => {
  const trimmed = String(batchNo ?? "").trim();
  return trimmed.length > 0 && LAB_BATCH_LAST_DIGITS.has(trimmed.slice(-1));
};
const hasLabItem = (p: Petition) => p.items.some((i) => isLabBatchNo(i.batchNo));

const ageHoursFrom = (ts?: string | null) => {
  if (!ts) return null;
  const ms = Date.now() - new Date(ts).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60)));
};

const PHYSICAL_RESULTS: Record<string, { physical: "normal" | "abnormal"; reason?: string }> = {
  "LAB-2602-003": { physical: "normal" },
  "LAB-2602-005": { physical: "normal" },
  "LAB-2602-008": { physical: "abnormal", reason: "density และสีไม่ตรงกับแบชก่อนหน้า" },
};

export default function HomeLab() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canAccess = useCanAccessPath();
  const { data: petitionData } = usePetitionList({ page: 1, limit: 100 });
  const allPetitions = petitionData?.items ?? [];
  const { physicalSamples, sentSamples, sentItems, realtimeDensities } = useSamples();

  const access = {
    petitionsList: canAccess("/petitions"),
    scanner: canAccess("/scanner"),
    labTesting: canAccess("/lab-testing"),
    recordResults: canAccess("/record-results"),
  };

  const labPetitions = useMemo(() => allPetitions.filter(hasLabItem), [allPetitions]);
  const mine = useMemo(() => {
    if (!user) return labPetitions;
    const assigned = labPetitions.filter((p) => isAssignedTo(p.assignedTo, user));
    return assigned.length > 0 ? assigned : labPetitions;
  }, [labPetitions, user]);

  const waitingAssign = mine.filter((p) => p.status === "pendingReview" && !p.assignedTo);
  const readyToStart = mine.filter((p) => p.status === "pendingReview" && !!p.assignedTo);
  const inProgress = mine.filter((p) => p.status === "inProgress");
  const completed = mine.filter((p) => p.status === "success");

  // Hero priority: prefer something the lab can act on right now —
  // กำลังทดสอบ ที่ค้างไว้ก่อน, แล้วค่อย รับงานพร้อมเริ่ม
  const queueSorted = useMemo(
    () =>
      [...mine]
        .filter((p) => LAB_QUEUE_STATUSES.includes(p.status))
        .sort((a, b) => {
          const rank = (p: Petition) => {
            if (p.status === "inProgress") return 0;
            if (p.status === "pendingReview" && p.assignedTo) return 1;
            return 2; // pendingReview && !assignedTo
          };
          return rank(a) - rank(b);
        }),
    [mine],
  );
  const hero = queueSorted[0];

  const abnormalSamples = useMemo(
    () =>
      physicalSamples
        .map((s) => ({ sample: s, result: PHYSICAL_RESULTS[s.id] }))
        .filter((x) => x.result?.physical === "abnormal"),
    [physicalSamples],
  );

  const todayDensities = useMemo(() => {
    const map = new Map(realtimeDensities.map((d) => [d.sampleId, d]));
    return [
      ...sentItems.map((s) => ({ id: s.id, name: s.name, density: map.get(s.id)?.density })),
      ...sentSamples.map((s) => ({ id: s.id, name: s.name, density: map.get(s.id)?.density })),
    ].slice(0, 5);
  }, [sentItems, sentSamples, realtimeDensities]);

  return (
    <>
      <HomeHeader title="งาน Lab ของฉัน" subtitle="สแกน QR เพื่อรับตัวอย่างและเริ่มทดสอบ" icon={FlaskConical} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard
          icon={Hourglass}
          value={waitingAssign.length}
          label="รอ assign"
          variant="amber"
          sublabel="คำขอที่ยังไม่มีคนรับ"
          onClick={access.petitionsList ? () => navigate("/petitions?status=pendingReview") : undefined}
        />
        <StatCard
          icon={UserCheck}
          value={readyToStart.length}
          label="รับงานแล้ว"
          variant="blue"
          sublabel="พร้อมสแกนเริ่มทดสอบ"
          onClick={access.scanner ? () => navigate("/scanner") : undefined}
        />
        <StatCard
          icon={FlaskConical}
          value={inProgress.length}
          label="กำลังทดสอบ"
          variant="neutral"
          onClick={access.labTesting ? () => navigate("/lab-testing") : undefined}
        />
        <StatCard
          icon={CheckCircle2}
          value={completed.length}
          label="เสร็จสิ้นแล้ว"
          variant="green"
          sublabel="ส่งผลให้ QC แล้ว"
          onClick={access.recordResults ? () => navigate("/record-results") : undefined}
        />
      </div>

      {/* Status flow — ตาม process จริง: รอ assign → รับงาน → ทดสอบ → ส่งผล */}
      <Card className="mb-4">
        <CardContent className="py-3">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <FlowStep
              label="รอ assign"
              count={waitingAssign.length}
              tone="amber"
              onClick={access.petitionsList ? () => navigate("/petitions?status=pendingReview") : undefined}
            />
            <FlowArrow />
            <FlowStep
              label="รับงานแล้ว"
              count={readyToStart.length}
              tone="blue"
              onClick={access.scanner ? () => navigate("/scanner") : undefined}
            />
            <FlowArrow />
            <FlowStep
              label="กำลังทดสอบ"
              count={inProgress.length}
              tone="primary"
              onClick={access.labTesting ? () => navigate("/lab-testing") : undefined}
            />
            <FlowArrow />
            <FlowStep
              label="เสร็จสิ้นแล้ว"
              count={completed.length}
              tone="green"
              onClick={access.recordResults ? () => navigate("/record-results") : undefined}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-4 mb-4">
        <div className="flex flex-col gap-3">
          {hero && (access.labTesting || access.scanner) ? (
            <HeroLabCard
              petition={hero}
              onPrimary={access.labTesting ? () => navigate(`/lab-testing/${hero._id}`) : undefined}
              onScan={access.scanner ? () => navigate("/scanner") : undefined}
            />
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <p className="text-sm font-medium">เคลียร์งานครบแล้ว</p>
                <p className="text-xs text-muted-foreground">รอตัวอย่างใหม่จาก QC</p>
              </CardContent>
            </Card>
          )}

          {abnormalSamples.length > 0 && access.recordResults ? (
            <Card className="border-red-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-red-700">
                  <AlertTriangle className="h-4 w-4" />
                  ตัวอย่างผิดปกติที่พบ
                  <Badge variant="red-soft" className="ml-1">{abnormalSamples.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-border">
                  {abnormalSamples.slice(0, 3).map((x) => (
                    <li key={x.sample.id}>
                      <button
                        type="button"
                        onClick={() => navigate("/record-results")}
                        className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-red-50/40 focus-visible:outline-none focus-visible:bg-red-50/40"
                      >
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-red-100 text-red-600">
                          <AlertTriangle className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-primary text-sm">{x.sample.id}</span>
                            <Badge variant="red-soft" className="text-[10px]">ผิดปกติ</Badge>
                          </div>
                          <p className="truncate text-xs text-foreground/80 mt-0.5">{x.sample.name}</p>
                          {x.result?.reason ? (
                            <p className="text-[11px] text-red-600/80 mt-0.5">{x.result.reason}</p>
                          ) : null}
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground mt-1" />
                      </button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="flex flex-col gap-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Droplets className="h-4 w-4 text-blue-500" />
                Density realtime
                <Badge variant="outline" className="ml-auto text-[10px]">{todayDensities.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {todayDensities.length === 0 ? (
                <p className="px-4 pb-4 text-center text-xs text-muted-foreground">ยังไม่มีตัวอย่างวันนี้</p>
              ) : (
                <ul className="divide-y divide-border">
                  {todayDensities.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2 px-4 py-2 text-xs">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-primary truncate">{s.id}</p>
                        <p className="text-muted-foreground truncate">{s.name}</p>
                      </div>
                      {s.density !== undefined ? (
                        <span className="font-semibold tabular-nums text-sm">{s.density.toFixed(3)}</span>
                      ) : (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <Clock className="h-3 w-3" /> รอ
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                สรุปงานของฉันวันนี้
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <SummaryRow label="เสร็จสิ้นแล้ว" count={completed.length} accent="text-green-600" />
              <SummaryRow label="กำลังทดสอบ" count={inProgress.length} accent="text-blue-600" />
              <SummaryRow label="รับงานแล้ว" count={readyToStart.length} accent="text-amber-600" />
              <SummaryRow label="รอ assign" count={waitingAssign.length} accent="text-muted-foreground" />
              {access.labTesting && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2 gap-2"
                  onClick={() => navigate("/lab-testing")}
                >
                  <FileSearch className="h-3.5 w-3.5" />
                  เปิดหน้า Lab Testing
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function FlowStep({
  label,
  count,
  tone,
  onClick,
}: {
  label: string;
  count: number;
  tone: "amber" | "blue" | "primary" | "green";
  onClick?: () => void;
}) {
  const toneClasses: Record<typeof tone, string> = {
    amber: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100",
    blue: "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100",
    primary: "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15",
    green: "border-green-200 bg-green-50 text-green-700 hover:bg-green-100",
  };
  const interactive = typeof onClick === "function";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      className={cn(
        "flex min-w-[110px] flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left transition",
        toneClasses[tone],
        !interactive && "cursor-not-allowed opacity-60 hover:bg-transparent",
      )}
    >
      <span className="text-2xl font-bold tabular-nums leading-none">{count}</span>
      <span className="text-[11px] font-medium leading-tight">{label}</span>
    </button>
  );
}

function FlowArrow() {
  return <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />;
}

function HeroLabCard({
  petition,
  onPrimary,
  onScan,
}: {
  petition: Petition;
  onPrimary?: () => void;
  onScan?: () => void;
}) {
  const status = PETITION_STATUS_CONFIG[petition.status];
  // ตาม process: pendingReview + มี assignedTo = รับงานแล้ว พร้อมสแกนเริ่ม
  // inProgress = กำลังทดสอบอยู่ ให้ "ทำต่อ"
  // pendingReview + ไม่มี assignedTo = ยังไม่ได้รับ assign (รอ QC มอบหมาย)
  const isReadyToStart = petition.status === "pendingReview" && !!petition.assignedTo;
  const isInProgress = petition.status === "inProgress";
  const isWaitingAssign = petition.status === "pendingReview" && !petition.assignedTo;
  const ageHours = ageHoursFrom(petition.sampleSentAt ?? petition.createdAt);
  const items = petition.items.slice(0, 3);
  const extra = Math.max(0, petition.items.length - items.length);

  return (
    <Card className="relative overflow-hidden border-primary/30 shadow-md">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/30" />
      <CardContent className="pt-5 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              งานที่ต้องทำต่อไป
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground mt-1">{petition.petitionNo}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {PETITION_DEPT_LABELS[petition.dept]} · {petition.submittedBy?.name ?? "-"}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Badge variant={status?.variant ?? "gray-soft"}>{status?.label ?? petition.status}</Badge>
            {ageHours !== null ? (
              <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                <Clock className="h-3 w-3" /> รออยู่ {ageHours} ชม.
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-1.5 rounded-md bg-muted/30 p-3 mb-3">
          {items.map((it) => (
            <div key={it.seq} className="flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{it.sampleName}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  Batch {it.batchNo}
                  {it.commonName ? ` · ${it.commonName}` : ""}
                </p>
              </div>
              {isLabBatchNo(it.batchNo) ? (
                <Badge variant="primary-soft" className="shrink-0 text-[10px]">Lab</Badge>
              ) : null}
            </div>
          ))}
          {extra > 0 ? <p className="text-[11px] text-muted-foreground">+ อีก {extra} รายการ</p> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {isReadyToStart && onScan ? (
            <Button onClick={onScan} className="gap-2">
              <ScanLine className="h-4 w-4" /> สแกนเริ่มทดสอบ
            </Button>
          ) : isInProgress && onPrimary ? (
            <Button onClick={onPrimary} className="gap-2">
              <PlayCircle className="h-4 w-4" /> ทำต่อ
            </Button>
          ) : isWaitingAssign ? (
            <Button variant="outline" disabled className="gap-2">
              <UserCheck className="h-4 w-4" /> รอ QC มอบหมาย
            </Button>
          ) : onPrimary ? (
            <Button onClick={onPrimary} className="gap-2">
              <FlaskConical className="h-4 w-4" /> เปิดหน้าทดสอบ
            </Button>
          ) : null}
          {onPrimary && (
            <Button variant="outline" onClick={onPrimary} className="gap-2">
              ดูรายละเอียด <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryRow({ label, count, accent }: { label: string; count: number; accent?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-1 last:border-0">
      <span className={cn("text-muted-foreground", accent)}>{label}</span>
      <span className="font-semibold tabular-nums">{count}</span>
    </div>
  );
}
