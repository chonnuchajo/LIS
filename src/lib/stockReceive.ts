import type { UnitsSummary } from "./stockUnit";

/** เกณฑ์ low-stock ต่อหมวด (ค่าเดิมจาก Stock.tsx) */
export const LOW_STD_QTY = 1;
export const LOW_SOL_QTY = 3;
export const LOW_GLASS_QTY = 5;

export type StockLevel = "ok" | "low" | "out";

/** ระดับสถานะจากจำนวนคงเหลือตรง ๆ (สารเคมี/เครื่องแก้ว) */
export function levelFromQty(qty: number, lowThreshold: number): StockLevel {
  if (qty <= 0) return "out";
  if (qty < lowThreshold) return "low";
  return "ok";
}

/** ระดับสถานะจากสรุปรายขวด (Standards) — นับ sealed+working ที่ใช้งานได้ */
export function levelFromUnits(sum: UnitsSummary, lowThreshold: number): StockLevel {
  const active = sum.sealed + sum.working;
  if (active === 0) return "out";
  if (active <= lowThreshold) return "low";
  return "ok";
}
