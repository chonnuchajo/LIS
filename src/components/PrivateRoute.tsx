import { Navigate, useLocation } from "react-router-dom";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { useAuth } from "@/context/AuthContext";
import { hasModulePermission, type ModuleId } from "@/lib/accessControl";

const PrivateRoute = ({ children, moduleId }: { children: React.ReactNode; moduleId?: ModuleId | ModuleId[] }) => {
  const isAuthenticated = useIsAuthenticated();
  const { inProgress } = useMsal();
  const { user } = useAuth();
  const location = useLocation();

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

  const allowed = Array.isArray(moduleId)
    ? moduleId.some((id) => hasModulePermission(user, id))
    : hasModulePermission(user, moduleId);

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
