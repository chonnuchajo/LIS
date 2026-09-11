import { useMemo, useState } from "react";
import { Globe2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageToolbar from "@/components/lis/PageToolbar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { isPublicPath, userCanAccessPath } from "@/lib/accessControl";
import { PAGE_ITEMS, type NavItem } from "@/lib/navItems";
import { unionPermissions } from "@/lib/roles";
import { tabsFor } from "@/lib/tabRegistry";
import type { AccessGroup, AppUser, Role } from "./types";

const BADGE_LIMIT = 5;

type PageDescriptor = {
  path: string;
  label: string;
  icon?: NavItem["icon"];
};

type PageOwner = {
  id: string;
  name: string;
  description: string;
  publicAccess: boolean;
};

type PageAccessRow = PageDescriptor & {
  owner: PageOwner;
  roles: Role[];
  users: AppUser[];
};

type PageAccessTabProps = {
  groups: AccessGroup[];
  roles: Role[];
  users: AppUser[];
  permissions: Record<string, string[]>;
};

function isTabVirtualPath(path: string) {
  const slashIndex = path.lastIndexOf("/");
  if (slashIndex <= 0) return false;
  return tabsFor(path.slice(0, slashIndex)).some((tab) => tab.key === path.slice(slashIndex + 1));
}

function buildPageDescriptors(groups: AccessGroup[]): PageDescriptor[] {
  const knownPageByPath = new Map(PAGE_ITEMS.map((item) => [item.path, item]));
  const descriptors: PageDescriptor[] = [];
  const seenPaths = new Set<string>();

  const addPath = (path: string) => {
    if (!path.startsWith("/") || isTabVirtualPath(path) || seenPaths.has(path)) return;
    const knownPage = knownPageByPath.get(path);
    descriptors.push({
      path,
      label: knownPage?.label ?? path,
      icon: knownPage?.icon,
    });
    seenPaths.add(path);
  };

  PAGE_ITEMS.forEach((item) => addPath(item.path));
  groups.forEach((group) => (group.paths ?? []).forEach(addPath));

  return descriptors;
}

function groupCanGrantPath(groupId: string, path: string, groups: AccessGroup[]) {
  return userCanAccessPath(
    { roles: ["viewer"], status: "active", permissions: [groupId] },
    path,
    groups,
  );
}

function pageOwnerFor(path: string, groups: AccessGroup[]): PageOwner {
  if (isPublicPath(path)) {
    return {
      id: "public",
      name: "ทุกคนที่เข้าสู่ระบบ",
      description: "เปิดใช้โดยไม่ต้องกำหนด role",
      publicAccess: true,
    };
  }

  const owner = groups.find(
    (group) => group.id !== "others" && groupCanGrantPath(group.id, path, groups),
  );
  if (owner) {
    return {
      id: owner.id,
      name: owner.name,
      description: owner.description,
      publicAccess: false,
    };
  }

  const others = groups.find((group) => group.id === "others");
  if (others && groupCanGrantPath(others.id, path, groups)) {
    return {
      id: others.id,
      name: others.name,
      description: others.description,
      publicAccess: false,
    };
  }

  return {
    id: "unassigned",
    name: "ยังไม่กำหนดกลุ่ม",
    description: "ยังไม่มี group ควบคุมหน้าเว็บนี้",
    publicAccess: false,
  };
}

function roleCanAccessPath(roleId: string, path: string, permissions: Record<string, string[]>, groups: AccessGroup[]) {
  return userCanAccessPath(
    { roles: [roleId], status: "active", permissions: permissions[roleId] ?? [] },
    path,
    groups,
  );
}

function userCanAccessPage(user: AppUser, path: string, permissions: Record<string, string[]>, groups: AccessGroup[]) {
  const roleIds = user.roleIds.length > 0 ? user.roleIds : [user.roleId];
  return userCanAccessPath(
    {
      roles: roleIds,
      status: user.status,
      permissions: unionPermissions(roleIds, permissions),
    },
    path,
    groups,
  );
}

function VisibleBadges({ values, emptyText }: { values: string[]; emptyText: string }) {
  if (values.length === 0) {
    return <span className="text-xs text-muted-foreground">{emptyText}</span>;
  }

  const visibleValues = values.slice(0, BADGE_LIMIT);
  const hiddenCount = values.length - visibleValues.length;

  return (
    <div className="flex flex-wrap gap-1">
      {visibleValues.map((value) => (
        <Badge key={value} variant="secondary" className="max-w-[160px] truncate text-[11px]">
          {value}
        </Badge>
      ))}
      {hiddenCount > 0 && (
        <Badge variant="outline" className="text-[11px]">
          +{hiddenCount}
        </Badge>
      )}
    </div>
  );
}

export default function PageAccessTab({ groups, roles, users, permissions }: PageAccessTabProps) {
  const [search, setSearch] = useState("");

  const rows = useMemo<PageAccessRow[]>(() => {
    return buildPageDescriptors(groups).map((page) => ({
      ...page,
      owner: pageOwnerFor(page.path, groups),
      roles: roles.filter((role) => roleCanAccessPath(role.id, page.path, permissions, groups)),
      users: users.filter((user) => userCanAccessPage(user, page.path, permissions, groups)),
    }));
  }, [groups, permissions, roles, users]);

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((row) => {
      const text = [
        row.label,
        row.path,
        row.owner.name,
        ...row.roles.map((role) => role.name),
        ...row.users.map((user) => `${user.name} ${user.email}`),
      ].join(" ").toLowerCase();
      return text.includes(keyword);
    });
  }, [rows, search]);

  const publicCount = rows.filter((row) => row.owner.publicAccess).length;
  const adminOnlyCount = rows.filter((row) => row.roles.length === 1 && row.roles[0]?.id === "admin").length;
  const groupedCount = rows.filter((row) => row.owner.id !== "unassigned").length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">การเข้าถึงหน้าเว็บไซต์</CardTitle>
        <p className="text-sm text-muted-foreground">
          สรุปว่าแต่ละ URL เปิดให้ role และผู้ใช้คนใดเข้าได้ ตามสิทธิ์ปัจจุบัน
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <PageToolbar
          className="rounded-lg border bg-muted/30 p-3"
          search={{
            value: search,
            onChange: setSearch,
            placeholder: "ค้นหา URL / หน้า / role / ผู้ใช้",
          }}
          right={
            <div className="grid grid-cols-3 gap-2 text-center sm:w-auto">
            <div className="rounded-md border bg-card px-3 py-2">
              <p className="text-lg font-bold">{rows.length}</p>
              <p className="text-xs text-muted-foreground">Pages</p>
            </div>
            <div className="rounded-md border bg-card px-3 py-2">
              <p className="text-lg font-bold">{publicCount}</p>
              <p className="text-xs text-muted-foreground">Public</p>
            </div>
            <div className="rounded-md border bg-card px-3 py-2">
              <p className="text-lg font-bold">{adminOnlyCount}</p>
              <p className="text-xs text-muted-foreground">Admin only</p>
            </div>
          </div>
          }
        />
        <div className="text-sm text-muted-foreground">
          แสดง {filteredRows.length} จาก {rows.length} หน้า · ผูก group แล้ว {groupedCount} หน้า
        </div>
        <Table className="min-w-[980px]">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[260px]">หน้าเว็บไซต์</TableHead>
              <TableHead className="min-w-[180px]">กลุ่มควบคุม</TableHead>
              <TableHead className="min-w-[240px]">Role ที่เข้าได้</TableHead>
              <TableHead className="min-w-[280px]">ผู้ใช้ที่เข้าได้</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.map((row) => {
              const Icon = row.icon ?? Globe2;
              return (
                <TableRow key={row.path}>
                  <TableCell>
                    <div className="flex items-start gap-2">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{row.label}</p>
                        <p className="font-mono text-xs text-muted-foreground">{row.path}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Badge variant={row.owner.publicAccess ? "green-soft" : "outline"}>
                        {row.owner.name}
                      </Badge>
                      {row.owner.description && (
                        <p className="line-clamp-2 text-xs text-muted-foreground">{row.owner.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <VisibleBadges values={row.roles.map((role) => role.name)} emptyText="ไม่มี role" />
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">{row.users.length} คน</p>
                      <VisibleBadges values={row.users.map((user) => user.name)} emptyText="ไม่มีผู้ใช้" />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
