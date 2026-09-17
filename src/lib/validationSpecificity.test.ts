import { describe, expect, it } from "vitest";
import { defaultSpecificitySettings, evaluateSpecificity, specificitySnapshot, type SpecificityContext } from "./validationSpecificity";

const context: SpecificityContext = { standardData: Array(6).fill("4.4,100").join("\n"), analyte: "Test", method: "GC-FID", protocol: "SOP-1", calibration: "CAL-1", reviewer: "Reviewer", preparation: "prep-1" };
const complete = () => ({ ...defaultSpecificitySettings(), blankData: "0,0.1\n0,0.2\n0,0.3", standardReference: "STD 1–6", solventReference: "BLK 1–3", matrixReference: "MB 1–3", reviewNotes: "พีคแยก ไม่มีสัญญาณรบกวนที่ RT เป้าหมาย", decision: "passed" as const });
describe("Specificity evidence review", () => {
  it("uses the maximum of each blank type and requires explicit review", () => {
    const result = evaluateSpecificity(complete(), context);
    expect(result.solventInterference).toBe(0);
    expect(result.matrixInterference).toBeCloseTo(0.3);
    expect(result.checks.map(c => c.pass)).toEqual([true, true, true, true, null]);
    expect(result.canRecord).toBe(true);
  });
  it("invalidates the recorded review after measurements, criteria, evidence or reviewer change", () => {
    const settings = complete();
    const reviewed = { ...settings, reviewedAt: "2026-09-17T13:00:00Z", reviewedSnapshot: specificitySnapshot(settings, context) };
    expect(evaluateSpecificity(reviewed, context).checks.at(-1)?.pass).toBe(true);
    for (const changed of [{ ...context, standardData: context.standardData + "\n4.4,100" }, { ...context, reviewer: "Other" }, { ...context, preparation: "prep-2" }]) {
      expect(evaluateSpecificity(reviewed, changed).current).toBe(false);
    }
    for (const changed of [{ ...reviewed, blankLimit: "0" }, { ...reviewed, matrixReference: "MB-NEW" }, { ...reviewed, decision: "failed" as const }]) {
      expect(evaluateSpecificity(changed, context).current).toBe(false);
    }
  });
  it("supports a no-interference criterion and cannot override numerical failure with review", () => {
    const settings = { ...complete(), blankLimit: "0" };
    const reviewed = { ...settings, reviewedAt: "2026-09-17T13:00:00Z", reviewedSnapshot: specificitySnapshot(settings, context) };
    expect(evaluateSpecificity(reviewed, context).checks.map(c => c.pass)).toEqual([true, true, true, false, true]);
  });
  it("keeps incomplete or invalid measurements pending and missing evidence unrecordable", () => {
    expect(evaluateSpecificity({ ...complete(), blankData: "0,0\n0," }, context).checks.every(c => c.pass == null)).toBe(true);
    expect(evaluateSpecificity({ ...complete(), matrixReference: "" }, context).canRecord).toBe(false);
    expect(evaluateSpecificity({ ...complete(), minBlanks: "0" }, context).errors.length).toBeGreaterThan(0);
    expect(evaluateSpecificity(complete(), { ...context, standardData: "0,100\n0,100" }).canRecord).toBe(false);
  });
  it("keeps a review current when equivalent saved fields have a different key order", () => {
    const settings = complete();
    const first = { ...context, preparation: '{"weight":1,"purity":99}' };
    const second = { reviewer: context.reviewer, ...context, preparation: '{"purity":99,"weight":1}' };
    expect(specificitySnapshot(settings, first)).toBe(specificitySnapshot(settings, second));
  });
  it("computes RT per peak and sample SD of summed injection areas rather than averaging individual RSDs", () => {
    const settings = { ...complete(), peakMode: true, peakNames: ["cis", "trans"], minStandards: "3", peakStandardData: "4,10,6,30\n4,12,6,28\n4,8,6,32", peakBlankData: "0,0,0,0\n0,0,0,0\n0,0,0,0" };
    const result = evaluateSpecificity(settings, context);
    expect(result.peaks[0].area?.rsd).toBe(20);
    expect(result.area?.mean).toBe(40);
    expect(result.area?.sd).toBe(0);
    expect(result.checks.find(check => check.name === "ผลรวม Area %RSD")?.pass).toBe(true);
    expect(result.peaks.map(peak => peak.rt?.mean)).toEqual([4, 6]);
  });
  it("checks both combined interference and an explicitly chosen per-peak denominator", () => {
    const settings = { ...complete(), peakMode: true, peakNames: ["P1", "P2"], peakStandardData: Array(6).fill("4,10,6,90").join("\n"), peakBlankData: "0,0.1,0,0\n0,0.1,0,0\n0,0.1,0,0" };
    expect(evaluateSpecificity(settings, context).checks.find(check => check.name === "Matrix Blank · P1")?.pass).toBe(true);
    expect(evaluateSpecificity({ ...settings, peakBlankBasis: "individual" }, context).checks.find(check => check.name === "Matrix Blank · P1")?.pass).toBe(false);
    const combined = evaluateSpecificity({ ...settings, peakBlankData: Array(3).fill("0,0.3,0,0.3").join("\n") }, context);
    expect(combined.matrixInterference).toBeCloseTo(0.6);
    expect(combined.checks.find(check => check.name === "Matrix Blank interference")?.pass).toBe(false);
  });
  it("requires a complete paired row for every peak and invalidates review when peak names change", () => {
    const settings = { ...complete(), peakMode: true, peakNames: ["P1", "P2"], peakStandardData: Array(6).fill("4,10,6,90").join("\n"), peakBlankData: Array(3).fill("0,0,0,0").join("\n") };
    const reviewed = { ...settings, reviewedAt: "2026-09-17T13:00:00Z", reviewedSnapshot: specificitySnapshot(settings, context) };
    expect(evaluateSpecificity(reviewed, context).current).toBe(true);
    expect(evaluateSpecificity({ ...reviewed, peakNames: ["P1", "changed"] }, context).current).toBe(false);
    expect(evaluateSpecificity({ ...settings, peakNames: ["P1"] }, context).canRecord).toBe(false);
    expect(evaluateSpecificity({ ...settings, peakStandardData: settings.peakStandardData + "\n4,10,6," }, context).checks.every(check => check.pass == null)).toBe(true);
  });
});
