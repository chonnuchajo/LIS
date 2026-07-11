import { describe, it, expect } from "vitest";
import {
  DASHBOARD_PROFILES, KPI_META, resolveProfileForRole, resolveActiveRole, resolveDashboardRole,
  labInventorySummaryPlacement,
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
    expect(resolveProfileForRole("qc-staff", [{ id: "qc-staff" }])).toBe("qc-staff");
    expect(resolveProfileForRole("qc-head", [{ id: "qc-head" }])).toBe("qc-head");
    expect(resolveProfileForRole("lab-head", [{ id: "lab-head" }])).toBe("lab-head");
    expect(resolveProfileForRole("lab-inventory", [{ id: "lab-inventory" }])).toBe("lab-inventory");
    expect(resolveProfileForRole("lab-data-config", [{ id: "lab-data-config" }])).toBe("lab-config");
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
    expect(resolveActiveRole(["lab", "qc"], "admin")).toBe("qc");
    expect(resolveActiveRole(["lab"], null)).toBe("lab");
    expect(resolveActiveRole([], null)).toBe("viewer");
  });
});

describe("resolveDashboardRole", () => {
  it("prefers admin over base working roles", () => {
    expect(resolveDashboardRole(["lab-head", "lab-analyze", "admin"])).toBe("admin");
    expect(resolveDashboardRole(["qc-head", "qc-staff", "admin"])).toBe("admin");
  });

  it("uses lab-analyze as the home profile when Lab higher roles include it", () => {
    expect(resolveDashboardRole(["lab-head", "lab-analyze"])).toBe("lab-analyze");
    expect(resolveDashboardRole(["lab-inventory", "lab-analyze"])).toBe("lab-analyze");
  });

  it("uses qc-staff as the home profile when QC higher roles include it", () => {
    expect(resolveDashboardRole(["qc-head", "qc-staff"])).toBe("qc-staff");
    expect(resolveDashboardRole(["qc-data-config", "qc-staff"])).toBe("qc-staff");
  });

  it("falls back to the existing primary role behavior when no base working role is present", () => {
    expect(resolveDashboardRole(["lab-head"])).toBe("lab-head");
    expect(resolveDashboardRole(["lab", "qc"])).toBe("qc");
    expect(resolveDashboardRole([])).toBe("viewer");
  });
});

describe("Lab Inventory summary placement", () => {
  it("places the summary at the top when Lab Inventory is the primary dashboard", () => {
    expect(labInventorySummaryPlacement(["lab-inventory"], "lab-inventory")).toBe("top");
  });

  it("places the summary below another primary dashboard when Lab Inventory is also held", () => {
    expect(labInventorySummaryPlacement(["lab-analyze", "lab-inventory"], "lab-analyze")).toBe("bottom");
    expect(labInventorySummaryPlacement(["lab-head", "lab-inventory"], "lab-head")).toBe("bottom");
  });

  it("hides the summary when the user does not hold Lab Inventory", () => {
    expect(labInventorySummaryPlacement(["lab-analyze"], "lab-analyze")).toBe("hidden");
    expect(labInventorySummaryPlacement(["qc-staff"], "qc-staff")).toBe("hidden");
    expect(labInventorySummaryPlacement([], null)).toBe("hidden");
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

  it("lab analyze profile uses the focused worklist dashboard config", () => {
    expect(DASHBOARD_PROFILES["lab-analyze"].kpis).toEqual(["assignedToMe", "inProgress", "completedToday"]);
    expect(DASHBOARD_PROFILES["lab-analyze"].workflow).toBeNull();
    expect(DASHBOARD_PROFILES["lab-analyze"].analytics).toEqual([
      { kind: "assignedWeekdayBar", title: "งานที่ถูก assign ตามวัน" },
    ]);
  });

  it("qc staff profile uses the requested receiving-to-approval dashboard config", () => {
    expect(DASHBOARD_PROFILES["qc-staff"].kpis).toEqual([
      "waitingReceive",
      "inProgress",
      "waitingReview",
      "approvedToday",
    ]);
    expect(KPI_META.waitingReceive.label).toBe("งานรอรับ");
    expect(KPI_META.inProgress.label).toBe("กำลังดำเนินการ");
    expect(KPI_META.waitingReview.label).toBe("รอตรวจ");
    expect(KPI_META.approvedToday.label).toBe("เสร็จวันนี้");
    expect(DASHBOARD_PROFILES["qc-staff"].workflow).toBe("assignedWeekdayBar");
  });
});
