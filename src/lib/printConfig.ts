export type PrintDocType = "sample-label" | "coa" | "service-request" | "stock-label" | "daily-check-report" | "goods-receipt";
export type PaperSize = "A4" | "label-100x50" | "label-6x4";
export type PrinterKind = "a4" | "sticker";
export type PrintOutputMode = "server" | "local";

export const A4_PRINT_FONT_FAMILY = "'Angsana New', 'Cordia New', 'Sarabun', 'TH SarabunPSK', serif";
export const A4_PRINT_FONT_SIZE = "16pt";
export const A4_PRINT_HEADING_FONT_WEIGHT = "700";

export interface PrinterConfig {
  id: string;
  kind: PrinterKind;
  label: string;
  cupsPrinterUrl: string;
  isDefault: boolean;
}

export interface PrinterConfigInput {
  kind: PrinterKind;
  label?: string;
  cupsPrinterUrl: string;
}

// Legacy per-document config shape kept temporarily so screens can keep using
// the old contract while the UI migrates to the printer registry.
export interface PrintConfig {
  slug: PrintDocType;
  printerName: string;
  cupsPrinterUrl: string;
  copies: number;
  paperSize: PaperSize;
}

export interface PrintConfigInput {
  printerName?: string;
  cupsPrinterUrl?: string;
  copies?: number;
  paperSize?: PaperSize;
}

export interface PrinterKindMeta {
  kind: PrinterKind;
  label: string;
  hint: string;
}

export const PRINTER_KINDS: PrinterKindMeta[] = [
  { kind: "a4", label: "A4", hint: "COA / ใบคำขอ / รายงาน Daily Check" },
  { kind: "sticker", label: "Sticker (ฉลาก)", hint: "ป้ายนำส่งตัวอย่าง / ฉลากขวด Standard" },
];

// เอกสารแต่ละชนิดพิมพ์ไปเครื่องชนิดไหน — mirror ของ server/lib/printerRouting.js
const DOC_TYPE_KIND: Record<PrintDocType, PrinterKind> = {
  "sample-label": "sticker",
  "stock-label": "sticker",
  "coa": "a4",
  "service-request": "a4",
  "daily-check-report": "a4",
  "goods-receipt": "a4",
};

export function docTypeToKind(docType: PrintDocType): PrinterKind {
  return DOC_TYPE_KIND[docType];
}

const PRINT_OUTPUT_MODE_STORAGE_PREFIX = "lis.print.outputMode.";

function storageKeyForKind(kind: PrinterKind): string {
  return `${PRINT_OUTPUT_MODE_STORAGE_PREFIX}${kind}`;
}

function normalizePrintOutputMode(value: unknown): PrintOutputMode {
  return value === "local" ? "local" : "server";
}

export function getPrintOutputMode(kind: PrinterKind): PrintOutputMode {
  if (typeof window === "undefined") return "server";
  try {
    return normalizePrintOutputMode(window.localStorage.getItem(storageKeyForKind(kind)));
  } catch {
    return "server";
  }
}

export function getPrintOutputModeForDocType(docType: PrintDocType): PrintOutputMode {
  return getPrintOutputMode(docTypeToKind(docType));
}

export function setPrintOutputMode(kind: PrinterKind, mode: PrintOutputMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKeyForKind(kind), normalizePrintOutputMode(mode));
  } catch {
    // localStorage can be unavailable in private/locked-down browser contexts.
  }
}

export function getPrintFontFamilyForDocType(docType: PrintDocType): string | undefined {
  return docTypeToKind(docType) === "a4" ? A4_PRINT_FONT_FAMILY : undefined;
}

export function getPrintFontSizeForDocType(docType: PrintDocType): string | undefined {
  return docTypeToKind(docType) === "a4" ? A4_PRINT_FONT_SIZE : undefined;
}

export function getPrintHeadingFontWeightForDocType(docType: PrintDocType): string | undefined {
  return docTypeToKind(docType) === "a4" ? A4_PRINT_HEADING_FONT_WEIGHT : undefined;
}

export interface PrintDocTypeMeta {
  slug: PrintDocType;
  label: string;
  defaultPaper: PaperSize;
}

export const PRINT_DOC_TYPES: PrintDocTypeMeta[] = [
  { slug: "sample-label",    label: "ป้ายนำส่งตัวอย่าง", defaultPaper: "label-100x50" },
  { slug: "coa",             label: "ใบรายงานผล (COA)",            defaultPaper: "A4" },
  { slug: "service-request", label: "ใบคำขอ (Petition)",            defaultPaper: "A4" },
  { slug: "stock-label",     label: "ฉลากขวด Standard (sticker)", defaultPaper: "label-6x4" },
  { slug: "daily-check-report", label: "รายงานเช็กเครื่องมือ (Daily Check)", defaultPaper: "A4" },
  { slug: "goods-receipt", label: "ใบรับสินค้า/ใบตรวจสอบวัตถุดิบ (RM)", defaultPaper: "A4" },
];

export function getPrintDocType(slug: PrintDocType): PrintDocTypeMeta | undefined {
  return PRINT_DOC_TYPES.find((d) => d.slug === slug);
}

// เครื่องที่ระบบใช้พิมพ์ของ kind นั้น — ตัวที่ตั้ง default ไว้ ไม่งั้นตัวแรก
export function defaultPrinterFor(
  configs: PrinterConfig[] | undefined | null,
  kind: PrinterKind,
): PrinterConfig | undefined {
  const ofKind = (configs ?? []).filter((c) => c.kind === kind);
  return ofKind.find((c) => c.isDefault) ?? ofKind[0];
}

export function isPrinterConfigured(config?: PrintConfig | null): boolean {
  if (!config) return false;
  return Boolean(config.cupsPrinterUrl?.trim() || config.printerName?.trim());
}

// mirror ของ validatePrinterInput ใน server/lib/printerRouting.js
export function validatePrinterUrl(url: string): string | null {
  const raw = (url ?? "").trim();
  if (!raw) return "ต้องระบุ CUPS printer URL";
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return "CUPS URL ไม่ถูกต้อง";
  }
  if (!["http:", "https:", "ipp:", "ipps:"].includes(u.protocol)) {
    return "CUPS URL ต้องเป็น http, https, ipp หรือ ipps";
  }
  const parts = u.pathname.split("/").filter(Boolean);
  const qi = parts.findIndex((p) => p === "printers" || p === "classes");
  if (qi < 0 || !parts[qi + 1]) {
    return "CUPS URL ต้องระบุ queue เช่น https://192.168.0.237:631/printers/PRINTER_NAME";
  }
  return null;
}

export function validatePrintConfig(input: PrintConfigInput): string | null {
  const printerName = (input.printerName ?? "").trim();
  const cupsPrinterUrl = (input.cupsPrinterUrl ?? "").trim();
  if (!printerName && !cupsPrinterUrl) {
    return "ต้องระบุ CUPS printer URL";
  }
  if (!cupsPrinterUrl) return null;
  return validatePrinterUrl(cupsPrinterUrl);
}
