import { horwitz, intermediatePrecision, parseMeasurements, stats } from "./validationCalculator";
import { positiveNumber } from "./validationPreparation";

export type ValidationCheck = { name: string; value: string; criteria: string; pass: boolean | null };
export const formatValidationNumber = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? "—" : value.toLocaleString("en-US", { maximumFractionDigits: 6 });
export type PrecisionSettings = {
  massFractions: string;
  repeatabilityFactor: string;
  repeatabilityLimit: string;
  intermediateLimit: string;
  minDays: string;
  minReplicates: string;
  dailyData: string;
};
export const defaultPrecisionSettings = (): PrecisionSettings => ({
  massFractions: "", repeatabilityFactor: "1", repeatabilityLimit: "1.3",
  intermediateLimit: "2", minDays: "6", minReplicates: "10", dailyData: "",
});

export function evaluatePrecision(settings: PrecisionSettings, targets: number[], accuracyText: string) {
  const mass = parseMeasurements(settings.massFractions, 2);
  const daily = parseMeasurements(settings.dailyData, 4);
  const accuracy = parseMeasurements(accuracyText, 3);
  const errors = [...mass.errors.map(e => `ฐาน Horwitz: ${e}`), ...daily.errors.map(e => `ข้อมูลรายวัน: ${e}`)];
  const factor = positiveNumber(settings.repeatabilityFactor);
  const rLimit = positiveNumber(settings.repeatabilityLimit);
  const iLimit = positiveNumber(settings.intermediateLimit);
  const minDays = positiveNumber(settings.minDays);
  const minReplicates = positiveNumber(settings.minReplicates);
  const validConfig = factor != null && factor <= 1 && rLimit != null && iLimit != null && minDays != null && minDays >= 2 && Number.isInteger(minDays) && minReplicates != null && minReplicates >= 2 && Number.isInteger(minReplicates);
  if (!validConfig) errors.push("Precision: ตรวจ factor (0–1), เกณฑ์ HorRat และจำนวนวัน/ซ้ำที่เป็นจำนวนเต็มอย่างน้อย 2");
  if (mass.rows.some(([level, c]) => !targets.includes(level) || c <= 0 || c > 1) || new Set(mass.rows.map(r => r[0])).size !== mass.rows.length) errors.push("ฐาน Horwitz: ระดับต้องตรงแผนและไม่ซ้ำ ค่า C ต้องเป็นสัดส่วนมวล > 0 ถึง 1");
  if (daily.rows.some(([day, level, expected]) => !Number.isInteger(day) || day < 1 || !targets.includes(level) || expected <= 0)) errors.push("ข้อมูลรายวัน: วันต้องเป็นจำนวนเต็มบวก ระดับตรงแผน และ Actual ต้องมากกว่า 0");
  const checks: ValidationCheck[] = [];
  const summaries = targets.map(level => {
    const c = mass.rows.find(r => r[0] === level)?.[1];
    const predictedR = c == null ? null : horwitz(c);
    const predictedRepeatability = predictedR == null || factor == null ? null : predictedR * factor;
    const recoveryRows = accuracy.rows.filter(r => r[0] === level);
    const repeatability = stats(recoveryRows.filter(r => r[1] > 0).map(r => r[2] / r[1] * 100));
    const observedRsd = repeatability?.rsd;
    const ratio = predictedRepeatability && observedRsd != null ? observedRsd / predictedRepeatability : null;
    const repeatReady = errors.length === 0 && accuracy.errors.length === 0 && recoveryRows.every(r => r[1] > 0) && recoveryRows.length >= (minReplicates ?? Infinity) && ratio != null;
    checks.push({ name: `Repeatability ${level} mg/mL`, value: `RSD ${formatValidationNumber(observedRsd)}% · HorRat ${formatValidationNumber(ratio)}`, criteria: `RSD < ${formatValidationNumber(predictedRepeatability)}% และ HorRat < ${settings.repeatabilityLimit}`, pass: repeatReady ? observedRsd! < predictedRepeatability! && ratio! < rLimit! : null });
    const rows = daily.rows.filter(r => r[1] === level);
    const days = [...new Set(rows.map(r => r[0]))].sort((a, b) => a - b);
    const groups = days.map(day => rows.filter(r => r[0] === day && r[2] > 0).map(r => r[3] / r[2] * 100));
    const anova = errors.length === 0 ? intermediatePrecision(groups) : null;
    if (days.length && groups.some(g => g.length !== groups[0].length)) errors.push(`ระดับ ${level}: ANOVA ต้องมีจำนวนตัวอย่างเท่ากันทุกวัน`);
    const intermediateRatio = predictedR && anova ? anova.rsd / predictedR : null;
    const intermediateReady = errors.length === 0 && days.length >= (minDays ?? Infinity) && groups.every(g => g.length >= (minReplicates ?? Infinity)) && intermediateRatio != null;
    checks.push({ name: `Intermediate Precision ${level} mg/mL`, value: `RSD ${formatValidationNumber(anova?.rsd)}% · HorRat ${formatValidationNumber(intermediateRatio)}`, criteria: `RSD < ${formatValidationNumber(predictedR)}% และ HorRat < ${settings.intermediateLimit}`, pass: intermediateReady ? anova!.rsd < predictedR! && intermediateRatio! < iLimit! : null });
    return { level, c, predictedR, predictedRepeatability, repeatability, ratio, days, anova, intermediateRatio };
  });
  if (errors.length) checks.forEach(c => { c.pass = null; });
  return { checks, errors, summaries, rawDaily: daily.rows };
}

