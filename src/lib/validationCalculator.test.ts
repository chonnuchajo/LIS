import { describe, expect, it } from "vitest";
import { horwitz, intermediatePrecision, parseMeasurements, regression, stats } from "./validationCalculator";

describe("validation calculations", () => {
  it("uses decimal mass fraction for Horwitz and explicit CIPAC factor", () => {
    expect(horwitz(1)).toBe(2);
    expect(horwitz(1, 0.67)).toBe(1.34);
    expect(horwitz(0.01)).toBe(4);
    expect(horwitz(25)).toBeNull();
  });
  it("includes within-day variation rather than only SD of daily means", () => {
    const result = intermediatePrecision([[99, 101], [101, 103]]);
    expect(result?.mean).toBe(101);
    expect(result?.msWithin).toBeCloseTo(2);
    expect(result?.msBetween).toBeCloseTo(4);
    expect(result?.sd).toBeCloseTo(Math.sqrt(3));
    expect(intermediatePrecision([[99, 101], [101]])).toBeNull();
    expect(intermediatePrecision([[99, 101], [99, 101]])?.betweenSd).toBe(0);
  });
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
  it("does not trim away empty edge columns or an unfinished table row", () => {
    const result = parseMeasurements("\t1\t2\n1\t2\t\n\t\n 1 \t 2 ", 2);
    expect(result.rows).toEqual([[1, 2]]);
    expect(result.errors).toHaveLength(3);
  });
  it("rejects overflowing numerical results", () => {
    expect(stats([1e308, 1e308])).toBeNull();
    expect(regression([[1e308, 1e308], [1, 2], [2, 4]])).toBeNull();
    expect(intermediatePrecision([[1e308, 1e308], [1e308, 1e308]])).toBeNull();
  });
});
