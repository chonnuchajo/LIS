import { describe, it, expect } from "vitest";
import { buildSimpleMethodRows } from "@/pages/MasterItems";
import { buildOverrideMap } from "@/lib/commonNameOverride";

describe("buildSimpleMethodRows with common-name overrides", () => {
  it("merges malformed + well-formed variants into one canonical row", () => {
    const items = [
      { item_no: "A1", common_name: "DIURON + HEXAZINONE 46.8% + 13.2% WG" },
      { item_no: "A2", common_name: "DIURON 46.8%+HEXAZINONE 13.2% WG" },
    ];
    const cnMap = buildOverrideMap([
      { raw: "DIURON + HEXAZINONE 46.8% + 13.2% WG", canonical: "DIURON 13.2% + HEXAZINONE 46.8% WG" },
      { raw: "DIURON 46.8%+HEXAZINONE 13.2% WG", canonical: "DIURON 13.2% + HEXAZINONE 46.8% WG" },
    ]);
    const rows = buildSimpleMethodRows(items, {}, cnMap);
    expect(rows).toHaveLength(1);
    expect(rows[0].commonName).toBe("DIURON 13.2% + HEXAZINONE 46.8% WG");
    expect(rows[0].substances).toEqual(["DIURON 13.2%", "HEXAZINONE 46.8% WG"]);
    expect([...rows[0].itemNos].sort()).toEqual(["A1", "A2"]);
    expect([...rows[0].rawCommonNames].sort()).toEqual([
      "DIURON + HEXAZINONE 46.8% + 13.2% WG",
      "DIURON 46.8%+HEXAZINONE 13.2% WG",
    ]);
  });

  it("leaves unmapped names unchanged", () => {
    const items = [{ item_no: "B1", common_name: "GLYPHOSATE 48% SL" }];
    const rows = buildSimpleMethodRows(items, {}, new Map());
    expect(rows[0].commonName).toBe("GLYPHOSATE 48% SL");
    expect(rows[0].rawCommonNames).toEqual(["GLYPHOSATE 48% SL"]);
  });
});
