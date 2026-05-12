export type GroupId = string;

export interface AccessUser {
  role?: string;
  status?: "active" | "inactive";
  permissions?: string[];
}

export function hasGroupPermission(user: AccessUser | null | undefined, groupId?: GroupId) {
  if (!groupId) return true;
  if (!user || user.status === "inactive" || !user.role) return false;
  if (user.role === "admin") return true;
  return (user.permissions ?? []).includes(groupId);
}

function normalizePath(path: string) {
  if (!path || path === "/") return "/";
  return path.replace(/\/+$/, "");
}

export function pathMatches(pattern: string, pathname: string) {
  const normalizedPattern = normalizePath(pattern);
  const normalizedPath = normalizePath(pathname);

  if (normalizedPattern === normalizedPath) return true;
  if (normalizedPattern.endsWith("/*")) {
    return normalizedPath.startsWith(normalizedPattern.slice(0, -2));
  }

  const patternParts = normalizedPattern.split("/");
  const pathParts = normalizedPath.split("/");
  if (patternParts.length !== pathParts.length) return false;

  return patternParts.every((part, index) => part.startsWith(":") || part === pathParts[index]);
}

export function findGroupIdsForPath(
  pathname: string,
  groups: { id: string; paths?: string[] }[],
) {
  return groups
    .filter((group) => (group.paths ?? []).some((path) => pathMatches(path, pathname)))
    .map((group) => group.id);
}

export function userMatchesAnyGroup(
  user: AccessUser | null | undefined,
  groupIds: string[],
) {
  if (groupIds.length === 0) return true;
  return groupIds.some((id) => hasGroupPermission(user, id));
}
