import { describe, it, expect } from "vitest";
import {
  filterUsers, paginate, countUsersInRole, rolePermissionCount,
  accessibleModules, distinctDepartments,
} from "./accessDerive";
import type { AppUser, AccessGroup } from "@/components/lis/access/types";

function u(over: Partial<AppUser>): AppUser {
  return {
    id: "x", name: "Somchai", email: "somchai@icpladda.com", roleId: "qc",
    roleIds: ["qc"], department: "QC", position: "Analyst", employeeId: "E01",
    status: "active", lastActive: "", ...over,
  };
}

describe("filterUsers", () => {
  const users = [
    u({ id: "a", name: "Alice", email: "alice@x.com", employeeId: "E1", department: "QC", roleIds: ["qc"], status: "active" }),
    u({ id: "b", name: "Bob", email: "bob@x.com", employeeId: "E2", department: "Lab", roleIds: ["lab", "qc"], status: "inactive" }),
    u({ id: "c", name: "Carol", email: "carol@x.com", employeeId: "E3", department: "QC", roleIds: ["viewer"], status: "active" }),
  ];
  it("search matches name/email/employeeId (case-insensitive, contains)", () => {
    expect(filterUsers(users, { search: "ali" }).map((x) => x.id)).toEqual(["a"]);
    expect(filterUsers(users, { search: "bob@x" }).map((x) => x.id)).toEqual(["b"]);
    expect(filterUsers(users, { search: "e3" }).map((x) => x.id)).toEqual(["c"]);
  });
  it("dept/role/status filter exactly; empty/undefined skips", () => {
    expect(filterUsers(users, { dept: "QC" }).map((x) => x.id)).toEqual(["a", "c"]);
    expect(filterUsers(users, { role: "qc" }).map((x) => x.id)).toEqual(["a", "b"]);
    expect(filterUsers(users, { status: "inactive" }).map((x) => x.id)).toEqual(["b"]);
    expect(filterUsers(users, {}).length).toBe(3);
  });
  it("combines filters (AND)", () => {
    expect(filterUsers(users, { dept: "QC", status: "active", role: "qc" }).map((x) => x.id)).toEqual(["a"]);
  });
});

describe("paginate", () => {
  const list = [1, 2, 3, 4, 5];
  it("slices the requested page (1-indexed) and reports total+pageCount", () => {
    expect(paginate(list, 1, 2)).toEqual({ items: [1, 2], total: 5, pageCount: 3 });
    expect(paginate(list, 3, 2)).toEqual({ items: [5], total: 5, pageCount: 3 });
  });
  it("clamps out-of-range page to the last page; empty list = 1 page", () => {
    expect(paginate(list, 99, 2).items).toEqual([5]);
    expect(paginate([], 1, 25)).toEqual({ items: [], total: 0, pageCount: 1 });
  });
});

describe("role helpers", () => {
  const users = [u({ roleIds: ["qc"] }), u({ roleIds: ["lab", "qc"] }), u({ roleIds: ["viewer"] })];
  it("countUsersInRole counts membership via roleIds", () => {
    expect(countUsersInRole(users, "qc")).toBe(2);
    expect(countUsersInRole(users, "viewer")).toBe(1);
    expect(countUsersInRole(users, "none")).toBe(0);
  });
  it("countUsersInRole falls back to legacy singular roleId when roleIds is empty", () => {
    expect(countUsersInRole([{ ...u({}), roleId: "qc", roleIds: [] }], "qc")).toBe(1);
  });
  it("rolePermissionCount reads permissions[roleId] length, missing = 0", () => {
    expect(rolePermissionCount({ qc: ["/a", "/b"] }, "qc")).toBe(2);
    expect(rolePermissionCount({}, "qc")).toBe(0);
  });
});

describe("accessibleModules", () => {
  const groups: AccessGroup[] = [
    { id: "g-qc", name: "QC", description: "", paths: ["/qc-testing"] },
    { id: "g-lab", name: "Lab", description: "", paths: ["/lab-testing"] },
  ];
  it("maps group ids to group names, paths to nav labels, dedupes, drops unknown-empty", () => {
    const mods = accessibleModules({ r: ["g-qc", "/petition", "g-qc"] }, "r", groups);
    expect(mods).toContain("QC");
    expect(mods).toContain("รายการคำร้อง"); // NAV_ITEMS label for /petition
    expect(mods.filter((m) => m === "QC").length).toBe(1); // deduped
  });
  it("maps the 'others' token to อื่นๆ and returns [] for a role with no perms", () => {
    expect(accessibleModules({ r: ["others"] }, "r", groups)).toEqual(["อื่นๆ"]);
    expect(accessibleModules({}, "r", groups)).toEqual([]);
  });
});

describe("distinctDepartments", () => {
  it("returns unique non-empty departments sorted", () => {
    const users = [u({ department: "QC" }), u({ department: "Lab" }), u({ department: "QC" }), u({ department: "" })];
    expect(distinctDepartments(users)).toEqual(["Lab", "QC"]);
  });
});
