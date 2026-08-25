import { describe, expect, it } from "vitest";
import { isExpiringSoon, API_POLICY_MODE_LABEL, API_KEY_STATUS_LABEL } from "./apiKeys";

const NOW = new Date("2026-08-06T10:00:00Z");

describe("isExpiringSoon", () => {
  it("ไม่ตั้งวันหมดอายุ → ไม่เตือน", () => {
    expect(isExpiringSoon(null, NOW)).toBe(false);
  });

  it("เหลือ 3 วัน → เตือน", () => {
    expect(isExpiringSoon("2026-08-09T10:00:00Z", NOW)).toBe(true);
  });

  it("เหลือ 10 วัน → ยังไม่เตือน", () => {
    expect(isExpiringSoon("2026-08-16T10:00:00Z", NOW)).toBe(false);
  });

  it("หมดอายุไปแล้ว → ไม่ใช่ 'ใกล้หมดอายุ' (สถานะเป็น expired ไปแล้ว)", () => {
    expect(isExpiringSoon("2026-08-01T10:00:00Z", NOW)).toBe(false);
  });

  it("ค่าที่แปลงเป็นวันที่ไม่ได้ → ไม่เตือน", () => {
    expect(isExpiringSoon("ไม่ใช่วันที่", NOW)).toBe(false);
  });
});

describe("label", () => {
  it("มีคำแปลไทยครบทุกโหมดและทุกสถานะ", () => {
    expect(Object.keys(API_POLICY_MODE_LABEL).sort()).toEqual(["audit", "enforce", "off"]);
    expect(Object.keys(API_KEY_STATUS_LABEL).sort()).toEqual(["active", "expired", "revoked"]);
  });
});
