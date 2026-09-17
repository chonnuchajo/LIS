import { describe, expect, it } from "vitest";
import { parseMeasurements, regression, stats } from "./validationCalculator";

describe("validation calculations", () => {
  it("reproduces report repeatability using sample SD", () => {
    const result = stats([102.1, 98.8, 99.1, 101.7, 95.8, 101.3, 100.8, 100.1, 101.2, 101.3]);
    expect(result?.mean).toBeCloseTo(100.22, 5);
    expect(result?.rsd).toBeCloseTo(1.8866458, 5);
    expect(stats([1])).toBeNull();
    expect(stats([0, 0])?.rsd).toBeNull();
  });
  it("fits a known calibration and rejects degenerate inputs", () => {
    const fit = regression([[1, 3], [2, 5], [3, 7]]);
    expect(fit?.slope).toBe(2);
    expect(fit?.intercept).toBe(1);
    expect(fit?.r2).toBe(1);
    expect(regression([[1, 1], [1, 2], [1, 3]])).toBeNull();
  });
  it("flags missing, nonnumeric and negative cells without treating blanks as zero", () => {
    const result = parseMeasurements("0.1\t25\n0.2,\nNaN,3\n-1,2", 2);
    expect(result.rows).toEqual([[0.1, 25]]);
    expect(result.errors).toHaveLength(3);
  });
});
