import { describe, expect, it } from "vitest";
import { formatStockQuantity, formatStockQuantityWithUnit } from "./stockQuantity";

describe("formatStockQuantity", () => {
  it("ปัดเศษ floating-point noise ให้เหลือไม่เกิน 2 ตำแหน่ง", () => {
    expect(formatStockQuantity(7031.519999999998)).toBe("7031.52");
  });

  it("ไม่เติม .00 ให้จำนวนเต็ม", () => {
    expect(formatStockQuantity(7430)).toBe("7430");
  });

  it("คืน '-' เมื่อไม่มีตัวเลขที่ใช้ได้", () => {
    expect(formatStockQuantity(null)).toBe("-");
    expect(formatStockQuantity(Number.NaN)).toBe("-");
  });
});

describe("formatStockQuantityWithUnit", () => {
  it("แสดงจำนวนพร้อมหน่วยหลังปัดเศษ", () => {
    expect(formatStockQuantityWithUnit(7031.519999999998, "mg")).toBe("7031.52 mg");
  });

  it("ไม่แสดงหน่วยเมื่อไม่มีจำนวน", () => {
    expect(formatStockQuantityWithUnit(null, "mg")).toBe("-");
  });
});
