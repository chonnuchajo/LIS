import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import {
  defaultLayout,
  resolveLayoutForRoles,
  type DashboardId,
  type DashboardLayout,
} from "@/lib/dashboardLayout";

// Resolve the effective layout for the current user on a dashboard:
// first matching role → '_default' → catalog default. Never blocks render —
// while loading (or on error) it returns the catalog default so the dashboard
// looks exactly as it does today.
export function useDashboardLayout(dashboard: DashboardId): DashboardLayout {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["dashboard-layout", dashboard],
    queryFn: () => api.getDashboardLayouts(dashboard),
  });

  return useMemo(() => {
    const roleIds = user?.roles ?? (user?.role ? [user.role] : []);
    if (!data) return defaultLayout(dashboard);
    return resolveLayoutForRoles(dashboard, data, roleIds);
  }, [data, dashboard, user?.roles, user?.role]);
}
