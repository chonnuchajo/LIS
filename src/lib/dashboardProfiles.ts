import {
  Users, UserCheck, ShieldCheck, FlaskConical, ClipboardList, Hourglass,
  AlertTriangle, CheckCircle2, Package, Droplet, Database, Scale, RotateCcw,
  Gauge, ClipboardCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { primaryRole } from "@/lib/roles";

export type DashboardProfileId =
  | "admin" | "lab-analyze" | "lab-config" | "lab-head" | "lab-inventory"
  | "qc-staff" | "qc-reviewer" | "qc-head" | "viewer";

export const DASHBOARD_PROFILE_IDS: DashboardProfileId[] = [
  "admin", "lab-analyze", "lab-config", "lab-head", "lab-inventory",
  "qc-staff", "qc-reviewer", "qc-head", "viewer",
];

export type StatVariant = "blue" | "amber" | "green" | "red" | "neutral";

export type KpiId =
  // petition status (current)
  | "petitionsTotal" | "inProgress" | "waitingReceive" | "pendingAssign"
  | "waitingSendLab" | "completedTotal" | "pendingApprovalQc" | "pendingApprovalLab"
  | "assignedToMe" | "activeTotal"
  // time-based (delta today vs yesterday)
  | "completedToday" | "qcApprovedToday" | "withdrawalsToday"
  // flags / approx
  | "abnormalResults" | "returnedTotal" | "normalRateApprox"
  // admin / users
  | "usersTotal" | "usersActive" | "rolesTotal" | "dailyCheckPending"
  // stock
  | "stockLow" | "stockExpiring"
  // config
  | "methodGaps" | "masterItemsTotal";

export interface KpiMeta {
  label: string;
  icon: LucideIcon;
  variant: StatVariant;
  drilldownPath?: string;
}

export const KPI_META: Record<KpiId, KpiMeta> = {
  petitionsTotal:    { label: "คำขอทั้งหมด",   icon: ClipboardList, variant: "neutral", drilldownPath: "/petitions" },
  inProgress:        { label: "กำลังดำเนินการ", icon: FlaskConical,  variant: "blue",    drilldownPath: "/petitions?status=inProgress" },
  waitingReceive:    { label: "รอตรวจรับ",      icon: Hourglass,     variant: "amber",   drilldownPath: "/petitions?status=sampleSent" },
  pendingAssign:     { label: "รอมอบหมาย",      icon: UserCheck,     variant: "blue",    drilldownPath: "/petitions/assign" },
  waitingSendLab:    { label: "รอส่ง Lab",       icon: ClipboardList, variant: "amber",   drilldownPath: "/petitions?status=pendingReview" },
  completedTotal:    { label: "เสร็จสิ้น",       icon: CheckCircle2,  variant: "green",   drilldownPath: "/petitions?status=success" },
  pendingApprovalQc: { label: "รออนุมัติ QC",   icon: ShieldCheck,   variant: "amber",   drilldownPath: "/qc-approval" },
  pendingApprovalLab:{ label: "รออนุมัติ Lab",  icon: ShieldCheck,   variant: "amber",   drilldownPath: "/lab-approval" },
  assignedToMe:      { label: "งานของฉัน",       icon: ClipboardCheck,variant: "blue",    drilldownPath: "/lab-testing" },
  activeTotal:       { label: "งานกำลังทำ",     icon: FlaskConical,  variant: "blue",    drilldownPath: "/petitions" },
  completedToday:    { label: "เสร็จวันนี้",     icon: CheckCircle2,  variant: "green" },
  qcApprovedToday:   { label: "อนุมัติวันนี้",   icon: CheckCircle2,  variant: "green" },
  withdrawalsToday:  { label: "เบิกวันนี้",      icon: Package,       variant: "blue",    drilldownPath: "/stock-deduction" },
  abnormalResults:   { label: "ผลผิดปกติ",       icon: AlertTriangle, variant: "red",     drilldownPath: "/record-results" },
  returnedTotal:     { label: "งานตีกลับ",       icon: RotateCcw,     variant: "red",     drilldownPath: "/petitions" },
  normalRateApprox:  { label: "อัตราปกติ",       icon: Gauge,         variant: "green" },
  usersTotal:        { label: "ผู้ใช้ทั้งหมด",   icon: Users,         variant: "neutral", drilldownPath: "/access-control" },
  usersActive:       { label: "ผู้ใช้ที่ใช้งาน", icon: UserCheck,     variant: "green",   drilldownPath: "/access-control" },
  rolesTotal:        { label: "จำนวน Role",      icon: ShieldCheck,   variant: "neutral", drilldownPath: "/access-control" },
  dailyCheckPending: { label: "Daily Check ค้าง", icon: Scale,        variant: "amber",   drilldownPath: "/daily-check" },
  stockLow:          { label: "สต๊อกต่ำ",        icon: Droplet,       variant: "amber",   drilldownPath: "/stock" },
  stockExpiring:     { label: "ใกล้หมดอายุ",     icon: AlertTriangle, variant: "red",     drilldownPath: "/stock" },
  methodGaps:        { label: "Method ยังขาด",   icon: FlaskConical,  variant: "amber",   drilldownPath: "/simple-method" },
  masterItemsTotal:  { label: "รายการสินค้า",    icon: Database,      variant: "neutral", drilldownPath: "/master-items" },
};

export type WorkflowKind = "statusDonut" | "pipeline";
export type ChartKind = "deptBar" | "normalDonut" | "analystBar" | "withdrawBar" | "requestTrend" | "statusDonut";
export interface ChartSpec { kind: ChartKind; title: string }
export type ActivityKind = "audit" | "statusChanges";

export interface DashboardProfile {
  id: DashboardProfileId;
  titleEn: string;
  subtitleTh: string;
  kpis: KpiId[];
  workflow: WorkflowKind | null;
  analytics: ChartSpec[];
  activity: ActivityKind;
}

export const DASHBOARD_PROFILES: Record<DashboardProfileId, DashboardProfile> = {
  admin: {
    id: "admin", titleEn: "Administrator Dashboard", subtitleTh: "ภาพรวมระบบ · ผู้ใช้ · งานค้าง",
    kpis: ["usersTotal", "usersActive", "rolesTotal", "activeTotal", "dailyCheckPending"],
    workflow: "statusDonut",
    analytics: [{ kind: "deptBar", title: "งานต่อแผนก" }, { kind: "statusDonut", title: "สัดส่วนสถานะคำขอ" }],
    activity: "audit",
  },
  "lab-analyze": {
    id: "lab-analyze", titleEn: "Lab Analyze Dashboard", subtitleTh: "งานวิเคราะห์ของฉัน",
    kpis: ["assignedToMe", "inProgress", "completedToday", "returnedTotal"],
    workflow: "statusDonut",
    analytics: [{ kind: "statusDonut", title: "สถานะงานของฉัน" }],
    activity: "statusChanges",
  },
  "lab-config": {
    id: "lab-config", titleEn: "Lab Data Config Dashboard", subtitleTh: "วิธีวิเคราะห์ · รายการสินค้า",
    kpis: ["methodGaps", "masterItemsTotal"],
    workflow: null,
    analytics: [],
    activity: "statusChanges",
  },
  "lab-head": {
    id: "lab-head", titleEn: "Lab Head Dashboard", subtitleTh: "อนุมัติ · ผิดปกติ · ภาระงาน",
    kpis: ["pendingApprovalLab", "abnormalResults", "activeTotal", "completedToday"],
    workflow: "pipeline",
    analytics: [{ kind: "analystBar", title: "ภาระงานต่อผู้วิเคราะห์" }],
    activity: "statusChanges",
  },
  "lab-inventory": {
    id: "lab-inventory", titleEn: "Lab Inventory Dashboard", subtitleTh: "สต๊อก · หมดอายุ · การเบิก",
    kpis: ["stockLow", "stockExpiring", "withdrawalsToday"],
    workflow: null,
    analytics: [{ kind: "withdrawBar", title: "การเบิกต่อวัน" }],
    activity: "statusChanges",
  },
  "qc-staff": {
    id: "qc-staff", titleEn: "QC Staff Dashboard", subtitleTh: "รับตัวอย่าง · ส่ง Lab · ติดตาม",
    kpis: ["assignedToMe", "waitingReceive", "waitingSendLab", "completedToday", "returnedTotal"],
    workflow: "pipeline",
    analytics: [{ kind: "statusDonut", title: "สัดส่วนสถานะ" }],
    activity: "statusChanges",
  },
  "qc-reviewer": {
    id: "qc-reviewer", titleEn: "QC Reviewer Dashboard", subtitleTh: "ตรวจทาน · อนุมัติผล",
    kpis: ["pendingApprovalQc", "abnormalResults", "returnedTotal", "qcApprovedToday"],
    workflow: "statusDonut",
    analytics: [{ kind: "normalDonut", title: "ปกติ / ผิดปกติ" }],
    activity: "statusChanges",
  },
  "qc-head": {
    id: "qc-head", titleEn: "QC Head Dashboard", subtitleTh: "อนุมัติ · ผิดปกติ · ประสิทธิภาพ",
    kpis: ["pendingApprovalQc", "abnormalResults", "normalRateApprox", "activeTotal"],
    workflow: "statusDonut",
    analytics: [{ kind: "deptBar", title: "งานต่อแผนก" }, { kind: "normalDonut", title: "ปกติ / ผิดปกติ" }],
    activity: "audit",
  },
  viewer: {
    id: "viewer", titleEn: "Viewer Dashboard", subtitleTh: "ภาพรวมผู้บริหาร (อ่านอย่างเดียว)",
    kpis: ["petitionsTotal", "inProgress", "completedTotal", "normalRateApprox"],
    workflow: "statusDonut",
    analytics: [{ kind: "statusDonut", title: "สัดส่วนสถานะ" }, { kind: "requestTrend", title: "คำขอต่อวัน (ในช่วงข้อมูล)" }],
    activity: "statusChanges",
  },
};

const DEFAULT_PROFILE_MAP: Record<string, DashboardProfileId> = {
  admin: "admin", qc: "qc-reviewer", lab: "lab-analyze", viewer: "viewer",
};

/**
 * role.id → profile: explicit dashboardProfile wins, else default map, else
 * rank prefix, else null (no real match). A `null` result means the caller
 * should fall back to the generic menu-grid dashboard, NOT the viewer
 * petition-data dashboard — the explicit `viewer` role still resolves to
 * "viewer" via the default map, so real Viewer users are unaffected.
 */
export function resolveProfileForRole(
  roleId: string,
  roles: { id: string; dashboardProfile?: string | null }[],
): DashboardProfileId | null {
  const explicit = roles.find((r) => r.id === roleId)?.dashboardProfile;
  if (explicit && DASHBOARD_PROFILE_IDS.includes(explicit as DashboardProfileId)) {
    return explicit as DashboardProfileId;
  }
  if (DEFAULT_PROFILE_MAP[roleId]) return DEFAULT_PROFILE_MAP[roleId];
  if (roleId === "qc" || roleId.startsWith("qc-") || roleId.startsWith("qc_")) return "qc-reviewer";
  if (roleId === "lab" || roleId.startsWith("lab-") || roleId.startsWith("lab_")) return "lab-analyze";
  if (roleId === "admin") return "admin";
  return null;
}

/** stored active role wins if the user still holds it, else primaryRole. */
export function resolveActiveRole(roleIds: string[], stored: string | null): string {
  if (stored && roleIds.includes(stored)) return stored;
  return primaryRole(roleIds);
}
