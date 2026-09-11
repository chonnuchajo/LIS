import { describe, it, expect } from "vitest";
import {
  tabsFor,
  configurableTabsFor,
  tabPath,
  denyToken,
  isTabDenied,
  PAGES_WITH_TABS,
} from "./tabRegistry";

describe("tabRegistry", () => {
  it("returns [] for a page with no registered tabs", () => {
    expect(tabsFor("/nope")).toEqual([]);
  });

  it("configurableTabsFor drops adminOnly tabs", () => {
    const keys = configurableTabsFor("/settings").map((t) => t.key);
    expect(keys).toContain("dashboard");
    expect(keys).not.toContain("line");
  });

  it("tabsFor keeps adminOnly tabs", () => {
    expect(tabsFor("/settings").map((t) => t.key)).toContain("line");
  });

  it("stock deduction has no tab registry", () => {
    expect(tabsFor("/stock-deduction")).toEqual([]);
    expect(PAGES_WITH_TABS).not.toContain("/stock-deduction");
  });

  it("stock includes the six month medicine list tab", () => {
    expect(tabsFor("/stock").map((tab) => tab.key)).toContain("medicine-six-months");
  });

  it("builds tab + deny tokens", () => {
    expect(tabPath("/stock", "history")).toBe("/stock/history");
    expect(denyToken("/stock", "history")).toBe("deny:/stock/history");
  });

  it("isTabDenied reflects token presence", () => {
    expect(isTabDenied(["deny:/stock/history"], "/stock", "history")).toBe(true);
    expect(isTabDenied([], "/stock", "history")).toBe(false);
    expect(isTabDenied(["/stock"], "/stock", "history")).toBe(false);
  });

  it("PAGES_WITH_TABS lists the registered pages", () => {
    expect(PAGES_WITH_TABS).toEqual(
      expect.arrayContaining(["/stock", "/settings", "/report", "/admin-data"]),
    );
  });
});
