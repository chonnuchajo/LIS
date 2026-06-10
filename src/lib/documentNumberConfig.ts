// Mirror of server/lib/documentNumber.js — keep buildPreview/validate in sync
// with buildScanPrefix/validateDocNumberConfig on the server.

export type DocNumberType = "petition" | "sampleReceipt" | "labRequest";
export type YearFormat = "none" | "yy" | "yyyy";

export interface DocumentNumberConfig {
  docType: DocNumberType;
  prefix: string;
  yearFormat: YearFormat;
  includeMonth: boolean;
  seqPadding: number;
  separator: string;
}

export type DocumentNumberConfigInput = Omit<DocumentNumberConfig, "docType">;

export interface DocNumberTypeMeta {
  docType: DocNumberType;
  label: string;
  hint: string;
}

export const DOC_NUMBER_TYPES: DocNumberTypeMeta[] = [
  { docType: "petition",      label: "เลขคำร้อง (Petition)",        hint: "เลขที่ออกตอนสร้างคำร้องใหม่" },
  { docType: "sampleReceipt", label: "เลขรับตัวอย่าง (Sample Receipt)", hint: "เลขที่ออกตอนรับตัวอย่างเข้าระบบ" },
  { docType: "labRequest",    label: "เลขใบคำขอ Lab (Lab Request)", hint: "เลขที่ออกตอนสร้างใบคำขอรับบริการ" },
];

export const DOC_NUMBER_DEFAULTS: Record<DocNumberType, DocumentNumberConfigInput> = {
  petition:      { prefix: "P",   yearFormat: "yy",   includeMonth: true,  seqPadding: 4, separator: "-" },
  sampleReceipt: { prefix: "RCV", yearFormat: "yyyy", includeMonth: false, seqPadding: 4, separator: "-" },
  labRequest:    { prefix: "L",   yearFormat: "yy",   includeMonth: true,  seqPadding: 4, separator: "-" },
};

const SAMPLE_SEQ = 43; // illustrative running number for the preview

function buildScanPrefix(cfg: DocumentNumberConfigInput, now: Date): string {
  const sep = cfg.separator ?? "";
  const yyyy = String(now.getFullYear());
  const yy = yyyy.slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");

  let datePart = "";
  if (cfg.yearFormat === "yyyy") datePart += yyyy;
  else if (cfg.yearFormat === "yy") datePart += yy;
  if (cfg.includeMonth) datePart += mm;

  const segments: string[] = [];
  if (cfg.prefix) segments.push(cfg.prefix);
  if (datePart) segments.push(datePart);
  let prefix = segments.join(sep);
  if (segments.length > 0) prefix += sep;
  return prefix;
}

// Illustrative "next number" string for live preview.
export function buildPreview(cfg: DocumentNumberConfigInput, now: Date = new Date()): string {
  const scanPrefix = buildScanPrefix(cfg, now);
  const pad = Math.max(1, Math.min(10, cfg.seqPadding || 1));
  return `${scanPrefix}${String(SAMPLE_SEQ).padStart(pad, "0")}`;
}

// Returns a Thai error string or null. Mirror of validateDocNumberConfig in
// server/lib/documentNumber.js.
export function validateDocNumberConfig(input: DocumentNumberConfigInput): string | null {
  if (typeof input.prefix !== "string") return "prefix ต้องเป็นข้อความ";
  if (!["none", "yy", "yyyy"].includes(input.yearFormat)) return "yearFormat ไม่ถูกต้อง";
  if (typeof input.separator !== "string" || input.separator.length > 3) return "ตัวคั่นต้องไม่เกิน 3 ตัว";
  if (!Number.isInteger(input.seqPadding) || input.seqPadding < 1 || input.seqPadding > 10) return "จำนวนหลัก running ต้องเป็นจำนวนเต็ม 1–10";
  const hasPrefix = input.prefix.trim().length > 0;
  const hasYear = input.yearFormat !== "none";
  if (!hasPrefix && !hasYear) return "ต้องมี prefix หรือปี อย่างน้อย 1 อย่าง (กันเลขเดินผิด)";
  if (input.yearFormat === "none" && input.includeMonth) return "ถ้าใส่เดือน ต้องเลือกปีด้วย (กันเลขชนข้ามปี)";
  return null;
}
