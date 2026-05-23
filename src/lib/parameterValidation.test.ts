import { describe, it, expect } from "vitest";
import { isEnumAbnormal } from "./parameterValidation";
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
