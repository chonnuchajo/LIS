import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CoaSamplePreview from "./CoaSamplePreview";
import type { CoaDocument } from "@/types/coa.types";

describe("CoaSamplePreview", () => {
  it("uses the liquid report layout, typography and derived results for the example", () => {
    render(<CoaSamplePreview />);

    const heading = screen.getByRole("heading", { name: "CERTIFICATE OF ANALYSIS" });
    const page = heading.closest("section")!;
    const report = within(page);

    expect(page).toHaveClass("coa-liquid-page");
    expect(window.getComputedStyle(page).backgroundColor).toBe("rgb(255, 255, 255)");
    expect(window.getComputedStyle(page).fontFamily).toContain("Angsana New");
    expect(window.getComputedStyle(page).fontSize).toBe("18pt");
    expect(window.getComputedStyle(heading).fontSize).toBe("20pt");
    expect(report.getByText("NO. 00012026")).toBeInTheDocument();
    expect(report.getByText("August 26, 2026")).toBeInTheDocument();
    expect(report.getByText("PRODUCT :").closest("div")).toHaveTextContent("ชื่อการค้าตัวอย่าง (GLYPHOSATE 48% SL)");
    expect(report.getByText("MANUFACTURER :").closest("div")).toHaveTextContent("I C P Ladda Company Limited, Thailand");
    expect(report.getByText("MANUFACTURING DATE :").closest("div")).toHaveTextContent("01/08/2026");
    expect(report.getByText("EXPIRED DATE :").closest("div")).toHaveTextContent("01/08/2028");
    expect(report.getAllByRole("row").map((row) => Array.from(row.children, (cell) => cell.textContent))).toEqual([
      ["TEST ITEM", "Specification", "Result"],
      ["Appearance", "Clear liquid", "Conform"],
      ["BATCH NO.", "L2608-001 / B2608-001"],
      ["%AI content (W/V)", "48% ± 2.40", "48.3%"],
      ["Density at 30°C (g/cm³)", "1.182"],
      ["Date of analysis", "26/08/2026"],
    ]);
    expect(report.getByText("(สิริพิชญ์ สงสมพันธ์)")).toBeInTheDocument();
    expect(report.getByText("Asst. Quality Control Manager")).toBeInTheDocument();
    expect(report.queryByRole("img")).not.toBeInTheDocument();
    expect(report.queryByRole("columnheader", { name: "Method" })).not.toBeInTheDocument();
    expect(page).not.toHaveTextContent("W/W");
    expect(page).not.toHaveTextContent("g/ml");
    expect(screen.getByText(/จากข้อมูลจำลอง/)).toBeInTheDocument();
  });

  it("uses the document trade name and results without mixing in demo data", () => {
    const document: CoaDocument = {
      _id: "actual-coa", revision: 0, status: "requested", petitionId: "actual-petition",
      selectedItemSeqs: [1],
      sampleSnapshots: [{ itemSeq: 1, sampleName: "  Trade A  ", commonName: "GLYPHOSATE 48% SL", batchNo: "ACTUAL-BATCH" }],
      resultSnapshots: [],
    };
    const { rerender } = render(<CoaSamplePreview document={document} />);

    expect(screen.getByText("PRODUCT :").closest("div")).toHaveTextContent("Trade A (GLYPHOSATE 48% SL)");
    expect(screen.getByText("ชื่อการค้า").parentElement).toHaveTextContent("Trade A");
    expect(screen.queryByText(/ชื่อการค้าตัวอย่าง/)).not.toBeInTheDocument();
    expect(screen.queryByText("48.3%")).not.toBeInTheDocument();
    expect(screen.queryByText(/B2608-001/)).not.toBeInTheDocument();

    rerender(<CoaSamplePreview document={{ ...document, sampleSnapshots: [{ ...document.sampleSnapshots[0], sampleName: "Trade B" }] }} />);
    expect(screen.getByText("PRODUCT :").closest("div")).toHaveTextContent("Trade B (GLYPHOSATE 48% SL)");
    expect(screen.queryByText("Trade A")).not.toBeInTheDocument();

    rerender(<CoaSamplePreview document={{ ...document, sampleSnapshots: [] }} />);
    expect(screen.getByText("ชื่อการค้า").parentElement).toHaveTextContent("-");
    expect(screen.queryByText(/ชื่อการค้าตัวอย่าง/)).not.toBeInTheDocument();
  });
});
