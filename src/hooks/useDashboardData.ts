import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePetitionList } from "@/hooks/usePetition";
import { useSamples } from "@/context/SampleContext";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { loadAccessControl } from "@/lib/accessControlSource";
import type { DashboardProfile } from "@/lib/dashboardProfiles";
import type { MetricsCtx } from "@/lib/dashboardMetrics";
import type { Petition } from "@/types/petition.types";

const EXPIRY_WARN_DAYS = 180;
const SOLVENT_LOW_QTY = 3;

function daysUntil(iso?: string | null): number {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return Infinity;
  return Math.ceil((t - Date.now()) / 86_400_000);
}

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

  const wantStock = need("stockLow") || need("stockExpiring");
  const { data: solvents = [] } = useQuery({ queryKey: ["dash", "solvents"], enabled: wantStock, queryFn: api.getSolvents });
  const { data: standards = [] } = useQuery({ queryKey: ["dash", "standards"], enabled: wantStock, queryFn: api.getStandards });

  const wantWithdraw = need("withdrawalsToday") || profile.analytics.some((a) => a.kind === "withdrawBar");
  const { data: txns = [] } = useQuery({
    queryKey: ["dash", "txns"],
    enabled: wantWithdraw,
    queryFn: () => api.getStockTransactions({ action: "withdraw", limit: 500 }),
  });

  const wantDaily = need("dailyCheckPending");
  const { data: dailySummary } = useQuery({ queryKey: ["dash", "daily"], enabled: wantDaily, queryFn: api.getDailyCheckTodaySummary });

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
    const assignedToMeCount = petitions.filter(
      (p) =>
        p.status === "inProgress" &&
        ((!!user?.employeeId && p.assignedTo?.employeeId === user.employeeId) ||
          (!!user?.name && p.assignedTo?.name === user.name)),
    ).length;

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
      dailyCheckPending: dailySummary && !dailySummary.allPass ? 1 : 0,
      stockLow: solvents.filter((s) => (s.qty ?? 0) < SOLVENT_LOW_QTY).length,
      stockExpiring: standards.filter(
        (s) => Math.min(daysUntil(s.working?.exp), daysUntil(s.supplier?.exp)) <= EXPIRY_WARN_DAYS,
      ).length,
      withdrawalsToday: txns.filter((t) => isToday(t.createdAt)).length,
      withdrawalsYesterday: txns.filter((t) => isYesterday(t.createdAt)).length,
      qcApprovedToday: petitions.filter((p) => p.status === "approved" && isToday(p.approvedAt)).length,
      qcApprovedYesterday: petitions.filter((p) => p.status === "approved" && isYesterday(p.approvedAt)).length,
      methodGaps: wantConfig ? methodGaps : 0,
      masterItemsTotal: slim.length,
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
    txns,
    dailySummary,
    access,
    slim,
    simpleMethods,
    wantConfig,
  ]);

  return { petitions, ctx, loading, refresh };
}
