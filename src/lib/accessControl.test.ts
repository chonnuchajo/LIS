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

  describe("public pages", () => {
    it("lets any signed-in user reach the scanner and queue TV pages without permissions", () => {
      const user = { role: "viewer", status: "active" as const, permissions: [] };
      expect(userCanAccessPath(user, "/scanner", groups)).toBe(true);
      expect(userCanAccessPath(user, "/queue/lab", groups)).toBe(true);
      expect(userCanAccessPath(user, "/queue/qc", groups)).toBe(true);
    });

    it("still blocks an inactive account from public pages", () => {
      const user = { role: "viewer", status: "inactive" as const, permissions: [] };
      expect(userCanAccessPath(user, "/scanner", groups)).toBe(false);
    });

    it("does not treat a non-public page as open", () => {
      const user = { role: "viewer", status: "active" as const, permissions: [] };
      expect(userCanAccessPath(user, "/queue", groups)).toBe(false);
    });
  });

  describe("implied sub-pages", () => {
    // Granting a parent nav page should ride along to its detail/sub pages.
    const navGroups = [
      { id: "petitions", paths: ["/petitions"] },
      { id: "lab", paths: ["/petitions/assign", "/lab-testing"] },
      { id: "others", paths: [] },
    ];

    it("grants the petition detail page when /petitions is granted", () => {
      const user = { role: "lab", status: "active" as const, permissions: ["/petitions"] };
      expect(userCanAccessPath(user, "/petitions/123", navGroups)).toBe(true);
    });

    it("grants new/edit petition sub-pages when /petitions is granted", () => {
      const user = { role: "lab", status: "active" as const, permissions: ["/petitions"] };
      expect(userCanAccessPath(user, "/petitions/new", navGroups)).toBe(true);
      expect(userCanAccessPath(user, "/petitions/123/edit", navGroups)).toBe(true);
    });

    it("grants sub-pages through a legacy group-id entry", () => {
      const user = { role: "lab", status: "active" as const, permissions: ["petitions"] };
      expect(userCanAccessPath(user, "/petitions/123", navGroups)).toBe(true);
    });

    it("does NOT grant /petitions/assign (a separately-managed nav page) via /petitions", () => {
      const user = { role: "lab", status: "active" as const, permissions: ["/petitions"] };
      expect(userCanAccessPath(user, "/petitions/assign", navGroups)).toBe(false);
    });

    it("grants the lab testing detail page when /lab-testing is granted", () => {
      const user = { role: "lab", status: "active" as const, permissions: ["/lab-testing"] };
      expect(userCanAccessPath(user, "/lab-testing/abc", navGroups)).toBe(true);
    });

    it("'others' does not grant a sub-page already covered by its parent's group", () => {
      const user = { role: "lab", status: "active" as const, permissions: ["others"] };
      expect(userCanAccessPath(user, "/petitions/123", navGroups)).toBe(false);
    });
  });
});
