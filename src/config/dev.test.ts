import { describe, it, expect } from "vitest";
import {
  synthesizeDevUser,
  synthesizeDevAssignees,
  normalizeDevRoleSelection,
  toggleDevRoleSelection,
  type DevRoleOption,
} from "./dev";

const devRoles: DevRoleOption[] = [
  { id: "admin", name: "Admin", family: "" },
  { id: "lab", name: "Lab", family: "lab" },
  { id: "lab-analyze", name: "Lab Analyze", family: "lab" },
  { id: "lab-head", name: "Lab Head", family: "lab" },
  { id: "qc", name: "QC", family: "qc" },
  { id: "qc-staff", name: "QC Staff", family: "qc" },
  { id: "qc-head", name: "QC Head", family: "qc" },
];

describe("synthesizeDevUser", () => {
  it("builds a dev AuthUser shape from a single role", () => {
    const user = synthesizeDevUser([{ id: "qc", name: "QC Reviewer" }]);

    expect(user).toEqual({
      id: "dev-qc",
      email: "qc.dev@icpladda.com",
      name: "Dev QC Reviewer",
      role: "qc",
      roles: ["qc"],
      permissions: [],
      department: "qc",
      position: "QC Reviewer",
      status: "active",
      employeeId: "DEV-qc",
    });
  });

  it("uses the role id (not name) in email and id fields so custom role names cannot break the email", () => {
    const user = synthesizeDevUser([{ id: "custom-role", name: "ผู้ตรวจ" }]);

    expect(user.id).toBe("dev-custom-role");
    expect(user.email).toBe("custom-role.dev@icpladda.com");
    expect(user.role).toBe("custom-role");
    expect(user.name).toBe("Dev ผู้ตรวจ");
  });

  it("derives the primary role when given several, and keeps all in roles[]", () => {
    const user = synthesizeDevUser([
      { id: "lab", name: "Lab" },
      { id: "qc", name: "QC" },
    ]);

    // lab and qc are both "other" priority roles, so the first selected role wins.
    expect(user.role).toBe("lab");
    expect(user.roles).toEqual(["lab", "qc"]);
    expect(user.id).toBe("dev-lab");
    expect(user.name).toBe("Dev Lab");
  });
});

describe("dev role selection normalization", () => {
  it("adds lab-analyze when a Lab role is selected", () => {
    expect(normalizeDevRoleSelection(["lab"], devRoles)).toEqual(["lab", "lab-analyze"]);
    expect(toggleDevRoleSelection(["admin"], "lab", devRoles)).toEqual(["admin", "lab", "lab-analyze"]);
  });

  it("adds qc-staff when a QC role is selected", () => {
    expect(normalizeDevRoleSelection(["qc-head"], devRoles)).toEqual(["qc-head", "qc-staff"]);
    expect(toggleDevRoleSelection(["admin"], "qc", devRoles)).toEqual(["admin", "qc", "qc-staff"]);
  });

  it("removing lab-analyze removes Lab-family dev roles and falls back to admin", () => {
    expect(toggleDevRoleSelection(["lab-head", "lab-analyze"], "lab-analyze", devRoles)).toEqual(["admin"]);
    expect(toggleDevRoleSelection(["admin", "lab-head", "lab-analyze"], "lab-analyze", devRoles)).toEqual(["admin"]);
  });

  it("removing qc-staff removes QC-family dev roles and falls back to admin", () => {
    expect(toggleDevRoleSelection(["qc-head", "qc-staff"], "qc-staff", devRoles)).toEqual(["admin"]);
    expect(toggleDevRoleSelection(["admin", "qc-head", "qc-staff"], "qc-staff", devRoles)).toEqual(["admin"]);
  });

  it("removing lab-analyze removes Lab-family roles when its family is explicitly blank", () => {
    const roles: DevRoleOption[] = [
      { id: "admin", name: "Admin", family: "" },
      { id: "lab-head", name: "Lab Head", family: "lab" },
      { id: "lab-analyze", name: "Lab Analyze", family: "" },
    ];

    expect(toggleDevRoleSelection(["lab-head", "lab-analyze"], "lab-analyze", roles)).toEqual(["admin"]);
  });

  it("removing qc-staff removes QC-family roles when its family is explicitly blank", () => {
    const roles: DevRoleOption[] = [
      { id: "admin", name: "Admin", family: "" },
      { id: "qc-head", name: "QC Head", family: "qc" },
      { id: "qc-staff", name: "QC Staff", family: "" },
    ];

    expect(toggleDevRoleSelection(["qc-head", "qc-staff"], "qc-staff", roles)).toEqual(["admin"]);
  });

  it("falls back to admin when a selected family is missing its base role", () => {
    const withoutLabAnalyze = devRoles.filter((role) => role.id !== "lab-analyze");
    const withoutQcStaff = devRoles.filter((role) => role.id !== "qc-staff");

    expect(normalizeDevRoleSelection(["lab-head"], withoutLabAnalyze)).toEqual(["admin"]);
    expect(normalizeDevRoleSelection(["qc-head"], withoutQcStaff)).toEqual(["admin"]);
  });

  it("keeps an explicitly blank prefixed role without adding a base role", () => {
    const roles: DevRoleOption[] = [
      { id: "admin", name: "Admin", family: "" },
      { id: "lab-support", name: "Lab Support", family: "" },
      { id: "lab-analyze", name: "Lab Analyze", family: "lab" },
    ];

    expect(normalizeDevRoleSelection(["lab-support"], roles)).toEqual(["lab-support"]);
  });

  it("uses ID fallback when a prefixed role has no family metadata", () => {
    const roles: DevRoleOption[] = [
      { id: "admin", name: "Admin", family: "" },
      { id: "qc_support", name: "QC Support" },
      { id: "qc-staff", name: "QC Staff", family: "qc" },
    ];

    expect(normalizeDevRoleSelection(["qc_support"], roles)).toEqual(["qc_support", "qc-staff"]);
  });
});

describe("synthesizeDevAssignees", () => {
  it("returns the three lab dev roles as Lab/วิเคราะห์ monthly assignees", () => {
    const assignees = synthesizeDevAssignees();

    expect(assignees.map((a) => a.name)).toEqual([
      "Dev Lab Analyst",
      "Dev Lab Head",
      "Dev Lab Inventory",
    ]);
    for (const a of assignees) {
      expect(a.department).toBe("Lab/วิเคราะห์");
      expect(a.empType).toBe("รายเดือน");
      expect(a.isActive).toBe(true);
      expect(a.employeeId).toBeTruthy();
    }
  });

  it("uses a name that matches synthesizeDevUser so assigned petitions round-trip to the lab page", () => {
    // LabTestingPage filters by `assignedTo?.name === user?.name`, so the
    // assignee name must equal the synthesized dev user's name for that role.
    const assignees = synthesizeDevAssignees();
    const analyst = assignees.find((a) => a.position === "Lab Analyst");

    expect(analyst?.name).toBe(
      synthesizeDevUser([{ id: "lab-analyst", name: "Lab Analyst" }]).name,
    );
  });

  it("gives each dev assignee a unique employeeId that cannot collide with real numeric HR ids", () => {
    const ids = synthesizeDevAssignees().map((a) => a.employeeId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^DEV-/);
  });
});
