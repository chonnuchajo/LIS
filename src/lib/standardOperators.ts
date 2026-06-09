import type { StandardOperator, SubstanceStandard } from "./api";

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
