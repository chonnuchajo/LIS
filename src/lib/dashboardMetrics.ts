import {
  PETITION_STATUS_CONFIG, PETITION_DEPT_LABELS,
  type Petition, type PetitionStatus, type PetitionDept,
} from "@/types/petition.types";
import type { KpiId } from "@/lib/dashboardProfiles";

export interface MetricsCtx {
  petitions: Petition[];
  now: number;
  abnormalFlags: Record<string, boolean>;
  returnedFlags: Record<string, boolean>;
  pendingQcCount: number;
  assignedToMeCount: number;
  usersTotal: number;
  usersActive: number;
  rolesTotal: number;
  dailyCheckPending: number;
  stockLow: number;
  stockExpiring: number;
  withdrawalsToday: number;
  withdrawalsYesterday: number;
  qcApprovedToday: number;
  qcApprovedYesterday: number;
  methodGaps: number;
  masterItemsTotal: number;
}

export interface KpiValue { value: number; delta?: number }

// ---- date helpers ----
export function ageHours(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((now - t) / 3_600_000));
}
function startOfLocalDay(now: number, dayOffset = 0): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - dayOffset);
  return d.getTime();
}
export function isSameLocalDay(iso: string | null | undefined, now: number): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= startOfLocalDay(now, 0) && t < startOfLocalDay(now, -1);
}
export function isPrevLocalDay(iso: string | null | undefined, now: number): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= startOfLocalDay(now, 1) && t < startOfLocalDay(now, 0);
}

// ---- aggregations ----
const STATUS_COLORS: Record<PetitionStatus, string> = {
  deliveringQC: "hsl(215,16%,60%)",
  sampleSent: "hsl(217,91%,60%)",
  pendingReview: "hsl(38,92%,50%)",
  inProgress: "hsl(217,91%,55%)",
  success: "hsl(142,71%,45%)",
  approved: "hsl(142,71%,40%)",
  rejected: "hsl(0,72%,51%)",
};

export function countByStatus(petitions: Petition[]): Record<PetitionStatus, number> {
  const out = {
    deliveringQC: 0, sampleSent: 0, pendingReview: 0, inProgress: 0,
    success: 0, approved: 0, rejected: 0,
  } as Record<PetitionStatus, number>;
  for (const p of petitions) out[p.status] = (out[p.status] ?? 0) + 1;
  return out;
}

export function statusDonutData(petitions: Petition[]) {
  const counts = countByStatus(petitions);
  return (Object.keys(counts) as PetitionStatus[])
    .filter((k) => counts[k] > 0)
    .map((k) => ({ key: k, label: PETITION_STATUS_CONFIG[k].label, value: counts[k], color: STATUS_COLORS[k] }));
}

const PIPELINE: { key: PetitionStatus; label: string }[] = [
  { key: "sampleSent", label: "รอรับ" },
  { key: "pendingReview", label: "รับแล้ว" },
  { key: "inProgress", label: "กำลังตรวจ" },
  { key: "success", label: "เสร็จ" },
];
export function pipelineStages(petitions: Petition[]) {
  const counts = countByStatus(petitions);
  return PIPELINE.map((s) => ({ key: s.key, label: s.label, count: counts[s.key] }));
}

export function deptWorkloadData(petitions: Petition[]) {
  const by = {} as Record<PetitionDept, number>;
  for (const p of petitions) by[p.dept] = (by[p.dept] ?? 0) + 1;
  return (Object.keys(PETITION_DEPT_LABELS) as PetitionDept[])
    .map((d) => ({ dept: d, label: PETITION_DEPT_LABELS[d], count: by[d] ?? 0 }))
    .filter((x) => x.count > 0);
}

