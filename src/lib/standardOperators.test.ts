import { describe, it, expect } from "vitest";
import { OPERATOR_OPTIONS, describeSubstanceStandard, describeRule, describeResolvedStandard, describeOutputRule } from "./standardOperators";
import type { StandardRule } from "./api";

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

describe("describeResolvedStandard", () => {
  it("formats a between standard with unit", () => {
    expect(describeResolvedStandard({ operator: "between", value: 23.5, value2: 26 }, "ก.")).toBe("23.5 - 26ก.");
  });
  it("returns empty for null", () => {
    expect(describeResolvedStandard(null, "ก.")).toBe("");
  });
});

describe("describeRule", () => {
  it("summarizes label + standard", () => {
    const s = describeRule(
      { label: "ก้อนใหญ่", conditions: [{ sourceFieldLabel: "ลักษณะ", op: "eq", value: "ก้อนใหญ่" }], operator: "between", value: 23.5, value2: 26 },
      "ก.",
    );
    expect(s).toContain("ก้อนใหญ่");
    expect(s).toContain("23.5 - 26");
  });
});

const rule = (over: Partial<StandardRule>): StandardRule => ({
  label: "", conditions: [], operator: "between", value: null, value2: null, ...over,
});

describe("describeOutputRule", () => {
  it("describes a conditional output rule", () => {
    const r = rule({
      label: "เล็ก",
      conditions: [{ sourceFieldLabel: "ขนาดก้อน", op: "between", value: 5.5, value2: 6.5 }],
      outputText: "ก้อนเล็ก", outputKind: "normal",
    });
    expect(describeOutputRule(r)).toBe('เล็ก: ถ้า ขนาดก้อน ช่วง 5.5–6.5 → "ก้อนเล็ก" (ปกติ)');
  });
  it("describes a default (no-condition) abnormal row and falls back to label text", () => {
    const r = rule({ label: "อื่นๆ", conditions: [], outputText: "", outputKind: "abnormal" });
    expect(describeOutputRule(r)).toBe('อื่นๆ: default → "อื่นๆ" (ผิดปกติ)');
  });
});

import { describeLabelTolerance, formatLabelToleranceRange } from "./standardOperators";

describe("describeLabelTolerance", () => {
  it("summarizes auto + head percent", () => {
    expect(describeLabelTolerance({ substance: "A", autoPct: 2.5, headPct: 5 }, "%"))
      .toContain("±2.5%");
    expect(describeLabelTolerance({ substance: "A", autoPct: 2.5, headPct: 5 }, "%"))
      .toContain("หัวหน้า ±5%");
  });
  it("omits head when null", () => {
    expect(describeLabelTolerance({ substance: "A", autoPct: 2.5, headPct: null }, ""))
      .not.toContain("หัวหน้า");
  });
  it("summarizes abs mode without a percent sign", () => {
    const out = describeLabelTolerance(
      { substance: "A", mode: "abs", autoPct: null, headPct: null, autoAbs: 0.05, headAbs: 0.1 }, "g/L");
    expect(out).toBe("ฉลาก ±0.05 (หัวหน้า ±0.1) g/L");
  });
  it("abs mode omits head and unit when absent", () => {
    expect(describeLabelTolerance(
      { substance: "A", mode: "abs", autoPct: null, headPct: null, autoAbs: 0.05, headAbs: null }, ""))
      .toBe("ฉลาก ±0.05");
  });
  it("abs mode returns empty when autoAbs missing", () => {
    expect(describeLabelTolerance(
      { substance: "A", mode: "abs", autoPct: null, headPct: null, autoAbs: null, headAbs: null }, "%"))
      .toBe("");
  });
});

describe("formatLabelToleranceRange", () => {
  it("formats pass and head ranges", () => {
    const out = formatLabelToleranceRange(
      { status: "pass", center: 1, autoRange: [0.975, 1.025], headRange: [0.95, 1.05] }, "%");
    expect(out).toContain("0.975");
    expect(out).toContain("1.05");
  });
  it("returns empty when center null", () => {
    expect(formatLabelToleranceRange({ status: "none", center: null, autoRange: null, headRange: null }, "%")).toBe("");
  });
});
