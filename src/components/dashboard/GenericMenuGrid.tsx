import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LayoutGrid } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { NAV_ITEMS } from "@/lib/navItems";
import { userCanAccessPath } from "@/lib/accessControl";
import { normalizeRoles, unionPermissions } from "@/lib/roles";
import { loadAccessControl } from "@/lib/accessControlSource";

// Fallback dashboard for any role that doesn't resolve to a real profile
// (see resolveProfileForRole in dashboardProfiles.ts): a plain grid of the
// nav pages this user can actually access, ported from the deleted
// HomeGeneric (git show ae42f66^:src/components/home/HomeGeneric.tsx).
// No petition data here — access-driven only, so it's safe for restricted
// custom roles that would 403 on a real drilldown.
export default function GenericMenuGrid() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: access } = useQuery({ queryKey: ["access-control"], queryFn: () => loadAccessControl() });

  const roles = normalizeRoles(user);
  const userWithPerms =
    user && roles.length > 0
      ? { ...user, permissions: unionPermissions(roles, access?.permissions ?? {}) }
      : user;

  const accessible = NAV_ITEMS.filter(
    (item) => item.path !== "/home" && userCanAccessPath(userWithPerms, item.path, access?.groups ?? []),
  );

  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <LayoutGrid className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight leading-tight">
            {user?.name ? user.name : "ยินดีต้อนรับ"}
          </h1>
          <p className="text-xs text-muted-foreground">เลือกเมนูที่คุณเข้าใช้งานได้</p>
        </div>
      </div>

      {access === undefined ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            กำลังโหลดเมนู...
          </CardContent>
        </Card>
      ) : accessible.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm font-medium">ยังไม่มีเมนูที่เข้าใช้งานได้</p>
            <p className="text-xs text-muted-foreground mt-1">
              กรุณาติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {accessible.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.path}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
