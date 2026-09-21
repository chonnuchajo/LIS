import { stats } from "./validationCalculator";
import type { ValidationReportInput } from "./validationReport";

// Reference report tables 3–4 use µg/mL; inputs and calculations remain in mg/mL.
export function referenceAccuracyTable(input: ValidationReportInput, rows: number[][], daily = false) {
  const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  const fmt = (v: number | null | undefined) => v == null || !Number.isFinite(v) ? "—" : v.toFixed(2);
  const levels = input.precision.summaries.slice().sort((a, b) => a.level - b.level);
  if (!levels.length) return "<p>ยังไม่มีข้อมูลสำหรับตาราง</p>";
  const groups = levels.map(level => rows.filter(row => row[daily ? 1 : 0] === level.level));
  const days = [...new Set(rows.map(row => row[0]))].sort((a, b) => a - b);
  const count = daily ? days.length : Math.max(0, ...groups.map(group => group.length));
  const body = Array.from({ length: count }, (_, i) => `<tr><td>${daily ? `Day ${escape(days[i])}` : i + 1}</td>${groups.map(group => {
    const data = daily ? group.filter(row => row[0] === days[i]).map(row => row.slice(1)) : group[i] ? [group[i]] : [];
    const found = stats(data.map(row => row[2] * 1000));
    const fortified = stats(data.map(row => row[1] * 1000));
    const recovery = stats(data.filter(row => row[1] > 0).map(row => row[2] / row[1] * 100));
    return `<td>${fmt(daily ? found?.mean : data[0]?.[2] * 1000)}${daily ? `<br>n=${data.length}` : ""}</td><td>${fmt(daily ? fortified?.mean : data[0]?.[1] * 1000)}</td><td>${fmt(daily ? recovery?.mean : data[0]?.[1] > 0 ? data[0][2] / data[0][1] * 100 : null)}</td>`;
  }).join("")}</tr>`).join("");
  const summaries = ["Mean", "SD", "%RSD", "Horwitz", daily ? "HorRat(IP)" : "HorRat(r)"].map(label => `<tr><th>${label}</th>${levels.map((level, i) => {
    const data = groups[i].map(row => daily ? row.slice(1) : row);
    const found = stats(data.map(row => row[2] * 1000));
    const recovery = stats(data.filter(row => row[1] > 0).map(row => row[2] / row[1] * 100));
    if (label === "Mean") return `<td>${fmt(found?.mean)}</td><td>${fmt(stats(data.map(row => row[1] * 1000))?.mean)}</td><td>${fmt(recovery?.mean)}</td>`;
    const value = label === "SD" ? daily ? level.anova?.sd : recovery?.sd : label === "%RSD" ? daily ? level.anova?.rsd : recovery?.rsd : label === "Horwitz" ? daily ? level.predictedR : level.predictedRepeatability : daily ? level.intermediateRatio : level.ratio;
    return `<td colspan="3">${fmt(value)}</td>`;
  }).join("")}</tr>`).join("");
  return `<table class="reference-results"><thead><tr><th rowspan="3">${daily ? "Day" : "No."}</th><th colspan="${levels.length * 3}">${escape(input.analyte)} concentration</th></tr><tr>${levels.map((level, i) => `<th colspan="3">${["Low-Point", "Mid-Point", "High-Point"][i] || "Level"}<br>${escape(level.level)} mg/mL (${fmt(level.level * 1000)} µg/mL)</th>`).join("")}</tr><tr>${levels.map(() => `<th>${daily ? "Mean Found" : "Found"}<br>µg/mL</th><th>Fortified<br>µg/mL</th><th>%Recovery</th>`).join("")}</tr></thead><tbody>${body || `<tr><td colspan="${1 + levels.length * 3}">ยังไม่มีผลวัด</td></tr>`}${summaries}</tbody></table><p class="muted">SD และ %RSD ในแถวสรุปใช้ Recovery; ความเที่ยงระหว่างวันใช้ ANOVA จากผลวัดรายซ้ำ</p>`;
}
