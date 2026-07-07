import { useEffect, useMemo, useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { UserCircle, Link2 } from "lucide-react";
import type { AppUser, Role, EmployeeDirectoryEntry, UserStatus } from "./types";

interface UserRoleDrawerProps {
  open: boolean;
  mode: "create" | "edit";
  user: AppUser | null;
  roles: Role[];
  directory: EmployeeDirectoryEntry[];
  onClose: () => void;
  onCreate: (payload: { name: string; email: string; roleIds: string[] }) => void;
  onUpdate: (id: string, patch: { roleIds?: string[]; status?: UserStatus }) => void;
  onLinkEmployee: (userId: string, employeeId: string) => void;
}

export default function UserRoleDrawer({
  open, mode, user, roles, directory, onClose, onCreate, onUpdate, onLinkEmployee,
}: UserRoleDrawerProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleIds, setRoleIds] = useState<string[]>(["viewer"]);
  const [status, setStatus] = useState<UserStatus>("active");
  const [empSearch, setEmpSearch] = useState("");
  const [picking, setPicking] = useState(false);

  // Sync local state whenever the drawer opens for a (different) user.
  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && user) {
      setRoleIds(user.roleIds.length ? user.roleIds : [user.roleId]);
      setStatus(user.status);
    } else {
      setName(""); setEmail(""); setRoleIds(["viewer"]); setStatus("active");
    }
    setEmpSearch(""); setPicking(false);
  }, [open, mode, user]);

  const toggleRole = (id: string) => {
    setRoleIds((cur) => {
      const next = cur.includes(id) ? cur.filter((r) => r !== id) : [...cur, id];
      return next.length === 0 ? cur : next; // keep at least one
    });
  };

  const filtered = useMemo(() => {
    const q = empSearch.toLowerCase();
    const matched = q
      ? directory.filter((e) =>
          e.name.toLowerCase().includes(q) ||
          e.employeeId.toLowerCase().includes(q) ||
          e.department.toLowerCase().includes(q))
      : directory;
    return matched.slice(0, 50);
  }, [directory, empSearch]);

  const save = () => {
    if (mode === "create") {
      if (!name.trim() || !email.trim()) return;
      onCreate({ name: name.trim(), email: email.trim(), roleIds });
    } else if (user) {
      onUpdate(user.id, { roleIds, status });
    }
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <UserCircle className="h-5 w-5 text-primary" />
            {mode === "create" ? "เพิ่มผู้ใช้" : user?.name}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-5 py-4">
          {mode === "create" ? (
            <div className="space-y-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อ-นามสกุล" />
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@icpladda.com" />
            </div>
          ) : (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <p className="font-medium">{user?.email}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {user?.department || "—"} · {user?.position || "—"}
              </p>
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-medium">บทบาท (Role)</p>
            <div className="space-y-1.5">
              {roles.map((role) => (
                <label key={role.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 cursor-pointer">
                  <Checkbox checked={roleIds.includes(role.id)} onCheckedChange={() => toggleRole(role.id)} />
                  <span className="text-sm">{role.name}</span>
                  {role.locked ? <Badge variant="gray-soft" className="text-[10px]">locked</Badge> : null}
                </label>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">ต้องมีอย่างน้อย 1 บทบาท</p>
          </div>

          {mode === "edit" && (
            <div>
              <p className="mb-2 text-sm font-medium">สถานะ</p>
              <div className="flex gap-2">
                {(["active", "inactive"] as UserStatus[]).map((s) => (
                  <Button key={s} type="button" size="sm"
                    variant={status === s ? "default" : "outline"}
                    onClick={() => setStatus(s)}>
                    {s === "active" ? "ใช้งาน" : "ปิดใช้งาน"}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {mode === "edit" && user && (
            <div>
              <p className="mb-2 text-sm font-medium flex items-center gap-1.5">
                <Link2 className="h-4 w-4 text-muted-foreground" /> ผูกพนักงาน
              </p>
              {!picking ? (
                <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                  <span className={user.employeeId ? "" : "text-muted-foreground"}>
                    {user.employeeId ? `รหัส ${user.employeeId}` : "ยังไม่ได้ผูก"}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setPicking(true)}>
                    {user.employeeId ? "เปลี่ยน" : "ผูก"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input value={empSearch} autoFocus onChange={(e) => setEmpSearch(e.target.value)}
                    placeholder="ค้นหาชื่อ / รหัส / แผนก..." />
                  <div className="max-h-56 overflow-y-auto space-y-1 rounded-md border p-1">
                    {filtered.length === 0 ? (
                      <p className="py-4 text-center text-sm text-muted-foreground">ไม่พบพนักงาน</p>
                    ) : filtered.map((e) => (
                      <button key={e.employeeId} type="button"
                        onClick={() => { onLinkEmployee(user.id, e.employeeId); setPicking(false); }}
                        className="w-full rounded px-3 py-2 text-left text-sm hover:bg-accent transition-colors">
                        <span className="font-medium">{e.name}</span>
                        <span className="text-muted-foreground"> ({e.employeeId}) · {e.department}</span>
                      </button>
                    ))}
                  </div>
                  {user.employeeId && (
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                      onClick={() => { onLinkEmployee(user.id, ""); setPicking(false); }}>
                      ยกเลิกการผูก
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <SheetFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={save} disabled={mode === "create" && (!name.trim() || !email.trim())}>บันทึก</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
