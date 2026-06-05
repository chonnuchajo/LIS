export type PrintDocType = "sample-label" | "coa" | "service-request" | "production-plan";
export type PaperSize = "A4" | "label-6x4";

export interface PrintConfig {
  slug: PrintDocType;
  printerName: string;
  copies: number;
  paperSize: PaperSize;
}

export interface PrintConfigInput {
  printerName: string;
  copies?: number;
  paperSize?: PaperSize;
}

export interface PrintDocTypeMeta {
  slug: PrintDocType;
  label: string;
  defaultPaper: PaperSize;
}

export const PRINT_DOC_TYPES: PrintDocTypeMeta[] = [
  { slug: "sample-label",    label: "ฉลากตัวอย่าง (sticker 6x4)", defaultPaper: "label-6x4" },
  { slug: "coa",             label: "ใบรายงานผล (COA)",            defaultPaper: "A4" },
  { slug: "service-request", label: "ใบคำขอ (Petition)",            defaultPaper: "A4" },
  { slug: "production-plan", label: "ใบวางแผนผลิต",                 defaultPaper: "A4" },
];

export function getPrintDocType(slug: PrintDocType): PrintDocTypeMeta | undefined {
  return PRINT_DOC_TYPES.find((d) => d.slug === slug);
}

export function isPrinterConfigured(cfg: PrintConfig | undefined | null): boolean {
  return !!cfg && typeof cfg.printerName === "string" && cfg.printerName.trim().length > 0;
}

// mirror ของ validate() ใน server/routes/print.js (copies 1–99)
export function validatePrintConfig(input: PrintConfigInput): string | null {
  if (typeof input.printerName !== "string") return "printerName ต้องเป็นข้อความ";
  if (input.copies != null && (!Number.isInteger(input.copies) || input.copies < 1 || input.copies > 99)) {
    return "จำนวนชุดต้องเป็นจำนวนเต็ม 1–99";
  }
  if (input.paperSize != null && !["A4", "label-6x4"].includes(input.paperSize)) {
    return "paperSize ไม่ถูกต้อง";
  }
  return null;
}
