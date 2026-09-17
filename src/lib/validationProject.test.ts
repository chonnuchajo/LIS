import { describe, expect, it } from "vitest";
import { defaultPrecisionSettings, defaultQcSettings } from "./validationAdvanced";
import { defaultPreparationLevels } from "./validationPreparation";
import { readValidationProject } from "./validationProject";
import { defaultSpecificitySettings, specificitySnapshot, evaluateSpecificity } from "./validationSpecificity";

describe("เปิดงาน Validation", () => {
  const project = {
    format: "lis-validation-project", version: 1, title: "Test", analyte: "Other analyte", method: "HPLC",
    prep: ["54.25", "92.7", "25", "250", "1000"], texts: ["", "", ""], blank: "",
    preparationLevels: defaultPreparationLevels(), reportMeta: { analyst: "A", reviewer: "", protocol: "SOP", calibration: "CAL-1", notes: "" },
    precision: defaultPrecisionSettings(), qc: defaultQcSettings(),
  };
  it("คืนข้อมูลต้นทางครบและไม่รับผลคำนวณจากไฟล์มาเป็นผลจริง", () => {
    const result = readValidationProject(JSON.stringify({ ...project, checks: [{ pass: true }] }));
    expect(result).toEqual({ ...project, specificity: defaultSpecificitySettings() });
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
});
