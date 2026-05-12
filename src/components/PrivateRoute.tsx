import { Navigate, useLocation } from "react-router-dom";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { hasModulePermission, type ModuleId } from "@/lib/accessControl";
import { api } from "@/lib/api";
import { DEV_MODE } from "@/config/dev";

type AccessModule = {
  id: string;
  path?: string;
  paths?: string[];
};

type AccessControlState = {
  modules: AccessModule[];
};

let moduleMapCache: AccessModule[] | null = null;
let moduleMapRequest: Promise<AccessModule[]> | null = null;

function normalizePath(path: string) {
  if (!path || path === "/") return "/";
  return path.replace(/\/+$/, "");
}

function pathMatches(pattern: string, pathname: string) {
  const normalizedPattern = normalizePath(pattern);
  const normalizedPath = normalizePath(pathname);

  if (normalizedPattern === normalizedPath) return true;
  if (normalizedPattern.endsWith("/*")) {
    return normalizedPath.startsWith(normalizedPattern.slice(0, -2));
  }

  const patternParts = normalizedPattern.split("/");
  const pathParts = normalizedPath.split("/");
  if (patternParts.length !== pathParts.length) return false;

  return patternParts.every((part, index) => part.startsWith(":") || part === pathParts[index]);
}

function findMappedModuleId(pathname: string, modules: AccessModule[]) {
  for (const module of modules) {
    const paths = module.paths?.length ? module.paths : [module.path].filter(Boolean);
    if (paths.some((path) => pathMatches(path, pathname))) return module.id;
  }
  return undefined;
}

function loadModuleMap() {
  if (moduleMapCache) return Promise.resolve(moduleMapCache);
  if (!moduleMapRequest) {
    moduleMapRequest = api
      .get<AccessControlState>("/access-control")
      .then((res) => {
        moduleMapCache = res.data.data.modules;
        return moduleMapCache;
      })
      .finally(() => {
        moduleMapRequest = null;
      });
  }
  return moduleMapRequest;
}

const PrivateRoute = ({ children, moduleId }: { children: React.ReactNode; moduleId?: ModuleId | ModuleId[] }) => {
  const isAuthenticated = useIsAuthenticated();
  const { inProgress } = useMsal();
  const { user } = useAuth();
  const location = useLocation();
  const [mappedModuleId, setMappedModuleId] = useState<ModuleId | undefined>();
  const [mappingLoaded, setMappingLoaded] = useState(false);
  const [mappingVersion, setMappingVersion] = useState(0);

  useEffect(() => {
    const refreshMapping = () => {
      moduleMapCache = null;
      setMappingVersion((current) => current + 1);
    };
    window.addEventListener("lis-access-modules-changed", refreshMapping);
    return () => {
      window.removeEventListener("lis-access-modules-changed", refreshMapping);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setMappingLoaded(false);
    loadModuleMap()
      .then((modules) => {
        if (!alive) return;
        setMappedModuleId(findMappedModuleId(location.pathname, modules));
      })
      .catch(() => {
        if (alive) setMappedModuleId(undefined);
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

  // Wait while MSAL is processing (redirect callback etc.)
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

  const effectiveModuleId = mappedModuleId ?? moduleId;
  const allowed = Array.isArray(effectiveModuleId)
    ? effectiveModuleId.some((id) => hasModulePermission(user, id))
    : hasModulePermission(user, effectiveModuleId);

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md rounded-lg border bg-card p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-foreground">ไม่มีสิทธิ์เข้าใช้งานหน้านี้</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Role ของคุณยังไม่ได้รับสิทธิ์ใน Module Permission Matrix สำหรับหน้านี้
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default PrivateRoute;
