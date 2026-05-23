import { describe, it, expect } from "vitest";
import { isEnumAbnormal, isNumericAbnormal, isFieldAbnormal } from "./parameterValidation";
import type { ParameterValueField } from "./api";

const makeField = (overrides: Partial<ParameterValueField>): ParameterValueField => ({
  label: "test",
  type: "enum",
  options: ["ดี", "ปานกลาง", "แย่"],
  expectedValues: [],
  ...overrides,
});

describe("isEnumAbnormal", () => {
  it("returns false for non-enum field types", () => {
    const field = makeField({ type: "text", expectedValues: ["x"] });
    expect(isEnumAbnormal(field, "anything")).toBe(false);
  });

  it("returns false when expectedValues is empty (no check configured)", () => {
    const field = makeField({ expectedValues: [] });
    expect(isEnumAbnormal(field, "แย่")).toBe(false);
  });

  it("returns false when expectedValues is undefined", () => {
    const field = makeField({ expectedValues: undefined });
    expect(isEnumAbnormal(field, "แย่")).toBe(false);
  });

  it("returns false for empty/null value (not entered yet)", () => {
    const field = makeField({ expectedValues: ["ดี"] });
    expect(isEnumAbnormal(field, "")).toBe(false);
    expect(isEnumAbnormal(field, null)).toBe(false);
    expect(isEnumAbnormal(field, undefined)).toBe(false);
  });

  it("returns false when value is in expectedValues (single)", () => {
    const field = makeField({ expectedValues: ["ดี"] });
    expect(isEnumAbnormal(field, "ดี")).toBe(false);
  });

  it("returns true when value is NOT in expectedValues (single)", () => {
    const field = makeField({ expectedValues: ["ดี"] });
    expect(isEnumAbnormal(field, "แย่")).toBe(true);
  });

  it("returns false when value matches any expectedValue (multi)", () => {
    const field = makeField({ expectedValues: ["ดี", "ปานกลาง"] });
    expect(isEnumAbnormal(field, "ดี")).toBe(false);
    expect(isEnumAbnormal(field, "ปานกลาง")).toBe(false);
  });

  it("returns true when value matches none of expectedValues (multi)", () => {
    const field = makeField({ expectedValues: ["ดี", "ปานกลาง"] });
    expect(isEnumAbnormal(field, "แย่")).toBe(true);
  });

  it("coerces non-string values to string for comparison", () => {
    const field = makeField({ options: ["1", "2"], expectedValues: ["1"] });
    expect(isEnumAbnormal(field, 1)).toBe(false);
    expect(isEnumAbnormal(field, 2)).toBe(true);
  });
});

const makeNum = (overrides: Partial<ParameterValueField>): ParameterValueField => ({
  label: "ph",
  type: "number",
  unit: "%",
  standardValue: 5,
  standardOperator: undefined,
  standardValue2: null,
  ...overrides,
});

