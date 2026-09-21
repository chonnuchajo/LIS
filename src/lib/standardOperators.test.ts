import { describe, it, expect } from "vitest";
import { OPERATOR_OPTIONS, describeSubstanceStandard, describeRule, describeResolvedStandard, describeOutputRule, describeSingleStandard } from "./standardOperators";
import type { StandardRule, ParameterValueField } from "./api";

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

import { describeLabelTolerance, formatLabelToleranceRange, labelToleranceBadge } from "./standardOperators";

describe("describeLabelTolerance", () => {
  it("summarizes head percent by default", () => {
    expect(describeLabelTolerance({ substance: "A", autoPct: 2.5, headPct: 5 }, "%"))
      .toContain("เกณฑ์กรม ±5%");
    expect(describeLabelTolerance({ substance: "A", autoPct: 2.5, headPct: 5 }, "%"))
      .not.toContain("±2.5%");
  });
  it("can include auto pass percent for approval display", () => {
    expect(describeLabelTolerance({ substance: "A", autoPct: 2.5, headPct: 5 }, "%", { showAutoPass: true }))
      .toContain("±2.5%");
    expect(describeLabelTolerance({ substance: "A", autoPct: 2.5, headPct: 5 }, "%", { showAutoPass: true }))
      .toContain("เกณฑ์กรม ±5%");
  });
  it("omits head when null", () => {
    expect(describeLabelTolerance({ substance: "A", autoPct: 2.5, headPct: null }, ""))
      .toBe("");
  });
  it("summarizes abs mode as head reviewer criteria by default", () => {
    const out = describeLabelTolerance(
      { substance: "A", mode: "abs", autoPct: null, headPct: null, autoAbs: 0.05, headAbs: 0.1 }, "g/L");
    expect(out).toBe("เกณฑ์กรม ±0.1 g/L");
  });
  it("can include abs auto pass criteria for approval display", () => {
    const out = describeLabelTolerance(
      { substance: "A", mode: "abs", autoPct: null, headPct: null, autoAbs: 0.05, headAbs: 0.1 },
      "g/L",
      { showAutoPass: true },
    );
    expect(out).toBe("ฉลาก ±0.05 (เกณฑ์กรม ±0.1) g/L");
  });
  it("abs mode omits head and unit when absent", () => {
    expect(describeLabelTolerance(
      { substance: "A", mode: "abs", autoPct: null, headPct: null, autoAbs: 0.05, headAbs: null }, ""))
      .toBe("");
    expect(describeLabelTolerance(
      { substance: "A", mode: "abs", autoPct: null, headPct: null, autoAbs: 0.05, headAbs: null },
      "",
      { showAutoPass: true },
    )).toBe("ฉลาก ±0.05");
  });
  it("abs mode returns empty when autoAbs missing", () => {
    expect(describeLabelTolerance(
      { substance: "A", mode: "abs", autoPct: null, headPct: null, autoAbs: null, headAbs: null }, "%"))
      .toBe("");
  });
  it("describes split modes as head reviewer criteria by default", () => {
    expect(describeLabelTolerance(
      { substance: "A", autoMode: "percent", headMode: "abs", autoPct: 50, headPct: null, headAbs: 0.1 }, "g/L"))
      .toBe("เกณฑ์กรม ±0.1 g/L");
  });
  it("can include split auto pass criteria for approval display", () => {
    expect(describeLabelTolerance(
      { substance: "A", autoMode: "percent", headMode: "abs", autoPct: 50, headPct: null, headAbs: 0.1 },
      "g/L",
      { showAutoPass: true },
    )).toBe("ผ่าน 50% ของเกณฑ์กรม | เกณฑ์กรม ±0.1 g/L");
  });
  it("describes split range modes as head reviewer criteria by default", () => {
    const out = describeLabelTolerance(
      { substance: "A", autoMode: "range", headMode: "range", autoPct: null, headPct: null, passLow: 1.75, passHigh: 1.85, failLow: 1.7, failHigh: 1.9 },
      "%",
    );
    expect(out).not.toContain("1.75-1.85");
    expect(out).toContain("1.7-1.9");
  });
  it("can include split range auto pass criteria for approval display", () => {
    const out = describeLabelTolerance(
      { substance: "A", autoMode: "range", headMode: "range", autoPct: null, headPct: null, passLow: 1.75, passHigh: 1.85, failLow: 1.7, failHigh: 1.9 },
      "%",
      { showAutoPass: true },
    );
    expect(out).toContain("1.75-1.85");
    expect(out).toContain("1.7-1.9");
  });
  it("describes split mode with no automatic pass band", () => {
    expect(describeLabelTolerance(
      { substance: "A", autoMode: "none", headMode: "abs", autoPct: null, headPct: null, headAbs: 0.1 },
      "g/L",
    )).toBe("เกณฑ์กรม ±0.1 g/L");
  });
  it("describes split mode with no head reviewer band", () => {
    expect(describeLabelTolerance(
      { substance: "A", autoMode: "abs", headMode: "none", autoPct: null, headPct: null, autoAbs: 0.05 },
      "g/L",
    )).toBe("");
    expect(describeLabelTolerance(
      { substance: "A", autoMode: "abs", headMode: "none", autoPct: null, headPct: null, autoAbs: 0.05 },
      "g/L",
      { showAutoPass: true },
    )).toBe("ผ่าน ±0.05 g/L");
  });
  it("defaults split mode summaries to head reviewer criteria without pass text", () => {
    const out = describeLabelTolerance(
      { substance: "A", autoMode: "percent", headMode: "abs", autoPct: 50, headPct: null, headAbs: 0.1 },
      "g/L",
    );

    expect(out).toBe("เกณฑ์กรม ±0.1 g/L");
    expect(out).not.toContain("ผ่าน");
  });
  it("describes split range mode with no automatic pass band", () => {
    expect(describeLabelTolerance(
      {
        substance: "A",
        autoMode: "none",
        headMode: "range",
        autoPct: null,
        headPct: null,
        passLow: null,
        passHigh: null,
        failLow: 1.7,
        failHigh: 1.9,
      },
      "g/L",
    )).toBe("เกณฑ์กรม 1.7-1.9 g/L");
  });
  it("describes split range mode with no head reviewer band", () => {
    expect(describeLabelTolerance(
      {
        substance: "A",
        autoMode: "range",
        headMode: "none",
        autoPct: null,
        headPct: null,
        passLow: 1.75,
        passHigh: 1.85,
        failLow: null,
        failHigh: null,
      },
      "g/L",
    )).toBe("");
    expect(describeLabelTolerance(
      {
        substance: "A",
        autoMode: "range",
        headMode: "none",
        autoPct: null,
        headPct: null,
        passLow: 1.75,
        passHigh: 1.85,
        failLow: null,
        failHigh: null,
      },
      "g/L",
      { showAutoPass: true },
    )).toBe("ผ่าน 1.75-1.85 g/L");
  });
});

