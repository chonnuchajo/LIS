import { expect, it } from "vitest";
import { defaultPreparationLevels, calculatedMatrixVolume } from "./validationPreparation";
import { matrixTargetsFromStd, syncMatrixTargets } from "./validationMatrixSync";

it("ดึงต่ำกลางสูงจาก STD ที่เรียงความเข้มข้นและใช้ระดับสูงคำนวณ Matrix เท่ากัน", () => {
  const levels = defaultPreparationLevels();
  expect(matrixTargetsFromStd(levels)).toEqual([0.1, 0.5, 1]);
  const result = syncMatrixTargets(levels).filter(row => row.purpose === "accuracy");
  expect(result.map(row => row.target)).toEqual(["0.1", "0.5", "1"]);
  result.forEach(row => expect(calculatedMatrixVolume({ ...row.matrixCalculation!, percent: "25", density: "1" }, "1000")?.matrixUl).toBe(4));
  levels[4].target = "2";
  expect(syncMatrixTargets(levels).filter(row => row.purpose === "accuracy").map(row => row.matrixCalculation?.reference)).toEqual(["2", "2", "2"]);
});

it("ล้างค่าที่เชื่อมเมื่อ STD ไม่ครบหรือซ้ำ ไม่เก็บค่าคำนวณเก่าค้าง", () => {
  const levels = defaultPreparationLevels();
  levels[0].target = "";
  expect(matrixTargetsFromStd(levels)).toBeNull();
  expect(syncMatrixTargets(levels).filter(row => row.purpose === "accuracy").every(row => row.target === "" && row.matrixCalculation?.reference === "")).toBe(true);
  levels[0].target = levels[1].target;
  expect(matrixTargetsFromStd(levels)).toBeNull();
});
