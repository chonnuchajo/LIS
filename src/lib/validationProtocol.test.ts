import { describe, expect, it } from "vitest";
import { defaultProtocolDetails, evaluateProtocolDetails, hasProtocolDetails, protocolFields } from "./validationProtocol";
import { createValidationReport } from "./validationReport";
import { defaultPrecisionSettings, defaultQcSettings, evaluatePrecision, evaluateQc } from "./validationAdvanced";

describe("รายละเอียดวิธีและรายงาน", () => {
  it("keeps missing content pending and treats completeness separately from scientific approval", () => {
    const details = defaultProtocolDetails();
    expect(evaluateProtocolDetails(details).check.pass).toBeNull();
    expect(hasProtocolDetails(details)).toBe(false);
    for (const [key] of protocolFields) details[key] = "ข้อมูลที่ผู้ใช้ระบุ";
    expect(evaluateProtocolDetails(details).check.pass).toBe(true);
    expect(evaluateProtocolDetails({ ...details, conditions: " " }).check.pass).toBeNull();
  });
  it("prints ordered original report sections and escapes user-authored protocol text", () => {
    const protocolDetails = { ...defaultProtocolDetails(), purpose: "ตรวจสาร <B>", matrixBlank: "matrix\nblank", conclusion: "ต้องทบทวน" };
    const html = createValidationReport({ title: "QA", analyte: "B", method: "HPLC", analyst: "A", reviewer: "R", protocol: "SOP", calibration: "CAL", notes: "", prep: ["50", "100", "25"], levels: [], texts: ["", "", ""], blank: "", checks: [], errors: [], precision: evaluatePrecision(defaultPrecisionSettings(), [], ""), qc: evaluateQc(defaultQcSettings()), includeQc: true, protocolDetails });
    expect(html).toContain("ตรวจสาร &lt;B&gt;");
    expect(html).toContain("matrix\nblank");
    const headings = [...html.matchAll(/<h2>(\d+)\./g)].map(match => Number(match[1]));
    expect(headings).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(html).toContain("ข้อมูลหรือการทบทวนยังไม่ครบ");
    expect(html).toContain("ไม่ใช่ลายเซ็นอนุมัติ");
  });
});
