import { describe, it, expect } from "vitest";
import { primaryRole, unionPermissions, normalizeRoles } from "./roles";

describe("primaryRole", () => {
  it("returns viewer for an empty list", () => {
    expect(primaryRole([])).toBe("viewer");
  });

  it("ranks admin highest", () => {
    expect(primaryRole(["viewer", "lab", "admin", "qc"])).toBe("admin");
  });

  it("ranks qc above lab", () => {
    expect(primaryRole(["lab", "qc"])).toBe("qc");
  });

  it("treats qc- and lab- prefixes by family", () => {
    expect(primaryRole(["lab-analyst", "qc-head"])).toBe("qc-head");
  });

  it("ranks a custom role above viewer but below lab", () => {
    expect(primaryRole(["viewer", "production"])).toBe("production");
    expect(primaryRole(["lab", "production"])).toBe("lab");
  });

  it("breaks ties by array order", () => {
    expect(primaryRole(["lab-analyst", "lab-head"])).toBe("lab-analyst");
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

  it("ignores roles with no permission entry", () => {
    expect(unionPermissions(["lab", "ghost"], { lab: ["a"] })).toEqual(["a"]);
  });

  it("returns empty array for no roles", () => {
    expect(unionPermissions([], { lab: ["a"] })).toEqual([]);
  });
});
