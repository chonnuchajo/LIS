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
  searchText: string;
};

export type SubstanceCriteriaRow = CriteriaRowOwner & {
  mode: "substance";
  rowId: string;
  ruleIndex: number | null;
  substance: string;
  itemNo: string;
  packSize: string;
  masterItemName: string;
  masterCommonName: string;
  rawMasterText: string;
  operator: string;
  value: number | null;
  value2: number | null;
  productTypes: string[];
  regulatoryTypes: string[];
  categories: string[];
  productTypeText: string;
  categoryText: string;
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
  headTolerance: string;
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
  const scope = (parameter.scope ?? "qc") as ParameterScope;
  return {
    parameterId: parameter._id,
    parameterName: parameter.name,
    parameterScope: scope,
    fieldIndex,
    fieldLabel: field.label,
    field,
    searchText: buildSearchText(
      parameter.name,
      scope,
      parameter.status,
      parameter.note,
      parameter.applyAll ? ["applyAll", "all"] : "",
      parameter.itemNames,
      parameter.commonNames,
      productTypeSearchTokens(parameter.productTypes),
      parameter.categories,
      parameter.subCategories,
      parameter.itemGroups,
      parameter.excludeItemNames,
      parameter.excludeCommonNames,
      productTypeSearchTokens(parameter.excludeProductTypes),
      parameter.excludeCategories,
      parameter.excludeSubCategories,
      parameter.excludeItemGroups,
      field.label,
      field.type,
      field.unit,
      field.options,
      field.requireNoteOn,
      field.expectedValues,
      field.allowedFileTypes,
      field.optionOutputs,
      field.optionFilters,
    ),
  };
};

const displayValue = (value: number | null | undefined) =>
  value == null || !Number.isFinite(Number(value)) ? "-" : String(value);

const flattenSearchTokens = (value: unknown): string[] => {
  if (value == null) return [];
  if (Array.isArray(value)) return value.flatMap(flattenSearchTokens);
  if (typeof value === "object") return Object.values(value).flatMap(flattenSearchTokens);
  const text = String(value).trim();
  return text ? [text] : [];
};

const productTypeSearchTokens = (values: string[] | undefined) =>
  (values ?? []).flatMap((value) => [value, productTypeLabels[value] ?? ""]);

const buildSearchText = (...tokens: unknown[]) =>
  flattenSearchTokens(tokens).join(" ");

const appendSearchText = (base: CriteriaRowOwner, ...tokens: unknown[]) =>
  buildSearchText(base.searchText, tokens);

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

const displayPercent = (value: number | null | undefined) => {
  const text = displayValue(value);
  return text === "-" ? text : `${text}%`;
};

const displayAbsTolerance = (value: number | null | undefined) => {
  const text = displayValue(value);
  return text === "-" ? text : `± ${text}`;
};

const tolerancePercent = (rule: LabelToleranceRule) => {
  if ((rule.mode ?? "percent") === "range") return "-";
  const mode = rule.autoMode ?? ((rule.mode ?? "percent") === "abs" ? "abs" : "percent");
  if (mode === "percent") return displayPercent(rule.autoPct);
  if (mode === "abs") return displayAbsTolerance(rule.autoAbs);
  return "-";
};

const headTolerance = (rule: LabelToleranceRule) => {
  if ((rule.mode ?? "percent") === "range") return "-";
  const mode = rule.headMode ?? ((rule.mode ?? "percent") === "abs" ? "abs" : "percent");
  if (mode === "percent") return displayPercent(rule.headPct);
  if (mode === "abs") return displayAbsTolerance(rule.headAbs);
  return "-";
};

const productTypeText = (values: string[] | undefined) => {
  const text = (values ?? [])
    .map((value) => productTypeLabels[value] ?? value)
    .filter(Boolean)
    .join("/");
  return text || "-";
};

const regulatoryTypeText = (values: string[] | undefined) => {
  const text = (values ?? []).filter(Boolean).join("/");
  return text || "";
};

const categoryText = (values: string[] | undefined) => {
  const text = (values ?? []).filter(Boolean).join("/");
  return text || "-";
};

const itemScopedRowId = (base: CriteriaRowOwner, fieldIndex: number, ruleIndex: number, standard: SubstanceStandard) => {
  const parts = [`${base.parameterId}:${fieldIndex}:${ruleIndex}`];
  if (standard.itemNo || standard.packSize) {
    parts.push(standard.itemNo ?? "", standard.packSize ?? "");
  }
  return parts.join(":");
};

