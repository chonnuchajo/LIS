export interface StandardLabelCodeDefaults {
  prefix: string;
  buddhistYear: number;
  nextBottleNo: number;
  codes: string[];
}

export function standardLabelCodePrefix(standardCode: string | number | null | undefined): string {
  const raw = String(standardCode ?? "").trim().toUpperCase();
  if (!raw) return "00";
  const compact = raw.replace(/\s+/g, "");
  if (/^\d+$/.test(compact)) return compact.padStart(2, "0").slice(0, 2);
  const digits = (compact.match(/\d+/g) ?? []).join("");
  if (digits) return digits.slice(-2).padStart(2, "0");
  const alnum = compact.replace(/[^A-Z0-9]/g, "");
  return `${alnum}00`.slice(0, 2);
}

function buddhistYearTwoDigits(now = new Date()): number {
  return (now.getFullYear() + 543) % 100;
}

function formatStandardLabelCode(standardCode: string | number, buddhistYear: number, bottleNo: number): string {
  return `${standardLabelCodePrefix(standardCode)}${String(buddhistYear).padStart(2, "0")}${String(bottleNo).padStart(2, "0")}`;
}

function buddhistYearTwoDigitsFromStoredYear(labelRunYear: string | number | null | undefined): number | null {
  const year = Number(labelRunYear);
  if (!Number.isInteger(year) || year <= 0) return null;
  if (year >= 2400) return year % 100;
  if (year >= 1900) return (year + 543) % 100;
  return year % 100;
}

export function standardLabelCodeFromLegacyRun(
  standardCode: string | number | null | undefined,
  labelRunNo: string | number | null | undefined,
  labelRunYear: string | number | null | undefined,
): string {
  const bottleNo = Number(labelRunNo);
  const buddhistYear = buddhistYearTwoDigitsFromStoredYear(labelRunYear);
  if (!Number.isInteger(bottleNo) || bottleNo < 1 || buddhistYear == null) return "";
  return formatStandardLabelCode(standardCode ?? "", buddhistYear, bottleNo);
}

export function standardLabelCodeFromStockUnit(unit: {
  itemCode?: string | number | null;
  labelCode?: string | null;
  labelRunNo?: string | number | null;
  labelRunYear?: string | number | null;
}): string {
  const labelCode = String(unit.labelCode ?? "").trim().toUpperCase();
  return labelCode || standardLabelCodeFromLegacyRun(unit.itemCode, unit.labelRunNo, unit.labelRunYear);
}

export function buildLocalStandardLabelCodeDefaults(standardCode: string | number, count: number, now = new Date()): StandardLabelCodeDefaults {
  const safeCount = Math.max(1, Math.min(Math.trunc(Number(count)) || 1, 200));
  const buddhistYear = buddhistYearTwoDigits(now);
  return {
    prefix: standardLabelCodePrefix(standardCode),
    buddhistYear,
    nextBottleNo: 1,
    codes: Array.from({ length: safeCount }, (_, index) => formatStandardLabelCode(standardCode, buddhistYear, index + 1)),
  };
}

export function standardLabelCodeSuffix(labelCode: string | null | undefined, prefix: string): string {
  const normalized = String(labelCode ?? "").trim().toUpperCase();
  if (normalized.startsWith(prefix)) return normalized.slice(prefix.length).replace(/\D/g, "");
  return normalized.replace(/\D/g, "");
}

export function standardLabelCodeFromSuffix(prefix: string, suffixInput: string): string {
  const normalized = String(suffixInput ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const looksLikeFullCode = normalized.startsWith(prefix) && normalized.length >= prefix.length + 4;
  const suffix = looksLikeFullCode ? normalized.slice(prefix.length).replace(/\D/g, "") : normalized.replace(/\D/g, "");
  return `${prefix}${suffix}`;
}

export function parseStandardLabelCode(labelCode: string | null | undefined, standardCode: string | number | null | undefined) {
  const prefix = standardLabelCodePrefix(standardCode);
  const normalized = String(labelCode ?? "").trim().toUpperCase();
  if (!normalized.startsWith(prefix)) return null;
  const suffix = normalized.slice(prefix.length);
  if (!/^\d{4,}$/.test(suffix)) return null;
  const bottleNo = Number(suffix.slice(2));
  if (!Number.isInteger(bottleNo) || bottleNo < 1) return null;
  return {
    labelCode: `${prefix}${suffix}`,
    prefix,
    buddhistYear: Number(suffix.slice(0, 2)),
    bottleNo,
  };
}

export function mergeStandardLabelCodeDefaults(current: string[] | undefined, defaults: string[], count: number): string[] {
  const length = Math.max(1, Math.trunc(Number(count)) || 1);
  return Array.from({ length }, (_, index) => {
    const existing = current?.[index]?.trim();
    return existing || defaults[index] || "";
  });
}
