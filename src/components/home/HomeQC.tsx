import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock,
  Droplet,
  FlaskConical,
  Hourglass,
  Package,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from "lucide-react";
import HomeHeader from "@/components/home/HomeHeader";
import StatCard from "@/components/lis/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useSamples } from "@/context/SampleContext";
import { usePetitionList } from "@/hooks/usePetition";
import { useCanAccessPath } from "@/hooks/useCanAccessPath";
import {
  PETITION_DEPT_LABELS,
  PETITION_STATUS_CONFIG,
  type Petition,
} from "@/types/petition.types";
import type { SampleItem } from "@/components/lis/SampleColumn";

const EXPIRY_WARN_DAYS = 180;
const SOLVENT_LOW_QTY = 3;

const PHYSICAL_RESULTS: Record<string, { physical: "normal" | "abnormal" }> = {
  "LAB-2602-003": { physical: "normal" },
  "LAB-2602-005": { physical: "normal" },
  "LAB-2602-008": { physical: "abnormal" },
};

const ageHoursFrom = (ts?: string | null) => {
  if (!ts) return null;
  const ms = Date.now() - new Date(ts).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60)));
};

const daysUntil = (exp?: string) => {
  if (!exp) return null;
  const d = new Date(exp);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
};

type StageKey = "waiting" | "assign" | "testing" | "approve";

