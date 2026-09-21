import type { ConcentrationUnit } from "./validationPreparation";

/** Import is atomic: a bad row never produces a partial replacement dataset. */
export function prepareValidationImport(source: string, columns: string[], units: Record<number, ConcentrationUnit>, hasHeader = false) {
  if (source.length > 200000) return { errors: ["ข้อมูลต้องไม่เกิน 200,000 ตัวอักษรต่อตาราง"], rows: [] as number[][], text: null };
  const errors: string[] = [];
  const rows: number[][] = [];
  const lines = source.replace(/^\uFEFF/, "").split(/\r?\n/);
  if (hasHeader) lines.shift();
  if (!columns.length) errors.push("ยังไม่ได้กำหนดคอลัมน์ปลายทาง");
  lines.forEach((line, index) => {
    if (!line.trim() && !/[,;\t]/.test(line)) return;
    const cells = line.split(/[,;\t]/).map(cell => cell.trim());
    const lineNumber = index + 1 + Number(hasHeader);
    if (cells.length !== columns.length) {
      errors.push(`แถว ${lineNumber}: ต้องมี ${columns.length} ช่อง แต่พบ ${cells.length} ช่อง`);
      return;
    }
    const converted = cells.map((cell, column) => {
      // Decimal/scientific notation only; do not guess thousands separators or units.
      if (!/^[+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(cell) || !Number.isFinite(Number(cell))) {
        errors.push(`แถว ${lineNumber} · ${columns[column]}: ต้องเป็นตัวเลขไม่ติดลบ ไม่ใส่หน่วยหรือเครื่องหมายคั่นหลักพัน`);
        return NaN;
      }
      const value = Number(cell);
      const normalized = units[column] && units[column] !== "mg/mL" ? value / 1000 : value;
      if (!Number.isFinite(normalized) || (normalized === 0 && /[1-9]/.test(cell.split(/[eE]/)[0]))) {
        errors.push(`แถว ${lineNumber} · ${columns[column]}: ค่าเล็กหรือใหญ่เกินช่วงคำนวณ`);
        return NaN;
      }
      return normalized;
    });
    rows.push(converted);
  });
  if (!rows.length && !errors.length) errors.push("กรอกข้อมูลอย่างน้อย 1 แถว");
  const text = rows.map(row => row.join("\t")).join("\n");
  if (text.length > 200000) errors.push("ข้อมูลหลังแปลงเกิน 200,000 ตัวอักษร กรุณาแบ่งตาราง");
  return { errors, rows: errors.length ? [] : rows, text: errors.length ? null : text };
}
