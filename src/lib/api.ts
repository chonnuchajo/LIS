import type { SampleItem } from "@/components/lis/SampleColumn";
import type { ApprovalInfo, PhysicalResult, RealtimeDensity } from "@/context/SampleContext";
import type {
  StockStandardItem,
  StockSolventItem,
  StockGlasswareItem,
  StockTransactionItem,
  StockTier,
} from "@/types/stock";

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

export type ParameterValueFieldType = "text" | "number" | "float" | "enum" | "photo" | "timer";

export type ParameterValueField = {
  label: string;
  type: ParameterValueFieldType;
  unit?: string;
  standardValue?: number | null;
  options?: string[];
  requireNoteOn?: string[];
  required?: boolean;
};

export type ParameterItem = {
  _id?: string;
  name: string;
  status?: "active" | "inactive";
  applyAll?: boolean;
  commonNames?: string[];
  itemNames?: string[];
  productTypes?: string[];
  categories?: string[];
  valueFields?: ParameterValueField[];
  sortOrder?: number;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
};
