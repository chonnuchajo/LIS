import { parseMeasurements, stats } from "./validationCalculator";
import { formatValidationNumber as fmt, type ValidationCheck } from "./validationAdvanced";

export type SpecificitySettings = {
  blankData: string; minStandards: string; minBlanks: string;
  rtLimit: string; areaLimit: string; blankLimit: string;
  standardReference: string; solventReference: string; matrixReference: string;
  reviewNotes: string; decision: "pending" | "passed" | "failed";
  reviewedAt: string; reviewedSnapshot: string;
};
export const defaultSpecificitySettings = (): SpecificitySettings => ({
  blankData: "", minStandards: "6", minBlanks: "3", rtLimit: "0.5", areaLimit: "2", blankLimit: "0.5",
  standardReference: "", solventReference: "", matrixReference: "", reviewNotes: "", decision: "pending",
  reviewedAt: "", reviewedSnapshot: "",
});
export type SpecificityContext = {
  standardData: string; analyte: string; method: string; protocol: string;
  calibration: string; reviewer: string; preparation: string;
};

/** Exact source snapshot, not a signature or authenticated approval. */
export function specificitySnapshot(settings: SpecificitySettings, context: SpecificityContext) {
  const { reviewedAt: _date, reviewedSnapshot: _snapshot, ...sources } = settings;
  let preparation: unknown = context.preparation;
  try { preparation = JSON.parse(context.preparation); } catch { /* Preserve a plain reference. */ }
  return JSON.stringify({ ...context, ...sources, preparation }, (_key, value) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
      : value);
}

export function evaluateSpecificity(settings: SpecificitySettings, context: SpecificityContext) {
  const standard = parseMeasurements(context.standardData, 2);
  const blanks = parseMeasurements(settings.blankData, 2);
  const errors = [...standard.errors.map(e => `Specificity Standard · ${e}`), ...blanks.errors.map(e => `Specificity Blank · ${e}`)];
  const minStandards = Number(settings.minStandards), minBlanks = Number(settings.minBlanks);
  const rtLimit = Number(settings.rtLimit), areaLimit = Number(settings.areaLimit), blankLimit = Number(settings.blankLimit);
  const validCriteria = Number.isInteger(minStandards) && minStandards >= 2 && Number.isInteger(minBlanks) && minBlanks >= 1 &&
    [settings.rtLimit, settings.areaLimit, settings.blankLimit].every(v => v.trim() !== "" && Number.isFinite(Number(v))) && rtLimit > 0 && areaLimit > 0 && blankLimit >= 0;
  if (!validCriteria) errors.push("Specificity: ตรวจเกณฑ์ RT/Area > 0, Blank ≥ 0 และจำนวนซ้ำ Standard ≥ 2, Blank ≥ 1 เป็นจำนวนเต็ม");
  if (standard.rows.some(([rt, area]) => rt <= 0 || area <= 0)) errors.push("Specificity: RT และ Standard Area ต้องมากกว่า 0");
  const rt = stats(standard.rows.map(row => row[0]));
  const area = stats(standard.rows.map(row => row[1]));
  const standardReady = errors.length === 0 && standard.rows.length >= minStandards && rt?.rsd != null && area?.rsd != null;
  const blankReady = standardReady && blanks.rows.length >= minBlanks;
  const solventMax = blanks.rows.length ? Math.max(...blanks.rows.map(row => row[0])) : null;
  const matrixMax = blanks.rows.length ? Math.max(...blanks.rows.map(row => row[1])) : null;
  const solventInterference = solventMax != null && area?.mean > 0 ? solventMax / area.mean * 100 : null;
  const matrixInterference = matrixMax != null && area?.mean > 0 ? matrixMax / area.mean * 100 : null;
  const evidenceComplete = [settings.standardReference, settings.solventReference, settings.matrixReference, settings.reviewNotes,
    context.analyte, context.method, context.protocol, context.calibration, context.reviewer].every(value => value.trim() !== "") && settings.decision !== "pending";
  const canRecord = blankReady && evidenceComplete;
  const current = canRecord && !!settings.reviewedAt && Number.isFinite(Date.parse(settings.reviewedAt)) && settings.reviewedSnapshot === specificitySnapshot(settings, context);
  const checks: ValidationCheck[] = [
    { name: "RT %CV", value: fmt(rt?.rsd), criteria: `≤ ${settings.rtLimit}% · Standard ≥ ${settings.minStandards} ครั้ง`, pass: standardReady ? rt.rsd! <= rtLimit : null },
    { name: "Area %RSD", value: fmt(area?.rsd), criteria: `≤ ${settings.areaLimit}%`, pass: standardReady ? area.rsd! <= areaLimit : null },
    { name: "Solvent Blank interference", value: fmt(solventInterference), criteria: `≤ ${settings.blankLimit}% ของ Mean Standard Area · ≥ ${settings.minBlanks} ครั้ง`, pass: blankReady ? solventInterference! <= blankLimit : null },
    { name: "Matrix Blank interference", value: fmt(matrixInterference), criteria: `≤ ${settings.blankLimit}% ของ Mean Standard Area · ≥ ${settings.minBlanks} ครั้ง`, pass: blankReady ? matrixInterference! <= blankLimit : null },
    { name: "ทบทวน Chromatogram / Matrix Blank", value: current ? `${context.reviewer} · ${settings.reviewedAt}` : settings.reviewedAt ? "ข้อมูลเปลี่ยนหรือไม่ครบ ต้องทบทวนใหม่" : "ยังไม่ได้บันทึกผลทบทวน", criteria: "ระบุหลักฐาน Standard, Solvent Blank, Matrix Blank และผลตรวจความจำเพาะ", pass: current ? settings.decision === "passed" : null },
  ];
  return { checks, errors, rt, area, solventMax, matrixMax, solventInterference, matrixInterference, canRecord, current, blankRows: blanks.rows, standardRows: standard.rows };
}