export type QcSettings = {
  enabled: boolean;
  sampleData: string;
  standardData: string;
  spikeData: string;
  recoveryLow: string;
  recoveryHigh: string;
  differenceLimit: string;
  productLow: string;
  productHigh: string;
  productUnit: "ww" | "wv";
};
export const defaultQcSettings = (): QcSettings => ({ enabled: false, sampleData: "", standardData: "", spikeData: "", recoveryLow: "90", recoveryHigh: "107", differenceLimit: "5", productLow: "", productHigh: "", productUnit: "ww" });

export function duplicateDifference(a: number, b: number) {
  const mean = a / 2 + b / 2;
  return [a, b].every(v => Number.isFinite(v) && v >= 0) && mean > 0 ? Math.abs(a - b) / mean * 100 : null;
}

export function evaluateQc(settings: QcSettings) {
  const samples = parseMeasurements(settings.sampleData, 5);
  const standards = parseMeasurements(settings.standardData, 2);
  const spikes = parseMeasurements(settings.spikeData, 3);
  const errors = [...samples.errors.map(e => `Sample: ${e}`), ...standards.errors.map(e => `Standard QC: ${e}`), ...spikes.errors.map(e => `Matrix spike: ${e}`)];
  const low = positiveNumber(settings.recoveryLow), high = positiveNumber(settings.recoveryHigh), limit = positiveNumber(settings.differenceLimit);
  if (!low || !high || low >= high || !limit) errors.push("QC: ตรวจเกณฑ์ Recovery และ %Difference");
  const productLow = positiveNumber(settings.productLow), productHigh = positiveNumber(settings.productHigh);
  const sampleResults = samples.rows.map(([weight, concentration, volume, df, density], i) => {
    const rawWw = weight > 0 && volume > 0 && df >= 1 ? concentration * volume * df * 100 / weight : NaN;
    const ww = Number.isFinite(rawWw) ? rawWw : null;
    const rawWv = ww != null && density > 0 ? ww * density : NaN;
    const wv = Number.isFinite(rawWv) ? rawWv : null;
    if (ww == null || (settings.productUnit === "wv" && wv == null)) errors.push(`Sample ${i + 1}: น้ำหนัก/ปริมาตรต้องมากกว่า 0, DF ≥ 1 และต้องมี density เมื่อใช้ %w/v`);
    return { sample: i + 1, weight, concentration, volume, df, density, ww, wv };
  });
  const standardRecoveries = standards.rows.map(([found, expected], i) => {
    if (expected <= 0) errors.push(`Standard QC ${i + 1}: Actual ต้องมากกว่า 0`);
    const recovery = expected > 0 ? found / expected * 100 : NaN;
    if (!Number.isFinite(recovery) && expected > 0) errors.push(`Standard QC ${i + 1}: ผลคำนวณเกินช่วงตัวเลขที่รองรับ`);
    return Number.isFinite(recovery) ? recovery : null;
  });
  const spikeRecoveries = spikes.rows.map(([found, unspiked, added], i) => {
    if (added <= 0 || found < unspiked) errors.push(`Matrix spike ${i + 1}: Added ต้องมากกว่า 0 และ Found ต้องไม่น้อยกว่า unspiked`);
    const recovery = added > 0 && found >= unspiked ? (found - unspiked) / added * 100 : NaN;
    if (!Number.isFinite(recovery) && added > 0 && found >= unspiked) errors.push(`Matrix spike ${i + 1}: ผลคำนวณเกินช่วงตัวเลขที่รองรับ`);
    return Number.isFinite(recovery) ? recovery : null;
  });
  const checks: ValidationCheck[] = sampleResults.map(sample => {
    const value = settings.productUnit === "ww" ? sample.ww : sample.wv;
    return { name: `Sample ${sample.sample}`, value: `${formatValidationNumber(value)} %${settings.productUnit === "ww" ? "w/w" : "w/v"}`, criteria: `${settings.productLow || "—"}–${settings.productHigh || "—"}`, pass: productLow != null && productHigh != null && productLow < productHigh && value != null ? value >= productLow && value <= productHigh : null };
  });
  if (!sampleResults.length) checks.push({ name: "Sample", value: "ยังไม่มีข้อมูล", criteria: "ผลตัวอย่างและเกณฑ์ผลิตภัณฑ์", pass: null });
  for (const [name, values] of [["Standard Check", standardRecoveries], ["Matrix Spike", spikeRecoveries]] as const) {
    const ready = values.length === 2 && values.every(v => v != null && Number.isFinite(v));
    const difference = ready ? duplicateDifference(values[0]!, values[1]!) : null;
    checks.push({ name, value: values.map(v => `${formatValidationNumber(v)}%`).join(" / ") || "—", criteria: `Recovery ${settings.recoveryLow}–${settings.recoveryHigh}% · 2 ชุด`, pass: ready && low != null && high != null ? values.every(v => v! >= low && v! <= high) : null });
    checks.push({ name: `${name} %Difference`, value: formatValidationNumber(difference), criteria: `≤ ${settings.differenceLimit}%`, pass: ready && difference != null && limit != null ? difference <= limit : null });
  }
  if (errors.length) checks.forEach(c => { c.pass = null; });
  return { checks: settings.enabled ? checks : [], errors: settings.enabled ? errors : [], sampleResults, standardRecoveries, spikeRecoveries,
    standardRows: standards.rows, spikeRows: spikes.rows,
    rawInputs: { sample: settings.sampleData, standard: settings.standardData, spike: settings.spikeData } };
}
