import { describe, it, expect } from "vitest";
import {
  DOC_NUMBER_TYPES,
  DOC_NUMBER_DEFAULTS,
  buildPreview,
  validateDocNumberConfig,
} from "./documentNumberConfig";

const JUNE_2026 = new Date(2026, 5, 15);

describe("buildPreview", () => {
  it("renders the legacy petition format", () => {
    expect(buildPreview(DOC_NUMBER_DEFAULTS.petition, JUNE_2026)).toBe("P-2606-0043");
  });
  it("renders 4-digit year receipt format", () => {
    expect(buildPreview(DOC_NUMBER_DEFAULTS.sampleReceipt, JUNE_2026)).toBe("RCV-2026-0043");
  });
  it("respects empty separator and padding", () => {
    expect(
      buildPreview({ prefix: "P", yearFormat: "yy", includeMonth: true, separator: "", seqPadding: 6 }, JUNE_2026),
    ).toBe("P2606000043");
  });
});

describe("validateDocNumberConfig", () => {
  it("rejects no prefix + no year", () => {
    expect(validateDocNumberConfig({ prefix: " ", yearFormat: "none", includeMonth: true, separator: "-", seqPadding: 4 }))
      .toMatch(/prefix หรือปี|ใส่เดือน/);
  });
  it("accepts prefix only", () => {
    expect(validateDocNumberConfig({ prefix: "P", yearFormat: "none", includeMonth: false, separator: "-", seqPadding: 4 }))
      .toBeNull();
  });
  it("rejects padding out of range", () => {
    expect(validateDocNumberConfig({ prefix: "P", yearFormat: "yy", includeMonth: true, separator: "-", seqPadding: 0 }))
      .toMatch(/จำนวนหลัก/);
  });
  it("rejects month-only (no year + includeMonth)", () => {
    expect(validateDocNumberConfig({ prefix: "P", yearFormat: "none", includeMonth: true, separator: "-", seqPadding: 4 }))
      .toMatch(/ใส่เดือน ต้องเลือกปีด้วย/);
  });
});

describe("DOC_NUMBER_TYPES", () => {
  it("covers all three docTypes", () => {
    expect(DOC_NUMBER_TYPES.map((t) => t.docType)).toEqual(["petition", "sampleReceipt", "labRequest"]);
  });
});
