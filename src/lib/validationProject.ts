import { z } from "zod";
import { defaultSpecificitySettings } from "./validationSpecificity";
import { defaultLinearitySettings } from "./validationPreparation";
import { defaultLinkedMeasurements, measurementKinds } from "./validationMeasurements";
import { defaultProtocolDetails, protocolFields } from "./validationProtocol";

const text = z.string().max(200000);
const short = z.string().max(2000);
const numericText = z.string().max(40);
const level = z.object({ matrixCalculation: z.object({ percent: numericText, basis: z.enum(["ww", "wv"]), reference: numericText, density: numericText, sampleDensity: numericText }).optional(), preparationKind: z.enum(["std", "matrix"]).optional(), id: short, purpose: z.enum(["linearity", "accuracy", "suitability", "qc"]), target: numericText, targetUnit: z.enum(["mg/mL", "µg/mL", "mg/L"]).optional(), aliquot: numericText, finalVolume: numericText, matrix: numericText, recoveryLow: numericText, recoveryHigh: numericText, stockId: short.optional() });
export const validationProjectSchema = z.object({
  format: z.literal("lis-validation-project"), version: z.literal(1),
  title: short, analyte: short, method: short,
  protocolDetails: z.object(Object.fromEntries(protocolFields.map(([key]) => [key, z.string().max(10000)])) as Record<keyof ReturnType<typeof defaultProtocolDetails>, z.ZodString>).default(defaultProtocolDetails),
  prep: z.array(numericText).length(5), texts: z.array(text).length(3), blank: numericText,
  preparationLevels: z.array(level).max(100),
  stocks: z.array(z.object({ id: short.min(1), name: short, weight: numericText, purity: numericText, volume: numericText, certificate: short, preparedOn: short })).max(100).default([]),
  linearity: z.object({ minReplicates: numericText, r2Min: numericText, areaRsdMax: numericText, concentrationTolerance: numericText }).default(defaultLinearitySettings),
  linkedMeasurements: z.object({
    enabled: z.array(z.enum(measurementKinds)).max(5),
    calibrations: z.array(z.object({ id: short.min(1), name: short, mode: z.enum(["points", "equation"]), points: text, slope: numericText, intercept: numericText, min: numericText, max: numericText, r2: numericText, reference: short })).max(100),
    rows: z.array(z.object({ id: short.min(1), sampleId: short, kind: z.enum(measurementKinds), day: numericText, target: numericText, calibrationId: short, area: numericText, stockId: short, aliquot: numericText, finalVolume: numericText, matrix: numericText, weight: numericText, volume: numericText, df: numericText, density: numericText, unspiked: numericText })).max(2000),
  }).default(defaultLinkedMeasurements),
  specificity: z.object({
    blankData: text, minStandards: numericText, minBlanks: numericText,
    rtLimit: numericText, areaLimit: numericText, blankLimit: numericText,
    standardReference: short, solventReference: short, matrixReference: short,
    reviewNotes: text, decision: z.enum(["pending", "passed", "failed"]),
    reviewedAt: short, reviewedSnapshot: z.string().max(1000000),
    peakMode: z.boolean().default(false), peakNames: z.array(short).max(20).default(["Peak 1"]), peakStandardData: text.default(""), peakBlankData: text.default(""), peakBlankBasis: z.enum(["individual", "total"]).default("total"),
  }).default(defaultSpecificitySettings),
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
  if (new Set(project.stocks.map(stock => stock.id)).size !== project.stocks.length) throw new Error("รหัส Stock ซ้ำกัน");
  if (project.preparationLevels.some(level => level.stockId && !project.stocks.some(stock => stock.id === level.stockId))) throw new Error("ไม่พบ Stock ที่แผนเตรียมสารอ้างอิง");
  for (const collection of [project.linkedMeasurements.calibrations, project.linkedMeasurements.rows]) {
    if (new Set(collection.map(row => row.id)).size !== collection.length) throw new Error("รหัสข้อมูลผลวัดซ้ำกัน");
  }
  if (new Set(project.linkedMeasurements.enabled).size !== project.linkedMeasurements.enabled.length) throw new Error("หัวข้อผลวัดซ้ำกัน");
  if (project.linkedMeasurements.rows.some(row => (row.stockId && !project.stocks.some(stock => stock.id === row.stockId)) || (row.calibrationId && !project.linkedMeasurements.calibrations.some(calibration => calibration.id === row.calibrationId)))) throw new Error("ไม่พบ Stock หรือ Calibration ของตัวอย่าง");
  return project as ValidationProject;
}