export default function HomeQC() {
  const navigate = useNavigate();
  const canAccess = useCanAccessPath();
  const { data: petitionData } = usePetitionList({ page: 1, limit: 100 });
  const allPetitions = petitionData?.items ?? [];
  const { doneSamples, approvals, physicalSamples } = useSamples();

  const access = {
    approval: canAccess("/qc-approval"),
    assign: canAccess("/petitions/assign"),
    testing: canAccess("/qc-testing"),
    petitionsList: canAccess("/petitions"),
    recordResults: canAccess("/record-results"),
    stock: canAccess("/stock"),
  };

  const waitingReceive = allPetitions.filter((p) => p.status === "sampleSent");
  const pendingAssign = allPetitions.filter((p) => p.status === "pendingReview");
  const inProgress = allPetitions.filter((p) => p.status === "inProgress");
  const completedToday = allPetitions.filter((p) => p.status === "success");
  const pendingApprove = doneSamples.filter(
    (s) => !approvals[s.id]?.qcStatus || approvals[s.id]?.qcStatus === "pending",
  );

  const abnormalCount = useMemo(
    () => physicalSamples.filter((s) => PHYSICAL_RESULTS[s.id]?.physical === "abnormal").length,
    [physicalSamples],
  );

  const totalActive = waitingReceive.length + pendingAssign.length + inProgress.length + pendingApprove.length;
  const totalToday = totalActive + completedToday.length;
  const donePct = totalToday > 0 ? Math.round((completedToday.length / totalToday) * 100) : 0;

  // Hero priority: pending approval first → assign fallback.
  // Skip approval-related entries entirely if the user has no /qc-approval access.
  const heroSample = access.approval ? pendingApprove[0] : undefined;
  const heroPetition = !heroSample && access.assign ? pendingAssign[0] : undefined;
  const upcomingApprovals = access.approval ? pendingApprove.slice(1, 4) : [];
  const upcomingAssigns = access.assign
    ? pendingAssign.slice(heroSample ? 0 : 1, heroSample ? 3 : 4)
    : [];

  // Stock alerts (QC supervises stock health)
  const { data: standards } = useQuery({ queryKey: ["home", "standards"], queryFn: api.getStandards });
  const { data: solvents } = useQuery({ queryKey: ["home", "solvents"], queryFn: api.getSolvents });

  const expiringStandards = useMemo(() => {
    const list = (standards ?? [])
      .map((s) => ({
        name: s.name,
        days: Math.min(daysUntil(s.working?.exp) ?? Infinity, daysUntil(s.supplier?.exp) ?? Infinity),
      }))
      .filter((x) => Number.isFinite(x.days) && x.days <= EXPIRY_WARN_DAYS)
      .sort((a, b) => a.days - b.days);
    return list;
  }, [standards]);

  const lowSolventsList = useMemo(
    () => (solvents ?? []).filter((s) => (s.qty ?? 0) < SOLVENT_LOW_QTY).sort((a, b) => a.qty - b.qty),
    [solvents],
  );

  const stageCounts: Record<StageKey, number> = {
    waiting: waitingReceive.length,
    assign: pendingAssign.length,
    testing: inProgress.length,
    approve: pendingApprove.length,
  };

  return (
    <>
      <HomeHeader title="ภาพรวมงาน QC" subtitle="รับตัวอย่าง · มอบหมาย · อนุมัติผล" icon={ShieldCheck} />

      {/* === KPI === */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard
          icon={Hourglass}
          value={waitingReceive.length}
          label="รอตรวจรับ"
          variant="amber"
          onClick={access.petitionsList ? () => navigate("/petitions?status=sampleSent") : undefined}
        />
        <StatCard
          icon={UserCheck}
          value={pendingAssign.length}
          label="รอมอบหมาย"
          variant="blue"
          onClick={access.assign ? () => navigate("/petitions/assign") : undefined}
        />
        <StatCard
          icon={FlaskConical}
          value={pendingApprove.length}
          label="รออนุมัติผล"
          variant={pendingApprove.length > 0 ? "neutral" : "green"}
          onClick={access.approval ? () => navigate("/qc-approval") : undefined}
        />
        <StatCard
          icon={AlertTriangle}
          value={abnormalCount}
          label="ผิดปกติวันนี้"
          variant={abnormalCount > 0 ? "red" : "green"}
          onClick={access.recordResults ? () => navigate("/record-results") : undefined}
        />
      </div>

      {/* === Today's progress === */}
      <Card className="mb-4 border-primary/20 bg-gradient-to-br from-primary/[0.03] to-transparent">
        <CardContent className="py-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-[180px]">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-semibold">ความคืบหน้า QC วันนี้</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {completedToday.length}/{totalToday} เคส · {donePct}%
                </p>
              </div>
              <Progress value={donePct} className="mt-2 h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* === Main: Hero + side rail === */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-4 mb-4">
        <div className="flex flex-col gap-3">
          {heroSample ? (
            <HeroApprovalCard sample={heroSample} onClick={() => navigate("/qc-approval")} />
          ) : heroPetition ? (
            <HeroAssignCard petition={heroPetition} onClick={() => navigate("/petitions/assign")} />
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <p className="text-sm font-medium">เคลียร์งานครบแล้ว</p>
                <p className="text-xs text-muted-foreground">ไม่มีรายการรอ QC ดำเนินการ</p>
              </CardContent>
            </Card>
          )}

          {(upcomingApprovals.length > 0 || upcomingAssigns.length > 0) ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />
                  ถัดไปในคิว
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-border">
                  {upcomingApprovals.map((s) => (
                    <ApprovalQueueRow key={s.id} sample={s} onClick={() => navigate("/qc-approval")} />
                  ))}
                  {upcomingAssigns.map((p) => (
                    <PetitionQueueRow key={p._id} petition={p} onClick={() => navigate("/petitions/assign")} />
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="flex flex-col gap-3">
          <StageChipsCard
            counts={stageCounts}
            stageAccess={{
              waiting: access.petitionsList,
              assign: access.assign,
              testing: access.testing,
              approve: access.approval,
            }}
            onClick={(key) => {
              if (key === "waiting") navigate("/petitions?status=sampleSent");
              else if (key === "assign") navigate("/petitions/assign");
              else if (key === "testing") navigate("/qc-testing");
              else navigate("/qc-approval");
            }}
          />
          <StockAlertsCard
            expiring={expiringStandards}
            lowSolvents={lowSolventsList}
            onClick={access.stock ? () => navigate("/stock") : undefined}
          />
        </div>
      </div>
    </>
  );
}

function StageChipsCard({
  counts,
  stageAccess,
  onClick,
}: {
  counts: Record<StageKey, number>;
  stageAccess: Record<StageKey, boolean>;
  onClick: (key: StageKey) => void;
}) {
  const stages: { key: StageKey; label: string; full: string; tone: "amber" | "blue" | "primary" | "green" }[] = [
    { key: "waiting", label: "รับ", full: "รอตรวจรับ", tone: "amber" },
    { key: "assign", label: "มอบ", full: "รอมอบหมาย", tone: "blue" },
    { key: "testing", label: "ตรวจ", full: "กำลังตรวจ", tone: "primary" },
    { key: "approve", label: "อนุมัติ", full: "รออนุมัติ", tone: "green" },
  ].filter((s) => stageAccess[s.key]);
  const tones: Record<"amber" | "blue" | "primary" | "green", string> = {
    amber: "bg-amber-100 text-amber-700 ring-amber-200 hover:bg-amber-200",
    blue: "bg-blue-100 text-blue-700 ring-blue-200 hover:bg-blue-200",
    primary: "bg-primary/15 text-primary ring-primary/25 hover:bg-primary/20",
    green: "bg-green-100 text-green-700 ring-green-200 hover:bg-green-200",
  };
  if (stages.length === 0) return null;
  const total = stages.reduce((sum, s) => sum + counts[s.key], 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          QC stages
          <span className="ml-auto text-xs font-normal text-muted-foreground tabular-nums">
            {total} ค้าง
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-stretch gap-1.5">
          {stages.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => onClick(s.key)}
              title={s.full}
              className={cn(
                "flex flex-1 flex-col items-center justify-center rounded-md py-2 px-1 ring-1 transition",
                tones[s.tone],
              )}
            >
              <span className="text-lg font-bold tabular-nums leading-none">{counts[s.key]}</span>
              <span className="mt-0.5 text-[10px] font-medium leading-tight">{s.label}</span>
            </button>
          ))}
        </div>
        {stageAccess.approve && (
          <Button variant="outline" size="sm" className="w-full" onClick={() => onClick("approve")}>
            เปิดหน้า QC Approval
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function StockAlertsCard({
  expiring,
  lowSolvents,
  onClick,
}: {
  expiring: { name: string; days: number }[];
  lowSolvents: { name: string; qty: number; sizeLiter: number }[];
  onClick?: () => void;
}) {
  const topExp = expiring.slice(0, 3);
  const topSolv = lowSolvents.slice(0, 3);
  const empty = topExp.length === 0 && topSolv.length === 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="h-4 w-4 text-amber-600" />
          แจ้งเตือน Stock
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {empty ? (
          <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Stock ปกติ ไม่มีรายการเตือน
          </div>
        ) : (
          <>
            {topExp.map((s) => (
              <div key={`exp-${s.name}`} className="flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span className="flex-1 truncate text-xs">{s.name}</span>
                <Badge
                  variant={s.days <= 30 ? "red-soft" : "yellow-soft"}
                  className="text-[10px] tabular-nums shrink-0"
                >
                  {s.days <= 0 ? "หมดอายุแล้ว" : `${s.days} วัน`}
                </Badge>
              </div>
            ))}
            {topSolv.map((s) => (
              <div key={`sol-${s.name}`} className="flex items-center gap-2">
                <Droplet className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                <span className="flex-1 truncate text-xs">{s.name}</span>
                <Badge variant="primary-soft" className="text-[10px] tabular-nums shrink-0">
                  {s.qty} ขวด
                </Badge>
              </div>
            ))}
            {expiring.length + lowSolvents.length > topExp.length + topSolv.length ? (
              <p className="text-[11px] text-muted-foreground pt-1">
                + อีก {expiring.length + lowSolvents.length - topExp.length - topSolv.length} รายการ
              </p>
            ) : null}
          </>
        )}
        {onClick && (
          <Button variant="outline" size="sm" className="w-full mt-1" onClick={onClick}>
            จัดการสต๊อก
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function HeroApprovalCard({ sample, onClick }: { sample: SampleItem; onClick: () => void }) {
  return (
    <Card className="relative overflow-hidden border-amber-200 shadow-md">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-300" />
      <CardContent className="pt-5 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-amber-700">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
              ผลวิเคราะห์รอ QC อนุมัติ
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground mt-1">{sample.id}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {sample.name}
              {sample.receiver ? ` · ผู้วิเคราะห์ ${sample.receiver}` : ""}
            </p>
          </div>
          <Badge variant="yellow-soft">รออนุมัติ</Badge>
        </div>
        <div className="grid grid-cols-2 gap-3 rounded-md bg-muted/30 p-3 mb-3 text-xs">
          <Field label="เครื่องมือ" value={sample.instrument ?? "—"} />
          <Field label="วันที่ส่ง" value={sample.date ?? "—"} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onClick} className="gap-2">
            <CheckCircle2 className="h-4 w-4" /> ตรวจสอบและอนุมัติ
          </Button>
          <Button variant="outline" onClick={onClick} className="gap-2">
            ดูรายละเอียด <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function HeroAssignCard({ petition, onClick }: { petition: Petition; onClick: () => void }) {
  const status = PETITION_STATUS_CONFIG[petition.status];
  const ageHours = ageHoursFrom(petition.receivedAt ?? petition.sampleSentAt ?? petition.createdAt);
  const sampleList = petition.items.slice(0, 3);
  const extra = Math.max(0, petition.items.length - sampleList.length);

  return (
    <Card className="relative overflow-hidden border-primary/30 shadow-md">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/30" />
      <CardContent className="pt-5 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              คำขอรอมอบหมาย Lab
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground mt-1">{petition.petitionNo}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {PETITION_DEPT_LABELS[petition.dept]} · {petition.submittedBy?.name ?? "-"}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Badge variant={status?.variant ?? "gray-soft"}>{status?.label}</Badge>
            {ageHours !== null ? (
              <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                <Clock className="h-3 w-3" /> {ageHours} ชม.
              </span>
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-1.5 rounded-md bg-muted/30 p-3 mb-3">
          {sampleList.map((it) => (
            <div key={it.seq} className="flex items-center justify-between gap-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{it.sampleName}</p>
                <p className="text-[11px] text-muted-foreground truncate">Batch {it.batchNo}</p>
              </div>
            </div>
          ))}
          {extra > 0 ? <p className="text-[11px] text-muted-foreground">+ อีก {extra} รายการ</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onClick} className="gap-2">
            <UserCheck className="h-4 w-4" /> มอบหมาย Lab
          </Button>
          <Button variant="outline" onClick={onClick} className="gap-2">
            ดูรายละเอียด <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ApprovalQueueRow({ sample, onClick }: { sample: SampleItem; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-primary text-sm">{sample.id}</span>
            <Badge variant="yellow-soft" className="text-[10px]">รออนุมัติ</Badge>
          </div>
          <p className="truncate text-xs text-muted-foreground mt-0.5">
            {sample.name}
            {sample.instrument ? ` · ${sample.instrument}` : ""}
          </p>
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </li>
  );
}

function PetitionQueueRow({ petition, onClick }: { petition: Petition; onClick: () => void }) {
  const status = PETITION_STATUS_CONFIG[petition.status];
  const ageHours = ageHoursFrom(petition.sampleSentAt ?? petition.createdAt);
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-primary text-sm">{petition.petitionNo}</span>
            <Badge variant={status?.variant ?? "gray-soft"} className="text-[10px]">{status?.label}</Badge>
          </div>
          <p className="truncate text-xs text-muted-foreground mt-0.5">
            {petition.items.length} ตัวอย่าง · {petition.items[0]?.sampleName ?? "-"}
          </p>
        </div>
        {ageHours !== null ? (
          <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">{ageHours} ชม.</span>
        ) : null}
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </li>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-medium mt-0.5">{value}</p>
    </div>
  );
}
