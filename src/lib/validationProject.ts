import { z } from "zod";

const text = z.string().max(200000);
const short = z.string().max(2000);
const numericText = z.string().max(40);
const level = z.object({ id: short, purpose: z.enum(["linearity", "accuracy", "suitability", "qc"]), target: numericText, aliquot: numericText, finalVolume: numericText, matrix: numericText, recoveryLow: numericText, recoveryHigh: numericText });
export const validationProjectSchema = z.object({
  format: z.literal("lis-validation-project"), version: z.literal(1),
  title: short, analyte: short, method: short,
  prep: z.array(numericText).length(5), texts: z.array(text).length(3), blank: numericText,
  preparationLevels: z.array(level).max(100),
  reportMeta: z.object({ analyst: short, reviewer: short, protocol: short, calibration: short, notes: text }),
  precision: z.object({ massFractions: text, repeatabilityFactor: numericText, repeatabilityLimit: numericText, intermediateLimit: numericText, minDays: numericText, minReplicates: numericText, dailyData: text }),
  qc: z.object({ enabled: z.boolean(), sampleData: text, standardData: text, spikeData: text, recoveryLow: numericText, recoveryHigh: numericText, differenceLimit: numericText, productLow: numericText, productHigh: numericText, productUnit: z.enum(["ww", "wv"]) }),
});
// This repository disables strictNullChecks; Zod inference otherwise marks required
// object properties optional. Runtime parse above still requires every field.
type RequiredFields<T> = T extends Array<infer U> ? RequiredFields<U>[] : T extends object ? { [K in keyof T]-?: RequiredFields<T[K]> } : T;
export type ValidationProject = RequiredFields<z.infer<typeof validationProjectSchema>>;

export function readValidationProject(source: string) {
  const project = validationProjectSchema.parse(JSON.parse(source));
  if (new Set(project.preparationLevels.map(l => l.id)).size !== project.preparationLevels.length) throw new Error("รหัสระดับซ้ำกัน");
  return project as ValidationProject;
}
