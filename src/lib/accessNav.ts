import { userCanAccessPath } from "@/lib/accessControl";
import { NAV_ITEMS, type NavItem } from "@/lib/navItems";
import { unionPermissions } from "@/lib/roles";

type AccessNavMatrix = {
  groups?: { id: string; paths?: string[] }[];
  permissions?: Record<string, string[]>;
} | null | undefined;

export function getAccessibleNavItemsForRoles(
  roles: string[],
  access: AccessNavMatrix,
): NavItem[] {
  if (!access || roles.length === 0) return [];

  const user = {
    roles,
    status: "active" as const,
    permissions: unionPermissions(roles, access.permissions ?? {}),
  };
  const groups = access.groups ?? [];
  const seenPaths = new Set<string>();

  return NAV_ITEMS.filter((item) => item.path !== "/home")
    .filter((item) => userCanAccessPath(user, item.path, groups))
    .filter((item) => {
      if (seenPaths.has(item.path)) return false;
      seenPaths.add(item.path);
      return true;
    });
}
