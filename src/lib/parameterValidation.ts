import type { ParameterValueField, TimerUnit } from "./api";

export function isEnumAbnormal(
  field: ParameterValueField,
  value: unknown,
): boolean {
  if (field.type !== "enum") return false;
  const expected = field.expectedValues ?? [];
  if (expected.length === 0) return false;
  if (value === null || value === undefined) return false;
  const str = String(value);
  if (str === "") return false;
  return !expected.includes(str);
}

export function isNumericAbnormal(
  field: ParameterValueField,
  value: unknown,
): boolean {
  if (field.type !== "number" && field.type !== "float") return false;
  if (!field.standardOperator) return false;
  if (field.standardValue == null) return false;
  if (value === null || value === undefined || value === "") return false;
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return false;

  const v1 = field.standardValue;
  const v2 = field.standardValue2;

  switch (field.standardOperator) {
    case "lt": return num >= v1;
    case "lte": return num > v1;
    case "eq": return num !== v1;
    case "gte": return num < v1;
    case "gt": return num <= v1;
    case "between":
      if (v2 == null) return false;
      return num < v1 || num > v2;
    case "tolerance":
      if (v2 == null || v2 <= 0) return false;
      return Math.abs(num - v1) > Math.abs(v1) * (v2 / 100);
    default:
      return false;
  }
}

export function isFieldAbnormal(
  field: ParameterValueField,
  value: unknown,
): boolean {
  return isEnumAbnormal(field, value) || isNumericAbnormal(field, value);
}

export function timerDurationMs(field: ParameterValueField): number | null {
  if (field.type !== "timer") return null;
  if (!field.timerDurationSec || field.timerDurationSec <= 0) return null;
  return field.timerDurationSec * 1000;
}

export function timerRemainingMs(
  field: ParameterValueField,
  startedAtIso: string | null | undefined,
): number | null {
  const total = timerDurationMs(field);
  if (total == null) return null;
  if (!startedAtIso) return total;
  const startedAt = new Date(startedAtIso).getTime();
  if (Number.isNaN(startedAt)) return null;
  const elapsed = Date.now() - startedAt;
  return Math.max(0, total - elapsed);
}

export function isTimerDone(
  field: ParameterValueField,
  startedAtIso: string | null | undefined,
): boolean {
  if (!startedAtIso) return false;
  const remaining = timerRemainingMs(field, startedAtIso);
  return remaining != null && remaining <= 0;
}

export type TimerParts = {
  months?: number;
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
};

const SEC_PER_MINUTE = 60;
const SEC_PER_HOUR = 3600;
const SEC_PER_DAY = 86400;
const SEC_PER_MONTH = 30 * 86400;

export function partsToSec(parts: TimerParts): number {
  return (parts.months ?? 0) * SEC_PER_MONTH
    + (parts.days ?? 0) * SEC_PER_DAY
    + (parts.hours ?? 0) * SEC_PER_HOUR
    + (parts.minutes ?? 0) * SEC_PER_MINUTE
    + (parts.seconds ?? 0);
}

export function secToParts(sec: number, unit: TimerUnit): TimerParts {
  let remaining = Math.max(0, Math.floor(sec));
  const out: TimerParts = {};
  if (unit === "month") {
    out.months = Math.floor(remaining / SEC_PER_MONTH);
    remaining %= SEC_PER_MONTH;
  }
  if (unit === "month" || unit === "day") {
    out.days = Math.floor(remaining / SEC_PER_DAY);
    remaining %= SEC_PER_DAY;
  }
  if (unit === "month" || unit === "day" || unit === "hour") {
    out.hours = Math.floor(remaining / SEC_PER_HOUR);
    remaining %= SEC_PER_HOUR;
  }
  out.minutes = Math.floor(remaining / SEC_PER_MINUTE);
  out.seconds = remaining % SEC_PER_MINUTE;
  return out;
}

export function formatTimerHuman(sec: number): string {
  if (!sec || sec <= 0) return "0 วินาที";
  const total = Math.floor(sec);
  const months = Math.floor(total / SEC_PER_MONTH);
  let r = total % SEC_PER_MONTH;
  const days = Math.floor(r / SEC_PER_DAY);
  r %= SEC_PER_DAY;
  const hours = Math.floor(r / SEC_PER_HOUR);
  r %= SEC_PER_HOUR;
  const minutes = Math.floor(r / SEC_PER_MINUTE);
  const seconds = r % SEC_PER_MINUTE;
  const parts: string[] = [];
  if (months) parts.push(`${months} เดือน`);
  if (days) parts.push(`${days} วัน`);
  if (hours) parts.push(`${hours} ชม`);
  if (minutes) parts.push(`${minutes} นาที`);
  if (seconds) parts.push(`${seconds} วินาที`);
  return parts.join(" ");
}