import { describe, expect, it } from "vitest";
import { formatMinutes, highlightPath } from "./execSummary";

describe("formatMinutes", () => {
  it("shows minutes only under an hour", () => {
    expect(formatMinutes(45)).toBe("45 น.");
  });

  it("shows hours and minutes under a day", () => {
    expect(formatMinutes(380)).toBe("6 ชม. 20 น.");
  });

  it("drops the minute part when it lands on a whole hour", () => {
    expect(formatMinutes(120)).toBe("2 ชม.");
  });

  it("switches to days once past 24 hours", () => {
    expect(formatMinutes(3060)).toBe("2 วัน 3 ชม.");
  });

  it("floors anything under a minute to zero", () => {
    expect(formatMinutes(0.4)).toBe("0 น.");
  });

  it("switches to whole days with no trailing hours when the remainder is exact", () => {
    expect(formatMinutes(2880)).toBe("2 วัน");
  });

  it("renders an em dash for null (no baseline/no data), not zero", () => {
    expect(formatMinutes(null)).toBe("—");
  });

  it("renders an em dash for undefined, not NaN garbage", () => {
    expect(formatMinutes(undefined)).toBe("—");
  });

  it("renders an em dash for NaN", () => {
    expect(formatMinutes(NaN)).toBe("—");
  });

  it("still renders a real zero as 0 น., not an em dash", () => {
    expect(formatMinutes(0)).toBe("0 น.");
  });
});

describe("highlightPath", () => {
  it("builds a petition-list link carrying every id", () => {
    expect(highlightPath(["a", "b"])).toBe("/petitions?highlight=a,b");
  });

  it("returns the plain list when there is nothing to highlight", () => {
    expect(highlightPath([])).toBe("/petitions");
  });
});
