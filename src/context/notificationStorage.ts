import type { AppNotification } from "./NotificationContext";

/** เพดานต่อ group — กันแจ้งเตือนที่ไหลเข้าเรื่อย ๆ (เช่น petition) กิน localStorage ข้ามวัน */
export const MAX_PERSISTED_PER_GROUP = 50;
export const LEGACY_NOTIFICATION_STORAGE_KEY = "lis.notifications.v1";
const RETIRED_GROUPS = new Set(["standard-expiry"]);
const RETIRED_ID_PREFIXES = ["std-inuse:"];

export type NotificationStorageOwner = { employeeId?: string; email?: string; name?: string } | null | undefined;

export const notificationStorageIdentity = (user: NotificationStorageOwner) =>
  user?.employeeId?.trim() || user?.email?.trim() || user?.name?.trim() || "anonymous";

export const notificationStorageKey = (user: NotificationStorageOwner) =>
  `${LEGACY_NOTIFICATION_STORAGE_KEY}:${encodeURIComponent(notificationStorageIdentity(user))}`;

const isRetired = (n: AppNotification) =>
  (n.group ? RETIRED_GROUPS.has(n.group) : false) || RETIRED_ID_PREFIXES.some(prefix => n.id.startsWith(prefix));

/**
 * เลือกว่าอะไรควรถูกเก็บลง localStorage: เฉพาะ persistent, เก็บอันที่ไม่มี group ครบทุกอัน
 * (เช่น เตือน Daily Check ที่มีอันเดียวและห้ามหาย) ส่วนอันที่มี group เก็บ 50 อันใหม่สุดของ group นั้น
 * ลำดับในลิสต์เดิมถูกรักษาไว้
 */
export function capPersisted(list: AppNotification[]): AppNotification[] {
  const persistent = list.filter(n => n.persistent);

  const keptIds = new Set<string>();
  const byGroup = new Map<string, AppNotification[]>();

  for (const item of persistent) {
    if (!item.group) {
      keptIds.add(item.id);
      continue;
    }
    const bucket = byGroup.get(item.group) ?? [];
    bucket.push(item);
    byGroup.set(item.group, bucket);
  }

  for (const bucket of byGroup.values()) {
    [...bucket]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, MAX_PERSISTED_PER_GROUP)
      .forEach(item => keptIds.add(item.id));
  }

  return persistent.filter(n => keptIds.has(n.id));
}

export function sanitizePersistedNotifications(list: AppNotification[]): AppNotification[] {
  return capPersisted(list.filter(n => !isRetired(n)));
}
