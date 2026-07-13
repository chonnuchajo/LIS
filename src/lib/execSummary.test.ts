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
});

describe("highlightPath", () => {
  it("builds a petition-list link carrying every id", () => {
    expect(highlightPath(["a", "b"])).toBe("/petitions?highlight=a,b");
  });

  it("returns the plain list when there is nothing to highlight", () => {
    expect(highlightPath([])).toBe("/petitions");
  });
});
