import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { usePetitionList } from "@/hooks/usePetition";
import { useSamples } from "@/context/SampleContext";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { loadAccessControl } from "@/lib/accessControlSource";
import type { DashboardProfile } from "@/lib/dashboardProfiles";
import {
  EMPTY_LAB_INVENTORY_SUMMARY,
  deductionTrendData,
  isAssignedToUser,
  labInventorySummaryData,
  type MetricsCtx,
} from "@/lib/dashboardMetrics";
import { normalizeRoles } from "@/lib/roles";
import { dailyCheckProgressFromSources } from "@/lib/dailyCheckProgress";
import { EQUIPMENT_ROOM_SLUGS } from "@/lib/roomEquipment";
import type { Petition } from "@/types/petition.types";

// /simple-methods entry shape (see server/routes/simpleMethods.js) — keyed by itemNo.
// `methods` is a positional string[][] (one slot per '+'-split substance); a slot is
// "configured" once it holds at least one code. Legacy docs written only to the older
// `instruments` field (methods undefined/empty) are still valid config — clients fall
// back to `instruments` per simpleMethods.js — so those also count as configured.
interface SimpleMethodEntry {
  itemNo: string;
  methods?: string[][];
  instruments?: string[];
}

// /master-items/slim shape (see server/routes/masterItems.js SLIM_KEYS).
interface SlimItem {
  itemNo?: string;
  commonName?: string;
}

// `/master-items/slim` responds `{ data: slim }` itself, and api.get()'s generic
// axios-style wrapper (`{ data: { data } }`) wraps that raw body again — so
// `res.data.data` for this endpoint is `{ data: SlimItem[] }`, not `SlimItem[]`
// directly (unlike `/simple-methods`, which returns the array unwrapped). Same
// quirk already handled defensively in src/hooks/useItemGroupMembership.ts.
function unwrapSlim(payload: unknown): SlimItem[] {
  if (Array.isArray(payload)) return payload as SlimItem[];
  if (payload && typeof payload === "object") {
    const inner = (payload as { data?: unknown }).data;
    if (Array.isArray(inner)) return inner as SlimItem[];
  }
  return [];
}

export interface DashboardData {
  petitions: Petition[];
  ctx: MetricsCtx;
  loading: boolean;
  refresh: () => void;
}

