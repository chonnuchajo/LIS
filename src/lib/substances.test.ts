import { describe, it, expect } from "vitest";
import { parseSubstances, substanceKey, extractSubstanceName, matchSubstanceKey, substanceFieldKey } from "./substances";

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

  it("merges down to exactly 2 substances for 4 parts (with deterministic groupings)", () => {
    expect(parseSubstances("AAAA + BB + CCCC + DDDDDD")).toEqual([
      "AAAA + BB",
      "CCCC + DDDDDD",
    ]);
  });
});

describe("substanceKey", () => {
  it("lowercases the input", () => {
    expect(substanceKey("ABAMECTIN")).toBe("abamectin");
  });

  it("trims surrounding whitespace", () => {
    expect(substanceKey("  Anilofos  ")).toBe("anilofos");
  });

  it("handles mixed case and whitespace together", () => {
    expect(substanceKey("  Bispyribac-SODIUM ")).toBe("bispyribac-sodium");
  });
});

describe("extractSubstanceName", () => {
  it("returns the leading word", () => {
    expect(extractSubstanceName("ABAMECTIN 1.8% W/V EC (BROWN)")).toBe("ABAMECTIN");
  });
  it("returns the only word when no whitespace", () => {
    expect(extractSubstanceName("PROPANIL")).toBe("PROPANIL");
  });
  it("preserves hyphenated substance names", () => {
    expect(extractSubstanceName("BISPYRIBAC-SODIUM 10% SC")).toBe("BISPYRIBAC-SODIUM");
  });
  it("preserves leading product codes that contain a hyphen", () => {
    expect(extractSubstanceName("ABSORB-P SHK205N")).toBe("ABSORB-P");
  });
  it("returns empty string for empty/whitespace input", () => {
    expect(extractSubstanceName("")).toBe("");
    expect(extractSubstanceName("   ")).toBe("");
  });
  it("trims leading whitespace before taking the first token", () => {
    expect(extractSubstanceName("  CHLOROTHALONIL 50%")).toBe("CHLOROTHALONIL");
  });
});

describe("matchSubstanceKey", () => {
  it("reduces a spec string to its first-token lowercase key", () => {
    expect(matchSubstanceKey("ABAMECTIN 1.8% W/V EC")).toBe("abamectin");
  });
  it("trims and lowercases a bare name", () => {
    expect(matchSubstanceKey("  Imidacloprid ")).toBe("imidacloprid");
  });
  it("returns empty string for empty input", () => {
    expect(matchSubstanceKey("")).toBe("");
  });
  it("keeps the first token when given a parseSubstances-merged 'X + Y' slot", () => {
    // 3+ substance products: parseSubstances merges down to 2 slots, and a slot
    // may itself be a "X + Y" string. matchSubstanceKey reduces it to the first token.
    expect(matchSubstanceKey("Alpha + Beta")).toBe("alpha");
  });
});

describe("substanceFieldKey", () => {
  it("joins label and substance key with '::'", () => {
    expect(substanceFieldKey("ปริมาณสารสำคัญ", "ABAMECTIN 1.8% EC")).toBe(
      "ปริมาณสารสำคัญ::abamectin",
    );
  });
  it("produces a 'label::' key when the substance is empty", () => {
    expect(substanceFieldKey("pH", "")).toBe("pH::");
  });
  it("produces a '::key' key when the label is empty", () => {
    expect(substanceFieldKey("", "ABAMECTIN 1.8% EC")).toBe("::abamectin");
  });
});
