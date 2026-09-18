import reference from "./templates/method-validation-reference.json";
import type { ValidationReportInput } from "./validationReport";
import { parseMeasurements, regression, stats } from "./validationCalculator";
import { preparationKind, preparationResult, stockConcentration, targetConcentration, checkLinearityPreparation, defaultLinearitySettings } from "./validationPreparation";
import { defaultSpecificitySettings, evaluateSpecificity } from "./validationSpecificity";
import { duplicateDifference, defaultQcSettings } from "./validationAdvanced";
import { referenceAccuracyTable } from "./validationReferenceTables";
import { defaultProtocolDetails, type ProtocolDetails } from "./validationProtocol";

export const sourceTemplate = reference;
const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const percentDifference = (a: number | null | undefined, b: number | null | undefined) => a == null || b == null ? null : duplicateDifference(a, b);
const display = (value: unknown, digits = 5) => typeof value === "number" ? Number.isFinite(value) ? String(Number(value.toFixed(digits))) : "—" : value == null || value === "" ? "—" : String(value);
const range = (values: (number | null | undefined)[]) => {
  const valid = values.filter((value): value is number => value != null && Number.isFinite(value));
  return valid.length ? [Math.min(...valid), Math.max(...valid)] : [null, null];
};
const table = (headers: string[], rows: unknown[][]) => `<table${rows.length <= 8 ? ' style="break-inside:avoid"' : ''}><thead><tr>${headers.map(h => `<th>${escape(h)}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map(row => `<tr>${row.map(v => `<td>${escape(display(v))}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}">ยังไม่มีผลวัด</td></tr>`}</tbody></table>`;

// PDF line endings describe the old page width, not paragraphs in the new report.
export function sourceTextHtml(text: string) {
  const blocks: { kind: string; text: string }[] = [];
  let paragraph = "";
  const flush = () => { if (paragraph) blocks.push({ kind: "p", text: paragraph }); paragraph = ""; };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    if (/^(?:[1-9]|1[01])\.\s+[A-Za-zก-๙]/.test(line) || /^(?:[1-9]|1[01])\.[1-9](?:\.[1-9])*\s+[A-Za-zก-๙]/.test(line) && !/^3\./.test(line)) {
      flush(); blocks.push({ kind: /^\d+\.\s/.test(line) ? "h2" : "h3", text: line });
    } else if (/^(?:- |3\.[1-9] |\d+(?:\.\d+)+\)|(?:จากผล|ดังนั้น|การประเมิน|นอกจากนี้|ผลการ))/u.test(line)) {
      flush(); paragraph = line;
    } else paragraph += (paragraph ? " " : "") + line;
  }
  flush();
  return blocks.map(({ kind, text: content }) => `<${kind} class="source-${kind}">${escape(content.replace(/([ก-ฮ]) +([่้๊๋]?)า/g, "$1$2ำ").replace(/ +/g, " "))}</${kind}>`).join("");
}

/** Populate the existing protocol completeness fields with the source, not invented prose. */
export function sourceProtocolDetails(analyte: string): ProtocolDetails {
  const body = reference.blocks.map(block => block.source).join("").split("Cypermethrin").join(analyte);
  const result = defaultProtocolDetails();
  const spans: Record<keyof ProtocolDetails, [string, string]> = {
    purpose: ["1. วัตถุประสงค์", "2. ขอบเขต"], scope: ["2. ขอบเขต", "3. เอกสารอ้างอิง"], references: ["3. เอกสารอ้างอิง", "4.  เครื่องมือ"],
    instruments: ["4.1 เครื่องมือ", "4.2 วัสดุ"], materials: ["4.2 วัสดุ", "4.3 สารเคมี"], reagents: ["4.3 สารเคมี", "5. สรุป"], principle: ["5.1 หลักการ", "5.2 สารละลาย"],
    conditions: ["5.3 สภาวะ", "5.4 ความเหมาะสม"], systemSuitability: ["5.4 ความเหมาะสม", "5.5 สารมาตรฐาน"], solvent: ["6.1 การเตรียม", "6.2 การเตรียม"],
    matrixBlank: ["6.3 การเตรียม", "6.4 ระดับ"], preparationNotes: ["6.4 ระดับ", "6.6 การเตรียม"], intermediateDesign: ["6.6 การเตรียม", "6.7 การเตรียม"],
    sampleProcedure: ["6.7 การเตรียม", "7. การตรวจสอบ"], sequence: ["7. การตรวจสอบ", "8. ผลการทดสอบ"], deviations: ["9. สรุป", "ตารางที่ 5"], conclusion: ["10. บทสรุป", "11. ผลการวิเคราะห์"],
  };
  for (const key of Object.keys(spans) as (keyof ProtocolDetails)[]) {
    const [start, end] = spans[key], a = body.indexOf(start), b = body.indexOf(end, a + 1);
    result[key] = a >= 0 && b > a ? body.slice(a, b).trim() : "ใช้ข้อความแม่แบบต้นฉบับในรายงาน";
  }
  return result;
}

