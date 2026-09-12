import { describe, expect, it } from "vitest";
import {
  duplicateBatchError,
  hasLabTrack,
  hasSendToLabOverride,
  labSendOverrideNoteError,
  isResearchAndDevelopmentPetition,
  requiresQcTrack,
  shouldSendItemToLab,
} from "./petitionRouting";
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

  it("lets explicit sendToLab override the batch suffix default", () => {
    expect(shouldSendItemToLab({ batchNo: "B-1" })).toBe(true);
    expect(shouldSendItemToLab({ batchNo: "B-1", sendToLab: false })).toBe(false);
    expect(shouldSendItemToLab({ batchNo: "B-2", sendToLab: true })).toBe(true);
    expect(hasLabTrack({ items: [{ seq: 1, sampleName: "S", batchNo: "B-1", sendToLab: false }] } as Petition)).toBe(false);
    expect(hasLabTrack({ items: [{ seq: 1, sampleName: "S", batchNo: "B-2", sendToLab: true }] } as Petition)).toBe(true);
  });

  it("requires note when sendToLab differs from the default", () => {
    const override = { seq: 2, sampleName: "S", batchNo: "B-2", sendToLab: true, note: "" };
    expect(hasSendToLabOverride(override)).toBe(true);
    expect(labSendOverrideNoteError([override])).toBe("ตัวอย่างลำดับ 2: โปรดระบุเหตุผล");
    expect(labSendOverrideNoteError([{ ...override, note: "ส่งทดสอบเพิ่ม" }])).toBeNull();
  });

  it("allows duplicate production batch text for QC-only rows", () => {
    const items = [
      { batchNo: "*ขายต.ย.ให้ QC = 1 ขวด", sendToLab: false },
      { batchNo: "*ขายต.ย.ให้ QC = 1 ขวด", sendToLab: false },
    ];

    expect(duplicateBatchError(items, { department: "Production", labOnly: true })).toBeNull();
  });

  it("still rejects duplicate lab batches", () => {
    const items = [
      { batchNo: "BATCH001", sendToLab: true },
      { batchNo: "BATCH001", sendToLab: true },
    ];

    expect(duplicateBatchError(items, { department: "Production", labOnly: true })).toBe("พบ batch ซ้ำ: BATCH001");
  });

  it("keeps all-batch duplicate checks when labOnly is off", () => {
    const items = [
      { batchNo: "BATCH002", sendToLab: false },
      { batchNo: "BATCH002", sendToLab: false },
    ];

    expect(duplicateBatchError(items)).toBe("พบ batch ซ้ำ: BATCH002");
  });
});
