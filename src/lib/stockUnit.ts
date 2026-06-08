import { addDays, addWeeks, addMonths } from "date-fns";
import type { StockUnitItem } from "@/types/stock";

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

export interface UnitTreeRow {
  unit: StockUnitItem;
  label: string;
  depth: number;
  hasChildren: boolean;
  rootId: string;
}

/** จัด StockUnitItem[] เป็น flat render-list แบบ tree:
 *  - กรอง discarded ออก (ตาม unitDerivedStatus)
 *  - root = ขวด sealed เรียงตาม input → label "1","2",...
 *  - child = working ที่ parentId ตรง root → label "<n>.1",".2" เรียงตามเวลาแบ่ง
 *  - orphan = working ที่พ่อไม่อยู่ในชุดที่เห็น → ยกเป็น root ต่อท้าย
 *  output เรียงแบบ DFS: root → children ของมัน → root ถัดไป */
export function buildUnitTree(
  units: StockUnitItem[],
  now: Date = new Date(),
): UnitTreeRow[] {
  const visible = units.filter((u) => unitDerivedStatus(u, now) !== "discarded");
  const roots = visible.filter((u) => u.kind === "sealed");
  const rootIds = new Set(roots.map((u) => u._id));

  const childrenByParent = new Map<string, StockUnitItem[]>();
  const orphans: StockUnitItem[] = [];
  for (const u of visible) {
    if (u.kind !== "working") continue;
    if (u.parentId && rootIds.has(u.parentId)) {
      const arr = childrenByParent.get(u.parentId) ?? [];
      arr.push(u);
      childrenByParent.set(u.parentId, arr);
    } else {
      orphans.push(u);
    }
  }

  const timeOf = (u: StockUnitItem) =>
    new Date(u.withdrawnDate || u.createdAt || 0).getTime();
  for (const arr of childrenByParent.values()) arr.sort((a, b) => timeOf(a) - timeOf(b));

  const rows: UnitTreeRow[] = [];
  let n = 0;
  for (const root of roots) {
    n += 1;
    const kids = childrenByParent.get(root._id) ?? [];
    rows.push({ unit: root, label: String(n), depth: 0, hasChildren: kids.length > 0, rootId: root._id });
    kids.forEach((kid, i) => {
      rows.push({ unit: kid, label: `${n}.${i + 1}`, depth: 1, hasChildren: false, rootId: root._id });
    });
  }
  for (const orphan of orphans) {
    n += 1;
    rows.push({ unit: orphan, label: String(n), depth: 0, hasChildren: false, rootId: orphan._id });
  }
  return rows;
}
