import { describe, it, expect } from "vitest";
import {
  normalizeKey,
  buildOverrideMap,
  normalizeCommonName,
} from "@/lib/commonNameOverride";

describe("normalizeKey", () => {
  it("trims, lowercases, and collapses whitespace", () => {
    expect(normalizeKey("  DIURON   +  HEXAZINONE  ")).toBe("diuron + hexazinone");
  });
});

describe("buildOverrideMap", () => {
  it("maps rawKey → canonical and skips incomplete rows", () => {
    const map = buildOverrideMap([
      { raw: "A 1% + B 2%", canonical: "B 2% + A 1%" },
      { raw: "", canonical: "x" },
      { raw: "y", canonical: "" },
    ]);
    expect(map.size).toBe(1);
    expect(map.get("a 1% + b 2%")).toBe("B 2% + A 1%");
  });
});

describe("normalizeCommonName", () => {
  const map = buildOverrideMap([
    { raw: "DIURON + HEXAZINONE 46.8% + 13.2% WG", canonical: "DIURON 13.2% + HEXAZINONE 46.8% WG" },
  ]);
  it("returns canonical on hit (case/space-insensitive)", () => {
    expect(normalizeCommonName("diuron  +  hexazinone 46.8% + 13.2% wg", map))
      .toBe("DIURON 13.2% + HEXAZINONE 46.8% WG");
  });
  it("returns trimmed raw on miss", () => {
    expect(normalizeCommonName("  GLYPHOSATE 48% SL  ", map)).toBe("GLYPHOSATE 48% SL");
  });
});
