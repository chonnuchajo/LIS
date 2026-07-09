import type {
  LabelToleranceRule,
  ParameterItem,
  ParameterScope,
  ParameterValueField,
  StandardCondition,
  StandardConditionOp,
  StandardRule,
  SubstanceStandard,
} from "./api";
import { describeLabelTolerance, describeResolvedStandard } from "./standardOperators";
import { productTypeLabels } from "./productClassification";

export type AdvancedCriteriaMode = "substance" | "conditional" | "labelTolerance";

export type CriteriaRowOwner = {
  parameterId: string;
  parameterName: string;
  parameterScope: ParameterScope;
  fieldIndex: number;
  fieldLabel: string;
  field: ParameterValueField;
};

export type SubstanceCriteriaRow = CriteriaRowOwner & {
  mode: "substance";
  rowId: string;
  ruleIndex: number | null;
  substance: string;
  operator: string;
  value: number | null;
  value2: number | null;
  headOnly: boolean;
  isSetupRow: boolean;
};

export type ConditionalCriteriaRow = CriteriaRowOwner & {
  mode: "conditional";
  rowId: string;
  ruleIndex: number | null;
  ruleLabel: string;
  conditionsText: string;
  resultText: string;
  isSetupRow: boolean;
};

export type LabelToleranceCriteriaRow = CriteriaRowOwner & {
  mode: "labelTolerance";
  rowId: string;
  ruleIndex: number | null;
  selectorText: string;
  drugPercent: string;
  tolerancePercent: string;
  failLow: string;
  passLow: string;
  passHigh: string;
  failHigh: string;
  previewText: string;
  isSetupRow: boolean;
};

const isNumericField = (field: ParameterValueField) =>
  field.type === "number" || field.type === "float";

const scoped = (parameters: ParameterItem[], scope: ParameterScope) =>
  parameters.filter((parameter) => (parameter.scope ?? "qc") === scope);

const owner = (
  parameter: ParameterItem,
  field: ParameterValueField,
  fieldIndex: number,
): CriteriaRowOwner | null => {
  if (!parameter._id) return null;
  return {
    parameterId: parameter._id,
    parameterName: parameter.name,
    parameterScope: (parameter.scope ?? "qc") as ParameterScope,
    fieldIndex,
    fieldLabel: field.label,
    field,
  };
};

const displayValue = (value: number | null | undefined) =>
  value == null || !Number.isFinite(Number(value)) ? "-" : String(value);

const CONDITION_OP_LABEL: Record<StandardConditionOp, string> = {
  eq: "=",
  ne: "≠",
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
  between: "ช่วง",
};

const conditionText = (condition: StandardCondition) => {
  const value2 = condition.op === "between" && condition.value2 != null
    ? `–${condition.value2}`
    : "";
  return `${condition.sourceFieldLabel} ${CONDITION_OP_LABEL[condition.op]} ${condition.value}${value2}`;
};

const conditionsText = (rule: StandardRule) => {
  const conditions = rule.conditions ?? [];
  return conditions.length > 0
    ? conditions.map(conditionText).join(" และ ")
    : "default";
};

const standardResultText = (rule: StandardRule, unit: string) => {
  return describeResolvedStandard(
    { operator: rule.operator, value: rule.value, value2: rule.value2 ?? null },
    unit,
  );
};

const outputResultText = (rule: StandardRule) => {
  const text = (rule.outputText && rule.outputText.trim()) || rule.label || "(ไม่ระบุข้อความ)";
  const kind = rule.outputKind === "abnormal" ? "ผิดปกติ" : "ปกติ";
  return `"${text}" (${kind})`;
};

const selectorText = (rule: LabelToleranceRule) => {
  const parts = [
    rule.substance?.trim() || "",
    rule.labelPercent != null ? `${rule.labelPercent}%` : "",
    (rule.productTypes ?? []).map((value) => productTypeLabels[value] ?? value).join("/"),
  ].filter(Boolean);
  return parts.length ? parts.join(" / ") : "ทั้งหมด";
};

const tolerancePercent = (rule: LabelToleranceRule) => {
  if ((rule.mode ?? "percent") === "range") return "-";
  if (rule.autoMode && rule.autoMode !== "percent") return "-";
  return displayValue(rule.autoPct);
};

