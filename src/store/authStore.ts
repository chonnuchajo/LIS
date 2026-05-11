// Compat shim mimicking a Zustand-like selector hook so pages copied from
// other projects (`useAuthStore((s) => s.user?.role)`) work on top of our
// Context-based AuthContext.
import { useAuth } from '@/context/AuthContext';

interface AuthStoreShape {
  user: ReturnType<typeof useAuth>['user'];
}

export function useAuthStore<T>(selector: (s: AuthStoreShape) => T): T {
  const { user } = useAuth();
  return selector({ user });
}