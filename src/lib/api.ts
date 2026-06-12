import type { SampleItem } from "@/components/lis/SampleColumn";
import type { ApprovalInfo, PhysicalResult, RealtimeDensity } from "@/context/SampleContext";
import type {
  StockStandardItem,
  StockSolventItem,
  StockGlasswareItem,
  StockTransactionItem,
  StockTier,
  StockUnitItem,
} from "@/types/stock";
import type { StandardConfigDoc } from "@/lib/standardConfig";
import type { EnvRoomConfig, EnvRoomConfigInput } from "@/lib/dailyCheckEnv";
import type { PrintConfig, PrintConfigInput, PrintDocType } from "@/lib/printConfig";
import type { DocumentNumberConfig, DocumentNumberConfigInput, DocNumberType } from "@/lib/documentNumberConfig";
import type { DashboardId, StoredLayout, DashboardLayout } from "@/lib/dashboardLayout";
import type { MethodDoc, MethodInput } from './methodRegistry';

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
    const err = new Error(message) as Error & {
      response?: { data: unknown };
      field?: string;
    };
    err.response = { data: body };
    const field =
      typeof body === "object" && body
        ? (body as { field?: unknown }).field
        : undefined;
    if (typeof field === "string") err.field = field;
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

// Fetch a binary file (e.g. export to xlsx/pdf). Tries each API base; on a JSON
// response treats it as an error body (server reports failures as JSON).
async function fetchBlob(path: string, options?: RequestInit): Promise<Blob> {
  let lastError: Error | null = null;
  for (let i = 0; i < API_BASES.length; i += 1) {
    const base = API_BASES[i];
    const res = await fetch(`${base}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && !contentType.includes("application/json")) {
      return res.blob();
    }
    if (res.status === 404 && i < API_BASES.length - 1) continue;
    const body = await res.json().catch(() => ({ error: res.statusText }));
    const message = (body && typeof body === "object")
      ? String((body as { error?: unknown; message?: unknown }).error
          || (body as { message?: unknown }).message
          || "Export failed")
      : "Export failed";
    if (res.ok) { lastError = new Error(message); continue; }
    throw new Error(message);
  }
  throw lastError ?? new Error("Export failed");
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
  // Export Master Item rows to a downloadable file (xlsx or pdf)
  exportMasterItems: (format: "xlsx" | "pdf", rows: unknown[], title?: string) =>
    fetchBlob("/master-items/export", {
      method: "POST",
      body: JSON.stringify({ format, rows, title }),
    }),
  // Auth
  login: (email: string, password: string) =>
    request<{ email: string; name: string; role: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  ssoLogin: (token: string) =>
    request<{
      id?: string;
      email: string;
      name?: string;
      role?: string;
      permissions?: string[];
      department?: string;
      position?: string;
      status?: "active" | "inactive";
    }>("/auth/sso", {
      method: "POST",
      body: JSON.stringify({ token }),
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

  // Instrument readings (pull values live from lab instruments) ----------------
  // Config CRUD (managed in Settings)
  getInstrumentSources: () => request<InstrumentSource[]>("/instrument-readings/sources"),
  createInstrumentSource: (data: Partial<InstrumentSource>) =>
    request<InstrumentSource>("/instrument-readings/sources", { method: "POST", body: JSON.stringify(data) }),
  updateInstrumentSource: (id: string, data: Partial<InstrumentSource>) =>
    request<InstrumentSource>(`/instrument-readings/sources/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteInstrumentSource: (id: string) =>
    request<{ success: true }>(`/instrument-readings/sources/${id}`, { method: "DELETE" }),
  // Live pull: fetch the latest reading for a configured param key.
  fetchInstrumentReading: (key: string) =>
    request<InstrumentReading>(`/instrument-readings/${encodeURIComponent(key)}/latest`),

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

  // Stock — Units (per-bottle)
  getStockUnits: (params?: { itemCode?: string; status?: string; kind?: string }) => {
    const q = new URLSearchParams();
    if (params?.itemCode) q.set("itemCode", params.itemCode);
    if (params?.status) q.set("status", params.status);
    if (params?.kind) q.set("kind", params.kind);
    const qs = q.toString() ? `?${q.toString()}` : "";
    return request<StockUnitItem[]>(`/stock/units${qs}`);
  },
  getStockUnit: (qrId: string) =>
    request<StockUnitItem>(`/stock/units/${encodeURIComponent(qrId)}`),
  receiveStockUnits: (
    standardId: string,
    body: { lotNo?: string; sizeMl: number; unit?: string; source: "primary" | "supply"; bottles: { exp?: string }[]; note?: string },
  ) =>
    request<StockUnitItem[]>(`/stock/standards/${standardId}/units/receive`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  withdrawStockUnit: (qrId: string, body: { ml: number; note?: string }) =>
    request<{ parent: StockUnitItem; working: StockUnitItem }>(
      `/stock/units/${encodeURIComponent(qrId)}/withdraw`,
      { method: "POST", body: JSON.stringify(body) },
    ),
  discardStockUnit: (qrId: string, body: { reason?: string }) =>
    request<StockUnitItem>(`/stock/units/${encodeURIComponent(qrId)}/discard`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateStockUnit: (
    qrId: string,
    body: { lotNo?: string; exp?: string | null; source?: "primary" | "supply" | ""; volume?: { initial?: number; remaining?: number; unit?: string } },
  ) =>
    request<StockUnitItem>(`/stock/units/${encodeURIComponent(qrId)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

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

  // Env Check (อุณหภูมิ/ความชื้น ประจำวัน)
  getEnvChecks: (params?: {
    date?: string;          // YYYY-MM-DD หรือ "all"
    from?: string;
    to?: string;
    room?: string;
    status?: "pass" | "fail";
  }) => {
    const qs = params
      ? "?" + new URLSearchParams(
          Object.entries(params).filter(([, v]) => v != null && v !== "").map(([k, v]) => [k, String(v)]),
        ).toString()
      : "";
    return request<{ data: EnvCheckRecord[] }>(`/env-checks${qs}`).then(r => r.data);
  },
  createEnvCheck: (data: CreateEnvCheckPayload) =>
    request<{ data: EnvCheckRecord }>("/env-checks", {
      method: "POST",
      body: JSON.stringify(data),
    }).then(r => r.data),
  getEnvCheckTodaySummary: () =>
    request<{ data: EnvCheckTodaySummary }>("/env-checks/summary/today").then(r => r.data),

  // Equipment Check (เช็กการทำงานเครื่องมือประจำวัน — ห้องเตรียมตัวอย่าง ฯลฯ)
  getEquipmentChecks: (params: {
    room: string;
    date?: string;          // YYYY-MM-DD หรือ "all"
    from?: string;
    to?: string;
    instrumentId?: string;
    status?: "normal" | "abnormal";
  }) => {
    const qs = "?" + new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null && v !== "").map(([k, v]) => [k, String(v)]),
    ).toString();
    return request<{ data: EquipmentCheckRecord[] }>(`/equipment-checks${qs}`).then(r => r.data);
  },
  createEquipmentCheck: (data: CreateEquipmentCheckPayload) =>
    request<{ data: EquipmentCheckRecord }>("/equipment-checks", {
      method: "POST",
      body: JSON.stringify(data),
    }).then(r => r.data),

  // ประวัติค่าอุณหภูมิ/ความชื้นจาก Node-RED (เรียงใหม่สุดก่อน; [] เมื่อยังไม่มี)
  // ใช้ดึง "ค่าล่าสุดต่อ board" มา pre-fill — การ capture สดทำผ่าน trigger flow ภายหลัง
  getLiveTempHum: () => request<LiveTempHum[]>("/temphum"),

  // ── Env room config (board ↔ room mapping + thresholds) ──
  getEnvRoomConfigs: () =>
    request<{ data: EnvRoomConfig[] }>("/env-room-config").then((r) => r.data),
  updateEnvRoomConfig: (slug: EnvRoomConfig["slug"], input: EnvRoomConfigInput) =>
    request<{ data: EnvRoomConfig }>(`/env-room-config/${slug}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }).then((r) => r.data),

  // ── Document number config (petition / sampleReceipt / labRequest formats) ──
  getDocumentNumberConfigs: () =>
    request<{ data: DocumentNumberConfig[] }>("/document-number-config").then((r) => r.data),
  updateDocumentNumberConfig: (docType: DocNumberType, input: DocumentNumberConfigInput) =>
    request<{ data: DocumentNumberConfig }>(`/document-number-config/${docType}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }).then((r) => r.data),

  // ── Dashboard layout config (per-role section/KPI layout for Lab & QC) ──
  getDashboardLayouts: (dashboard: DashboardId) =>
    request<{ data: StoredLayout[] }>(`/dashboard-layout?dashboard=${dashboard}`).then((r) => r.data),
  updateDashboardLayout: (dashboard: DashboardId, roleId: string, input: DashboardLayout) =>
    request<{ data: StoredLayout }>(`/dashboard-layout/${dashboard}/${encodeURIComponent(roleId)}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }).then((r) => r.data),

  // Print
  getPrinters: () => request<{ data: string[] }>("/print/printers").then((r) => r.data),
  getPrintConfigs: () =>
    request<{ data: PrintConfig[] }>("/print/config").then((r) => r.data),
  updatePrintConfig: (slug: PrintDocType, input: PrintConfigInput) =>
    request<{ data: PrintConfig }>(`/print/config/${slug}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }).then((r) => r.data),
  printDocument: (payload: { docType: PrintDocType; html: string; copies?: number }) =>
    request<{ ok: boolean; printer: string; copies: number }>("/print", {
      method: "POST",
      body: JSON.stringify(payload),
    }).then((r) => ({ printer: r.printer, copies: r.copies })),

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
  getLastBatchValues: (commonName: string, parameterId: string, excludePetitionId: string) => {
    const qs = new URLSearchParams({ commonName, parameterId, excludePetitionId }).toString();
    return request<{ petitionNo?: string; enteredAt?: string; values?: Record<string, unknown> }>(`/qc-results/last-values?${qs}`);
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
  // One track (Lab or QC) records "บันทึกผล". Backend flips the petition to
  // success only when every required track is done; otherwise it stays inProgress.
  completePetitionTrack: (
    petitionId: string,
    side: "lab" | "qc",
    actor: string,
    redoExplanation?: string,
  ) =>
    request<import("@/types/petition.types").Petition>(`/petitions/${petitionId}/complete`, {
      method: "POST",
      body: JSON.stringify({ side, actor, redoExplanation }),
    }),
  labApprovePetition: (petitionId: string, actor: string) =>
    request<import("@/types/petition.types").Petition>(`/petitions/${petitionId}/lab-approve`, {
      method: "POST",
      body: JSON.stringify({ actor }),
    }),
  labRejectPetition: (petitionId: string, actor: string, note: string) =>
    request<import("@/types/petition.types").Petition>(`/petitions/${petitionId}/lab-reject`, {
      method: "POST",
      body: JSON.stringify({ actor, note }),
    }),
  approvePetition: (
    petitionId: string,
    actor: string,
    conclusion: "pass" | "accepted-oos" = "pass",
    conclusionNote?: string,
  ) =>
    request<import("@/types/petition.types").Petition>(`/petitions/${petitionId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "approved", actor, conclusion, conclusionNote }),
    }),
  rejectPetition: (
    petitionId: string,
    actor: string,
    revisionNote: string,
    target: "requester" | "lab" | "qc" | "both" = "requester",
  ) =>
    request<import("@/types/petition.types").Petition>(`/petitions/${petitionId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "rejected", actor, revisionNote, target }),
    }),
  // Dev-only: raw-set petition.status via the gated backend dev endpoint
  // (bypasses business guards; companion fields are NOT touched).
  devSetPetitionStatus: (
    petitionId: string,
    status: import("@/types/petition.types").PetitionStatus,
    actor: string,
  ) =>
    request<import("@/types/petition.types").Petition>(`/dev/petition-status/${petitionId}`, {
      method: "PATCH",
      body: JSON.stringify({ status, actor }),
    }),
  getPetition: (petitionId: string) =>
    request<import("@/types/petition.types").Petition>(`/petitions/${petitionId}`),
  findRejectedByBatch: (batchNo: string, employeeId: string) => {
    const qs = new URLSearchParams({ batchNo, employeeId }).toString();
    return request<import("@/types/petition.types").Petition[]>(`/petitions/rejected-by-batch?${qs}`);
  },

  // Methods (admin-managed method registry)
  getMethods: () => request<MethodDoc[]>("/methods"),
  createMethod: (data: MethodInput) =>
    request<MethodDoc>("/methods", { method: "POST", body: JSON.stringify(data) }),
  updateMethod: (id: string, data: MethodInput) =>
    request<MethodDoc>(`/methods/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteMethod: (id: string) =>
    request<{ ok: true }>(`/methods/${encodeURIComponent(id)}`, { method: "DELETE" }),

  // Standard Config
  getStandardConfigs: () => request<StandardConfigDoc[]>("/standard-configs"),
  createStandardConfig: (data: Partial<StandardConfigDoc>) =>
    request<StandardConfigDoc>("/standard-configs", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateStandardConfig: (id: string, data: Partial<StandardConfigDoc>) =>
    request<StandardConfigDoc>(`/standard-configs/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteStandardConfig: (id: string) =>
    request<{ ok: true }>(`/standard-configs/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
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

export type EquipmentReading = { key: string; label: string; value: number; unit: string };

export type EquipmentCheckRecord = {
  _id?: string;
  roomSlug: string;
  instrumentId: string;
  instrumentName: string;
  brand?: string;
  status: "normal" | "abnormal";
  readings: EquipmentReading[];
  note?: string;
  recorder: string;
  recorderId?: string;
  recorderEmail?: string;
  date: string;       // YYYY-MM-DD
  checkedAt: string;  // ISO
  createdAt?: string;
  updatedAt?: string;
};

export type CreateEquipmentCheckPayload = {
  roomSlug: string;
  instrumentId: string;
  instrumentName: string;
  brand?: string;
  status: "normal" | "abnormal";
  readings?: EquipmentReading[];
  note?: string;
  recorder: string;
  recorderId?: string;
  recorderEmail?: string;
};

export type EnvCheckRecord = {
  _id?: string;
  room: "balance" | "sample-prep" | "analysis";
  roomName: string;
  temperature: number;
  humidity: number;
  tempMin: number;
  tempMax: number;
  humidityMax: number;
  tempStatus: "pass" | "fail";
  humidityStatus: "pass" | "fail";
  status: "pass" | "fail";
  note?: string;
  recorder: string;
  recorderId?: string;
  recorderEmail?: string;
  date: string;       // YYYY-MM-DD
  checkedAt: string;  // ISO
  createdAt?: string;
  updatedAt?: string;
};

export type CreateEnvCheckPayload = {
  room: "balance" | "sample-prep" | "analysis";
  roomName: string;
  temperature: number;
  humidity: number;
  tempMin: number;
  tempMax: number;
  humidityMax: number;
  note?: string;
  recorder: string;
  recorderId?: string;
  recorderEmail?: string;
};

export type EnvCheckTodaySummary = {
  date: string;
  count: number;
  rooms: string[];
  allPass: boolean;
};

export type LiveTempHum = {
  board: string;
  temp?: number;
  hum?: number;
  receivedAt?: string; // ISO
};

// Config mapping a result param key → a lab instrument's API endpoint.
export type InstrumentSource = {
  _id?: string;
  key: string;            // ties to a result field key e.g. "density"
  label?: string;
  instrumentName?: string;
  fetchUrl?: string;
  method?: string;
  authHeader?: string;
  responsePath?: string;  // dotted path to the value in the JSON reply
  readingAtPath?: string; // optional dotted path to the device timestamp
  unit?: string;
  decimals?: number | null;
  timeoutMs?: number;
  enabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

// Result of a live pull. ok:false carries a Thai error for display.
export type InstrumentReading = {
  ok: boolean;
  key: string;
  value?: number;
  unit?: string;
  instrument?: string;
  readingAt?: string; // ISO
  raw?: unknown;
  error?: string;
};

// Provenance stored alongside a pulled field value (as a sibling key).
export type ValueProvenance = {
  source: "instrument" | "instrument-edited";
  instrument?: string;
  rawValue?: number;
  fetchedAt?: string;
  fetchedBy?: string;
};

export type MachineItem = {
  _id?: string;
  code: string;
  type?: string;
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

export type SubstanceStandard = {
  substance: string;      // เก็บแบบ extractSubstanceName เช่น "ABAMECTIN"
  operator: StandardOperator;
  value: number | null;
  value2?: number | null; // ใช้กับ between / tolerance
};

export type StandardConditionOp = "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "between";

export type StandardCondition = {
  sourceParameterId?: string | null;  // null/ว่าง = field พี่น้องใน parameter เดียวกัน
  sourceFieldLabel: string;
  op: StandardConditionOp;
  value: string | number;
  value2?: number | null;             // ใช้กับ between
};

export type StandardRule = {
  label?: string;                     // ป้ายชื่อกฎ เช่น "ก้อนใหญ่"
  conditions: StandardCondition[];    // AND กันทุกตัว; ว่าง = เข้าเสมอ (default row)
  operator: StandardOperator;
  value: number | null;
  value2?: number | null;
};

export type TimerUnit = "minute" | "hour" | "day" | "month";

export type ParameterFieldPhase = "both" | "before" | "after";

export type ParameterValueField = {
  label: string;
  type: ParameterValueFieldType;
  unit?: string;
  standardValue?: number | null;
  standardOperator?: StandardOperator;
  standardValue2?: number | null;
  // Per-substance standards (number/float only). เมื่อ substanceMode = true
  // ค่าเดี่ยว standardOperator/standardValue ถูก ignore.
  substanceMode?: boolean;
  substanceStandards?: SubstanceStandard[];
  // Conditional standards (number/float). เมื่อ conditionalMode = true
  // standardOperator/standardValue และ substance* ถูก ignore.
  conditionalMode?: boolean;
  conditionalStandards?: StandardRule[];
  // โชว์ค่า field เดียวกันจากผลตรวจครั้งก่อนของ common name เดียวกัน (display-only)
  showLastBatch?: boolean;
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
    itemGroups?: string[];     // group ID ที่ option นี้จำกัดให้แสดง
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
  itemGroups?: string[];
  valueFields?: ParameterValueField[];
  sortOrder?: number;
  note?: string;
  // 2-phase testing toggle — when true, this parameter is split into ก่อน/หลัง
  hasPhases?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type ItemGroupItem = {
  _id: string;
  name: string;
  description?: string;
  commonNames: string[];
  tradeNames: string[];
  includeItemNos: string[];
  excludeItemNos: string[];
  status: "active" | "inactive";
  sortOrder?: number;
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
