export type ConcentrationUnit = "mg/mL" | "µg/mL" | "mg/L";
export const concentrationFactor: Record<ConcentrationUnit, number> = {
  "mg/mL": 1, "µg/mL": 0.001, "mg/L": 0.001,
};

export function positiveNumber(value: string): number | null {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function stockConcentration(weightMg: number, purityPercent: number, volumeMl: number) {
  if (![weightMg, purityPercent, volumeMl].every(n => Number.isFinite(n) && n > 0) || purityPercent > 100) return null;
  const concentration = weightMg * (purityPercent / 100) / volumeMl;
  return Number.isFinite(concentration) && concentration > 0 ? concentration : null;
}

export function dilution(input: {
  stockMgMl: number; target: number; unit: ConcentrationUnit;
  finalUl: number; actualAliquotUl: number; matrixUl: number;
}) {
  const { stockMgMl, target, unit, finalUl, actualAliquotUl, matrixUl } = input;
  if (![stockMgMl, target, finalUl, actualAliquotUl].every(n => Number.isFinite(n) && n > 0) || !Number.isFinite(matrixUl) || matrixUl < 0) return null;
  const suggestedAliquotUl = target * concentrationFactor[unit] / stockMgMl * finalUl;
  if (suggestedAliquotUl + matrixUl > finalUl || actualAliquotUl + matrixUl > finalUl) return null;
  const result = {
    suggestedAliquotUl,
    actual: stockMgMl * actualAliquotUl / finalUl / concentrationFactor[unit],
    diluentUl: finalUl - actualAliquotUl - matrixUl,
  };
  return Object.values(result).every(Number.isFinite) && result.actual > 0 ? result : null;
}

export type PreparationLevel = {
  preparationKind?: "std" | "matrix";
  id: string;
  purpose: "linearity" | "accuracy" | "suitability" | "qc";
  target: string;
  targetUnit?: ConcentrationUnit;
  aliquot: string;
  finalVolume: string;
  matrix: string;
  recoveryLow: string;
  recoveryHigh: string;
  stockId?: string;
};

export type ValidationStock = {
  id: string; name: string; weight: string; purity: string; volume: string;
  certificate: string; preparedOn: string;
};

/** All downstream calculations and measurement tables use mg/mL. */
export function targetConcentration(level: Pick<PreparationLevel, "target" | "targetUnit">) {
  const value = positiveNumber(level.target);
  const unit = level.targetUnit ?? "mg/mL";
  if (value == null || !Object.prototype.hasOwnProperty.call(concentrationFactor, unit)) return null;
  const normalized = unit === "mg/mL" ? value : value / 1000;
  return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
}

/** Changing the display unit preserves the physical target, rather than relabeling it. */
export function changePreparationUnit(level: PreparationLevel, unit: ConcentrationUnit): PreparationLevel | null {
  if (!level.target.trim()) return { ...level, targetUnit: unit };
  const normalized = targetConcentration(level);
  if (normalized == null) return null;
  const value = unit === "mg/mL" ? normalized : normalized * 1000;
  if (!Number.isFinite(value) || value <= 0) return null;
  return { ...level, target: String(value), targetUnit: unit };
}

export function preparationResult(level: PreparationLevel, mainStock: number | null, stocks: ValidationStock[]) {
  const selected = stocks.find(stock => stock.id === level.stockId);
  const concentration = level.stockId
    ? selected ? stockConcentration(Number(selected.weight), Number(selected.purity), Number(selected.volume)) : null
    : mainStock;
  const target = targetConcentration(level);
  if (concentration == null || target == null || !level.matrix.trim()) return null;
  return dilution({ stockMgMl: concentration, target, unit: "mg/mL", finalUl: Number(level.finalVolume), actualAliquotUl: Number(level.aliquot), matrixUl: Number(level.matrix) });
}

/** Planned volumes are independent of the subsequently recorded actual pipetting. */
export function preparationPlan(level: PreparationLevel, mainStock: number | null, stocks: ValidationStock[]) {
  const selected = stocks.find(source => source.id === level.stockId);
  const stock = level.stockId ? selected ? stockConcentration(Number(selected.weight), Number(selected.purity), Number(selected.volume)) : null : mainStock;
  const target = targetConcentration(level), finalUl = positiveNumber(level.finalVolume);
  const matrixUl = level.matrix.trim() ? Number(level.matrix) : NaN;
  if (stock == null || !Number.isFinite(stock) || stock <= 0 || target == null || finalUl == null || !Number.isFinite(matrixUl) || matrixUl < 0) return null;
  const aliquotUl = target / stock * finalUl;
  const solventUl = finalUl - aliquotUl - matrixUl;
  if (!Number.isFinite(aliquotUl) || aliquotUl <= 0 || !Number.isFinite(solventUl) || solventUl < 0) return null;
  return { stock, target, finalUl, matrixUl, aliquotUl, solventUl };
}

/** Build input scaffolding only; measured Area/Found must always remain blank. */
export function preparationTemplate(purpose: "linearity" | "accuracy", levels: PreparationLevel[], mainStock: number | null, stocks: ValidationStock[], replicates: number) {
  const selected = levels.filter(level => level.purpose === purpose);
  if (!selected.length || !Number.isInteger(replicates) || replicates < 2 || replicates > 100) return null;
  const prepared = selected.map(level => ({ level, result: preparationResult(level, mainStock, stocks) }));
  if (prepared.some(row => !row.result)) return null;
  return prepared.flatMap(({ level, result }) => Array.from({ length: replicates }, () => purpose === "linearity"
    ? `${result!.actual}\t`
    : `${targetConcentration(level)}\t${result!.actual}\t`)).join("\n");
}

export type LinearitySettings = { minReplicates: string; r2Min: string; areaRsdMax: string; concentrationTolerance: string };
export const defaultLinearitySettings = (): LinearitySettings => ({ minReplicates: "3", r2Min: "0.995", areaRsdMax: "5", concentrationTolerance: "0.000001" });

/** Match every observed concentration to exactly one prepared actual concentration. */
export function checkLinearityPreparation(rows: number[][], levels: PreparationLevel[], mainStock: number | null, stocks: ValidationStock[], settings: LinearitySettings) {
  const errors: string[] = [];
  const planned = levels.filter(level => level.purpose === "linearity");
  const prepared = planned.map(level => ({ level, actual: preparationResult(level, mainStock, stocks)?.actual ?? null }));
  const replicates = Number(settings.minReplicates), tolerance = Number(settings.concentrationTolerance);
  const valid = Number.isInteger(replicates) && replicates >= 2 && replicates <= 100 &&
    positiveNumber(settings.r2Min) != null && Number(settings.r2Min) <= 1 && positiveNumber(settings.areaRsdMax) != null &&
    settings.concentrationTolerance.trim() !== "" && Number.isFinite(tolerance) && tolerance >= 0;
  if (!valid) errors.push("Linearity: ตรวจจำนวนซ้ำ 2–100, เกณฑ์ R² > 0 ถึง 1, Area RSD > 0 และความคลาดเคลื่อน Actual ≥ 0");
  if (planned.length < 3) errors.push("Linearity: ต้องมีแผนอย่างน้อย 3 ระดับ");
  if (prepared.some(row => row.actual == null)) errors.push("Linearity: กรอก Stock และแผนเตรียมสารให้ครบเพื่อเทียบ Actual กับผลวัด");
  const counts = prepared.map(() => 0);
  const groups: number[][][] = prepared.map(() => []);
  if (valid && prepared.every(row => row.actual != null)) {
    if (prepared.some((row, index) => prepared.some((other, otherIndex) => otherIndex < index && Math.abs(row.actual! - other.actual!) <= 2 * tolerance))) errors.push("Linearity: Actual ของระดับในแผนซ้ำหรือช่วงยอมรับทับกัน ตรวจ Stock/ปริมาตร/ความคลาดเคลื่อน");
    rows.forEach(([concentration], index) => {
      const matches = prepared.map((row, i) => Math.abs(row.actual! - concentration) <= tolerance + Number.EPSILON * Math.max(1, Math.abs(concentration)) ? i : -1).filter(i => i >= 0);
      if (matches.length !== 1) errors.push(`Linearity: แถว ${index + 1} Actual ${concentration} mg/mL ไม่ตรงกับระดับเตรียมสารหนึ่งระดับ`);
      else { counts[matches[0]]++; groups[matches[0]].push(rows[index]); }
    });
  }
  return { errors, prepared, counts, groups, ready: errors.length === 0 && counts.every(n => n >= replicates) };
}

export function defaultPreparationLevels(): PreparationLevel[] {
  return [
    ...[0.1, 0.25, 0.5, 0.75, 1].map((target, i) => ({ id: `linearity-${i}`, purpose: "linearity" as const, target: String(target), aliquot: String(target * 500), finalVolume: "1000", matrix: "0", recoveryLow: "90", recoveryHigh: "107" })),
    ...[0.1, 0.5, 1].map((target, i) => ({ id: `accuracy-${i}`, purpose: "accuracy" as const, target: String(target), aliquot: String(target * 500), finalVolume: "1000", matrix: "4", recoveryLow: target === 1 ? "95" : "90", recoveryHigh: target === 1 ? "105" : "107" })),
    { id: "suitability", purpose: "suitability", target: "1", aliquot: "500", finalVolume: "1000", matrix: "0", recoveryLow: "90", recoveryHigh: "107" },
  ];
}

export function preparationKind(level: PreparationLevel): "std" | "matrix" {
  return level.preparationKind ?? (level.matrix.trim() === "0" ? "std" : "matrix");
}
