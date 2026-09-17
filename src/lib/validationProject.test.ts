import { describe, expect, it } from "vitest";
import { defaultPrecisionSettings, defaultQcSettings } from "./validationAdvanced";
import { defaultPreparationLevels, defaultLinearitySettings } from "./validationPreparation";
import { readValidationProject } from "./validationProject";
import { defaultSpecificitySettings, specificitySnapshot, evaluateSpecificity } from "./validationSpecificity";
import { defaultLinkedMeasurements } from "./validationMeasurements";

describe("เปิดงาน Validation", () => {
  const project = {
    format: "lis-validation-project", version: 1, title: "Test", analyte: "Other analyte", method: "HPLC",
    prep: ["54.25", "92.7", "25", "250", "1000"], texts: ["", "", ""], blank: "",
    preparationLevels: defaultPreparationLevels(), reportMeta: { analyst: "A", reviewer: "", protocol: "SOP", calibration: "CAL-1", notes: "" },
    precision: defaultPrecisionSettings(), qc: defaultQcSettings(),
  };
  it("คืนข้อมูลต้นทางครบและไม่รับผลคำนวณจากไฟล์มาเป็นผลจริง", () => {
    const result = readValidationProject(JSON.stringify({ ...project, checks: [{ pass: true }] }));
    expect(result).toEqual({ ...project, specificity: defaultSpecificitySettings(), stocks: [], linearity: defaultLinearitySettings(), linkedMeasurements: defaultLinkedMeasurements() });
    expect(result).not.toHaveProperty("checks");
  });
  it("ปฏิเสธไฟล์ผิดเวอร์ชันและแถวซ้ำก่อนเปลี่ยนงาน", () => {
    expect(() => readValidationProject(JSON.stringify({ ...project, version: 99 }))).toThrow();
    expect(() => readValidationProject(JSON.stringify({ ...project, prep: [] }))).toThrow();
    expect(() => readValidationProject(JSON.stringify({ ...project, preparationLevels: [project.preparationLevels[0], project.preparationLevels[0]] }))).toThrow();
  });
  it("เก็บข้อมูลทบทวน Specificity และปฏิเสธค่าผลทบทวนที่ไม่รู้จัก", () => {
    const specificity = { ...defaultSpecificitySettings(), matrixReference: "MB-1", reviewedAt: "2026-09-17T00:00:00Z", reviewedSnapshot: "source" };
    expect(readValidationProject(JSON.stringify({ ...project, specificity })).specificity).toEqual(specificity);
    expect(() => readValidationProject(JSON.stringify({ ...project, specificity: { ...specificity, decision: "approved" } }))).toThrow();
  });
  it("เปิดงานที่ทบทวนแล้วโดยยังผูกผลทบทวนกับข้อมูลเดิม", () => {
    const source = { ...project, texts: [Array(6).fill("4.4,100").join("\n"), "", ""], reportMeta: { ...project.reportMeta, reviewer: "B" } };
    const context = { standardData: source.texts[0], analyte: source.analyte, method: source.method, protocol: source.reportMeta.protocol, calibration: source.reportMeta.calibration, reviewer: source.reportMeta.reviewer, preparation: JSON.stringify({ prep: source.prep, preparationLevels: source.preparationLevels }) };
    const settings = { ...defaultSpecificitySettings(), blankData: "0,0\n0,0\n0,0", standardReference: "STD", solventReference: "BLK", matrixReference: "MB", reviewNotes: "checked", decision: "passed" as const };
    const specificity = { ...settings, reviewedAt: "2026-09-17T00:00:00Z", reviewedSnapshot: specificitySnapshot(settings, context) };
    const loaded = readValidationProject(JSON.stringify({ ...source, specificity }));
    expect(evaluateSpecificity(loaded.specificity, { ...context, preparation: JSON.stringify({ prep: loaded.prep, preparationLevels: loaded.preparationLevels }) }).current).toBe(true);
  });
  it("ไม่ยอมรับ Stock ID ซ้ำหรือแผนอ้างอิง Stock ที่ไม่มีอยู่", () => {
    const stock = { id: "S-1", name: "Stock 2", weight: "50", purity: "99", volume: "25", certificate: "COA", preparedOn: "" };
    expect(() => readValidationProject(JSON.stringify({ ...project, stocks: [stock, stock] }))).toThrow();
    expect(() => readValidationProject(JSON.stringify({ ...project, preparationLevels: [{ ...project.preparationLevels[0], stockId: "missing" }] }))).toThrow();
    const linked = { ...project, stocks: [stock], preparationLevels: [{ ...project.preparationLevels[0], stockId: "S-1" }] };
    expect(readValidationProject(JSON.stringify(linked)).preparationLevels[0].stockId).toBe("S-1");
  });
  it("เปิดข้อมูล Calibration ที่เชื่อมกับตัวอย่างและเก็บข้อมูลกรอกตรงเดิมไว้", () => {
    const calibration = { id: "CAL", name: "CAL-1", mode: "equation", points: "", slope: "250", intercept: "1", min: "0.1", max: "1", r2: "1", reference: "instrument.pdf" };
    const row = { id: "S1", sampleId: "Sample 1", kind: "accuracy", day: "1", target: "0.5", calibrationId: "CAL", area: "126.3", stockId: "", aliquot: "250", finalVolume: "1000", matrix: "4", weight: "", volume: "25", df: "1", density: "0", unspiked: "" };
    const linkedMeasurements = { enabled: ["accuracy"], calibrations: [calibration], rows: [row] };
    const source = { ...project, texts: ["", "", "0.5,0.5,0.49"], linkedMeasurements };
    const loaded = readValidationProject(JSON.stringify(source));
    expect(loaded.linkedMeasurements).toEqual(linkedMeasurements);
    expect(loaded.texts[2]).toBe("0.5,0.5,0.49");
    expect(() => readValidationProject(JSON.stringify({ ...source, linkedMeasurements: { ...linkedMeasurements, calibrations: [] } }))).toThrow();
    expect(() => readValidationProject(JSON.stringify({ ...source, linkedMeasurements: { ...linkedMeasurements, rows: [row, row] } }))).toThrow();
  });
  it("เปิดงานก่อนมีโหมดรายพีคได้และเก็บตารางรายพีคเมื่อบันทึกใหม่", () => {
    const { peakMode: _mode, peakNames: _names, peakStandardData: _standard, peakBlankData: _blank, peakBlankBasis: _basis, ...legacySpecificity } = defaultSpecificitySettings();
    expect(readValidationProject(JSON.stringify({ ...project, specificity: legacySpecificity })).specificity.peakMode).toBe(false);
    const specificity = { ...defaultSpecificitySettings(), peakMode: true, peakNames: ["P1", "P2"], peakStandardData: "4,10,6,90", peakBlankData: "0,0,0,0", peakBlankBasis: "individual" };
    expect(readValidationProject(JSON.stringify({ ...project, specificity })).specificity).toEqual(specificity);
  });
});
