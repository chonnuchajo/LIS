import { describe, it, expect } from "vitest";
import {
  levelFromQty,
  levelFromUnits,
  LOW_STD_QTY,
  LOW_SOL_QTY,
  LOW_GLASS_QTY,
} from "./stockReceive";

describe("levelFromQty", () => {
  it("คืน out เมื่อ qty <= 0", () => {
    expect(levelFromQty(0, LOW_SOL_QTY)).toBe("out");
    expect(levelFromQty(-1, LOW_SOL_QTY)).toBe("out");
  });
  it("คืน low เมื่อ 0 < qty < threshold", () => {
    expect(levelFromQty(1, LOW_SOL_QTY)).toBe("low"); // threshold 3
    expect(levelFromQty(2, LOW_SOL_QTY)).toBe("low");
  });
  it("คืน ok เมื่อ qty >= threshold", () => {
    expect(levelFromQty(3, LOW_SOL_QTY)).toBe("ok");
    expect(levelFromQty(10, LOW_GLASS_QTY)).toBe("ok");
  });
});

describe("levelFromUnits", () => {
  it("คืน out เมื่อ sealed+working === 0", () => {
    expect(levelFromUnits({ sealed: 0, working: 0, expiringSoon: 0, expired: 2 }, LOW_STD_QTY)).toBe("out");
  });
  it("คืน low เมื่อ active <= threshold", () => {
    expect(levelFromUnits({ sealed: 1, working: 0, expiringSoon: 0, expired: 0 }, LOW_STD_QTY)).toBe("low");
  });
  it("คืน ok เมื่อ active > threshold", () => {
    expect(levelFromUnits({ sealed: 2, working: 1, expiringSoon: 0, expired: 0 }, LOW_STD_QTY)).toBe("ok");
  });
});

describe("constants", () => {
  it("คงค่าเดิมตาม Stock.tsx", () => {
    expect(LOW_STD_QTY).toBe(1);
    expect(LOW_SOL_QTY).toBe(3);
    expect(LOW_GLASS_QTY).toBe(5);
  });
});
