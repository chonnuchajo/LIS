import { describe, it, expect } from "vitest";
import {
  DASHBOARD_PROFILES, KPI_META, resolveProfileForRole, resolveActiveRole,
} from "./dashboardProfiles";

describe("resolveProfileForRole", () => {
  it("uses explicit Role.dashboardProfile when set", () => {
    const roles = [{ id: "qc", dashboardProfile: "qc-head" }];
    expect(resolveProfileForRole("qc", roles)).toBe("qc-head");
  });
  it("falls back to default map when unset", () => {
    const roles = [{ id: "qc", dashboardProfile: null }];
    expect(resolveProfileForRole("qc", roles)).toBe("qc-reviewer");
    expect(resolveProfileForRole("lab", [{ id: "lab" }])).toBe("lab-analyze");
    expect(resolveProfileForRole("admin", [{ id: "admin" }])).toBe("admin");
    expect(resolveProfileForRole("viewer", [{ id: "viewer" }])).toBe("viewer");
  });
  it("falls back by rank prefix then null (no real match)", () => {
    expect(resolveProfileForRole("qc-night", [{ id: "qc-night" }])).toBe("qc-reviewer");
    expect(resolveProfileForRole("lab_x", [{ id: "lab_x" }])).toBe("lab-analyze");
    expect(resolveProfileForRole("random", [{ id: "random" }])).toBeNull();
    expect(resolveProfileForRole("missing", [])).toBeNull();
  });
  it("explicit viewer role still resolves to the viewer dashboard, not null", () => {
    expect(resolveProfileForRole("viewer", [{ id: "viewer" }])).toBe("viewer");
  });
});

describe("resolveActiveRole", () => {
  it("keeps stored role when the user still holds it", () => {
    expect(resolveActiveRole(["lab", "qc"], "qc")).toBe("qc");
  });
  it("falls back to primaryRole when stored is absent/invalid", () => {
    expect(resolveActiveRole(["lab", "qc"], "admin")).toBe("qc"); // qc outranks lab
    expect(resolveActiveRole(["lab"], null)).toBe("lab");
    expect(resolveActiveRole([], null)).toBe("viewer");
  });
});

describe("registry integrity", () => {
  it("has all nine profiles and every profile's KPIs exist in KPI_META", () => {
    expect(Object.keys(DASHBOARD_PROFILES)).toHaveLength(9);
    for (const p of Object.values(DASHBOARD_PROFILES)) {
      for (const k of p.kpis) expect(KPI_META[k]).toBeDefined();
      expect(p.kpis.length).toBeGreaterThanOrEqual(2);
      expect(p.kpis.length).toBeLessThanOrEqual(6);
    }
  });
});
