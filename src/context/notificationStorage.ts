import type { AppNotification } from "./NotificationContext";

/** เพดานต่อ group — กันแจ้งเตือนที่ไหลเข้าเรื่อย ๆ (เช่น petition) กิน localStorage ข้ามวัน */
export const MAX_PERSISTED_PER_GROUP = 50;

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
