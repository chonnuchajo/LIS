import { useEffect, useMemo, useState } from "react";
import AppSidebar from "@/components/lis/AppSidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import {
  KeyRound,
  LockKeyhole,
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

type ModulePermission = {
  id: string;
  name: string;
  description: string;
};

const modules: ModulePermission[] = [
  { id: "dashboard", name: "Dashboard", description: "View lab overview and active workload" },
  { id: "samples", name: "Samples", description: "Send, receive, and inspect samples" },
  { id: "results", name: "Results", description: "Record analysis results and standards" },
  { id: "qc", name: "QC Approval", description: "Approve or reject final results" },
  { id: "stock", name: "Stock", description: "Manage standard and solvent stock" },
  { id: "reports", name: "Reports", description: "View reports and export data" },
  { id: "admin", name: "Admin Data", description: "Access approved data and logs" },
  { id: "access", name: "Access Control", description: "Manage users, roles, and permissions" },
];

const defaultRoles: Role[] = [
  { id: "admin", name: "Administrator", description: "Full system access", locked: true },
  { id: "lab", name: "Lab Analyst", description: "Sample handling and result entry" },
  { id: "qc", name: "QC Reviewer", description: "Review and approve results" },
  { id: "viewer", name: "Viewer", description: "Read-only access to dashboards and reports" },
];

const defaultUsers: AppUser[] = [
  {
    id: "USR-001",
    name: "System Admin",
    email: "admin@icpladda.com",
    roleId: "admin",
    department: "IT",
    position: "System Administrator",
    status: "active",
    lastActive: "Today",
  },
  {
    id: "USR-002",
    name: "Lab Analyst",
    email: "lab@icpladda.com",
    roleId: "lab",
    department: "Laboratory",
    position: "Lab Analyst",
    status: "active",
    lastActive: "Today",
  },
  {
    id: "USR-003",
    name: "QC Reviewer",
    email: "qc@icpladda.com",
    roleId: "qc",
    department: "Quality Control",
    position: "QC Reviewer",
    status: "active",
    lastActive: "Yesterday",
  },
];

const defaultPermissions: Record<string, string[]> = {
  admin: modules.map((m) => m.id),
  lab: ["dashboard", "samples", "results", "stock"],
  qc: ["dashboard", "results", "qc", "reports"],
  viewer: ["dashboard", "reports"],
};

type AccessControlState = {
  users: AppUser[];
  roles: Role[];
  modules: ModulePermission[];
  permissions: Record<string, string[]>;
};

const AccessControl = () => {
  const [users, setUsers] = useState<AppUser[]>(defaultUsers);
  const [roles, setRoles] = useState<Role[]>(defaultRoles);
  const [permissionModules, setPermissionModules] = useState<ModulePermission[]>(modules);
  const [permissions, setPermissions] = useState<Record<string, string[]>>(
    defaultPermissions,
  );
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

  const loadAccessControl = async () => {
    setLoading(true);
    try {
      const res = await api.get<AccessControlState>("/access-control");
      setUsers(res.data.data.users);
      setRoles(res.data.data.roles);
      setPermissionModules(res.data.data.modules);
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
      toast.success("Role removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove role");
    }
  };

  const togglePermission = async (roleId: string, moduleId: string) => {
    const current = permissions[roleId] ?? [];
    const nextRolePermissions = current.includes(moduleId)
      ? current.filter((id) => id !== moduleId)
      : [...current, moduleId];
    const nextPermissions = { ...permissions, [roleId]: nextRolePermissions };
    setPermissions(nextPermissions);
    try {
      await api.put(`/access-control/roles/${roleId}/permissions`, {
        permissions: nextRolePermissions,
      });
    } catch (err) {
      setPermissions(permissions);
      toast.error(err instanceof Error ? err.message : "Failed to update permissions");
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-auto p-6">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              <LockKeyhole className="h-6 w-6" />
              User, Role & Access Control
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage application users, role membership, and module permissions.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md border bg-card px-4 py-2">
              <p className="text-lg font-bold">{users.length}</p>
              <p className="text-xs text-muted-foreground">Users</p>
            </div>
            <div className="rounded-md border bg-card px-4 py-2">
              <p className="text-lg font-bold">{roles.length}</p>
              <p className="text-xs text-muted-foreground">Roles</p>
            </div>
            <div className="rounded-md border bg-card px-4 py-2">
              <p className="text-lg font-bold">{permissionModules.length}</p>
              <p className="text-xs text-muted-foreground">Modules</p>
            </div>
          </div>
        </div>

        {loading && (
          <Card className="mb-4">
            <CardContent className="py-4 text-sm text-muted-foreground">
              Loading access control data from MongoDB...
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="users">
          <TabsList className="mb-4">
            <TabsTrigger value="users" className="gap-1.5">
              <UsersRound className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="roles" className="gap-1.5">
              <ShieldCheck className="h-4 w-4" />
              Roles
            </TabsTrigger>
            <TabsTrigger value="matrix" className="gap-1.5">
              <KeyRound className="h-4 w-4" />
              Access Matrix
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card>
              <CardHeader className="gap-4 pb-3 lg:flex-row lg:items-center lg:justify-between">
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
                <div className="grid gap-3 rounded-md border bg-muted/30 p-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_180px_auto]">
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

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last active</TableHead>
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
                          <TableCell className="min-w-[160px]">
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
                          <TableCell className="min-w-[160px]">
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
                          <TableCell className="min-w-[180px]">
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
                          <TableCell>
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
                          <TableCell>
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

          <TabsContent value="matrix">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Module Permission Matrix</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[260px]">Module</TableHead>
                        {roles.map((role) => (
                          <TableHead key={role.id} className="min-w-[150px] text-center">
                            {role.name}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {permissionModules.map((module) => (
                        <TableRow key={module.id}>
                          <TableCell>
                            <p className="font-medium">{module.name}</p>
                            <p className="text-xs text-muted-foreground">{module.description}</p>
                          </TableCell>
                          {roles.map((role) => (
                            <TableCell key={role.id} className="text-center">
                              <Checkbox
                                checked={(permissions[role.id] ?? []).includes(module.id)}
                                onCheckedChange={() => togglePermission(role.id, module.id)}
                                aria-label={`${role.name} ${module.name}`}
                              />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AccessControl;
