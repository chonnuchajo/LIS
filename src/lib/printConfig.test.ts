import { describe, it, expect } from "vitest";
import {
  PRINT_DOC_TYPES,
  PRINTER_KINDS,
  getPrintDocType,
  docTypeToKind,
  defaultPrinterFor,
  validatePrinterUrl,
  type PrinterConfig,
} from "./printConfig";

describe("PRINT_DOC_TYPES", () => {
  it("lists the five doc types with paper defaults", () => {
    expect(PRINT_DOC_TYPES.map((d) => d.slug)).toEqual([
      "sample-label", "coa", "service-request", "stock-label", "daily-check-report",
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
