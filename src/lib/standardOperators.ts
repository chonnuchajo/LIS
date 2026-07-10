import type { StandardOperator, SubstanceStandard, StandardRule, StandardConditionOp, ParameterValueField, LabelToleranceRule } from "./api";
import type { ResolvedStandard, LabelToleranceResolved } from "./parameterValidation";

type LabelToleranceDisplayOptions = {
  showAutoPass?: boolean;
};

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

// สรุปเกณฑ์ labelTolerance ของสารตอน config โดย default แสดงเกณฑ์หัวหน้าตรวจสอบเท่านั้น
// (โหมดอนุมัติ QC ส่ง showAutoPass เพื่อแสดงช่วงผ่านอัตโนมัติด้วย)
export function describeLabelTolerance(std: LabelToleranceRule, unit: string, options: LabelToleranceDisplayOptions = {}): string {
  const showAutoPass = options.showAutoPass === true;
  const mode = std.mode ?? "percent";
  if (mode === "range") {
    if (showAutoPass) {
      if ([std.failLow, std.passLow, std.passHigh, std.failHigh].some((v) => v == null)) return "";
      return `ช่วง ${std.failLow}-${std.passLow}-${std.passHigh}-${std.failHigh}${unit ? ` ${unit}` : ""}`;
    }
    if (std.failLow == null || std.failHigh == null) return "";
    return `หัวหน้าตรวจสอบ ${std.failLow}-${std.failHigh}${unit ? ` ${unit}` : ""}`;
  }
  const u = unit ? ` ${unit}` : "";
  if (std.autoMode || std.headMode) {
    if (std.autoMode === "range" || std.headMode === "range") {
      const auto = !showAutoPass || std.autoMode === "none"
        ? ""
        : std.autoMode === "range"
          ? (std.passLow == null || std.passHigh == null ? "" : `ผ่าน ${std.passLow}-${std.passHigh}`)
          : std.autoMode === "percent"
            ? (std.autoPct == null ? "" : `ผ่าน ${std.autoPct}% ของหัวหน้าตรวจสอบ`)
            : (std.autoAbs == null ? "" : `ผ่าน ±${std.autoAbs}`);
      const head = std.headMode === "none"
        ? ""
        : std.headMode === "range"
          ? (std.failLow == null || std.failHigh == null ? "" : `หัวหน้าตรวจสอบ ${std.failLow}-${std.failHigh}`)
          : std.headMode === "percent"
            ? (std.headPct == null ? "" : `หัวหน้าตรวจสอบ ±${std.headPct}%`)
            : (std.headAbs == null ? "" : `หัวหน้าตรวจสอบ ±${std.headAbs}`);
      const parts = [auto, head].filter(Boolean);
      return parts.length ? `${parts.join(" | ")}${u}` : "";
    }
    const auto = !showAutoPass || std.autoMode === "none"
      ? ""
      : std.autoMode === "percent"
      ? (std.autoPct == null ? "" : `ผ่าน ${std.autoPct}% ของหัวหน้าตรวจสอบ`)
      : (std.autoAbs == null ? "" : `ผ่าน ±${std.autoAbs}`);
    const head = std.headMode === "none"
      ? ""
      : std.headMode === "percent"
      ? (std.headPct == null ? "" : `หัวหน้าตรวจสอบ ±${std.headPct}%`)
      : (std.headAbs == null ? "" : `หัวหน้าตรวจสอบ ±${std.headAbs}`);
    const parts = [auto, head].filter(Boolean);
    return parts.length ? `${parts.join(" | ")}${u}` : "";
  }
  if (mode === "abs") {
    if (std.headAbs != null) {
      const auto = showAutoPass && std.autoAbs != null ? `ฉลาก ±${std.autoAbs} ` : "";
      const head = showAutoPass ? `(หัวหน้าตรวจสอบ ±${std.headAbs})` : `หัวหน้าตรวจสอบ ±${std.headAbs}`;
      return `${auto}${head}${u}`;
    }
    return showAutoPass && std.autoAbs != null ? `ฉลาก ±${std.autoAbs}${u}` : "";
  }
  if (std.headPct != null) {
    const auto = showAutoPass && std.autoPct != null ? `ฉลาก ±${std.autoPct}% ` : "";
    const head = showAutoPass ? `(หัวหน้าตรวจสอบ ±${std.headPct}%)` : `หัวหน้าตรวจสอบ ±${std.headPct}%`;
    return `${auto}${head}${u}`;
  }
  return showAutoPass && std.autoPct != null ? `ฉลาก ±${std.autoPct}%${u}` : "";
}

// ช่วงจริงหลังแกะ %ฉลาก เช่น "หัวหน้าตรวจสอบ 0.95–1.05 %"
// (โหมดอนุมัติ QC ส่ง showAutoPass เพื่อแสดง "ผ่าน 0.975–1.025" ด้วย)
export function labelToleranceDisplayDecimals(center: number | null): 2 | 4 | 5 {
  if (center == null || !Number.isFinite(center)) return 4;
  if (Math.abs(center) > 2.5) return 2;
  const fraction = Math.abs(center).toFixed(12).replace(/0+$/, "").replace(/\.$/, "").split(".")[1] ?? "";
  const leadingZeros = fraction.match(/^0+/)?.[0].length ?? 0;
  return leadingZeros > 1 || fraction.length >= 3 ? 5 : 4;
}

export function formatLabelToleranceNumber(value: number, center: number | null): string {
  const decimals = labelToleranceDisplayDecimals(center);
  return Number(value.toFixed(decimals)).toFixed(decimals);
}

export function formatLabelToleranceRange(r: LabelToleranceResolved, unit: string, options: LabelToleranceDisplayOptions = {}): string {
  if (r.center == null) return "";
  const u = unit ? ` ${unit}` : "";
  const fmt = (n: number) => formatLabelToleranceNumber(n, r.center);
  const parts = [
    options.showAutoPass === true && r.autoRange
      ? `ผ่าน ${fmt(r.autoRange[0])}–${fmt(r.autoRange[1])}`
      : "",
    r.headRange ? `หัวหน้าตรวจสอบ ${fmt(r.headRange[0])}–${fmt(r.headRange[1])}` : "",
  ].filter(Boolean);
  return parts.length ? `${parts.join(" · ")}${u}` : "";
}

// ป้ายสถานะ labelTolerance สำหรับ chip (pass/review/fail + ข้ามเมื่อไม่มี %ฉลาก)
export function labelToleranceBadge(status: "pass" | "review" | "fail" | "none", center: number | null):
  { text: string; cls: string } | null {
  if (status === "pass") return null;
  if (status === "review") return { text: "หัวหน้าตรวจสอบ", cls: "text-amber-700 bg-amber-50 border-amber-200" };
  if (status === "fail") return { text: "เกินช่วงอนุมัติ", cls: "text-red-700 bg-red-50 border-red-200" };
  if (status === "none" && center == null) return { text: "ข้ามการตรวจ — ไม่มี %ฉลาก", cls: "text-muted-foreground bg-muted border" };
  return null; // none + ยังไม่กรอก = ไม่มี chip
}
