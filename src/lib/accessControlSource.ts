import { api } from "@/lib/api";

// Single source for the /access-control matrix. Previously three places fetched
// it independently on every navigation (AuthContext dev-matrix, useCanAccessPath,
// PrivateRoute), producing 3 redundant requests. They now share this loader:
// one in-flight promise, one cached payload, one invalidation path.

export type AccessGroup = { id: string; paths?: string[] };
export type AccessControlPayload = {
  groups: AccessGroup[];
  permissions: Record<string, string[]>;
  roles?: { id: string; name: string }[];
};

let cache: AccessControlPayload | null = null;
let inflight: Promise<AccessControlPayload> | null = null;

export function loadAccessControl(force = false): Promise<AccessControlPayload> {
  if (force) cache = null;
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = api
      .get<AccessControlPayload>("/access-control")
      .then((res) => {
        cache = res.data.data;
        return cache;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function invalidateAccessControl() {
  cache = null;
}
