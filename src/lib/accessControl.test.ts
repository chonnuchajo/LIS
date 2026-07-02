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
      { id: "results", paths: ["/record-results"] },
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

    it("does NOT grant /petitions/assign through the dynamic petition detail route", () => {
      const user = { role: "lab", status: "active" as const, permissions: ["/petitions/:id"] };
      expect(userCanAccessPath(user, "/petitions/assign", navGroups)).toBe(false);
    });

    it("grants the lab testing detail page when /lab-testing is granted", () => {
      const user = { role: "lab", status: "active" as const, permissions: ["/lab-testing"] };
      expect(userCanAccessPath(user, "/lab-testing/abc", navGroups)).toBe(true);
    });

    it("grants result detail from /record-results without granting petition detail", () => {
      const user = { role: "lab", status: "active" as const, permissions: ["/record-results"] };
      expect(userCanAccessPath(user, "/record-results/abc", navGroups)).toBe(true);
      expect(userCanAccessPath(user, "/petitions/abc", navGroups)).toBe(false);
    });

    it("'others' does not grant a sub-page already covered by its parent's group", () => {
      const user = { role: "lab", status: "active" as const, permissions: ["others"] };
      expect(userCanAccessPath(user, "/petitions/123", navGroups)).toBe(false);
    });
  });

  describe("daily-check rooms", () => {
    const navGroups = [
      { id: "ops", paths: ["/daily-check"] },
      { id: "others", paths: [] },
    ];

    it("grants every room sub-page when /daily-check is granted", () => {
      const user = { role: "lab", status: "active" as const, permissions: ["/daily-check"] };
      expect(userCanAccessPath(user, "/daily-check/balance", navGroups)).toBe(true);
      expect(userCanAccessPath(user, "/daily-check/sample-prep", navGroups)).toBe(true);
      expect(userCanAccessPath(user, "/daily-check/analysis", navGroups)).toBe(true);
      expect(userCanAccessPath(user, "/daily-check/extraction", navGroups)).toBe(true);
      expect(userCanAccessPath(user, "/daily-check/records", navGroups)).toBe(true);
    });

    it("denies room sub-pages when /daily-check is not granted", () => {
      const user = { role: "lab", status: "active" as const, permissions: ["/report"] };
      expect(userCanAccessPath(user, "/daily-check/balance", navGroups)).toBe(false);
    });
  });

  it("grants a restricted tab when its exact virtual path is in permissions", () => {
    const user = { role: "lab", status: "active" as const, permissions: ["/settings/dashboard"] };
    expect(userCanAccessPath(user, "/settings/dashboard", groups)).toBe(true);
  });

  it("does not grant a restricted tab from the parent page permission alone", () => {
    const user = { role: "lab", status: "active" as const, permissions: ["/settings"] };
    expect(userCanAccessPath(user, "/settings/dashboard", groups)).toBe(false);
  });

  it("does not let 'others' grant a restricted tab", () => {
    const user = { role: "lab", status: "active" as const, permissions: ["others"] };
    expect(userCanAccessPath(user, "/settings/dashboard", groups)).toBe(false);
  });

  it("still lets 'others' grant a non-restricted in-page path", () => {
    const user = { role: "lab", status: "active" as const, permissions: ["others"] };
    expect(userCanAccessPath(user, "/settings/printers", groups)).toBe(true);
  });
});

describe("userCanAccessPath with multiple roles", () => {
  it("admin via roles[] bypasses all checks", () => {
    const user = { roles: ["lab", "admin"], status: "active" as const, permissions: [] };
    expect(userCanAccessPath(user, "/anything", groups)).toBe(true);
  });

  it("treats roles[] of lab the same as legacy role lab", () => {
    const user = { roles: ["lab"], status: "active" as const, permissions: ["/report"] };
    expect(userCanAccessPath(user, "/report", groups)).toBe(true);
  });

  it("denies when neither role nor roles is set", () => {
    const user = { status: "active" as const, permissions: ["/report"] };
    expect(userCanAccessPath(user, "/report", groups)).toBe(false);
  });
});
