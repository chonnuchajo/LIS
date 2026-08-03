import { describe, it, expect } from "vitest";
import {
  IN_USE_SOON_MS,
  canAcknowledge,
  dueDistanceLabel,
  inUseStatus,
  planInUseNotifications,
  sortInUse,
} from "./standardInUse";
import type { StandardInUseItem } from "@/types/stock";

const NOW = new Date("2026-08-03T00:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

const row = (over: Partial<StandardInUseItem>): StandardInUseItem => ({
  _id: "tx1",
  itemCode: "STD-001",
  itemName: "ABAMECTIN",
  qrId: "u_abc",
  weights: [10],
  totalMg: 10,
  instrumentGroup: "gc",
  note: "",
  withdrawnAt: "2026-08-01T00:00:00.000Z",
  frequency: "1/1 week",
  dueAt: null,
  userEmail: "owner@icpladda.com",
  userName: "สมชาย",
  ...over,
});

describe("inUseStatus", () => {
  it("ไม่มี dueAt → noFrequency", () => {
    expect(inUseStatus(row({ dueAt: null }), NOW)).toBe("noFrequency");
    expect(inUseStatus(row({ dueAt: "ไม่ใช่วันที่" }), NOW)).toBe("noFrequency");
  });

  it("ถึง/เลยกำหนดแล้ว → expired (เท่ากันเป๊ะก็นับว่าหมดอายุ)", () => {
    expect(inUseStatus(row({ dueAt: NOW.toISOString() }), NOW)).toBe("expired");
    expect(inUseStatus(row({ dueAt: new Date(+NOW - 1).toISOString() }), NOW)).toBe("expired");
  });

  it("เหลือ ≤ 1 วัน → dueSoon (เส้นแบ่ง 24 ชม.เป๊ะยังเป็น dueSoon)", () => {
    expect(inUseStatus(row({ dueAt: new Date(+NOW + IN_USE_SOON_MS).toISOString() }), NOW)).toBe("dueSoon");
    expect(inUseStatus(row({ dueAt: new Date(+NOW + 1).toISOString() }), NOW)).toBe("dueSoon");
  });

  it("เหลือเกิน 1 วัน → active", () => {
    expect(inUseStatus(row({ dueAt: new Date(+NOW + IN_USE_SOON_MS + 1).toISOString() }), NOW)).toBe("active");
  });
});

describe("sortInUse", () => {
  it("หมดอายุ(เกินนานสุดก่อน) → ใกล้ครบ → ปกติ → ไม่มีความถี่", () => {
    const rows = [
      row({ _id: "active", dueAt: new Date(+NOW + 5 * DAY).toISOString() }),
      row({ _id: "none", dueAt: null }),
      row({ _id: "expired-2", dueAt: new Date(+NOW - 1 * DAY).toISOString() }),
      row({ _id: "soon", dueAt: new Date(+NOW + 2 * 60 * 60 * 1000).toISOString() }),
      row({ _id: "expired-1", dueAt: new Date(+NOW - 9 * DAY).toISOString() }),
    ];
    expect(sortInUse(rows, NOW).map((r) => r._id)).toEqual([
      "expired-1", "expired-2", "soon", "active", "none",
    ]);
  });

  it("ไม่แก้ array ต้นฉบับ", () => {
    const rows = [row({ _id: "a", dueAt: null }), row({ _id: "b", dueAt: new Date(+NOW - DAY).toISOString() })];
    sortInUse(rows, NOW);
    expect(rows.map((r) => r._id)).toEqual(["a", "b"]);
  });
});

describe("canAcknowledge", () => {
  const expired = row({ dueAt: new Date(+NOW - DAY).toISOString() });

  it("เจ้าของ + หมดอายุแล้ว → กดได้ (ไม่สนตัวพิมพ์/ช่องว่าง)", () => {
    expect(canAcknowledge(expired, { email: " Owner@ICPLadda.com " }, NOW)).toBe(true);
  });

  it("คนอื่น / ยังไม่หมดอายุ / ไม่มี user / รายการไม่มีผู้เบิก → กดไม่ได้", () => {
    expect(canAcknowledge(expired, { email: "other@icpladda.com" }, NOW)).toBe(false);
    expect(canAcknowledge(row({ dueAt: new Date(+NOW + DAY).toISOString() }), { email: "owner@icpladda.com" }, NOW)).toBe(false);
    expect(canAcknowledge(expired, null, NOW)).toBe(false);
    expect(canAcknowledge(row({ dueAt: expired.dueAt, userEmail: "" }), { email: "owner@icpladda.com" }, NOW)).toBe(false);
  });
});

describe("dueDistanceLabel", () => {
  it("อธิบายระยะเวลาแบบไทย", () => {
    expect(dueDistanceLabel(new Date(+NOW + 2 * DAY).toISOString(), NOW)).toBe("อีก 2 วัน");
    expect(dueDistanceLabel(new Date(+NOW + 3 * 60 * 60 * 1000).toISOString(), NOW)).toBe("ภายในวันนี้");
    expect(dueDistanceLabel(new Date(+NOW - 3 * 60 * 60 * 1000).toISOString(), NOW)).toBe("เกินกำหนดวันนี้");
    expect(dueDistanceLabel(new Date(+NOW - 3 * DAY).toISOString(), NOW)).toBe("เกิน 3 วัน");
    expect(dueDistanceLabel(null, NOW)).toBe("-");
  });
});

describe("planInUseNotifications", () => {
  const expired = row({ _id: "tx-exp", itemName: "ATRAZINE", dueAt: new Date(+NOW - DAY).toISOString() });
  const soon = row({ _id: "tx-soon", itemName: "DIURON", dueAt: new Date(+NOW + 2 * 60 * 60 * 1000).toISOString() });
  const calm = row({ _id: "tx-ok", dueAt: new Date(+NOW + 9 * DAY).toISOString() });
  const none = row({ _id: "tx-none", dueAt: null });

  it("push เฉพาะ dueSoon/expired พร้อม id, level และข้อความ", () => {
    const plan = planInUseNotifications([expired, soon, calm, none], NOW, []);
    expect(plan.push.map((n) => n.id)).toEqual(["std-inuse:tx-exp:expired", "std-inuse:tx-soon:soon"]);
    expect(plan.push[0].level).toBe("error");
    expect(plan.push[0].title).toBe("หมดอายุแล้ว: ATRAZINE");
    expect(plan.push[1].level).toBe("warning");
    expect(plan.push[1].title).toBe("ใกล้ครบกำหนด: DIURON");
    expect(plan.push[0].message).toContain("สมชาย");
    expect(plan.dismiss).toEqual([]);
  });

  it("ลบ id ของแท็บนี้ที่ไม่อยู่ในรอบนี้แล้ว (เช่นถูกกดรับทราบ) แต่ไม่แตะกลุ่มอื่น", () => {
    const plan = planInUseNotifications([expired], NOW, [
      "std-inuse:tx-gone:expired",
      "std-inuse:tx-exp:expired",
      "petition:abc",
    ]);
    expect(plan.dismiss).toEqual(["std-inuse:tx-gone:expired"]);
  });

  it("แถวเดิมที่เลื่อนจาก soon เป็น expired → ลบ id soon ทิ้ง", () => {
    const plan = planInUseNotifications([expired], NOW, ["std-inuse:tx-exp:soon"]);
    expect(plan.push.map((n) => n.id)).toEqual(["std-inuse:tx-exp:expired"]);
    expect(plan.dismiss).toEqual(["std-inuse:tx-exp:soon"]);
  });
});
