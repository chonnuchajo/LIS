// AI API helpers — all calls degrade gracefully (never throw, return safe defaults)
const AI_BASE = `${(import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')}/api/ai`;

export interface OutlierCheckResult {
  warning: boolean;
  zScore?: number;
  mean?: number;
  stdev?: number;
  sampleSize?: number;
  reason?: string;
}

export async function checkOutlier(params: {
  commonName: string;
  parameterId: string;
  fieldLabel: string;
  value: number;
}): Promise<OutlierCheckResult> {
  try {
    const res = await fetch(`${AI_BASE}/outlier-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return { warning: false };
    return (await res.json()) as OutlierCheckResult;
  } catch {
    return { warning: false };
  }
}

export interface MachineSuggestion {
  machineCode: string;
  machineName: string;
  usageCount: number;
}

export async function getMachineSuggestions(
  commonName: string,
  dept?: string,
): Promise<MachineSuggestion[]> {
  try {
    const params = new URLSearchParams({ commonName });
    if (dept) params.set('dept', dept);
    const res = await fetch(`${AI_BASE}/machine-suggestions?${params}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return [];
    return (await res.json()) as MachineSuggestion[];
  } catch {
    return [];
  }
}

export interface DailyCheckTrend {
  alert: boolean;
  streak?: number;
  slope?: number;
  message?: string | null;
  reason?: string;
}

export async function getDailyCheckTrend(params: {
  type: 'consecutive' | 'trend';
  scaleId: string;
  field?: string;
  days?: number;
}): Promise<DailyCheckTrend> {
  try {
    const query = new URLSearchParams({
      type: params.type,
      scaleId: params.scaleId,
      days: String(params.days ?? 30),
    });
    if (params.field) query.set('field', params.field);
    const res = await fetch(`${AI_BASE}/daily-check-trends?${query}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return { alert: false };
    return (await res.json()) as DailyCheckTrend;
  } catch {
    return { alert: false };
  }
}

export interface OllamaStatus {
  available: boolean;
}

export async function getOllamaStatus(): Promise<OllamaStatus> {
  try {
    const res = await fetch(`${AI_BASE}/ollama-status`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return { available: false };
    return (await res.json()) as OllamaStatus;
  } catch {
    return { available: false };
  }
}

export async function streamDraftNote(
  petitionId: string,
  onChunk: (text: string) => void,
): Promise<void> {
  const res = await fetch(`${AI_BASE}/draft-note`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ petitionId }),
  });
  if (!res.ok || !res.body) throw new Error('draft-note failed');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }
}

export async function streamWeeklySummary(
  fromDate: string,
  toDate: string,
  onChunk: (text: string) => void,
): Promise<void> {
  const res = await fetch(`${AI_BASE}/weekly-summary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fromDate, toDate }),
  });
  if (!res.ok || !res.body) throw new Error('weekly-summary failed');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }
}