describe("formatLabelToleranceRange", () => {
  it("defaults to the head reviewer range without pass text", () => {
    const out = formatLabelToleranceRange(
      { status: "pass", center: 1, autoRange: [0.975, 1.025], headRange: [0.95, 1.05] },
      "%",
    );

    expect(out).toBe("เกณฑ์กรม 0.9500–1.0500 %");
    expect(out).not.toContain("ผ่าน");
    expect(out).not.toContain("0.975");
  });
  it("does not render a pass badge by default", () => {
    expect(labelToleranceBadge("pass", 1)).toBeNull();
  });
  it("formats pass and head ranges", () => {
    const out = formatLabelToleranceRange(
      { status: "pass", center: 1, autoRange: [0.975, 1.025], headRange: [0.95, 1.05] },
      "%",
      { showAutoPass: true },
    );
    expect(out).toContain("0.975");
    expect(out).toContain("1.05");
  });
  it("formats 0.125 percent label ranges with five decimals", () => {
    const out = formatLabelToleranceRange(
      { status: "pass", center: 0.125, autoRange: [0.1109375, 0.1390625], headRange: [0.10625, 0.14375] },
      "%",
      { showAutoPass: true },
    );
    expect(out).toContain("0.11094");
    expect(out).toContain("0.13906");
    expect(out).toContain("0.10625");
    expect(out).toContain("0.14375");
  });
  it("keeps four fixed decimals for ordinary label ranges", () => {
    const out = formatLabelToleranceRange(
      { status: "pass", center: 1, autoRange: [0.8875, 1.1125], headRange: [0.85, 1.15] },
      "%",
      { showAutoPass: true },
    );
    expect(out).toContain("0.8875");
    expect(out).toContain("1.1125");
    expect(out).toContain("0.8500");
    expect(out).toContain("1.1500");
  });
  it("uses two fixed decimals when the label percent is greater than 2.5", () => {
    const out = formatLabelToleranceRange(
      { status: "pass", center: 5, autoRange: [4.4375, 5.5625], headRange: [4.25, 5.75] },
      "%",
      { showAutoPass: true },
    );
    expect(out).toContain("4.44");
    expect(out).toContain("5.56");
    expect(out).toContain("4.25");
    expect(out).toContain("5.75");
  });
  it("uses five decimals when the label percent has more than one leading zero after the decimal", () => {
    const out = formatLabelToleranceRange(
      { status: "pass", center: 0.005, autoRange: [0.0044375, 0.0055625], headRange: [0.00425, 0.00575] },
      "%",
      { showAutoPass: true },
    );
    expect(out).toContain("0.00444");
    expect(out).toContain("0.00556");
    expect(out).toContain("0.00425");
    expect(out).toContain("0.00575");
  });
  it("returns empty when center null", () => {
    expect(formatLabelToleranceRange({ status: "none", center: null, autoRange: null, headRange: null }, "%")).toBe("");
  });
});

