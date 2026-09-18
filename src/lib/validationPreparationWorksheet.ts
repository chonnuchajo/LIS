import { preparationPlan, type PreparationLevel, type ValidationStock } from "./validationPreparation";
import { escapeReport as e } from "./validationReport";

export function preparationWorksheet(meta: { analyte: string; method: string }, levels: PreparationLevel[], stock: number | null, stocks: ValidationStock[]) {
  const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 6 });
  const names = { linearity: "Linearity", accuracy: "Accuracy / Precision", suitability: "Specificity / SST", qc: "QC" };
  const rows = levels.map((level, i) => {
    const p = preparationPlan(level, stock, stocks);
    const name = level.stockId ? stocks.find(s => s.id === level.stockId)?.name || level.stockId : "Stock หลัก";
    return `<tr><td>${i + 1}</td><td>${e(names[level.purpose])}</td><td>${e(name)}</td>${p ? [p.stock,p.target,p.finalUl / 1000,p.aliquotUl,p.matrixUl,p.solventUl].map(n => `<td>${fmt(n)}</td>`).join("") : '<td colspan="6">ข้อมูลไม่ครบหรือเตรียมด้วย Stock นี้ไม่ได้ — ห้ามใช้แถวนี้เตรียมสาร</td>'}<td>________</td></tr>`;
  }).join("");
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>ใบเตรียมสาร Validation</title><style>@page{size:A4 landscape;margin:12mm}body{font:12px/1.6 Tahoma,Arial,sans-serif;color:#172033;padding:16px}h1{font-size:22px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #888;padding:7px;text-align:left}th{background:#eee}tr{break-inside:avoid}thead{display:table-header-group}@media print{body{padding:0}}</style></head><body><h1>ใบเตรียมสารสำหรับ Validation</h1><p>สาร: ${e(meta.analyte)} · วิธี: ${e(meta.method)}</p><p>วันที่เตรียม: __________________ ผู้เตรียม: __________________ ผู้ตรวจสอบ: __________________</p><p>Solvent ที่ใช้ / Lot: __________________________________________</p><table><thead><tr>${["ลำดับ","ใช้สำหรับ","Stock","C stock (mg/mL)","Final conc (mg/mL)","Final volume (mL)","ปิเปต Stock (µL)","Matrix (µL)","Solvent โดยคำนวณ (µL)","ปิเปตจริง (µL)"].map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table><p>V stock = Final conc × Final volume ÷ C stock (ใช้หน่วยปริมาตรเดียวกัน)<br>V solvent = V final − V stock − V matrix</p><p>เติม Solvent แล้วปรับปริมาตรให้ถึง Final volume ตามวิธีที่กำหนด ปริมาตร Solvent ในตารางเป็นค่าคำนวณโดยสมมติปริมาตรรวมกันได้<br>ตัวเลขแสดงไม่เกิน 6 ตำแหน่งทศนิยม เลือกอุปกรณ์ปิเปตที่เหมาะสม บันทึกปริมาตรจริงเพื่อคำนวณ Actual ภายหลัง ใบนี้เป็นแผนเตรียมสาร ไม่ใช่ผลวัด</p><p>บันทึกเพิ่มเติม: __________________________________________________________________________</p></body></html>`;
}
