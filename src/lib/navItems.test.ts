import { describe, expect, it } from "vitest";
import { NAV_ITEMS, PAGE_ITEMS } from "./navItems";

describe("NAV_ITEMS", () => {
  it("does not expose separate lab or qc dashboard links in the main nav", () => {
    expect(NAV_ITEMS.map((item) => item.path)).not.toContain("/dashboard/lab");
    expect(NAV_ITEMS.map((item) => item.path)).not.toContain("/dashboard/qc");
  });

  it("exposes the petition list page in the main nav", () => {
    expect(NAV_ITEMS.map((item) => item.path)).toContain("/petition");
  });

  it("exposes Assign Lab under the current petition route", () => {
    expect(
      NAV_ITEMS.some(
        (item) => item.path === "/petition/assign" && item.label === "Assign Lab",
      ),
    ).toBe(true);
    expect(PAGE_ITEMS.some((item) => item.path === "/petition/assign")).toBe(true);
  });

  it("includes COA Center in the sidebar and detail page registry", () => {
    expect(
      NAV_ITEMS.some(
        (item) => item.path === "/coa" && item.label === "ออกเอกสาร COA",
      ),
    ).toBe(true);
    expect(PAGE_ITEMS.some((item) => item.path === "/coa/:id")).toBe(true);
  });

  it("includes Full spec in the main nav", () => {
    expect(
      NAV_ITEMS.some((item) => item.path === "/full-spec" && item.label === "Full spec"),
    ).toBe(true);
  });

  it("no longer exposes the retired /petitions list or timeline path in the main nav", () => {
    const paths = NAV_ITEMS.map((item) => item.path);
    expect(paths).not.toContain("/petitions");
    expect(paths).not.toContain("/petition-timeline");
  });

  it("uses /petitions/new as the canonical new petition page path", () => {
    const pagePaths = PAGE_ITEMS.map((item) => item.path);
    expect(pagePaths).toContain("/petitions/new");
    expect(pagePaths).not.toContain("/petitions-old");
    expect(pagePaths).not.toContain("/petitions-old/assign");
    expect(pagePaths).not.toContain("/petitions-old/new");
    expect(pagePaths).not.toContain("/petitions-old/:id");
    expect(pagePaths).not.toContain("/petitions-old/:id/edit");
  });

  it("restores the prior labels for the approval queues", () => {
    const labelsByPath = Object.fromEntries(
      NAV_ITEMS.map((item) => [item.path, item.label]),
    );

    expect(labelsByPath["/qc-approval"]).toBe("อนุมัติผล QC");
    expect(labelsByPath["/lab-approval"]).toBe("อนุมัติผล Lab");
  });
});
