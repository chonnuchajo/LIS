export type StandardConfigDoc = {
  _id: string;
  keyword: string;
  keywordLower: string;
  gcTimes: number | null;
  hplcTimes: number | null;
  note: string;
  createdAt?: string;
  updatedAt?: string;
};

export type StandardConfigInput = {
  keyword: string;
  gcTimes: number | null;
  hplcTimes: number | null;
  note?: string;
};

export type StandardConfigField = "keyword" | "gcTimes" | "hplcTimes";
export type ValidationError = { field: StandardConfigField; message: string };

export const MAX_KEYWORD_LEN = 200;
export const MAX_TIMES = 100000;

/**
 * Parse a raw times input (string | number | null) → number-or-null.
 * Empty/non-numeric → null. Floats pass through on purpose so
 * validateStandardConfigInput can reject them with a precise "must be integer"
 * message (returning null here would instead trigger the misleading
 * "fill at least one instrument" error). Integrality is enforced by the validator.
 */
export function normalizeTimes(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function validateStandardConfigInput(input: StandardConfigInput): ValidationError | null {
  const keyword = String(input.keyword ?? "").trim();
  if (!keyword) return { field: "keyword", message: "กรุณากรอก keyword" };
  if (keyword.length > MAX_KEYWORD_LEN) {
    return { field: "keyword", message: `keyword ยาวเกิน ${MAX_KEYWORD_LEN} ตัว` };
  }
  const checks: Array<["gcTimes" | "hplcTimes", number | null]> = [
    ["gcTimes", input.gcTimes],
    ["hplcTimes", input.hplcTimes],
  ];
  for (const [field, val] of checks) {
    if (val === null || val === undefined) continue;
    if (!Number.isInteger(val) || val < 0 || val > MAX_TIMES) {
      return { field, message: `จำนวนครั้งต้องเป็นจำนวนเต็ม 0–${MAX_TIMES}` };
    }
  }
  const gc = input.gcTimes ?? 0;
  const hplc = input.hplcTimes ?? 0;
  if (gc <= 0 && hplc <= 0) {
    return { field: "gcTimes", message: "ต้องกรอกจำนวนครั้งอย่างน้อย 1 เครื่อง (GC หรือ HPLC)" };
  }
  return null;
}