export function buildSubstanceCriteriaRows(
  parameters: ParameterItem[],
  scope: ParameterScope,
): SubstanceCriteriaRow[] {
  const rows: SubstanceCriteriaRow[] = [];
  for (const parameter of scoped(parameters, scope)) {
    for (const [fieldIndex, field] of (parameter.valueFields ?? []).entries()) {
      if (!isNumericField(field) || !field.substanceMode) continue;
      const base = owner(parameter, field, fieldIndex);
      if (!base) continue;
      const standards = field.substanceStandards ?? [];
      if (standards.length === 0) {
        rows.push({
          ...base,
          mode: "substance",
          rowId: `${base.parameterId}:${fieldIndex}:setup`,
          ruleIndex: null,
          substance: "-",
          operator: "-",
          value: null,
          value2: null,
          headOnly: false,
          isSetupRow: true,
        });
        continue;
      }
      standards.forEach((standard: SubstanceStandard & { headOnly?: boolean }, ruleIndex) => {
        rows.push({
          ...base,
          mode: "substance",
          rowId: `${base.parameterId}:${fieldIndex}:${ruleIndex}`,
          ruleIndex,
          substance: standard.substance,
          operator: standard.operator,
          value: standard.value,
          value2: standard.value2 ?? null,
          headOnly: standard.headOnly === true,
          isSetupRow: false,
        });
      });
    }
  }
  return rows;
}

export function buildConditionalCriteriaRows(
  parameters: ParameterItem[],
  scope: ParameterScope,
): ConditionalCriteriaRow[] {
  const rows: ConditionalCriteriaRow[] = [];
  for (const parameter of scoped(parameters, scope)) {
    for (const [fieldIndex, field] of (parameter.valueFields ?? []).entries()) {
      if (!isNumericField(field) || !field.conditionalMode) continue;
      const base = owner(parameter, field, fieldIndex);
      if (!base) continue;
      const rules = field.conditionalStandards ?? [];
      if (rules.length === 0) {
        rows.push({
          ...base,
          mode: "conditional",
          rowId: `${base.parameterId}:${fieldIndex}:setup`,
          ruleIndex: null,
          ruleLabel: "-",
          conditionsText: "-",
          resultText: "-",
          isSetupRow: true,
        });
        continue;
      }
      rules.forEach((rule: StandardRule, ruleIndex) => {
        const isOutput = (field.conditionalResult ?? "standard") === "output";
        rows.push({
          ...base,
          mode: "conditional",
          rowId: `${base.parameterId}:${fieldIndex}:${ruleIndex}`,
          ruleIndex,
          ruleLabel: rule.label?.trim() || "-",
          conditionsText: conditionsText(rule),
          resultText: isOutput
            ? outputResultText(rule)
            : standardResultText(rule, field.unit || ""),
          isSetupRow: false,
        });
      });
    }
  }
  return rows;
}

export function buildLabelToleranceCriteriaRows(
  parameters: ParameterItem[],
  scope: ParameterScope,
): LabelToleranceCriteriaRow[] {
  const rows: LabelToleranceCriteriaRow[] = [];
  for (const parameter of scoped(parameters, scope)) {
    for (const [fieldIndex, field] of (parameter.valueFields ?? []).entries()) {
      if (!isNumericField(field) || !field.labelToleranceMode) continue;
      const base = owner(parameter, field, fieldIndex);
      if (!base) continue;
      const rules = field.labelToleranceStandards ?? [];
      if (rules.length === 0) {
        rows.push({
          ...base,
          mode: "labelTolerance",
          rowId: `${base.parameterId}:${fieldIndex}:setup`,
          ruleIndex: null,
          selectorText: "-",
          drugPercent: "-",
          tolerancePercent: "-",
          failLow: "-",
          passLow: "-",
          passHigh: "-",
          failHigh: "-",
          previewText: "-",
          isSetupRow: true,
        });
        continue;
      }
      rules.forEach((rule, ruleIndex) => {
        const selector = selectorText(rule);
        const summary = describeLabelTolerance(rule, field.unit || "");
        rows.push({
          ...base,
          mode: "labelTolerance",
          rowId: `${base.parameterId}:${fieldIndex}:${ruleIndex}`,
          ruleIndex,
          selectorText: selector,
          drugPercent: displayValue(rule.labelPercent),
          tolerancePercent: tolerancePercent(rule),
          failLow: displayValue(rule.failLow),
          passLow: displayValue(rule.passLow),
          passHigh: displayValue(rule.passHigh),
          failHigh: displayValue(rule.failHigh),
          previewText: summary ? `${selector} | ${summary}` : selector,
          isSetupRow: false,
        });
      });
    }
  }
  return rows;
}
