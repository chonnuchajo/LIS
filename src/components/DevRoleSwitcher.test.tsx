import { describe, expect, it } from "vitest";
import { preserveDevSwitcherAnchorPosition } from "./devRoleSwitcherPosition";

describe("preserveDevSwitcherAnchorPosition", () => {
  it("keeps the DEV MODE badge in place when collapsing shrinks the switcher", () => {
    expect(
      preserveDevSwitcherAnchorPosition(
        { x: 8, y: 20 },
        { x: 40, y: 20 },
        { x: 8, y: 20 },
      ),
    ).toEqual({ x: 40, y: 20 });
  });

  it("keeps the default viewport-anchored position responsive", () => {
    expect(
      preserveDevSwitcherAnchorPosition(
        null,
        { x: 40, y: 20 },
        { x: 8, y: 20 },
      ),
    ).toBeNull();
  });
});
