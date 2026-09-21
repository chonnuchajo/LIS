import { parseMeasurements, regression } from "./validationCalculator";
import { stockConcentration, type ValidationStock } from "./validationPreparation";

export const measurementKinds = ["accuracy", "daily", "sample", "standard", "spike"] as const;
export type MeasurementKind = typeof measurementKinds[number];
export const measurementLabels: Record<MeasurementKind, string> = { accuracy: "Accuracy / Repeatability", daily: "Intermediate Precision", sample: "Sample", standard: "Standard QC", spike: "Matrix Spike" };
export type ValidationCalibration = {
  id: string; name: string; mode: "points" | "equation"; points: string;
  slope: string; intercept: string; min: string; max: string; r2: string; reference: string;
};
export type ValidationMeasurement = {
  id: string; sampleId: string; kind: MeasurementKind; day: string; target: string;
  calibrationId: string; area: string; stockId: string; aliquot: string; finalVolume: string; matrix: string;
  weight: string; volume: string; df: string; density: string; unspiked: string;
};
export type LinkedMeasurements = { enabled: MeasurementKind[]; calibrations: ValidationCalibration[]; rows: ValidationMeasurement[] };
export const defaultLinkedMeasurements = (): LinkedMeasurements => ({ enabled: [], calibrations: [], rows: [] });
export const newMeasurement = (kind: MeasurementKind): ValidationMeasurement => ({ id: crypto.randomUUID(), sampleId: "", kind, day: "1", target: "", calibrationId: "", area: "", stockId: "", aliquot: "", finalVolume: "1000", matrix: "0", weight: "", volume: "25", df: "1", density: "0", unspiked: "" });
const numeric = (value: string) => value.trim() !== "" && Number.isFinite(Number(value)) ? Number(value) : null;

export function calibrationResult(calibration: ValidationCalibration) {
  if (!calibration.name.trim() || !calibration.reference.trim()) return null;
  if (calibration.mode === "points") {
    const data = parseMeasurements(calibration.points, 2);
    if (data.errors.length || new Set(data.rows.map(row => row[0])).size < 3) return null;
    const fit = regression(data.rows);
    return fit ? { slope: fit.slope, intercept: fit.intercept, min: Math.min(...data.rows.map(row => row[0])), max: Math.max(...data.rows.map(row => row[0])), r2: fit.r2 } : null;
  }
  const slope = numeric(calibration.slope), intercept = numeric(calibration.intercept), min = numeric(calibration.min), max = numeric(calibration.max), r2 = numeric(calibration.r2);
  return slope != null && slope > 0 && intercept != null && min != null && min >= 0 && max != null && max > min
    && r2 != null && r2 >= 0 && r2 <= 1 ? { slope, intercept, min, max, r2 } : null;
}

