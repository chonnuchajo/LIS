// Single source of truth for Lab/QC dashboard layout config (frontend).
// Mirrors server/lib/dashboardLayout.js — keep section/kpi ids in sync.

export type DashboardId = "lab" | "qc";
export type SectionId = "header" | "kpi" | "primaryTable" | "rightRail" | "completed";
export type KpiId = "all" | "waiting" | "inProgress" | "completed";

export interface SectionDef {
  id: SectionId;
  label: string;
  toggleable: boolean; // can be hidden
  reorderable: boolean; // can move in order
}

export interface SectionConfig {
  id: SectionId;
  enabled: boolean;
  order: number;
}

export type KpiFlags = Record<KpiId, boolean>;

export interface DashboardLayout {
  sections: SectionConfig[];
  kpis: KpiFlags;
}

export interface StoredLayout extends DashboardLayout {
  dashboard: DashboardId;
  roleId: string;
}

export const DASHBOARD_IDS: DashboardId[] = ["lab", "qc"];
export const DEFAULT_ROLE_ID = "_default";
export const FORCED_SECTIONS: SectionId[] = ["header", "primaryTable"];

export const KPI_CATALOG: { id: KpiId; label: string }[] = [
  { id: "all", label: "งานทั้งหมด / ติดตาม" },
  { id: "waiting", label: "รอรับเข้าระบบ" },
  { id: "inProgress", label: "กำลังดำเนินการ" },
  { id: "completed", label: "ตรวจเสร็จแล้ว" },
];

const RIGHT_RAIL_LABEL: Record<DashboardId, string> = {
  lab: "การ์ดตัวอย่างรอรับเข้า",
  qc: "การ์ดตัวอย่างรอ QC",
};

export function sectionCatalog(dashboard: DashboardId): SectionDef[] {
  return [
    { id: "header", label: "หัวเรื่อง + ค้นหา", toggleable: false, reorderable: false },
    { id: "kpi", label: "แถบ KPI", toggleable: true, reorderable: true },
    { id: "primaryTable", label: "ตารางคำร้องหลัก", toggleable: false, reorderable: true },
    { id: "rightRail", label: RIGHT_RAIL_LABEL[dashboard], toggleable: true, reorderable: true },
    { id: "completed", label: 'กล่อง "ตรวจเสร็จแล้ว"', toggleable: true, reorderable: true },
  ];
}

export function defaultLayout(dashboard: DashboardId): DashboardLayout {
  return {
    sections: sectionCatalog(dashboard).map((s, i) => ({ id: s.id, enabled: true, order: i })),
    kpis: { all: true, waiting: true, inProgress: true, completed: true },
  };
}

type PartialLayout = { sections?: SectionConfig[]; kpis?: Partial<KpiFlags> } | null | undefined;

// Normalize a (possibly partial / out-of-order) stored config into a full,
// ordered, header-first list with contiguous order indices.
export function resolveSections(dashboard: DashboardId, config: PartialLayout): SectionConfig[] {
  const catalog = sectionCatalog(dashboard);
  const stored = new Map((config?.sections ?? []).map((s) => [s.id, s]));

  const merged: SectionConfig[] = catalog.map((def, i) => {
    const s = stored.get(def.id);
    return {
      id: def.id,
      enabled: s ? !!s.enabled : true,
      order: s && typeof s.order === "number" ? s.order : i,
    };
  });

  for (const m of merged) {
    if (FORCED_SECTIONS.includes(m.id)) m.enabled = true;
  }

  merged.sort((a, b) => {
    if (a.id === "header") return -1;
    if (b.id === "header") return 1;
    return a.order - b.order;
  });

  return merged.map((m, i) => ({ ...m, order: i }));
}

export function resolveKpis(config: PartialLayout): KpiFlags {
  const k = config?.kpis ?? {};
  return {
    all: k.all ?? true,
    waiting: k.waiting ?? true,
    inProgress: k.inProgress ?? true,
    completed: k.completed ?? true,
  };
}

function normalize(dashboard: DashboardId, c: PartialLayout): DashboardLayout {
  return { sections: resolveSections(dashboard, c), kpis: resolveKpis(c) };
}

// Pick the effective layout for a user: first matching role (array order),
// then the shared default role, then the hard-coded catalog default.
export function resolveLayoutForRoles(
  dashboard: DashboardId,
  configs: StoredLayout[],
  roleIds: string[],
): DashboardLayout {
  const byRole = new Map(configs.filter((c) => c.dashboard === dashboard).map((c) => [c.roleId, c]));
  for (const rid of roleIds) {
    const hit = byRole.get(rid);
    if (hit) return normalize(dashboard, hit);
  }
  const def = byRole.get(DEFAULT_ROLE_ID);
  if (def) return normalize(dashboard, def);
  return defaultLayout(dashboard);
}
