import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { normalizeRoles, unionPermissions } from "@/lib/roles";
import { loadAccessControl } from "@/lib/accessControlSource";

/**
 * The current user's effective permissions — the de-duped union of every role's
 * permission list (grants, group ids, `others`, and `deny:` tab tokens) — plus an
 * `isAdmin` flag. Shares the ["access-control"] query with useCanAccessPath, so no
 * extra fetch.
 */
export function useEffectivePermissions(): { permissions: string[]; isAdmin: boolean } {
  const { user } = useAuth();
  const { data: accessControl } = useQuery({
    queryKey: ["access-control"],
    queryFn: () => loadAccessControl(),
    staleTime: 5 * 60 * 1000,
  });
  return useMemo(() => {
    const roles = normalizeRoles(user);
    const permsByRole = accessControl?.permissions ?? {};
    return {
      permissions: unionPermissions(roles, permsByRole),
      isAdmin: roles.includes("admin"),
    };
  }, [accessControl, user]);
}
