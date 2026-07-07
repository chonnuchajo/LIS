import { useMemo, useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Plus, MoreVertical, Trash2 } from "lucide-react";
import { filterUsers, paginate, distinctDepartments } from "@/lib/accessDerive";
import type { AppUser, Role, EmployeeDirectoryEntry, UserStatus } from "./types";
import UserRoleDrawer from "./UserRoleDrawer";

const ALL = "__all__";
const PAGE_SIZES = [25, 50, 100];

interface UsersTabProps {
  users: AppUser[];
  roles: Role[];
  directory: EmployeeDirectoryEntry[];
  syncing: boolean;
  onCreate: (payload: { name: string; email: string; roleIds: string[] }) => void;
  onUpdate: (id: string, patch: { roleIds?: string[]; status?: UserStatus }) => void;
  onDelete: (id: string) => void;
  onLinkEmployee: (userId: string, employeeId: string) => void;
  onSync: () => void;
}

export default function UsersTab({
  users, roles, directory, syncing, onCreate, onUpdate, onDelete, onLinkEmployee, onSync,
}: UsersTabProps) {
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState(ALL);
  const [role, setRole] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [drawer, setDrawer] = useState<{ open: boolean; mode: "create" | "edit"; user: AppUser | null }>(
    { open: false, mode: "create", user: null });

  const roleName = useMemo(() => Object.fromEntries(roles.map((r) => [r.id, r.name])), [roles]);
  const departments = useMemo(() => distinctDepartments(users), [users]);

  const filtered = useMemo(() => filterUsers(users, {
    search,
    dept: dept === ALL ? undefined : dept,
    role: role === ALL ? undefined : role,
    status: status === ALL ? undefined : status,
  }), [users, search, dept, role, status]);

  const resetPage = () => setPage(1);
  const { items, total, pageCount } = paginate(filtered, page, pageSize);

  const openEdit = (u: AppUser) => setDrawer({ open: true, mode: "edit", user: u });
  const openCreate = () => setDrawer({ open: true, mode: "create", user: null });

  return (
    <Card>
      <CardHeader className="gap-3 pb-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className="text-base">จัดการผู้ใช้</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onSync} disabled={syncing}>
              {syncing ? "กำลัง Sync..." : "Sync พนักงาน"}
            </Button>
            <Button size="sm" className="gap-1.5" onClick={openCreate}>
              <Plus className="h-4 w-4" /> เพิ่มผู้ใช้
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); resetPage(); }}
              placeholder="ค้นหา ชื่อ/อีเมล/รหัสพนักงาน" className="pl-9" />
          </div>
          <FilterSelect value={dept} onChange={(v) => { setDept(v); resetPage(); }} allLabel="ทุกแผนก"
            options={departments.map((d) => ({ value: d, label: d }))} width="w-40" />
          <FilterSelect value={role} onChange={(v) => { setRole(v); resetPage(); }} allLabel="ทุกบทบาท"
            options={roles.map((r) => ({ value: r.id, label: r.name }))} width="w-40" />
          <FilterSelect value={status} onChange={(v) => { setStatus(v); resetPage(); }} allLabel="ทุกสถานะ"
            options={[{ value: "active", label: "ใช้งาน" }, { value: "inactive", label: "ปิดใช้งาน" }]} width="w-36" />
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ผู้ใช้</TableHead>
                <TableHead className="hidden md:table-cell">แผนก · ตำแหน่ง</TableHead>
                <TableHead>บทบาท</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead className="hidden lg:table-cell">ล่าสุด</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">ไม่พบผู้ใช้</TableCell></TableRow>
              ) : items.map((u) => (
                <TableRow key={u.id} className="cursor-pointer" onClick={() => openEdit(u)}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8"><AvatarFallback>{u.name.slice(0, 1)}</AvatarFallback></Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{u.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{u.department || "—"} · {u.position || "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {u.roleIds.length ? u.roleIds.map((rid) => (
                        <Badge key={rid} variant="secondary" className="text-[11px]">{roleName[rid] ?? rid}</Badge>
                      )) : <span className="text-xs text-muted-foreground">—</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.status === "active" ? "green-soft" : "gray-soft"}>
                      {u.status === "active" ? "ใช้งาน" : "ปิดใช้งาน"}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{u.lastActive || "—"}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="เมนู"><MoreVertical className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(u)}>แก้ไข</DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          disabled={u.roleId === "admin"}
                          onClick={() => onDelete(u.id)}>
                          <Trash2 className="mr-2 h-4 w-4" /> ลบผู้ใช้
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-2 border-t px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="text-muted-foreground">ทั้งหมด {total} คน</span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹</Button>
              <span className="tabular-nums">{Math.min(page, pageCount)} / {pageCount}</span>
              <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>›</Button>
            </div>
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); resetPage(); }}>
              <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((s) => <SelectItem key={s} value={String(s)}>ต่อหน้า {s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>

      <UserRoleDrawer
        open={drawer.open}
        mode={drawer.mode}
        user={drawer.user}
        roles={roles}
        directory={directory}
        onClose={() => setDrawer((d) => ({ ...d, open: false }))}
        onCreate={onCreate}
        onUpdate={onUpdate}
        onLinkEmployee={onLinkEmployee}
      />
    </Card>
  );
}

function FilterSelect({ value, onChange, allLabel, options, width }: {
  value: string; onChange: (v: string) => void; allLabel: string;
  options: { value: string; label: string }[]; width: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`h-9 ${width}`}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
