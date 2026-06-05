import { describe, it, expect } from "vitest";
import {
  DAILY_CHECK_BASE,
  DAILY_CHECK_ROOMS,
  getRoomBySlug,
} from "./dailyCheckRooms";

describe("dailyCheckRooms", () => {
  it("defines exactly four rooms", () => {
    expect(DAILY_CHECK_ROOMS).toHaveLength(4);
  });

  it("has unique, non-empty slugs and labels", () => {
    const slugs = DAILY_CHECK_ROOMS.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const room of DAILY_CHECK_ROOMS) {
      expect(room.slug).not.toBe("");
      expect(room.label).not.toBe("");
    }
  });

  it("derives each route as the base plus the slug", () => {
    for (const room of DAILY_CHECK_ROOMS) {
      expect(room.route).toBe(`${DAILY_CHECK_BASE}/${room.slug}`);
    }
  });

  it("marks all four rooms as ready", () => {
    const ready = DAILY_CHECK_ROOMS.filter((r) => r.ready);
    expect(ready.map((r) => r.slug)).toEqual([
      "balance",
      "sample-prep",
      "analysis",
      "extraction",
    ]);
  });

  it("looks up a room by slug and returns undefined for unknown slugs", () => {
    expect(getRoomBySlug("balance")?.label).toBe("ห้องเครื่องชั่ง");
    expect(getRoomBySlug("nope")).toBeUndefined();
  });
});
