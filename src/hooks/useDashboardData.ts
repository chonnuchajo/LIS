import { useEffect, useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { usePetitionList } from "@/hooks/usePetition";
import { useSamples } from "@/context/SampleContext";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import type { StockTransactionParams } from "@/lib/api";
import { loadAccessControl } from "@/lib/accessControlSource";
import { hasLabDataConfigRole, type DashboardProfile } from "@/lib/dashboardProfiles";
import {
  EMPTY_LAB_INVENTORY_SUMMARY,
  deductionTrendData,
  isAssignedToUser,
  labInventorySummaryData,
  localDayWindow,
  simpleMethodCoverageData,
  standardTimeCoverageData,
  type MetricsCtx,
} from "@/lib/dashboardMetrics";
import { dailyCheckProgressFromSources } from "@/lib/dailyCheckProgress";
import { EQUIPMENT_ROOM_SLUGS } from "@/lib/roomEquipment";
import { normalizeRoles } from "@/lib/roles";
import type { MethodDoc } from "@/lib/methodRegistry";
import type { Petition } from "@/types/petition.types";
import type { StockTransactionItem } from "@/types/stock";

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

export const DASHBOARD_DEDUCTION_PAGE_SIZE = 500;

function delayUntilNextLocalMidnight(now = Date.now()): number {
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  return Math.max(nextMidnight.getTime() - now, 1);
}

export async function fetchDashboardDeductions(
  now: number,
  getTransactions: (params?: StockTransactionParams) => Promise<StockTransactionItem[]>,
): Promise<StockTransactionItem[]> {
  const { createdFrom, createdTo } = localDayWindow(now, 7);
  const deductions: StockTransactionItem[] = [];

  for (let skip = 0; ; skip += DASHBOARD_DEDUCTION_PAGE_SIZE) {
    const page = await getTransactions({
      action: "deduct",
      createdFrom,
      createdTo,
      limit: DASHBOARD_DEDUCTION_PAGE_SIZE,
      skip,
    });
    deductions.push(...page);
    if (page.length < DASHBOARD_DEDUCTION_PAGE_SIZE) return deductions;
  }
}

export function useDashboardData(profile: DashboardProfile): DashboardData {
  const { user } = useAuth();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const scheduleMidnightUpdate = () => {
      timer = setTimeout(() => {
        setNow(Date.now());
        scheduleMidnightUpdate();
      }, delayUntilNextLocalMidnight());
    };

    scheduleMidnightUpdate();
    return () => clearTimeout(timer);
  }, []);

  const kpis = new Set(profile.kpis);
  const roleIds = normalizeRoles(user);
  const wantConfigCoverage = hasLabDataConfigRole(roleIds);
  const need = (id: string) => kpis.has(id as never);
  const wantInventorySummary = roleIds.includes("lab-inventory");

  // Deductions are fetched from the last seven local calendar days without an aggregate endpoint.
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
    queryFn: () => fetchDashboardDeductions(Date.now(), api.getStockTransactions),
  });

  const wantDailyProgress = profile.id === "lab-analyze" || profile.id === "lab-head" || need("dailyCheckPending");
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

  const wantConfig = wantConfigCoverage || need("methodGaps") || need("masterItemsTotal");
  const { data: slim = [], isLoading: slimLoading } = useQuery({
    queryKey: ["dash", "slim"],
    enabled: wantConfig,
    queryFn: () => api.get<unknown>("/master-items/slim").then((r) => unwrapSlim(r.data.data)),
  });
  const { data: simpleMethods = [], isLoading: simpleMethodsLoading } = useQuery({
    queryKey: ["dash", "simple-methods"],
    enabled: wantConfig,
    queryFn: () => api.get<SimpleMethodEntry[]>("/simple-methods").then((r) => r.data.data),
  });
  const { data: methods = [], isLoading: methodsLoading } = useQuery({
    queryKey: ["dash", "methods"],
    enabled: wantConfigCoverage,
    queryFn: () => api.get<MethodDoc[]>("/methods").then((r) => r.data.data),
  });
  const { data: standardTimeSummary, isLoading: standardTimeSummaryLoading } = useQuery({
    queryKey: ["standard-times", "summary"],
    enabled: wantConfigCoverage,
    queryFn: api.getStandardTimeSummary,
  });

  const ctx: MetricsCtx = useMemo(() => {
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
    const simpleMethodCoverage = wantConfigCoverage
      ? simpleMethodCoverageData(slim, simpleMethods, methods)
      : [];
    const standardTimeCoverage = wantConfigCoverage
      ? standardTimeCoverageData(standardTimeSummary?.byInstrument ?? [])
      : [];
    const configCoverageLoading = wantConfigCoverage && (
      slimLoading ||
      simpleMethodsLoading ||
      methodsLoading ||
      standardTimeSummaryLoading
    );

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
      simpleMethodCoverage,
      standardTimeCoverage,
      configCoverageLoading,
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
    wantConfigCoverage,
    methods,
    standardTimeSummary,
    slimLoading,
    simpleMethodsLoading,
    methodsLoading,
    standardTimeSummaryLoading,
    now,
  ]);

  return { petitions, ctx, loading, refresh };
}
