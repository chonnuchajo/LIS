import { normalizeRoles } from "@/lib/roles";
import {
  LEGACY_NOTIFICATION_STORAGE_KEY,
  notificationStorageIdentity,
  notificationStorageKey,
  type NotificationStorageOwner,
} from "@/context/notificationStorage";

const CURSOR_PREFIX = "lis.petitionNotify.cursor.";
const LOOKBACK_MS = 24 * 60 * 60 * 1000;
const BACKFILL_PREFIX = `${LEGACY_NOTIFICATION_STORAGE_KEY}.backfill.`;

export const PETITION_NOTIFICATIONS_REFRESH_EVENT = "lis.petitionNotify.refresh";

export const requestPetitionNotificationsRefresh = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PETITION_NOTIFICATIONS_REFRESH_EVENT));
};

export const cursorKey = (employeeId?: string) => `${CURSOR_PREFIX}${employeeId || "anonymous"}`;

const fallbackCursor = () => new Date(Date.now() - LOOKBACK_MS).toISOString();

const persistedArrayLength = (key: string): number => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
};

export const petitionNotificationsBackfillKey = (user: NotificationStorageOwner) =>
  `${BACKFILL_PREFIX}${encodeURIComponent(notificationStorageIdentity(user))}`;

export const shouldBackfillPetitionNotifications = (employeeId: string | undefined, user: NotificationStorageOwner) => {
  if (typeof window === "undefined") return false;
  try {
    if (!localStorage.getItem(cursorKey(employeeId))) return false;
    if (localStorage.getItem(petitionNotificationsBackfillKey(user))) return false;
    if (persistedArrayLength(notificationStorageKey(user)) > 0) return false;
    return persistedArrayLength(LEGACY_NOTIFICATION_STORAGE_KEY) > 0;
  } catch {
    return false;
  }
};

export const markPetitionNotificationsBackfilled = (user: NotificationStorageOwner) => {
  try {
    localStorage.setItem(petitionNotificationsBackfillKey(user), new Date().toISOString());
  } catch {
    // private mode — retry next successful poll
  }
};

export const readCursor = (employeeId?: string): string => {
  const fallback = fallbackCursor();
  try {
    return localStorage.getItem(cursorKey(employeeId)) || fallback;
  } catch {
    return fallback;
  }
};

export const petitionNotificationSince = (employeeId: string | undefined, user: NotificationStorageOwner): string =>
  shouldBackfillPetitionNotifications(employeeId, user) ? fallbackCursor() : readCursor(employeeId);

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
