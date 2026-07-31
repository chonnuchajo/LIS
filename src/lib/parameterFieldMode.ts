import type { ParameterValueField, StandardOperator } from "./api";

export type CriteriaMode = "single" | "substance" | "conditional" | "labelTolerance";

export function applyCriteriaMode(
  field: ParameterValueField,
  mode: CriteriaMode,
): ParameterValueField {
  const usesAdvancedNumericMode = mode === "substance" || mode === "labelTolerance";
  return {
    ...field,
    substanceMode: mode === "substance",
    conditionalMode: mode === "conditional",
    labelToleranceMode: mode === "labelTolerance",
    multiple: usesAdvancedNumericMode ? false : field.multiple,
    substanceStandards: mode === "substance" ? field.substanceStandards ?? [] : field.substanceStandards,
    conditionalStandards: mode === "conditional" ? field.conditionalStandards ?? [] : field.conditionalStandards,
    labelToleranceStandards: mode === "labelTolerance" ? field.labelToleranceStandards ?? [] : field.labelToleranceStandards,
    standardOperator: mode === "single" ? field.standardOperator as StandardOperator | undefined : undefined,
    standardValue: mode === "single" ? field.standardValue : null,
    standardValue2: mode === "single" ? field.standardValue2 : null,
    conditionalResult: mode === "conditional" ? (field.conditionalResult ?? "standard") : "standard",
  };
}
