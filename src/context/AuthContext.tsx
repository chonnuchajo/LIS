import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "@/lib/msalConfig";
import { api } from "@/lib/api";
import { loadAccessControl } from "@/lib/accessControlSource";
import { DEV_MODE, DEV_DEFAULT_ROLE, synthesizeDevUser } from "@/config/dev";
import { unionPermissions } from "@/lib/roles";

interface AuthUser {
  id?: string;
  email: string;
  name?: string;
  photoUrl?: string;
  role?: string;
  roles?: string[];
  permissions?: string[];
  department?: string;
  position?: string;
  employeeId?: string;
  status?: "active" | "inactive";
}

interface AuthContextType {
  user: AuthUser | null;
  login: (redirectTo?: string, loginHint?: string) => Promise<void>;
  // Seamless SSO when another system forwards ?login_hint=<email>: try a silent
  // sign-in against any existing Microsoft session first, falling back to a full
  // redirect (still pre-filled with the hint) if silent auth isn't possible.
  loginWithHint: (loginHint: string, redirectTo?: string) => Promise<void>;
  loginWithProductionToken: (token: string) => Promise<AuthUser>;
  logout: () => void;
  // Self-service link of the current user to an HR employee record. Used by the
  // EmployeeLinkGate when auto-link by email found no match. Updates local auth
  // state on success so the gate closes without a re-login.
  linkSelfEmployee: (employeeId: string) => Promise<void>;
  devRoleIds?: string[];
  devRoles?: { id: string; name: string }[];
  toggleDevRole?: (role: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { instance, accounts } = useMsal();
  const account = accounts[0] ?? null;
  const [syncedUser, setSyncedUser] = useState<AuthUser | null>(null);
  const [productionUser, setProductionUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem("lis_production_sso_user");
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      localStorage.removeItem("lis_production_sso_user");
      return null;
    }
  });
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | undefined>();
  const [devRoleIds, setDevRoleIds] = useState<string[]>(() => {
    const multi = localStorage.getItem("dev_roles");
    if (multi) {
      try {
        const parsed = JSON.parse(multi);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        /* ignore */
      }
    }
    const single = localStorage.getItem("dev_role");
    return single ? [single] : [DEV_DEFAULT_ROLE];
  });
  const [devPermissions, setDevPermissions] = useState<Record<string, string[]>>({});
  const [devRoles, setDevRoles] = useState<{ id: string; name: string }[]>([]);

  const setDevRolesSelection = (ids: string[]) => {
    const next = ids.length > 0 ? ids : [DEV_DEFAULT_ROLE];
    localStorage.setItem("dev_roles", JSON.stringify(next));
    setDevRoleIds(next);
  };

  // Toggle a single role in/out of the dev selection (used by DevRoleSwitcher).
  const toggleDevRole = (role: string) => {
    setDevRolesSelection(
      devRoleIds.includes(role)
        ? devRoleIds.filter((r) => r !== role)
        : [...devRoleIds, role],
    );
  };

  // In DEV_MODE there is no Microsoft sync, so the dev user carries no
  // permissions. Pull the access matrix from the backend so switching the dev
  // role mirrors what that role would actually see in production.
  useEffect(() => {
    if (!DEV_MODE) return;

    let active = true;
    const loadMatrix = (force = false) => {
      loadAccessControl(force)
        .then((data) => {
          if (!active) return;
          setDevPermissions(data.permissions ?? {});
          setDevRoles(data.roles ?? []);
        })
        .catch((err) => {
          console.error("Failed to load access matrix for dev role", err);
        });
    };

    const refresh = () => loadMatrix(true);
    loadMatrix();
    window.addEventListener("lis-access-groups-changed", refresh);
    return () => {
      active = false;
      window.removeEventListener("lis-access-groups-changed", refresh);
    };
  }, []);

  useEffect(() => {
    if (!DEV_MODE) return;
    if (devRoles.length === 0) return; // not loaded yet
    const valid = devRoleIds.filter((id) => devRoles.some((r) => r.id === id));
    if (valid.length === devRoleIds.length) return; // all still valid
    setDevRolesSelection(valid.length > 0 ? valid : [DEV_DEFAULT_ROLE]);
  }, [devRoles, devRoleIds]);

  const devUser: AuthUser | null = DEV_MODE
    ? (() => {
        const selected = devRoleIds
          .map((id) => devRoles.find((r) => r.id === id))
          .filter((r): r is { id: string; name: string } => Boolean(r));
        const roleObjs = selected.length > 0
          ? selected
          : devRoles.filter((r) => r.id === DEV_DEFAULT_ROLE);
        if (roleObjs.length === 0) return null;
        const base = synthesizeDevUser(roleObjs);
        return {
          ...base,
          permissions: unionPermissions(base.roles, devPermissions),
        };
      })()
    : null;

  const user: AuthUser | null = DEV_MODE
    ? devUser
    : productionUser
    ? productionUser
    : account
    ? {
        id: syncedUser?.id,
        email: account.username,
        name: syncedUser?.name ?? account.name ?? account.username,
        photoUrl: profilePhotoUrl,
        role: syncedUser?.role,
        roles: syncedUser?.roles,
        permissions: syncedUser?.permissions,
        department: syncedUser?.department,
        position: syncedUser?.position,
        employeeId: syncedUser?.employeeId,
        status: syncedUser?.status,
      }
    : null;

  useEffect(() => {
    if (!account) {
      setSyncedUser(null);
      return;
    }

    let active = true;
    const claims = account.idTokenClaims as { tid?: string; oid?: string } | undefined;

    // Pull แผนก/ตำแหน่ง from Microsoft Graph so the LIS user record mirrors
    // Azure AD instead of falling back to "Unassigned". Best-effort: if Graph is
    // unavailable the backend keeps whatever it already has.
    const fetchGraphProfile = async (): Promise<{ department?: string; position?: string }> => {
      try {
        const token = await instance.acquireTokenSilent({ account, scopes: ["User.Read"] });
        const res = await fetch(
          "https://graph.microsoft.com/v1.0/me?$select=department,jobTitle",
          { headers: { Authorization: `Bearer ${token.accessToken}` } },
        );
        if (!res.ok) return {};
        const profile = (await res.json()) as { department?: string; jobTitle?: string };
        return {
          department: profile.department?.trim() || undefined,
          position: profile.jobTitle?.trim() || undefined,
        };
      } catch {
        return {};
      }
    };

    (async () => {
      const { department, position } = await fetchGraphProfile();
      try {
        const res = await api.post<{
          id: string;
          email: string;
          name: string;
          roleId: string;
          roleIds?: string[];
          permissions?: string[];
          department: string;
          position: string;
          employeeId: string;
          status: "active" | "inactive";
        }>("/access-control/users/microsoft", {
          email: account.username,
          name: account.name ?? account.username,
          microsoftId: claims?.oid ?? account.localAccountId,
          tenantId: claims?.tid,
          department,
          position,
        });
        if (!active) return;
        setSyncedUser({
          id: res.data.data.id,
          email: res.data.data.email,
          name: res.data.data.name,
          role: res.data.data.roleId,
          roles: res.data.data.roleIds ?? [res.data.data.roleId],
          permissions: res.data.data.permissions ?? [],
          department: res.data.data.department,
          position: res.data.data.position,
          employeeId: res.data.data.employeeId,
          status: res.data.data.status,
        });
      } catch (err) {
        console.error("Failed to sync Microsoft user", err);
      }
    })();

    return () => {
      active = false;
    };
  }, [account, instance]);

  useEffect(() => {
    if (!account) {
      setProfilePhotoUrl(undefined);
      return;
    }

    let alive = true;
    let objectUrl: string | undefined;

    instance
      .acquireTokenSilent({
        account,
        scopes: ["User.Read"],
      })
      .then(async (token) => {
        const res = await fetch("https://graph.microsoft.com/v1.0/me/photo/$value", {
          headers: { Authorization: `Bearer ${token.accessToken}` },
        });
        if (!res.ok) return null;
        return res.blob();
      })
      .then((blob) => {
        if (!alive || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setProfilePhotoUrl(objectUrl);
      })
      .catch(() => {
        if (alive) setProfilePhotoUrl(undefined);
      });

    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [account, instance]);

  const login = async (redirectTo?: string, loginHint?: string) => {
    const target = redirectTo || `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (target && target !== "/login") {
      sessionStorage.setItem("lis_login_redirect", target);
    }
    await instance.loginRedirect({
      ...loginRequest,
      ...(loginHint ? { loginHint } : {}),
      redirectStartPage: window.location.href,
    });
  };

  const loginWithHint = useCallback(
    async (loginHint: string, redirectTo?: string) => {
      if (redirectTo && redirectTo !== "/login") {
        sessionStorage.setItem("lis_login_redirect", redirectTo);
      }
      try {
        // Silent SSO: reuses an existing Microsoft browser session for this
        // tenant so the user lands logged in with no UI. Throws if there's no
        // usable session (e.g. first visit, different account) — then redirect.
        const result = await instance.ssoSilent({ ...loginRequest, loginHint });
        if (result.account) instance.setActiveAccount(result.account);
      } catch {
        await instance.loginRedirect({
          ...loginRequest,
          loginHint,
          redirectStartPage: window.location.href,
        });
      }
    },
    [instance],
  );

  const loginWithProductionToken = useCallback(async (token: string) => {
    const res = await api.post<AuthUser>("/auth/sso", { token });
    const nextUser = res.data.data;
    localStorage.setItem("lis_production_sso_user", JSON.stringify(nextUser));
    setProductionUser(nextUser);
    return nextUser;
  }, []);

  const linkSelfEmployee = useCallback(
    async (employeeId: string) => {
      const id = productionUser?.id ?? syncedUser?.id;
      if (!id) throw new Error("ไม่พบบัญชีผู้ใช้");
      const res = await api.patch<AuthUser>(`/access-control/users/${id}`, { employeeId });
      const updated = res.data.data;
      // HR is the source of truth for ชื่อ/แผนก/ตำแหน่ง once linked — mirror what
      // the backend persisted (it pulls name + dept/position from the employee
      // record), so the display name flips to HR's without a re-login.
      if (productionUser) {
        const next = {
          ...productionUser,
          name: updated.name,
          employeeId: updated.employeeId,
          department: updated.department,
          position: updated.position,
        };
        localStorage.setItem("lis_production_sso_user", JSON.stringify(next));
        setProductionUser(next);
      } else {
        setSyncedUser((prev) =>
          prev
            ? {
                ...prev,
                name: updated.name,
                employeeId: updated.employeeId,
                department: updated.department,
                position: updated.position,
              }
            : prev,
        );
      }
    },
    [productionUser, syncedUser?.id],
  );

  const logout = () => {
    localStorage.removeItem("lis_production_sso_user");
    setProductionUser(null);
    if (!account) {
      window.location.href = window.location.origin + import.meta.env.BASE_URL;
      return;
    }
    instance.logoutRedirect({
      postLogoutRedirectUri: window.location.origin + import.meta.env.BASE_URL,
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        loginWithHint,
        loginWithProductionToken,
        logout,
        linkSelfEmployee,
        devRoleIds: DEV_MODE ? devRoleIds : undefined,
        devRoles: DEV_MODE ? devRoles : undefined,
        toggleDevRole: DEV_MODE ? toggleDevRole : undefined,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
