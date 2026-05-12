import { useEffect, useState, useCallback } from 'react';
import type { Petition, PetitionAuditLogEntry } from '@/types/petition.types';
import type { PetitionFormValues } from '@/lib/validations';

const BASE = import.meta.env.BASE_URL + 'api';

interface ApiError extends Error {
  response?: { data?: { error?: { message?: string } } };
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { message: res.statusText } }));
    const err = new Error(body?.error?.message || res.statusText) as ApiError;
    err.response = { data: body };
    throw err;
  }
  return res.json();
}

// ===== Single petition =====
export function usePetition(id: string | undefined) {
  const [data, setData] = useState<Petition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError('ไม่พบ id');
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    apiFetch<Petition>(`/petitions/${id}`)
      .then((p) => {
        if (!alive) return;
        setData(p);
      })
      .catch((e: Error) => {
        if (!alive) return;
        setError(e.message);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  return { data, loading, error };
}

// ===== Petition list =====
interface PetitionListParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}
interface PetitionListResponse {
  items: Petition[];
  total: number;
  page: number;
  limit: number;
}

export function usePetitionList(params: PetitionListParams) {
  const [data, setData] = useState<PetitionListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  const queryString = (() => {
    const sp = new URLSearchParams();
    if (params.page) sp.set('page', String(params.page));
    if (params.limit) sp.set('limit', String(params.limit));
    if (params.status) sp.set('status', params.status);
    if (params.search) sp.set('search', params.search);
    return sp.toString();
  })();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    apiFetch<PetitionListResponse>(`/petitions?${queryString}`)
      .then((res) => {
        if (!alive) return;
        setData(res);
      })
      .catch((e: Error) => {
        if (!alive) return;
        setError(e.message);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [queryString, reloadKey]);

  return { data, loading, error, refresh };
}

// ===== Mutations =====
export async function createPetition(
  values: PetitionFormValues,
  prodOrderNos?: string[],
): Promise<Petition> {
  return apiFetch<Petition>('/petitions', {
    method: 'POST',
    body: JSON.stringify({ ...values, prodOrderNos: prodOrderNos ?? [] }),
  });
}

export async function updatePetition(
  id: string,
  values: PetitionFormValues,
  actor?: string,
): Promise<Petition> {
  return apiFetch<Petition>(`/petitions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...values, actor }),
  });
}

export async function deletePetition(id: string, actor?: string): Promise<void> {
  const qs = actor ? `?actor=${encodeURIComponent(actor)}` : '';
  await apiFetch<{ success: true }>(`/petitions/${id}${qs}`, { method: 'DELETE' });
}

export async function getSubmittedOrderNos(): Promise<Set<string>> {
  const list = await apiFetch<string[]>('/petitions/submitted-orders');
  return new Set(list);
}

// ===== Audit log =====
export function usePetitionAuditLog(id: string | undefined) {
  const [data, setData] = useState<PetitionAuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    apiFetch<{ items: PetitionAuditLogEntry[] }>(`/petitions/${id}/audit-logs`)
      .then((res) => {
        if (!alive) return;
        setData(res.items ?? []);
      })
      .catch((e: Error) => {
        if (!alive) return;
        setError(e.message);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id, reloadKey]);

  return { data, loading, error, refresh };
}
