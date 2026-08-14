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
  pickPrinterAssignment,
  setPrintOutputMode,
  validatePrinterUrl,
  type PrinterConfig,
} from "./printConfig";

describe("PRINT_DOC_TYPES", () => {
  it("lists the six doc types with paper defaults", () => {
    expect(PRINT_DOC_TYPES.map((d) => d.slug)).toEqual([
      "sample-label", "coa", "service-request", "stock-label", "daily-check-report", "goods-receipt",
    ]);
    expect(getPrintDocType("daily-check-report")?.defaultPaper).toBe("A4");
    expect(getPrintDocType("sample-label")?.defaultPaper).toBe("label-100x50");
    expect(getPrintDocType("stock-label")?.defaultPaper).toBe("label-65x25");
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

describe("pickPrinterAssignment", () => {
  const list: PrinterConfig[] = [
    {
      id: "global-a4",
      kind: "a4",
      label: "Global A4",
      cupsPrinterUrl: "u1",
      isDefault: true,
      assignments: [{ department: "", docTypes: ["coa"], paperSize: "A4" }],
    },
    {
      id: "qc-a4",
      kind: "a4",
      label: "QC A4",
      cupsPrinterUrl: "u2",
      isDefault: false,
      assignments: [{ department: "QC", docTypes: ["coa", "service-request"], paperSize: "label-65x25" }],
    },
  ];

  it("uses exact department before all-department fallback", () => {
    expect(pickPrinterAssignment(list, "coa", "QC")?.printer.id).toBe("qc-a4");
    expect(pickPrinterAssignment(list, "coa", "Production")?.printer.id).toBe("global-a4");
  });

  it("returns undefined when no assignment matches the document", () => {
    expect(pickPrinterAssignment(list, "daily-check-report", "QC")).toBeUndefined();
  });
});

describe("validatePrinterUrl", () => {
  it("accepts direct printer IP and host", () => {
    expect(validatePrinterUrl("192.168.1.50")).toBeNull();
    expect(validatePrinterUrl("printer.local")).toBeNull();
  });

  it("accepts CUPS and IPP URLs", () => {
    expect(validatePrinterUrl("http://cups:631/printers/Zebra")).toBeNull();
    expect(validatePrinterUrl("ipps://printer.local:631/ipp/print")).toBeNull();
  });

  it("rejects invalid addresses", () => {
    expect(validatePrinterUrl("")).toMatch(/Printer IP \/ URL/);
    expect(validatePrinterUrl("not a url")).toMatch(/ไม่ถูกต้อง/);
    expect(validatePrinterUrl("ftp://printer.local/printers/x")).toMatch(/Printer IP \/ URL/);
  });
});
