import { describe, expect, it } from "vitest";
import { crosshairAt, formatCrosshairTime } from "@/lib/petitionTimelineCrosshair";

// ราง (แถบ tick) กว้าง 400px เริ่มที่ x=100 → แกนเวลา 08:00–12:00 ของ 15 ก.ค. 2026
const TRACK = { left: 100, width: 400 };
const START = new Date(2026, 6, 15, 8, 0).toISOString();
const END = new Date(2026, 6, 15, 12, 0).toISOString();

describe("crosshairAt", () => {
  it("กลางราง = กึ่งกลางช่วงเวลา", () => {
    const point = crosshairAt(300, TRACK, START, END);
    expect(point?.percent).toBe(50);
    expect(point?.at.getHours()).toBe(10);
    expect(point?.at.getMinutes()).toBe(0);
  });

  it("ขอบซ้าย/ขอบขวาของราง = เวลาเริ่ม/เวลาจบพอดี", () => {
    expect(crosshairAt(100, TRACK, START, END)?.at.toISOString()).toBe(START);
    expect(crosshairAt(500, TRACK, START, END)?.percent).toBe(100);
    expect(crosshairAt(500, TRACK, START, END)?.at.toISOString()).toBe(END);
  });

  it("เมาส์อยู่นอกราง (ซ้าย/ขวา) คืน null — ฝั่งซ้ายคือคอลัมน์ชื่อด่าน ไม่ใช่แกนเวลา", () => {
    expect(crosshairAt(99, TRACK, START, END)).toBeNull();
    expect(crosshairAt(501, TRACK, START, END)).toBeNull();
  });

  it("รางกว้าง 0 คืน null", () => {
    expect(crosshairAt(100, { left: 100, width: 0 }, START, END)).toBeNull();
  });

  it("แกนกลับหัวหรือความกว้างเวลาเป็นศูนย์ คืน null", () => {
    expect(crosshairAt(300, TRACK, END, START)).toBeNull();
    expect(crosshairAt(300, TRACK, START, START)).toBeNull();
  });

  it("วันที่ไม่ valid คืน null", () => {
    expect(crosshairAt(300, TRACK, "ไม่ใช่วันที่", END)).toBeNull();
    expect(crosshairAt(300, TRACK, START, "")).toBeNull();
  });
});

describe("formatCrosshairTime", () => {
  it("ได้รูปแบบ วัน + เดือนย่อไทย + เวลา 24 ชม.", () => {
    expect(formatCrosshairTime(new Date(2026, 6, 15, 10, 47))).toBe("15 ก.ค. 10:47");
  });

  it("เติมศูนย์หน้าชั่วโมง/นาทีหลักเดียว", () => {
    expect(formatCrosshairTime(new Date(2026, 6, 5, 9, 5))).toBe("5 ก.ค. 09:05");
  });
});
