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
  return weightMg * (purityPercent / 100) / volumeMl;
}

export function dilution(input: {
  stockMgMl: number; target: number; unit: ConcentrationUnit;
  finalUl: number; actualAliquotUl: number; matrixUl: number;
}) {
  const { stockMgMl, target, unit, finalUl, actualAliquotUl, matrixUl } = input;
  if (![stockMgMl, target, finalUl, actualAliquotUl].every(n => Number.isFinite(n) && n > 0) || !Number.isFinite(matrixUl) || matrixUl < 0) return null;
  const suggestedAliquotUl = target * concentrationFactor[unit] / stockMgMl * finalUl;
  if (suggestedAliquotUl + matrixUl > finalUl || actualAliquotUl + matrixUl > finalUl) return null;
  return {
    suggestedAliquotUl,
    actual: stockMgMl * actualAliquotUl / finalUl / concentrationFactor[unit],
    diluentUl: finalUl - actualAliquotUl - matrixUl,
  };
}

export type PreparationLevel = {
  id: string;
  purpose: "linearity" | "accuracy" | "suitability" | "qc";
  target: string;
  aliquot: string;
  finalVolume: string;
  matrix: string;
  recoveryLow: string;
  recoveryHigh: string;
};

export function defaultPreparationLevels(): PreparationLevel[] {
  return [
    ...[0.1, 0.25, 0.5, 0.75, 1].map((target, i) => ({ id: `linearity-${i}`, purpose: "linearity" as const, target: String(target), aliquot: String(target * 500), finalVolume: "1000", matrix: "0", recoveryLow: "90", recoveryHigh: "107" })),
    ...[0.1, 0.5, 1].map((target, i) => ({ id: `accuracy-${i}`, purpose: "accuracy" as const, target: String(target), aliquot: String(target * 500), finalVolume: "1000", matrix: "4", recoveryLow: target === 1 ? "95" : "90", recoveryHigh: target === 1 ? "105" : "107" })),
    { id: "suitability", purpose: "suitability", target: "1", aliquot: "500", finalVolume: "1000", matrix: "0", recoveryLow: "90", recoveryHigh: "107" },
  ];
}
