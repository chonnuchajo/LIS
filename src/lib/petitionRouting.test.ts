import { describe, expect, it } from "vitest";
import { hasLabTrack, isResearchAndDevelopmentPetition, requiresQcTrack } from "./petitionRouting";
import type { Petition } from "@/types/petition.types";

describe("petitionRouting", () => {
  it("recognizes R&D submitter department variants", () => {
    expect(isResearchAndDevelopmentPetition({ submittedBy: { department: "R & D" } } as Petition)).toBe(true);
    expect(isResearchAndDevelopmentPetition({ submittedBy: { department: "r&d" } } as Petition)).toBe(true);
    expect(isResearchAndDevelopmentPetition({ submittedBy: { department: "Production" } } as Petition)).toBe(false);
  });

  it("routes every R&D petition to Lab and not QC even without a Lab batch number", () => {
    const petition = {
      submittedBy: { department: "R & D" },
      items: [{ seq: 1, sampleName: "R&D sample", batchNo: "" }],
    } as Petition;
    expect(hasLabTrack(petition)).toBe(true);
    expect(requiresQcTrack(petition)).toBe(false);
  });

  it("keeps non-R&D routing based on Lab batch suffix", () => {
    expect(hasLabTrack({ items: [{ seq: 1, sampleName: "S", batchNo: "B-1" }] } as Petition)).toBe(true);
    expect(hasLabTrack({ items: [{ seq: 1, sampleName: "S", batchNo: "B-2" }] } as Petition)).toBe(false);
    expect(requiresQcTrack({ submittedBy: { department: "Production" } } as Petition)).toBe(true);
  });
});
