import { aiPercentFromCommonName, isAiContentTestItem } from "@/lib/aiToleranceCriteria";
import type { CoaDocument, CoaResultSnapshot, CoaSampleSnapshot, CoaTrendSnapshot } from "@/types/coa.types";

export type CoaRequestTrendEntry = {
  key: string;
  commonName: string;
  requestCount: number;
  sharePercent: number;
  labelAiPercent: number | null;
  averageAiPercent: number | null;
  latestAiResult?: string;
  latestRequestedAt?: string;
};

type CoaTrendAccumulator = {
  key: string;
  commonName: string;
  requestCount: number;
  labelAiPercent: number | null;
  aiResultValues: number[];
  latestAiResult?: string;
  latestRequestedAt?: string;
};

type CoaTrendSourceSnapshot = Pick<CoaSampleSnapshot, "itemSeq" | "sampleName" | "commonName"> & Partial<CoaTrendSnapshot>;

const IGNORED_TREND_STATUSES = new Set<CoaDocument["status"]>(["cancelled", "rejected", "superseded"]);

function normalizeTrendKey(value?: string | null) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function trendDrugName(sample: CoaSampleSnapshot) {
  return [sample.commonName, sample.sampleName].map((value) => String(value || "").trim()).find(Boolean) || "ไม่ระบุชื่อยา";
}

function trendDate(doc: CoaDocument) {
  return doc.createdAt || doc.updatedAt || "";
}

function isLaterDate(candidate?: string, current?: string) {
  if (!candidate) return false;
  if (!current) return true;
  const candidateTime = new Date(candidate).getTime();
  const currentTime = new Date(current).getTime();
  if (Number.isNaN(candidateTime)) return false;
  if (Number.isNaN(currentTime)) return true;
  return candidateTime > currentTime;
}

function parsePercentValue(value?: string | null) {
  const source = String(value || "").replace(/,/g, "");
  const match = source.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function aiResultsForSample(results: CoaResultSnapshot[] = [], itemSeq: number) {
  return results.filter((row) => Number(row.itemSeq) === Number(itemSeq) && isAiContentTestItem(row.testItem));
}

function trendSourcesForDoc(doc: CoaDocument): CoaTrendSourceSnapshot[] {
  if (doc.trendSnapshots?.length) return doc.trendSnapshots;
  return doc.sampleSnapshots || [];
}

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function buildCoaRequestTrend(docs: CoaDocument[] = [], limit = 6): CoaRequestTrendEntry[] {
  const groups = new Map<string, CoaTrendAccumulator>();
  let totalRequests = 0;

  for (const doc of docs) {
    if (IGNORED_TREND_STATUSES.has(doc.status)) continue;
    const requestedAt = trendDate(doc);
    for (const sample of trendSourcesForDoc(doc)) {
      const commonName = trendDrugName(sample);
      const key = normalizeTrendKey(commonName);
      if (!key) continue;
      const current = groups.get(key) ?? {
        key,
        commonName,
        requestCount: 0,
        labelAiPercent: sample.aiLabelPercent ?? parsePercentValue(aiPercentFromCommonName(sample.commonName)),
        aiResultValues: [],
      };
      const isLatestRequest = isLaterDate(requestedAt, current.latestRequestedAt);
      current.requestCount += 1;
      totalRequests += 1;
      if (isLatestRequest) current.latestRequestedAt = requestedAt;

      if (sample.aiResultPercent != null) {
        current.aiResultValues.push(sample.aiResultPercent);
        if (sample.aiResultText && (isLatestRequest || !current.latestAiResult)) current.latestAiResult = sample.aiResultText;
      } else {
        const aiRows = aiResultsForSample(doc.resultSnapshots, sample.itemSeq);
        for (const row of aiRows) {
          const parsed = parsePercentValue(row.result);
          if (parsed != null) current.aiResultValues.push(parsed);
          if (row.result && (isLatestRequest || !current.latestAiResult)) current.latestAiResult = row.result;
        }
      }

      groups.set(key, current);
    }
  }

  return Array.from(groups.values())
    .map((entry) => ({
      key: entry.key,
      commonName: entry.commonName,
      requestCount: entry.requestCount,
      sharePercent: totalRequests ? (entry.requestCount / totalRequests) * 100 : 0,
      labelAiPercent: entry.labelAiPercent,
      averageAiPercent: average(entry.aiResultValues),
      latestAiResult: entry.latestAiResult,
      latestRequestedAt: entry.latestRequestedAt,
    }))
    .sort((left, right) => (
      right.requestCount - left.requestCount
      || new Date(right.latestRequestedAt || 0).getTime() - new Date(left.latestRequestedAt || 0).getTime()
      || left.commonName.localeCompare(right.commonName, "th")
    ))
    .slice(0, limit);
}

export function formatCoaTrendPercent(value?: number | null, maximumFractionDigits = 3) {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${new Intl.NumberFormat("th-TH", { maximumFractionDigits }).format(value)}%`;
}
