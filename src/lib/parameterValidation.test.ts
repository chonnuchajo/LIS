import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isEnumAbnormal,
  isNumericAbnormal,
  isFieldAbnormal,
  countAbnormalInResults,
  timerDurationMs,
  timerRemainingMs,
  isTimerDone,
  partsToSec,
  secToParts,
  formatTimerHuman,
  findSubstanceStandard,
  isSubstanceAbnormal,
  expandFieldForItem,
  evalCondition,
  resolveStandard,
  resolveFieldStandard,
  getEntryValues,
  fieldValueList,
} from "./parameterValidation";
import type { ParameterItem, ParameterValueField } from "./api";
import type { QCTestResult } from "@/types/petition.types";
import type { ConditionContext } from "./parameterValidation";

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

describe("countAbnormalInResults", () => {
  const enumField: ParameterValueField = {
    label: "สถานะ", type: "enum",
    options: ["ปกติ", "ผิดปกติ"], expectedValues: ["ปกติ"],
  };
  const numField: ParameterValueField = {
    label: "pH", type: "number", unit: "%",
    standardOperator: "between", standardValue: 4, standardValue2: 6,
  };
  const param: ParameterItem = {
    _id: "p1", name: "ทดสอบ", valueFields: [enumField, numField],
  };
  const param2: ParameterItem = {
    _id: "p2", name: "อีกอัน", valueFields: [enumField],
  };

  const result = (parameterId: string, values: Record<string, unknown>): QCTestResult => ({
    petitionId: "x", itemSeq: 1, parameterId, values,
  });

  it("returns 0 for empty inputs", () => {
    expect(countAbnormalInResults([], [param])).toBe(0);
    expect(countAbnormalInResults([result("p1", {})], [])).toBe(0);
  });

  it("returns 0 when all values are normal", () => {
    const results = [result("p1", { "สถานะ": "ปกติ", "pH": 5 })];
    expect(countAbnormalInResults(results, [param])).toBe(0);
  });

  it("counts a single abnormal enum", () => {
    const results = [result("p1", { "สถานะ": "ผิดปกติ", "pH": 5 })];
    expect(countAbnormalInResults(results, [param])).toBe(1);
  });

  it("counts a single abnormal numeric", () => {
    const results = [result("p1", { "สถานะ": "ปกติ", "pH": 99 })];
    expect(countAbnormalInResults(results, [param])).toBe(1);
  });

  it("counts both abnormal fields in same result", () => {
    const results = [result("p1", { "สถานะ": "ผิดปกติ", "pH": 99 })];
    expect(countAbnormalInResults(results, [param])).toBe(2);
  });

  it("counts across multiple results & parameters", () => {
    const results = [
      result("p1", { "สถานะ": "ผิดปกติ", "pH": 5 }),
      result("p2", { "สถานะ": "ผิดปกติ" }),
      result("p1", { "สถานะ": "ปกติ", "pH": 100 }),
    ];
    expect(countAbnormalInResults(results, [param, param2])).toBe(3);
  });

  it("ignores result with unknown parameterId", () => {
    const results = [result("unknown", { "สถานะ": "ผิดปกติ" })];
    expect(countAbnormalInResults(results, [param])).toBe(0);
  });

  it("ignores empty/unfilled fields (not yet entered)", () => {
    const results = [result("p1", { "สถานะ": "", "pH": null })];
    expect(countAbnormalInResults(results, [param])).toBe(0);
  });

  it("handles parameter without valueFields", () => {
    const bare: ParameterItem = { _id: "p3", name: "เปล่า" };
    const results = [result("p3", { x: "y" })];
    expect(countAbnormalInResults(results, [bare])).toBe(0);
  });

  it("counts per-substance abnormals via composite keys", () => {
    const p = {
      _id: "ps",
      name: "active",
      valueFields: [subField],
    } as unknown as ParameterItem;
    const r = {
      parameterId: "ps",
      itemSeq: 1,
      values: {
        "ปริมาณสารสำคัญ::abamectin": 90,      // < 95 → abnormal
        "ปริมาณสารสำคัญ::imidacloprid": 95,   // within 90-100 → normal
      },
    } as unknown as QCTestResult;
    expect(countAbnormalInResults([r], [p])).toBe(1);
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

const makeTimer = (overrides: Partial<ParameterValueField>): ParameterValueField => ({
  label: "incubation",
  type: "timer",
  timerDurationSec: 1800,
  timerUnit: "minute",
  ...overrides,
});

describe("timerDurationMs", () => {
  it("returns null for non-timer types", () => {
    const f: ParameterValueField = { label: "x", type: "number", timerDurationSec: 1800, timerUnit: "minute" };
    expect(timerDurationMs(f)).toBeNull();
  });

  it("returns null when durationSec is null/0/negative", () => {
    expect(timerDurationMs(makeTimer({ timerDurationSec: null }))).toBeNull();
    expect(timerDurationMs(makeTimer({ timerDurationSec: 0 }))).toBeNull();
    expect(timerDurationMs(makeTimer({ timerDurationSec: -5 }))).toBeNull();
  });

  it("converts sec to ms", () => {
    expect(timerDurationMs(makeTimer({ timerDurationSec: 1800 }))).toBe(1_800_000);
    expect(timerDurationMs(makeTimer({ timerDurationSec: 7200 }))).toBe(7_200_000);
    expect(timerDurationMs(makeTimer({ timerDurationSec: 86400 }))).toBe(86_400_000);
    expect(timerDurationMs(makeTimer({ timerDurationSec: 2592000 }))).toBe(2_592_000_000);
  });
});

describe("timerRemainingMs", () => {
  const FIXED_NOW = new Date("2026-05-23T15:30:00Z").getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null when field has no duration", () => {
    const f = makeTimer({ timerDurationSec: null });
    expect(timerRemainingMs(f, new Date(FIXED_NOW).toISOString())).toBeNull();
  });

  it("returns full duration when startedAt is null/undefined", () => {
    const f = makeTimer({ timerDurationSec: 1800 });
    expect(timerRemainingMs(f, null)).toBe(1_800_000);
    expect(timerRemainingMs(f, undefined)).toBe(1_800_000);
  });

  it("computes remaining when partially elapsed", () => {
    const startedAt = new Date(FIXED_NOW - 5 * 60_000).toISOString();
    const f = makeTimer({ timerDurationSec: 1800 });
    expect(timerRemainingMs(f, startedAt)).toBe(25 * 60_000);
  });

  it("returns 0 when fully elapsed (clamped, not negative)", () => {
    const startedAt = new Date(FIXED_NOW - 31 * 60_000).toISOString();
    const f = makeTimer({ timerDurationSec: 1800 });
    expect(timerRemainingMs(f, startedAt)).toBe(0);
  });

  it("returns null for invalid ISO string", () => {
    const f = makeTimer({ timerDurationSec: 1800 });
    expect(timerRemainingMs(f, "not-a-date")).toBeNull();
  });
});

describe("isTimerDone", () => {
  const FIXED_NOW = new Date("2026-05-23T15:30:00Z").getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false when not started", () => {
    const f = makeTimer({});
    expect(isTimerDone(f, null)).toBe(false);
  });

  it("returns false when still running", () => {
    const startedAt = new Date(FIXED_NOW - 5 * 60_000).toISOString();
    const f = makeTimer({ timerDurationSec: 1800 });
    expect(isTimerDone(f, startedAt)).toBe(false);
  });

  it("returns true when fully elapsed", () => {
    const startedAt = new Date(FIXED_NOW - 60 * 60_000).toISOString();
    const f = makeTimer({ timerDurationSec: 1800 });
    expect(isTimerDone(f, startedAt)).toBe(true);
  });

  it("returns true at exact boundary", () => {
    const startedAt = new Date(FIXED_NOW - 30 * 60_000).toISOString();
    const f = makeTimer({ timerDurationSec: 1800 });
    expect(isTimerDone(f, startedAt)).toBe(true);
  });
});

