import { describe, it, expect } from "vitest";
import { primaryRole, unionPermissions, normalizeRoles } from "./roles";

describe("primaryRole", () => {
  it("returns viewer for an empty list", () => {
    expect(primaryRole([])).toBe("viewer");
  });

  it("ranks admin above every other role", () => {
    expect(primaryRole(["viewer", "lab-head", "admin", "qc-head"])).toBe("admin");
  });

  it("ranks qc-head above lab-head", () => {
    expect(primaryRole(["lab-head", "qc-head"])).toBe("qc-head");
  });

  it("ranks lab-head above staff working roles", () => {
    expect(primaryRole(["qc-staff", "lab-head"])).toBe("lab-head");
    expect(primaryRole(["lab-analyze", "lab-head"])).toBe("lab-head");
  });

  it("ranks lab-analyze and qc-staff equally", () => {
    expect(primaryRole(["lab-analyze", "qc-staff"])).toBe("lab-analyze");
    expect(primaryRole(["qc-staff", "lab-analyze"])).toBe("qc-staff");
  });

  it("ranks staff working roles above other non-viewer roles", () => {
    expect(primaryRole(["lab-inventory", "lab-analyze"])).toBe("lab-analyze");
    expect(primaryRole(["production", "qc-staff"])).toBe("qc-staff");
  });

  it("ranks viewer lowest and breaks other-role ties by array order", () => {
    expect(primaryRole(["viewer", "production"])).toBe("production");
    expect(primaryRole(["production", "lab"])).toBe("production");
    expect(primaryRole(["lab", "production"])).toBe("lab");
  });
});

describe("normalizeRoles", () => {
  it("returns roles when present", () => {
    expect(normalizeRoles({ roles: ["lab", "qc"] })).toEqual(["lab", "qc"]);
  });

  it("falls back to legacy single role", () => {
    expect(normalizeRoles({ role: "qc" })).toEqual(["qc"]);
  });

  it("prefers non-empty roles over legacy role", () => {
    expect(normalizeRoles({ role: "viewer", roles: ["admin"] })).toEqual(["admin"]);
  });

  it("returns empty array when nothing is set", () => {
    expect(normalizeRoles({})).toEqual([]);
  });
});

describe("unionPermissions", () => {
  it("unions permissions across roles and de-dupes", () => {
    const byRole = { lab: ["a", "b"], qc: ["b", "c"] };
    expect(unionPermissions(["lab", "qc"], byRole)).toEqual(["a", "b", "c"]);
  });

  it("expands admin to every role grant permission", () => {
    const byRole = {
      admin: ["access"],
      lab: ["/lab-testing", "deny:/stock/history"],
      qc: ["/qc-testing"],
      viewer: ["/petition", "/lab-testing"],
    };

    expect(unionPermissions(["admin"], byRole)).toEqual([
      "access",
      "/lab-testing",
      "/qc-testing",
      "/petition",
    ]);
  });

  it("keeps deny permissions for non-admin roles", () => {
    expect(unionPermissions(["lab"], { lab: ["/stock", "deny:/stock/history"] })).toEqual([
      "/stock",
      "deny:/stock/history",
    ]);
  });

  it("ignores roles with no permission entry", () => {
    expect(unionPermissions(["lab", "ghost"], { lab: ["a"] })).toEqual(["a"]);
  });

  it("returns empty array for no roles", () => {
    expect(unionPermissions([], { lab: ["a"] })).toEqual([]);
  });
});