export function analystWorkloadData(petitions: Petition[]) {
  const by = new Map<string, number>();
  for (const p of petitions) {
    if (p.status !== "inProgress") continue;
    const name = p.assignedTo?.name?.trim();
    if (!name) continue;
    by.set(name, (by.get(name) ?? 0) + 1);
  }
  return [...by.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

export function normalDonutData(petitions: Petition[], abnormalFlags: Record<string, boolean>) {
  let abnormal = 0;
  for (const p of petitions) if (abnormalFlags[p._id]) abnormal += 1;
  const normal = petitions.length - abnormal;
  return [
    { key: "normal", label: "ปกติ", value: normal, color: "hsl(142,71%,45%)" },
    { key: "abnormal", label: "ผิดปกติ", value: abnormal, color: "hsl(0,72%,51%)" },
  ].filter((x) => x.value > 0);
}

export function requestTrendData(petitions: Petition[], now: number, days: number) {
  const buckets: { date: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const start = startOfLocalDay(now, i);
    const end = startOfLocalDay(now, i - 1);
    const label = new Date(start).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
    const count = petitions.filter((p) => {
      const t = new Date(p.createdAt).getTime();
      return t >= start && t < end;
    }).length;
    buckets.push({ date: label, count });
  }
  return buckets;
}

/** success/approved whose completedAt (fallback approvedAt/updatedAt) lands on local day `dayOffset`. */
export function completedIn(petitions: Petition[], now: number, dayOffset: number): number {
  const start = startOfLocalDay(now, dayOffset);
  const end = startOfLocalDay(now, dayOffset - 1);
  return petitions.filter((p) => {
    if (p.status !== "success" && p.status !== "approved") return false;
    const iso = p.completedAt ?? p.approvedAt ?? p.updatedAt;
    const t = new Date(iso).getTime();
    return t >= start && t < end;
  }).length;
}

function countStatus(petitions: Petition[], status: PetitionStatus): number {
  return petitions.filter((p) => p.status === status).length;
}
function countFlags(flags: Record<string, boolean>): number {
  return Object.values(flags).filter(Boolean).length;
}

// ---- KPI dispatch ----
export function computeKpi(id: KpiId, ctx: MetricsCtx): KpiValue {
  const P = ctx.petitions;
  switch (id) {
    case "petitionsTotal": return { value: P.length };
    case "inProgress": return { value: countStatus(P, "inProgress") };
    case "waitingReceive": return { value: countStatus(P, "sampleSent") };
    case "pendingAssign": return { value: countStatus(P, "pendingReview") };
    case "waitingSendLab": return { value: countStatus(P, "pendingReview") };
    case "completedTotal": return { value: countStatus(P, "success") + countStatus(P, "approved") };
    case "activeTotal":
      return { value: countStatus(P, "inProgress") + countStatus(P, "pendingReview") + countStatus(P, "sampleSent") };
    case "pendingApprovalQc": return { value: ctx.pendingQcCount };
    case "pendingApprovalLab": return { value: countStatus(P, "inProgress") };
    case "assignedToMe": return { value: ctx.assignedToMeCount };
    case "completedToday":
      return { value: completedIn(P, ctx.now, 0), delta: completedIn(P, ctx.now, 0) - completedIn(P, ctx.now, 1) };
    case "qcApprovedToday":
      return { value: ctx.qcApprovedToday, delta: ctx.qcApprovedToday - ctx.qcApprovedYesterday };
    case "withdrawalsToday":
      return { value: ctx.withdrawalsToday, delta: ctx.withdrawalsToday - ctx.withdrawalsYesterday };
    case "abnormalResults": return { value: countFlags(ctx.abnormalFlags) };
    case "returnedTotal": return { value: countFlags(ctx.returnedFlags) };
    case "normalRateApprox": {
      const total = P.length;
      const abn = countFlags(ctx.abnormalFlags);
      return { value: total === 0 ? 100 : Math.round(100 * (1 - abn / total)) };
    }
    case "usersTotal": return { value: ctx.usersTotal };
    case "usersActive": return { value: ctx.usersActive };
    case "rolesTotal": return { value: ctx.rolesTotal };
    case "dailyCheckPending": return { value: ctx.dailyCheckPending };
    case "stockLow": return { value: ctx.stockLow };
    case "stockExpiring": return { value: ctx.stockExpiring };
    case "methodGaps": return { value: ctx.methodGaps };
    case "masterItemsTotal": return { value: ctx.masterItemsTotal };
    default: return { value: 0 };
  }
}
