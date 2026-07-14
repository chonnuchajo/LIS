import { describe, expect, it } from "vitest";
import { solveFitScale } from "./printFit";

describe("solveFitScale", () => {
  it("ไม่ย่อเมื่อเนื้อหาพอดีกรอบอยู่แล้ว", () => {
    expect(solveFitScale({ boxHeight: 1077, measureHeight: () => 900 })).toBe(1);
    expect(solveFitScale({ boxHeight: 1077, measureHeight: () => 1077 })).toBe(1);
  });

  it("ไม่ย่อเมื่อวัดขนาดไม่ได้ (jsdom / ยังไม่ layout)", () => {
    expect(solveFitScale({ boxHeight: 0, measureHeight: () => 1353 })).toBe(1);
    expect(solveFitScale({ boxHeight: 1077, measureHeight: () => 0 })).toBe(1);
    expect(solveFitScale({ boxHeight: 1077, measureHeight: () => Number.NaN })).toBe(1);
  });

  it("ย่อตามสัดส่วนเมื่อเนื้อหาไม่เตี้ยลงตอนกล่องกว้างขึ้น", () => {
    expect(solveFitScale({ boxHeight: 800, measureHeight: () => 1000 })).toBeCloseTo(0.8, 2);
  });

  it("ย่อน้อยลงเมื่อเนื้อหาเตี้ยลงจากการ reflow ที่ความกว้างมากขึ้น", () => {
    // เนื้อหา layout ที่ความกว้าง 1/scale — ยิ่ง scale เล็ก กล่องยิ่งกว้าง ข้อความยิ่งตัดบรรทัดน้อยลง
    const measureHeight = (scale: number) => (scale <= 0.8 ? 700 : 1000);

    // ถ้าวัดรอบเดียวที่ scale 1 จะได้ 600/1000 = 0.6 ซึ่งย่อเกินจำเป็น
    expect(solveFitScale({ boxHeight: 600, measureHeight })).toBeCloseTo(0.8, 2);
  });

  it("ย่อได้ไม่เกิน minScale เพื่อไม่ให้ตัวอักษรเล็กจนอ่านไม่ออก", () => {
    expect(solveFitScale({ boxHeight: 1000, measureHeight: () => 4000 })).toBe(0.5);
    expect(solveFitScale({ boxHeight: 1000, measureHeight: () => 4000, minScale: 0.75 })).toBe(0.75);
  });
});
