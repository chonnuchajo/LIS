import { describe, expect, it } from "vitest";
import type { ParameterValueField } from "./api";
import { applyCriteriaMode } from "./parameterFieldMode";

describe("applyCriteriaMode", () => {
  it("clears multiple when switching a field to per-substance criteria", () => {
    const field: ParameterValueField = {
      label: "%AI",
      type: "number",
      unit: "%",
      multiple: true,
      standardOperator: "gte",
      standardValue: 95,
    };

    expect(applyCriteriaMode(field, "substance")).toMatchObject({
      substanceMode: true,
      conditionalMode: false,
      labelToleranceMode: false,
      multiple: false,
      standardOperator: undefined,
      standardValue: null,
      standardValue2: null,
    });
  });
});
