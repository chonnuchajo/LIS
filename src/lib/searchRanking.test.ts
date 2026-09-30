import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { getSearchScore, rankSearchResults } from "./searchRanking";

const serverRanking = createRequire(import.meta.url)("../../server/lib/searchRanking.js") as { getSearchScore: typeof getSearchScore };

describe("search ranking", () => {
  const codes = ["XXRI001", "ARI001", "RIVER", "RI001", "RI"];
  const fields = (code: string) => ({ primary: [code] });

  it("ranks exact, prefixes, then left-to-right code positions for Ri", () => {
    expect(rankSearchResults(codes, "Ri", fields)).toEqual(["RI", "RIVER", "RI001", "ARI001", "XXRI001"]);
  });

  it("puts matching code prefixes before description matches for R", () => {
    const rows = [
      { code: "F-ABMTK-1000X12", name: "RIVER (BROWN)" },
      ...codes.map((code) => ({ code, name: "" })),
    ];
    expect(rankSearchResults(rows, "R", (row) => ({ primary: [row.code], secondary: [row.name] })).map((row) => row.code))
      .toEqual(["RIVER", "RI001", "RI", "ARI001", "XXRI001", "F-ABMTK-1000X12"]);
  });

  it("gives even late code matches precedence over an exact name", () => {
    expect(getSearchScore("Ri", { primary: ["X".repeat(10000) + "RI"] }))
      .toBeGreaterThan(getSearchScore("Ri", { secondary: ["Ri"] }));
  });

  it("uses earliest occurrence, including repeated matches", () => {
    expect(getSearchScore("ri", fields("ARIRI"))).toBeGreaterThan(getSearchScore("ri", fields("AARI")));
  });

  it("counts Unicode characters rather than UTF-16 code units for positions", () => {
    expect(getSearchScore("ri", fields("😀RI"))).toBe(getSearchScore("ri", fields("ARI")));
  });

  it("ranks secondary exact, prefix and substring matches", () => {
    expect(rankSearchResults(["XXRI", "ARI", "RIVER", "RI"], "ri", (name) => ({ secondary: [name] })))
      .toEqual(["RI", "RIVER", "ARI", "XXRI"]);
  });

  it("handles Thai text, whitespace, case, numeric codes and missing values", () => {
    expect(getSearchScore(" ri ", { primary: [null, undefined, " RI "] })).toBe(getSearchScore("RI", fields("ri")));
    expect(getSearchScore("12", { primary: [123] })).toBeGreaterThan(0);
    expect(rankSearchResults(["รายการยา", "ยา", "ยาสามัญ"], "ยา", fields)).toEqual(["ยา", "ยาสามัญ", "รายการยา"]);
    expect(getSearchScore("missing", { primary: [null, undefined] })).toBe(0);
  });

  it("uses best alias without rewarding duplicate fields", () => {
    expect(getSearchScore("RI", { primary: ["XXRI", "RI"] })).toBe(getSearchScore("RI", fields("RI")));
    expect(getSearchScore("RI", { secondary: ["RI", "RI"] })).toBe(getSearchScore("RI", { secondary: ["RI"] }));
  });

  it("keeps ties stable and does not mutate input", () => {
    const input = Object.freeze(["ARI", "RIVER", "RI001"]);
    expect(rankSearchResults(input, "ri", fields)).toEqual(["RIVER", "RI001", "ARI"]);
    expect(input).toEqual(["ARI", "RIVER", "RI001"]);
  });

  it("keeps default order for empty queries without reading fields", () => {
    const noFields = () => { throw new Error("empty search must not score rows"); };
    expect(rankSearchResults(codes, "", noFields)).toEqual(codes);
    expect(rankSearchResults(codes, "  ", noFields)).toEqual(codes);
    expect(getSearchScore("", fields(""))).toBe(0);
  });

  it("preserves rows accepted by existing filters", () => {
    expect(rankSearchResults(["XYZ", "RI"], "ri", fields)).toEqual(["RI", "XYZ"]);
    expect(rankSearchResults([], "ri", fields)).toEqual([]);
  });

  it("scores each row once and ranks complete results before pagination", () => {
    let calls = 0;
    const sorted = rankSearchResults(codes, "ri", (code) => { calls += 1; return fields(code); });
    expect(calls).toBe(codes.length);
    expect(sorted.slice(0, 2)).toEqual(["RI", "RIVER"]);
  });

  it("uses identical scoring in browser and API implementations", () => {
    for (const query of ["R", "Ri", " ri ", "ยา", "😀", "å", "[", ".*", ""]) {
      for (const code of ["RIVER", "RI", "ARI", "XXRI", "ยา", "รายการยา", "😀RI", "ÅRI", null, 12, ".*"]) {
        const values = { primary: [code], secondary: ["RIVER"] };
        expect(getSearchScore(query, values)).toBe(serverRanking.getSearchScore(query, values));
      }
    }
  });
});
