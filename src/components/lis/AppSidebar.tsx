import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Download, ClipboardList, FileBarChart, Settings, User, LogOut,
  Package, ShieldCheck, Database, FlaskConical, Scale, Home, LockKeyhole, FileText,
  ChevronLeft, ChevronRight, UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { ICP_LADDA_LOGO_URL } from "@/lib/branding";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { hasModulePermission, type ModuleId } from "@/lib/accessControl";
import { api } from "@/lib/api";

type RoleOption = {
  id: string;
  name: string;
};

type AccessControlState = {
  roles: RoleOption[];
};

const navGroups = [
  {
    label: "หน้าหลัก",
    items: [
      { icon: Home, label: "หน้าแรก", path: "/home", moduleId: "dashboard" },
      { icon: LayoutDashboard, label: "แดชบอร์ด", path: "/", moduleId: "dashboard" },
      { icon: FileText, label: "รายการคำร้อง", path: "/petitions", moduleId: "samples" },
      { icon: Download, label: "การรับตัวอย่าง", path: "/send-sample", moduleId: "samples" },
      { icon: ClipboardList, label: "ผลวิเคราะห์", path: "/record-results", moduleId: "results" },
      { icon: FileBarChart, label: "รายงานสรุป", path: "/report", moduleId: "reports" },
    ],
  },
  {
    label: "อื่นๆ",
    items: [
      { icon: UserCheck, label: "Assign คำร้อง", path: "/petitions/assign", moduleId: "qc" },
      { icon: FlaskConical, label: "การตรวจกายภาพ", path: "/physical-inspection", moduleId: "samples" },
      { icon: ClipboardList, label: "การบันทึก Standard", path: "/stock-deduction", moduleId: "results" },
      { icon: ShieldCheck, label: "อนุมัติผล QC", path: "/qc-approval", moduleId: "qc" },
      { icon: Scale, label: "Daily Check", path: "/daily-check", moduleId: "results" },
      { icon: Package, label: "Stock Management", path: "/stock", moduleId: "stock" },
      { icon: Database, label: "Master Item", path: "/master-items", moduleId: "stock" },
      { icon: Database, label: "Admin Data", path: "/admin-data", moduleId: "admin" },
      { icon: LockKeyhole, label: "Access Control", path: "/access-control", moduleId: "access" },
      { icon: Settings, label: "ตั้งค่าระบบ", path: "/settings", moduleId: "access" },
    ],
  },
] satisfies Array<{
  label: string;
  items: Array<{ icon: typeof Home; label: string; path: string; moduleId: ModuleId }>;
}>;

const STORAGE_KEY = "lis.sidebar.collapsed";

const AppSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [roleNameById, setRoleNameById] = useState<Record<string, string>>({});

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "1";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    let alive = true;
    api.get<AccessControlState>("/access-control")
      .then((res) => {
        if (!alive) return;
        setRoleNameById(Object.fromEntries(res.data.data.roles.map((role) => [role.id, role.name])));
      })
      .catch(() => {
        if (alive) setRoleNameById({});
      });

    return () => {
      alive = false;
    };
  }, []);

  const handleLogout = () => {
    logout();
    toast.success("ออกจากระบบสำเร็จ");
    navigate("/login", { replace: true });
  };
  const roleLabel = user?.role ? roleNameById[user.role] ?? user.role : "No role";

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={cn(
          "relative flex flex-col min-h-screen bg-card border-r border-border transition-[width] duration-200 ease-out",
          collapsed ? "w-16" : "w-72"
        )}
      >
        {/* Toggle button — sits on the right edge */}
        <button
          type="button"
          onClick={() => setCollapsed(v => !v)}
          aria-label={collapsed ? "ขยายเมนู" : "ซ่อนเมนู"}
          className="absolute -right-3 top-7 z-10 w-6 h-6 rounded-full border border-border bg-card shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>

        {/* Header */}
        <div className={cn(
          "flex items-center border-b border-border transition-all",
          collapsed ? "justify-center px-0 py-4" : "gap-3 px-5 py-6"
        )}>
          <img
            src={ICP_LADDA_LOGO_URL}
            alt="ICP Logo"
            className={cn(
              "rounded-full object-contain transition-all",
              collapsed ? "w-10 h-10" : "w-14 h-14"
            )}
          />
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="font-bold text-foreground text-lg leading-tight">LIS</h1>
              <p className="text-[10px] text-muted-foreground leading-tight tracking-wider">
                LAB INFORMATION<br />SYSTEM
              </p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className={cn("flex-1 py-3 overflow-y-auto", collapsed ? "px-2" : "px-3")}>
          {navGroups.map((group, gIdx) => {
            const visibleItems = group.items.filter((item) => hasModulePermission(user, item.moduleId));
            if (visibleItems.length === 0) return null;

            return (
            <div key={group.label} className={cn(gIdx > 0 && (collapsed ? "mt-3 pt-3 border-t border-border" : "mt-4"))}>
              {!collapsed && (
                <div className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </div>
              )}
              <div className="space-y-1">
                {visibleItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  const Btn = (
                    <button
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      className={cn(
                        "flex items-center w-full rounded-lg text-sm font-medium transition-colors",
                        collapsed ? "justify-center h-10 px-0" : "gap-3 px-3 py-2.5",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <item.icon className="w-5 h-5 shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </button>
                  );
                  return collapsed ? (
                    <Tooltip key={item.path}>
                      <TooltipTrigger asChild>{Btn}</TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                  ) : Btn;
                })}
              </div>
            </div>
          );
          })}
        </nav>

        {/* Footer */}
        <div className={cn("mt-auto space-y-2", collapsed ? "p-2" : "p-3")}>
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="w-full flex justify-center bg-accent rounded-lg py-2.5">
                  {user?.photoUrl ? (
                    <img
                      src={user.photoUrl}
                      alt={user?.name || user?.email || "Profile"}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                      <User className="w-4 h-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                <div className="text-xs">
                  <div className="font-semibold">{user?.name || user?.email}</div>
                  <div className="text-muted-foreground">{user?.email}</div>
                  <div className="text-muted-foreground">Role: {roleLabel}</div>
                  <div className="text-muted-foreground">
                    {[user?.department, user?.position].filter(Boolean).join(" · ") || "Unassigned"}
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-3 bg-accent rounded-lg px-3 py-2.5">
              {user?.photoUrl ? (
                <img
                  src={user.photoUrl}
                  alt={user?.name || user?.email || "Profile"}
                  className="h-8 w-8 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-primary-foreground" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{user?.name || user?.email}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                <p className="text-[11px] text-muted-foreground truncate">Role: {roleLabel}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {[user?.department, user?.position].filter(Boolean).join(" · ") || "Unassigned"}
                </p>
              </div>
            </div>
          )}

          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleLogout}
                  aria-label="ออกจากระบบ"
                  className="flex items-center justify-center w-full h-10 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">ออกจากระบบ</TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              ออกจากระบบ
            </button>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
};

export default AppSidebar;
