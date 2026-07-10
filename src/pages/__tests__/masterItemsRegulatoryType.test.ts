import { describe, expect, it } from "vitest";
import { getMasterItemRegulatoryType } from "@/pages/MasterItems";

describe("getMasterItemRegulatoryType", () => {
  it("returns GMP when item names or trade name contain FDA/อย. markers", () => {
    expect(getMasterItemRegulatoryType({ item_name1: "สินค้า อ.ย." })).toBe("GMP");
    expect(getMasterItemRegulatoryType({ item_name2: "สูตร อย." })).toBe("GMP");
    expect(getMasterItemRegulatoryType({ trade_name: "CYPERMETHRIN (FDA)" })).toBe("GMP");
  });

  it("returns GMP when the common name contains a GMP marker", () => {
    expect(getMasterItemRegulatoryType({ common_name: "CYPERMETHRIN 10% EC (GMP)" })).toBe("GMP");
    expect(getMasterItemRegulatoryType({ commonName: "ไซเปอร์เมทริน 10% EC (GMP)" })).toBe("GMP");
  });

  it("returns BIO when non-front-name fields contain bio markers", () => {
    expect(getMasterItemRegulatoryType({ common_name: "CYPERMETHRIN 10% EC (BIO)" })).toBe("BIO");
    expect(getMasterItemRegulatoryType({ item_name2: "สูตรไบโอ" })).toBe("BIO");
    expect(getMasterItemRegulatoryType({ trade_name: "BIO FORMULA" })).toBe("BIO");
  });

  it("keeps GMP when BIO and GMP markers are both present", () => {
    expect(getMasterItemRegulatoryType({ common_name: "CYPERMETHRIN 10% EC (BIO, FDA)" })).toBe("BIO, GMP");
    expect(getMasterItemRegulatoryType({ commonName: "ไซเปอร์เมทริน 10% EC (ไบโอ, GMP)" })).toBe("BIO, GMP");
  });

  it("does not return BIO when only the front name contains bio markers", () => {
    expect(getMasterItemRegulatoryType({ item_name1: "ไบโอซิน" })).toBe("");
    expect(getMasterItemRegulatoryType({ itemName: "BIOZIN" })).toBe("");
  });

  it("returns LS when item names or trade name contain livestock markers", () => {
    expect(getMasterItemRegulatoryType({ item_name1: "ไซเปอร์เมทธิน ปศุสัตว์" })).toBe("LS");
    expect(getMasterItemRegulatoryType({ item_name2: "CYPERMETHRIN LIVESTOCK" })).toBe("LS");
    expect(getMasterItemRegulatoryType({ trade_name: "ยาปศุสัตว์ อย." })).toBe("LS, GMP");
  });
});
