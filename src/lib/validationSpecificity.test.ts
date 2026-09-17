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
});
