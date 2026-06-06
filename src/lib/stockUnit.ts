import { addDays, addWeeks, addMonths } from "date-fns";

export type ShelfUnit = "day" | "week" | "month";
export interface OpenShelfLife {
  value: number;
  unit: ShelfUnit;
}

export function addShelfLife(from: Date, shelf: OpenShelfLife): Date {
  const v = Math.max(0, Math.floor(Number(shelf?.value) || 0));
  switch (shelf?.unit) {
    case "week":
      return addWeeks(from, v);
    case "month":
      return addMonths(from, v);
    case "day":
    default:
      return addDays(from, v);
  }
}

/** working EXP = วันเบิก + openShelfLife, cap ไม่ให้เกิน EXP ขวดแม่ */
export function computeWorkingExp(
  withdrawnAt: Date,
  shelf: OpenShelfLife,
  parentExp: Date | null,
): Date {
  const candidate = addShelfLife(withdrawnAt, shelf);
  if (parentExp && candidate.getTime() > parentExp.getTime()) return parentExp;
  return candidate;
}

/** ดึง qrId จากผลสแกน — รองรับ id เปล่า / URL .../stock/scan/<id> / JSON {qrId} */
export function parseScannedQrId(raw: string): string {
  const text = (raw || "").trim();
  if (!text) return "";
  try {
    const payload = JSON.parse(text) as { qrId?: unknown; id?: unknown };
    const v = payload.qrId ?? payload.id;
    if (v) return String(v).trim();
  } catch {
    /* not JSON */
  }
  try {
    const url = new URL(text);
    const parts = url.pathname.split("/").filter(Boolean);
    return decodeURIComponent(parts[parts.length - 1] || text).trim();
  } catch {
    return text;
  }
}

export type UnitDerivedStatus = "active" | "empty" | "discarded" | "expired";

export function unitDerivedStatus(
  u: { status: string; exp?: string | null },
  now: Date = new Date(),
): UnitDerivedStatus {
  if (u.status === "discarded") return "discarded";
  if (u.status === "empty") return "empty";
  if (u.exp && new Date(u.exp).getTime() < now.getTime()) return "expired";
  return "active";
}

export interface UnitsSummary {
  sealed: number;
  working: number;
  expiringSoon: number;
  expired: number;
}

export function summarizeUnits(
  units: Array<{ kind: string; status: string; exp?: string | null }>,
  now: Date = new Date(),
  soonDays = 30,
): UnitsSummary {
  let sealed = 0,
    working = 0,
    expiringSoon = 0,
    expired = 0;
  const soonMs = soonDays * 24 * 60 * 60 * 1000;
  for (const u of units) {
    const st = unitDerivedStatus(u, now);
    if (st === "discarded" || st === "empty") continue;
    if (st === "expired") {
      expired++;
      continue;
    }
    if (u.kind === "working") working++;
    else sealed++;
    if (u.exp && new Date(u.exp).getTime() - now.getTime() <= soonMs) expiringSoon++;
  }
  return { sealed, working, expiringSoon, expired };
}
