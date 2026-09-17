import { describe, expect, it } from "vitest";
import { defaultPrecisionSettings, defaultQcSettings } from "./validationAdvanced";
import { defaultPreparationLevels } from "./validationPreparation";
import { readValidationProject } from "./validationProject";

describe("เปิดงาน Validation", () => {
  const project = {
    format: "lis-validation-project", version: 1, title: "Test", analyte: "Other analyte", method: "HPLC",
    prep: ["54.25", "92.7", "25", "250", "1000"], texts: ["", "", ""], blank: "",
    preparationLevels: defaultPreparationLevels(), reportMeta: { analyst: "A", reviewer: "", protocol: "SOP", calibration: "CAL-1", notes: "" },
    precision: defaultPrecisionSettings(), qc: defaultQcSettings(),
  };
  it("คืนข้อมูลต้นทางครบและไม่รับผลคำนวณจากไฟล์มาเป็นผลจริง", () => {
    const result = readValidationProject(JSON.stringify({ ...project, checks: [{ pass: true }] }));
    expect(result).toEqual(project);
    expect(result).not.toHaveProperty("checks");
  });
  it("ปฏิเสธไฟล์ผิดเวอร์ชันและแถวซ้ำก่อนเปลี่ยนงาน", () => {
    expect(() => readValidationProject(JSON.stringify({ ...project, version: 99 }))).toThrow();
    expect(() => readValidationProject(JSON.stringify({ ...project, prep: [] }))).toThrow();
    expect(() => readValidationProject(JSON.stringify({ ...project, preparationLevels: [project.preparationLevels[0], project.preparationLevels[0]] }))).toThrow();
  });
});
