import { useEffect, useState } from "react";
import AppLayout from "@/components/lis/AppLayout";
import HomeAdmin from "@/components/home/HomeAdmin";
import HomeLab from "@/components/home/HomeLab";
import HomeQC from "@/components/home/HomeQC";
import HomeViewer from "@/components/home/HomeViewer";
import HomeGeneric from "@/components/home/HomeGeneric";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { normalizeRoles, primaryRole, unionPermissions } from "@/lib/roles";

type HomeKind = "admin" | "qc" | "lab" | "viewer" | "generic";

type AccessGroup = { id: string; paths?: string[] };
type AccessControlState = { groups: AccessGroup[]; permissions: Record<string, string[]> };

// QC-related signals: anything that means "this user does QC work"
// (mirrors the 'qc' group in server/seed-access-control.js)
const QC_PATHS = new Set([
  "/qc-approval",
  "/qc-testing",
  "/physical-inspection",
  "/dashboard/qc",
]);
// Lab-related signals (mirrors the 'lab' group in seed-access-control.js)
const LAB_PATHS = new Set([
  "/lab-testing",
  "/record-results",
  "/daily-check",
  "/stock-deduction",
  "/petitions/assign",
  "/dashboard/lab",
]);

const groupIncludesPath = (groups: AccessGroup[], groupId: string, paths: Set<string>) => {
  const g = groups.find((x) => x.id === groupId);
  if (!g) return false;
  return (g.paths ?? []).some((p) => paths.has(p));
};

function resolveHomeKind(
  role: string | undefined,
  permissions: string[] | undefined,
  groups: AccessGroup[],
): HomeKind {
  if (!role) return "generic";
  // The "admin" role.id is locked by the backend and bypasses access checks.
  if (role === "admin") return "admin";

  const perms = permissions ?? [];
  if (perms.length === 0) return "generic";

  const hasAccessAdmin =
    perms.includes("access") || perms.some((p) => p === "/access-control");

  const hasQC = perms.some((p) => {
    if (p.startsWith("/")) return QC_PATHS.has(p);
    return groupIncludesPath(groups, p, QC_PATHS);
  });
  const hasLab = perms.some((p) => {
    if (p.startsWith("/")) return LAB_PATHS.has(p);
    return groupIncludesPath(groups, p, LAB_PATHS);
  });

  if (hasAccessAdmin) return "admin";
  if (hasQC && hasLab) return "admin";
  if (hasQC) return "qc";
  if (hasLab) return "lab";
  return "viewer";
}

const Home = () => {
  const { user } = useAuth();
  const [groups, setGroups] = useState<AccessGroup[]>([]);
  const [permOverride, setPermOverride] = useState<string[] | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .get<AccessControlState>("/access-control")
      .then((res) => {
        if (!alive) return;
        const data = res.data.data;
        setGroups(data.groups ?? []);
        const roles = normalizeRoles(user);
        if (roles.length > 0 && data.permissions) {
          setPermOverride(unionPermissions(roles, data.permissions));
        }
      })
      .finally(() => {
        if (alive) setResolved(true);
      });
    return () => {
      alive = false;
    };
  }, [user]);

  if (!resolved) {
    return <AppLayout><div className="py-10 text-center text-sm text-muted-foreground">กำลังโหลด...</div></AppLayout>;
  }

  const perms = permOverride ?? user?.permissions ?? [];
  const kind = resolveHomeKind(primaryRole(normalizeRoles(user)), perms, groups);

  let content: JSX.Element;
  switch (kind) {
    case "admin":  content = <HomeAdmin />;  break;
    case "lab":    content = <HomeLab />;    break;
    case "qc":     content = <HomeQC />;     break;
    case "viewer": content = <HomeViewer />; break;
    default:       content = <HomeGeneric />;
  }

  return <AppLayout>{content}</AppLayout>;
};

export default Home;
