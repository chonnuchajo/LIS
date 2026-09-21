// แสดงจำนวนที่ตัดของ StockTransaction แถว deduct — solvent/glassware/ขวด standard
// เก็บใน delta ส่วนเบิก mg รายน้ำหนัก (deduct-mg) เก็บใน volumeDelta + weights.

import { formatStockQuantity } from "./stockQuantity";
import { normalizeRoles, type RoleHolder } from "./roles";

const STOCK_DEDUCTION_ACTION_TIME_ZONE = "Asia/Bangkok";
const STOCK_DEDUCTION_MANAGER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const STOCK_DEDUCTION_MANAGER_ROLES = new Set(["admin", "lab-inventory"]);

export interface DeductionAmountInput {
  action?: string;
  delta?: number | null;
  volumeDelta?: number | null;
  unit?: string;
  weights?: number[];
  userEmail?: string;
  userName?: string;
  createdAt?: string;
}

export interface DeductionAmount {
  text: string;
  /** แจกแจงรายน้ำหนัก เช่น "15 + 15 + 15" — มีเฉพาะเมื่อชั่งมากกว่า 1 ครั้ง */
  sub?: string;
}

export function deductionAmount(t: DeductionAmountInput): DeductionAmount {
  const amount = t.delta ?? t.volumeDelta;
  if (amount == null) return { text: "-" };
  const text = `${formatStockQuantity(Math.abs(amount))}${t.unit ? ` ${t.unit}` : ""}`;
  if (t.weights && t.weights.length > 1) return { text, sub: t.weights.join(" + ") };
  return { text };
}

function normalizedEmail(value?: string | null): string {
  return String(value || "").trim().toLowerCase();
}

function calendarDayKey(value: Date | string | null | undefined, timeZone = STOCK_DEDUCTION_ACTION_TIME_ZONE): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((row) => row.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function canManageStockDeduction(
  transaction: DeductionAmountInput | null | undefined,
  user: (RoleHolder & { email?: string | null }) | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!transaction || transaction.action !== "deduct") return false;
  const createdAt = transaction.createdAt ? new Date(transaction.createdAt) : null;
  const createdAtMs = createdAt?.getTime() ?? NaN;
  const nowMs = now.getTime();
  const isValidCreatedAt = Number.isFinite(createdAtMs);
  const hasManagerRole = normalizeRoles(user).some((role) => STOCK_DEDUCTION_MANAGER_ROLES.has(role));
  if (hasManagerRole) return isValidCreatedAt && createdAtMs <= nowMs && nowMs - createdAtMs <= STOCK_DEDUCTION_MANAGER_WINDOW_MS;

  const owner = normalizedEmail(transaction.userEmail);
  const currentUser = normalizedEmail(user?.email);
  if (!owner || !currentUser || owner !== currentUser) return false;
  return calendarDayKey(transaction.createdAt) === calendarDayKey(now);
}
