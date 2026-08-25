import { describe, expect, it } from "vitest";
import type { ParameterItem } from "./api";
import { isPhaseTriggerParameter, visibleFieldsForPhase } from "./phaseRetest";

const param = (overrides: Partial<ParameterItem>): ParameterItem => ({
  _id: "param",
  name: "Parameter",
  valueFields: [],
  ...overrides,
});

describe("phaseRetest", () => {
  it("identifies the trigger parameter by id", () => {
    expect(isPhaseTriggerParameter(param({ _id: "trigger" }), "trigger")).toBe(true);
    expect(isPhaseTriggerParameter(param({ _id: "other" }), "trigger")).toBe(false);
    expect(isPhaseTriggerParameter(param({
      _id: "trigger",
      valueFields: [{ label: "Timer", type: "timer", timerUnit: "hour", timerDurationSec: 3600, triggersPhase2: true }],
    }), null)).toBe(true);
  });

  it("shows non-phased parameters in both phases unless they are the trigger in phase 2", () => {
    const nonPhased = param({
      _id: "result-param",
      hasPhases: false,
      valueFields: [{ label: "ผล", type: "number", unit: "%" }],
    });
    const trigger = param({
      _id: "trigger-param",
      hasPhases: true,
      valueFields: [{ label: "Timer", type: "timer", timerUnit: "hour", timerDurationSec: 3600, triggersPhase2: true }],
    });

    expect(visibleFieldsForPhase(nonPhased, 1, "trigger-param").map((field) => field.label)).toEqual(["ผล"]);
    expect(visibleFieldsForPhase(nonPhased, 2, "trigger-param").map((field) => field.label)).toEqual(["ผล"]);
    expect(visibleFieldsForPhase(trigger, 2, "trigger-param")).toEqual([]);
    expect(visibleFieldsForPhase(trigger, 2, null)).toEqual([]);
  });

  it("honors field phase on phased non-trigger parameters", () => {
    const phased = param({
      _id: "phased-param",
      hasPhases: true,
      valueFields: [
        { label: "ก่อน", type: "number", unit: "%", phase: "before" },
        { label: "หลัง", type: "number", unit: "%", phase: "after" },
        { label: "ทั้งคู่", type: "text", phase: "both" },
      ],
    });

    expect(visibleFieldsForPhase(phased, 1, "trigger-param").map((field) => field.label)).toEqual(["ก่อน", "ทั้งคู่"]);
    expect(visibleFieldsForPhase(phased, 2, "trigger-param").map((field) => field.label)).toEqual(["หลัง", "ทั้งคู่"]);
  });
});
