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

const TIMER_UNIT_TO_MS: Record<TimerUnit, number> = {
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  month: 30 * 86_400_000,
};

export function timerDurationMs(field: ParameterValueField): number | null {
  if (field.type !== "timer") return null;
  if (!field.timerDuration || field.timerDuration <= 0) return null;
  if (!field.timerUnit) return null;
  return field.timerDuration * TIMER_UNIT_TO_MS[field.timerUnit];
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
