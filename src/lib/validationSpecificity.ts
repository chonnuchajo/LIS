import { parseMeasurements, stats } from "./validationCalculator";
import { formatValidationNumber as fmt, type ValidationCheck } from "./validationAdvanced";

export type SpecificitySettings = {
  blankData: string; minStandards: string; minBlanks: string;
  rtLimit: string; areaLimit: string; blankLimit: string;
  standardReference: string; solventReference: string; matrixReference: string;
  reviewNotes: string; decision: "pending" | "passed" | "failed";
  reviewedAt: string; reviewedSnapshot: string;
  peakMode: boolean; peakNames: string[]; peakStandardData: string; peakBlankData: string;
  peakBlankBasis: "individual" | "total";
};
export const defaultSpecificitySettings = (): SpecificitySettings => ({
  blankData: "", minStandards: "6", minBlanks: "3", rtLimit: "0.5", areaLimit: "2", blankLimit: "0.5",
  standardReference: "", solventReference: "", matrixReference: "", reviewNotes: "", decision: "pending",
  reviewedAt: "", reviewedSnapshot: "",
  peakMode: false, peakNames: ["Peak 1"], peakStandardData: "", peakBlankData: "", peakBlankBasis: "total",
});
export type SpecificityContext = {
  standardData: string; analyte: string; method: string; protocol: string;
  calibration: string; reviewer: string; preparation: string;
};

/** Exact source snapshot, not a signature or authenticated approval. */
export function specificitySnapshot(settings: SpecificitySettings, context: SpecificityContext) {
  const { reviewedAt: _date, reviewedSnapshot: _snapshot, peakMode, peakNames, peakStandardData, peakBlankData, peakBlankBasis, ...legacySources } = settings;
  // Preserve earlier single-peak reviews when opening a project created before peak mode.
  const sources = peakMode ? { ...legacySources, peakMode, peakNames, peakStandardData, peakBlankData, peakBlankBasis } : legacySources;
  let preparation: unknown = context.preparation;
  try { preparation = JSON.parse(context.preparation); } catch { /* Preserve a plain reference. */ }
  return JSON.stringify({ ...context, ...sources, preparation }, (_key, value) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
      : value);
}

