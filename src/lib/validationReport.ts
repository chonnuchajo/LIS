import type { ValidationCheck, evaluatePrecision, evaluateQc } from "./validationAdvanced";
import { formatValidationNumber as fmt } from "./validationAdvanced";
import type { PreparationLevel, ValidationStock, LinearitySettings } from "./validationPreparation";
import { preparationResult, targetConcentration, stockConcentration, defaultLinearitySettings, checkLinearityPreparation } from "./validationPreparation";
import { parseMeasurements, regression, stats } from "./validationCalculator";
import { defaultSpecificitySettings, evaluateSpecificity, type SpecificitySettings } from "./validationSpecificity";
import { evaluateLinkedMeasurements, measurementLabels, type LinkedMeasurements } from "./validationMeasurements";
import { defaultProtocolDetails, evaluateProtocolDetails, hasProtocolDetails, type ProtocolDetails } from "./validationProtocol";

export type ValidationReportInput = {
  title: string; analyte: string; method: string; analyst: string; reviewer: string;
  protocol: string; calibration: string; notes: string;
  prep: string[]; levels: PreparationLevel[]; texts: string[]; blank: string;
  checks: ValidationCheck[]; errors: string[];
  precision: ReturnType<typeof evaluatePrecision>;
  qc: ReturnType<typeof evaluateQc>; includeQc: boolean;
  specificity?: SpecificitySettings;
  stocks?: ValidationStock[]; linearity?: LinearitySettings;
  linkedMeasurements?: LinkedMeasurements;
  protocolDetails?: ProtocolDetails;
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
  const details = input.protocolDetails ?? defaultProtocolDetails();
  const protocolResult = evaluateProtocolDetails(details);
  const reportChecks = [protocolResult.check, ...input.checks.filter(check => check.name !== protocolResult.check.name)];
  const detail = (key: keyof ProtocolDetails) => e(details[key] || "ยังไม่ระบุ");
  const parsed = input.texts.map((text, i) => parseMeasurements(text, i === 2 ? 3 : 2));
  const specificity = input.specificity ?? defaultSpecificitySettings();
  const stocks = input.stocks ?? [];
  const linearity = input.linearity ?? defaultLinearitySettings();
  const specificityResult = evaluateSpecificity(specificity, { standardData: input.texts[0], analyte: input.analyte, method: input.method, protocol: input.protocol, calibration: input.calibration, reviewer: input.reviewer, preparation: JSON.stringify({ prep: input.prep, preparationLevels: input.levels, ...(stocks.length ? { stocks } : {}), ...(hasProtocolDetails(details) ? { protocolDetails: details } : {}) }) });
  const fit = parsed[1]?.errors.length ? null : regression(parsed[1]?.rows ?? []);
  const [weight, purity, volume] = input.prep.map(Number);
  const stock = stockConcentration(weight, purity, volume);
  const linkedResult = input.linkedMeasurements ? evaluateLinkedMeasurements(input.linkedMeasurements, stock, stocks, Number(linearity.r2Min)) : null;
  const linkedRows = linkedResult?.results.filter(result => input.linkedMeasurements!.enabled.includes(result.row.kind)) ?? [];
  const linkedSources = linkedResult?.sources.filter(source => linkedRows.some(result => result.row.calibrationId === source.calibration.id)) ?? [];
  const status = input.errors.length || reportChecks.some(c => c.pass === false) ? "พบข้อผิดพลาด / ต้องทบทวน" : reportChecks.every(c => c.pass === true) && reportChecks.length ? "ผ่านเงื่อนไขที่คำนวณ — รออนุมัติรายงาน" : "ข้อมูลหรือการทบทวนยังไม่ครบ";
  const accuracyRows = (parsed[2]?.rows ?? []).map(([level, expected, found], i) => [i + 1, level, expected, found, expected > 0 ? fmt(found / expected * 100) : "คำนวณไม่ได้", expected > 0 ? fmt((found - expected) / expected * 100) : "คำนวณไม่ได้"]);
  const accuracySummary = input.levels.filter(level => level.purpose === "accuracy").map(level => {
    const target = targetConcentration(level);
    const rows = parsed[2].rows.filter(row => row[0] === target);
    const found = stats(rows.map(row => row[2]));
    const recovery = rows.every(row => row[1] > 0) ? stats(rows.map(row => row[2] / row[1] * 100)) : null;
    return [target, rows.length, fmt(found?.mean), fmt(found?.sd), fmt(found?.rsd), fmt(recovery?.mean), fmt(recovery?.sd), `${level.recoveryLow}–${level.recoveryHigh}%`];
  });
  const linearPreparation = checkLinearityPreparation(parsed[1]?.rows ?? [], input.levels, stock, stocks, linearity);
  const groupedLinearity = linearPreparation.prepared.map(({ level, actual }, index) => {
    const data = linearPreparation.groups[index].map(row => row[1]);
    const result = stats(data);
    return [fmt(targetConcentration(level)), fmt(actual), data.length, fmt(result?.mean), fmt(result?.sd), fmt(result?.rsd)];
  });
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><title>${e(input.title)}</title><style>
  *{box-sizing:border-box}body{font:14px/1.65 Tahoma,Arial,sans-serif;color:#172033;margin:0;background:#eef2f6}main{max-width:1000px;margin:32px auto;padding:40px;background:white}h1{font-size:25px;margin:0}h2{font-size:19px;border-bottom:2px solid #2563eb;padding-bottom:8px;margin-top:30px}h3{font-size:15px}p{white-space:pre-wrap}table{width:100%;border-collapse:collapse;margin:12px 0 20px;font-size:12px;table-layout:auto}th,td{border:1px solid #cbd5e1;padding:7px;vertical-align:top;overflow-wrap:anywhere}th{background:#eff4fa;text-align:left}tr{break-inside:avoid}thead{display:table-header-group}.muted{color:#64748b}.notice{padding:14px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc}.errors{color:#991b1b}figure{margin:12px 0;break-inside:avoid}figcaption{font-weight:bold}svg{width:100%;max-height:360px}.two{display:grid;grid-template-columns:1fr 1fr;gap:16px}pre{white-space:pre-wrap;overflow-wrap:anywhere;border:1px solid #cbd5e1;padding:12px;font-size:11px}@page{size:A4;margin:15mm}@media print{body{background:white}main{margin:0;padding:0;max-width:none}.screen{display:none}h2,h3{break-after:avoid}a{color:inherit;text-decoration:none}}@media(max-width:640px){main{margin:0;padding:16px}.two{display:block}table{font-size:10px}}
  </style></head><body><main><p class="screen notice">รายงาน HTML พร้อมพิมพ์: ใช้เมนูพิมพ์ของเบราว์เซอร์ (Ctrl+P) และเลือก Save as PDF</p><header><p class="muted">LIS · METHOD VALIDATION REPORT · ฉบับร่าง</p><h1>${e(input.title)}</h1><p>${e(input.analyte)} · ${e(input.method)}</p><p class="notice">${e(status)}</p></header>
  ${table(["ข้อมูลรายงาน", "รายละเอียด"], [["วันที่สร้าง", new Date().toISOString()], ["วิธี / SOP และเวอร์ชัน", input.protocol], ["Calibration ID ของ Linearity / ข้อมูลกรอกตรง", input.calibration], ["ผู้จัดทำ", input.analyst], ["ผู้ทบทวน (ยังไม่ใช่ลายเซ็นอนุมัติ)", input.reviewer]])}
  <h2>1. วัตถุประสงค์</h2><p>${detail("purpose")}</p>
  <h2>2. ขอบเขตและเมทริกซ์</h2><p>${detail("scope")}</p>
  <h2>3. เอกสารอ้างอิงของวิธี</h2><p>${detail("references")}</p>
  <h2>4. เครื่องมือ วัสดุ และสารเคมี</h2><h3>4.1 เครื่องมือและอุปกรณ์</h3><p>${detail("instruments")}</p><h3>4.2 วัสดุสิ้นเปลือง</h3><p>${detail("materials")}</p><h3>4.3 สารเคมีและสารมาตรฐาน</h3><p>${detail("reagents")}</p>
  <h2>5. สรุปวิธีวิเคราะห์</h2><h3>5.1 หลักการวิเคราะห์</h3><p>${detail("principle")}</p><h3>5.2 สภาวะการวิเคราะห์</h3><p>${detail("conditions")}</p><h3>5.3 ความเหมาะสมของระบบ</h3><p>${detail("systemSuitability")}</p>
  <h2>6. การเตรียมสารและความเข้มข้น</h2><h3>6.1 การเตรียม Solvent</h3><p>${detail("solvent")}</p><h3>6.2 Reference Standard Stock</h3>
  ${table(["น้ำหนักมาตรฐาน (mg)", "Purity (%)", "ปริมาตร Stock (mL)", "C stock (mg/mL)"], [[input.prep[0], input.prep[1], input.prep[2], fmt(stock)]])}
  ${stocks.length ? table(["Stock เพิ่มเติม", "รหัส", "น้ำหนัก mg", "Purity %", "V mL", "C stock mg/mL", "Certificate / Lot", "วันที่เตรียม / ผู้เตรียม"], stocks.map(source => [source.name, source.id, source.weight, source.purity, source.volume, fmt(stockConcentration(Number(source.weight), Number(source.purity), Number(source.volume))), source.certificate, source.preparedOn])) : ""}
  <p>C stock = W × Purity/100 ÷ V; C actual = C stock × ปริมาตรที่ปิเปตจริง ÷ ปริมาตรสุดท้าย เก็บทศนิยมเต็มในการคำนวณ ปัดเศษเฉพาะการแสดงผล</p>
  ${table(["ใช้สำหรับ", "Stock", "Target ตามหน่วยที่กรอก", "ปิเปต µL", "ปริมาตรสุดท้าย µL", "Matrix µL", "Actual mg/mL", "Diluent µL"], input.levels.map(row => { const d = preparationResult(row, stock, stocks); return [row.purpose, row.stockId ? stocks.find(source => source.id === row.stockId)?.name || row.stockId : "Stock หลัก",`${row.target} ${row.targetUnit ?? "mg/mL"}`,row.aliquot,row.finalVolume,row.matrix,fmt(d?.actual),fmt(d?.diluentUl)]; }))}
  <h3>6.3 การเตรียม Matrix Blank</h3><p>${detail("matrixBlank")}</p><h3>6.4–6.5 รายละเอียดการเตรียมแต่ละระดับ</h3><p>${detail("preparationNotes")}</p><h3>6.6 แผนการทดสอบต่างวัน</h3><p>${detail("intermediateDesign")}</p><h3>6.7 การเตรียมตัวอย่างและ QC</h3><p>${detail("sampleProcedure")}</p>
  <h2>7. แผนการตรวจสอบและเกณฑ์ยอมรับ</h2><p>${detail("sequence")}</p>${table(["รายการ", "เกณฑ์ยอมรับ"], reportChecks.map(c => [c.name,c.criteria]))}
  <h2>8. ผลการทดสอบ</h2><h3>8.1 Specificity</h3><p>Standard อย่างน้อย ${e(specificity.minStandards)} ครั้ง; RT %CV ≤ ${e(specificity.rtLimit)}%; Area %RSD ≤ ${e(specificity.areaLimit)}%; Blank แต่ละชนิดอย่างน้อย ${e(specificity.minBlanks)} ครั้ง โดย Area สูงสุด / Mean Standard Area × 100 ≤ ${e(specificity.blankLimit)}%</p>
  ${specificity.peakMode ? `<p>โหมดรายพีค: RT %CV ประเมินแต่ละพีค; Area %RSD ใช้ผลรวมต่อ Injection; Blank รายพีคใช้ฐาน ${e(specificity.peakBlankBasis === "individual" ? "Mean Standard Area ของพีคนั้น" : "Mean ผลรวม Standard Area")} และผลรวม Blank ใช้ Mean ผลรวม Standard Area</p>
  ${table(["พีค", "Mean RT", "RT SD", "RT %CV", "Mean Area", "Area SD", "Area %RSD"], specificityResult.peaks.map(peak => [peak.name, fmt(peak.rt?.mean), fmt(peak.rt?.sd), fmt(peak.rt?.rsd), fmt(peak.area?.mean), fmt(peak.area?.sd), fmt(peak.area?.rsd)]))}
  ${table(["Injection", "ผลรวม Area ของทุกพีค"], specificityResult.standardRows.map((row, index) => [index + 1, row.reduce((sum, value, column) => column % 2 === 1 ? sum + value : sum, 0)]))}
  ${specificityResult.peaks.map((peak, index) => `<h3>${e(peak.name)}</h3>${table(["Standard Injection", "RT (min)", "Area"], specificityResult.standardRows.map((row, injection) => [injection + 1, row[index * 2], row[index * 2 + 1]]))}${table(["Blank ครั้ง", "Solvent Area", "Matrix Area"], specificityResult.blankRows.map((row, injection) => [injection + 1, row[index * 2], row[index * 2 + 1]]))}`).join("")}`
  : `${table(["Injection", "RT (min)", "ผลรวม Area"], specificityResult.standardRows.map((row,i)=>[i+1,...row]))}${table(["ครั้ง", "Solvent Blank Area", "Matrix Blank Area"], specificityResult.blankRows.map((row, i) => [i + 1, ...row]))}`}
  ${table(["ผลตรวจ Specificity", "ค่า", "เกณฑ์", "สถานะ"], specificityResult.checks.map(c => [c.name, c.value, c.criteria, c.pass == null ? "รอตรวจสอบ" : c.pass ? "Passed" : "Failed"]))}
  ${table(["หลักฐานอ้างอิง", "เอกสาร / หน้า / Injection ID"], [["Standard Chromatogram", specificity.standardReference], ["Solvent Blank", specificity.solventReference], ["Matrix Blank", specificity.matrixReference]])}
  <p>บันทึกทบทวน: ${e(specificity.reviewNotes || "ยังไม่ระบุ")}</p><p>ผลทบทวนปัจจุบัน: ${specificityResult.current ? e(specificity.decision === "passed" ? "ผ่าน" : "ไม่ผ่าน") : "ยังไม่ครบ / ต้องทบทวนใหม่"} · ผู้ทบทวน ${e(input.reviewer || "ยังไม่ระบุ")} · เวลาบันทึกล่าสุด ${e(specificity.reviewedAt || "ยังไม่บันทึก")} (ไม่ใช่ลายเซ็นอนุมัติ)</p>
  ${input.blank ? `<p>ข้อมูลเดิม: Blank Area สูงสุด ${e(input.blank)} เก็บเพื่ออ้างอิง ไม่ใช้ตัดสินแทนข้อมูล Blank รายครั้ง</p>` : ""}
  ${linkedRows.length ? `<h3>Calibration และการเตรียมรายตัวอย่าง</h3>
  <p>Found = (Area − Intercept) / Slope; Actual/Added = C stock × ปิเปตจริง / ปริมาตรสุดท้าย ทุกความเข้มข้นเป็น mg/mL ผลนอกช่วง Calibration หรือข้อมูลไม่ครบจะไม่ถูกส่งไปตัดสินผลของหัวข้อนั้น</p>
  ${table(["Calibration ID", "แหล่งสมการ", "Slope", "Intercept", "R²", "ช่วงต่ำ–สูง mg/mL", "หลักฐาน"], linkedSources.map(({ calibration, fit }) => [calibration.name, calibration.mode === "points" ? "OLS จากข้อมูลดิบ" : "สมการจากเครื่อง", fmt(fit?.slope), fmt(fit?.intercept), fmt(fit?.r2), `${fmt(fit?.min)}–${fmt(fit?.max)}`, calibration.reference]))}
  ${table(["หัวข้อ", "ตัวอย่าง/การเตรียม", "วัน", "Calibration", "Area", "Found mg/mL", "Actual/Added mg/mL", "ข้อผิดพลาด"], linkedRows.map(result => [measurementLabels[result.row.kind], result.row.sampleId, result.row.kind === "daily" ? result.row.day : "—", result.calibrationName, result.row.area, fmt(result.found), fmt(result.actual), result.errors.join("; ")]))}
  ${table(["ตัวอย่าง/การเตรียม", "Target mg/mL", "Stock", "ปิเปต µL", "ปริมาตรสุดท้าย µL", "Matrix µL", "Unspiked mg/mL"], linkedRows.filter(result => result.row.kind !== "sample").map(({ row }) => [row.sampleId, row.target, row.stockId ? stocks.find(source => source.id === row.stockId)?.name || row.stockId : "Stock หลัก", row.aliquot, row.finalVolume, row.matrix, row.kind === "spike" ? row.unspiked : "—"]))}
  ${linkedSources.filter(source => source.calibration.mode === "points").map(({ calibration }) => `<h3>ข้อมูลดิบ Calibration ${e(calibration.name)}</h3><pre>${e(calibration.points)}</pre>`).join("")}` : ""}
  <h3>8.2 Linearity &amp; Range</h3><p>Area = ${fmt(fit?.slope)} × Concentration + (${fmt(fit?.intercept)}); R² = ${fmt(fit?.r2)} · OLS จากทุก Injection โดยไม่บังคับผ่านจุดศูนย์</p>
  <p>เกณฑ์ R² ≥ ${e(linearity.r2Min)}; Area %RSD ≤ ${e(linearity.areaRsdMax)}%; จำนวนซ้ำ ≥ ${e(linearity.minReplicates)} ต่อระดับ; Actual คลาดเคลื่อนจากแผนไม่เกิน ${e(linearity.concentrationTolerance)} mg/mL</p>
  ${table(["Target mg/mL", "Actual ตามแผน mg/mL", "n", "Mean Area", "Sample SD", "%RSD"], groupedLinearity)}
  ${fit ? `<div class="two">${scatter(fit.points.map(p=>({x:p.concentration,y:p.area})),"Calibration Curve","Concentration (mg/mL)","Area",fit)}${scatter(fit.points.map(p=>({x:p.concentration,y:p.residual})),"Residual Plot","Concentration (mg/mL)","Residual (Area)")}</div>` : ""}
  ${table(["Injection", "Actual mg/mL", "Area", "Predicted Area", "Residual", "Back-calculated mg/mL"], (fit?.points ?? []).map((p,i)=>[i+1,p.concentration,p.area,fmt(p.predicted),fmt(p.residual),fmt((p.area-fit!.intercept)/fit!.slope)]))}
  <h3>8.3 Accuracy</h3><p>Recovery = Found / Actual fortified × 100; Bias = (Found − Actual fortified) / Actual fortified × 100 สำหรับ Matrix Blank ที่ไม่มีสารเป้าหมาย; Sample SD ใช้ n−1</p>
  ${table(["ตัวอย่าง", "Target mg/mL", "Actual fortified mg/mL", "Found mg/mL", "Recovery %", "Bias %"], accuracyRows)}
  ${table(["Target mg/mL", "n", "Mean Found mg/mL", "SD Found mg/mL", "RSD Found %", "Mean Recovery %", "SD Recovery", "เกณฑ์ Recovery รายตัวอย่าง"], accuracySummary)}
  <h3>8.4 Precision · Repeatability และฐาน Horwitz</h3><p>RSD/HorRat ของ Precision ใช้ Recovery รายตัวอย่าง เพื่อรองรับ Actual ที่ต่างกันแต่ละชุดเตรียม; RSD Found ในตาราง Accuracy เป็นสถิติเชิงพรรณนาของค่าความเข้มข้น Factor ของ Repeatability = ${e(input.precision.source.repeatabilityFactor)} × Horwitz RSDR</p>${table(["ระดับ mg/mL", "C (g/g)", "Horwitz RSDR", "RSD อ้างอิง Repeatability", "RSD ที่วัดได้", "HorRat(r)"], input.precision.summaries.map(s=>[s.level,fmt(s.c),fmt(s.predictedR),fmt(s.predictedRepeatability),fmt(s.repeatability?.rsd),fmt(s.ratio)]))}
  <h3>Intermediate Precision · balanced one-way ANOVA ของ Recovery</h3>${table(["ระดับ", "จำนวนวัน", "Mean Recovery", "SD ภายในวัน", "SD ระหว่างวัน", "SD รวม", "RSD รวม", "HorRat(IP)"],input.precision.summaries.map(s=>[s.level,s.days.length,fmt(s.anova?.mean),fmt(s.anova?.withinSd),fmt(s.anova?.betweenSd),fmt(s.anova?.sd),fmt(s.anova?.rsd),fmt(s.intermediateRatio)]))}
  <p>SD รวม = √(MSwithin + max(0, (MSbetween − MSwithin)/n)) ใช้จำนวนซ้ำเท่ากันทุกวัน ค่าเฉลี่ยรายวันอย่างเดียวไม่เพียงพอสำหรับคำนวณนี้</p>
  ${table(["Day", "Target mg/mL", "Actual fortified mg/mL", "Found mg/mL"],input.precision.rawDaily)}

  <h2>9. Overall Summary · ผลการตรวจสอบและสถานะ</h2>${table(["รายการ", "ผลคำนวณ", "เกณฑ์", "สถานะ"], reportChecks.map(c => [c.name,c.value,c.criteria,c.pass == null ? "รอตรวจสอบ" : c.pass ? "Passed" : "Failed"]))}<p>ข้อเบี่ยงเบนและข้อจำกัด: ${detail("deviations")}</p><p>${e(status)} · ผ่าน ${reportChecks.filter(c=>c.pass===true).length} / ${reportChecks.length} รายการ</p><p>${e(input.notes || "ยังไม่มีข้อสังเกตเพิ่มเติม")}</p>
  ${input.errors.length ? `<h3 class="errors">รายการที่ต้องแก้ไข</h3><ul class="errors">${input.errors.map(error=>`<li>${e(error)}</li>`).join("")}</ul>` : ""}
  <p class="notice">รายงานนี้แสดงผลคำนวณและเกณฑ์ของงานที่กรอก ไม่ใช่การอนุมัติวิธีวิเคราะห์อัตโนมัติ เกณฑ์และความเหมาะสมสำหรับสาร/เมทริกซ์ต้องอ้างอิง SOP ที่ระบุ หากมีแถวผิดรูปแบบ ให้ตรวจข้อมูลดิบด้านล่างก่อนใช้ผล</p>
  <h2>10. บทสรุปของผู้ทบทวน</h2><p>${detail("conclusion")}</p><p class="muted">ข้อความสรุปที่ผู้ใช้ระบุ ไม่ใช่ลายเซ็นอนุมัติ รายงานยังเป็นฉบับร่าง</p>
  ${input.includeQc ? `<h2>11. ผลตัวอย่างและ QC</h2>${table(["Sample", "Weight mg", "Found mg/mL", "V mL", "DF", "Density g/mL", "%w/w", "%w/v"],input.qc.sampleResults.map(s=>[s.sample,s.weight,s.concentration,s.volume,s.df,s.density,fmt(s.ww),fmt(s.wv)]))}${table(["Standard QC", "Found mg/mL", "Actual mg/mL", "Recovery %"],input.qc.standardRows.map((row,i)=>[i+1,...row,fmt(input.qc.standardRecoveries[i])]))}${table(["Matrix Spike", "Found mg/mL", "Unspiked mg/mL", "Added mg/mL", "Recovery %"],input.qc.spikeRows.map((row,i)=>[i+1,...row,fmt(input.qc.spikeRecoveries[i])]))}<p>%w/w = Found × V × DF × 100 / W; %w/v = %w/w × Density; Spike Recovery = (Found − Unspiked) / Added × 100; %Difference = |R1 − R2| / Mean(R1,R2) × 100</p>` : ""}
  <h2>ภาคผนวก · ข้อมูลที่นำเข้า</h2>${input.texts.map((text,i)=>i === 0 && specificity.peakMode ? "" : `<h3>${["Specificity","Linearity","Accuracy"][i]}</h3><pre>${e(text || "ยังไม่มีข้อมูล")}</pre>`).join("")}
  ${specificity.peakMode ? `<h3>Specificity · Standard รายพีค</h3><p>${e(specificity.peakNames.flatMap(name => [`${name} RT`, `${name} Area`]).join(", "))}</p><pre>${e(specificity.peakStandardData || "ยังไม่มีข้อมูล")}</pre><h3>Specificity · Blank รายพีค</h3><p>${e(specificity.peakNames.flatMap(name => [`${name} Solvent Area`, `${name} Matrix Area`]).join(", "))}</p><pre>${e(specificity.peakBlankData || "ยังไม่มีข้อมูล")}</pre>` : `<h3>Specificity · Solvent Blank, Matrix Blank</h3><pre>${e(specificity.blankData || "ยังไม่มีข้อมูล")}</pre>`}
  ${input.includeQc ? Object.entries(input.qc.rawInputs).map(([name,text])=>`<h3>QC · ${e(name)} · ข้อมูลต้นทาง</h3><pre>${e(text || "ยังไม่มีข้อมูล")}</pre>`).join("") : ""}
  <h3>Precision · ข้อมูลรายวันต้นทาง</h3><pre>${e(input.precision.source.dailyData || "ยังไม่มีข้อมูล")}</pre><h3>Precision · ฐาน C (Target mg/mL, mass fraction g/g)</h3><pre>${e(input.precision.source.massFractions || "ยังไม่มีข้อมูล")}</pre>
  <h3>แหล่งอ้างอิงสูตร</h3><p><a href="https://www.cipac.org/images/pdf/validat.pdf">CIPAC 3807 · Horwitz / mass fraction</a><br><a href="https://eurachem.org/images/stories/Guides/pdf/MV_Guide_planning_supplement_2nd_ed_EN.pdf">Eurachem · Planning and Reporting Method Validation Studies (2025)</a></p>
  </main></body></html>`;
}
