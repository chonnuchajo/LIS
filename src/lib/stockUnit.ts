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
    const fromQuery = url.searchParams.get("qrId") ?? url.searchParams.get("id") ?? url.searchParams.get("solventId");
    if (fromQuery) return fromQuery.trim();
    const parts = url.pathname.split("/").filter(Boolean);
    return decodeURIComponent(parts[parts.length - 1] || text).trim();
  } catch {
    return text;
  }
}

export type UnitDerivedStatus = "active" | "empty" | "discarded" | "expired";

export function unitDerivedStatus(
  u: { status: string; exp?: string | null; volume?: { remaining?: number | null } | null },
  now: Date = new Date(),
): UnitDerivedStatus {
  if (u.status === "discarded") return "discarded";
  const remaining = u.volume?.remaining;
  if (u.status === "empty" || (remaining != null && Number(remaining) <= 0)) return "empty";
  if (u.exp && new Date(u.exp).getTime() < now.getTime()) return "expired";
  return "active";
}

/** ขวดที่ยังไม่ทิ้ง เรียงตามวันรับเข้า (flat) */
export function visibleBottles(units: StockUnitItem[], now: Date = new Date()): StockUnitItem[] {
  const timeOf = (u: StockUnitItem) => new Date(u.receivedDate || u.createdAt || 0).getTime();
  return units
    .filter((u) => {
      const status = unitDerivedStatus(u, now);
      return status !== "discarded" && status !== "empty";
    })
    .sort((a, b) => timeOf(a) - timeOf(b));
}