export function sourceTemplateValues(input: ValidationReportInput) {
  const std = input.levels.filter(row => preparationKind(row) === "std").sort((a, b) => (targetConcentration(a) ?? Infinity) - (targetConcentration(b) ?? Infinity));
  const targets = std.map(targetConcentration);
  const summaries = [...input.precision.summaries].sort((a, b) => a.level - b.level);
  const accuracyLevels = input.accuracyLevels ?? input.levels.filter(row => row.purpose === "accuracy");
  const stock = stockConcentration(...input.prep.slice(0, 3).map(Number) as [number, number, number]);
  const specificity = input.specificity ?? defaultSpecificitySettings();
  const specificityResult = evaluateSpecificity(specificity, { standardData: input.texts[0], analyte: input.analyte, method: input.method, protocol: input.protocol, calibration: input.calibration, reviewer: input.reviewer, preparation: "" });
  const parsed = parseMeasurements(input.texts[1], 2);
  const fit = parsed.errors.length ? null : regression(parsed.rows);
  const linearity = input.linearity ?? defaultLinearitySettings();
  const linear = checkLinearityPreparation(parsed.rows, input.levels, stock, input.stocks ?? [], linearity);
  const areaRange = range(linear.groups.map(rows => stats(rows.map(row => row[1]))?.rsd));
  const recoveryRange = range(summaries.map(s => s.repeatability?.mean));
  const repeatRange = range(summaries.map(s => s.repeatability?.rsd));
  const intermediateRange = range(summaries.map(s => s.anova?.rsd));
  const standardRange = range(input.includeQc ? input.qc.standardRecoveries : []);
  const spikeRange = range(input.includeQc ? input.qc.spikeRecoveries : []);
  const samples = input.includeQc ? input.qc.sampleResults.map(s => s.ww) : [];
  const sampleStats = stats(samples);
  const sampleRange = range(samples);
  const qcSettings = input.qcSettings ?? defaultQcSettings();
  const values: Record<string, unknown> = {};
  const put = (ids: number[], numbers: unknown[]) => ids.forEach((id, i) => { values[`value_${String(id).padStart(3, "0")}`] = numbers[i]; });
  put([1,2,3,4,5,6,7,8,9], [targets[4],targets[4],specificityResult.rt?.mean,specificityResult.rt?.rsd,specificity.rtLimit,specificityResult.area?.mean,specificityResult.area?.sd,specificityResult.area?.rsd,specificity.areaLimit]);
  put([10,11,12,13,14,15,16,17,18,19,20,21], [...targets,fit?.r2,linearity.r2Min,...areaRange,linearity.areaRsdMax,targets[0],targets[4]]);
  const accuracyTargets = accuracyLevels.map(targetConcentration).sort((a, b) => (a ?? Infinity) - (b ?? Infinity));
  put([22,23,24], accuracyTargets); put([25,26,27], accuracyTargets);
  put([28,29,30], summaries.map(s => s.repeatability?.mean));
  put([31,32,33,34], [accuracyLevels[0]?.recoveryLow,accuracyLevels[0]?.recoveryHigh,accuracyLevels[2]?.recoveryLow,accuracyLevels[2]?.recoveryHigh]);
  put([35,36,37],summaries.map(s => s.repeatability?.rsd)); put([38,39,40], summaries.map(s => s.ratio));
  put([41], [input.precision.source.repeatabilityLimit]); put([42,43,44], accuracyTargets);
  put([45,46,47],summaries.map(s => s.repeatability?.rsd)); put([48,49,50],summaries.map(s => s.ratio));
  put([51], [input.precision.source.repeatabilityLimit]); put([52,53,54], summaries.map(s => s.level));
  put([55,56,57], summaries.map(s => s.anova?.mean)); put([58,59,60], summaries.map(s => s.anova?.rsd)); put([61,62,63], summaries.map(s => s.intermediateRatio));
  put([64,65,66,67,68,69,70,71,72,73,74,75,76,77], [input.precision.source.intermediateLimit,targets[0],targets[4],targets[0],targets[4],fit?.r2,...recoveryRange,...repeatRange,...intermediateRange,targets[0],targets[4]]);
  // QC preparation examples may use a different stock. Require explicit values rather than reusing the source's weighings.
  put([84,88,91], [input.includeQc ? input.qc.standardRows[0]?.[1] : null,input.includeQc ? input.qc.spikeRows[0]?.[1] : null,input.includeQc ? input.qc.spikeRows[0]?.[2] : null]);
  put([92,93,94,95,96,97,98,99,100,101,102], [...standardRange, input.includeQc ? percentDifference(input.qc.standardRecoveries[0],input.qc.standardRecoveries[1]) : null,...spikeRange,input.includeQc ? percentDifference(input.qc.spikeRecoveries[0],input.qc.spikeRecoveries[1]) : null,...sampleRange,sampleStats?.mean,sampleStats?.sd,sampleStats?.rsd]);
  for (const [key, variable] of Object.entries(reference.variables)) {
    if (Number(key.slice(6)) <= 102) continue;
    const byOriginal: Record<string, unknown> = { "100.48": standardRange[1], "100.06": standardRange[0], "100.27": stats(input.qc.standardRecoveries.filter((v): v is number => v != null))?.mean, "0.42": percentDifference(input.qc.standardRecoveries[0],input.qc.standardRecoveries[1]), "105.86": spikeRange[1], "103.78": spikeRange[0], "104.82": stats(input.qc.spikeRecoveries.filter((v): v is number => v != null))?.mean, "1.99": percentDifference(input.qc.spikeRecoveries[0],input.qc.spikeRecoveries[1]), "90.0": qcSettings.recoveryLow, "107.0": qcSettings.recoveryHigh, "5.0": qcSettings.differenceLimit };
    values[key] = input.includeQc ? byOriginal[variable.original] : null;
  }
  return { values, targets, std, stock, linear, specificityResult, fit };
}

