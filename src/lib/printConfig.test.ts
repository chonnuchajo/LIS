import { describe, it, expect } from "vitest";
import {
  PRINT_DOC_TYPES,
  getPrintDocType,
  isPrinterConfigured,
  validatePrintConfig,
  type PrintConfig,
} from "./printConfig";

describe("PRINT_DOC_TYPES", () => {
  it("has the known doc types incl. daily-check-report", () => {
    expect(PRINT_DOC_TYPES.map((d) => d.slug)).toEqual([
      "sample-label", "coa", "service-request", "stock-label", "daily-check-report",
    ]);
  });
  it("daily-check-report defaults to A4", () => {
    expect(getPrintDocType("daily-check-report")?.defaultPaper).toBe("A4");
  });
});

describe("getPrintDocType", () => {
  it("returns metadata for a known slug", () => {
    expect(getPrintDocType("coa")?.defaultPaper).toBe("A4");
    expect(getPrintDocType("sample-label")?.defaultPaper).toBe("label-100x50");
  });
});

describe("isPrinterConfigured", () => {
  it("false when printerName empty or missing", () => {
    expect(isPrinterConfigured(undefined)).toBe(false);
    expect(isPrinterConfigured({ slug: "coa", printerName: "", copies: 1, paperSize: "A4" })).toBe(false);
  });
  it("true when printerName set", () => {
    const cfg: PrintConfig = { slug: "coa", printerName: "HP-A4", copies: 1, paperSize: "A4" };
    expect(isPrinterConfigured(cfg)).toBe(true);
  });
  it("true when CUPS URL set", () => {
    const cfg: PrintConfig = {
      slug: "coa",
      printerName: "",
      cupsPrinterUrl: "https://192.168.0.237:631/printers/HP-A4",
      copies: 1,
      paperSize: "A4",
    };
    expect(isPrinterConfigured(cfg)).toBe(true);
  });
});

describe("validatePrintConfig", () => {
  it("passes a valid config", () => {
    expect(validatePrintConfig({ printerName: "HP", copies: 2, paperSize: "A4" })).toBeNull();
    expect(validatePrintConfig({ printerName: "Zebra", copies: 1, paperSize: "label-100x50" })).toBeNull();
  });
  it("passes a valid CUPS URL", () => {
    expect(validatePrintConfig({
      printerName: "",
      cupsPrinterUrl: "https://192.168.0.237:631/printers/HP-A4",
      copies: 1,
      paperSize: "A4",
    })).toBeNull();
  });
  it("rejects an invalid CUPS URL", () => {
    expect(validatePrintConfig({ printerName: "", cupsPrinterUrl: "not a url", copies: 1, paperSize: "A4" }))
      .toMatch(/CUPS URL/);
  });
  it("rejects copies < 1", () => {
    expect(validatePrintConfig({ printerName: "HP", copies: 0, paperSize: "A4" })).toMatch(/จำนวนชุด/);
  });
  it("rejects copies > 99", () => {
    expect(validatePrintConfig({ printerName: "HP", copies: 100, paperSize: "A4" })).toMatch(/จำนวนชุด/);
  });
  it("rejects bad paperSize", () => {
    expect(validatePrintConfig({ printerName: "HP", copies: 1, paperSize: "A3" as never })).toMatch(/paperSize/);
  });
});