const rawMasterText = (raw: Record<string, unknown> | undefined) => {
  if (!raw) return "";
  return Object.entries(raw)
    .filter(([, value]) => value != null && (typeof value === "string" || typeof value === "number" || typeof value === "boolean"))
    .slice(0, 8)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" | ");
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
          itemNo: "",
          packSize: "",
          masterItemName: "",
          masterCommonName: "",
          rawMasterText: "",
          operator: "-",
          value: null,
          value2: null,
          productTypes: [],
          regulatoryTypes: [],
          categories: [],
          productTypeText: "-",
          categoryText: "-",
          headOnly: false,
          isSetupRow: true,
          searchText: appendSearchText(base, "substance", "setup"),
        });
        continue;
      }
      standards.forEach((standard: SubstanceStandard & { headOnly?: boolean }, ruleIndex) => {
        const productText = regulatoryTypeText(standard.regulatoryTypes) || productTypeText(standard.productTypes);
        const catText = categoryText(standard.categories);
        const rawText = rawMasterText(standard.masterRaw);
        rows.push({
          ...base,
          mode: "substance",
          rowId: itemScopedRowId(base, fieldIndex, ruleIndex, standard),
          ruleIndex,
          substance: standard.substance,
          itemNo: standard.itemNo ?? "",
          packSize: standard.packSize ?? "",
          masterItemName: standard.masterItemName ?? "",
          masterCommonName: standard.masterCommonName ?? "",
          rawMasterText: rawText,
          operator: standard.operator,
          value: standard.value,
          value2: standard.value2 ?? null,
          productTypes: standard.productTypes ?? [],
          regulatoryTypes: standard.regulatoryTypes ?? [],
          categories: standard.categories ?? [],
          productTypeText: productText,
          categoryText: catText,
          headOnly: standard.headOnly === true,
          searchText: appendSearchText(
            base,
            "substance",
            standard.substance,
            standard.operator,
            standard.value,
            standard.value2,
            standard.itemNo,
            standard.packSize,
            standard.masterItemName,
            standard.masterCommonName,
            rawText,
            productTypeSearchTokens(standard.productTypes),
            standard.regulatoryTypes,
            standard.categories,
            productText,
            catText,
            standard.headOnly === true ? ["headOnly", "head only"] : "",
          ),
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
          searchText: appendSearchText(base, "conditional", "setup"),
        });
        continue;
      }
      rules.forEach((rule: StandardRule, ruleIndex) => {
        const isOutput = (field.conditionalResult ?? "standard") === "output";
        const conditionSummary = conditionsText(rule);
        const resultSummary = isOutput
          ? outputResultText(rule)
          : standardResultText(rule, field.unit || "");
        rows.push({
          ...base,
          mode: "conditional",
          rowId: `${base.parameterId}:${fieldIndex}:${ruleIndex}`,
          ruleIndex,
          ruleLabel: rule.label?.trim() || "-",
          conditionsText: conditionSummary,
          resultText: resultSummary,
          searchText: appendSearchText(
            base,
            "conditional",
            rule.label,
            conditionSummary,
            resultSummary,
            rule.conditions?.map((condition) => [
              condition.sourceParameterId,
              condition.sourceFieldLabel,
              condition.op,
              condition.value,
              condition.value2,
            ]),
            rule.operator,
            rule.value,
            rule.value2,
            rule.outputText,
            rule.outputKind,
          ),
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
          headTolerance: "-",
          failLow: "-",
          passLow: "-",
          passHigh: "-",
          failHigh: "-",
          previewText: "-",
          isSetupRow: true,
          searchText: appendSearchText(base, "labelTolerance", "setup"),
        });
        continue;
      }
      rules.forEach((rule, ruleIndex) => {
        const selector = selectorText(rule);
        const summary = describeLabelTolerance(rule, field.unit || "");
        const autoText = tolerancePercent(rule);
        const headText = headTolerance(rule);
        rows.push({
          ...base,
          mode: "labelTolerance",
          rowId: `${base.parameterId}:${fieldIndex}:${ruleIndex}`,
          ruleIndex,
          selectorText: selector,
          drugPercent: displayValue(rule.labelPercent),
          tolerancePercent: tolerancePercent(rule),
          headTolerance: headTolerance(rule),
          failLow: displayValue(rule.failLow),
          passLow: displayValue(rule.passLow),
          passHigh: displayValue(rule.passHigh),
          failHigh: displayValue(rule.failHigh),
          previewText: summary ? `${selector} | ${summary}` : selector,
          searchText: appendSearchText(
            base,
            "labelTolerance",
            selector,
            summary,
            rule.substance,
            rule.labelPercent,
            productTypeSearchTokens(rule.productTypes),
            rule.autoPct,
            rule.headPct,
            rule.autoAbs,
            rule.headAbs,
            rule.failLow,
            rule.passLow,
            rule.passHigh,
            rule.failHigh,
            autoText,
            headText,
          ),
          isSetupRow: false,
        });
      });
    }
  }
  return rows;
}
