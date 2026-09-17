export type DocumentPart = { rows: string[][]; preview?: string; warning?: string };
export type ValidationDocument = {
  name: string;
  kind: "xlsx" | "pdf";
  parts: string[];
  readPart: (index: number) => Promise<DocumentPart>;
  dispose: () => Promise<void>;
};

/** Mapping is explicit and keeps empty cells/rows, so missing results cannot shift silently. */
export function mapDocumentRows(rows: string[][], first: number, last: number, mapping: number[]) {
  if (!Number.isInteger(first) || !Number.isInteger(last) || first < 1 || last < first || last > rows.length) return { text: null, error: "เลือกช่วงแถวให้ถูกต้อง" };
  if (!mapping.length || mapping.some(index => !Number.isInteger(index) || index < 0)) return { text: null, error: "จับคู่คอลัมน์ต้นทางให้ครบทุกช่อง" };
  if (new Set(mapping).size !== mapping.length) return { text: null, error: "เลือกคอลัมน์ต้นทางซ้ำกัน กรุณาตรวจการจับคู่" };
  const text = rows.slice(first - 1, last).map(row => mapping.map(index => row[index] ?? "").join("\t")).join("\n");
  return { text, error: "" };
}

export type PdfTextPosition = { str: string; x: number; y: number; width: number; height: number };
/** Geometric grouping is only a draft. The user must compare PDF and extracted rows. */
export function pdfTextRows(items: PdfTextPosition[]) {
  const lines: { y: number; items: PdfTextPosition[] }[] = [];
  for (const item of [...items].filter(item => item.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x)) {
    const line = lines.find(line => Math.abs(line.y - item.y) <= Math.max(1, Math.min(3, item.height * 0.2)));
    if (line) line.items.push(item); else lines.push({ y: item.y, items: [item] });
  }
  return lines.map(line => {
    const cells: { text: string; end: number }[] = [];
    for (const item of line.items.sort((a, b) => a.x - b.x)) {
      const previous = cells[cells.length - 1];
      if (previous && item.x - previous.end <= 2) { previous.text += item.str; previous.end = Math.max(previous.end, item.x + item.width); }
      else cells.push({ text: item.str, end: item.x + item.width });
    }
    return cells.map(cell => cell.text.trim());
  });
}
