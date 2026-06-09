import { describe, it, expect } from "vitest";
import { synthesizeDevUser, synthesizeDevAssignees } from "./dev";

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

  it("derives the primary (highest-priority) role when given several, and keeps all in roles[]", () => {
    const user = synthesizeDevUser([
      { id: "lab", name: "Lab" },
      { id: "qc", name: "QC" },
    ]);

    // qc outranks lab → primary is qc
    expect(user.role).toBe("qc");
    expect(user.roles).toEqual(["lab", "qc"]);
    expect(user.id).toBe("dev-qc");
    expect(user.name).toBe("Dev QC");
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
