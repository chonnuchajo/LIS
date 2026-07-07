import { useSyncExternalStore, useCallback } from "react";
import { resolveActiveRole } from "@/lib/dashboardProfiles";

const KEY = "lis.activeRole";
const listeners = new Set<() => void>();

export function getStoredActiveRole(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function setActiveRole(roleId: string): void {
  try { localStorage.setItem(KEY, roleId); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

export function subscribeActiveRole(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useActiveRole(roleIds: string[]) {
  const stored = useSyncExternalStore(subscribeActiveRole, getStoredActiveRole, () => null);
  const activeRole = resolveActiveRole(roleIds, stored);
  const set = useCallback((id: string) => setActiveRole(id), []);
  return { activeRole, setActiveRole: set };
}
