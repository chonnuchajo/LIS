import { parseStandardLabelCode } from "@/lib/standardLabelCode";
export type CartCategory = "standard" | "solvent" | "glassware";

export interface ReceiveScanOption {
  category: CartCategory;
  id: string;
  code: string;
  name: string;
  label: string;
  barcodes?: string[];
  sizeLiter?: number;
  price?: number;
}

export interface CartRow {
  id: string;
  category: CartCategory | null;
  itemId: string;
  itemName: string;
  itemCode: string; // standard code; "" สำหรับ solvent/glassware
  barcode: string;
  // standard
  type: "primary" | "supplier" | "working" | "";
  sizeMl: string;
  purity: string;
  count: string;
  sameExp: boolean;
  commonExp: string;
  perExp: string[];
  labelCodes: string[];
  // solvent
  qty: string;
  sizeLiter: string;
  price: string;
  exp: string;
  // shared
  lotNo: string;
  note: string;
}

let rowSeq = 0;
export function makeEmptyRow(): CartRow {
  rowSeq += 1;
  return {
    id: `row_${rowSeq}`,
    category: null,
    itemId: "",
    itemName: "",
    itemCode: "",
    barcode: "",
    type: "primary",
    sizeMl: "100",
    purity: "",
    count: "1",
    sameExp: true,
    commonExp: "",
    perExp: [""],
    labelCodes: [],
    qty: "1",
    sizeLiter: "",
    price: "",
    exp: "",
    lotNo: "",
    note: "",
  };
}

export function sanitizeDecimalInput(value: string, maxDecimals = 4): string {
  const cleaned = value.replace(/[^\d.]/g, "");
  const [integerPart, ...decimalParts] = cleaned.split(".");
  if (decimalParts.length === 0) return integerPart;
  return `${integerPart}.${decimalParts.join("").slice(0, maxDecimals)}`;
}

export function sanitizeIntegerInput(value: string): string {
  return value.replace(/\D/g, "");
}

function isPositiveDecimalWithMaxPlaces(value: string, maxDecimals = 4): boolean {
  const raw = value.trim();
  if (!new RegExp(`^\\d+(?:\\.\\d{1,${maxDecimals}})?$`).test(raw)) return false;
  const number = Number(raw);
  return Number.isFinite(number) && number > 0;
}

function receiveRowPatch(option: ReceiveScanOption) {
  return {
    category: option.category,
    itemId: option.id,
    itemName: option.name,
    itemCode: option.code,
    barcode: "",
    ...(option.category === "standard" ? { type: "primary" as const } : {}),
    ...(option.category === "solvent" ? {
      sizeLiter: option.sizeLiter && option.sizeLiter > 0 ? String(option.sizeLiter) : "",
      price: option.price != null ? String(option.price) : "",
    } : {}),
  };
}

function addScannedRow(rows: CartRow[], patch: Partial<CartRow>): CartRow[] {
  const hasExistingItem = rows.some((row) => row.itemId);
  const emptyIndex = rows.findIndex((row) => !row.itemId);

  if (!hasExistingItem && emptyIndex >= 0) {
    return rows.map((row, index) => (index === emptyIndex ? { ...row, ...patch } : row));
  }

  return [{ ...makeEmptyRow(), ...patch }, ...rows];
}


export function findReceiveScanMatch(scanText: string, options: ReceiveScanOption[]): ReceiveScanOption | null {
  const raw = scanText.trim();
  if (!raw) return null;
  const normalized = raw.toLowerCase();
  const exactMatch = options.find((option) => {
    const values = [option.code, option.name, option.label, option.id, ...(option.barcodes ?? [])]
      .filter(Boolean)
      .map((value) => String(value).trim().toLowerCase());
    return values.some((value) => value === normalized);
  });
  if (exactMatch) return exactMatch;
  if (/^\d+$/.test(normalized)) return null;

  return options.find((option) => {
    const values = [option.code, option.name, option.label, ...(option.barcodes ?? [])]
      .filter(Boolean)
      .map((value) => String(value).trim().toLowerCase());
    return values.some((value) => value.includes(normalized));
  }) ?? null;
}


