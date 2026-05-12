import { DEV_MODE, DEV_USERS } from "@/config/dev";
import { useAuth } from "@/context/AuthContext";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  lab: "Lab",
  qc: "QC",
  viewer: "Viewer",
};

export const DevRoleSwitcher = () => {
  const { devRole, switchDevRole } = useAuth();

  if (!DEV_MODE || !switchDevRole || !devRole) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end gap-1">
      <div className="rounded-md border border-orange-400 bg-orange-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-orange-600 shadow">
        DEV MODE
      </div>
      <div className="flex gap-1 rounded-md border border-orange-300 bg-white p-1 shadow-md">
        {Object.keys(DEV_USERS).map((role) => (
          <button
            key={role}
            onClick={() => switchDevRole(role)}
            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
              devRole === role
                ? "bg-orange-500 text-white"
                : "text-gray-600 hover:bg-orange-100"
            }`}
          >
            {ROLE_LABELS[role] ?? role}
          </button>
        ))}
      </div>
    </div>
  );
};
