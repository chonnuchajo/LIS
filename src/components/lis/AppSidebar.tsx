import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, LogOut, User,
} from "lucide-react";
import { NAV_ITEMS } from "@/lib/navItems";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { ICP_LADDA_LOGO_URL } from "@/lib/branding";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { hasGroupPermission, pathMatches } from "@/lib/accessControl";
import { api } from "@/lib/api";

type RoleOption = {
  id: string;
  name: string;
};

type NavGroup = {
  id: string;
  name?: string;
  paths?: string[];
  sortOrder?: number;
};

type AccessControlState = {
  roles: RoleOption[];
  groups: NavGroup[];
};

const STORAGE_KEY = "lis.sidebar.collapsed";
const ACCESS_CONTROL_QUERY_KEY = ["access-control"];
const EMPTY_GROUPS: NavGroup[] = [];

const AppSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();

  // Cached via React Query so the sidebar keeps its grouped layout across
  // page navigations instead of flashing the flat fallback menu on remount.
  const { data: accessControl } = useQuery({
    queryKey: ACCESS_CONTROL_QUERY_KEY,
    queryFn: async () => {
      const res = await api.get<AccessControlState>("/access-control");
      return res.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const roleNameById = useMemo<Record<string, string>>(
    () => Object.fromEntries((accessControl?.roles ?? []).map((r) => [r.id, r.name])),
    [accessControl],
  );
  const navGroups = accessControl?.groups?.length ? accessControl.groups : EMPTY_GROUPS;

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "1";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    const handler = () => queryClient.invalidateQueries({ queryKey: ACCESS_CONTROL_QUERY_KEY });
    window.addEventListener("lis-access-groups-changed", handler);
    return () => window.removeEventListener("lis-access-groups-changed", handler);
  }, [queryClient]);

  const handleLogout = () => {
    logout();
    toast.success("ออกจากระบบสำเร็จ");
    navigate("/login", { replace: true });
  };

  const sections = useMemo(() => {
    const sorted = [...navGroups].sort((a, b) => {
      // 'others' is the locked catch-all — always pinned last, regardless of sortOrder.
      if (a.id === "others") return 1;
      if (b.id === "others") return -1;
      return (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
    });
    if (sorted.length === 0) return [{ id: "all", label: "เมนู", items: [...NAV_ITEMS] }];

    const coveredPaths = sorted
      .filter((g) => g.id !== "others")
      .flatMap((g) => g.paths ?? []);

    const result = sorted
      .map((group) => {
        let items: typeof NAV_ITEMS;
        if (group.id === "others") {
          // Membership is computed (uncovered pages), but group.paths is honored
          // as an ordering hint so the admin's arrangement sticks.
          const uncovered = NAV_ITEMS.filter(
            (item) => !coveredPaths.some((p) => pathMatches(p, item.path)),
          );
          items = [];
          for (const p of group.paths ?? []) {
            const match = uncovered.find((item) => pathMatches(p, item.path));
            if (match && !items.includes(match)) items.push(match);
          }
          for (const item of uncovered) {
            if (!items.includes(item)) items.push(item);
          }
        } else {
          // Follow the order stored in group.paths so the admin's arrangement sticks.
          items = [];
          for (const p of group.paths ?? []) {
            for (const item of NAV_ITEMS) {
              if (pathMatches(p, item.path) && !items.includes(item)) items.push(item);
            }
          }
        }
        return { id: group.id, label: group.name || group.id, items };
      })
      .filter((g) => g.items.length > 0);

    return result;
  }, [navGroups]);

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
          {sections.map((section, sIdx) => {
            if (!hasGroupPermission(user, section.id)) return null;
            const visibleItems = section.items;
            if (visibleItems.length === 0) return null;

            return (
            <div key={section.id} className={cn(sIdx > 0 && (collapsed ? "mt-3 pt-3 border-t border-border" : "mt-4"))}>
              {!collapsed && (
                <div className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {section.label}
                </div>
              )}
              <div className="space-y-1">
                {visibleItems.map((item) => {
                  const targetPath =
                    item.path === "/"
                      ? user?.role === "qc"
                        ? "/dashboard/qc"
                        : "/dashboard/lab"
                      : item.path;
                  const isActive =
                    location.pathname === targetPath ||
                    (item.path === "/" && location.pathname.startsWith("/dashboard/"));
                  const Btn = (
                    <button
                      key={item.path}
                      onClick={() => navigate(targetPath)}
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
