import { describe, it, expect } from "vitest";
import {
  normalizeTimes,
  validateStandardConfigInput,
  MAX_COMMONNAME_LEN,
  MAX_TIMES,
  MIN_TIMES,
  type StandardConfigInput,
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
  });
  it("maps non-numeric to null", () => {
    expect(normalizeTimes("abc")).toBeNull();
  });
});

describe("validateStandardConfigInput", () => {
  const substance: StandardConfigInput = {
    instrument: "GC",
    scope: "substance",
    commonName: "ANILOFOS",
    times: 3,
    note: "",
  };
  const defaultRow: StandardConfigInput = {
    instrument: "HPLC",
    scope: "all",
    commonName: null,
    times: 1,
    note: "",
  };

  it("accepts a valid substance input", () => {
    expect(validateStandardConfigInput(substance)).toBeNull();
  });
  it("accepts a valid default (scope=all) input", () => {
    expect(validateStandardConfigInput(defaultRow)).toBeNull();
  });
  it("rejects a bad instrument", () => {
    expect(
      validateStandardConfigInput({ ...substance, instrument: "MS" as never })?.field,
    ).toBe("instrument");
  });
  it("rejects a bad scope", () => {
    expect(
      validateStandardConfigInput({ ...substance, scope: "weird" as never })?.field,
    ).toBe("scope");
  });
  it("rejects substance with empty commonName", () => {
    expect(validateStandardConfigInput({ ...substance, commonName: "  " })?.field).toBe(
      "commonName",
    );
  });
  it("rejects commonName over max length", () => {
    const long = "x".repeat(MAX_COMMONNAME_LEN + 1);
    expect(validateStandardConfigInput({ ...substance, commonName: long })?.field).toBe(
      "commonName",
    );
  });
  it("ignores commonName when scope=all", () => {
    expect(validateStandardConfigInput({ ...defaultRow, commonName: null })).toBeNull();
  });
  it("ignores a non-empty commonName when scope=all", () => {
    expect(validateStandardConfigInput({ ...defaultRow, commonName: "GARBAGE" })).toBeNull();
  });
  it("rejects times below minimum", () => {
    expect(validateStandardConfigInput({ ...substance, times: MIN_TIMES - 1 })?.field).toBe(
      "times",
    );
  });
  it("rejects null times", () => {
    expect(validateStandardConfigInput({ ...substance, times: null })?.field).toBe("times");
  });
  it("rejects decimal times", () => {
    expect(validateStandardConfigInput({ ...substance, times: 1.5 })?.field).toBe("times");
  });
  it("rejects times over max", () => {
    expect(validateStandardConfigInput({ ...substance, times: MAX_TIMES + 1 })?.field).toBe(
      "times",
    );
  });
});
