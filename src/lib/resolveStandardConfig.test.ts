import { describe, it, expect } from "vitest";
import { resolveStandardConfig } from "./resolveStandardConfig";
import type { StandardConfigDoc, StandardOverrideDoc } from "@/pages/standardConfig/types";

const cfg = (name: string, gcSlots: number[] = [], hplcSlots: number[] = []): StandardConfigDoc => ({
  _id: name,
  name,
  nameLower: name.toLowerCase(),
  isManual: false,
  gc: { enabled: gcSlots.length > 0, unit: "ml", slots: gcSlots },
  hplc: { enabled: hplcSlots.length > 0, unit: "ml", slots: hplcSlots },
});

const ovr = (
  partial: Partial<StandardOverrideDoc> & Pick<StandardOverrideDoc, "matchType" | "matchValue">
): StandardOverrideDoc => ({
  _id: `${partial.matchType}:${partial.matchValue}`,
  matchValueLower: partial.matchValue.toLowerCase(),
  scope: "substanceOnly",
  note: "",
  priority: 0,
  gc: { enabled: false, unit: "ml", slots: [] },
  hplc: { enabled: false, unit: "ml", slots: [] },
  ...partial,
});

describe("resolveStandardConfig", () => {
  it("returns 'none' when no config and no override matches", () => {
    const result = resolveStandardConfig("ABAMECTIN", 0, [], []);
    expect(result.source).toBe("none");
  });

  it("returns 'base' from StandardConfig keyed by parsed substance", () => {
    const result = resolveStandardConfig("ABAMECTIN", 0, [cfg("ABAMECTIN", [10, 12])], []);
    expect(result.source).toBe("base");
    expect(result.name).toBe("ABAMECTIN");
    expect(result.gc.slots).toEqual([10, 12]);
  });

  it("returns 'override' for exact commonName match (highest priority)", () => {
    const result = resolveStandardConfig(
      "ANILOFOS",
      0,
      [cfg("ANILOFOS", [10])],
      [ovr({ matchType: "commonName", matchValue: "ANILOFOS", priority: 1, gc: { enabled: true, unit: "ml", slots: [99] } })],
    );
    expect(result.source).toBe("override");
    expect(result.gc.slots).toEqual([99]);
  });

  it("prefers commonName match over substring match regardless of priority", () => {
    const result = resolveStandardConfig(
      "ANILOFOS",
      0,
      [],
      [
        ovr({ matchType: "substring", matchValue: "ani", priority: 100, gc: { enabled: true, unit: "ml", slots: [5] } }),
        ovr({ matchType: "commonName", matchValue: "ANILOFOS", priority: 1, gc: { enabled: true, unit: "ml", slots: [99] } }),
      ],
    );
    expect(result.gc.slots).toEqual([99]);
  });

  it("prefers substring over substance when both at same tier", () => {
    const result = resolveStandardConfig(
      "ANILOFOS",
      0,
      [],
      [
        ovr({ matchType: "substance", matchValue: "ANILOFOS", priority: 1, gc: { enabled: true, unit: "ml", slots: [50] } }),
        ovr({ matchType: "substring", matchValue: "ani", priority: 1, gc: { enabled: true, unit: "ml", slots: [5] } }),
      ],
    );
    expect(result.gc.slots).toEqual([5]);
  });

  it("substance override matches by exact substance at substanceIndex (case-insensitive)", () => {
    const result = resolveStandardConfig(
      "ANILOFOS + BISPYRIBAC-SODIUM",
      1,
      [],
      [ovr({ matchType: "substance", matchValue: "bispyribac-sodium", priority: 1, hplc: { enabled: true, unit: "ml", slots: [10] } })],
    );
    expect(result.source).toBe("override");
    expect(result.hplc.slots).toEqual([10]);
  });

  it("substring match is case-insensitive", () => {
    const result = resolveStandardConfig(
      "ANILOFOS",
      0,
      [],
      [ovr({ matchType: "substring", matchValue: "ANI", priority: 1, gc: { enabled: true, unit: "ml", slots: [5] } })],
    );
    expect(result.source).toBe("override");
  });

  it("among overrides at same tier, higher priority wins", () => {
    const result = resolveStandardConfig(
      "ANILOFOS",
      0,
      [],
      [
        ovr({ matchType: "substring", matchValue: "ani", priority: 1, gc: { enabled: true, unit: "ml", slots: [1] } }),
        ovr({ matchType: "substring", matchValue: "ilo", priority: 10, gc: { enabled: true, unit: "ml", slots: [10] } }),
      ],
    );
    expect(result.gc.slots).toEqual([10]);
  });
});
