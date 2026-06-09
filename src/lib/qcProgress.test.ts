import { describe, it, expect } from "vitest";
import { computePetitionProgress } from "./qcProgress";
import type { ParameterItem } from "@/lib/api";
import type { Petition } from "@/types/petition.types";

// A parameter that applies to all items (applyAll) with one substanceMode field.
const param = {
  _id: "p1",
  name: "ปริมาณสารสำคัญ",
  applyAll: true,
  valueFields: [
    {
      label: "ปริมาณสารสำคัญ",
      type: "number",
      unit: "%",
      substanceMode: true,
      substanceStandards: [
        { substance: "ABAMECTIN", operator: "gte", value: 95, value2: null },
        { substance: "IMIDACLOPRID", operator: "gte", value: 90, value2: null },
      ],
    },
  ],
} as unknown as ParameterItem;

const petition = {
  items: [
    { seq: 1, sampleId: "s1", sampleName: "X", commonName: "ABAMECTIN + IMIDACLOPRID" },
  ],
} as unknown as Petition;

describe("computePetitionProgress — substanceMode", () => {
  it("counts one slot per substance and matches filled by composite key", () => {
    const entries = [
      { itemSeq: 1, parameterId: "p1", filledLabels: ["ปริมาณสารสำคัญ::abamectin"] },
    ] as any;
    const r = computePetitionProgress(petition, [param], entries);
    expect(r.total).toBe(2);
    expect(r.filled).toBe(1);
    expect(r.percent).toBe(50);
  });

  it("reaches 100% when all substance slots are filled", () => {
    const entries = [
      {
        itemSeq: 1,
        parameterId: "p1",
        filledLabels: ["ปริมาณสารสำคัญ::abamectin", "ปริมาณสารสำคัญ::imidacloprid"],
      },
    ] as any;
    const r = computePetitionProgress(petition, [param], entries);
    expect(r.total).toBe(2);
    expect(r.filled).toBe(2);
    expect(r.percent).toBe(100);
  });
});
