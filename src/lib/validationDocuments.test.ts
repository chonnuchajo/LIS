import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { worksheetRows } from "./validationDocuments";
import { mapDocumentRows, pdfTextRows } from "./validationDocumentData";
import { prepareValidationImport } from "./validationImport";

describe("อ่านเอกสาร Validation", () => {
  it("reads actual workbook cells including hidden rows without accepting cached formulas", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Accuracy");
    sheet.addRows([["ID", "Target", "Found"], ["S1", 0.5, 501.2], ["S2", 0.5, null]]);
    sheet.getRow(2).hidden = true;
    sheet.getCell("C4").value = { formula: "500+1", result: 501 };
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(await workbook.xlsx.writeBuffer());
    const rows = worksheetRows(loaded.worksheets[0]);
    expect(rows[1]).toEqual(["S1", "0.5", "501.2"]);
    expect(rows[2]).toEqual(["S2", "0.5", ""]);
    expect(rows[3][2]).toContain("เซลล์สูตร");
    const mapped = mapDocumentRows(rows, 2, 3, [1, 2]);
    expect(prepareValidationImport(mapped.text!, ["Target", "Found"], { 1: "µg/mL" }).text).toBeNull();
  });
  it("does not duplicate a merged value across cells", () => {
    const sheet = new ExcelJS.Workbook().addWorksheet("Merged");
    sheet.getCell("A1").value = 500;
    sheet.mergeCells("A1:B1");
    expect(worksheetRows(sheet)).toEqual([["500", ""]]);
  });
  it("requires an explicit valid range and unique mapping, preserving missing cells", () => {
    const rows = [["id", "area", "conc"], ["S1", "125", "500"], ["S2", "126"]];
    expect(mapDocumentRows(rows, 2, 3, [2, 1]).text).toBe("500\t125\n\t126");
    expect(mapDocumentRows(rows, 2, 3, [1, 1]).text).toBeNull();
    expect(mapDocumentRows(rows, 1, 4, [1, 2]).text).toBeNull();
    expect(mapDocumentRows(rows, 1, 2, [-1, 2]).text).toBeNull();
  });
  it("groups PDF text by baseline and joins only adjacent fragments", () => {
    const item = (str: string, x: number, y: number, width = 20) => ({ str, x, y, width, height: 10 });
    expect(pdfTextRows([item("125", 100, 200), item("5", 20, 200, 5), item("00", 25, 200), item("126", 100, 180), item("501", 20, 180)])).toEqual([["500", "125"], ["501", "126"]]);
  });
});
