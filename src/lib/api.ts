import type { SampleItem } from "@/components/lis/SampleColumn";
import type { ApprovalInfo, PhysicalResult, RealtimeDensity } from "@/context/SampleContext";
import type {
  StockStandardItem,
  StockSolventItem,
  StockGlasswareItem,
  StockTransactionItem,
  StockTier,
} from "@/types/stock";
import type {
  StandardConfigDoc,
  StandardOverrideDoc,
  SyncResult,
} from "@/pages/standardConfig/types";

// Development: BASE_URL = "/" → "/api"
// Production:  BASE_URL = "/LIS/" → "/LIS/api"
function normalizeBaseUrl(value: string | undefined) {
  const base = (value || "").trim().replace(/\/+$/, "");
  return base || "";
}

const APP_API_BASE = `${normalizeBaseUrl(import.meta.env.BASE_URL)}/api`;
const API_BASES = Array.from(
  new Set(
    [
      normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL),
      APP_API_BASE,
      "/api",
    ].filter(Boolean),
  ),
);

async function fetchApi(path: string, options?: RequestInit): Promise<unknown> {
  let lastError: Error | null = null;

  for (let i = 0; i < API_BASES.length; i += 1) {
    const base = API_BASES[i];
    const res = await fetch(`${base}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
    const contentType = res.headers.get("content-type") || "";

    if (res.ok) {
      if (contentType.includes("application/json")) {
        return res.json();
      }
      lastError = new Error(`API returned non-JSON response from ${base}${path}`);
      continue;
    }

    if (res.status === 404 && i < API_BASES.length - 1) {
      continue;
    }

    const body = await res.json().catch(() => ({ error: res.statusText }));
    const message =
      typeof body === "object" && body
        ? String(
            (body as { message?: unknown }).message ||
              (body as { error?: { message?: unknown } }).error?.message ||
              (body as { error?: unknown }).error ||
              "API Error",
          )
        : "API Error";
    const err = new Error(message) as Error & { response?: { data: unknown } };
    err.response = { data: body };
    throw err;
  }

  throw lastError ?? new Error("API Error");
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  return fetchApi(path, options) as Promise<T>;
}

// Generic axios-style methods for pages that use api.get/api.patch pattern
async function axiosStyleRequest<T>(path: string, options?: RequestInit): Promise<{ data: { data: T } }> {
  const data = await fetchApi(path, options);
  return { data: { data } };
}

export const api = {
  get: <T>(path: string) => axiosStyleRequest<T>(path),
  post: <T>(path: string, body?: unknown) =>
    axiosStyleRequest<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    axiosStyleRequest<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    axiosStyleRequest<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => axiosStyleRequest<T>(path, { method: "DELETE" }),
  // Auth
  login: (email: string, password: string) =>
    request<{ email: string; name: string; role: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  // Samples
  getSamples: () => request<SampleItem[]>("/samples"),
  createSample: (data: Partial<SampleItem>) =>
    request<SampleItem>("/samples", { method: "POST", body: JSON.stringify(data) }),
  updateSample: (id: string, data: Partial<SampleItem>) =>
    request<SampleItem>(`/samples/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteSample: (id: string) =>
    request(`/samples/${id}`, { method: "DELETE" }),

  // Physical Results
  getPhysicalResults: () => request<Record<string, PhysicalResult>>("/physical-results"),
  upsertPhysicalResult: (data: Partial<PhysicalResult> & { sampleId: string }) =>
    request<PhysicalResult>("/physical-results", { method: "POST", body: JSON.stringify(data) }),

  // Approvals
  getApprovals: () => request<Record<string, ApprovalInfo>>("/approvals"),
  approveLab: (sampleId: string) =>
    request(`/approvals/${sampleId}/lab`, { method: "POST" }),
  approveQC: (sampleId: string, status: "approved" | "rejected" | "pending", note?: string) =>
    request(`/approvals/${sampleId}/qc`, { method: "POST", body: JSON.stringify({ status, note }) }),

  // Densities
  getDensities: () => request<RealtimeDensity[]>("/densities"),
  pushDensity: (data: RealtimeDensity) =>
    request<RealtimeDensity>("/densities", { method: "POST", body: JSON.stringify(data) }),

  // Stock — Standards
  getStandards: () => request<StockStandardItem[]>("/stock/standards"),
  createStandard: (data: Partial<StockStandardItem>) =>
    request<StockStandardItem>("/stock/standards", { method: "POST", body: JSON.stringify(data) }),
  updateStandard: (id: string, data: Partial<StockStandardItem>) =>
    request<StockStandardItem>(`/stock/standards/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteStandard: (id: string) =>
    request<{ success: true }>(`/stock/standards/${id}`, { method: "DELETE" }),
  deductStandard: (id: string, body: { tier: StockTier; qty: number; sampleId?: string; note?: string }) =>
    request<StockStandardItem>(`/stock/standards/${id}/deduct`, { method: "POST", body: JSON.stringify(body) }),
  receiveStandard: (id: string, body: { tier: StockTier; qty: number; note?: string }) =>
    request<StockStandardItem>(`/stock/standards/${id}/receive`, { method: "POST", body: JSON.stringify(body) }),

  // Stock — Solvents
  getSolvents: () => request<StockSolventItem[]>("/stock/solvents"),
  createSolvent: (data: Partial<StockSolventItem>) =>
    request<StockSolventItem>("/stock/solvents", { method: "POST", body: JSON.stringify(data) }),
  updateSolvent: (id: string, data: Partial<StockSolventItem>) =>
    request<StockSolventItem>(`/stock/solvents/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteSolvent: (id: string) =>
    request<{ success: true }>(`/stock/solvents/${id}`, { method: "DELETE" }),
  deductSolvent: (id: string, body: { qty: number; sampleId?: string; note?: string }) =>
    request<StockSolventItem>(`/stock/solvents/${id}/deduct`, { method: "POST", body: JSON.stringify(body) }),
  receiveSolvent: (id: string, body: { qty: number; note?: string }) =>
    request<StockSolventItem>(`/stock/solvents/${id}/receive`, { method: "POST", body: JSON.stringify(body) }),

  // Stock — Glassware
  getGlassware: () => request<StockGlasswareItem[]>("/stock/glassware"),
  createGlassware: (data: Partial<StockGlasswareItem>) =>
    request<StockGlasswareItem>("/stock/glassware", { method: "POST", body: JSON.stringify(data) }),
  updateGlassware: (id: string, data: Partial<StockGlasswareItem>) =>
    request<StockGlasswareItem>(`/stock/glassware/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteGlassware: (id: string) =>
    request<{ success: true }>(`/stock/glassware/${id}`, { method: "DELETE" }),
  deductGlassware: (id: string, body: { qty: number; sampleId?: string; note?: string }) =>
    request<StockGlasswareItem>(`/stock/glassware/${id}/deduct`, { method: "POST", body: JSON.stringify(body) }),
  receiveGlassware: (id: string, body: { qty: number; note?: string }) =>
    request<StockGlasswareItem>(`/stock/glassware/${id}/receive`, { method: "POST", body: JSON.stringify(body) }),

  // Stock — Transactions (audit log)
  getStockTransactions: (params?: { itemType?: string; itemId?: string; action?: string; limit?: number }) => {
    const qs = params
      ? "?" + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])).toString()
      : "";
    return request<StockTransactionItem[]>(`/stock/transactions${qs}`);
  },

  // Machines (รายการเครื่อง)
  getMachines: () => request<MachineItem[]>("/machines"),
  createMachine: (data: Partial<MachineItem>) =>
    request<MachineItem>("/machines", { method: "POST", body: JSON.stringify(data) }),
  updateMachine: (id: string, data: Partial<MachineItem>) =>
    request<MachineItem>(`/machines/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteMachine: (id: string) =>
    request<{ success: true }>(`/machines/${id}`, { method: "DELETE" }),
  seedMachines: () =>
    request<{ inserted: number; matched: number; total: number }>("/machines/seed", { method: "POST" }),

  // Daily Check (Calibrate เครื่องชั่งประจำวัน)
  getDailyChecks: (params?: {
    date?: string;          // YYYY-MM-DD หรือ "all"
    from?: string;
    to?: string;
    scaleId?: string;
    status?: "pass" | "fail";
  }) => {
    const qs = params
      ? "?" + new URLSearchParams(
          Object.entries(params).filter(([, v]) => v != null && v !== "").map(([k, v]) => [k, String(v)]),
        ).toString()
      : "";
    return request<{ data: DailyCheckRecord[] }>(`/daily-checks${qs}`).then(r => r.data);
  },
  createDailyCheck: (data: CreateDailyCheckPayload) =>
    request<{ data: DailyCheckRecord }>("/daily-checks", {
      method: "POST",
      body: JSON.stringify(data),
    }).then(r => r.data),
  getDailyCheckTodaySummary: () =>
    request<{ data: DailyCheckTodaySummary }>("/daily-checks/summary/today").then(r => r.data),

  // Parameters (พารามิเตอร์การตรวจสอบของสารแต่ละชนิด)
  getParameters: () => request<ParameterItem[]>("/parameters"),
  createParameter: (data: Partial<ParameterItem>) =>
    request<ParameterItem>("/parameters", { method: "POST", body: JSON.stringify(data) }),
  updateParameter: (id: string, data: Partial<ParameterItem>) =>
    request<ParameterItem>(`/parameters/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteParameter: (id: string) =>
    request<{ success: true }>(`/parameters/${id}`, { method: "DELETE" }),
  bulkCreateParameters: (items: Partial<ParameterItem>[]) =>
    request<ParameterItem[]>("/parameters/bulk", { method: "POST", body: JSON.stringify(items) }),

  // QC Test Results
  getQCResults: (petitionId: string) =>
    request<import("@/types/petition.types").QCTestResult[]>(`/qc-results/${petitionId}`),
  saveQCResult: (data: import("@/types/petition.types").SaveQCResultPayload) =>
    request<import("@/types/petition.types").QCTestResult>("/qc-results", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  getQCProgress: (petitionIds: string[]) => {
    if (petitionIds.length === 0) return Promise.resolve({} as QCProgressMap);
    const qs = new URLSearchParams({ petitionIds: petitionIds.join(",") }).toString();
    return request<QCProgressMap>(`/qc-results/progress?${qs}`);
  },
  getAbnormalFlags: (petitionIds: string[]) => {
    if (petitionIds.length === 0) return Promise.resolve({} as Record<string, boolean>);
    const qs = new URLSearchParams({ petitionIds: petitionIds.join(",") }).toString();
    return request<Record<string, boolean>>(`/qc-results/abnormal-flags?${qs}`);
  },
  getReturnedFlags: (petitionIds: string[]) => {
    if (petitionIds.length === 0) return Promise.resolve({} as Record<string, boolean>);
    const qs = new URLSearchParams({ petitionIds: petitionIds.join(",") }).toString();
    return request<Record<string, boolean>>(`/petitions/returned-flags?${qs}`);
  },
  // Manual phase advance (admin override) for 2-phase petitions
  advancePetitionPhase: (petitionId: string, actor?: string) =>
    request<import("@/types/petition.types").Petition>(`/petitions/${petitionId}/advance-phase`, {
      method: "PATCH",
      body: JSON.stringify({ actor }),
    }),
  approvePetition: (petitionId: string, actor: string) =>
    request<import("@/types/petition.types").Petition>(`/petitions/${petitionId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "approved", actor }),
    }),
  rejectPetition: (petitionId: string, actor: string, revisionNote: string) =>
    request<import("@/types/petition.types").Petition>(`/petitions/${petitionId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "rejected", actor, revisionNote }),
    }),
  getPetition: (petitionId: string) =>
    request<import("@/types/petition.types").Petition>(`/petitions/${petitionId}`),
  findRejectedByBatch: (batchNo: string, employeeId: string) => {
    const qs = new URLSearchParams({ batchNo, employeeId }).toString();
    return request<import("@/types/petition.types").Petition[]>(`/petitions/rejected-by-batch?${qs}`);
  },

  // Standard Config
  getStandardConfigs: () => request<StandardConfigDoc[]>("/standard-configs"),
  createStandardConfig: (data: Partial<StandardConfigDoc>) =>
    request<StandardConfigDoc>("/standard-configs", { method: "POST", body: JSON.stringify(data) }),
  updateStandardConfig: (nameLower: string, data: Partial<StandardConfigDoc>) =>
    request<StandardConfigDoc>(`/standard-configs/${encodeURIComponent(nameLower)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteStandardConfig: (nameLower: string) =>
    request<{ ok: true }>(`/standard-configs/${encodeURIComponent(nameLower)}`, { method: "DELETE" }),
  syncStandardConfigs: () =>
    request<SyncResult>("/standard-configs/sync", { method: "POST" }),

  // Standard Overrides
  getStandardOverrides: () => request<StandardOverrideDoc[]>("/standard-overrides"),
  createStandardOverride: (data: Partial<StandardOverrideDoc>) =>
    request<StandardOverrideDoc>("/standard-overrides", { method: "POST", body: JSON.stringify(data) }),
  updateStandardOverride: (id: string, data: Partial<StandardOverrideDoc>) =>
    request<StandardOverrideDoc>(`/standard-overrides/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteStandardOverride: (id: string) =>
    request<{ ok: true }>(`/standard-overrides/${id}`, { method: "DELETE" }),
};

export type QCProgressEntry = {
  itemSeq: number;
  parameterId: string;
  filledLabels: string[];
};

export type QCProgressMap = Record<string, QCProgressEntry[]>;

export type DailyCheckRecord = {
  _id?: string;
  scaleId: string;
  scaleName: string;
  model?: string;
  weights100: [string, string, string] | string[];
  weights10: [string, string, string] | string[];
  avg100: number;
  avg10: number;
  status100: "pass" | "fail";
  status10: "pass" | "fail";
  status: "pass" | "fail";
  tolerance?: number;
  recorder: string;
  recorderId?: string;
  recorderEmail?: string;
  date: string;       // YYYY-MM-DD
  checkedAt: string;  // ISO
  createdAt?: string;
  updatedAt?: string;
};

export type CreateDailyCheckPayload = {
  scaleId: string;
  scaleName: string;
  model?: string;
  weights100: string[];
  weights10: string[];
  avg100: number;
  avg10: number;
  status100: "pass" | "fail";
  status10: "pass" | "fail";
  tolerance?: number;
  recorder: string;
  recorderId?: string;
  recorderEmail?: string;
};

export type DailyCheckTodaySummary = {
  date: string;
  count: number;
  scaleIds: string[];
  allPass: boolean;
};

export type MachineItem = {
  _id?: string;
  code: string;
  registerNo?: string;
  name: string;
  manufacturer?: string;
  model?: string;
  serialNo?: string;
  manualDoc?: string;
  installDate?: string;
  startDate?: string;
  location?: string;
  status?: "active" | "inactive" | "retired";
  note?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ParameterValueFieldType = "text" | "number" | "float" | "enum" | "photo" | "file" | "timer" | "reference";

export type StandardOperator =
  | "lt"
  | "lte"
  | "eq"
  | "gte"
  | "gt"
  | "between"
  | "tolerance";

export type TimerUnit = "minute" | "hour" | "day" | "month";

export type ParameterFieldPhase = "both" | "before" | "after";

export type ParameterValueField = {
  label: string;
  type: ParameterValueFieldType;
  unit?: string;
  standardValue?: number | null;
  standardOperator?: StandardOperator;
  standardValue2?: number | null;
  options?: string[];
  requireNoteOn?: string[];
  expectedValues?: string[];
  timerDurationSec?: number | null;
  timerUnit?: TimerUnit;
  required?: boolean;
  maxPhotos?: number;
  maxFiles?: number;
  allowedFileTypes?: string[];
  // 2-phase fields
  phase?: ParameterFieldPhase; // default 'both'
  triggersPhase2?: boolean;
  // For type='reference' — pulls value from another parameter's saved field
  // on the SAME petition + itemSeq.
  refParameterId?: string | null;
  refFieldLabel?: string | null;
  refPhase?: 1 | 2 | null;
  // Per-option filter: keyed by option string.
  // ถ้า key ไม่มี = option แสดงให้ทุก item (default).
  // ถ้ามี key แต่ทุกมิติเป็น array ว่าง = แสดงเสมอ.
  // หากตั้งค่าอย่างน้อย 1 มิติ — OR ข้ามมิติ (เหมือน parameter-level "ใช้กับ").
  optionFilters?: Record<string, {
    itemNames?: string[];      // exact match กับ item.sampleName
    commonNames?: string[];    // 'EW' | 'WP' | 'ULV' ... (uppercase)
    productTypes?: string[];   // 'water' | 'sand' | 'powder'
    categories?: string[];     // 'RM' | 'FG' (UI parity เท่านั้น — ไม่ enforce ที่ runtime)
    subCategories?: string[];  // prefix code เช่น 'F', 'FC', 'RO' (uppercase)
  }>;
};

export type ParameterScope = "lab" | "qc";

export type ParameterItem = {
  _id?: string;
  name: string;
  scope?: ParameterScope;
  shareWithLab?: boolean;
  status?: "active" | "inactive";
  applyAll?: boolean;
  commonNames?: string[];
  itemNames?: string[];
  productTypes?: string[];
  categories?: string[];
  subCategories?: string[];
  valueFields?: ParameterValueField[];
  sortOrder?: number;
  note?: string;
  // 2-phase testing toggle — when true, this parameter is split into ก่อน/หลัง
  hasPhases?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

// These functions use bare fetch (not fetchApi) because FormData upload
// must not have Content-Type forced to application/json.
export async function uploadQcPhoto(file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append('photo', file);
  const res = await fetch(`${APP_API_BASE}/uploads/qc-photo`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText })) as any;
    const message = body?.message || body?.error?.message || body?.error || 'Upload failed';
    throw new Error(String(message));
  }
  return res.json();
}

export async function deleteQcPhoto(url: string): Promise<void> {
  const res = await fetch(`${APP_API_BASE}/uploads/qc-photo`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText })) as any;
    const message = body?.message || body?.error?.message || body?.error || 'Delete failed';
    throw new Error(String(message));
  }
}

export async function uploadParamFile(file: File): Promise<{ url: string; name: string; size: number }> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${APP_API_BASE}/uploads/param-file`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText })) as any;
    const message = body?.error || body?.message || res.statusText;
    throw new Error(String(message));
  }
  return res.json();
}

export async function deleteParamFile(url: string): Promise<void> {
  const res = await fetch(`${APP_API_BASE}/uploads/param-file`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText })) as any;
    const message = body?.error || body?.message || res.statusText;
    throw new Error(String(message));
  }
}
