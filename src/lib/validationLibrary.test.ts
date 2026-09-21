import { beforeEach, expect, it } from "vitest";
import { saveValidationWork, loadValidationLibrary } from "./validationLibrary";
import { defaultPreparationLevels } from "./validationPreparation";
import { defaultPrecisionSettings, defaultQcSettings } from "./validationAdvanced";

const project = { format: "lis-validation-project", version: 1, title: "งานทดสอบ", analyte: "Test", method: "GC", prep: ["50", "100", "25", "", ""], texts: ["", "", ""], blank: "", preparationLevels: defaultPreparationLevels(), reportMeta: { analyst: "", reviewer: "", protocol: "", calibration: "", notes: "" }, precision: defaultPrecisionSettings(), qc: defaultQcSettings() };
beforeEach(() => localStorage.clear());
it("เปิดกลับได้ครบทุกหัวข้อและแยกบัญชี โดยบันทึกซ้ำไม่สร้างงานซ้ำ", () => {
  saveValidationWork("qa@example.test", "job-1", "STD", project);
  saveValidationWork("qa@example.test", "job-1", "Matrix", { ...project, analyte: "Updated" });
  const restored = loadValidationLibrary("QA@example.test");
  expect(restored).toHaveLength(1);
  expect(restored[0].project.analyte).toBe("Updated");
  expect(restored[0].project.prep).toEqual(project.prep);
  expect(Object.keys(restored[0].sections)).toEqual(["STD", "Matrix"]);
  expect(loadValidationLibrary("another@example.test")).toEqual([]);
  saveValidationWork("qa@example.test", "job-2", "Linearity", project);
  expect(loadValidationLibrary("qa@example.test")).toHaveLength(2);
});
it("แจ้งข้อผิดพลาดเมื่อพื้นที่เต็มและไม่เขียนทับคลังที่อ่านไม่ได้", () => {
  const storage = { getItem: () => "broken", setItem: () => { throw new Error("must not write"); } } as unknown as Storage;
  expect(() => saveValidationWork("qa", "job", "STD", project, storage)).toThrow();
  const full = { getItem: () => null, setItem: () => { throw new DOMException("full", "QuotaExceededError"); } } as unknown as Storage;
  expect(() => saveValidationWork("qa", "job", "STD", project, full)).toThrow("full");
});
