import { preparationKind, preparationResult, type PreparationLevel, type ValidationStock } from "./validationPreparation";

// Each STD level owns three injection rows; preserve all measured cells verbatim.
export function syncLinearityConcentrations(text: string, levels: PreparationLevel[], stock: number | null, stocks: ValidationStock[]) {
  const std = levels.filter(level => preparationKind(level) === "std");
  const rows = text ? text.split(/\r?\n/).map(line => line.split(/[,;\t]/)) : [];
  return Array.from({ length: Math.max(rows.length, std.length * 3) }, (_, index) => {
    const cells = [...(rows[index] ?? ["", ""])];
    const level = std[Math.floor(index / 3)];
    if (level) cells[0] = String(preparationResult(level, stock, stocks)?.actual ?? "");
    return cells.join("\t");
  }).join("\n");
}
