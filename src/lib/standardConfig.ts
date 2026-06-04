export type Instrument = string; // a Method registry code
export type Scope = "all" | "substance";

export type StandardConfigDoc = {
  _id: string;
  instrument: Instrument;
  scope: Scope;
  commonName: string | null;
  commonNameLower: string | null;
  times: number;
  isDefault: boolean;
  note: string;
  createdAt?: string;
  updatedAt?: string;
};

export type StandardConfigInput = {
  instrument: Instrument;
  scope: Scope;
  commonName: string | null;
  times: number | null;
  note?: string;
};

export type StandardConfigField = "instrument" | "scope" | "commonName" | "times";
export type ValidationError = { field: StandardConfigField; message: string };

export const MAX_COMMONNAME_LEN = 200;
export const MAX_TIMES = 100000;
export const MIN_TIMES = 1;

/**
 * Parse a raw times input (string | number | null) → number-or-null.
 * Empty/non-numeric → null. Floats pass through ON PURPOSE: validateStandardConfigInput
 * rejects them with a precise "must be integer" message. Rounding/truncating here would
 * hide the user's mistake; returning null here would trigger a misleading "times required".
 */
export function normalizeTimes(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function validateStandardConfigInput(
  input: StandardConfigInput,
  validCodes: Set<string>,
): ValidationError | null {
  if (!input.instrument || !validCodes.has(input.instrument)) {
    return { field: "instrument", message: "กรุณาเลือกวิธีทดสอบ" };
  }
  if (input.scope !== "all" && input.scope !== "substance") {
    return { field: "scope", message: "scope ไม่ถูกต้อง" };
  }
  if (input.scope === "substance") {
    const cn = String(input.commonName ?? "").trim();
    if (!cn) return { field: "commonName", message: "กรุณาเลือกสาร (commonName)" };
    if (cn.length > MAX_COMMONNAME_LEN) {
      return { field: "commonName", message: `ชื่อสารยาวเกิน ${MAX_COMMONNAME_LEN} ตัว` };
    }
  }
  const t = input.times;
  if (t === null || t === undefined || !Number.isInteger(t) || t < MIN_TIMES || t > MAX_TIMES) {
    return { field: "times", message: `จำนวนครั้งต้องเป็นจำนวนเต็ม ${MIN_TIMES}–${MAX_TIMES}` };
  }
  return null;
}
