import { primaryRole } from "@/lib/roles";

// Dev mode bypasses Microsoft login and injects a hardcoded user.
// Vite sets import.meta.env.DEV to false for production builds.
export const DEV_MODE =
  import.meta.env.DEV && import.meta.env.VITE_DEV_MODE !== "false";

export const DEV_DEFAULT_ROLE = "admin";

export type RoleFamily = "" | "lab" | "qc";

export type DevRoleOption = {
  id: string;
  name: string;
  family?: RoleFamily | null;
};

export type DevAuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  roles: string[];
  permissions: string[];
  department: string;
  position: string;
  employeeId: string;
  status: "active";
};

const LAB_DEV_BASE_ROLE = "lab-analyze";
const QC_DEV_BASE_ROLE = "qc-staff";

function normalizeFamily(value: unknown): RoleFamily {
  const family = String(value ?? "").trim().toLowerCase();
  return family === "lab" || family === "qc" ? family : "";
}

function normalizeRoleId(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function roleFamilyForDevRole(roleId: string, explicitFamily?: unknown): RoleFamily {
  if (explicitFamily !== undefined && explicitFamily !== null) {
    return normalizeFamily(explicitFamily);
  }
  if (roleId === "lab" || roleId.startsWith("lab-") || roleId.startsWith("lab_")) return "lab";
  if (roleId === "qc" || roleId.startsWith("qc-") || roleId.startsWith("qc_")) return "qc";
  return "";
}

function baseRoleForDevFamily(family: RoleFamily) {
  if (family === "lab") return LAB_DEV_BASE_ROLE;
  if (family === "qc") return QC_DEV_BASE_ROLE;
  return "";
}

function familyForDevBaseRole(roleId: string): RoleFamily {
  if (roleId === LAB_DEV_BASE_ROLE) return "lab";
  if (roleId === QC_DEV_BASE_ROLE) return "qc";
  return "";
}

function uniqueRoleIds(ids: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const normalized = normalizeRoleId(id);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function rolesById(roles: DevRoleOption[]) {
  return new Map(roles.map((role) => [role.id, role]));
}

export function normalizeDevRoleSelection(roleIds: string[], roles: DevRoleOption[]): string[] {
  const byId = rolesById(roles);
  const selected = uniqueRoleIds(roleIds).filter((id) => byId.has(id));
  const kept: string[] = [];
  const families = new Set<RoleFamily>();

  for (const id of selected) {
    const role = byId.get(id);
    const family = roleFamilyForDevRole(id, role?.family);
    const baseRole = baseRoleForDevFamily(family);
    if (baseRole && !byId.has(baseRole)) continue;
    kept.push(id);
    if (family) families.add(family);
  }

  const withBase = [...kept];
  for (const family of families) {
    const baseRole = baseRoleForDevFamily(family);
    if (baseRole && byId.has(baseRole)) withBase.push(baseRole);
  }

  const normalized = uniqueRoleIds(withBase);
  if (normalized.length > 0) return normalized;
  return byId.has(DEV_DEFAULT_ROLE) ? [DEV_DEFAULT_ROLE] : [];
}

export function toggleDevRoleSelection(
  currentIds: string[],
  toggledId: string,
  roles: DevRoleOption[],
): string[] {
  const byId = rolesById(roles);
  const id = normalizeRoleId(toggledId);
  if (!byId.has(id)) return normalizeDevRoleSelection(currentIds, roles);

  const current = normalizeDevRoleSelection(currentIds, roles);
  const role = byId.get(id);
  const family = familyForDevBaseRole(id) || roleFamilyForDevRole(id, role?.family);
  const baseRole = baseRoleForDevFamily(family);
  const next = current.includes(id)
    ? id === baseRole
      ? current.filter(
          (roleId) =>
            (familyForDevBaseRole(roleId) || roleFamilyForDevRole(roleId, byId.get(roleId)?.family)) !== family,
        )
      : current.filter((roleId) => roleId !== id)
    : [...current, id];

  return normalizeDevRoleSelection(next, roles);
}

// Mock the HR/Microsoft department per dev role (prod gets it from Microsoft sync).
// admin→IT, lab*→lab, qc*→qc, viewer→ผลิต 1.
const devDepartment = (roleId: string): string => {
  if (roleId === "admin") return "IT";
  if (roleId.startsWith("lab")) return "lab";
  if (roleId.startsWith("qc")) return "qc";
  if (roleId === "viewer") return "ผลิต 1";
  return roleId;
};

// Departments a dev can impersonate from the DevRoleSwitcher. Department is
// free-text from HR in prod, but these are the values that actually change
// behaviour — R&D skips ผู้นำส่ง/เลขแบช on the production petition form
// (requiresDeliveryAndBatch), and ผลิต 1–5 / RM drive customerCodeFromDepartment.
export const DEV_DEPARTMENTS = [
  "R&D",
  "คลังสินค้า RM",
  "ผลิต 1",
  "ผลิต 2",
  "ผลิต 3",
  "ผลิต 4",
  "ผลิต 5",
] as const;

export type DevDepartment = (typeof DEV_DEPARTMENTS)[number];

// "" (or anything unknown) = ตามบทบาท — keep the role-derived department.
export function normalizeDevDepartment(value: unknown): string {
  const dept = String(value ?? "").trim();
  return (DEV_DEPARTMENTS as readonly string[]).includes(dept) ? dept : "";
}

export const synthesizeDevUser = (
  roles: DevRoleOption[],
  departmentOverride?: string | null,
): DevAuthUser => {
  const ids = roles.map((r) => r.id);
  const primaryId = primaryRole(ids);
  const primary = roles.find((r) => r.id === primaryId) ?? roles[0];
  return {
    id: `dev-${primary.id}`,
    email: `${primary.id}.dev@icpladda.com`,
    name: `Dev ${primary.name}`,
    role: primary.id,
    roles: ids,
    permissions: [],
    department: normalizeDevDepartment(departmentOverride) || devDepartment(primary.id),
    position: primary.name,
    employeeId: `DEV-${primary.id}`,
    status: "active",
  };
};

// Lab roles offered as fake assignees on /petitions/assign in dev mode. The HR
// API only returns real staff, so dev has no one to assign to — these let you
// assign a petition and then switch to that dev role to test the lab pages.
export const DEV_LAB_ROLES = [
  { id: "lab-analyst", name: "Lab Analyst" },
  { id: "lab-head", name: "Lab Head" },
  { id: "lab-inventory", name: "Lab Inventory" },
] as const;

export type DevAssignee = {
  id: number;
  employeeId: string;
  name: string;
  department: string;
  position: string;
  empType: string;
  isActive: boolean;
};

// `name` mirrors synthesizeDevUser so LabTestingPage's
// `assignedTo?.name === user?.name` filter matches after switching dev role.
export const synthesizeDevAssignees = (): DevAssignee[] =>
  DEV_LAB_ROLES.map((role, index) => ({
    id: -(index + 1),
    employeeId: `DEV-${role.id}`,
    name: synthesizeDevUser([role]).name,
    department: "Lab/วิเคราะห์",
    position: role.name,
    empType: "รายเดือน",
    isActive: true,
  }));