describe("partsToSec", () => {
  it("returns 0 for empty parts", () => {
    expect(partsToSec({})).toBe(0);
  });

  it("computes seconds only", () => {
    expect(partsToSec({ seconds: 45 })).toBe(45);
  });

  it("computes minutes + seconds", () => {
    expect(partsToSec({ minutes: 1, seconds: 30 })).toBe(90);
  });

  it("computes hour + minute + second", () => {
    expect(partsToSec({ hours: 1, minutes: 30, seconds: 45 })).toBe(5445);
  });

  it("computes day + lower parts", () => {
    expect(partsToSec({ days: 1, hours: 1, minutes: 1, seconds: 1 })).toBe(90061);
  });

  it("computes month + lower parts (30-day month)", () => {
    expect(partsToSec({
      months: 1, days: 2, hours: 3, minutes: 4, seconds: 5,
    })).toBe(1 * 2592000 + 2 * 86400 + 3 * 3600 + 4 * 60 + 5);
  });

  it("treats undefined fields as 0", () => {
    expect(partsToSec({ hours: 2 })).toBe(7200);
  });
});

describe("secToParts", () => {
  it("zero seconds returns zeroed parts for hour unit", () => {
    expect(secToParts(0, "hour")).toEqual({ hours: 0, minutes: 0, seconds: 0 });
  });

  it("90 sec + minute unit → 1m 30s", () => {
    expect(secToParts(90, "minute")).toEqual({ minutes: 1, seconds: 30 });
  });

  it("5445 sec + hour unit → 1h 30m 45s", () => {
    expect(secToParts(5445, "hour")).toEqual({ hours: 1, minutes: 30, seconds: 45 });
  });

  it("90061 sec + day unit → 1d 1h 1m 1s", () => {
    expect(secToParts(90061, "day")).toEqual({
      days: 1, hours: 1, minutes: 1, seconds: 1,
    });
  });

  it("2592000 sec + month unit → 1mo 0d 0h 0m 0s", () => {
    expect(secToParts(2592000, "month")).toEqual({
      months: 1, days: 0, hours: 0, minutes: 0, seconds: 0,
    });
  });

  it("5445 sec + day unit redistributes (no day component)", () => {
    expect(secToParts(5445, "day")).toEqual({
      days: 0, hours: 1, minutes: 30, seconds: 45,
    });
  });

  it("negative seconds clamps to 0", () => {
    expect(secToParts(-100, "hour")).toEqual({ hours: 0, minutes: 0, seconds: 0 });
  });

  it("fractional seconds are floored", () => {
    expect(secToParts(90.7, "minute")).toEqual({ minutes: 1, seconds: 30 });
  });

  it("roundtrip: secToParts → partsToSec returns same value", () => {
    const sec = 90061;
    const parts = secToParts(sec, "day");
    expect(partsToSec(parts)).toBe(sec);
  });
});

