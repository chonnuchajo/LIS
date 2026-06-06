import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "@/lib/msalConfig";
import { api } from "@/lib/api";
import { DEV_MODE, DEV_DEFAULT_ROLE, synthesizeDevUser } from "@/config/dev";

interface AuthUser {
  id?: string;
  email: string;
  name?: string;
  photoUrl?: string;
  role?: string;
  permissions?: string[];
  department?: string;
  position?: string;
  status?: "active" | "inactive";
}

interface AuthContextType {
  user: AuthUser | null;
  login: (redirectTo?: string) => Promise<void>;
  loginWithProductionToken: (token: string) => Promise<AuthUser>;
  logout: () => void;
  devRole?: string;
  devRoles?: { id: string; name: string }[];
  switchDevRole?: (role: string) => void;
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
  const [devRole, setDevRole] = useState<string>(
    () => localStorage.getItem("dev_role") ?? DEV_DEFAULT_ROLE
  );
  const [devPermissions, setDevPermissions] = useState<Record<string, string[]>>({});
  const [devRoles, setDevRoles] = useState<{ id: string; name: string }[]>([]);

  const switchDevRole = (role: string) => {
    localStorage.setItem("dev_role", role);
    setDevRole(role);
  };

  // In DEV_MODE there is no Microsoft sync, so the dev user carries no
  // permissions. Pull the access matrix from the backend so switching the dev
  // role mirrors what that role would actually see in production.
  useEffect(() => {
    if (!DEV_MODE) return;

    let active = true;
    const loadMatrix = () => {
      api
        .get<{
          permissions?: Record<string, string[]>;
          roles?: { id: string; name: string }[];
        }>("/access-control")
        .then((res) => {
          if (!active) return;
          setDevPermissions(res.data.data.permissions ?? {});
          setDevRoles(res.data.data.roles ?? []);
        })
        .catch((err) => {
          console.error("Failed to load access matrix for dev role", err);
        });
    };

    loadMatrix();
    window.addEventListener("lis-access-groups-changed", loadMatrix);
    return () => {
      active = false;
      window.removeEventListener("lis-access-groups-changed", loadMatrix);
    };
  }, []);

  useEffect(() => {
    if (!DEV_MODE) return;
    if (devRoles.length === 0) return; // not loaded yet — don't kick
    if (devRoles.some((r) => r.id === devRole)) return; // current role still valid
    switchDevRole(DEV_DEFAULT_ROLE);
  }, [devRoles, devRole]);

  const devUser: AuthUser | null = DEV_MODE
    ? (() => {
        const role =
          devRoles.find((r) => r.id === devRole) ??
          devRoles.find((r) => r.id === DEV_DEFAULT_ROLE);
        if (!role) return null;
        const base = synthesizeDevUser(role);
        return {
          ...base,
          permissions: devPermissions[role.id] ?? [],
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
        permissions: syncedUser?.permissions,
        department: syncedUser?.department,
        position: syncedUser?.position,
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
          permissions?: string[];
          department: string;
          position: string;
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
          permissions: res.data.data.permissions ?? [],
          department: res.data.data.department,
          position: res.data.data.position,
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

  const login = async (redirectTo?: string) => {
    const target = redirectTo || `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (target && target !== "/login") {
      sessionStorage.setItem("lis_login_redirect", target);
    }
    await instance.loginRedirect({
      ...loginRequest,
      redirectStartPage: window.location.href,
    });
  };

  const loginWithProductionToken = useCallback(async (token: string) => {
    const res = await api.post<AuthUser>("/auth/sso", { token });
    const nextUser = res.data.data;
    localStorage.setItem("lis_production_sso_user", JSON.stringify(nextUser));
    setProductionUser(nextUser);
    return nextUser;
  }, []);

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
        loginWithProductionToken,
        logout,
        devRole: DEV_MODE ? devRole : undefined,
        devRoles: DEV_MODE ? devRoles : undefined,
        switchDevRole: DEV_MODE ? switchDevRole : undefined,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
