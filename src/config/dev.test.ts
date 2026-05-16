import { describe, it, expect } from "vitest";
import { synthesizeDevUser } from "./dev";

describe("synthesizeDevUser", () => {
  it("builds a dev AuthUser shape from a role id and name", () => {
    const user = synthesizeDevUser({ id: "qc", name: "QC Reviewer" });

    expect(user).toEqual({
      id: "dev-qc",
      email: "qc.dev@icpladda.com",
      name: "Dev QC Reviewer",
      role: "qc",
      permissions: [],
      department: "QC Reviewer",
      position: "QC Reviewer",
      status: "active",
    });
  });

  it("uses the role id (not name) in email and id fields so custom role names cannot break the email", () => {
    const user = synthesizeDevUser({ id: "custom-role", name: "ผู้ตรวจ" });

    expect(user.id).toBe("dev-custom-role");
    expect(user.email).toBe("custom-role.dev@icpladda.com");
    expect(user.role).toBe("custom-role");
    expect(user.name).toBe("Dev ผู้ตรวจ");
  });
});
