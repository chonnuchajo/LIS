export interface AccessUser {
  role?: string;
  status?: "active" | "inactive";
  permissions?: string[];
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

export function userCanAccessPath(
  user: AccessUser | null | undefined,
  pathname: string,
  groups: { id: string; paths?: string[] }[],
) {
  if (!user || user.status === "inactive" || !user.role) return false;
  if (user.role === "admin") return true;

  const permissions = user.permissions ?? [];
  for (const entry of permissions) {
    if (entry.startsWith("/")) {
      if (pathMatches(entry, pathname)) return true;
      continue;
    }
    if (entry === "others") {
      const coveredByOtherGroup = groups
        .filter((group) => group.id !== "others")
        .some((group) => (group.paths ?? []).some((path) => pathMatches(path, pathname)));
      if (!coveredByOtherGroup) return true;
      continue;
    }
    const group = groups.find((g) => g.id === entry);
    if (group && (group.paths ?? []).some((path) => pathMatches(path, pathname))) {
      return true;
    }
  }
  return false;
}
