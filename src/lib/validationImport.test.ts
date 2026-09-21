import { describe, expect, it } from "vitest";
import { prepareValidationImport } from "./validationImport";

describe("นำเข้าและแปลงหน่วย Validation", () => {
  it("converts mixed units per column without scaling Area or mass fraction", () => {
    const result = prepareValidationImport("0.5\t502.8975\t501.2\t126.3\t0.25", ["Target", "Actual", "Found", "Area", "C"], { 0: "mg/mL", 1: "µg/mL", 2: "mg/L" });
    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toEqual([0.5, 0.5028975, 0.5012, 126.3, 0.25]);
    expect(result.text).toBe("0.5\t0.5028975\t0.5012\t126.3\t0.25");
  });
  it("supports an explicit header and BOM while preserving source line numbers", () => {
    const result = prepareValidationImport("\uFEFFconc,area\r\n100,25\r\n250,\r\n", ["Actual", "Area"], { 0: "µg/mL" }, true);
    expect(result.errors[0]).toContain("แถว 3");
    expect(result.text).toBeNull();
    expect(result.rows).toEqual([]);
    expect(prepareValidationImport("conc,area\n100,25", ["Actual", "Area"], {}, false).text).toBeNull();
  });
  it("rejects incomplete, extra, negative, nonfinite, and underflow values atomically", () => {
    for (const source of ["1,2\n3,", "1,2,3", "-1,2", "Infinity,2", "0x10,2", "1e-400,2", "5e-324,2", "1 mg/L,2"]) {
      const result = prepareValidationImport(source, ["Actual", "Area"], { 0: "µg/mL" });
      expect(result.text, source).toBeNull();
      expect(result.rows, source).toEqual([]);
    }
  });
  it("accepts decimal/scientific notation and zero without rounding for display", () => {
    expect(prepareValidationImport("5.028975e2;0\n500.;1.23", ["Actual", "Area"], { 0: "mg/L" }).rows).toEqual([[0.5028975, 0], [0.5, 1.23]]);
    expect(prepareValidationImport("", ["Actual"], {}).text).toBeNull();
    expect(prepareValidationImport("1".repeat(200001), ["Actual"], {}).text).toBeNull();
  });
});
