import { describe, it, expect } from "vitest";
import {
  addShelfLife,
  computeWorkingExp,
  parseScannedQrId,
  unitDerivedStatus,
  summarizeUnits,
} from "./stockUnit";

describe("addShelfLife", () => {
  it("adds days", () => {
    expect(addShelfLife(new Date("2026-01-01"), { value: 7, unit: "day" }))
      .toEqual(new Date("2026-01-08"));
  });
  it("adds weeks", () => {
    expect(addShelfLife(new Date("2026-01-01"), { value: 2, unit: "week" }))
      .toEqual(new Date("2026-01-15"));
  });
  it("adds months", () => {
    expect(addShelfLife(new Date("2026-01-15"), { value: 1, unit: "month" }))
      .toEqual(new Date("2026-02-15"));
  });
});

describe("computeWorkingExp", () => {
  it("withdraw + shelf when under parent exp", () => {
    const exp = computeWorkingExp(new Date("2026-01-01"), { value: 7, unit: "day" }, new Date("2026-12-31"));
    expect(exp).toEqual(new Date("2026-01-08"));
  });
  it("caps at parent exp when shelf exceeds it", () => {
    const exp = computeWorkingExp(new Date("2026-01-01"), { value: 1, unit: "month" }, new Date("2026-01-10"));
    expect(exp).toEqual(new Date("2026-01-10"));
  });
  it("no parent exp → just withdraw + shelf", () => {
    const exp = computeWorkingExp(new Date("2026-01-01"), { value: 3, unit: "day" }, null);
    expect(exp).toEqual(new Date("2026-01-04"));
  });
});

describe("parseScannedQrId", () => {
  it("plain id", () => expect(parseScannedQrId("u_abc123")).toBe("u_abc123"));
  it("from URL path", () =>
    expect(parseScannedQrId("https://x.com/LIS/stock/scan/u_abc123")).toBe("u_abc123"));
  it("from JSON payload", () =>
    expect(parseScannedQrId('{"qrId":"u_abc123"}')).toBe("u_abc123"));
  it("empty → empty", () => expect(parseScannedQrId("  ")).toBe(""));
});

describe("unitDerivedStatus", () => {
  const now = new Date("2026-06-06");
  it("discarded wins", () =>
    expect(unitDerivedStatus({ status: "discarded", exp: "2020-01-01" }, now)).toBe("discarded"));
  it("empty", () => expect(unitDerivedStatus({ status: "empty" }, now)).toBe("empty"));
  it("expired when exp past", () =>
    expect(unitDerivedStatus({ status: "active", exp: "2026-01-01" }, now)).toBe("expired"));
  it("active otherwise", () =>
    expect(unitDerivedStatus({ status: "active", exp: "2026-12-31" }, now)).toBe("active"));
});

describe("summarizeUnits", () => {
  const now = new Date("2026-06-06");
  it("counts sealed/working, skips discarded/empty, flags expired+soon", () => {
    const s = summarizeUnits([
      { kind: "sealed", status: "active", exp: "2026-12-31" },   // sealed
      { kind: "sealed", status: "active", exp: "2026-06-20" },   // sealed + soon
      { kind: "working", status: "active", exp: "2026-12-31" },  // working
      { kind: "sealed", status: "active", exp: "2026-01-01" },   // expired
      { kind: "sealed", status: "discarded", exp: "2026-12-31" },// skip
      { kind: "working", status: "empty", exp: "2026-12-31" },   // skip
    ], now, 30);
    expect(s).toEqual({ sealed: 2, working: 1, expiringSoon: 1, expired: 1 });
  });
});
