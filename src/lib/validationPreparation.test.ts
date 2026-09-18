import { describe, expect, it } from "vitest";
import { calculatedMatrixVolume, dilution, stockConcentration, preparationResult, preparationTemplate, checkLinearityPreparation, defaultPreparationLevels, defaultLinearitySettings, targetConcentration, changePreparationUnit } from "./validationPreparation";
import { parseMeasurements } from "./validationCalculator";

it("ใช้ Stock โดยตรงให้ Actual เท่ากับ Stock แม้ Target เป็นค่าระบุ 1 mg/mL", () => {
  const level = { ...defaultPreparationLevels()[4], useStockDirect: true, actualAliquot: "" };
  expect(preparationResult(level, 1.044173, [])).toEqual({ actual: 1.044173, suggestedAliquotUl: 1000, diluentUl: 0 });
  expect(preparationTemplate("linearity", [level], 1.044173, [], 3)).toBe(Array(3).fill("1.044173\t").join("\n"));
  expect(preparationResult(level, 0.99, [])?.actual).toBe(0.99);
  expect(preparationResult({ ...level, matrix: "4", preparationKind: "matrix" }, 1.044173, [])).toBeNull();
  expect(preparationResult({ ...level, useStockDirect: false }, 1.044173, [])).toBeNull();
});

