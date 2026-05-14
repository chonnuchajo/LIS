import { describe, it, expect } from "vitest";
import { userCanAccessPath } from "./accessControl";

const groups = [
  { id: "samples", paths: ["/petitions", "/petitions/:id", "/send-sample"] },
  { id: "reports", paths: ["/report"] },
  { id: "others", paths: [] },
];

describe("userCanAccessPath", () => {
  it("lets admin access any path", () => {
    const user = { role: "admin", status: "active" as const, permissions: [] };
    expect(userCanAccessPath(user, "/anything", groups)).toBe(true);
  });

  it("grants access when the exact path is in permissions", () => {
    const user = { role: "lab", status: "active" as const, permissions: ["/report"] };
    expect(userCanAccessPath(user, "/report", groups)).toBe(true);
  });

  it("denies a path that is not in permissions", () => {
    const user = { role: "lab", status: "active" as const, permissions: ["/report"] };
    expect(userCanAccessPath(user, "/send-sample", groups)).toBe(false);
  });

  it("matches a pattern path entry against a concrete pathname", () => {
    const user = { role: "lab", status: "active" as const, permissions: ["/petitions/:id"] };
    expect(userCanAccessPath(user, "/petitions/123", groups)).toBe(true);
  });

  it("honors a legacy group-id entry by granting all its paths", () => {
    const user = { role: "lab", status: "active" as const, permissions: ["samples"] };
    expect(userCanAccessPath(user, "/send-sample", groups)).toBe(true);
  });

  it("does not let a legacy group-id entry leak into other groups", () => {
    const user = { role: "lab", status: "active" as const, permissions: ["samples"] };
    expect(userCanAccessPath(user, "/report", groups)).toBe(false);
  });

  it("legacy 'others' entry grants paths not covered by any other group", () => {
    const user = { role: "lab", status: "active" as const, permissions: ["others"] };
    expect(userCanAccessPath(user, "/unmapped-page", groups)).toBe(true);
  });

  it("legacy 'others' entry does not grant a path covered by another group", () => {
    const user = { role: "lab", status: "active" as const, permissions: ["others"] };
    expect(userCanAccessPath(user, "/report", groups)).toBe(false);
  });

  it("denies an inactive user even with a matching path", () => {
    const user = { role: "lab", status: "inactive" as const, permissions: ["/report"] };
    expect(userCanAccessPath(user, "/report", groups)).toBe(false);
  });

  it("denies a user with no role", () => {
    const user = { status: "active" as const, permissions: ["/report"] };
    expect(userCanAccessPath(user, "/report", groups)).toBe(false);
  });

  it("denies a user with empty permissions", () => {
    const user = { role: "lab", status: "active" as const, permissions: [] };
    expect(userCanAccessPath(user, "/report", groups)).toBe(false);
  });

  it("denies a null user", () => {
    expect(userCanAccessPath(null, "/report", groups)).toBe(false);
  });
});
