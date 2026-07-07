import type { StockUnitItem } from "@/types/stock";

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

/** ขวดที่ยังไม่ทิ้ง เรียงตามวันรับเข้า (flat) */
export function visibleBottles(units: StockUnitItem[], now: Date = new Date()): StockUnitItem[] {
  const timeOf = (u: StockUnitItem) => new Date(u.receivedDate || u.createdAt || 0).getTime();
  return units
    .filter((u) => unitDerivedStatus(u, now) !== "discarded")
    .sort((a, b) => timeOf(a) - timeOf(b));
}
