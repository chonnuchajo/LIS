import { describe, expect, it } from "vitest";
import { syncLinearityConcentrations } from "./validationLinearitySync";
import type { PreparationLevel } from "./validationPreparation";
const level: PreparationLevel = { id: "std", purpose: "linearity", preparationKind: "std", target: "0.1", aliquot: "100", actualAliquot: "100", finalVolume: "1000", matrix: "0", recoveryLow: "90", recoveryHigh: "107" };
describe("live Linearity concentrations", () => {
  it("refreshes existing concentrations while retaining each injection's Area", () => {
    const original = "0.1\t25.399\n0.1\t25.041\n0.1\t";
    const result = syncLinearityConcentrations(original, [level], 1.044173, []);
    expect(result.split("\n").map(row => row.split("\t")[1])).toEqual(["25.399", "25.041", ""]);
    expect(Number(result.split("\t")[0])).toBeCloseTo(0.1044173, 10);
    const changed = syncLinearityConcentrations(result, [{ ...level, actualAliquot: "250" }], 1.044173, []);
    expect(Number(changed.split("\t")[0])).toBeCloseTo(0.26104325, 10);
  });
  it("handles direct stock, changed final volume and missing preparation without stale values", () => {
    expect(syncLinearityConcentrations("", [{ ...level, useStockDirect: true }], 1.044173, []).split("\n")).toEqual(Array(3).fill("1.044173\t"));
    expect(syncLinearityConcentrations("", [{ ...level, finalVolume: "2000" }], 2, []).split("\n")[0]).toBe("0.1\t");
    expect(syncLinearityConcentrations("0.1\t25.399", [{ ...level, actualAliquot: "" }], 2, []).split("\n")[0]).toBe("\t25.399");
  });
});
