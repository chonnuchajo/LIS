import { describe, it, expect } from "vitest";
import {
  PRINT_DOC_TYPES,
  PRINTER_KINDS,
  A4_PRINT_FONT_FAMILY,
  A4_PRINT_FONT_SIZE,
  A4_PRINT_HEADING_FONT_WEIGHT,
  getPrintDocType,
  getPrintFontFamilyForDocType,
  getPrintFontSizeForDocType,
  getPrintHeadingFontWeightForDocType,
  docTypeToKind,
  defaultPrinterFor,
  getPrintOutputMode,
  getPrintOutputModeForDocType,
  setPrintOutputMode,
  validatePrinterUrl,
  type PrinterConfig,
} from "./printConfig";

describe("PRINT_DOC_TYPES", () => {
  it("lists the five doc types with paper defaults", () => {
    expect(PRINT_DOC_TYPES.map((d) => d.slug)).toEqual([
      "sample-label", "coa", "service-request", "stock-label", "daily-check-report", "goods-receipt",
    ]);
    expect(getPrintDocType("daily-check-report")?.defaultPaper).toBe("A4");
    expect(getPrintDocType("sample-label")?.defaultPaper).toBe("label-100x50");
  });
});

describe("PRINTER_KINDS", () => {
  it("has A4 and Sticker", () => {
    expect(PRINTER_KINDS.map((k) => k.kind)).toEqual(["a4", "sticker"]);
  });
});

describe("docTypeToKind", () => {
  it("routes labels to sticker and docs to a4", () => {
    expect(docTypeToKind("sample-label")).toBe("sticker");
    expect(docTypeToKind("stock-label")).toBe("sticker");
    expect(docTypeToKind("coa")).toBe("a4");
    expect(docTypeToKind("service-request")).toBe("a4");
    expect(docTypeToKind("daily-check-report")).toBe("a4");
    expect(docTypeToKind("goods-receipt")).toBe("a4");
  });
});

describe("print output mode", () => {
  it("defaults to server and can store local per printer kind", () => {
    localStorage.clear();
    expect(getPrintOutputMode("a4")).toBe("server");
    expect(getPrintOutputModeForDocType("coa")).toBe("server");

    setPrintOutputMode("a4", "local");

    expect(getPrintOutputMode("a4")).toBe("local");
    expect(getPrintOutputModeForDocType("service-request")).toBe("local");
    expect(getPrintOutputModeForDocType("sample-label")).toBe("server");
  });
});

describe("print font policy", () => {
  it("uses Angsana New for every A4 document type", () => {
    expect(A4_PRINT_FONT_FAMILY).toContain("'Angsana New'");
    expect(getPrintFontFamilyForDocType("coa")).toBe(A4_PRINT_FONT_FAMILY);
    expect(getPrintFontFamilyForDocType("service-request")).toBe(A4_PRINT_FONT_FAMILY);
    expect(getPrintFontFamilyForDocType("daily-check-report")).toBe(A4_PRINT_FONT_FAMILY);
  });

  it("uses 16pt body text and bold headings for every A4 document type", () => {
    expect(A4_PRINT_FONT_SIZE).toBe("16pt");
    expect(A4_PRINT_HEADING_FONT_WEIGHT).toBe("700");
    expect(getPrintFontSizeForDocType("coa")).toBe(A4_PRINT_FONT_SIZE);
    expect(getPrintFontSizeForDocType("service-request")).toBe(A4_PRINT_FONT_SIZE);
    expect(getPrintFontSizeForDocType("daily-check-report")).toBe(A4_PRINT_FONT_SIZE);
    expect(getPrintHeadingFontWeightForDocType("coa")).toBe(A4_PRINT_HEADING_FONT_WEIGHT);
    expect(getPrintHeadingFontWeightForDocType("service-request")).toBe(A4_PRINT_HEADING_FONT_WEIGHT);
    expect(getPrintHeadingFontWeightForDocType("daily-check-report")).toBe(A4_PRINT_HEADING_FONT_WEIGHT);
  });

  it("does not apply the A4 font policy to sticker documents", () => {
    expect(getPrintFontFamilyForDocType("sample-label")).toBeUndefined();
    expect(getPrintFontFamilyForDocType("stock-label")).toBeUndefined();
    expect(getPrintFontSizeForDocType("sample-label")).toBeUndefined();
    expect(getPrintFontSizeForDocType("stock-label")).toBeUndefined();
    expect(getPrintHeadingFontWeightForDocType("sample-label")).toBeUndefined();
    expect(getPrintHeadingFontWeightForDocType("stock-label")).toBeUndefined();
  });
});

describe("defaultPrinterFor", () => {
  const list: PrinterConfig[] = [
    { id: "1", kind: "a4", label: "", cupsPrinterUrl: "u1", isDefault: false },
    { id: "2", kind: "a4", label: "", cupsPrinterUrl: "u2", isDefault: true },
    { id: "3", kind: "sticker", label: "", cupsPrinterUrl: "u3", isDefault: false },
  ];
  it("returns the flagged default of the kind", () => {
    expect(defaultPrinterFor(list, "a4")?.id).toBe("2");
  });
  it("falls back to the first of the kind", () => {
    expect(defaultPrinterFor(list, "sticker")?.id).toBe("3");
  });
  it("undefined when none / empty", () => {
    expect(defaultPrinterFor([], "a4")).toBeUndefined();
    expect(defaultPrinterFor(undefined, "a4")).toBeUndefined();
  });
});

describe("validatePrinterUrl", () => {
  it("passes a valid CUPS URL", () => {
    expect(validatePrinterUrl("https://192.168.0.237:631/printers/HP-A4")).toBeNull();
  });
  it("rejects empty", () => {
    expect(validatePrinterUrl("")).toMatch(/CUPS printer URL/);
  });
  it("rejects a non-url", () => {
    expect(validatePrinterUrl("not a url")).toMatch(/ไม่ถูกต้อง/);
  });
  it("rejects wrong protocol", () => {
    expect(validatePrinterUrl("ftp://host/printers/x")).toMatch(/http/);
  });
  it("rejects a url with no queue", () => {
    expect(validatePrinterUrl("https://192.168.0.237:631/")).toMatch(/queue/);
  });
});
