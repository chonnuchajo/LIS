import { describe, expect, it } from "vitest";

import { buildMasterCommonNameRows } from "./MasterItems";

describe("buildMasterCommonNameRows", () => {
  it("keeps the full plus-formula medicine common name alongside split ingredients", () => {
    const rows = buildMasterCommonNameRows([
      {
        originalItemNo: "FG-001",
        rawCommonName: "DIURON 80% WP + HEXAZINONE 13.2% SL",
        item: {
          item_no: "FG-001",
          item_name1: "ยาสูตรผสม",
          common_name: "DIURON 80% WP + HEXAZINONE 13.2% SL",
        },
      },
    ]);

    expect(rows.map((row) => row.commonName)).toEqual([
      "DIURON 80% WP",
      "DIURON 80% WP + HEXAZINONE 13.2% SL",
      "HEXAZINONE 13.2% SL",
    ]);
    expect(rows.find((row) => row.commonName.includes(" + "))?.itemNos).toEqual(["FG-001"]);
  });
});