const field = (over: Partial<ParameterValueField>): ParameterValueField => ({
  label: "ค่า", type: "float", ...over,
});

describe("describeSingleStandard", () => {
  it("no operator: not-configured message, set=false", () => {
    const r = describeSingleStandard(field({}));
    expect(r).toEqual({ text: "ยังไม่ได้กำหนดเงื่อนไข — จะไม่ตรวจค่าผิดปกติ", set: false });
  });

  it("operator but no value: missing-value message, set=false", () => {
    const r = describeSingleStandard(field({ standardOperator: "gte", standardValue: null }));
    expect(r).toEqual({ text: "ยังไม่ได้กรอกค่ามาตรฐาน", set: false });
  });

  it("lt", () => {
    expect(describeSingleStandard(field({ standardOperator: "lt", standardValue: 5 })))
      .toEqual({ text: "ค่าปกติ: < 5", set: true });
  });
  it("lte", () => {
    expect(describeSingleStandard(field({ standardOperator: "lte", standardValue: 5 })))
      .toEqual({ text: "ค่าปกติ: ≤ 5", set: true });
  });
  it("eq", () => {
    expect(describeSingleStandard(field({ standardOperator: "eq", standardValue: 5 })))
      .toEqual({ text: "ค่าปกติ: = 5", set: true });
  });
  it("gte", () => {
    expect(describeSingleStandard(field({ standardOperator: "gte", standardValue: 5 })))
      .toEqual({ text: "ค่าปกติ: ≥ 5", set: true });
  });
  it("gt", () => {
    expect(describeSingleStandard(field({ standardOperator: "gt", standardValue: 5 })))
      .toEqual({ text: "ค่าปกติ: > 5", set: true });
  });

  it("between with value2: renders range", () => {
    expect(describeSingleStandard(field({ standardOperator: "between", standardValue: 10, standardValue2: 50 })))
      .toEqual({ text: "ค่าปกติ: 10 - 50", set: true });
  });
  it("between without value2: missing-end message, set=false", () => {
    expect(describeSingleStandard(field({ standardOperator: "between", standardValue: 10, standardValue2: null })))
      .toEqual({ text: "ยังไม่ได้กรอกค่าสิ้นสุดของช่วง", set: false });
  });

  it("tolerance with a valid pct: computes low-high range", () => {
    const r = describeSingleStandard(field({ standardOperator: "tolerance", standardValue: 100, standardValue2: 5 }));
    expect(r).toEqual({ text: "ค่าปกติ: 100 ± 5% (95 - 105)", set: true });
  });
  it("tolerance with null pct: not-configured tolerance message, set=false", () => {
    expect(describeSingleStandard(field({ standardOperator: "tolerance", standardValue: 100, standardValue2: null })))
      .toEqual({ text: "ยังไม่ได้กรอก tolerance %", set: false });
  });
  it("tolerance with pct <= 0: not-configured tolerance message, set=false", () => {
    expect(describeSingleStandard(field({ standardOperator: "tolerance", standardValue: 100, standardValue2: 0 })))
      .toEqual({ text: "ยังไม่ได้กรอก tolerance %", set: false });
  });

  it("appends the unit suffix when present", () => {
    expect(describeSingleStandard(field({ standardOperator: "gte", standardValue: 5, unit: "cP" })))
      .toEqual({ text: "ค่าปกติ: ≥ 5 cP", set: true });
  });
  it("omits the unit suffix when absent", () => {
    expect(describeSingleStandard(field({ standardOperator: "gte", standardValue: 5 })))
      .toEqual({ text: "ค่าปกติ: ≥ 5", set: true });
  });
});
