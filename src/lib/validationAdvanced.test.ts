import { describe, expect, it } from "vitest";
import { defaultPrecisionSettings, defaultQcSettings, duplicateDifference, evaluatePrecision, evaluateQc } from "./validationAdvanced";

describe("ผล Precision และ QC", () => {
  it("เก็บข้อมูล QC ต้นทางและปฏิเสธผลล้นช่วงตัวเลข", () => {
    const settings = { ...defaultQcSettings(), enabled: true, standardData: "1e308,1e-100\ninvalid", spikeData: "0.1,0.2,0.1", sampleData: "1,1e308,100,1,1" };
    const result = evaluateQc(settings);
    expect(result.rawInputs.standard).toBe(settings.standardData);
    expect(result.standardRows).toEqual([[1e308,1e-100]]);
    expect(result.standardRecoveries).toEqual([null]);
    expect(result.spikeRecoveries).toEqual([null]);
    expect(result.sampleResults[0].ww).toBeNull();
    expect(result.checks.every(check => check.pass === null)).toBe(true);
    expect(duplicateDifference(1e308, 5e307)).toBeCloseTo(200 / 3);
  });
  it("ใช้ข้อมูลรายวันจริงและไม่ผ่านเมื่อฐาน C ยังไม่ระบุ", () => {
    const settings = { ...defaultPrecisionSettings(), minDays: "2", minReplicates: "2", dailyData: "1,0.5,0.5,0.495\n1,0.5,0.5,0.505\n2,0.5,0.5,0.505\n2,0.5,0.5,0.515" };
    const pending = evaluatePrecision(settings, [0.5], "0.5,0.5,0.495\n0.5,0.5,0.505");
    expect(pending.checks.every(c => c.pass == null)).toBe(true);
    const result = evaluatePrecision({ ...settings, massFractions: "0.5,0.25" }, [0.5], "0.5,0.5,0.495\n0.5,0.5,0.505");
    expect(result.errors).toEqual([]);
    expect(result.summaries[0].anova?.sd).toBeCloseTo(Math.sqrt(3));
    expect(result.checks.every(c => c.pass === true)).toBe(true);
  });
  it("ปฏิเสธแถวผิดและการออกแบบรายวันที่ไม่สมดุล", () => {
    const result = evaluatePrecision({ ...defaultPrecisionSettings(), massFractions: "0.5,0.25", dailyData: "1,0.5,0.5,0.5\n1,0.5,0.5,0.5\n2,0.5,0.5,0.5" }, [0.5], "");
    expect(result.errors.join()).toContain("เท่ากันทุกวัน");
    expect(result.checks.every(c => c.pass == null)).toBe(true);
  });
  it("คำนวณตัวอย่างรายงานและแยก %w/w จาก %w/v", () => {
    const settings = { ...defaultQcSettings(), enabled: true, productLow: "23.5", productHigh: "26.5", sampleData: "50.58,0.5034,25,1,0", standardData: "0.505,0.5028975\n0.503,0.5028975", spikeData: "0.515,0.302,0.201159\n0.511,0.302,0.201159" };
    const result = evaluateQc(settings);
    expect(result.sampleResults[0].ww).toBeCloseTo(24.881376, 5);
    expect(result.checks[0].pass).toBe(true);
    const wv = evaluateQc({ ...settings, productUnit: "wv" });
    expect(wv.errors.join()).toContain("density");
    expect(wv.checks[0].pass).toBeNull();
    expect(duplicateDifference(100.48, 100.06)).toBeCloseTo(0.41887, 4);
  });
  it("ไม่แปลงช่องว่างและตัวหารศูนย์เป็นผลผ่าน", () => {
    const result = evaluateQc({ ...defaultQcSettings(), enabled: true, standardData: "0.5,0\n0.5,0" });
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.checks.every(c => c.pass == null)).toBe(true);
    expect(duplicateDifference(0, 0)).toBeNull();
  });
});