export function evaluateLinkedMeasurements(settings: LinkedMeasurements, mainStock: number | null, stocks: ValidationStock[], r2Min = 0.995) {
  const sources = settings.calibrations.map(calibration => ({ calibration, fit: calibrationResult(calibration) }));
  const results = settings.rows.map((row, index) => {
    const errors: string[] = [];
    const prefix = `${measurementLabels[row.kind]} · ${row.sampleId || `แถว ${index + 1}`}`;
    const problem = (message: string) => errors.push(`${prefix}: ${message}`);
    if (!row.sampleId.trim()) problem("ระบุรหัสตัวอย่าง/การเตรียม");
    if (settings.rows.some((other, otherIndex) => otherIndex < index && other.kind === row.kind && other.sampleId.trim() === row.sampleId.trim() && (row.kind !== "daily" || Number(other.day) === Number(row.day)))) problem("รหัสตัวอย่างซ้ำในชุด/วันเดียวกัน ต้องใช้ตัวอย่างที่เตรียมแยกกัน");
    const source = sources.find(item => item.calibration.id === row.calibrationId);
    if (source && sources.filter(item => item.calibration.name.trim() === source.calibration.name.trim()).length > 1) problem("ชื่อ Calibration ซ้ำกัน กรุณาตั้งชื่อให้แยกชุดได้ชัดเจน");
    const area = numeric(row.area);
    let found: number | null = null;
    if (!source?.fit) problem("เลือก Calibration ที่กรอกชื่อ หลักฐาน และข้อมูลสมการครบ");
    else if (!Number.isFinite(r2Min) || r2Min <= 0 || r2Min > 1 || source.fit.r2 < r2Min) problem("R² ของ Calibration ไม่ผ่านเกณฑ์ที่กำหนดใน Linearity");
    if (area == null || area < 0) problem("Area ต้องเป็นตัวเลขไม่ติดลบ");
    if (source?.fit && area != null && area >= 0) {
      const value = (area - source.fit.intercept) / source.fit.slope;
      if (!Number.isFinite(value) || value < 0) problem("Found คำนวณไม่ได้หรือเป็นค่าติดลบ");
      else if (value < source.fit.min - Number.EPSILON * Math.max(1, source.fit.max) || value > source.fit.max + Number.EPSILON * Math.max(1, source.fit.max)) problem("Found อยู่นอกช่วง Calibration ต้องเตรียมหรือเจือจางใหม่ตามวิธี");
      else found = value;
    }
    const target = numeric(row.target), day = numeric(row.day);
    if ((row.kind === "accuracy" || row.kind === "daily") && (target == null || target <= 0)) problem("Target ต้องมากกว่า 0");
    if (row.kind === "daily" && (day == null || !Number.isInteger(day) || day < 1)) problem("วันต้องเป็นจำนวนเต็มบวก");
    let actual: number | null = null;
    if (row.kind !== "sample") {
      const selected = stocks.find(stock => stock.id === row.stockId);
      const stock = row.stockId ? selected ? stockConcentration(Number(selected.weight), Number(selected.purity), Number(selected.volume)) : null : mainStock;
      const aliquot = numeric(row.aliquot), finalVolume = numeric(row.finalVolume), matrix = numeric(row.matrix);
      if (stock == null || aliquot == null || aliquot <= 0 || finalVolume == null || finalVolume <= 0 || matrix == null || matrix < 0 || aliquot + matrix > finalVolume) problem("ตรวจ Stock, ปิเปต, Matrix และปริมาตรสุดท้ายของตัวอย่างนี้");
      else {
        const value = stock * aliquot / finalVolume;
        if (!Number.isFinite(value) || value <= 0) problem("Actual/Added คำนวณไม่ได้");
        else actual = value;
      }
    }
    const weight = numeric(row.weight), volume = numeric(row.volume), df = numeric(row.df), density = numeric(row.density), unspiked = numeric(row.unspiked);
    if (row.kind === "sample" && (weight == null || weight <= 0 || volume == null || volume <= 0 || df == null || df < 1 || density == null || density < 0)) problem("Sample ต้องมีน้ำหนัก/ปริมาตร > 0, DF ≥ 1, Density ≥ 0 (ใช้ 0 เมื่อไม่ทราบ)");
    if (row.kind === "spike" && (unspiked == null || unspiked < 0)) problem("กรอกผลวัด Unspiked ที่ปรับ dilution เป็นสารละลายสุดท้ายแล้ว");
    return { row, errors, found, actual, calibrationName: source?.calibration.name ?? "", target, day, weight, volume, df, density, unspiked };
  });
  const outputs = Object.fromEntries(measurementKinds.map(kind => {
    const rows = results.filter(result => result.row.kind === kind);
    if (rows.some(result => result.errors.length)) return [kind, ""];
    return [kind, rows.map(result => {
      if (kind === "accuracy") return [result.target, result.actual, result.found];
      if (kind === "daily") return [result.day, result.target, result.actual, result.found];
      if (kind === "sample") return [result.weight, result.found, result.volume, result.df, result.density];
      if (kind === "standard") return [result.found, result.actual];
      return [result.found, result.unspiked, result.actual];
    }).map(row => row.join("\t")).join("\n")];
  })) as Record<MeasurementKind, string>;
  return { outputs, results, sources, errors: results.filter(result => settings.enabled.includes(result.row.kind)).flatMap(result => result.errors) };
}