describe("formatTimerHuman", () => {
  it("0 → '0 วินาที'", () => {
    expect(formatTimerHuman(0)).toBe("0 วินาที");
  });

  it("60 → '1 นาที'", () => {
    expect(formatTimerHuman(60)).toBe("1 นาที");
  });

  it("3600 → '1 ชม'", () => {
    expect(formatTimerHuman(3600)).toBe("1 ชม");
  });

  it("3661 → '1 ชม 1 นาที 1 วินาที'", () => {
    expect(formatTimerHuman(3661)).toBe("1 ชม 1 นาที 1 วินาที");
  });

  it("5445 → '1 ชม 30 นาที 45 วินาที'", () => {
    expect(formatTimerHuman(5445)).toBe("1 ชม 30 นาที 45 วินาที");
  });

  it("90061 → '1 วัน 1 ชม 1 นาที 1 วินาที'", () => {
    expect(formatTimerHuman(90061)).toBe("1 วัน 1 ชม 1 นาที 1 วินาที");
  });

  it("2592000 (30 days) → '1 เดือน'", () => {
    expect(formatTimerHuman(2592000)).toBe("1 เดือน");
  });

  it("skips zero parts", () => {
    expect(formatTimerHuman(3600 + 45)).toBe("1 ชม 45 วินาที");
  });
});

