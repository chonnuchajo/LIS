import { describe, it, expect } from "vitest";
import { OPERATOR_OPTIONS, describeSubstanceStandard } from "./standardOperators";

describe("OPERATOR_OPTIONS", () => {
  it("includes a 'none' entry plus all 7 operators", () => {
    const values = OPERATOR_OPTIONS.map((o) => o.value);
    expect(values).toContain("none");
    expect(values).toEqual(
      expect.arrayContaining(["lt", "lte", "eq", "gte", "gt", "between", "tolerance"]),
    );
  });
});

describe("describeSubstanceStandard", () => {
  it("renders a simple operator with unit", () => {
    expect(
      describeSubstanceStandard({ substance: "X", operator: "gte", value: 95, value2: null }, "%"),
    ).toBe("≥ 95%");
  });
  it("renders between", () => {
    expect(
      describeSubstanceStandard({ substance: "X", operator: "between", value: 2, value2: 3 }, ""),
    ).toBe("2 - 3");
  });
  it("renders tolerance", () => {
    expect(
      describeSubstanceStandard({ substance: "X", operator: "tolerance", value: 100, value2: 5 }, "%"),
    ).toBe("100 ± 5%%");
  });
  it("returns empty string when value missing", () => {
    expect(
      describeSubstanceStandard({ substance: "X", operator: "gte", value: null, value2: null }, "%"),
    ).toBe("");
  });
});
