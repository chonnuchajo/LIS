import { describe, expect, it } from "vitest";
import type { LabelToleranceRule, ParameterItem, StandardRule } from "./api";
import {
  buildConditionalCriteriaRows,
  buildLabelToleranceCriteriaRows,
  buildSubstanceCriteriaRows,
} from "./parameterCriteriaRows";
import { productTypeLabels } from "@/lib/productClassification";
import { describeLabelTolerance, describeOutputRule, describeRule } from "./standardOperators";

const splitDescribeOutput = (text: string) => {
  const [conditionPart = "", resultPart = ""] = text.split(" → ", 2);
  const cleanedCondition = conditionPart
    .replace(/^.*: /, "")
    .replace(/^ถ้า /, "");
  return {
    conditionsText: cleanedCondition,
    resultText: resultPart,
  };
};

const parameters: ParameterItem[] = [
  {
    _id: "p-qc",
    name: "QC Parameter",
    scope: "qc",
    valueFields: [
      {
        label: "Active",
        type: "number",
        unit: "%",
        substanceMode: true,
        substanceStandards: [
          { substance: "ABAMECTIN", operator: "gte", value: 95, value2: null, headOnly: true } as any,
          { substance: "IMIDACLOPRID", operator: "between", value: 90, value2: 110 },
        ],
      },
      {
        label: "Conditional Standard",
        type: "float",
        unit: "g",
        conditionalMode: true,
        conditionalResult: "standard",
        conditionalStandards: [
          {
            label: "Between rule",
            conditions: [{ sourceFieldLabel: "Moisture", op: "eq", value: "high" }],
            operator: "between",
            value: 23.5,
            value2: 26,
          },
          {
            label: "Min rule",
            conditions: [],
            operator: "gte",
            value: 95,
            value2: null,
          },
        ],
      },
      {
        label: "Conditional Output",
        type: "number",
        unit: "g",
        conditionalMode: true,
        conditionalResult: "output",
        conditionalStandards: [
          {
            label: "Output rule",
            conditions: [{ sourceFieldLabel: "Mode", op: "eq", value: "PASS" }],
            operator: "between",
            value: null,
            value2: null,
            outputText: "Review required",
            outputKind: "abnormal",
          },
        ],
      },
      {
        label: "%AI",
        type: "number",
        unit: "%",
        labelToleranceMode: true,
        labelToleranceStandards: [
          {
            substance: "",
            labelPercent: 0.3,
            productTypes: ["sand"],
            mode: "range",
            autoPct: null,
            headPct: null,
            failLow: 0.225,
            passLow: 0.2438,
            passHigh: 0.3563,
            failHigh: 0.375,
          },
          {
            substance: "ABAMECTIN",
            labelPercent: 1,
            autoMode: "percent",
            headMode: "percent",
            autoPct: 25,
            headPct: 15,
          },
        ],
      },
    ],
  },
  {
    _id: "p-lab",
    name: "Lab only",
    scope: "lab",
    valueFields: [
      {
        label: "Lab field",
        type: "number",
        substanceMode: true,
        substanceStandards: [],
      },
    ],
  },
];

describe("parameter criteria row builders", () => {
  it("buildSubstanceCriteriaRows returns one row per substance standard in scope", () => {
    const rows = buildSubstanceCriteriaRows(parameters, "qc");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      mode: "substance",
      parameterId: "p-qc",
      parameterName: "QC Parameter",
      fieldIndex: 0,
      fieldLabel: "Active",
      ruleIndex: 0,
      substance: "ABAMECTIN",
      operator: "gte",
      value: 95,
      value2: null,
      headOnly: true,
      isSetupRow: false,
    });
    expect(rows[1].substance).toBe("IMIDACLOPRID");
  });

  it("buildSubstanceCriteriaRows returns a setup row when mode is enabled with no standards", () => {
    const rows = buildSubstanceCriteriaRows(parameters, "lab");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      parameterId: "p-lab",
      fieldLabel: "Lab field",
      ruleIndex: null,
      isSetupRow: true,
    });
  });

  it("buildConditionalCriteriaRows formats conditions and standard result", () => {
    const rows = buildConditionalCriteriaRows(parameters, "qc");
    expect(rows).toHaveLength(3);
    const standardRule = parameters[0].valueFields[1]!.conditionalStandards![0] as StandardRule;
    const parsed = splitDescribeOutput(describeRule(standardRule, "g"));
    expect(rows[0]).toMatchObject({
      mode: "conditional",
      parameterId: "p-qc",
      fieldIndex: 1,
      ruleIndex: 0,
      ruleLabel: "Between rule",
      conditionsText: parsed.conditionsText,
      resultText: parsed.resultText,
      isSetupRow: false,
    });
  });

  it("maps non-between standard operators using shared helper text", () => {
    const rows = buildConditionalCriteriaRows(parameters, "qc");
    const gteRule = parameters[0].valueFields[1]!.conditionalStandards![1] as StandardRule;
    const parsed = splitDescribeOutput(describeRule(gteRule, "g"));
    expect(rows[1]).toMatchObject({
      mode: "conditional",
      fieldIndex: 1,
      ruleIndex: 1,
      ruleLabel: "Min rule",
      conditionsText: "default",
      resultText: parsed.resultText,
    });
  });

  it("maps output-mode conditionals with shared output description helper", () => {
    const rows = buildConditionalCriteriaRows(parameters, "qc");
    const outputRule = parameters[0].valueFields[2]!.conditionalStandards![0] as StandardRule;
    const expected = splitDescribeOutput(describeOutputRule(outputRule));
    expect(rows[2]).toMatchObject({
      mode: "conditional",
      fieldIndex: 2,
      ruleIndex: 0,
      ruleLabel: "Output rule",
      conditionsText: expected.conditionsText,
      resultText: expected.resultText,
      isSetupRow: false,
    });
  });

  it("buildLabelToleranceCriteriaRows maps requested table columns", () => {
    const rows = buildLabelToleranceCriteriaRows(parameters, "qc");
    expect(rows).toHaveLength(2);
    const firstSummary = describeLabelTolerance(
      parameters[0].valueFields[3].labelToleranceStandards![0] as LabelToleranceRule,
      "%",
    );
    const secondSummary = describeLabelTolerance(
      parameters[0].valueFields[3].labelToleranceStandards![1] as LabelToleranceRule,
      "%",
    );
    expect(rows[0]).toMatchObject({
      mode: "labelTolerance",
      selectorText: `0.3% / ${productTypeLabels.sand}`,
      drugPercent: "0.3",
      tolerancePercent: "-",
      failLow: "0.225",
      passLow: "0.2438",
      passHigh: "0.3563",
      failHigh: "0.375",
      previewText: `${rows[0].selectorText} | ${firstSummary}`,
      isSetupRow: false,
    });
    expect(rows[1]).toMatchObject({
      selectorText: "ABAMECTIN / 1%",
      drugPercent: "1",
      tolerancePercent: "25",
      failLow: "-",
      passLow: "-",
      passHigh: "-",
      failHigh: "-",
      previewText: `${rows[1].selectorText} | ${secondSummary}`,
    });
  });
});
