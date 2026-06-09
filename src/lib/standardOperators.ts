import type { StandardOperator, SubstanceStandard, StandardRule, StandardConditionOp } from "./api";
import type { ResolvedStandard } from "./parameterValidation";

export const OPERATOR_OPTIONS: { value: StandardOperator | "none"; label: string }[] = [
  { value: "none", label: "— ไม่ตรวจ —" },
  { value: "lt", label: "น้อยกว่า (<)" },
  { value: "lte", label: "น้อยกว่าหรือเท่ากับ (≤)" },
  { value: "eq", label: "เท่ากับ (=)" },
  { value: "gte", label: "มากกว่าหรือเท่ากับ (≥)" },
  { value: "gt", label: "มากกว่า (>)" },
  { value: "between", label: "อยู่ในช่วง (between)" },
  { value: "tolerance", label: "ค่ามาตรฐาน ± %" },
];

export function describeResolvedStandard(r: ResolvedStandard, unit: string): string {
  if (!r || r.value == null) return "";
  const u = unit || "";
  switch (r.operator) {
    case "lt": return `< ${r.value}${u}`;
    case "lte": return `≤ ${r.value}${u}`;
    case "eq": return `= ${r.value}${u}`;
    case "gte": return `≥ ${r.value}${u}`;
    case "gt": return `> ${r.value}${u}`;
    case "between": return r.value2 == null ? "" : `${r.value} - ${r.value2}${u}`;
    case "tolerance": return r.value2 == null ? "" : `${r.value} ± ${r.value2}%${u}`;
    default: return "";
  }
}

const COND_OP_LABEL: Record<StandardConditionOp, string> = {
  eq: "=", ne: "≠", gt: ">", gte: "≥", lt: "<", lte: "≤", between: "ช่วง",
};

export function describeRule(rule: StandardRule, unit: string): string {
  const std = describeResolvedStandard(
    { operator: rule.operator, value: rule.value, value2: rule.value2 ?? null },
    unit,
  );
  const label = rule.label?.trim() ? `${rule.label}: ` : "";
  if (rule.conditions.length === 0) {
    return `${label}default → ${std}`;
  }
  const conds = rule.conditions
    .map((c) => `${c.sourceFieldLabel} ${COND_OP_LABEL[c.op]} ${c.value}${c.op === "between" && c.value2 != null ? `–${c.value2}` : ""}`)
    .join(" และ ");
  return `${label}ถ้า ${conds} → ${std}`;
}

// สรุปเกณฑ์ของ SubstanceStandard เป็นข้อความสั้น เช่น "≥ 95%"
export function describeSubstanceStandard(std: SubstanceStandard, unit: string): string {
  const u = unit ? unit : "";
  const v1 = std.value;
  const v2 = std.value2;
  if (v1 == null) return "";
  switch (std.operator) {
    case "lt": return `< ${v1}${u}`;
    case "lte": return `≤ ${v1}${u}`;
    case "eq": return `= ${v1}${u}`;
    case "gte": return `≥ ${v1}${u}`;
    case "gt": return `> ${v1}${u}`;
    case "between": return v2 == null ? "" : `${v1} - ${v2}${u}`;
    case "tolerance": return v2 == null ? "" : `${v1} ± ${v2}%${u}`;
    default: return "";
  }
}
