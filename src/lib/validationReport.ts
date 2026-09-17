import type { ValidationCheck, evaluatePrecision, evaluateQc } from "./validationAdvanced";
import { formatValidationNumber as fmt } from "./validationAdvanced";
import type { PreparationLevel } from "./validationPreparation";
import { dilution } from "./validationPreparation";
import { parseMeasurements, regression, stats } from "./validationCalculator";

export type ValidationReportInput = {
  title: string; analyte: string; method: string; analyst: string; reviewer: string;
  protocol: string; calibration: string; notes: string;
  prep: string[]; levels: PreparationLevel[]; texts: string[]; blank: string;
  checks: ValidationCheck[]; errors: string[];
  precision: ReturnType<typeof evaluatePrecision>;
  qc: ReturnType<typeof evaluateQc>; includeQc: boolean;
};

export function escapeReport(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
const table = (headers: string[], rows: unknown[][]) => `<table><thead><tr>${headers.map(h => `<th>${escapeReport(h)}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map(row => `<tr>${row.map(c => `<td>${escapeReport(c)}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}">ยังไม่มีข้อมูล</td></tr>`}</tbody></table>`;

/** Standalone SVG chart: all coordinates are derived from finite numeric measurements. */
function scatter(points: { x: number; y: number }[], title: string, xLabel: string, yLabel: string, line?: { slope: number; intercept: number }) {
  const valid = points.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (!valid.length) return "<p>ยังไม่มีข้อมูลสำหรับกราฟ</p>";
  const xs = valid.map(p => p.x), ys = valid.map(p => p.y);
  const xmin = Math.min(0, ...xs), xmax = Math.max(...xs, 0.001);
  const ymin = Math.min(0, ...ys), ymax = Math.max(...ys, 0.001);
  const x = (v: number) => 70 + (v - xmin) / (xmax - xmin) * 580;
  const y = (v: number) => 280 - (v - ymin) / (ymax - ymin) * 220;
  return `<figure><figcaption>${escapeReport(title)}</figcaption><svg viewBox="0 0 720 340" role="img" aria-label="${escapeReport(title)}"><path d="M70 60V280H650" fill="none" stroke="#64748b"/>${[0, 0.25, 0.5, 0.75, 1].map(t => `<line x1="70" x2="650" y1="${60 + t * 220}" y2="${60 + t * 220}" stroke="#e2e8f0"/><text x="62" y="${64 + t * 220}" text-anchor="end" font-size="11">${fmt(ymax - t * (ymax - ymin))}</text><text x="${70 + t * 580}" y="300" text-anchor="middle" font-size="11">${fmt(xmin + t * (xmax - xmin))}</text>`).join("")}${line ? `<line x1="${x(Math.min(...xs))}" y1="${y(line.slope * Math.min(...xs) + line.intercept)}" x2="${x(xmax)}" y2="${y(line.slope * xmax + line.intercept)}" stroke="#0f766e"/>` : ""}${valid.map(p => `<circle cx="${x(p.x)}" cy="${y(p.y)}" r="3" fill="#2563eb"/>`).join("")}<text x="360" y="330" text-anchor="middle" font-size="13">${escapeReport(xLabel)}</text><text x="70" y="35" font-size="13">${escapeReport(yLabel)}</text></svg></figure>`;
}

export function createValidationReport(input: ValidationReportInput) {
  const e = escapeReport;
  const parsed = input.texts.map((text, i) => parseMeasurements(text, i === 2 ? 3 : 2));
  const fit = parsed[1]?.errors.length ? null : regression(parsed[1]?.rows ?? []);
  const [weight, purity, volume] = input.prep.map(Number);
  const stock = weight > 0 && purity > 0 && purity <= 100 && volume > 0 ? weight * purity / 100 / volume : null;
  const status = input.errors.length || input.checks.some(c => c.pass === false) ? "พบข้อผิดพลาด / ต้องทบทวน" : input.checks.every(c => c.pass === true) && input.checks.length ? "ผ่านเงื่อนไขที่คำนวณ — รออนุมัติรายงาน" : "ข้อมูลหรือการทบทวนยังไม่ครบ";
  const accuracyRows = (parsed[2]?.rows ?? []).map(([level, expected, found], i) => [i + 1, level, expected, found, expected > 0 ? fmt(found / expected * 100) : "คำนวณไม่ได้", expected > 0 ? fmt((found - expected) / expected * 100) : "คำนวณไม่ได้"]);
  const groupedLinearity = [...new Set((parsed[1]?.rows ?? []).map(r => r[0]))].sort((a, b) => a - b).map(level => {
    const data = parsed[1].rows.filter(r => r[0] === level).map(r => r[1]);
    const result = stats(data);
    return [level, data.length, fmt(result?.mean), fmt(result?.sd), fmt(result?.rsd)];
  });
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><title>${e(input.title)}</title><style>
  *{box-sizing:border-box}body{font:14px/1.65 Tahoma,Arial,sans-serif;color:#172033;margin:0;background:#eef2f6}main{max-width:1000px;margin:32px auto;padding:40px;background:white}h1{font-size:25px;margin:0}h2{font-size:19px;border-bottom:2px solid #2563eb;padding-bottom:8px;margin-top:30px}h3{font-size:15px}p{white-space:pre-wrap}table{width:100%;border-collapse:collapse;margin:12px 0 20px;font-size:12px;table-layout:auto}th,td{border:1px solid #cbd5e1;padding:7px;vertical-align:top;overflow-wrap:anywhere}th{background:#eff4fa;text-align:left}tr{break-inside:avoid}thead{display:table-header-group}.muted{color:#64748b}.notice{padding:14px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc}.errors{color:#991b1b}figure{margin:12px 0;break-inside:avoid}figcaption{font-weight:bold}svg{width:100%;max-height:360px}.two{display:grid;grid-template-columns:1fr 1fr;gap:16px}pre{white-space:pre-wrap;overflow-wrap:anywhere;border:1px solid #cbd5e1;padding:12px;font-size:11px}@page{size:A4;margin:15mm}@media print{body{background:white}main{margin:0;padding:0;max-width:none}.screen{display:none}h2,h3{break-after:avoid}a{color:inherit;text-decoration:none}}@media(max-width:640px){main{margin:0;padding:16px}.two{display:block}table{font-size:10px}}
  </style></head><body><main><p class="screen notice">รายงาน HTML พร้อมพิมพ์: ใช้เมนูพิมพ์ของเบราว์เซอร์ (Ctrl+P) และเลือก Save as PDF</p><header><p class="muted">LIS · METHOD VALIDATION REPORT · ฉบับร่าง</p><h1>${e(input.title)}</h1><p>${e(input.analyte)} · ${e(input.method)}</p><p class="notice">${e(status)}</p></header>
  ${table(["ข้อมูลรายงาน", "รายละเอียด"], [["วันที่สร้าง", new Date().toISOString()], ["วิธี / SOP และเวอร์ชัน", input.protocol], ["Calibration ID ของข้อมูลในหน้านี้", input.calibration], ["ผู้จัดทำ", input.analyst], ["ผู้ทบทวน (ยังไม่ใช่ลายเซ็นอนุมัติ)", input.reviewer]])}
  <h2>6. การเตรียมสารและความเข้มข้น</h2>
  ${table(["น้ำหนักมาตรฐาน (mg)", "Purity (%)", "ปริมาตร Stock (mL)", "C stock (mg/mL)"], [[input.prep[0], input.prep[1], input.prep[2], fmt(stock)]])}
  <p>C stock = W × Purity/100 ÷ V; C actual = C stock × ปริมาตรที่ปิเปตจริง ÷ ปริมาตรสุดท้าย เก็บทศนิยมเต็มในการคำนวณ ปัดเศษเฉพาะการแสดงผล</p>
  ${table(["ใช้สำหรับ", "Target mg/mL", "ปิเปต µL", "ปริมาตรสุดท้าย µL", "Matrix µL", "Actual mg/mL", "Diluent µL"], input.levels.map(row => { const d = stock == null ? null : dilution({stockMgMl:stock,target:Number(row.target),unit:"mg/mL",finalUl:Number(row.finalVolume),actualAliquotUl:Number(row.aliquot),matrixUl:Number(row.matrix)}); return [row.purpose,row.target,row.aliquot,row.finalVolume,row.matrix,fmt(d?.actual),fmt(d?.diluentUl)]; }))}
  <h2>7. เกณฑ์และผลตรวจสอบ</h2>${table(["รายการ", "ผลคำนวณ", "เกณฑ์", "สถานะ"], input.checks.map(c => [c.name,c.value,c.criteria,c.pass == null ? "รอตรวจสอบ" : c.pass ? "Passed" : "Failed"]))}
  <h2>1. Specificity</h2><p>Blank Area ที่ระบุ: ${e(input.blank || "ยังไม่ระบุ")} · ต้องตรวจ Chromatogram และ Matrix Blank ประกอบ</p>
  ${table(["Injection", "RT (min)", "ผลรวม Area"], (parsed[0]?.rows ?? []).map((r,i)=>[i+1,...r]))}
  <h2>2. Linearity</h2><p>Area = ${fmt(fit?.slope)} × Concentration + (${fmt(fit?.intercept)}); R² = ${fmt(fit?.r2)} · OLS จากทุก Injection โดยไม่บังคับผ่านจุดศูนย์</p>
  ${table(["Actual mg/mL", "n", "Mean Area", "Sample SD", "%RSD"], groupedLinearity)}
  ${fit ? `<div class="two">${scatter(fit.points.map(p=>({x:p.concentration,y:p.area})),"Calibration Curve","Concentration (mg/mL)","Area",fit)}${scatter(fit.points.map(p=>({x:p.concentration,y:p.residual})),"Residual Plot","Concentration (mg/mL)","Residual (Area)")}</div>` : ""}
  ${table(["Injection", "Actual mg/mL", "Area", "Predicted Area", "Residual", "Back-calculated mg/mL"], (fit?.points ?? []).map((p,i)=>[i+1,p.concentration,p.area,fmt(p.predicted),fmt(p.residual),fmt((p.area-fit!.intercept)/fit!.slope)]))}
  <h2>3. Accuracy &amp; Precision</h2><p>Recovery = Found / Actual fortified × 100; Bias = (Found − Actual fortified) / Actual fortified × 100 สำหรับ Matrix Blank ที่ไม่มีสารเป้าหมาย; Sample SD ใช้ n−1</p>
  ${table(["ตัวอย่าง", "Target mg/mL", "Actual fortified mg/mL", "Found mg/mL", "Recovery %", "Bias %"], accuracyRows)}
  <h3>Repeatability และฐาน Horwitz</h3>${table(["ระดับ mg/mL", "C (g/g)", "Horwitz RSDR", "RSD อ้างอิง Repeatability", "RSD ที่วัดได้", "HorRat(r)"], input.precision.summaries.map(s=>[s.level,fmt(s.c),fmt(s.predictedR),fmt(s.predictedRepeatability),fmt(s.repeatability?.rsd),fmt(s.ratio)]))}
  <h3>Intermediate Precision · balanced one-way ANOVA ของ Recovery</h3>${table(["ระดับ", "จำนวนวัน", "Mean Recovery", "SD ภายในวัน", "SD ระหว่างวัน", "SD รวม", "RSD รวม", "HorRat(IP)"],input.precision.summaries.map(s=>[s.level,s.days.length,fmt(s.anova?.mean),fmt(s.anova?.withinSd),fmt(s.anova?.betweenSd),fmt(s.anova?.sd),fmt(s.anova?.rsd),fmt(s.intermediateRatio)]))}
  <p>SD รวม = √(MSwithin + max(0, (MSbetween − MSwithin)/n)) ใช้จำนวนซ้ำเท่ากันทุกวัน ค่าเฉลี่ยรายวันอย่างเดียวไม่เพียงพอสำหรับคำนวณนี้</p>
  ${table(["Day", "Target mg/mL", "Actual fortified mg/mL", "Found mg/mL"],input.precision.rawDaily)}
  ${input.includeQc ? `<h2>11. ผลตัวอย่างและ QC</h2>${table(["Sample", "Weight mg", "Found mg/mL", "V mL", "DF", "Density g/mL", "%w/w", "%w/v"],input.qc.sampleResults.map(s=>[s.sample,s.weight,s.concentration,s.volume,s.df,s.density,fmt(s.ww),fmt(s.wv)]))}${table(["ชุด QC", "Recovery 1 (%)", "Recovery 2 (%)"],[["Standard Check",...input.qc.standardRecoveries.map(fmt)],["Matrix Spike",...input.qc.spikeRecoveries.map(fmt)]])}<p>%w/w = Found × V × DF × 100 / W; %w/v = %w/w × Density; Spike Recovery = (Found − Unspiked) / Added × 100; %Difference = |R1 − R2| / Mean(R1,R2) × 100</p>` : ""}
  <h2>4. Overall Summary</h2><p>${e(status)} · ผ่าน ${input.checks.filter(c=>c.pass===true).length} / ${input.checks.length} รายการ</p><p>${e(input.notes || "ยังไม่มีข้อสังเกตเพิ่มเติม")}</p>
  ${input.errors.length ? `<h3 class="errors">รายการที่ต้องแก้ไข</h3><ul class="errors">${input.errors.map(error=>`<li>${e(error)}</li>`).join("")}</ul>` : ""}
  <p class="notice">รายงานนี้แสดงผลคำนวณและเกณฑ์ของงานที่กรอก ไม่ใช่การอนุมัติวิธีวิเคราะห์อัตโนมัติ เกณฑ์และความเหมาะสมสำหรับสาร/เมทริกซ์ต้องอ้างอิง SOP ที่ระบุ หากมีแถวผิดรูปแบบ ให้ตรวจข้อมูลดิบด้านล่างก่อนใช้ผล</p>
  <h2>ภาคผนวก · ข้อมูลที่นำเข้า</h2>${input.texts.map((text,i)=>`<h3>${["Specificity","Linearity","Accuracy"][i]}</h3><pre>${e(text || "ยังไม่มีข้อมูล")}</pre>`).join("")}
  <h3>แหล่งอ้างอิงสูตร</h3><p><a href="https://www.cipac.org/images/pdf/validat.pdf">CIPAC 3807 · Horwitz / mass fraction</a><br><a href="https://eurachem.org/images/stories/Guides/pdf/MV_Guide_planning_supplement_2nd_ed_EN.pdf">Eurachem · Planning and Reporting Method Validation Studies (2025)</a></p>
  </main></body></html>`;
}
