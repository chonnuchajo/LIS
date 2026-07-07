import { NAV_ITEMS } from "@/lib/navItems";
import type { AppUser, AccessGroup } from "@/components/lis/access/types";

export function filterUsers(
  users: AppUser[],
  f: { search?: string; dept?: string; role?: string; status?: string },
): AppUser[] {
  const q = (f.search ?? "").trim().toLowerCase();
  return users.filter((u) => {
    if (q) {
      const hay = `${u.name} ${u.email} ${u.employeeId}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.dept && u.department !== f.dept) return false;
    if (f.role && !u.roleIds.includes(f.role)) return false;
    if (f.status && u.status !== f.status) return false;
    return true;
  });
}

export function paginate<T>(list: T[], page: number, pageSize: number): { items: T[]; total: number; pageCount: number } {
  const total = list.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const clamped = Math.min(Math.max(1, page), pageCount);
  const start = (clamped - 1) * pageSize;
  return { items: list.slice(start, start + pageSize), total, pageCount };
}

export function countUsersInRole(users: AppUser[], roleId: string): number {
  return users.filter((u) => {
    const ids = u.roleIds?.length ? u.roleIds : (u.roleId ? [u.roleId] : []);
    return ids.includes(roleId);
  }).length;
}

export function rolePermissionCount(permissions: Record<string, string[]>, roleId: string): number {
  return (permissions[roleId] ?? []).length;
}

const NAV_LABEL_BY_PATH: Record<string, string> = Object.fromEntries(NAV_ITEMS.map((i) => [i.path, i.label]));

export function accessibleModules(
  permissions: Record<string, string[]>,
  roleId: string,
  groups: AccessGroup[],
): string[] {
  const groupName: Record<string, string> = Object.fromEntries(groups.map((g) => [g.id, g.name]));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const perm of permissions[roleId] ?? []) {
    let label: string | undefined;
    if (groupName[perm]) label = groupName[perm];
    else if (NAV_LABEL_BY_PATH[perm]) label = NAV_LABEL_BY_PATH[perm];
    else if (perm === "others") label = "อื่นๆ";
    if (label && !seen.has(label)) {
      seen.add(label);
      out.push(label);
    }
  }
  return out;
}

export function distinctDepartments(users: AppUser[]): string[] {
  return [...new Set(users.map((u) => u.department).filter(Boolean))].sort();
}
