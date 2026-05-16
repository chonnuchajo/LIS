import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { userCanAccessPath } from "@/lib/accessControl";
import { api } from "@/lib/api";
import { NAV_ITEMS } from "@/lib/navItems";

type AccessGroup = {
  id: string;
  paths?: string[];
};

type AccessControlState = {
  groups: AccessGroup[];
  permissions: Record<string, string[]>;
};

const DEFAULT_DESTINATIONS = [
  "/home",
  "/dashboard/lab",
  "/dashboard/qc",
  "/petitions",
  "/report",
  ...NAV_ITEMS.map((item) => item.path).filter((path) => path !== "/"),
];

export default function DashboardRedirect() {
  const { user } = useAuth();
  const [accessControl, setAccessControl] = useState<AccessControlState | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .get<AccessControlState>("/access-control")
      .then((res) => {
        if (alive) setAccessControl(res.data.data);
      })
      .catch(() => {
        if (alive) setLoadFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!loadFailed && !accessControl) {
    return null;
  }

  if (accessControl && user?.role) {
    const currentUser = {
      ...user,
      permissions: accessControl.permissions[user.role] ?? user.permissions ?? [],
    };
    const preferredDestinations = user.role === "qc"
      ? ["/dashboard/qc", ...DEFAULT_DESTINATIONS]
      : DEFAULT_DESTINATIONS;
    const destination = preferredDestinations.find((path) =>
      userCanAccessPath(currentUser, path, accessControl.groups),
    );

    if (destination) {
      return <Navigate to={destination} replace />;
    }
  }

  return <Navigate to="/dashboard/lab" replace />;
}
