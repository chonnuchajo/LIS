import { Navigate, useLocation } from "react-router-dom";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { userCanAccessPath } from "@/lib/accessControl";
import { api } from "@/lib/api";
import { DEV_MODE } from "@/config/dev";

type AccessGroup = {
  id: string;
  paths?: string[];
};

type AccessControlState = {
  groups: AccessGroup[];
  permissions: Record<string, string[]>;
};

let accessControlCache: AccessControlState | null = null;
let accessControlRequest: Promise<AccessControlState> | null = null;

function loadAccessControl() {
  if (accessControlCache) return Promise.resolve(accessControlCache);
  if (!accessControlRequest) {
    accessControlRequest = api
      .get<AccessControlState>("/access-control")
      .then((res) => {
        accessControlCache = res.data.data;
        return accessControlCache;
      })
      .finally(() => {
        accessControlRequest = null;
      });
  }
  return accessControlRequest;
}

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useIsAuthenticated();
  const { inProgress } = useMsal();
  const { user } = useAuth();
  const location = useLocation();
  const [accessControl, setAccessControl] = useState<AccessControlState | null>(null);
  const [mappingLoaded, setMappingLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [mappingVersion, setMappingVersion] = useState(0);

  useEffect(() => {
    const refreshMapping = () => {
      accessControlCache = null;
      setMappingVersion((current) => current + 1);
    };
    window.addEventListener("lis-access-groups-changed", refreshMapping);
    return () => {
      window.removeEventListener("lis-access-groups-changed", refreshMapping);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    if (!accessControl) {
      setMappingLoaded(false);
    }
    loadAccessControl()
      .then((loadedAccessControl) => {
        if (!alive) return;
        setAccessControl(loadedAccessControl);
        setLoadFailed(false);
      })
      .catch(() => {
        if (alive) setLoadFailed(true);
      })
      .finally(() => {
        if (alive) setMappingLoaded(true);
      });

    return () => {
      alive = false;
    };
  }, [mappingVersion]);

  if (DEV_MODE) {
    return <>{children}</>;
  }

  if (inProgress !== InteractionStatus.None) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!user?.role || user.status === undefined) {
    return null;
  }

  if (!mappingLoaded) {
    return null;
  }

  const currentUser = user?.role && accessControl?.permissions[user.role]
    ? { ...user, permissions: accessControl.permissions[user.role] }
    : user;
  const isRedirectOnlyRoute = location.pathname === "/";

  if (!loadFailed && !isRedirectOnlyRoute && !userCanAccessPath(currentUser, location.pathname, accessControl?.groups ?? [])) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md rounded-lg border bg-card p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-foreground">ไม่มีสิทธิ์เข้าใช้งานหน้านี้</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Role ของคุณยังไม่ได้รับสิทธิ์สำหรับหน้านี้
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default PrivateRoute;