describe("การเตรียมสารสำหรับหัวข้อ 6 และ 7", () => {
  it("เปลี่ยนหน่วย Target โดยคงความเข้มข้นและสร้างผลวัดใน mg/mL", () => {
    const original = defaultPreparationLevels().find(level => level.purpose === "accuracy" && level.target === "0.5")!;
    const changed = changePreparationUnit(original, "µg/mL")!;
    expect(changed.target).toBe("500");
    expect(targetConcentration(changed)).toBe(0.5);
    expect(preparationResult(changed, 2.01159, [])).toEqual(preparationResult(original, 2.01159, []));
    expect(preparationTemplate("accuracy", [changed], 2.01159, [], 2)).toBe("0.5\t0.5028975\t\n0.5\t0.5028975\t");
    expect(changePreparationUnit(changed, "mg/L")?.target).toBe("500");
    expect(changePreparationUnit(changed, "mg/mL")?.target).toBe("0.5");
  });
  it("ตรวจค่า Target ที่ไม่สามารถแปลงหน่วยได้", () => {
    expect(targetConcentration({ target: "5e-324", targetUnit: "µg/mL" })).toBeNull();
    expect(targetConcentration({ target: "", targetUnit: "mg/L" })).toBeNull();
    expect(changePreparationUnit({ ...defaultPreparationLevels()[0], target: "1e308" }, "mg/L")).toBeNull();
    expect(changePreparationUnit({ ...defaultPreparationLevels()[0], target: "" }, "mg/L")?.target).toBe("");
  });
  it("คำนวณความเข้มข้นจริงจากรายงานโดยไม่แทนด้วย Target", () => {
    const stock = stockConcentration(54.25, 92.7, 25);
    expect(stock).toBeCloseTo(2.01159, 8);
    const result = dilution({ stockMgMl: stock!, target: 0.5, unit: "mg/mL", finalUl: 1000, actualAliquotUl: 250, matrixUl: 4 });
    expect(result?.actual).toBeCloseTo(0.5028975, 8);
    expect(result?.diluentUl).toBe(746);
    expect(result?.suggestedAliquotUl).toBeCloseTo(248.55959, 4);
  });
  it("รองรับสารอื่นและหน่วย µg/mL", () => {
    const result = dilution({ stockMgMl: 1, target: 100, unit: "µg/mL", finalUl: 2000, actualAliquotUl: 200, matrixUl: 0 });
    expect(result?.actual).toBe(100);
    expect(result?.suggestedAliquotUl).toBe(200);
  });
  it("ปฏิเสธความบริสุทธิ์และปริมาตรที่เป็นไปไม่ได้", () => {
    expect(stockConcentration(50, 101, 25)).toBeNull();
    expect(dilution({ stockMgMl: 1, target: 2, unit: "mg/mL", finalUl: 1000, actualAliquotUl: 100, matrixUl: 0 })).toBeNull();
    expect(dilution({ stockMgMl: 1, target: 0.5, unit: "mg/mL", finalUl: 1000, actualAliquotUl: 999, matrixUl: 4 })).toBeNull();
  });
  it("เลือก Stock ตามรหัสและไม่ใช้ Stock หลักแทนรหัสที่หายไป", () => {
    const level = { ...defaultPreparationLevels()[2], stockId: "S2" };
    const stocks = [{ id: "S2", name: "Accuracy", weight: "54.25", purity: "92.7", volume: "25", certificate: "COA", preparedOn: "" }];
    expect(preparationResult(level, 2, stocks)?.actual).toBeCloseTo(0.5028975, 8);
    expect(preparationResult(level, 2, [])).toBeNull();
    expect(preparationResult({ ...level, stockId: "" }, 2, stocks)?.actual).toBe(0.5);
  });
  it("สร้าง Actual เต็มทศนิยมและเว้นผลวัด ไม่สร้างค่าผ่านจำลอง", () => {
    const data = preparationTemplate("accuracy", defaultPreparationLevels(), 2.01159, [], 10)!;
    expect(data.split("\n")).toHaveLength(30);
    expect(data).toContain("0.5\t0.5028975\t");
    expect(parseMeasurements(data, 3).rows).toHaveLength(0);
    expect(parseMeasurements(data, 3).errors).toHaveLength(30);
    expect(preparationTemplate("linearity", defaultPreparationLevels(), null, [], 3)).toBeNull();
  });
  it("ไม่ผ่านเมื่อจำนวนระดับครบแต่ Actual ไม่ตรงกับแผน", () => {
    const levels = defaultPreparationLevels();
    const rows = [0.1, 0.25, 0.5, 0.75, 1].flatMap(x => [[x, x * 250], [x, x * 250], [x, x * 250]]);
    expect(checkLinearityPreparation(rows, levels, 2, [], defaultLinearitySettings()).ready).toBe(true);
    const changedStock = checkLinearityPreparation(rows, levels, 2.01159, [], defaultLinearitySettings());
    expect(changedStock.ready).toBe(false);
    expect(changedStock.errors).toHaveLength(15);
  });
  it("รวมแถวที่ปัดเศษภายใน tolerance และปฏิเสธช่วงระดับทับกัน", () => {
    const levels = defaultPreparationLevels();
    const rows = [0.1, 0.25, 0.5, 0.75, 1].flatMap(x => [[x, 100], [x + 0.0000001, 101], [x - 0.0000001, 99]]);
    const result = checkLinearityPreparation(rows, levels, 2, [], defaultLinearitySettings());
    expect(result.ready).toBe(true);
    expect(result.groups.map(group => group.length)).toEqual([3, 3, 3, 3, 3]);
    expect(checkLinearityPreparation(rows, levels, 2, [], { ...defaultLinearitySettings(), concentrationTolerance: "0.2" }).ready).toBe(false);
  });
});


it("calculates the fixed matrix loading in section 6.5.2 with explicit percent basis", () => {
 const config = {percent:"25",basis:"ww" as const,reference:"1",density:"1",sampleDensity:""};
 expect(calculatedMatrixVolume(config,"1000")?.matrixUl).toBe(4);
 expect(calculatedMatrixVolume({...config,percent:"10"},"1000")?.matrixUl).toBe(10);
 expect(calculatedMatrixVolume({...config,density:"0.8"},"2000")?.matrixUl).toBe(10);
 expect(calculatedMatrixVolume({...config,basis:"wv"},"1000")).toBeNull();
 expect(calculatedMatrixVolume({...config,basis:"wv",sampleDensity:"1.2"},"1000")?.matrixUl).toBeCloseTo(4.8);
 expect(calculatedMatrixVolume({...config,percent:"0"},"1000")).toBeNull();
 expect(calculatedMatrixVolume({...config,percent:"0.001"},"1000")).toBeNull();
});
