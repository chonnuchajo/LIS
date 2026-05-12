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
const BASE = import.meta.env.BASE_URL + "api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || "API Error");
  }
  return res.json();
}

// Generic axios-style methods for pages that use api.get/api.patch pattern
async function axiosStyleRequest<T>(path: string, options?: RequestInit): Promise<{ data: { data: T } }> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    const err = new Error(body.message || body.error?.message || "API Error") as Error & { response?: { data: unknown } };
    err.response = { data: body };
    throw err;
  }
  const data = await res.json();
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
