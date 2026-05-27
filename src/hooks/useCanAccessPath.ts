import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { userCanAccessPath } from "@/lib/accessControl";

type AccessGroup = { id: string; paths?: string[] };
type AccessControlState = {
  groups: AccessGroup[];
  permissions: Record<string, string[]>;
};

const ACCESS_CONTROL_QUERY_KEY = ["access-control"];

/**
 * Returns a memoized predicate that says whether the current user can navigate
 * to a given path according to the access-control matrix. Use this to gate
 * buttons/cards that link to other pages, so QC staff (for example) don't see
 * a button to "/qc-approval" if their role isn't allowed there.
 */
export function useCanAccessPath() {
  const { user } = useAuth();

  const { data: accessControl } = useQuery({
    queryKey: ACCESS_CONTROL_QUERY_KEY,
    queryFn: async () => {
      const res = await api.get<AccessControlState>("/access-control");
      return res.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  return useMemo(() => {
    const groups = accessControl?.groups ?? [];
    const effectiveUser =
      user?.role && accessControl?.permissions?.[user.role]
        ? { ...user, permissions: accessControl.permissions[user.role] }
        : user;
    return (path: string) => userCanAccessPath(effectiveUser, path, groups);
  }, [accessControl, user]);
}
