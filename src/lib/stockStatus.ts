// Stock status helpers — shared, pure, and unit-tested (see stockStatus.test.ts).
// Separates the "fully gone" terminal states (out of stock / expired) from the
// "running low / expiring soon" warning states, which the inline Stock.tsx logic
// used to collapse together.

export const EXPIRY_WARNING_DAYS = 180;

const DAY_MS = 86400000;

/** Parse an EXP string (dd/mm/yyyy, dd-mm-yyyy, or yyyy-mm-dd) to a timestamp, or null. */
export const parseExp = (s?: string): number | null => {
  if (!s || s === "-") return null;
  const m = s.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime();
  const m2 = s.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (m2) return new Date(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3])).getTime();
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
};

const startOfDay = (ts: number): number => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export type ExpiryStatus = "expired" | "soon" | "ok" | "none";

/**
 * Classify an EXP date relative to `now`:
 * - "expired": the exp day is already in the past (the exp day itself still counts as valid)
 * - "soon": expires within EXPIRY_WARNING_DAYS
 * - "ok": expires later than the warning window
 * - "none": no/invalid date
 */
export const expiryStatus = (s?: string, now = Date.now()): ExpiryStatus => {
  const t = parseExp(s);
  if (t == null) return "none";
  const today = startOfDay(now);
  if (t < today) return "expired";
  if (t < today + EXPIRY_WARNING_DAYS * DAY_MS) return "soon";
  return "ok";
};

export type QtyStatus = "out" | "low" | "ok";

/**
 * Classify a remaining quantity:
 * - "out": nothing left (<= 0)
 * - "low": at or below the low-stock threshold but still > 0
 * - "ok": above the threshold
 */
export const qtyStatus = (total: number, lowThreshold: number): QtyStatus => {
  if (total <= 0) return "out";
  if (total <= lowThreshold) return "low";
  return "ok";
};