export function applyReceiveScanMatch(rows: CartRow[], option: ReceiveScanOption): CartRow[] {
  return addScannedRow(rows, receiveRowPatch(option));
}

export function applyReceiveBarcodeRegistration(rows: CartRow[], barcode: string, option: ReceiveScanOption): CartRow[] {
  const normalized = barcode.trim();
  if (!normalized) return rows;

  const patch = { ...receiveRowPatch(option), barcode: normalized };
  return addScannedRow(rows, patch);
}

const REQUIRED_LOT_NO_MESSAGE = "กรุณาระบุ Lot No";
const REQUIRED_EXP_MESSAGE = "กรุณาระบุ EXP";

function hasText(value: string | undefined): boolean {
  return Boolean(value && value.trim());
}

function formatSolventSizeLabel(value: string | undefined): string {
  const raw = value?.trim() ?? "";
  if (!raw) return "";
  return /\bL\b/i.test(raw) ? raw : `${raw} L`;
}

/** คืน error string ถ้าไม่ผ่าน, null ถ้าผ่าน */
export function validateRow(row: CartRow): string | null {
  if (!row.category || !row.itemId) return "ยังไม่ได้เลือกของ";
  if (row.category === "standard") {
    if (!isPositiveDecimalWithMaxPlaces(row.sizeMl, 4)) return "ปริมาณต้องเป็นตัวเลข และทศนิยมไม่เกิน 4 ตำแหน่ง";
    const c = Number(row.count);
    if (!Number.isInteger(c) || c < 1) return "จำนวนขวดต้องเป็นจำนวนเต็มบวก";
    if (row.type !== "primary" && row.type !== "supplier" && row.type !== "working") return "ต้องเลือกประเภท";
    if (!hasText(row.lotNo)) return REQUIRED_LOT_NO_MESSAGE;
    if (!hasText(row.purity)) return "กรุณาระบุ % Purity";
    const labelCodes = Array.from({ length: c }, (_, i) => row.labelCodes[i]?.trim() ?? "");
    if (labelCodes.some((code) => !parseStandardLabelCode(code, row.itemCode))) return "กรุณาระบุ Code ให้ถูกต้อง";
    if (row.sameExp) {
      if (!hasText(row.commonExp)) return REQUIRED_EXP_MESSAGE;
    } else {
      const missingExp = Array.from({ length: c }, (_, i) => !hasText(row.perExp[i])).some(Boolean);
      if (missingExp) return REQUIRED_EXP_MESSAGE;
    }
    return null;
  }
  const q = Number(row.qty);
  if (!Number.isInteger(q) || q < 1) return "จำนวนต้องเป็นจำนวนเต็มบวก";
  if (row.category === "solvent") {
    if (!hasText(row.lotNo)) return REQUIRED_LOT_NO_MESSAGE;
    if (!hasText(row.exp)) return REQUIRED_EXP_MESSAGE;
    if (!hasText(row.sizeLiter)) return "กรุณาระบุขนาด/ขวด";
    if (!(Number(row.sizeLiter) > 0)) return "ขนาด/ขวดไม่ถูกต้อง";
    if (!hasText(row.price)) return "กรุณาระบุราคา";
    const price = Number(row.price);
    if (!Number.isFinite(price) || price < 0) return "ราคาไม่ถูกต้อง";
  }
  return null;
}

export function buildBottles(row: CartRow): { exp?: string; labelCode?: string }[] {
  const n = Math.max(1, Number(row.count) || 1);
  return Array.from({ length: n }, (_, i) => {
    const labelCode = row.labelCodes[i]?.trim();
    return {
      exp: row.sameExp ? row.commonExp || undefined : row.perExp[i] || undefined,
      ...(labelCode ? { labelCode } : {}),
    };
  });
}

export function composeSolventNote(row: CartRow): string {
  const parts: string[] = [];
  if (row.lotNo) parts.push(`lot ${row.lotNo}`);
  if (row.exp) parts.push(`exp ${row.exp}`);
  if (row.sizeLiter) parts.push(`ขนาด ${formatSolventSizeLabel(row.sizeLiter)}`);
  if (row.price) parts.push(`ราคา ${row.price.trim()} บาท`);
  if (row.note) parts.push(row.note);
  return parts.join(" · ");
}
