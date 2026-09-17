import { describe, expect, it } from "vitest";
import { createValidationReport, escapeReport } from "./validationReport";
import { defaultPrecisionSettings, defaultQcSettings, evaluatePrecision, evaluateQc } from "./validationAdvanced";

describe("รายงาน Validation", () => {
  it("escape ข้อความนำเข้าและมีตาราง สูตร ข้อมูลดิบครบ", () => {
    const html = createValidationReport({ title: '<img src=x onerror="alert(1)">', analyte: "Test", method: "GC", analyst: "A", reviewer: "B", protocol: "SOP", calibration: "CAL-1", notes: "", prep: ["54.25", "92.7", "25"], levels: [], texts: ["4.4,250", "1,3\n2,5\n3,7", "0.5,0.5,0.49"], blank: "0", checks: [{ name: "test", value: "", criteria: "", pass: null }], errors: [], precision: evaluatePrecision(defaultPrecisionSettings(), [0.5], ""), qc: evaluateQc(defaultQcSettings()), includeQc: false });
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img');
    expect(html).toContain("Residual Plot");
    expect(html).toContain("Back-calculated mg/mL");
    expect(html).toContain("balanced one-way ANOVA");
    expect(html).toContain("ข้อมูลหรือการทบทวนยังไม่ครบ");
    expect(html).toContain("CAL-1");
    expect(escapeReport("<>&")).toBe("&lt;&gt;&amp;");
  });
});
