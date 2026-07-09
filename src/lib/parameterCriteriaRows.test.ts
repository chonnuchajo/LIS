import { describe, expect, it } from "vitest";
import type { ParameterItem } from "./api";
import {
  buildConditionalCriteriaRows,
  buildLabelToleranceCriteriaRows,
  buildSubstanceCriteriaRows,
} from "./parameterCriteriaRows";
import { productTypeLabels } from "@/lib/productClassification";

const parameters: ParameterItem[] = [
  {
    _id: "p-qc",
    name: "เธชเธฒเธฃเธชเธณเธเธฑเธ",
    scope: "qc",
    valueFields: [
      {
        label: "เธเธฃเธดเธกเธฒเธ“",
        type: "number",
        unit: "%",
        substanceMode: true,
        substanceStandards: [
          { substance: "ABAMECTIN", operator: "gte", value: 95, value2: null, headOnly: true } as any,
          { substance: "IMIDACLOPRID", operator: "between", value: 90, value2: 110 },
        ],
      },
      {
        label: "เธเนเธณเธซเธเธฑเธ",
        type: "float",
        unit: "g",
        conditionalMode: true,
        conditionalResult: "standard",
        conditionalStandards: [
          {
            label: "เธเนเธญเธเนเธซเธเน",
            conditions: [{ sourceFieldLabel: "เธฅเธฑเธเธฉเธ“เธฐ", op: "eq", value: "เธเนเธญเธเนเธซเธเน" }],
            operator: "between",
            value: 23.5,
            value2: 26,
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
        label: "เธเนเธฒเธ—เธตเนเนเธกเนเธกเธตเนเธ–เธง",
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
      parameterName: "เธชเธฒเธฃเธชเธณเธเธฑเธ",
      fieldIndex: 0,
      fieldLabel: "เธเธฃเธดเธกเธฒเธ“",
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
      fieldLabel: "เธเนเธฒเธ—เธตเนเนเธกเนเธกเธตเนเธ–เธง",
      ruleIndex: null,
      isSetupRow: true,
    });
  });

  it("buildConditionalCriteriaRows formats conditions and standard result", () => {
    const rows = buildConditionalCriteriaRows(parameters, "qc");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      mode: "conditional",
      parameterId: "p-qc",
      fieldIndex: 1,
      ruleIndex: 0,
      ruleLabel: "เธเนเธญเธเนเธซเธเน",
      conditionsText: "เธฅเธฑเธเธฉเธ“เธฐ = เธเนเธญเธเนเธซเธเน",
      resultText: "23.5 - 26 g",
      isSetupRow: false,
    });
  });

  it("buildLabelToleranceCriteriaRows maps requested table columns", () => {
    const rows = buildLabelToleranceCriteriaRows(parameters, "qc");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      mode: "labelTolerance",
      selectorText: `0.3% / ${productTypeLabels.sand}`,
      drugPercent: "0.3",
      tolerancePercent: "-",
      failLow: "0.225",
      passLow: "0.2438",
      passHigh: "0.3563",
      failHigh: "0.375",
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
    });
  });
});
