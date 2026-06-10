import { describe, it, expect } from "vitest";
import {
  DASHBOARD_IDS,
  sectionCatalog,
  defaultLayout,
  resolveSections,
  resolveKpis,
  resolveLayoutForRoles,
  DEFAULT_ROLE_ID,
  type StoredLayout,
} from "./dashboardLayout";

describe("dashboardLayout catalog", () => {
  it("lists both dashboards", () => {
    expect(DASHBOARD_IDS).toEqual(["lab", "qc"]);
  });

  it("default layout has all sections enabled in catalog order", () => {
    const layout = defaultLayout("lab");
    expect(layout.sections.map((s) => s.id)).toEqual([
      "header",
      "kpi",
      "primaryTable",
      "rightRail",
      "completed",
    ]);
    expect(layout.sections.every((s) => s.enabled)).toBe(true);
    expect(layout.kpis).toEqual({ all: true, waiting: true, inProgress: true, completed: true });
  });

  it("rightRail label differs by dashboard", () => {
    const lab = sectionCatalog("lab").find((s) => s.id === "rightRail");
    const qc = sectionCatalog("qc").find((s) => s.id === "rightRail");
    expect(lab?.label).not.toEqual(qc?.label);
  });
});

describe("resolveSections", () => {
  it("re-inserts sections missing from a partial config", () => {
    const out = resolveSections("qc", { sections: [{ id: "kpi", enabled: false, order: 5 }] });
    expect(out.map((s) => s.id).sort()).toEqual(
      ["completed", "header", "kpi", "primaryTable", "rightRail"].sort(),
    );
    expect(out.find((s) => s.id === "kpi")?.enabled).toBe(false);
  });

  it("forces header and primaryTable enabled even if stored false", () => {
    const out = resolveSections("lab", {
      sections: [
        { id: "header", enabled: false, order: 0 },
        { id: "primaryTable", enabled: false, order: 1 },
      ],
    });
    expect(out.find((s) => s.id === "header")?.enabled).toBe(true);
    expect(out.find((s) => s.id === "primaryTable")?.enabled).toBe(true);
  });

  it("keeps header first and normalizes order to contiguous", () => {
    const out = resolveSections("lab", {
      sections: [
        { id: "completed", enabled: true, order: 0 },
        { id: "header", enabled: true, order: 9 },
        { id: "primaryTable", enabled: true, order: 1 },
      ],
    });
    expect(out[0].id).toBe("header");
    expect(out.map((s) => s.order)).toEqual([0, 1, 2, 3, 4]);
  });

  it("falls back to all-enabled when config is null", () => {
    const out = resolveSections("qc", null);
    expect(out.every((s) => s.enabled)).toBe(true);
  });
});

describe("resolveKpis", () => {
  it("defaults missing kpi flags to true", () => {
    expect(resolveKpis({ kpis: { waiting: false } })).toEqual({
      all: true,
      waiting: false,
      inProgress: true,
      completed: true,
    });
  });
});

describe("resolveLayoutForRoles", () => {
  const mk = (roleId: string, kpiAll: boolean): StoredLayout => ({
    dashboard: "qc",
    roleId,
    sections: defaultLayout("qc").sections,
    kpis: { all: kpiAll, waiting: true, inProgress: true, completed: true },
  });

  it("uses the first matching role in array order", () => {
    const configs = [mk("roleB", false), mk("roleA", true)];
    const layout = resolveLayoutForRoles("qc", configs, ["roleA", "roleB"]);
    expect(layout.kpis.all).toBe(true);
  });

  it("falls back to _default when no role matches", () => {
    const configs = [mk(DEFAULT_ROLE_ID, false)];
    const layout = resolveLayoutForRoles("qc", configs, ["unknown"]);
    expect(layout.kpis.all).toBe(false);
  });

  it("falls back to catalog default when nothing stored", () => {
    const layout = resolveLayoutForRoles("qc", [], ["unknown"]);
    expect(layout.kpis.all).toBe(true);
    expect(layout.sections.every((s) => s.enabled)).toBe(true);
  });
});
