import type { StandardOperator, SubstanceStandard, StandardRule, StandardConditionOp, ParameterValueField, LabelToleranceRule } from "./api";
import type { ResolvedStandard, LabelToleranceResolved } from "./parameterValidation";

export function describeStandard(field: ParameterValueField): string {
  const op = field.standardOperator;
  const v1 = field.standardValue;
  const v2 = field.standardValue2;
  const unit = field.unit ? ` ${field.unit}` : "";
  switch (op) {
    case "lt": return `< ${v1}${unit}`;
    case "lte": return `≤ ${v1}${unit}`;
    case "eq": return `= ${v1}${unit}`;
    case "gte": return `≥ ${v1}${unit}`;
    case "gt": return `> ${v1}${unit}`;
    case "between": return `${v1} - ${v2}${unit}`;
    case "tolerance": return `${v1} ± ${v2}%${unit}`;
    default: return "";
  }
}

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

export function describeOutputRule(rule: StandardRule): string {
  const label = rule.label?.trim() ? `${rule.label}: ` : "";
  const text = (rule.outputText && rule.outputText.trim()) || rule.label || "(ไม่ระบุข้อความ)";
  const kind = rule.outputKind === "abnormal" ? "ผิดปกติ" : "ปกติ";
  const out = `→ "${text}" (${kind})`;
  if (rule.conditions.length === 0) return `${label}default ${out}`;
  const conds = rule.conditions
    .map((c) => `${c.sourceFieldLabel} ${COND_OP_LABEL[c.op]} ${c.value}${c.op === "between" && c.value2 != null ? `–${c.value2}` : ""}`)
    .join(" และ ");
  return `${label}ถ้า ${conds} ${out}`;
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

// สรุปเกณฑ์ labelTolerance ของสารตอน config เช่น "ฉลาก ±2.5% (หัวหน้า ±5%)"
export function describeLabelTolerance(std: LabelToleranceRule, unit: string): string {
  if ((std.mode ?? "percent") === "range") {
    if ([std.failLow, std.passLow, std.passHigh, std.failHigh].some((v) => v == null)) return "";
    return `ช่วง ${std.failLow}-${std.passLow}-${std.passHigh}-${std.failHigh}${unit ? ` ${unit}` : ""}`;
  }
  if (std.autoPct == null) return "";
  const u = unit ? ` ${unit}` : "";
  const head = std.headPct != null ? ` (หัวหน้า ±${std.headPct}%)` : "";
  return `ฉลาก ±${std.autoPct}%${head}${u}`;
}

// ช่วงจริงหลังแกะ %ฉลาก เช่น "ผ่าน 0.975–1.025 · หัวหน้าตรวจสอบ 0.95–1.05 %"
export function formatLabelToleranceRange(r: LabelToleranceResolved, unit: string): string {
  if (r.center == null || !r.autoRange) return "";
  const u = unit ? ` ${unit}` : "";
  const fmt = (n: number) => Number(n.toFixed(4)).toString();
  const auto = `ผ่าน ${fmt(r.autoRange[0])}–${fmt(r.autoRange[1])}`;
  const head = r.headRange ? ` · หัวหน้าตรวจสอบ ${fmt(r.headRange[0])}–${fmt(r.headRange[1])}` : "";
  return `${auto}${head}${u}`;
}

// ป้ายสถานะ labelTolerance สำหรับ chip (pass/review/fail + ข้ามเมื่อไม่มี %ฉลาก)
export function labelToleranceBadge(status: "pass" | "review" | "fail" | "none", center: number | null):
  { text: string; cls: string } | null {
  if (status === "pass") return { text: "ผ่าน", cls: "text-emerald-700 bg-emerald-50 border-emerald-200" };
  if (status === "review") return { text: "หัวหน้าตรวจสอบ", cls: "text-amber-700 bg-amber-50 border-amber-200" };
  if (status === "fail") return { text: "ไม่ผ่าน (เกินช่วงอนุมัติ)", cls: "text-red-700 bg-red-50 border-red-200" };
  if (status === "none" && center == null) return { text: "ข้ามการตรวจ — ไม่มี %ฉลาก", cls: "text-muted-foreground bg-muted border" };
  return null; // none + ยังไม่กรอก = ไม่มี chip
}