export function useDashboardData(profile: DashboardProfile): DashboardData {
  const { user } = useAuth();
  const kpis = new Set(profile.kpis);
  const need = (id: string) => kpis.has(id as never);
  const roleIds = normalizeRoles(user);
  const wantInventorySummary = roleIds.includes("lab-inventory");

  // caveat: totals/trend bounded to the fetched window (real-only, no server aggregate)
  const { data: petData, loading, refresh } = usePetitionList({ page: 1, limit: 200 });
  const petitions = petData?.items ?? [];
  const ids = petitions.map((p) => p._id);

  const { doneSamples, approvals } = useSamples();

  const wantAbnormal =
    need("abnormalResults") || need("normalRateApprox") || profile.analytics.some((a) => a.kind === "normalDonut");
  const wantReturned = need("returnedTotal");
  const { data: abnormalFlags = {} } = useQuery({
    queryKey: ["dash", "abnormal", ids],
    enabled: wantAbnormal && ids.length > 0,
    queryFn: () => api.getAbnormalFlags(ids),
  });
  const { data: returnedFlags = {} } = useQuery({
    queryKey: ["dash", "returned", ids],
    enabled: wantReturned && ids.length > 0,
    queryFn: () => api.getReturnedFlags(ids),
  });

  const wantStock = wantInventorySummary || need("stockLow") || need("stockExpiring");
  const { data: solvents = [], isLoading: solventsLoading } = useQuery({
    queryKey: ["dash", "solvents"],
    enabled: wantStock,
    queryFn: api.getSolvents,
  });
  const { data: standards = [], isLoading: standardsLoading } = useQuery({
    queryKey: ["dash", "standards"],
    enabled: wantStock,
    queryFn: api.getStandards,
  });
  const { data: glassware = [], isLoading: glasswareLoading } = useQuery({
    queryKey: ["dash", "glassware"],
    enabled: wantStock,
    queryFn: api.getGlassware,
  });
  const { data: stockUnits = [], isLoading: stockUnitsLoading } = useQuery({
    queryKey: ["dash", "stock-units"],
    enabled: wantStock,
    queryFn: () => api.getStockUnits(),
  });

  const wantWithdraw = wantInventorySummary || need("withdrawalsToday") || profile.analytics.some((a) => a.kind === "withdrawBar");
  const { data: txns = [], isLoading: txnsLoading } = useQuery({
    queryKey: ["dash", "txns", "deduct"],
    enabled: wantWithdraw,
    queryFn: () => api.getStockTransactions({ action: "deduct", limit: 500 }),
  });

  const wantDailyProgress = profile.id === "lab-analyze" || need("dailyCheckPending");
  const { data: dailySummary } = useQuery({
    queryKey: ["dash", "daily"],
    enabled: wantDailyProgress,
    queryFn: api.getDailyCheckTodaySummary,
  });
  const { data: envSummary } = useQuery({
    queryKey: ["dash", "env", "today-summary"],
    enabled: wantDailyProgress,
    queryFn: api.getEnvCheckTodaySummary,
  });
  const equipmentCheckQueries = useQueries({
    queries: EQUIPMENT_ROOM_SLUGS.map((room) => ({
      queryKey: ["dash", "equipment-checks", "today", room],
      enabled: wantDailyProgress,
      queryFn: () => api.getEquipmentChecks({ room }),
    })),
  });

  const wantUsers = need("usersTotal") || need("usersActive") || need("rolesTotal");
  const { data: access } = useQuery({
    queryKey: ["access-control"],
    enabled: wantUsers,
    queryFn: () => loadAccessControl(),
  });

  const wantConfig = need("methodGaps") || need("masterItemsTotal");
  const { data: slim = [] } = useQuery({
    queryKey: ["dash", "slim"],
    enabled: wantConfig,
    queryFn: () => api.get<unknown>("/master-items/slim").then((r) => unwrapSlim(r.data.data)),
  });
  const { data: simpleMethods = [] } = useQuery({
    queryKey: ["dash", "simple-methods"],
    enabled: wantConfig,
    queryFn: () => api.get<SimpleMethodEntry[]>("/simple-methods").then((r) => r.data.data),
  });

  const ctx: MetricsCtx = useMemo(() => {
    const now = Date.now();
    const isToday = (iso?: string | null) => {
      if (!iso) return false;
      const d = new Date(iso);
      const n = new Date(now);
      return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
    };
    const isYesterday = (iso?: string | null) => {
      if (!iso) return false;
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const d = new Date(iso);
      return d.getFullYear() === y.getFullYear() && d.getMonth() === y.getMonth() && d.getDate() === y.getDate();
    };
    const pendingQcCount = doneSamples.filter(
      (s) => !approvals[s.id]?.qcStatus || approvals[s.id]?.qcStatus === "pending",
    ).length;
    const assignedToMeCount = petitions.filter((p) => isAssignedToUser(p, user)).length;
    const dailyCheckProgress = dailyCheckProgressFromSources({
      scaleIds: dailySummary?.scaleIds,
      scaleCount: dailySummary?.count,
      environmentRooms: envSummary?.rooms,
      environmentCount: envSummary?.count,
      equipmentRecords: equipmentCheckQueries.flatMap((query) => query.data ?? []),
    });
    const dailyCheckLoading = wantDailyProgress && (
      !dailySummary ||
      !envSummary ||
      equipmentCheckQueries.some((query) => query.isLoading)
    );

    const configured = new Set(
      simpleMethods
        .filter(
          (e) =>
            (e.methods && e.methods.some((slot) => slot.length > 0)) ||
            (e.instruments && e.instruments.length > 0),
        )
        .map((e) => e.itemNo),
    );
    const methodGaps = slim.filter(
      (s) => !!s.commonName && s.commonName.trim() !== "" && !!s.itemNo && !configured.has(s.itemNo),
    ).length;
    const labInventorySummary = wantInventorySummary || wantStock
      ? labInventorySummaryData({
        standards,
        units: stockUnits,
        solvents,
        glassware,
        deductions: txns,
        now,
      })
      : EMPTY_LAB_INVENTORY_SUMMARY;
    const labInventoryLoading = (wantInventorySummary || wantStock) && (
      standardsLoading ||
      stockUnitsLoading ||
      solventsLoading ||
      glasswareLoading ||
      txnsLoading
    );
    const deductionTrend = wantWithdraw ? deductionTrendData(txns, now, 7) : [];

    return {
      petitions,
      now,
      abnormalFlags,
      returnedFlags,
      pendingQcCount,
      assignedToMeCount,
      usersTotal: access?.users?.length ?? 0,
      usersActive: access?.users?.filter((u) => u.status !== "inactive").length ?? 0,
      rolesTotal: access?.roles?.length ?? 0,
      dailyCheckPending: dailyCheckProgress.pending,
      dailyCheckDone: dailyCheckProgress.done,
      dailyCheckTotal: dailyCheckProgress.total,
      dailyCheckLoading,
      stockLow: labInventorySummary.nearEmpty + labInventorySummary.outOfStock,
      stockExpiring: labInventorySummary.nearExpiry,
      withdrawalsToday: txns.filter((t) => t.action === "deduct" && isToday(t.createdAt)).length,
      withdrawalsYesterday: txns.filter((t) => t.action === "deduct" && isYesterday(t.createdAt)).length,
      qcApprovedToday: petitions.filter((p) => p.status === "approved" && isToday(p.approvedAt)).length,
      qcApprovedYesterday: petitions.filter((p) => p.status === "approved" && isYesterday(p.approvedAt)).length,
      methodGaps: wantConfig ? methodGaps : 0,
      masterItemsTotal: slim.length,
      labInventorySummary,
      labInventoryLoading,
      deductionTrend,
    };
  }, [
    petitions,
    doneSamples,
    approvals,
    user,
    abnormalFlags,
    returnedFlags,
    solvents,
    standards,
    stockUnits,
    glassware,
    txns,
    dailySummary,
    envSummary,
    equipmentCheckQueries,
    wantDailyProgress,
    access,
    slim,
    simpleMethods,
    wantConfig,
    wantStock,
    wantWithdraw,
    wantInventorySummary,
    standardsLoading,
    stockUnitsLoading,
    solventsLoading,
    glasswareLoading,
    txnsLoading,
  ]);

  return { petitions, ctx, loading, refresh };
}
