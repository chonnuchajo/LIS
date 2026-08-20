// กฎระดับ stock กลาง — near-empty/out ทั้ง Standard / solvent / เครื่องแก้ว.
// "ขวดใช้ได้" = active และยังไม่หมดอายุ. Standard/solvent low ที่เหลือ 1, out ที่ 0.
// เครื่องแก้วมีแค่ out (0) / ok (≥1) — ไม่มี low.

export type StockLevel = "out" | "low" | "ok";

interface BottleLike { status: string; exp?: string | null; volume?: { remaining?: number | null } | null }

function hasRemainingStock(u: BottleLike): boolean {
  const remaining = u.volume?.remaining;
  return remaining == null || Number(remaining) > 0;
}

export function isUsableBottle(u: BottleLike, now: Date = new Date()): boolean {
  if (u.status !== "active") return false;
  if (!hasRemainingStock(u)) return false;
  if (u.exp && new Date(u.exp).getTime() < now.getTime()) return false;
  return true;
}

export function usableBottleCount(units: BottleLike[], now: Date = new Date()): number {
  return units.reduce((n, u) => (isUsableBottle(u, now) ? n + 1 : n), 0);
}

/** 0 → out, 1 → low (ใกล้หมด), ≥2 → ok */
function levelFromCount(n: number): StockLevel {
  if (n <= 0) return "out";
  if (n === 1) return "low";
  return "ok";
}

export const standardLevel = levelFromCount;
export const solventLevel = levelFromCount;

/** เครื่องแก้ว: ไม่มี near-empty — 0 → out, ≥1 → ok */
export function glasswareLevel(qty: number): StockLevel {
  return qty <= 0 ? "out" : "ok";
}

export interface StdSummary { usable: number; expired: number; expiringSoon: number }

export interface StandardAlertSummary {
  lowStock: boolean;
  expired: boolean;
  expiringSoon: boolean;
  severity: "destructive" | "warning";
  message: string;
}

/** สรุปขวดของสาร: usable (นับ level), expired (active แต่หมดอายุ), expiringSoon (usable + exp ภายใน soonDays) */
export function summarizeStandard(
  units: BottleLike[],
  now: Date = new Date(),
  soonDays = 30,
): StdSummary {
  const soonMs = soonDays * 24 * 60 * 60 * 1000;
  let usable = 0, expired = 0, expiringSoon = 0;
  for (const u of units) {
    if (u.status === "discarded" || u.status === "empty") continue;
    if (!hasRemainingStock(u)) continue;
    const isExpired = !!(u.exp && new Date(u.exp).getTime() < now.getTime());
    if (isExpired) { expired++; continue; }
    usable++;
    if (u.exp && new Date(u.exp).getTime() - now.getTime() <= soonMs) expiringSoon++;
  }
  return { usable, expired, expiringSoon };
}

export type StandardStatus = "ok" | "out" | "low" | "expired" | "soon";

/**
 * filter สถานะแบบเลือกหลายค่า (OR): true ถ้า summary ตรงกับสถานะใดสถานะหนึ่ง
 * ใน statuses; set ว่าง = ผ่านเสมอ (ไม่กรอง). เงื่อนไขต่อสถานะตรงกับ badge
 * ในตาราง Standards: "ok" ต้อง usable ok และไม่มีขวดหมดอายุ/ใกล้หมดอายุเลย.
 */
export function standardMatchesStatuses(
  sum: StdSummary,
  statuses: ReadonlySet<StandardStatus>,
): boolean {
  if (statuses.size === 0) return true;
  const level = standardLevel(sum.usable);
  if (statuses.has("ok") && level === "ok" && sum.expired === 0 && sum.expiringSoon === 0) return true;
  if (statuses.has("out") && level === "out") return true;
  if (statuses.has("low") && level === "low") return true;
  if (statuses.has("expired") && sum.expired > 0) return true;
  if (statuses.has("soon") && sum.expiringSoon > 0) return true;
  return false;
}

export function getStandardAlertSummary(sum: StdSummary): StandardAlertSummary | null {
  const lowStock = sum.usable > 0 && standardLevel(sum.usable) !== "ok";
  const expired = sum.expired > 0;
  const expiringSoon = !expired && sum.expiringSoon > 0;
  const parts: string[] = [];

  if (lowStock) parts.push(`ใกล้หมด เหลือรวม ${sum.usable} ขวด`);
  if (expired) parts.push(`หมดอายุ ${sum.expired} ขวด`);
  else if (expiringSoon) parts.push(`ใกล้หมดอายุ ${sum.expiringSoon} ขวด`);
  if (parts.length === 0) return null;

  return {
    lowStock,
    expired,
    expiringSoon,
    severity: lowStock || expired ? "destructive" : "warning",
    message: parts.join(" / "),
  };
}
