import { describe, expect, it } from "vitest";
import { createValidationReport, escapeReport } from "./validationReport";
import { defaultPrecisionSettings, defaultQcSettings, evaluatePrecision, evaluateQc } from "./validationAdvanced";
import { defaultSpecificitySettings, specificitySnapshot } from "./validationSpecificity";

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
  it("แสดงหลักฐาน Blank และผลทบทวนที่ตรงกับข้อมูลปัจจุบันเท่านั้น", () => {
    const input = { title: "Report", analyte: "Test", method: "GC", analyst: "A", reviewer: "B", protocol: "SOP", calibration: "CAL-1", notes: "", prep: ["54.25", "92.7", "25", "250", "1000"], levels: [], texts: [Array(6).fill("4.4,100").join("\n"), "", ""], blank: "", checks: [], errors: [], precision: evaluatePrecision(defaultPrecisionSettings(), [0.5], ""), qc: evaluateQc(defaultQcSettings()), includeQc: false };
    const settings = { ...defaultSpecificitySettings(), blankData: "0,0\n0,0\n0,0", standardReference: "STD-1", solventReference: "BLK-1", matrixReference: "<MB-1>", reviewNotes: "พีคแยก", decision: "passed" as const };
    const specificity = { ...settings, reviewedAt: "2026-09-17T13:00:00Z", reviewedSnapshot: specificitySnapshot(settings, { standardData: input.texts[0], analyte: input.analyte, method: input.method, reviewer: input.reviewer, protocol: input.protocol, calibration: input.calibration, preparation: JSON.stringify({ prep: input.prep, preparationLevels: input.levels }) }) };
    const html = createValidationReport({ ...input, specificity });
    expect(html).toContain("ผลทบทวนปัจจุบัน: ผ่าน");
    expect(html).toContain("&lt;MB-1&gt;");
    expect(html).toContain("Solvent Blank Area");
    expect(createValidationReport({ ...input, specificity, calibration: "CAL-2" })).toContain("ผลทบทวนปัจจุบัน: ยังไม่ครบ / ต้องทบทวนใหม่");
  });
});
