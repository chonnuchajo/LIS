import type { ParameterItem, ParameterValueField, TimerUnit, SubstanceStandard, StandardCondition, StandardOperator } from "./api";
import type { QCTestResult } from "@/types/petition.types";
import { parseSubstances, extractSubstanceName, matchSubstanceKey, substanceFieldKey } from "./substances";

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

export function findSubstanceStandard(
  field: ParameterValueField,
  substanceName: string,
): SubstanceStandard | undefined {
  const key = matchSubstanceKey(substanceName);
  if (!key) return undefined;
  return (field.substanceStandards ?? []).find(
    (s) => matchSubstanceKey(s.substance) === key,
  );
}

// เช็คผิดปกติของค่ารายสาร โดยสร้าง virtual field แล้ว reuse isNumericAbnormal เดิม
export function isSubstanceAbnormal(
  field: ParameterValueField,
  std: SubstanceStandard | undefined,
  value: unknown,
): boolean {
  if (!std || !std.operator || std.value == null) return false;
  return isNumericAbnormal(
    {
      ...field,
      standardOperator: std.operator,
      standardValue: std.value,
      standardValue2: std.value2 ?? null,
    },
    value,
  );
}

export type RenderFieldUnit = {
  key: string;                 // ใช้เป็นทั้ง React key และ storage key ใน result.values
  field: ParameterValueField;  // อาจเป็น virtual field (ฉีด standard ของสารแล้ว)
  substanceName?: string;      // มีค่าเมื่อเป็น unit รายสาร
};

// แตก field เดียวเป็นหลาย render unit เมื่อ substanceMode เปิด.
// non-substance → คืน unit เดียวที่อ้าง field เดิม (key = field.label).
export function expandFieldForItem(
  field: ParameterValueField,
  commonName: string | undefined,
): RenderFieldUnit[] {
  const isNumeric = field.type === "number" || field.type === "float";
  if (!field.substanceMode || !isNumeric) {
    return [{ key: field.label, field }];
  }
  const substances = parseSubstances(commonName ?? "");
  if (substances.length === 0 || (substances.length === 1 && !substances[0])) {
    return [{ key: field.label, field }];
  }
  return substances.map((raw) => {
    const name = extractSubstanceName(raw) || raw;
    const std = findSubstanceStandard(field, name);
    const vfield: ParameterValueField = {
      ...field,
      label: `${field.label} — ${name}`,
      substanceMode: false,
      standardOperator: std?.operator,
      standardValue: std?.value ?? null,
      standardValue2: std?.value2 ?? null,
    };
    return { key: substanceFieldKey(field.label, name), field: vfield, substanceName: name };
  });
}

export function countAbnormalInResults(
  results: QCTestResult[],
  parameters: ParameterItem[],
): number {
  if (!results?.length || !parameters?.length) return 0;
  const paramById = new Map<string, ParameterItem>();
  for (const p of parameters) {
    if (p._id) paramById.set(String(p._id), p);
  }
  let count = 0;
  for (const r of results) {
    const param = paramById.get(String(r.parameterId));
    if (!param?.valueFields?.length) continue;
    const values = (r.values ?? {}) as Record<string, unknown>;
    for (const field of param.valueFields) {
      const isNumeric = field.type === "number" || field.type === "float";
      if (field.substanceMode && isNumeric) {
        const prefix = `${field.label}::`;
        for (const [vkey, vval] of Object.entries(values)) {
          if (!vkey.startsWith(prefix)) continue;
          const subKey = vkey.slice(prefix.length);
          const std = (field.substanceStandards ?? []).find(
            (s) => matchSubstanceKey(s.substance) === subKey,
          );
          if (isSubstanceAbnormal(field, std, vval)) count += 1;
        }
        continue;
      }
      if (isFieldAbnormal(field, values[field.label])) count += 1;
    }
  }
  return count;
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

export type ConditionContext = {
  sameParam: Record<string, unknown>;
  otherParams: Record<string, Record<string, unknown>>;
};

function conditionSourceValue(cond: StandardCondition, ctx: ConditionContext): unknown {
  if (cond.sourceParameterId) {
    return ctx.otherParams[cond.sourceParameterId]?.[cond.sourceFieldLabel];
  }
  return ctx.sameParam[cond.sourceFieldLabel];
}

export type ResolvedStandard = {
  operator: StandardOperator;
  value: number | null;
  value2: number | null;
  matchedRuleLabel?: string;
} | null;

export function resolveStandard(
  field: ParameterValueField,
  ctx: ConditionContext,
): ResolvedStandard {
  if (!field.conditionalMode) {
    if (!field.standardOperator || field.standardValue == null) return null;
    return {
      operator: field.standardOperator,
      value: field.standardValue,
      value2: field.standardValue2 ?? null,
    };
  }
  for (const rule of field.conditionalStandards ?? []) {
    const matched = (rule.conditions ?? []).every((c) => evalCondition(c, ctx));
    if (matched) {
      return {
        operator: rule.operator,
        value: rule.value,
        value2: rule.value2 ?? null,
        matchedRuleLabel: rule.label,
      };
    }
  }
  return null;
}

// คืน virtual field ที่ฉีดเกณฑ์ที่ resolve ได้ลงไป (conditionalMode ปิด)
// เพื่อให้ isFieldAbnormal / describeStandard เดิมทำงานได้ตรงๆ
export function resolveFieldStandard(
  field: ParameterValueField,
  ctx: ConditionContext,
): ParameterValueField {
  if (!field.conditionalMode) return field;
  const r = resolveStandard(field, ctx);
  return {
    ...field,
    conditionalMode: false,
    standardOperator: r?.operator,
    standardValue: r?.value ?? null,
    standardValue2: r?.value2 ?? null,
  };
}

export function evalCondition(cond: StandardCondition, ctx: ConditionContext): boolean {
  const raw = conditionSourceValue(cond, ctx);
  // เจตนา: source ว่าง/ยังไม่กรอก = condition ไม่ผ่าน (รวม ne ด้วย) — กฎจะ activate
  // เฉพาะเมื่อ field ตัวกำหนดถูกกรอกจริง (ตาม spec)
  if (raw === null || raw === undefined || raw === "") return false;
  const target = cond.value;

  switch (cond.op) {
    case "eq":
    case "ne": {
      const targetNum = typeof target === "number" ? target : Number(target);
      const rawNum = Number(raw);
      const numericPair =
        target !== "" && !Number.isNaN(targetNum) && !Number.isNaN(rawNum);
      const equal = numericPair ? rawNum === targetNum : String(raw) === String(target);
      return cond.op === "eq" ? equal : !equal;
    }
    case "gt":
    case "gte":
    case "lt":
    case "lte":
    case "between": {
      const n = Number(raw);
      const t = typeof target === "number" ? target : Number(target);
      if (Number.isNaN(n) || Number.isNaN(t)) return false;
      if (cond.op === "gt") return n > t;
      if (cond.op === "gte") return n >= t;
      if (cond.op === "lt") return n < t;
      if (cond.op === "lte") return n <= t;
      const t2 = cond.value2 == null ? NaN : Number(cond.value2);
      if (Number.isNaN(t2)) return false;
      return n >= t && n <= t2;
    }
    default:
      return false;
  }
}
