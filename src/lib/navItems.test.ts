import { describe, expect, it } from "vitest";
import { NAV_ITEMS } from "./navItems";

describe("NAV_ITEMS", () => {
  it("does not expose separate lab or qc dashboard links in the main nav", () => {
    expect(NAV_ITEMS.map((item) => item.path)).not.toContain("/dashboard/lab");
    expect(NAV_ITEMS.map((item) => item.path)).not.toContain("/dashboard/qc");
  });

  it("exposes the petition list page in the main nav", () => {
    expect(NAV_ITEMS.map((item) => item.path)).toContain("/petition");
  });

  it("no longer exposes the retired /petitions list or timeline path in the main nav", () => {
    const paths = NAV_ITEMS.map((item) => item.path);
    expect(paths).not.toContain("/petitions");
    expect(paths).not.toContain("/petition-timeline");
  });

  it("restores the prior labels for the approval queues", () => {
    const labelsByPath = Object.fromEntries(
      NAV_ITEMS.map((item) => [item.path, item.label]),
    );

    expect(labelsByPath["/qc-approval"]).toBe("อนุมัติผล QC");
    expect(labelsByPath["/lab-approval"]).toBe("อนุมัติผล Lab");
  });
});
