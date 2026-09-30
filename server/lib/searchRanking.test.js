const { getSearchScore, rankSearchResults, buildSearchRankingStages } = require("./searchRanking");

describe("search ranking", () => {
  test("ranks exact codes, prefixes and leftmost substrings before names", () => {
    const rows = ["XXX", "XXRI", "ARI", "RIVER", "RI"].map((code) => ({ code, name: "RI" }));
    expect(rankSearchResults(rows, " ri ", (row) => ({ primary: [row.code], secondary: [row.name] })).map((row) => row.code))
      .toEqual(["RI", "RIVER", "ARI", "XXRI", "XXX"]);
    expect(getSearchScore("RI", { primary: ["X".repeat(10000) + "RI"] }))
      .toBeGreaterThan(getSearchScore("RI", { secondary: ["RI"] }));
  });

  test("keeps ties and empty searches stable without mutating inputs", () => {
    const rows = Object.freeze(["ARI", "RIVER", "RI001"]);
    expect(rankSearchResults(rows, "ri", (code) => ({ primary: [code] }))).toEqual(["RIVER", "RI001", "ARI"]);
    expect(rankSearchResults(rows, " ", () => { throw new Error("must not score"); })).toEqual(rows);
    expect(rows).toEqual(["ARI", "RIVER", "RI001"]);
  });

  test("builds DB score before default tie-break sort and removes internal score", () => {
    const stages = buildSearchRankingStages(" Ri ", { primary: ["code"], secondary: ["name", "items.batchNo"] }, { createdAt: -1 });
    expect(stages[0].$set.__searchScore).toBeDefined();
    expect(stages[1]).toEqual({ $sort: { __searchScore: -1, createdAt: -1, _id: 1 } });
    expect(stages[2]).toEqual({ $unset: "__searchScore" });
    expect(JSON.stringify(stages[0])).toContain("$isArray");
    expect(JSON.stringify(stages[0])).toContain("$items.batchNo");
  });

  test("treats user query as a literal, not an aggregation field or regex", () => {
    const stages = buildSearchRankingStages(" $CODE.* ", { primary: ["code"] }, { _id: -1 });
    expect(JSON.stringify(stages[0])).toContain(JSON.stringify({ $literal: "\\$code\\.\\*" }));
    expect(stages[1].$sort._id).toBe(-1);
    expect(getSearchScore(".*", { primary: ["ANY"] })).toBe(0);
  });

  test("keeps blank-query default DB ordering", () => {
    expect(buildSearchRankingStages("  ", {}, { createdAt: -1 })).toEqual([{ $sort: { createdAt: -1 } }]);
  });
});
