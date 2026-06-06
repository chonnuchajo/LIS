// Shared role logic. One user can hold several roles; permissions are the union
// of every held role, while single-behaviour branches (home, redirects, display)
// resolve to the highest-priority role. Mirrored in server/lib/roles.js — keep
// the two in sync (tests live here).

export interface RoleHolder {
  role?: string;
  roles?: string[];
}

// Higher number = higher priority. admin > qc(-*) > lab(-*) > custom > viewer.
function roleRank(role: string): number {
  if (role === "admin") return 4;
  if (role === "qc" || role.startsWith("qc-") || role.startsWith("qc_")) return 3;
  if (role === "lab" || role.startsWith("lab-") || role.startsWith("lab_")) return 2;
  if (role === "viewer") return 0;
  return 1; // any other custom role
}

/** Highest-priority role in the list, or "viewer" when empty. Ties break by
 *  array order (first wins). */
export function primaryRole(roles: string[]): string {
  if (!roles || roles.length === 0) return "viewer";
  let best = roles[0];
  let bestRank = roleRank(best);
  for (let i = 1; i < roles.length; i += 1) {
    const rank = roleRank(roles[i]);
    if (rank > bestRank) {
      best = roles[i];
      bestRank = rank;
    }
  }
  return best;
}

/** The lazy-migration shim: prefer `roles`, fall back to legacy single `role`. */
export function normalizeRoles(user: RoleHolder | null | undefined): string[] {
  if (!user) return [];
  if (user.roles && user.roles.length > 0) return user.roles;
  if (user.role) return [user.role];
  return [];
}

/** Union of every role's permissions, de-duped, stable order. */
export function unionPermissions(
  roles: string[],
  permsByRole: Record<string, string[]>,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const role of roles) {
    for (const perm of permsByRole[role] ?? []) {
      if (!seen.has(perm)) {
        seen.add(perm);
        out.push(perm);
      }
    }
  }
  return out;
}