const subField: ParameterValueField = {
  label: "ปริมาณสารสำคัญ",
  type: "number",
  unit: "%",
  substanceMode: true,
  substanceStandards: [
    { substance: "ABAMECTIN", operator: "gte", value: 95, value2: null },
    { substance: "IMIDACLOPRID", operator: "between", value: 90, value2: 100 },
  ],
};

describe("findSubstanceStandard", () => {
  it("matches by first-token, case-insensitive, ignoring form spec", () => {
    expect(findSubstanceStandard(subField, "abamectin 1.8% w/v ec")?.value).toBe(95);
  });
  it("returns undefined when no substance matches", () => {
    expect(findSubstanceStandard(subField, "GLYPHOSATE")).toBeUndefined();
  });
});

describe("isSubstanceAbnormal", () => {
  it("flags a value below a gte standard", () => {
    const std = findSubstanceStandard(subField, "ABAMECTIN");
    expect(isSubstanceAbnormal(subField, std, 90)).toBe(true);
    expect(isSubstanceAbnormal(subField, std, 96)).toBe(false);
  });
  it("never flags when there is no standard", () => {
    expect(isSubstanceAbnormal(subField, undefined, 0)).toBe(false);
  });
});

describe("expandFieldForItem", () => {
  it("returns the field unchanged for non-substance fields", () => {
    const plain: ParameterValueField = { label: "pH", type: "number" };
    const units = expandFieldForItem(plain, "ABAMECTIN");
    expect(units).toHaveLength(1);
    expect(units[0].key).toBe("pH");
    expect(units[0].field).toBe(plain);
  });

  it("expands one unit per substance with injected standard + composite key", () => {
    const units = expandFieldForItem(subField, "ABAMECTIN + IMIDACLOPRID");
    expect(units).toHaveLength(2);
    expect(units[0].key).toBe("ปริมาณสารสำคัญ::abamectin");
    expect(units[0].field.label).toBe("ปริมาณสารสำคัญ — ABAMECTIN");
    expect(units[0].field.standardOperator).toBe("gte");
    expect(units[0].field.standardValue).toBe(95);
    expect(units[0].field.substanceMode).toBe(false);
  });

  it("expands substances with no standard (no operator → no validation)", () => {
    const units = expandFieldForItem(subField, "GLYPHOSATE");
    expect(units).toHaveLength(1);
    expect(units[0].field.standardOperator).toBeUndefined();
  });

  it("falls back to a single plain unit when commonName is empty", () => {
    const units = expandFieldForItem(subField, "");
    expect(units).toHaveLength(1);
    expect(units[0].key).toBe("ปริมาณสารสำคัญ");
  });
});

const ctx = (sameParam: Record<string, unknown>, otherParams: Record<string, Record<string, unknown>> = {}): ConditionContext =>
  ({ sameParam, otherParams });

