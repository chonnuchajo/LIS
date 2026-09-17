import type { CellValue, Worksheet } from "exceljs";
import { pdfTextRows, type ValidationDocument } from "./validationDocumentData";

function cellText(value: CellValue): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  if ("formula" in value || "sharedFormula" in value) return "[เซลล์สูตร: กรุณาตรวจและใช้ค่าผลลัพธ์]";
  if ("richText" in value) return value.richText.map(run => run.text).join("");
  if ("error" in value) return value.error;
  if ("text" in value) return String(value.text);
  return "[ชนิดข้อมูลที่ไม่รองรับ]";
}

export function worksheetRows(sheet: Worksheet) {
  if (sheet.rowCount > 10000 || sheet.columnCount > 100) throw new Error("ชีตต้องไม่เกิน 10,000 แถวและ 100 คอลัมน์ กรุณาแยกเฉพาะตารางที่ต้องใช้");
  let length = 0;
  return Array.from({ length: sheet.rowCount }, (_, rowIndex) => Array.from({ length: sheet.columnCount }, (_, column) => {
    const cell = sheet.getRow(rowIndex + 1).getCell(column + 1);
    const text = cell.isMerged && cell.master.address !== cell.address ? "" : cellText(cell.value);
    length += text.length + 1;
    if (length > 1000000) throw new Error("ข้อมูลในชีตมากเกินไป กรุณาแยกตารางที่ต้องใช้");
    return text;
  }));
}

/** Local parsing only: no file contents are uploaded to a server or external API. */
export async function openValidationDocument(file: File): Promise<ValidationDocument> {
  if (file.size > 20 * 1024 * 1024) throw new Error("Excel/PDF ต้องไม่เกิน 20 MB");
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "xlsx") {
    const { default: ExcelJS } = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    if (!workbook.worksheets.length) throw new Error("ไม่พบชีตในไฟล์ Excel");
    return { name: file.name, kind: "xlsx", parts: workbook.worksheets.map(sheet => sheet.name), readPart: async index => {
      const sheet = workbook.worksheets[index];
      if (!sheet) throw new Error("ไม่พบชีตที่เลือก");
      return { rows: worksheetRows(sheet), warning: "รวมแถวที่ซ่อนไว้ด้วย · เซลล์สูตรต้องตรวจผลและแปลงเป็นค่าก่อนใช้ · ช่องรวมแสดงค่าเฉพาะช่องแรก" };
    }, dispose: async () => { /* Workbook is released with the reader reference. */ } };
  }
  if (extension !== "pdf") throw new Error("รองรับ Excel .xlsx และ PDF; สำหรับ .xls ให้บันทึกเป็น .xlsx ก่อน");
  const [pdfjs, worker] = await Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.mjs?url")]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const document = await task.promise;
    if (document.numPages > 200) throw new Error("PDF ต้องไม่เกิน 200 หน้า กรุณาแยกช่วงที่ต้องใช้");
    return { name: file.name, kind: "pdf", parts: Array.from({ length: document.numPages }, (_, index) => `หน้า ${index + 1}`), dispose: () => task.destroy(), readPart: async index => {
      const page = await document.getPage(index + 1);
      try {
        const text = await page.getTextContent();
        if (text.items.length > 20000) throw new Error("หน้านี้มีข้อความมากเกินไป กรุณาแยกตารางก่อนนำเข้า");
        const rows = pdfTextRows(text.items.flatMap(item => "str" in item ? [{ str: item.str, x: item.transform[4], y: item.transform[5], width: item.width, height: item.height }] : []));
        if (rows.reduce((total, row) => total + row.join("\t").length, 0) > 1000000) throw new Error("ข้อความในหน้านี้มากเกินไป กรุณาแยกตารางก่อนนำเข้า");
        const viewport = page.getViewport({ scale: 1 });
        const scaled = page.getViewport({ scale: Math.min(900 / viewport.width, 1400 / viewport.height, 2) });
        const canvas = window.document.createElement("canvas");
        canvas.width = Math.ceil(scaled.width); canvas.height = Math.ceil(scaled.height);
        await page.render({ canvas, viewport: scaled }).promise;
        const preview = canvas.toDataURL("image/png");
        canvas.width = 0; canvas.height = 0;
        return { rows, preview, warning: rows.length ? "PDF จัดกลุ่มข้อความตามตำแหน่ง กรุณาเทียบทุกค่ากับภาพต้นฉบับ โดยเฉพาะช่องว่างและตัวเลขที่แยกเป็นหลายส่วน" : "หน้านี้ไม่มีข้อความที่อ่านได้ อาจเป็นภาพสแกน ต้องใช้ OCR หรือกรอกข้อมูลจากเอกสารด้วยตนเอง" };
      } finally { page.cleanup(); }
    } };
  } catch (error) { await task.destroy(); throw error; }
}
