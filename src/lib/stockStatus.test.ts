import { describe, it, expect } from "vitest";
import {
  isUsableBottle, usableBottleCount, standardLevel, solventLevel, glasswareLevel, summarizeStandard,
} from "./stockStatus";

const now = new Date("2026-07-07T00:00:00Z");
const mk = (o: Partial<{ status: string; exp: string | null }>) => ({ status: "active", exp: null, ...o });

describe("isUsableBottle", () => {
  it("active + no exp is usable", () => expect(isUsableBottle(mk({}), now)).toBe(true));
  it("active + future exp is usable", () => expect(isUsableBottle(mk({ exp: "2026-08-01" }), now)).toBe(true));
  it("expired is not usable", () => expect(isUsableBottle(mk({ exp: "2026-06-01" }), now)).toBe(false));
  it("empty/discarded not usable", () => {
    expect(isUsableBottle(mk({ status: "empty" }), now)).toBe(false);
    expect(isUsableBottle(mk({ status: "discarded" }), now)).toBe(false);
  });
});

describe("usableBottleCount", () => {
  it("counts only usable bottles across all", () => {
    const n = usableBottleCount(
      [mk({}), mk({ status: "empty" }), mk({ exp: "2026-06-01" }), mk({ exp: "2026-09-01" })],
      now,
    );
    expect(n).toBe(2);
  });
});

describe("standardLevel", () => {
  it("0 out, 1 low, 2+ ok", () => {
    expect(standardLevel(0)).toBe("out");
    expect(standardLevel(1)).toBe("low");
    expect(standardLevel(2)).toBe("ok");
  });
});

describe("solventLevel", () => {
  it("0 out, 1 low, 2+ ok", () => {
    expect(solventLevel(0)).toBe("out");
    expect(solventLevel(1)).toBe("low");
    expect(solventLevel(5)).toBe("ok");
  });
});

describe("glasswareLevel", () => {
  it("0 out, else ok (no low)", () => {
    expect(glasswareLevel(0)).toBe("out");
    expect(glasswareLevel(1)).toBe("ok");
    expect(glasswareLevel(99)).toBe("ok");
  });
});

describe("summarizeStandard", () => {
  it("counts usable / expired / expiringSoon", () => {
    const s = summarizeStandard(
      [mk({}), mk({ exp: "2026-07-20" }), mk({ exp: "2026-06-01" }), mk({ status: "discarded" })],
      now, 30,
    );
    expect(s).toEqual({ usable: 2, expired: 1, expiringSoon: 1 });
  });
});