export function evaluateSpecificity(settings: SpecificitySettings, context: SpecificityContext) {
  const names = settings.peakMode ? settings.peakNames : ["พีคที่รายงาน"];
  const columns = Math.max(1, names.length) * 2;
  const standard = parseMeasurements(settings.peakMode ? settings.peakStandardData : context.standardData, columns);
  const blanks = parseMeasurements(settings.peakMode ? settings.peakBlankData : settings.blankData, columns);
  const errors = [...standard.errors.map(e => `Specificity Standard · ${e}`), ...blanks.errors.map(e => `Specificity Blank · ${e}`)];
  if (!names.length || names.length > 20 || names.some(name => !name.trim()) || new Set(names.map(name => name.trim().toLowerCase())).size !== names.length) errors.push("Specificity: ระบุชื่อพีค 1–20 รายการให้ครบและไม่ซ้ำกัน");
  const minStandards = Number(settings.minStandards), minBlanks = Number(settings.minBlanks);
  const rtLimit = Number(settings.rtLimit), areaLimit = Number(settings.areaLimit), blankLimit = Number(settings.blankLimit);
  const validCriteria = Number.isInteger(minStandards) && minStandards >= 2 && Number.isInteger(minBlanks) && minBlanks >= 1 &&
    [settings.rtLimit, settings.areaLimit, settings.blankLimit].every(v => v.trim() !== "" && Number.isFinite(Number(v))) && rtLimit > 0 && areaLimit > 0 && blankLimit >= 0;
  if (!validCriteria) errors.push("Specificity: ตรวจเกณฑ์ RT/Area > 0, Blank ≥ 0 และจำนวนซ้ำ Standard ≥ 2, Blank ≥ 1 เป็นจำนวนเต็ม");
  if (standard.rows.some(row => row.some(value => value <= 0))) errors.push("Specificity: RT และ Standard Area ของทุกพีคต้องมากกว่า 0");
  const sumColumns = (row: number[], offset: number) => names.reduce((sum, _, index) => sum + row[index * 2 + offset], 0);
  const area = stats(standard.rows.map(row => sumColumns(row, 1)));
  const solventMax = blanks.rows.length ? Math.max(...blanks.rows.map(row => sumColumns(row, 0))) : null;
  const matrixMax = blanks.rows.length ? Math.max(...blanks.rows.map(row => sumColumns(row, 1))) : null;
  const solventInterference = solventMax != null && area?.mean > 0 ? solventMax / area.mean * 100 : null;
  const matrixInterference = matrixMax != null && area?.mean > 0 ? matrixMax / area.mean * 100 : null;
  const peaks = names.map((name, index) => {
    const rt = stats(standard.rows.map(row => row[index * 2]));
    const peakArea = stats(standard.rows.map(row => row[index * 2 + 1]));
    const solvent = blanks.rows.length ? Math.max(...blanks.rows.map(row => row[index * 2])) : null;
    const matrix = blanks.rows.length ? Math.max(...blanks.rows.map(row => row[index * 2 + 1])) : null;
    const denominator = settings.peakMode && settings.peakBlankBasis === "total" ? area?.mean : peakArea?.mean;
    return { name, rt, area: peakArea, solvent, matrix, solventInterference: solvent != null && denominator > 0 ? solvent / denominator * 100 : null, matrixInterference: matrix != null && denominator > 0 ? matrix / denominator * 100 : null };
  });
  const rt = peaks.length === 1 ? peaks[0].rt : null;
  if (standard.rows.length >= 2 && (!area || peaks.some(peak => !peak.rt || !peak.area))) errors.push("Specificity: ค่าสถิติไม่อยู่ในช่วงตัวเลขที่คำนวณได้ ตรวจข้อมูลต้นทาง");
  if ([solventInterference, matrixInterference, ...peaks.flatMap(peak => [peak.solventInterference, peak.matrixInterference])].some(value => value != null && !Number.isFinite(value))) errors.push("Specificity: ค่า Blank interference เกินช่วงคำนวณ");
  const standardReady = errors.length === 0 && standard.rows.length >= minStandards && area?.rsd != null && peaks.every(peak => peak.rt?.rsd != null && peak.area?.rsd != null);
  const blankReady = standardReady && blanks.rows.length >= minBlanks;
  const evidenceComplete = [settings.standardReference, settings.solventReference, settings.matrixReference, settings.reviewNotes,
    context.analyte, context.method, context.protocol, context.calibration, context.reviewer].every(value => value.trim() !== "") && settings.decision !== "pending";
  const canRecord = blankReady && evidenceComplete;
  const current = canRecord && !!settings.reviewedAt && Number.isFinite(Date.parse(settings.reviewedAt)) && settings.reviewedSnapshot === specificitySnapshot(settings, context);
  const checks: ValidationCheck[] = [
    ...peaks.map(peak => ({ name: settings.peakMode ? `RT %CV · ${peak.name}` : "RT %CV", value: fmt(peak.rt?.rsd), criteria: `≤ ${settings.rtLimit}% · Standard ≥ ${settings.minStandards} ครั้ง`, pass: standardReady ? peak.rt!.rsd! <= rtLimit : null })),
    { name: settings.peakMode ? "ผลรวม Area %RSD" : "Area %RSD", value: fmt(area?.rsd), criteria: `≤ ${settings.areaLimit}%`, pass: standardReady ? area.rsd! <= areaLimit : null },
    { name: "Solvent Blank interference", value: fmt(solventInterference), criteria: `≤ ${settings.blankLimit}% ของ Mean Standard Area · ≥ ${settings.minBlanks} ครั้ง`, pass: blankReady ? solventInterference! <= blankLimit : null },
    { name: "Matrix Blank interference", value: fmt(matrixInterference), criteria: `≤ ${settings.blankLimit}% ของ Mean Standard Area · ≥ ${settings.minBlanks} ครั้ง`, pass: blankReady ? matrixInterference! <= blankLimit : null },
    ...(settings.peakMode ? peaks.flatMap(peak => [
      { name: `Solvent Blank · ${peak.name}`, value: fmt(peak.solventInterference), criteria: `≤ ${settings.blankLimit}% ของ ${settings.peakBlankBasis === "total" ? "Mean Total Area" : "Mean Area ของพีคนี้"}`, pass: blankReady ? peak.solventInterference! <= blankLimit : null },
      { name: `Matrix Blank · ${peak.name}`, value: fmt(peak.matrixInterference), criteria: `≤ ${settings.blankLimit}% ของ ${settings.peakBlankBasis === "total" ? "Mean Total Area" : "Mean Area ของพีคนี้"}`, pass: blankReady ? peak.matrixInterference! <= blankLimit : null },
    ]) : []),
    { name: "ทบทวน Chromatogram / Matrix Blank", value: current ? `${context.reviewer} · ${settings.reviewedAt}` : settings.reviewedAt ? "ข้อมูลเปลี่ยนหรือไม่ครบ ต้องทบทวนใหม่" : "ยังไม่ได้บันทึกผลทบทวน", criteria: "ระบุหลักฐาน Standard, Solvent Blank, Matrix Blank และผลตรวจความจำเพาะ", pass: current ? settings.decision === "passed" : null },
  ];
  return { checks, errors, rt, area, peaks, solventMax, matrixMax, solventInterference, matrixInterference, canRecord, current, blankRows: blanks.rows, standardRows: standard.rows };
}
