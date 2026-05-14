import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "@/lib/msalConfig";
import { api } from "@/lib/api";
import { DEV_MODE, DEV_USERS, DEV_DEFAULT_ROLE } from "@/config/dev";

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
  login: () => Promise<void>;
  logout: () => void;
  devRole?: string;
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
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | undefined>();
  const [devRole, setDevRole] = useState<string>(
    () => localStorage.getItem("dev_role") ?? DEV_DEFAULT_ROLE
  );
  const [devPermissions, setDevPermissions] = useState<Record<string, string[]>>({});

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
        .get<{ permissions?: Record<string, string[]> }>("/access-control")
        .then((res) => {
          if (active) setDevPermissions(res.data.data.permissions ?? {});
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

  const devUser: AuthUser | null = DEV_MODE
    ? (() => {
        const base = DEV_USERS[devRole] ?? DEV_USERS[DEV_DEFAULT_ROLE];
        return {
          ...base,
          permissions: devPermissions[base.role ?? devRole] ?? base.permissions ?? [],
        };
      })()
    : null;

  const user: AuthUser | null = DEV_MODE
    ? devUser
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

    api
      .post<{
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
      })
      .then((res) => {
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
      })
      .catch((err) => {
        console.error("Failed to sync Microsoft user", err);
      });

    return () => {
      active = false;
    };
  }, [account]);

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

  const login = async () => {
    await instance.loginRedirect({
      ...loginRequest,
      redirectStartPage: window.location.origin + import.meta.env.BASE_URL,
    });
  };

  const logout = () => {
    instance.logoutRedirect({
      postLogoutRedirectUri: window.location.origin + import.meta.env.BASE_URL,
    });
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, devRole: DEV_MODE ? devRole : undefined, switchDevRole: DEV_MODE ? switchDevRole : undefined }}>
      {children}
    </AuthContext.Provider>
  );
};
