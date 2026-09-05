import { normalizeRoles } from "@/lib/roles";

const CURSOR_PREFIX = "lis.petitionNotify.cursor.";
const LOOKBACK_MS = 24 * 60 * 60 * 1000;

export const cursorKey = (employeeId?: string) => `${CURSOR_PREFIX}${employeeId || "anonymous"}`;

export const readCursor = (employeeId?: string): string => {
  const fallback = new Date(Date.now() - LOOKBACK_MS).toISOString();
  try {
    return localStorage.getItem(cursorKey(employeeId)) || fallback;
  } catch {
    return fallback;
  }
};

/**
 * Whether this poll should actually ask the API for every department's notifications.
 * NotificationBell only *renders* the see-all switch for admins, but its localStorage
 * flag is global and never cleared — so a browser that was ever an admin (DevRoleSwitcher,
 * or a past real role change) would otherwise keep sending all=1 forever with no visible
 * control left to turn it off. Gate it here too, using the same admin check the bell uses.
 */
export const effectiveSeeAll = (user: Parameters<typeof normalizeRoles>[0], seeAllRaw: boolean): boolean =>
  seeAllRaw && normalizeRoles(user).includes("admin");

/**
 * ตัดสินใจว่า cursor ที่จะเขียนลง localStorage ควรเป็นค่าไหน — ต้องเดินหน้าอย่างเดียว
 * (never regress) เพราะ query cache หลายคีย์ (เช่น สลับ see-all on/off) แชร์ cursor slot
 * เดียวกันตาม employeeId เฉยๆ — ถ้าปล่อยให้ response เก่าที่ React Query serve แบบ stale
 * เขียนทับ cursor ใหม่กว่าได้ notification ที่ผู้ใช้ลบไปแล้วจะโผล่กลับมาซ้ำ
 */
export const nextCursor = (stored: string | null | undefined, serverTime: string): string => {
  if (!stored) return serverTime;
  const storedMs = Date.parse(stored);
  if (Number.isNaN(storedMs)) return serverTime;
  const serverMs = Date.parse(serverTime);
  if (Number.isNaN(serverMs)) return stored;
  return serverMs > storedMs ? serverTime : stored;
};