export function renderSourceTemplate(input: ValidationReportInput, calculatedHtml: string) {
  const data = sourceTemplateValues(input);
  const overrides = input.sourceTemplateValues ?? {};
  const missing: string[] = [];
  const substitute = (text: string) => text.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => {
    if (key === "analyte") return input.analyte;
    const value = overrides[key]?.trim() || data.values[key];
    if (value == null || value === "") missing.push(key);
    return display(value);
  });
  const beforeResults = (text: string) => {
    // Preparation volumes are results too; never retain the example's pipetting
    // when the current stock or final volume differs.
    text = text.replace(/(6\.4 ระดับ[\s\S]*?)(?=6\.5 การ)/, section => {
      let index = 0;
      return section.replace(/(- [\d.]+ mg\/mL:[\s\S]*?stock standard solution )\d+ µL([\s\S]*?เติม Acetone )\d+ µL/g, (_, start, middle) => {
        const row = data.std[index++];
        const result = row && preparationResult(row, data.stock, input.stocks ?? []);
        return `${start}${result ? Number(row.useStockDirect ? row.finalVolume : row.actualAliquot ?? row.aliquot).toFixed(1) : "—"} µL${middle}${result?.diluentUl.toFixed(1) ?? "—"} µL`;
      });
    });
    text = text.replace(/(6\.5 การ[\s\S]*?)(?=6\.7 การ)/, section => {
      const matrix = input.levels.filter(row => preparationKind(row) === "matrix").sort((a,b) => (targetConcentration(a) ?? Infinity) - (targetConcentration(b) ?? Infinity));
      let index = 0;
      section = section.replace(/(- [\d.]+ mg\/mL:[\s\S]*?Matrix Blank )4 µL([\s\S]*?stock standard solution )\d+ µL([\s\S]*?เติม Acetone )\d+ µL/g, (_, start, middle, end) => {
        const row = matrix[index++];
        const result = row && preparationResult(row, data.stock, input.stocks ?? []);
        return `${start}${row?.matrix || "—"} µL${middle}${result ? Number(row.actualAliquot ?? row.aliquot).toFixed(1) : "—"} µL${end}${result?.diluentUl.toFixed(1) ?? "—"} µL`;
      });
      const first = matrix[0], config = first?.matrixCalculation;
      const final = Number(first?.finalVolume), matrixVolume = Number(first?.matrix);
      const density = Number(config?.density), percent = Number(config?.percent), highest = data.targets[4];
      const matrixMass = final > 0 && matrixVolume > 0 && density > 0 ? matrixVolume * density : null;
      const massPerMl = matrixMass == null ? null : matrixMass / (final / 1000);
      return section.replace(/25% EC/g, `${display(percent > 0 ? percent : null)}% EC`)
        .replace(/40 mg/g, `${display(highest != null && percent > 0 ? highest * 10 / (percent / 100) : null)} mg`)
        .replace(/4 mg\/mL/g, `${display(massPerMl)} mg/mL`).replace(/0\.4% w\/v/g, `${display(massPerMl == null ? null : massPerMl / 10)}% w/v`)
        .replace(/4 mg(?!\/)/g, `${display(matrixMass)} mg`).replace(/1 mg\/µL/g, `${display(density > 0 ? density : null)} mg/µL`)
        .replace(/Matrix Blank (จ านวน |เท่ากัน คือ )?4 µL/g, (_, prefix) => `Matrix Blank ${prefix ?? ""}${display(matrixVolume > 0 ? matrixVolume : null)} µL`)
        .replace(/1,000\s+µL/g, `${display(final > 0 ? final : null)} µL`);
    });
    const concentration: Record<string, unknown> = { "0.10": data.targets[0], "0.25": data.targets[1], "0.50": data.targets[2], "0.500": data.targets[2], "0.75": data.targets[3], "1.00": data.targets[4], "1.0": data.targets[4], "2.000": data.stock };
    return text.replace(/(?<![\d.])(0\.10|0\.25|0\.50|0\.500|0\.75|1\.00|1\.0|2\.000)(?![\d.])/g, value => display(concentration[value]));
  };
  const textHtml = sourceTextHtml;
  const tableSlot = (n: number) => {
    if (n === 1) return table(["ลำดับ","ตัวอย่าง","RT (min)","RT %CV","Mean Area","SD","Area %CV"], [[1,"Blank (diluent)","ดูผล Specificity","—","—","—","—"],[2,input.analyte,data.specificityResult.rt?.mean,data.specificityResult.rt?.rsd,data.specificityResult.area?.mean,data.specificityResult.area?.sd,data.specificityResult.area?.rsd]]);
    if (n === 2) return table(["Level","Actual (mg/mL)","Area 1","Area 2","Area 3","Mean Area","SD","%RSD"], data.linear.prepared.map((row,i) => { const areas=data.linear.groups[i].map(r=>r[1]); const s=stats(areas);return [i+1,row.actual?.toFixed(3),areas[0],areas[1],areas[2],s?.mean,s?.sd,s?.rsd]; })) + (calculatedHtml.match(/<figure>[\s\S]*?<\/figure>/g)?.slice(0,2).join("") ?? "");
    if (n === 3) return referenceAccuracyTable(input, parseMeasurements(input.texts[2],3).rows);
    if (n === 4) return referenceAccuracyTable(input, input.precision.rawDaily, true);
    if (n === 5) return table(["Validation Parameter","Acceptance Criteria","Results","Acceptance Status"], input.checks.map(check=>[check.name,check.criteria,check.value,check.pass == null ? "รอตรวจสอบ" : check.pass ? "Passed" : "Failed"]));
    if (!input.includeQc) return table(["ผลการวิเคราะห์"], [["ยังไม่มีผล QC ของงานนี้"]]);
    if (n === 6) return table(["Sample","Weight (mg)","Area","C found (mg/mL)",`${input.analyte} (%w/w)`],input.qc.sampleResults.map(s=>[s.sample,s.weight,"—",s.concentration,s.ww]));
    if (n === 7) return table(["QC Type","C found (mg/mL)","C fortified actual (mg/mL)","Recovery (%)"],input.qc.standardRows.map((r,i)=>[`Standard Check Solution-${i+1}`,...r,input.qc.standardRecoveries[i]]));
    return table(["QC Type","C found (mg/mL)","C sample actual (mg/mL)","C spike actual (mg/mL)","Spike Recovery (%)"],input.qc.spikeRows.map((r,i)=>[`Matrix Spike Solution-${i+1}`,...r,input.qc.spikeRecoveries[i]]));
  };
  const passed = input.checks.length > 0 && !input.errors.length && input.checks.every(c=>c.pass===true);
  const resultText = (text: string) => passed ? textHtml(text) : `<aside class="pending-source"><p class="pending-label">ข้อความแม่แบบผลและบทสรุป — รอผลครบและการทบทวน ยังไม่ใช่ข้อสรุปของงานนี้</p>${textHtml(text)}</aside>`;
  let resultSection = false;
  const body = reference.blocks.map(block => {
    if (block.type === "table") return `<h3>${escape(substitute(block.caption!))}</h3>${tableSlot(block.number!)}`;
    const template = block.template!;
    const split = template.indexOf("8. ผลการทดสอบ");
    if (split >= 0) {
      resultSection = true;
      return textHtml(substitute(beforeResults(template.slice(0,split)))) + resultText(substitute(template.slice(split)));
    }
    return resultSection ? resultText(substitute(template)) : textHtml(substitute(beforeResults(template)));
  }).join("");
  const contentsRows: string[] = [];
  for (const line of reference.contents.split(/\r?\n/).map(value => value.trim())) {
    if (/^\d+\./.test(line)) contentsRows.push(line);
    else if (line && contentsRows.length) contentsRows[contentsRows.length - 1] += ` ${line}`;
  }
  const contents = `<nav class="toc"><h2>สารบัญ</h2>${contentsRows.map(row => `<div style="margin:2px 0;line-height:1.3;${/^\d+\.\d/.test(row) ? 'padding-left:2em' : 'font-weight:bold'}">${escape(row.replace(/([ก-ฮ]) +([่้๊๋]?)า/g, "$1$2ำ").split("Cypermethrin").join(input.analyte))}</div>`).join("")}</nav>`;
  const footnote = missing.length ? `<p class="notice">ยังไม่มีค่าผลหรือรายละเอียดเตรียม QC ${new Set(missing).size} ช่อง โปรดกรอกผลที่เกี่ยวข้องก่อนใช้รายงานฉบับสมบูรณ์</p>` : "";
  return calculatedHtml.replace(/<nav class="toc">[\s\S]*(?=<\/main>)/, `${contents}${body}${footnote}`).replace("</style>", ".pending-source{border-left:2px solid #888;padding-left:12px}.pending-label{font-weight:bold;font-size:11px;white-space:normal}.source-p{white-space:normal;line-height:1.8;margin:0 0 9px;text-align:justify;text-indent:2em;orphans:3;widows:3;overflow-wrap:break-word}.source-h2,.source-h3{line-height:1.65;break-after:avoid}.source-h2{margin:22px 0 10px}.source-h3{margin:14px 0 6px}.toc{break-before:page}.toc .source-h2,.toc .source-h3{break-after:auto;font-size:12px;font-weight:normal;margin:4px 0}.toc .source-h3{padding-left:2em}.toc .source-p{text-indent:0}.document-header img{background:white;display:block}</style>");
}
