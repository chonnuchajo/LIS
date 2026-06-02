import { Fragment, useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/lis/AppLayout";
import PageHeader from "@/components/lis/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { NAV_ITEMS, PAGE_ITEMS, type NavItem } from "@/lib/navItems";
import {
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  FolderTree,
  GripVertical,
  KeyRound,
  LockKeyhole,
  Minus,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";

type UserStatus = "active" | "inactive";

type AppUser = {
  id: string;
  name: string;
  email: string;
  roleId: string;
  department: string;
  position: string;
  status: UserStatus;
  lastActive: string;
};

type Role = {
  id: string;
  name: string;
  description: string;
  locked?: boolean;
};

type AccessGroup = {
  id: string;
  name: string;
  description: string;
  paths: string[];
  locked?: boolean;
  sortOrder?: number;
};

const defaultRoles: Role[] = [
  { id: "admin", name: "Administrator", description: "Full system access", locked: true },
  { id: "lab", name: "Lab Analyst", description: "Sample handling and result entry" },
  { id: "qc", name: "QC Reviewer", description: "Review and approve results" },
  { id: "viewer", name: "Viewer", description: "Read-only access to dashboards and reports" },
];

const defaultUsers: AppUser[] = [];

const defaultPermissions: Record<string, string[]> = {};

type AccessControlState = {
  users: AppUser[];
  roles: Role[];
  groups: AccessGroup[];
  permissions: Record<string, string[]>;
};

type PathPickerProps = {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  /** path -> the group that already owns it (so it renders as a "move here" row). */
  ownedBy?: Map<string, { id: string; name: string }>;
  /** Move a page owned by another group into this one. */
  onMovePath?: (path: string) => void;
  emptyMessage?: string;
};

const PathPicker = ({
  value,
  onChange,
  disabled,
  placeholder,
  ownedBy,
  onMovePath,
  emptyMessage = "No available pages",
}: PathPickerProps) => {
  // Only sidebar nav pages are selectable. Non-nav paths (detail/edit/scanner/
  // queue) stay stored in the group but are hidden from this editor — they keep
  // their access without being manageable here. A page belongs to exactly one
  // group: pages owned by ANOTHER group stay visible but render with their owner
  // and a "−" button that moves the page out of that group and into this one.
  const selectedNavItems = NAV_ITEMS.filter((item) => value.includes(item.path));

  const toggle = (item: NavItem, checked: boolean) => {
    if (checked) {
      if (!value.includes(item.path)) onChange([...value, item.path]);
    } else {
      onChange(value.filter((p) => p !== item.path));
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className="truncate text-left">
            {selectedNavItems.length === 0
              ? (placeholder ?? "เลือกหน้า")
              : `${selectedNavItems.length} หน้า`}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="start">
        <div className="max-h-72 space-y-0.5 overflow-auto">
          {NAV_ITEMS.length === 0 ? (
            <div className="rounded border border-dashed px-3 py-2 text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          ) : NAV_ITEMS.map((item) => {
            const checked = value.includes(item.path);
            const owner = checked ? undefined : ownedBy?.get(item.path);
            if (owner) {
              return (
                <div
                  key={item.path}
                  className="flex items-center gap-2 rounded px-2 py-1.5"
                >
                  <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm text-muted-foreground">{item.label}</span>
                  <Badge
                    variant="outline"
                    className="ml-auto shrink-0 text-[10px] font-normal"
                  >
                    {owner.name}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    disabled={disabled || !onMovePath}
                    onClick={() => onMovePath?.(item.path)}
                    title={`ย้าย "${item.label}" จากกลุ่ม ${owner.name} มากลุ่มนี้`}
                    aria-label={`ย้าย ${item.label} จากกลุ่ม ${owner.name} มากลุ่มนี้`}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            }
            return (
              <label
                key={item.path}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-accent"
              >
                <Checkbox
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={(c) => toggle(item, c === true)}
                />
                <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm">{item.label}</span>
                <span className="ml-auto truncate font-mono text-[10px] text-muted-foreground">
                  {item.path}
                </span>
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};

const AccessControl = () => {
  const [users, setUsers] = useState<AppUser[]>(defaultUsers);
  const [roles, setRoles] = useState<Role[]>(defaultRoles);
  const [groups, setGroups] = useState<AccessGroup[]>([]);
  const [permissions, setPermissions] = useState<Record<string, string[]>>(defaultPermissions);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    department: "",
    position: "",
    roleId: "viewer",
  });
  const [newRole, setNewRole] = useState({ name: "", description: "" });
  const [newGroup, setNewGroup] = useState<{
    id: string;
    name: string;
    paths: string[];
    description: string;
  }>({
    id: "",
    name: "",
    paths: [],
    description: "",
  });
  const [dragGroupId, setDragGroupId] = useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [navDrag, setNavDrag] = useState<{ groupId: string; path: string } | null>(null);
  const [navDragOverPath, setNavDragOverPath] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const loadAccessControl = async () => {
    setLoading(true);
    try {
      const res = await api.get<AccessControlState>("/access-control");
      setUsers(res.data.data.users);
      setRoles(res.data.data.roles);
      setGroups(res.data.data.groups);
      // Default-expand every group so the matrix shows nested pages up front,
      // matching Group Control (users can still collapse individual groups).
      setExpandedGroups(new Set(res.data.data.groups.map((group) => group.id)));
      setPermissions(res.data.data.permissions);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load access control");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccessControl();
  }, []);

  const roleById = useMemo(
    () => Object.fromEntries(roles.map((role) => [role.id, role])),
    [roles],
  );

  const navItemByPath = useMemo(
    () => new Map(PAGE_ITEMS.map((item) => [item.path, item])),
    [],
  );

  const filteredUsers = users.filter((user) => {
    const query = search.toLowerCase();
    return (
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      user.department.toLowerCase().includes(query) ||
      user.position.toLowerCase().includes(query) ||
      roleById[user.roleId]?.name.toLowerCase().includes(query)
    );
  });

  const sortedGroups = useMemo(
    () =>
      [...groups].sort((a, b) => {
        // 'others' is the locked catch-all — always pinned last, regardless of sortOrder.
        if (a.id === "others") return 1;
        if (b.id === "others") return -1;
        return (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
      }),
    [groups],
  );

  const reorderableGroups = useMemo(
    () => sortedGroups.filter((group) => group.id !== "others"),
    [sortedGroups],
  );

  const notifyGroupMappingChanged = () => {
    window.dispatchEvent(new Event("lis-access-groups-changed"));
  };

  const uniquePaths = (paths: string[]) => Array.from(new Set(paths));

  const updateUser = async (id: string, patch: Partial<AppUser>) => {
    const previous = users;
    setUsers((current) => current.map((user) => (user.id === id ? { ...user, ...patch } : user)));
    try {
      const res = await api.patch<AppUser>(`/access-control/users/${id}`, patch);
      setUsers((current) => current.map((user) => (user.id === id ? res.data.data : user)));
    } catch (err) {
      setUsers(previous);
      toast.error(err instanceof Error ? err.message : "Failed to update user");
    }
  };

  const deleteUser = async (id: string) => {
    try {
      await api.delete(`/access-control/users/${id}`);
      setUsers((current) => current.filter((user) => user.id !== id));
      toast.success("User removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove user");
    }
  };

  const addUser = async () => {
    if (!newUser.name.trim() || !newUser.email.trim()) {
      toast.error("Name and email are required");
      return;
    }

    try {
      const res = await api.post<AppUser>("/access-control/users", {
        ...newUser,
        department: newUser.department.trim() || "Unassigned",
        position: newUser.position.trim() || "Unassigned",
      });
      setUsers((current) => [...current, res.data.data]);
      setNewUser({ name: "", email: "", department: "", position: "", roleId: "viewer" });
      toast.success("User added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add user");
    }
  };

  const addRole = async () => {
    const name = newRole.name.trim();
    if (!name) {
      toast.error("Role name is required");
      return;
    }
    try {
      const res = await api.post<Role>("/access-control/roles", {
        name,
        description: newRole.description.trim(),
      });
      setRoles((current) => [...current, res.data.data]);
      setPermissions((current) => ({ ...current, [res.data.data.id]: [] }));
      setNewRole({ name: "", description: "" });
      notifyGroupMappingChanged();
      toast.success("Role added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add role");
    }
  };

  const deleteRole = async (id: string) => {
    const role = roleById[id];
    if (role?.locked) return;
    try {
      await api.delete(`/access-control/roles/${id}`);
      setRoles((current) => current.filter((r) => r.id !== id));
      setPermissions((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      notifyGroupMappingChanged();
      toast.success("Role removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove role");
    }
  };

  const addGroup = async () => {
    if (!newGroup.name.trim()) {
      toast.error("Group name is required");
      return;
    }
    const groupId = newGroup.id.trim();
    if (groups.some((group) => group.id === groupId)) {
      toast.error("Group ID already exists");
      return;
    }
    const paths = uniquePaths(newGroup.paths);
    try {
      const res = await api.post<AccessGroup>("/access-control/groups", {
        id: groupId,
        name: newGroup.name.trim(),
        paths,
        description: newGroup.description.trim(),
      });
      setGroups((current) => [...current, res.data.data]);
      setPermissions((current) => ({
        ...current,
        admin: Array.from(new Set([...(current.admin ?? []), res.data.data.id])),
      }));
      setNewGroup({ id: "", name: "", paths: [], description: "" });
      notifyGroupMappingChanged();
      toast.success("Group added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add group");
    }
  };

  // A page belongs to exactly one group. Moving a page across groups is handled
  // by movePathToGroup/movePathToNewGroup (remove from owner, add to target);
  // this just persists the path list for a single group.
  const updateGroupPaths = async (id: string, paths: string[]) => {
    updateGroup(id, { paths: uniquePaths(paths) });
  };

  const updateGroup = async (id: string, patch: Partial<AccessGroup>) => {
    const previous = groups;
    setGroups((current) => current.map((group) => (group.id === id ? { ...group, ...patch } : group)));
    try {
      const res = await api.patch<AccessGroup>(`/access-control/groups/${id}`, patch);
      setGroups((current) => current.map((group) => (group.id === id ? res.data.data : group)));
      notifyGroupMappingChanged();
    } catch (err) {
      setGroups((current) =>
        current.some((group) => group.id === id) ? previous : current,
      );
      toast.error(err instanceof Error ? err.message : "Failed to update group");
    }
  };

  const deleteGroup = async (id: string) => {
    const group = groups.find((item) => item.id === id);
    if (group?.locked) return;
    try {
      await api.delete(`/access-control/groups/${id}`);
      setGroups((current) => current.filter((item) => item.id !== id));
      setPermissions((current) =>
        Object.fromEntries(
          Object.entries(current).map(([roleId, groupIds]) => [
            roleId,
            groupIds.filter((groupId) => groupId !== id),
          ]),
        ),
      );
      notifyGroupMappingChanged();
      toast.success("Group removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove group");
    }
  };

  const reorderGroups = async (sourceId: string, targetId: string) => {
    if (sourceId === targetId || sourceId === "others" || targetId === "others") return;

    const ordered = [...reorderableGroups];
    const from = ordered.findIndex((group) => group.id === sourceId);
    const to = ordered.findIndex((group) => group.id === targetId);
    if (from < 0 || to < 0) return;

    const [moved] = ordered.splice(from, 1);
    ordered.splice(to, 0, moved);

    const updates = ordered
      .map((group, index) => ({ id: group.id, sortOrder: (index + 1) * 10 }))
      .filter(({ id, sortOrder }) => {
        const previousOrder = reorderableGroups.find((group) => group.id === id)?.sortOrder ?? 0;
        return previousOrder !== sortOrder;
      });
    if (updates.length === 0) return;

    const previous = groups;
    setGroups((list) =>
      list.map((group) => {
        const update = updates.find((u) => u.id === group.id);
        return update ? { ...group, sortOrder: update.sortOrder } : group;
      }),
    );
    try {
      await Promise.all(
        updates.map((update) =>
          api.patch(`/access-control/groups/${update.id}`, { sortOrder: update.sortOrder }),
        ),
      );
      notifyGroupMappingChanged();
    } catch (err) {
      setGroups(previous);
      toast.error(err instanceof Error ? err.message : "Failed to reorder group");
    }
  };

  const reorderNavPaths = (groupId: string, sourcePath: string, targetPath: string) => {
    if (sourcePath === targetPath) return;
    const group = groups.find((item) => item.id === groupId);
    if (!group) return;

    if (group.id === "others") {
      // 'others' membership is computed — derive the order from what's currently
      // displayed, then persist it to paths as an ordering hint.
      const displayed = renderNavItemsForGroup(group).map((item) => item.path);
      const from = displayed.indexOf(sourcePath);
      const to = displayed.indexOf(targetPath);
      if (from < 0 || to < 0) return;
      const [moved] = displayed.splice(from, 1);
      displayed.splice(to, 0, moved);
      updateGroup(groupId, { paths: displayed });
      return;
    }

    const paths = [...(group.paths ?? [])];
    const from = paths.indexOf(sourcePath);
    const to = paths.indexOf(targetPath);
    if (from < 0 || to < 0) return;
    const [moved] = paths.splice(from, 1);
    paths.splice(to, 0, moved);
    updateGroup(groupId, { paths });
  };

  const coveredNavPaths = useMemo(() => {
    const set = new Set<string>();
    groups
      .filter((g) => g.id !== "others")
      .forEach((g) => (g.paths ?? []).forEach((p) => set.add(p)));
    return set;
  }, [groups]);

  const renderNavItemsForGroup = (group: AccessGroup): NavItem[] => {
    if (group.id === "others") {
      // Membership is computed (everything not covered by another group), but
      // group.paths is used purely as an ordering hint so it can be reordered.
      const uncovered = NAV_ITEMS.filter((item) => !coveredNavPaths.has(item.path));
      const order = group.paths ?? [];
      const ordered = order
        .map((path) => uncovered.find((item) => item.path === path))
        .filter((item): item is NavItem => Boolean(item));
      const rest = uncovered.filter((item) => !order.includes(item.path));
      return [...ordered, ...rest];
    }
    // Preserve the order stored in group.paths — that order drives the sidebar.
    // Only nav pages render; non-nav paths stay stored but hidden from the editor.
    return (group.paths ?? [])
      .map((path) => NAV_ITEMS.find((item) => item.path === path))
      .filter((item): item is NavItem => Boolean(item));
  };

  const getGroupPagePaths = (group: AccessGroup): string[] => {
    if (group.id === "others") {
      return renderNavItemsForGroup(group).map((item) => item.path);
    }
    return group.paths ?? [];
  };

  // path -> the group that currently owns it (excluding `exceptGroupId` and the
  // computed "others" bucket). The picker uses this to show pages owned by other
  // groups as "move here" rows instead of hiding them.
  const pathOwnerMap = (exceptGroupId: string | null) => {
    const map = new Map<string, { id: string; name: string }>();
    groups.forEach((group) => {
      if (group.id === "others" || group.id === exceptGroupId) return;
      (group.paths ?? []).forEach((path) => {
        if (!map.has(path)) map.set(path, { id: group.id, name: group.name });
      });
    });
    return map;
  };

  // Move a nav page out of whatever group owns it and into `targetGroupId`,
  // preserving one-group-per-page.
  const movePathToGroup = (path: string, targetGroupId: string) => {
    const owner = groups.find(
      (group) =>
        group.id !== "others" &&
        group.id !== targetGroupId &&
        (group.paths ?? []).includes(path),
    );
    if (owner) {
      updateGroupPaths(owner.id, (owner.paths ?? []).filter((p) => p !== path));
    }
    const target = groups.find((group) => group.id === targetGroupId);
    if (target) {
      updateGroupPaths(targetGroupId, [...(target.paths ?? []), path]);
    }
  };

  // Same move, but the destination is the in-progress "new group" form (not yet
  // saved), so the page is only added to local form state.
  const movePathToNewGroup = (path: string) => {
    const owner = groups.find(
      (group) => group.id !== "others" && (group.paths ?? []).includes(path),
    );
    if (owner) {
      updateGroupPaths(owner.id, (owner.paths ?? []).filter((p) => p !== path));
    }
    setNewGroup((current) => ({
      ...current,
      paths: uniquePaths([...current.paths, path]),
    }));
  };

  const toggleExpandedGroup = (groupId: string) => {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const savePermissions = async (roleId: string, nextRolePermissions: string[]) => {
    const previous = permissions[roleId];
    setPermissions((current) => ({ ...current, [roleId]: nextRolePermissions }));
    try {
      const res = await api.put<{ roleId: string; permissions: string[] }>(`/access-control/roles/${roleId}/permissions`, {
        permissions: nextRolePermissions,
      });
      setPermissions((current) => ({
        ...current,
        [roleId]: res.data.data.permissions,
      }));
    } catch (err) {
      setPermissions((current) => ({ ...current, [roleId]: previous }));
      toast.error(err instanceof Error ? err.message : "Failed to update permissions");
    }
  };

  const groupCheckState = (
    roleId: string,
    group: AccessGroup,
  ): boolean | "indeterminate" => {
    const current = permissions[roleId] ?? [];
    if (current.includes(group.id)) return true;
    const groupPaths = getGroupPagePaths(group);
    if (groupPaths.length === 0) return false;
    const granted = groupPaths.filter((path) => current.includes(path));
    if (granted.length === 0) return false;
    if (granted.length === groupPaths.length) return true;
    return "indeterminate";
  };

  const isPageGranted = (roleId: string, group: AccessGroup, path: string) => {
    const current = permissions[roleId] ?? [];
    return current.includes(group.id) || current.includes(path);
  };

  const toggleGroupForRole = (roleId: string, group: AccessGroup, checked: boolean) => {
    const current = permissions[roleId] ?? [];
    const groupPaths = getGroupPagePaths(group);
    const groupPathSet = new Set(groupPaths);
    const next = current.filter(
      (entry) => entry !== group.id && !groupPathSet.has(entry),
    );
    if (checked) next.push(group.id);
    savePermissions(roleId, next);
  };

  const togglePageForRole = (
    roleId: string,
    group: AccessGroup,
    path: string,
    checked: boolean,
  ) => {
    const current = permissions[roleId] ?? [];
    const groupPaths = getGroupPagePaths(group);
    const groupPathSet = new Set(groupPaths);
    const hadLegacyGroup = current.includes(group.id);
    const granted = new Set(
      hadLegacyGroup
        ? groupPaths
        : groupPaths.filter((p) => current.includes(p)),
    );
    if (checked) granted.add(path);
    else granted.delete(path);
    const next = current.filter(
      (entry) => entry !== group.id && !groupPathSet.has(entry),
    );
    next.push(...groupPaths.filter((p) => granted.has(p)));
    savePermissions(roleId, next);
  };

  return (
    <AppLayout>
        <PageHeader
          className="mb-6"
          title={
            <span className="inline-flex items-center gap-2">
              <LockKeyhole className="h-6 w-6" />
              User, Role & Access Control
            </span>
          }
          description="จัดการผู้ใช้ บทบาท และกลุ่ม navigation ที่แต่ละ role เข้าถึงได้"
          actions={
            <div className="grid grid-cols-3 gap-2 text-center w-full lg:w-auto">
              <div className="rounded-md border bg-card px-4 py-2">
                <p className="text-lg font-bold">{users.length}</p>
                <p className="text-xs text-muted-foreground">Users</p>
              </div>
              <div className="rounded-md border bg-card px-4 py-2">
                <p className="text-lg font-bold">{roles.length}</p>
                <p className="text-xs text-muted-foreground">Roles</p>
              </div>
              <div className="rounded-md border bg-card px-4 py-2">
                <p className="text-lg font-bold">{groups.length}</p>
                <p className="text-xs text-muted-foreground">Groups</p>
              </div>
            </div>
          }
        />

        {loading && (
          <Card className="mb-4">
            <CardContent className="py-4 text-sm text-muted-foreground">
              Loading access control data from MongoDB...
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="users">
          <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
            <TabsList className="mb-4 w-max">
              <TabsTrigger value="users" className="gap-1.5">
                <UsersRound className="h-4 w-4" />
                Users
              </TabsTrigger>
              <TabsTrigger value="roles" className="gap-1.5">
                <ShieldCheck className="h-4 w-4" />
                Roles
              </TabsTrigger>
              <TabsTrigger value="groups" className="gap-1.5">
                <FolderTree className="h-4 w-4" />
                Group Control
              </TabsTrigger>
              <TabsTrigger value="matrix" className="gap-1.5">
                <KeyRound className="h-4 w-4" />
                Access Matrix
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="users">
            <Card>
              <CardHeader className="flex flex-col gap-4 pb-3 lg:flex-row lg:items-center lg:justify-between">
                <CardTitle className="text-base">User Management</CardTitle>
                <div className="relative w-full lg:w-80">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search users, email, role..."
                    className="pl-9"
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 rounded-md border bg-muted/30 p-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_180px_auto]">
                  <Input
                    value={newUser.name}
                    onChange={(event) => setNewUser({ ...newUser, name: event.target.value })}
                    placeholder="Full name"
                  />
                  <Input
                    value={newUser.email}
                    onChange={(event) => setNewUser({ ...newUser, email: event.target.value })}
                    placeholder="email@icpladda.com"
                  />
                  <Input
                    value={newUser.department}
                    onChange={(event) => setNewUser({ ...newUser, department: event.target.value })}
                    placeholder="Department"
                  />
                  <Input
                    value={newUser.position}
                    onChange={(event) => setNewUser({ ...newUser, position: event.target.value })}
                    placeholder="Position"
                  />
                  <Select
                    value={newUser.roleId}
                    onValueChange={(value) => setNewUser({ ...newUser, roleId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={addUser} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add
                  </Button>
                </div>

                <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
                  <Table className="min-w-[700px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead className="hidden lg:table-cell">Department</TableHead>
                        <TableHead className="hidden lg:table-cell">Position</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="hidden md:table-cell">Status</TableHead>
                        <TableHead className="hidden xl:table-cell">Last active</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                                <UserCog className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="font-medium">{user.name}</p>
                                <p className="text-xs text-muted-foreground">{user.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell min-w-[160px]">
                            <Input
                              value={user.department}
                              onChange={(event) =>
                                setUsers((current) =>
                                  current.map((item) =>
                                    item.id === user.id
                                      ? { ...item, department: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                              onBlur={(event) =>
                                updateUser(user.id, {
                                  department: event.target.value.trim() || "Unassigned",
                                })
                              }
                            />
                          </TableCell>
                          <TableCell className="hidden lg:table-cell min-w-[160px]">
                            <Input
                              value={user.position}
                              onChange={(event) =>
                                setUsers((current) =>
                                  current.map((item) =>
                                    item.id === user.id
                                      ? { ...item, position: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                              onBlur={(event) =>
                                updateUser(user.id, {
                                  position: event.target.value.trim() || "Unassigned",
                                })
                              }
                            />
                          </TableCell>
                          <TableCell className="min-w-[140px] sm:min-w-[180px]">
                            <Select
                              value={user.roleId}
                              onValueChange={(value) => updateUser(user.id, { roleId: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {roles.map((role) => (
                                  <SelectItem key={role.id} value={role.id}>
                                    {role.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <Select
                              value={user.status}
                              onValueChange={(value) =>
                                updateUser(user.id, { status: value as UserStatus })
                              }
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="hidden xl:table-cell">
                            <Badge
                              className={cn(
                                user.status === "active"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-muted text-muted-foreground",
                              )}
                            >
                              {user.lastActive}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteUser(user.id)}
                              disabled={user.roleId === "admin"}
                              aria-label="Delete user"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="roles">
            <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Create Role</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    value={newRole.name}
                    onChange={(event) => setNewRole({ ...newRole, name: event.target.value })}
                    placeholder="Role name"
                  />
                  <Input
                    value={newRole.description}
                    onChange={(event) =>
                      setNewRole({ ...newRole, description: event.target.value })
                    }
                    placeholder="Description"
                  />
                  <Button onClick={addRole} className="w-full gap-2">
                    <Plus className="h-4 w-4" />
                    Add Role
                  </Button>
                </CardContent>
              </Card>

              <div className="grid gap-3 md:grid-cols-2">
                {roles.map((role) => (
                  <Card key={role.id}>
                    <CardHeader className="flex-row items-start justify-between gap-3 pb-3">
                      <div>
                        <CardTitle className="text-base">{role.name}</CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">{role.description || "-"}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={role.locked}
                        onClick={() => deleteRole(role.id)}
                        aria-label="Delete role"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between">
                      <Badge variant="outline">
                        {(permissions[role.id] ?? []).length} permissions
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {users.filter((user) => user.roleId === role.id).length} users
                      </span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="groups">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Group Control</CardTitle>
                <p className="text-sm text-muted-foreground">
                  จัดกลุ่ม navigation — แต่ละ group ประกอบด้วย URL หลายตัว และเป็นหน่วยที่ role อนุญาตหรือปิดสิทธิ์
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 rounded-md border bg-muted/30 p-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-[1fr_1.5fr_auto]">
                  <Input
                    value={newGroup.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      const isThai = /[฀-๿]/.test(name);
                      const id = isThai
                        ? name.trim().replace(/\s+/g, "-")
                        : name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
                      setNewGroup({ ...newGroup, name, id });
                    }}
                    placeholder="ชื่อกลุ่ม"
                  />
                  <PathPicker
                    value={newGroup.paths}
                    onChange={(paths) => setNewGroup({ ...newGroup, paths })}
                    placeholder="เลือกหน้า navigation"
                    ownedBy={pathOwnerMap(null)}
                    onMovePath={movePathToNewGroup}
                  />
                  <Button onClick={addGroup} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add
                  </Button>
                </div>

                <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
                  <Table className="min-w-[700px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-14">ลำดับ</TableHead>
                        <TableHead className="min-w-[180px]">Group name</TableHead>
                        <TableHead className="min-w-[280px]">Nav Pages</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedGroups.map((group) => {
                        const isOthers = group.id === "others";
                        return (
                        <TableRow
                          key={group.id}
                          onDragOver={(e) => {
                            if (isOthers || !dragGroupId || dragGroupId === group.id) return;
                            e.preventDefault();
                            if (dragOverGroupId !== group.id) setDragOverGroupId(group.id);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (dragGroupId) reorderGroups(dragGroupId, group.id);
                            setDragGroupId(null);
                            setDragOverGroupId(null);
                          }}
                          className={cn(
                            dragGroupId === group.id && "opacity-50",
                            dragOverGroupId === group.id && "border-t-2 border-primary",
                          )}
                        >
                          <TableCell>
                            {!isOthers && (
                              <div
                                draggable
                                onDragStart={() => setDragGroupId(group.id)}
                                onDragEnd={() => {
                                  setDragGroupId(null);
                                  setDragOverGroupId(null);
                                }}
                                className="flex cursor-grab items-center justify-center text-muted-foreground active:cursor-grabbing"
                                aria-label="ลากเพื่อจัดลำดับกลุ่ม"
                              >
                                <GripVertical className="h-4 w-4" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1.5">
                              <Input
                                value={group.name}
                                onChange={(e) =>
                                  setGroups((current) =>
                                    current.map((item) =>
                                      item.id === group.id ? { ...item, name: e.target.value } : item,
                                    ),
                                  )
                                }
                                onBlur={(e) =>
                                  updateGroup(group.id, { name: e.target.value.trim() || group.id })
                                }
                              />
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-2">
                              <PathPicker
                                value={group.paths ?? []}
                                onChange={(paths) => updateGroupPaths(group.id, paths)}
                                disabled={group.id === "others"}
                                ownedBy={pathOwnerMap(group.id)}
                                onMovePath={(path) => movePathToGroup(path, group.id)}
                              />
                              <div className="space-y-1">
                                {renderNavItemsForGroup(group).map((item) => (
                                  <div
                                    key={item.path}
                                    draggable
                                    onDragStart={(e) => {
                                      e.stopPropagation();
                                      setNavDrag({ groupId: group.id, path: item.path });
                                    }}
                                    onDragEnd={() => {
                                      setNavDrag(null);
                                      setNavDragOverPath(null);
                                    }}
                                    onDragOver={(e) => {
                                      if (
                                        !navDrag ||
                                        navDrag.groupId !== group.id ||
                                        navDrag.path === item.path
                                      )
                                        return;
                                      e.preventDefault();
                                      e.stopPropagation();
                                      if (navDragOverPath !== item.path)
                                        setNavDragOverPath(item.path);
                                    }}
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      if (navDrag && navDrag.groupId === group.id)
                                        reorderNavPaths(group.id, navDrag.path, item.path);
                                      setNavDrag(null);
                                      setNavDragOverPath(null);
                                    }}
                                    className={cn(
                                      "flex items-center gap-1.5 rounded text-sm text-muted-foreground cursor-grab active:cursor-grabbing",
                                      navDrag?.groupId === group.id &&
                                        navDrag.path === item.path &&
                                        "opacity-50",
                                      navDragOverPath === item.path &&
                                        navDrag?.groupId === group.id &&
                                        "border-t-2 border-primary",
                                    )}
                                  >
                                    <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                                    <item.icon className="h-3.5 w-3.5 shrink-0" />
                                    <span>{item.label}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteGroup(group.id)}
                              disabled={group.locked}
                              aria-label="Delete group"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="matrix">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Group Permission Matrix</CardTitle>
              </CardHeader>
              <CardContent className="p-2 sm:p-4 md:p-6">
                <Table
                  className="w-full table-fixed"
                  containerClassName="relative w-full overflow-x-auto"
                >
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 top-0 z-30 min-w-[130px] w-[130px] sm:min-w-[200px] sm:w-[200px] md:min-w-[240px] md:w-[240px] bg-card shadow-[1px_1px_0_0_hsl(var(--border))]">
                        Group
                      </TableHead>
                      {roles.map((role) => (
                        <TableHead
                          key={role.id}
                          className="sticky top-0 z-20 min-w-[56px] sm:min-w-[90px] md:min-w-[120px] bg-card px-1 text-center text-xs leading-tight whitespace-normal break-words sm:px-2 sm:text-sm shadow-[0_1px_0_0_hsl(var(--border))]"
                        >
                          {role.name}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                    <TableBody>
                      {sortedGroups.map((group) => {
                        const groupPaths = getGroupPagePaths(group);
                        const expanded = expandedGroups.has(group.id);
                        return (
                          <Fragment key={group.id}>
                            <TableRow>
                              <TableCell className="sticky left-0 z-10 min-w-[130px] w-[130px] sm:min-w-[200px] sm:w-[200px] md:min-w-[240px] md:w-[240px] bg-card shadow-[1px_0_0_0_hsl(var(--border))]">
                                <div className="flex items-start gap-2">
                                  <button
                                    type="button"
                                    onClick={() => toggleExpandedGroup(group.id)}
                                    className="mt-0.5 rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    aria-label={expanded ? "ยุบรายหน้า" : "ขยายรายหน้า"}
                                    aria-expanded={expanded}
                                  >
                                    {expanded ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                  </button>
                                  <div>
                                    <p className="font-medium">{group.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {groupPaths.length} หน้า
                                    </p>
                                    {group.description && (
                                      <p className="mt-1 text-xs text-muted-foreground">
                                        {group.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              {roles.map((role) => (
                                <TableCell key={role.id} className="px-1 text-center sm:px-4">
                                  <Checkbox
                                    checked={groupCheckState(role.id, group)}
                                    onCheckedChange={(c) =>
                                      toggleGroupForRole(role.id, group, c === true)
                                    }
                                    aria-label={`${role.name} ${group.name}`}
                                  />
                                </TableCell>
                              ))}
                            </TableRow>
                            {expanded &&
                              groupPaths.map((path) => {
                                const navItem = navItemByPath.get(path);
                                return (
                                  <TableRow
                                    key={`${group.id}-${path}`}
                                    className="bg-muted/30"
                                  >
                                    <TableCell className="sticky left-0 z-10 min-w-[130px] w-[130px] sm:min-w-[200px] sm:w-[200px] md:min-w-[240px] md:w-[240px] bg-card py-1.5 pl-12 shadow-[1px_0_0_0_hsl(var(--border))]">
                                      <div className="flex items-center gap-2">
                                        {navItem ? (
                                          <>
                                            <navItem.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                            <span className="text-sm">{navItem.label}</span>
                                            <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                                              {path}
                                            </span>
                                          </>
                                        ) : (
                                          <span className="font-mono text-xs text-muted-foreground">
                                            {path}
                                          </span>
                                        )}
                                      </div>
                                    </TableCell>
                                    {roles.map((role) => (
                                      <TableCell
                                        key={role.id}
                                        className="px-1 py-1.5 text-center sm:px-4"
                                      >
                                        <Checkbox
                                          checked={isPageGranted(role.id, group, path)}
                                          onCheckedChange={(c) =>
                                            togglePageForRole(
                                              role.id,
                                              group,
                                              path,
                                              c === true,
                                            )
                                          }
                                          aria-label={`${role.name} ${navItem?.label ?? path}`}
                                        />
                                      </TableCell>
                                    ))}
                                  </TableRow>
                                );
                              })}
                          </Fragment>
                        );
                      })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
    </AppLayout>
  );
};

export default AccessControl;
