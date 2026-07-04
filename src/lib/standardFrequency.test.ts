import { describe, it, expect } from "vitest";
import {
  FREQUENCY_UNITS,
  FREQUENCY_PRESETS,
  parseFrequency,
  formatFrequency,
  isPreset,
} from "./standardFrequency";

describe("parseFrequency", () => {
  it("parses canonical lowercase values", () => {
    expect(parseFrequency("1/1 week")).toEqual({ count: 1, unit: "week" });
    expect(parseFrequency("1/6 month")).toEqual({ count: 6, unit: "month" });
  });

  it("is case-insensitive (legacy capitalized data)", () => {
    expect(parseFrequency("1/1 Week")).toEqual({ count: 1, unit: "week" });
    expect(parseFrequency("1/4 Month")).toEqual({ count: 4, unit: "month" });
    expect(parseFrequency("1/1 Day")).toEqual({ count: 1, unit: "day" });
  });

  it("tolerates a trailing plural and extra spacing", () => {
    expect(parseFrequency("1/2 months")).toEqual({ count: 2, unit: "month" });
    expect(parseFrequency("  1 / 3  week ")).toEqual({ count: 3, unit: "week" });
  });

  it("ignores the numerator (denominator is the interval)", () => {
    expect(parseFrequency("2/3 day")).toEqual({ count: 3, unit: "day" });
  });

  it("returns null for empty or unparseable input", () => {
    expect(parseFrequency("")).toBeNull();
    expect(parseFrequency("weekly")).toBeNull();
    expect(parseFrequency("1/1 year")).toBeNull();
    expect(parseFrequency("1/0 week")).toBeNull();
  });

  it("parses every legacy seed value", () => {
    for (const v of ["1/1 Day", "1/1 Week", "1/1 Month", "1/2 Month", "1/3 Month", "1/6 Month", "1/4 Month"]) {
      expect(parseFrequency(v)).not.toBeNull();
    }
  });
});

describe("formatFrequency", () => {
  it("builds the canonical 1/N unit string", () => {
    expect(formatFrequency(1, "week")).toBe("1/1 week");
    expect(formatFrequency(6, "month")).toBe("1/6 month");
    expect(formatFrequency(3, "day")).toBe("1/3 day");
  });
});

describe("isPreset", () => {
  it("recognizes all six presets, case-insensitively", () => {
    for (const p of FREQUENCY_PRESETS) expect(isPreset(p)).toBe(true);
    expect(isPreset("1/1 Day")).toBe(true);
    expect(isPreset("1/2 Month")).toBe(true);
  });

  it("rejects non-presets and empties", () => {
    expect(isPreset("1/4 month")).toBe(false);
    expect(isPreset("1/2 week")).toBe(false);
    expect(isPreset("")).toBe(false);
  });
});

describe("round-trip", () => {
  it("parse → format returns each preset unchanged", () => {
    for (const p of FREQUENCY_PRESETS) {
      const parsed = parseFrequency(p)!;
      expect(formatFrequency(parsed.count, parsed.unit)).toBe(p);
    }
  });

  it("exposes the three units", () => {
    expect(FREQUENCY_UNITS).toEqual(["day", "week", "month"]);
  });
});
