import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutGrid } from "lucide-react";
import HomeHeader from "@/components/home/HomeHeader";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { NAV_ITEMS } from "@/lib/navItems";
import { userCanAccessPath } from "@/lib/accessControl";
import { normalizeRoles, unionPermissions } from "@/lib/roles";

type AccessGroup = { id: string; paths?: string[] };
type AccessControlState = { groups: AccessGroup[]; permissions: Record<string, string[]> };

export default function HomeGeneric() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [accessControl, setAccessControl] = useState<AccessControlState | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .get<AccessControlState>("/access-control")
      .then((res) => {
        if (!alive) return;
        setAccessControl(res.data.data);
      })
      .catch(() => {
        if (alive) setAccessControl({ groups: [], permissions: {} });
      });
    return () => {
      alive = false;
    };
  }, []);

  const roles = normalizeRoles(user);
  const userWithPerms =
    user && roles.length > 0
      ? { ...user, permissions: unionPermissions(roles, accessControl?.permissions ?? {}) }
      : user;

  const accessible = NAV_ITEMS.filter(
    (item) => item.path !== "/home" && userCanAccessPath(userWithPerms, item.path, accessControl?.groups ?? []),
  );

  return (
    <>
      <HomeHeader
        title={user?.name ? user.name : "ยินดีต้อนรับ"}
        subtitle="เลือกเมนูที่คุณเข้าใช้งานได้"
        icon={LayoutGrid}
      />

      {accessControl === null ? (
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
