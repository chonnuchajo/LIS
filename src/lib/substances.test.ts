import { describe, it, expect } from "vitest";
import { parseSubstances } from "./substances";

describe("parseSubstances", () => {
  it("returns single substance unchanged", () => {
    expect(parseSubstances("ABAMECTIN")).toEqual(["ABAMECTIN"]);
  });

  it("trims whitespace", () => {
    expect(parseSubstances("  ABAMECTIN  ")).toEqual(["ABAMECTIN"]);
  });

  it("returns empty array for empty input", () => {
    expect(parseSubstances("")).toEqual([]);
  });

  it("splits two substances on plus", () => {
    expect(parseSubstances("ANILOFOS + BISPYRIBAC-SODIUM")).toEqual([
      "ANILOFOS",
      "BISPYRIBAC-SODIUM",
    ]);
  });

  it("filters out empty fragments", () => {
    expect(parseSubstances("ANILOFOS + + BISPYRIBAC-SODIUM")).toEqual([
      "ANILOFOS",
      "BISPYRIBAC-SODIUM",
    ]);
  });

  it("merges shortest fragment with shorter neighbor when 3+ parts", () => {
    // 3 parts: A(8) + B(3) + C(10) → B is shortest, neighbors A=8, C=10 → merge with A
    expect(parseSubstances("AAAAAAAA + BBB + CCCCCCCCCC")).toEqual([
      "AAAAAAAA + BBB",
      "CCCCCCCCCC",
    ]);
  });

  it("merges down to exactly 2 substances for 4+ parts", () => {
    const result = parseSubstances("AAAA + BB + CCCC + DDDDDD");
    expect(result).toHaveLength(2);
  });
});
