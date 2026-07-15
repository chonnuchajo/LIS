// TypeScript mirror of GET /petitions/exec-summary (server/lib/execSummary.js +
// server/routes/petitions.js `/exec-summary`). Keep this in sync with the server's
// buildLiveSection/buildStatsSection output shape — it is the authoritative source.

export type ExecPeriod = 1 | 7 | 30;

export type ExecStage =
  | "waitingReceive" | "pendingAssign" | "labTesting"
  | "qcTesting" | "waitingLabApprove" | "waitingFinal";

export type ExecWorkState = "overdue" | "atRisk" | "ok" | "unassigned" | "noBaseline";

export interface ExecWorkUnit {
  petitionId: string;
  petitionNo: string;
  dept: string;
  priority: 0 | 1;
  track: "lab" | "qc" | "final";
  stage: ExecStage;
  stageLabel: string;
  assigneeName: string;
  elapsedMin: number;
  baselineMin: number | null;
  overdueMin: number | null;
  state: ExecWorkState;
}

export interface ExecSummary {
  generatedAt: string;
  days: ExecPeriod;
  live: {
    counts: {
      total: number;
      urgent: number; overdue: number; atRisk: number;
      unassigned: number; waitingHead: number; abnormal: number;
    };
    ids: {
      total: string[];
      urgent: string[]; overdue: string[]; atRisk: string[];
      unassigned: string[]; waitingHead: string[]; abnormal: string[];
    };
    bottleneck: { stage: ExecStage; label: string; count: number }[];
    actionQueue: ExecWorkUnit[];
  };
  stats: {
    turnaround: { stage: ExecStage; label: string; avgMin: number | null; p90Min: number | null; count: number }[];
    throughput: { date: string; created: number; completed: number }[];
    quality: { closed: number; abnormal: number; abnormalRate: number; reworked: number; reworkRate: number };
    workload: {
      lab: { name: string; completed: number; avgMinutes: number | null }[];
      qc: { name: string; completed: number; avgMinutes: number | null }[];
    };
  };
}

export function formatMinutes(minutes: number | null | undefined): string {
  if (typeof minutes !== "number" || !Number.isFinite(minutes)) return "—";
  const total = Math.floor(Math.max(0, minutes));
  if (total < 60) return `${total} น.`;
  if (total < 1440) {
    const hours = Math.floor(total / 60);
    const rest = total % 60;
    return rest === 0 ? `${hours} ชม.` : `${hours} ชม. ${rest} น.`;
  }
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  return hours === 0 ? `${days} วัน` : `${days} วัน ${hours} ชม.`;
}

export function highlightPath(ids: string[]): string {
  return ids.length ? `/petition?highlight=${ids.join(",")}` : "/petition";
}
