import { describe, expect, it } from "vitest";
import { buildLaLisAssistant } from "./laLisAssistant";
import type { ApprovalItemGroup } from "./qcApprovalRows";
import type { Petition } from "@/types/petition.types";

const petition = {
  _id: "p1",
  petitionNo: "P-1",
  dept: "production",
  status: "success",
  submittedBy: { name: "A", submittedAt: "2026-01-01" },
  items: [{ seq: 1, sampleName: "S", batchNo: "B", sampleId: "S-1" }],
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
} as Petition;

const groups: ApprovalItemGroup[] = [{
  seq: 1,
  sampleName: "S",
  sampleId: "S-1",
  params: [{
    parameterId: "x",
    parameterName: "%AI",
    scope: "qc",
    hasPhases: false,
    rows: [
      { key: "ok", label: "A", value: "10", standardText: ">= 9", abnormal: false, note: "", phase: 1 },
      { key: "bad", label: "B", value: "7", standardText: ">= 9", abnormal: true, note: "", phase: 1 },
    ],
  }],
  unmatched: false,
}];

describe("buildLaLisAssistant", () => {
  it("summarizes report readiness and OOS rows", () => {
    const result = buildLaLisAssistant(petition, [{ reportCustomerName: "ICP" } as never], groups);

    expect(result.abnormalCount).toBe(1);
    expect(result.oos[0].level).toBe("danger");
    expect(result.draft).toContain("พบผลนอกเกณฑ์ 1 รายการ");
  });
});
