// Standard stock "ความถี่/1 ครั้ง" — how often a fresh standard is prepared,
// stored as an English "1/N unit" string (numerator is always 1 = "1 time").
// e.g. "1/1 week" = once per week, "1/2 month" = once per 2 months.

export const FREQUENCY_UNITS = ["day", "week", "month"] as const;
export type FrequencyUnit = (typeof FREQUENCY_UNITS)[number];

export const FREQUENCY_PRESETS = [
  "1/1 day",
  "1/1 week",
  "1/1 month",
  "1/2 month",
  "1/3 month",
  "1/6 month",
] as const;

const RE = /^\s*\d+\s*\/\s*(\d+)\s*(day|week|month)s?\s*$/i;

/**
 * Parse a frequency string into its interval. The numerator (times) is ignored —
 * the denominator `count` + `unit` is the interval. Case-insensitive, tolerates a
 * trailing plural and extra spacing. Returns null for empty/unparseable input or a
 * zero count.
 */
export function parseFrequency(str: string | null | undefined): { count: number; unit: FrequencyUnit } | null {
  const m = RE.exec(String(str ?? ""));
  if (!m) return null;
  const count = Number(m[1]);
  if (!Number.isFinite(count) || count < 1) return null;
  return { count, unit: m[2].toLowerCase() as FrequencyUnit };
}

/** Build the canonical "1/{count} {unit}" string (numerator fixed at 1). */
export function formatFrequency(count: number, unit: FrequencyUnit): string {
  return `1/${count} ${unit}`;
}

/** Whether a stored frequency canonicalizes to one of the six presets. */
export function isPreset(str: string | null | undefined): boolean {
  const parsed = parseFrequency(str);
  if (!parsed) return false;
  return (FREQUENCY_PRESETS as readonly string[]).includes(formatFrequency(parsed.count, parsed.unit));
}
