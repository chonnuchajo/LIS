import { describe, expect, it } from "vitest";
import { deductionAmount } from "./stockDeduction";

describe("deductionAmount", () => {
  it("ใช้ delta (solvent/glassware/ขวด standard) — โชว์ค่าบวก + หน่วย", () => {
    expect(deductionAmount({ delta: -2, unit: "bottle" })).toEqual({ text: "2 bottle" });
  });

  it("fallback เป็น volumeDelta เมื่อ delta ว่าง (เบิก mg รายน้ำหนัก)", () => {
    expect(deductionAmount({ delta: null, volumeDelta: -45, unit: "mg" })).toEqual({ text: "45 mg" });
  });

  it("ปัดเศษ volumeDelta ให้เหลือไม่เกิน 2 ตำแหน่ง", () => {
    expect(deductionAmount({ delta: null, volumeDelta: -7031.519999999998, unit: "mg" })).toEqual({ text: "7031.52 mg" });
  });

  it("มี weights หลายค่า → sub แจกแจงรายน้ำหนัก", () => {
    expect(deductionAmount({ volumeDelta: -45, unit: "mg", weights: [15, 15, 15] })).toEqual({
      text: "45 mg",
      sub: "15 + 15 + 15",
    });
  });

  it("weights ค่าเดียว → ไม่ต้องมี sub (ซ้ำกับ text)", () => {
    expect(deductionAmount({ volumeDelta: -20, unit: "mg", weights: [20] })).toEqual({ text: "20 mg" });
  });

  it("ไม่มีทั้ง delta และ volumeDelta → '-'", () => {
    expect(deductionAmount({ unit: "mg" })).toEqual({ text: "-" });
  });

  it("ไม่มีหน่วย → เลขล้วนไม่มีช่องว่างท้าย", () => {
    expect(deductionAmount({ delta: -3 })).toEqual({ text: "3" });
  });
});
