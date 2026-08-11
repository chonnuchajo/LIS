import { describe, it, expect } from "vitest";
import {
  parseScannedQrId,
  unitDerivedStatus,
  visibleBottles,
} from "./stockUnit";
import type { StockUnitItem } from "@/types/stock";

describe("parseScannedQrId", () => {
  it("plain id", () => expect(parseScannedQrId("u_abc123")).toBe("u_abc123"));
  it("from URL path", () =>
    expect(parseScannedQrId("https://x.com/LIS/stock/scan/u_abc123")).toBe("u_abc123"));
  it("from stock deduction URL query", () =>
    expect(parseScannedQrId("https://app-plant.icpladda.com/LIS/stock-deduction?qrId=u_abc123")).toBe("u_abc123"));
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

describe("visibleBottles", () => {
  it("drops discarded, keeps order by receivedDate", () => {
    const rows = visibleBottles([
      { _id: "b", status: "active", receivedDate: "2026-02-01" },
      { _id: "a", status: "active", receivedDate: "2026-01-01" },
      { _id: "d", status: "discarded", receivedDate: "2026-01-15" },
    ] as unknown as StockUnitItem[]);
    expect(rows.map((u) => u._id)).toEqual(["a", "b"]);
  });
});
