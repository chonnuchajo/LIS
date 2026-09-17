import { describe, expect, it } from "vitest";
import { dilution, stockConcentration } from "./validationPreparation";

describe("การเตรียมสารสำหรับหัวข้อ 6 และ 7", () => {
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
});
