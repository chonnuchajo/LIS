export type ModuleId = string;

export interface AccessUser {
  role?: string;
  status?: "active" | "inactive";
  permissions?: string[];
}

export function hasModulePermission(user: AccessUser | null | undefined, moduleId?: ModuleId) {
  if (!moduleId) return true;
  if (!user || user.status === "inactive" || !user.role) return false;
  if (user.role === "admin") return true;
  return (user.permissions ?? []).includes(moduleId);
}
