import { preparationKind, targetConcentration, type PreparationLevel } from "./validationPreparation";

export function matrixTargetsFromStd(levels: PreparationLevel[]) {
  const std = levels.filter(row => preparationKind(row) === "std");
  const values = std.map(targetConcentration).filter((value): value is number => value != null).sort((a, b) => a - b);
  if (std.length !== 5 || values.length !== 5 || new Set(values).size !== 5) return null;
  return [values[0], values[2], values[4]];
}

export function syncMatrixTargets(levels: PreparationLevel[]) {
  // Old projects without any STD rows can still be opened without destroying their inputs.
  if (!levels.some(row => preparationKind(row) === "std")) return levels;
  const targets = matrixTargetsFromStd(levels);
  let index = 0;
  return levels.map(row => {
    if (preparationKind(row) !== "matrix") return row;
    const target = targets ? String(targets[index++] ?? "") : "";
    const reference = targets ? String(targets[2]) : "";
    const config = row.matrixCalculation ?? { percent: "", basis: "ww" as const, reference: "", density: "", sampleDensity: "" };
    if (row.target === target && row.targetUnit === "mg/mL" && config.reference === reference && row.matrixCalculation) return row;
    return { ...row, target, targetUnit: "mg/mL" as const, matrixCalculation: { ...config, reference } };
  });
}
