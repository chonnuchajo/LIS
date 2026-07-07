import { describe, it, expect } from "vitest";
import { currentShift, greetForHour, SHIFT_SWITCH_HOUR } from "./dateShift";

describe("currentShift", () => {
  it("morning before 12:00 is กะเช้า, noon+ is กะบ่าย", () => {
    expect(currentShift(new Date(2026, 6, 6, 8, 0))).toBe("กะเช้า");
    expect(currentShift(new Date(2026, 6, 6, 11, 59))).toBe("กะเช้า");
    expect(currentShift(new Date(2026, 6, 6, 12, 0))).toBe("กะบ่าย");
    expect(currentShift(new Date(2026, 6, 6, 18, 0))).toBe("กะบ่าย");
  });
});

describe("greetForHour", () => {
  it("maps hour to Thai greeting", () => {
    expect(greetForHour(9)).toBe("อรุณสวัสดิ์");
    expect(greetForHour(14)).toBe("สวัสดีตอนบ่าย");
    expect(greetForHour(19)).toBe("สวัสดีตอนเย็น");
  });
  it("SHIFT_SWITCH_HOUR is noon", () => expect(SHIFT_SWITCH_HOUR).toBe(12));
});