describe("isNumericAbnormal", () => {
  it("returns false for non-numeric types", () => {
    const field: ParameterValueField = {
      label: "x", type: "enum", standardValue: 5, standardOperator: "eq",
    };
    expect(isNumericAbnormal(field, 10)).toBe(false);
  });

  it("returns false when operator is undefined (no check)", () => {
    const field = makeNum({ standardOperator: undefined });
    expect(isNumericAbnormal(field, 999)).toBe(false);
  });

  it("returns false when standardValue is null", () => {
    const field = makeNum({ standardOperator: "eq", standardValue: null });
    expect(isNumericAbnormal(field, 5)).toBe(false);
  });

  it("returns false for empty/null/undefined value", () => {
    const field = makeNum({ standardOperator: "eq", standardValue: 5 });
    expect(isNumericAbnormal(field, "")).toBe(false);
    expect(isNumericAbnormal(field, null)).toBe(false);
    expect(isNumericAbnormal(field, undefined)).toBe(false);
  });

  it("returns false for NaN value", () => {
    const field = makeNum({ standardOperator: "eq", standardValue: 5 });
    expect(isNumericAbnormal(field, "abc")).toBe(false);
  });

  it("coerces numeric string to number", () => {
    const field = makeNum({ standardOperator: "eq", standardValue: 5 });
    expect(isNumericAbnormal(field, "5")).toBe(false);
    expect(isNumericAbnormal(field, "6")).toBe(true);
  });

  describe("operator: lt (<)", () => {
    const field = makeNum({ standardOperator: "lt", standardValue: 5 });
    it("normal when value < standard", () => expect(isNumericAbnormal(field, 4)).toBe(false));
    it("abnormal when value == standard", () => expect(isNumericAbnormal(field, 5)).toBe(true));
    it("abnormal when value > standard", () => expect(isNumericAbnormal(field, 6)).toBe(true));
  });

  describe("operator: lte (<=)", () => {
    const field = makeNum({ standardOperator: "lte", standardValue: 5 });
    it("normal when value < standard", () => expect(isNumericAbnormal(field, 4)).toBe(false));
    it("normal when value == standard", () => expect(isNumericAbnormal(field, 5)).toBe(false));
    it("abnormal when value > standard", () => expect(isNumericAbnormal(field, 6)).toBe(true));
  });

  describe("operator: eq (=)", () => {
    const field = makeNum({ standardOperator: "eq", standardValue: 5 });
    it("normal when value == standard", () => expect(isNumericAbnormal(field, 5)).toBe(false));
    it("abnormal when value < standard", () => expect(isNumericAbnormal(field, 4)).toBe(true));
    it("abnormal when value > standard", () => expect(isNumericAbnormal(field, 6)).toBe(true));
  });

  describe("operator: gte (>=)", () => {
    const field = makeNum({ standardOperator: "gte", standardValue: 5 });
    it("abnormal when value < standard", () => expect(isNumericAbnormal(field, 4)).toBe(true));
    it("normal when value == standard", () => expect(isNumericAbnormal(field, 5)).toBe(false));
    it("normal when value > standard", () => expect(isNumericAbnormal(field, 6)).toBe(false));
  });

  describe("operator: gt (>)", () => {
    const field = makeNum({ standardOperator: "gt", standardValue: 5 });
    it("abnormal when value < standard", () => expect(isNumericAbnormal(field, 4)).toBe(true));
    it("abnormal when value == standard", () => expect(isNumericAbnormal(field, 5)).toBe(true));
    it("normal when value > standard", () => expect(isNumericAbnormal(field, 6)).toBe(false));
  });

  describe("operator: between", () => {
    const field = makeNum({
      standardOperator: "between", standardValue: 4, standardValue2: 6,
    });
    it("normal at lower bound", () => expect(isNumericAbnormal(field, 4)).toBe(false));
    it("normal in range", () => expect(isNumericAbnormal(field, 5)).toBe(false));
    it("normal at upper bound", () => expect(isNumericAbnormal(field, 6)).toBe(false));
    it("abnormal below lower", () => expect(isNumericAbnormal(field, 3.99)).toBe(true));
    it("abnormal above upper", () => expect(isNumericAbnormal(field, 6.01)).toBe(true));
    it("returns false when standardValue2 missing", () => {
      const bad = makeNum({ standardOperator: "between", standardValue: 4, standardValue2: null });
      expect(isNumericAbnormal(bad, 10)).toBe(false);
    });
  });

  describe("operator: tolerance", () => {
    const field = makeNum({
      standardOperator: "tolerance", standardValue: 100, standardValue2: 5,
    });
    it("normal at center", () => expect(isNumericAbnormal(field, 100)).toBe(false));
    it("normal at +5% boundary", () => expect(isNumericAbnormal(field, 105)).toBe(false));
    it("normal at -5% boundary", () => expect(isNumericAbnormal(field, 95)).toBe(false));
    it("abnormal above tolerance", () => expect(isNumericAbnormal(field, 105.01)).toBe(true));
    it("abnormal below tolerance", () => expect(isNumericAbnormal(field, 94.99)).toBe(true));
    it("returns false when standardValue2 missing", () => {
      const bad = makeNum({ standardOperator: "tolerance", standardValue: 100, standardValue2: null });
      expect(isNumericAbnormal(bad, 200)).toBe(false);
    });
    it("returns false when standardValue2 <= 0", () => {
      const bad = makeNum({ standardOperator: "tolerance", standardValue: 100, standardValue2: 0 });
      expect(isNumericAbnormal(bad, 200)).toBe(false);
    });
    it("uses absolute value of center for tolerance calc (negative center)", () => {
      const neg = makeNum({ standardOperator: "tolerance", standardValue: -10, standardValue2: 10 });
      expect(isNumericAbnormal(neg, -10)).toBe(false);
      expect(isNumericAbnormal(neg, -9)).toBe(false);
      expect(isNumericAbnormal(neg, -8.99)).toBe(true);
    });
  });
});

describe("isFieldAbnormal", () => {
  it("returns true when enum is abnormal", () => {
    const field: ParameterValueField = {
      label: "e", type: "enum",
      options: ["ดี", "แย่"], expectedValues: ["ดี"],
    };
    expect(isFieldAbnormal(field, "แย่")).toBe(true);
    expect(isFieldAbnormal(field, "ดี")).toBe(false);
  });

  it("returns true when numeric is abnormal", () => {
    const field = makeNum({ standardOperator: "lte", standardValue: 5 });
    expect(isFieldAbnormal(field, 6)).toBe(true);
    expect(isFieldAbnormal(field, 4)).toBe(false);
  });

  it("returns false for text fields", () => {
    const field: ParameterValueField = { label: "t", type: "text" };
    expect(isFieldAbnormal(field, "anything")).toBe(false);
  });
});
