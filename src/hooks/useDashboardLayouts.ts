import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { DashboardId } from "@/lib/dashboardLayout";

// All stored configs for one dashboard, keyed for the settings editor.
export function useDashboardLayouts(dashboard: DashboardId) {
  return useQuery({
    queryKey: ["dashboard-layout", dashboard],
    queryFn: () => api.getDashboardLayouts(dashboard),
  });
}