describe("evalCondition", () => {
  it("eq matches enum string from sibling field", () => {
    expect(evalCondition(
      { sourceFieldLabel: "ลักษณะ", op: "eq", value: "ก้อนใหญ่" },
      ctx({ "ลักษณะ": "ก้อนใหญ่" }),
    )).toBe(true);
  });

  it("eq fails when sibling value missing", () => {
    expect(evalCondition(
      { sourceFieldLabel: "ลักษณะ", op: "eq", value: "ก้อนใหญ่" },
      ctx({}),
    )).toBe(false);
  });

  it("ne is the inverse of eq", () => {
    expect(evalCondition(
      { sourceFieldLabel: "ลักษณะ", op: "ne", value: "ก้อนเล็ก" },
      ctx({ "ลักษณะ": "ก้อนใหญ่" }),
    )).toBe(true);
  });

  it("numeric gte compares as numbers", () => {
    expect(evalCondition(
      { sourceFieldLabel: "ขนาด", op: "gte", value: 10 },
      ctx({ "ขนาด": "12" }),
    )).toBe(true);
    expect(evalCondition(
      { sourceFieldLabel: "ขนาด", op: "gte", value: 10 },
      ctx({ "ขนาด": "9" }),
    )).toBe(false);
  });

  it("between is inclusive", () => {
    const c = { sourceFieldLabel: "x", op: "between" as const, value: 5, value2: 10 };
    expect(evalCondition(c, ctx({ x: 5 }))).toBe(true);
    expect(evalCondition(c, ctx({ x: 10 }))).toBe(true);
    expect(evalCondition(c, ctx({ x: 11 }))).toBe(false);
  });

  it("reads from another parameter via sourceParameterId", () => {
    expect(evalCondition(
      { sourceParameterId: "P2", sourceFieldLabel: "สี", op: "eq", value: "แดง" },
      ctx({}, { P2: { "สี": "แดง" } }),
    )).toBe(true);
  });

  it("ne with missing source value is false by design (rule needs determining field filled)", () => {
    expect(evalCondition(
      { sourceFieldLabel: "ลักษณะ", op: "ne", value: "ก้อนใหญ่" },
      ctx({}),
    )).toBe(false);
  });

  it("lt/lte/gt compare numerically", () => {
    expect(evalCondition({ sourceFieldLabel: "x", op: "lt", value: 10 }, ctx({ x: 9 }))).toBe(true);
    expect(evalCondition({ sourceFieldLabel: "x", op: "lt", value: 10 }, ctx({ x: 10 }))).toBe(false);
    expect(evalCondition({ sourceFieldLabel: "x", op: "lte", value: 10 }, ctx({ x: 10 }))).toBe(true);
    expect(evalCondition({ sourceFieldLabel: "x", op: "gt", value: 10 }, ctx({ x: 11 }))).toBe(true);
    expect(evalCondition({ sourceFieldLabel: "x", op: "gt", value: 10 }, ctx({ x: 10 }))).toBe(false);
  });
});

const condField = (rules): ParameterValueField => ({
  label: "น้ำหนัก", type: "number", unit: "ก.",
  conditionalMode: true, conditionalStandards: rules,
});

describe("resolveStandard", () => {
  const rules = [
    { label: "ก้อนใหญ่", conditions: [{ sourceFieldLabel: "ลักษณะ", op: "eq", value: "ก้อนใหญ่" }], operator: "between", value: 23.5, value2: 26 },
    { label: "ก้อนเล็ก", conditions: [{ sourceFieldLabel: "ลักษณะ", op: "eq", value: "ก้อนเล็ก" }], operator: "between", value: 5.5, value2: 5.6 },
  ];

  it("returns the first matching rule's standard", () => {
    const r = resolveStandard(condField(rules), ctx({ "ลักษณะ": "ก้อนใหญ่" }));
    expect(r).toMatchObject({ operator: "between", value: 23.5, value2: 26, matchedRuleLabel: "ก้อนใหญ่" });
  });

  it("returns null when no rule matches", () => {
    expect(resolveStandard(condField(rules), ctx({}))).toBeNull();
  });

  it("empty-conditions rule acts as default (always matches, placed last)", () => {
    const withDefault = [...rules, { conditions: [], operator: "between" as const, value: 0, value2: 100 }];
    const r = resolveStandard(condField(withDefault), ctx({ "ลักษณะ": "อื่นๆ" }));
    expect(r).toMatchObject({ operator: "between", value: 0, value2: 100 });
  });

  it("non-conditional field falls back to single standard", () => {
    const f: ParameterValueField = { label: "x", type: "number", standardOperator: "lt", standardValue: 5 };
    expect(resolveStandard(f, ctx({}))).toMatchObject({ operator: "lt", value: 5, value2: null });
  });

  it("resolveFieldStandard injects resolved standard so isFieldAbnormal works", () => {
    const vf = resolveFieldStandard(condField(rules), ctx({ "ลักษณะ": "ก้อนใหญ่" }));
    expect(vf.conditionalMode).toBe(false);
    expect(isFieldAbnormal(vf, 30)).toBe(true);   // 30 อยู่นอก 23.5–26
    expect(isFieldAbnormal(vf, 24)).toBe(false);
  });

  it("resolveFieldStandard with no match → no abnormal check", () => {
    const vf = resolveFieldStandard(condField(rules), ctx({}));
    expect(isFieldAbnormal(vf, 9999)).toBe(false);
  });
});

