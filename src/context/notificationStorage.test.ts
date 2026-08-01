import { describe, it, expect } from "vitest";
import { capPersisted, MAX_PERSISTED_PER_GROUP } from "./notificationStorage";
import type { AppNotification } from "./NotificationContext";

const n = (id: string, extra: Partial<AppNotification> = {}): AppNotification => ({
  id,
  title: id,
  level: "info",
  createdAt: Number(id.replace(/\D/g, "")) || 0,
  read: false,
  persistent: true,
  ...extra,
});

describe("capPersisted", () => {
  it("ทิ้งอันที่ไม่ persistent", () => {
    expect(capPersisted([n("1"), n("2", { persistent: false })]).map(x => x.id)).toEqual(["1"]);
  });

  it("เก็บอันที่ไม่มี group ไว้ทั้งหมด ไม่ว่าจะเยอะแค่ไหน", () => {
    const list = [n("daily-check-reminder", { createdAt: 1 })];
    for (let i = 0; i < MAX_PERSISTED_PER_GROUP + 10; i += 1) {
      list.push(n(`p${i + 100}`, { group: "petition", createdAt: i + 100 }));
    }
    const out = capPersisted(list);
    expect(out.some(x => x.id === "daily-check-reminder")).toBe(true);
  });

  it("เก็บเฉพาะ 50 อันใหม่สุดของแต่ละ group", () => {
    const list: AppNotification[] = [];
    for (let i = 0; i < MAX_PERSISTED_PER_GROUP + 10; i += 1) {
      list.push(n(`p${i}`, { group: "petition", createdAt: i }));
    }
    const out = capPersisted(list);
    expect(out).toHaveLength(MAX_PERSISTED_PER_GROUP);
    expect(out.some(x => x.createdAt === 0)).toBe(false);   // อันเก่าสุดถูกตัด
    expect(out.some(x => x.createdAt === 59)).toBe(true);   // อันใหม่สุดยังอยู่
  });

  it("รักษาลำดับเดิมของลิสต์", () => {
    const out = capPersisted([n("3", { group: "petition", createdAt: 3 }), n("1", { group: "petition", createdAt: 1 })]);
    expect(out.map(x => x.id)).toEqual(["3", "1"]);
  });
});
