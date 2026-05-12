import { Navigate, useLocation } from "react-router-dom";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { findGroupIdsForPath, userMatchesAnyGroup } from "@/lib/accessControl";
import { api } from "@/lib/api";
import { DEV_MODE } from "@/config/dev";

type AccessGroup = {
  id: string;
  paths?: string[];
};

type AccessControlState = {
  groups: AccessGroup[];
};

let groupMapCache: AccessGroup[] | null = null;
let groupMapRequest: Promise<AccessGroup[]> | null = null;

function loadGroupMap() {
  if (groupMapCache) return Promise.resolve(groupMapCache);
  if (!groupMapRequest) {
    groupMapRequest = api
      .get<AccessControlState>("/access-control")
      .then((res) => {
        groupMapCache = res.data.data.groups;
        return groupMapCache;
      })
      .finally(() => {
        groupMapRequest = null;
      });
  }
  return groupMapRequest;
}

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useIsAuthenticated();
  const { inProgress } = useMsal();
  const { user } = useAuth();
  const location = useLocation();
  const [mappedGroupIds, setMappedGroupIds] = useState<string[]>([]);
  const [mappingLoaded, setMappingLoaded] = useState(false);
  const [mappingVersion, setMappingVersion] = useState(0);

  useEffect(() => {
    const refreshMapping = () => {
      groupMapCache = null;
      setMappingVersion((current) => current + 1);
    };
    window.addEventListener("lis-access-groups-changed", refreshMapping);
    return () => {
      window.removeEventListener("lis-access-groups-changed", refreshMapping);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setMappingLoaded(false);
    loadGroupMap()
      .then((groups) => {
        if (!alive) return;
        const ids = findGroupIdsForPath(location.pathname, groups);
        setMappedGroupIds(ids.length ? ids : ["others"]);
      })
      .catch(() => {
        if (alive) setMappedGroupIds([]);
      })
      .finally(() => {
        if (alive) setMappingLoaded(true);
      });

    return () => {
      alive = false;
    };
  }, [location.pathname, mappingVersion]);

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

  if (!userMatchesAnyGroup(user, mappedGroupIds)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md rounded-lg border bg-card p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-foreground">ไม่มีสิทธิ์เข้าใช้งานหน้านี้</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Role ของคุณยังไม่ได้รับสิทธิ์ในกลุ่มที่ครอบคลุมหน้านี้
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default PrivateRoute;