describe("countAbnormalInResults with conditional standards", () => {
  it("counts a conditional field as abnormal using sibling value in same result", () => {
    const param: ParameterItem = {
      _id: "P1", name: "ทดสอบ", scope: "qc",
      valueFields: [
        { label: "ลักษณะ", type: "enum", options: ["ก้อนเล็ก", "ก้อนใหญ่"] },
        { label: "น้ำหนัก", type: "number", unit: "ก.", conditionalMode: true, conditionalStandards: [
          { label: "ก้อนใหญ่", conditions: [{ sourceFieldLabel: "ลักษณะ", op: "eq", value: "ก้อนใหญ่" }], operator: "between", value: 23.5, value2: 26 },
        ] },
      ],
    } as ParameterItem;
    const results = [
      { parameterId: "P1", petitionId: "X", itemSeq: 1, values: { "ลักษณะ": "ก้อนใหญ่", "น้ำหนัก": 30 } },
    ] as any;
    expect(countAbnormalInResults(results, [param])).toBe(1);
  });
});

const meNumField = { label: "pH", type: "number" as const, unit: "x", standardOperator: "lte" as const, standardValue: 7 };

describe("getEntryValues", () => {
  it("non-multiEntry → single entry from values", () => {
    const r = { values: { pH: 5 } } as any;
    expect(getEntryValues(r, { valueFields: [meNumField] } as any)).toEqual([{ pH: 5 }]);
  });
  it("multiEntry → entries array", () => {
    const r = { values: {}, entries: [{ pH: 5 }, { pH: 6 }] } as any;
    expect(getEntryValues(r, { multiEntry: true, valueFields: [meNumField] } as any)).toEqual([{ pH: 5 }, { pH: 6 }]);
  });
  it("multiEntry but empty entries → [{}]", () => {
    const r = { values: {} } as any;
    expect(getEntryValues(r, { multiEntry: true, valueFields: [meNumField] } as any)).toEqual([{}]);
  });
});

describe("fieldValueList", () => {
  it("non-multiple → wraps scalar", () => {
    expect(fieldValueList({ pH: 5 }, meNumField as any)).toEqual([5]);
  });
  it("multiple → returns array as-is", () => {
    expect(fieldValueList({ pH: [5, 6] }, { ...meNumField, multiple: true } as any)).toEqual([5, 6]);
  });
  it("multiple but missing → []", () => {
    expect(fieldValueList({}, { ...meNumField, multiple: true } as any)).toEqual([]);
  });
});

describe("countAbnormalInResults strictest (multi-entry)", () => {
  const baseParam = { _id: "p1", valueFields: [meNumField] } as any;
  const mk = (values: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
    ([{ petitionId: "x", itemSeq: 1, parameterId: "p1", values, ...extra }] as any);

  it("one bad value among a multiple field → counts abnormal", () => {
    const p = { ...baseParam, valueFields: [{ ...meNumField, multiple: true }] };
    expect(countAbnormalInResults(mk({ pH: [5, 9] }), [p])).toBe(1);
  });
  it("all good multiple values → 0", () => {
    const p = { ...baseParam, valueFields: [{ ...meNumField, multiple: true }] };
    expect(countAbnormalInResults(mk({ pH: [5, 6] }), [p])).toBe(0);
  });
  it("multiEntry: one bad entry → counts abnormal", () => {
    const p = { ...baseParam, multiEntry: true };
    expect(countAbnormalInResults(mk({}, { entries: [{ pH: 5 }, { pH: 9 }] }), [p])).toBe(1);
  });
});
