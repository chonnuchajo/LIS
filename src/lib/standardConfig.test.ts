import { describe, it, expect } from "vitest";
import {
  normalizeTimes,
  validateStandardConfigInput,
  MAX_KEYWORD_LEN,
  MAX_TIMES,
} from "./standardConfig";

describe("normalizeTimes", () => {
  it("maps empty/null/undefined to null", () => {
    expect(normalizeTimes("")).toBeNull();
    expect(normalizeTimes(null)).toBeNull();
    expect(normalizeTimes(undefined)).toBeNull();
  });
  it("parses numeric strings and numbers", () => {
    expect(normalizeTimes("3")).toBe(3);
    expect(normalizeTimes(5)).toBe(5);
    expect(normalizeTimes(0)).toBe(0);
  });
  it("maps non-numeric to null", () => {
    expect(normalizeTimes("abc")).toBeNull();
  });
});

describe("validateStandardConfigInput", () => {
  const ok = { keyword: "ANILOFOS", gcTimes: 3, hplcTimes: null, note: "" };

  it("accepts a valid input", () => {
    expect(validateStandardConfigInput(ok)).toBeNull();
  });
  it("rejects empty keyword", () => {
    expect(validateStandardConfigInput({ ...ok, keyword: "  " })?.field).toBe("keyword");
  });
  it("rejects keyword over max length", () => {
    const long = "x".repeat(MAX_KEYWORD_LEN + 1);
    expect(validateStandardConfigInput({ ...ok, keyword: long })?.field).toBe("keyword");
  });
  it("rejects negative times", () => {
    expect(validateStandardConfigInput({ ...ok, gcTimes: -1 })?.field).toBe("gcTimes");
  });
  it("rejects decimal times", () => {
    expect(validateStandardConfigInput({ ...ok, gcTimes: 1.5 })?.field).toBe("gcTimes");
  });
  it("rejects times over max", () => {
    expect(validateStandardConfigInput({ ...ok, gcTimes: MAX_TIMES + 1 })?.field).toBe("gcTimes");
  });
  it("rejects when neither GC nor HPLC > 0", () => {
    expect(validateStandardConfigInput({ ...ok, gcTimes: 0, hplcTimes: null })?.field).toBe("gcTimes");
  });
  it("accepts HPLC-only", () => {
    expect(validateStandardConfigInput({ ...ok, gcTimes: null, hplcTimes: 2 })).toBeNull();
  });
});
