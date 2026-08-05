import { describe, expect, it } from "vitest";
import { buildCoaReportPages } from "./coaReport";
import type { CoaDocument } from "@/types/coa.types";

describe("buildCoaReportPages", () => {
  it("groups frozen result rows by selected sample", () => {
    const doc = {
      _id: "c1",
      coaNo: "00012026",
      revision: 1,
      status: "reissued",
      petitionId: "p1",
      petitionNoSnapshot: "P-2608-0001",
      selectedItemSeqs: [1],
      customerSnapshot: { name: "Customer A", company: "ICP Ladda" },
      sampleSnapshots: [{ itemSeq: 1, sampleName: "Sample A", batchNo: "B1" }],
      resultSnapshots: [{ itemSeq: 1, testItem: "pH", result: "7.0", criteria: "6.5-7.5", method: "M1" }],
      approval: { approvedBy: { name: "QC Head" }, approvedAt: "2026-08-04T00:00:00.000Z" },
    } as CoaDocument;

    const pages = buildCoaReportPages(doc);
    expect(pages).toHaveLength(1);
    expect(pages[0].coaNo).toBe("00012026");
    expect(pages[0].revision).toBe(1);
    expect(pages[0].samples[0].rows[0].testItem).toBe("pH");
  });
});
