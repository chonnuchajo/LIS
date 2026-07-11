import { describe, expect, it } from "vitest";
import { NAV_ITEMS } from "./navItems";

describe("NAV_ITEMS", () => {
  it("does not expose separate lab or qc dashboard links in the main nav", () => {
    expect(NAV_ITEMS.map((item) => item.path)).not.toContain("/dashboard/lab");
    expect(NAV_ITEMS.map((item) => item.path)).not.toContain("/dashboard/qc");
  });
});
