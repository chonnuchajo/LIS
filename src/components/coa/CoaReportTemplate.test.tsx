import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CoaReportTemplate from "./CoaReportTemplate";
import type { CoaReportPage } from "@/lib/coaReport";

describe("CoaReportTemplate", () => {
  it("renders the special GR/WP/SP COA form", () => {
    const page: CoaReportPage = {
      template: "grWpSp",
      coaNo: "00052026",
      revision: 0,
      issueDate: "20/08/2569",
      petitionNo: "P-2608-0005",
      customer: {},
      samples: [{
        itemSeq: 1,
        sampleName: "Trade Herbicide",
        commonName: "Glyphosate 48% SL GR",
        batchNo: "B-777",
        lotNo: "LOT-777",
        productionDate: "2026-08-15",
        product: "Trade Herbicide (Glyphosate 48% SL GR)",
        manufacturingDate: "15/08/2026",
        expiredDate: "15/08/2028",
        batchLabel: "LOT-777 / B-777",
        aiContentResult: "48.2%",
        waxBlockSizeResult: "-",
        dateOfAnalysis: "-",
        rows: [{ itemSeq: 1, testItem: "%AI content (W/W)", result: "48.2%" }],
      }],
      remark: "",
      approvedBy: "QC Head",
      approvedAt: "20/08/2569",
    };

    render(<CoaReportTemplate pages={[page]} />);

    expect(screen.getByText("CERTIFICATE OF ANALYSIS")).toBeInTheDocument();
    expect(screen.getByText(/PRODUCT/).closest("div")).toHaveTextContent("PRODUCT : Trade Herbicide (Glyphosate 48% SL GR)");
    expect(screen.getByText(/MANUFACTURING DATE/).closest("div")).toHaveTextContent("MANUFACTURING DATE : 15/08/2026");
    expect(screen.getByText(/EXPIRED DATE/).closest("div")).toHaveTextContent("EXPIRED DATE : 15/08/2028");
    expect(screen.getByText("BATCH NO.")).toBeInTheDocument();
    expect(screen.getByText("48.2%")).toBeInTheDocument();
  });

  it("renders the BROMADIOLONE 0.005% wax block COA form", () => {
    const page: CoaReportPage = {
      template: "bromadiolone0005",
      coaNo: "00082026",
      revision: 0,
      issueDate: "20/08/2569",
      petitionNo: "P-2608-0008",
      customer: {},
      samples: [{
        itemSeq: 1,
        sampleName: "Red Wax Block",
        commonName: "BROMADIOLONE 0.005%",
        batchNo: "B-008",
        lotNo: "LOT-008",
        productionDate: "2026-08-15",
        product: "Red Wax Block (BROMADIOLONE 0.005%)",
        manufacturingDate: "15/08/2026",
        expiredDate: "15/08/2028",
        batchLabel: "LOT-008 / B-008",
        aiContentResult: "0.0051%",
        waxBlockSizeResult: "5.90 gm",
        dateOfAnalysis: "20/08/2026",
        rows: [],
      }],
      remark: "",
      approvedBy: "QC Head",
      approvedAt: "20/08/2569",
    };

    render(<CoaReportTemplate pages={[page]} />);

    expect(screen.getByText("CERTIFICATE OF ANALYSIS")).toBeInTheDocument();
    expect(screen.getByText(/PRODUCT/).closest("div")).toHaveTextContent("PRODUCT : Red Wax Block (BROMADIOLONE 0.005%)");
    expect(screen.getByText("Red wax block")).toBeInTheDocument();
    expect(screen.getByText("0.005% ± 0.00125")).toBeInTheDocument();
    expect(screen.getByText("5.88 gm ± 5%")).toBeInTheDocument();
    expect(screen.getByText("LOT-008 / B-008")).toBeInTheDocument();
    expect(screen.getByText("5.90 gm")).toBeInTheDocument();
  });
});
