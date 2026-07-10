import { describe, expect, it } from "vitest";
import { buildMasterItemSearchText } from "@/pages/MasterItems";

describe("buildMasterItemSearchText", () => {
  it("includes common-name variants and hidden detail fields", () => {
    const text = buildMasterItemSearchText({
      item: {
        item_no: "FG-001",
        item_name1: "Product visible name",
        common_name_th: "ไซเปอร์เมทธิน",
        common_name_eng: "CYPERMETHRIN 10% W/V EC",
        remark: "hidden stability note",
        default_location: "LDI-WH-A",
      },
      originalItemNo: "FG-001-RAW",
      rawCommonName: "CYPERMETHRIN RAW",
      displayCommonName: "CYPERMETHRIN CANONICAL",
    });

    expect(text).toContain("ไซเปอร์เมทธิน");
    expect(text).toContain("cypermethrin 10% w/v ec");
    expect(text).toContain("cypermethrin raw");
    expect(text).toContain("cypermethrin canonical");
    expect(text).toContain("hidden stability note");
    expect(text).toContain("ldi-wh-a");
  });
});
