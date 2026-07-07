// src/lib/standardStatus.ts
// สถานะการใช้งานของ working standard (label + สี badge + usable) ใช้ร่วมทั้ง
// StandardDailyPanel (การ์ด "แบ่งวันนี้") และ StandardWorkingPanel (แท็บ "Standard ใช้งานอยู่")
import { workingUsability, type WorkingUsability } from "./stockUnit";
import type { StockUnitItem } from "@/types/stock";

export interface StandardStatusMeta {
  label: string;
  cls: string;
  usable: boolean;
}

/** map สถานะ working → ป้าย/สี/ใช้ได้ไหม — แหล่งเดียว กันซ้ำ */
export const STANDARD_STATUS: Record<WorkingUsability, StandardStatusMeta> = {
  active: { label: "พร้อมใช้งาน", cls: "bg-emerald-100 text-emerald-700", usable: true },
  freqDue: { label: "หมดความถี่", cls: "bg-amber-100 text-amber-700", usable: false },
  expired: { label: "หมดอายุ", cls: "bg-orange-100 text-orange-700", usable: false },
  empty: { label: "หมด", cls: "bg-slate-100 text-slate-600", usable: false },
  discarded: { label: "ทิ้งแล้ว", cls: "bg-destructive/15 text-destructive", usable: false },
};

/** เอา StockUnitItem → meta สถานะ (คำนวณด้วย workingUsability) */
export function standardStatusMeta(
  u: { status: string; exp?: string | null; frequencyDue?: string | null },
  now: Date = new Date(),
): StandardStatusMeta {
  return STANDARD_STATUS[workingUsability(u, now)];
}

function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** ISO เดียวกับวัน (local calendar) ของ ref ไหม */
export function isSameLocalDay(iso: string | null | undefined, ref: Date): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return localYmd(d) === localYmd(ref);
}

const timeOf = (u: StockUnitItem) =>
  new Date(u.withdrawnDate || u.createdAt || 0).getTime();

/**
 * working units ที่ "แบ่งวันนี้" (ตาม withdrawnDate, fallback createdAt) — รวม discarded
 * เพื่อโชว์ badge "ทิ้งแล้ว". เรียง: ที่ใช้ได้ก่อน แล้วตามเวลาแบ่งล่าสุดก่อน
 */
export function todayWorkingUnits(units: StockUnitItem[], now: Date = new Date()): StockUnitItem[] {
  return units
    .filter((u) => u.kind === "working" && isSameLocalDay(u.withdrawnDate || u.createdAt, now))
    .sort((a, b) => {
      const ua = standardStatusMeta(a, now).usable ? 0 : 1;
      const ub = standardStatusMeta(b, now).usable ? 0 : 1;
      if (ua !== ub) return ua - ub;
      return timeOf(b) - timeOf(a);
    });
}

export type StandardStatusFilter = "all" | "usable" | "attention";

export interface ActiveWorkingOpts {
  search?: string;
  statusFilter?: StandardStatusFilter;
}

/**
 * working standard ที่ยังไม่ทิ้ง (kind=working, status!=discarded)
 * + ค้นหา (ชื่อ/code) + filter สถานะ (usable=พร้อมใช้, attention=หมดอายุ/หมดความถี่/หมด)
 * + เรียงตาม itemCode แบบ natural numeric (tie → แบ่งล่าสุดก่อน)
 */
export function activeWorkingUnits(
  units: StockUnitItem[],
  opts: ActiveWorkingOpts = {},
  now: Date = new Date(),
): StockUnitItem[] {
  const { search = "", statusFilter = "all" } = opts;
  const q = search.trim().toLowerCase();
  return units
    .filter((u) => u.kind === "working" && u.status !== "discarded")
    .filter((u) =>
      !q ||
      (u.itemName || "").toLowerCase().includes(q) ||
      (u.itemCode || "").toLowerCase().includes(q),
    )
    .filter((u) => {
      if (statusFilter === "all") return true;
      const usable = workingUsability(u, now) === "active";
      return statusFilter === "usable" ? usable : !usable;
    })
    .sort(
      (a, b) =>
        (a.itemCode || "").localeCompare(b.itemCode || "", undefined, { numeric: true }) ||
        timeOf(b) - timeOf(a),
    );
}

/** ป้ายเวลาแบ่ง: วันนี้ → "แบ่งวันนี้ เวลา HH:mm", ไม่ใช่วันนี้ → "แบ่งเมื่อ D MMM YY" */
export function splitTimeLabel(
  u: { withdrawnDate?: string | null; createdAt?: string },
  now: Date = new Date(),
): string {
  const iso = u.withdrawnDate || u.createdAt;
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (isSameLocalDay(iso, now)) {
    return `แบ่งวันนี้ เวลา ${d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return `แบ่งเมื่อ ${d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}`;
}
