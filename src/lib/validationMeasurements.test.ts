import { describe, expect, it } from "vitest";
import { calibrationResult, evaluateLinkedMeasurements, type LinkedMeasurements, type ValidationCalibration, type ValidationMeasurement } from "./validationMeasurements";
const calibration: ValidationCalibration = { id: "CAL-1", name: "CAL-1", reference: "instrument.pdf page 2", mode: "equation", points: "", slope: "250", intercept: "1", min: "0.1", max: "1", r2: "0.99999" };
const row: ValidationMeasurement = { id: "ROW-1", sampleId: "A1", kind: "accuracy", day: "1", target: "0.5", calibrationId: "CAL-1", area: "126.3", stockId: "", aliquot: "250", finalVolume: "1000", matrix: "4", weight: "50.58", volume: "25", df: "1", density: "0", unspiked: "0.3" };
const settings = (): LinkedMeasurements => ({ enabled: ["accuracy"], calibrations: [calibration], rows: [row] });
describe("linked calibration and independent preparation", () => {
  it("computes Found from the selected equation and Actual from preparation without substituting Target", () => {
    const result = evaluateLinkedMeasurements(settings(), 2.01159, []);
    expect(result.errors).toEqual([]);
    expect(result.results[0].actual).toBeCloseTo(0.5028975, 8);
    expect(result.results[0].found).toBeCloseTo(0.5012, 8);
    expect(result.outputs.accuracy.split("\t").map(Number)).toEqual([0.5, 0.5028975, 0.5012]);
  });
  it("selects a different calibration and stock for each independent sample", () => {
    const input = settings();
    input.calibrations.push({ ...calibration, id: "CAL-2", name: "CAL-2", slope: "200", intercept: "0" });
    input.rows.push({ ...row, id: "ROW-2", sampleId: "A2", calibrationId: "CAL-2", area: "100", stockId: "S2", aliquot: "500" });
    const result = evaluateLinkedMeasurements(input, 2.01159, [{ id: "S2", name: "S2", weight: "25", purity: "100", volume: "25", certificate: "COA", preparedOn: "today" }]);
    expect(result.results.map(r => r.found)).toEqual([0.5012, 0.5]);
    expect(result.results.map(r => r.actual)).toEqual([0.5028975, 0.5]);
    expect(result.outputs.accuracy.split("\n")).toHaveLength(2);
  });
  it("blocks an entire enabled dataset rather than omitting invalid or out-of-range rows", () => {
    for (const patch of [{ area: "1000" }, { area: "" }, { calibrationId: "missing" }, { aliquot: "999" }]) {
      const input = settings();
      input.rows.push({ ...row, ...patch, id: "ROW-2", sampleId: "A2" });
      const result = evaluateLinkedMeasurements(input, 2, []);
      expect(result.outputs.accuracy).toBe("");
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });
  it("requires credible calibration inputs and evaluates OLS from at least three concentrations", () => {
    expect(calibrationResult({ ...calibration, reference: "" })).toBeNull();
    expect(calibrationResult({ ...calibration, slope: "0" })).toBeNull();
    expect(calibrationResult({ ...calibration, mode: "points", points: "0.1,26\n0.5,126\n1,251" })?.slope).toBeCloseTo(250);
    expect(calibrationResult({ ...calibration, mode: "points", points: "0.1,26\n0.1,26\n1,251" })).toBeNull();
    expect(evaluateLinkedMeasurements({ ...settings(), calibrations: [{ ...calibration, r2: "0.5" }] }, 2, []).outputs.accuracy).toBe("");
  });
  it("maps daily, sample and QC source data without applying dilution twice", () => {
    const input: LinkedMeasurements = { ...settings(), enabled: ["daily", "sample", "standard", "spike"], rows: [
      { ...row, kind: "daily" }, { ...row, kind: "sample", id: "sample" }, { ...row, kind: "standard", id: "standard" }, { ...row, kind: "spike", id: "spike", aliquot: "100" },
    ] };
    const result = evaluateLinkedMeasurements(input, 2, []);
    expect(result.errors).toEqual([]);
    expect(result.outputs.daily).toBe("1\t0.5\t0.5\t0.5012");
    expect(result.outputs.sample).toBe("50.58\t0.5012\t25\t1\t0");
    expect(result.outputs.standard).toBe("0.5012\t0.5");
    expect(result.outputs.spike).toBe("0.5012\t0.3\t0.2");
  });
  it("does not let duplicate preparations count as independent replicates", () => {
    const input = settings(); input.rows.push({ ...row, id: "ROW-2" });
    expect(evaluateLinkedMeasurements(input, 2, []).outputs.accuracy).toBe("");
  });
});
