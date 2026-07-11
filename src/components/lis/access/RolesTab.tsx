import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { countUsersInRole, rolePermissionCount, accessibleModules } from "@/lib/accessDerive";
import type { Role, AppUser, AccessGroup, RoleFamily } from "./types";
import RoleCard from "./RoleCard";
import RoleEditDialog from "./RoleEditDialog";

interface Props {
  roles: Role[];
  users: AppUser[];
  permissions: Record<string, string[]>;
  groups: AccessGroup[];
  onCreate: (v: { name: string; description: string; family: RoleFamily }) => void;
  onUpdate: (id: string, v: { name: string; description: string; family: RoleFamily }) => void;
  onDelete: (id: string) => void;
}

export default function RolesTab({ roles, users, permissions, groups, onCreate, onUpdate, onDelete }: Props) {
  const [dialog, setDialog] = useState<{ open: boolean; mode: "create" | "edit"; role: Role | null }>(
    { open: false, mode: "create", role: null });

  const cards = useMemo(() => roles.map((role) => ({
    role,
    userCount: countUsersInRole(users, role.id),
    permCount: rolePermissionCount(permissions, role.id),
    modules: accessibleModules(permissions, role.id, groups),
  })), [roles, users, permissions, groups]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5" onClick={() => setDialog({ open: true, mode: "create", role: null })}>
          <Plus className="h-4 w-4" /> สร้าง Role
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ role, userCount, permCount, modules }) => (
          <RoleCard
            key={role.id}
            role={role}
            userCount={userCount}
            permCount={permCount}
            modules={modules}
            onEdit={() => setDialog({ open: true, mode: "edit", role })}
            onDelete={() => onDelete(role.id)}
          />
        ))}
      </div>
      <RoleEditDialog
        open={dialog.open}
        mode={dialog.mode}
        role={dialog.role}
        onClose={() => setDialog((d) => ({ ...d, open: false }))}
        onSubmit={(v) => { if (dialog.mode === "create") onCreate(v); else if (dialog.role) onUpdate(dialog.role.id, v); }}
      />
    </div>
  );
}
