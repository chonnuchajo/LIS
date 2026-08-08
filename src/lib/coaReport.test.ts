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

  it("uses the GR/WP/SP COA form data for common names with those suffixes", () => {
    const doc = {
      _id: "c-gr",
      coaNo: "00052026",
      revision: 0,
      status: "approved",
      petitionId: "p-gr",
      petitionNoSnapshot: "P-2608-0005",
      selectedItemSeqs: [1],
      customerSnapshot: { name: "Customer A" },
      sampleSnapshots: [{
        itemSeq: 1,
        sampleName: "Trade Herbicide",
        commonName: "Glyphosate 48% SL GR",
        batchNo: "B-777",
        lotNo: "LOT-777",
        productionDate: "2026-08-15",
      }],
      resultSnapshots: [{ itemSeq: 1, testItem: "%AI content (W/W)", result: "48.2%" }],
      approval: { approvedBy: { name: "QC Head" }, approvedAt: "2026-08-20T00:00:00.000Z" },
    } as CoaDocument;

    const pages = buildCoaReportPages(doc);

    expect(pages[0].template).toBe("grWpSp");
    expect(pages[0].samples[0].product).toBe("Trade Herbicide (Glyphosate 48% SL GR)");
    expect(pages[0].samples[0].manufacturingDate).toBe("15/08/2026");
    expect(pages[0].samples[0].expiredDate).toBe("15/08/2028");
    expect(pages[0].samples[0].aiContentResult).toBe("48.2%");
  });

  it("uses the BROMADIOLONE 0.005% wax block COA form data", () => {
    const doc = {
      _id: "c-brom",
      coaNo: "00082026",
      revision: 0,
      status: "approved",
      petitionId: "p-brom",
      petitionNoSnapshot: "P-2608-0008",
      selectedItemSeqs: [1],
      customerSnapshot: { name: "Customer A" },
      sampleSnapshots: [{
        itemSeq: 1,
        sampleName: "Red Wax Block",
        commonName: "BROMADIOLONE 0.005%",
        batchNo: "B-008",
        lotNo: "LOT-008",
        productionDate: "2026-08-15",
      }],
      resultSnapshots: [
        { itemSeq: 1, testItem: "%AI content (W/W)", result: "0.0051%" },
        { itemSeq: 1, testItem: "Wax block size", result: "5.90 gm" },
        { itemSeq: 1, testItem: "Date of analysis", result: "2026-08-20" },
      ],
      approval: { approvedBy: { name: "QC Head" }, approvedAt: "2026-08-20T00:00:00.000Z" },
    } as CoaDocument;

    const pages = buildCoaReportPages(doc);

    expect(pages[0].template).toBe("bromadiolone0005");
    expect(pages[0].samples[0].product).toBe("Red Wax Block (BROMADIOLONE 0.005%)");
    expect(pages[0].samples[0].batchLabel).toBe("LOT-008 / B-008");
    expect(pages[0].samples[0].aiContentResult).toBe("0.0051%");
    expect(pages[0].samples[0].waxBlockSizeResult).toBe("5.90 gm");
    expect(pages[0].samples[0].dateOfAnalysis).toBe("20/08/2026");
  });
});
