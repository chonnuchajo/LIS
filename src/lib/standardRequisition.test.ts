import { describe, it, expect } from "vitest";
import { defaultWeightCount, requisitionUser, sumWeights, validateWeights } from "./standardRequisition";

describe("defaultWeightCount", () => {
  it("gc → 3, hplc → 1, unknown → 1", () => {
    expect(defaultWeightCount("gc")).toBe(3);
    expect(defaultWeightCount("hplc")).toBe(1);
    expect(defaultWeightCount(undefined)).toBe(1);
  });
});

describe("sumWeights", () => {
  it("sums, ignoring NaN", () => {
    expect(sumWeights([9.8, 10.3, 10.1])).toBeCloseTo(30.2);
    expect(sumWeights([Number.NaN, 5])).toBe(5);
    expect(sumWeights([])).toBe(0);
  });
});

describe("requisitionUser", () => {
  it("map user → _user payload (email + name) ให้ backend ลง ผู้ดำเนินการ", () => {
    expect(requisitionUser({ email: "a@icpladda.com", name: "สมชาย" })).toEqual({
      email: "a@icpladda.com",
      name: "สมชาย",
    });
  });
  it("ไม่มี user (ยังไม่ login) → undefined ไม่ใช่ object ว่าง", () => {
    expect(requisitionUser(null)).toBeUndefined();
    expect(requisitionUser(undefined)).toBeUndefined();
  });
});

describe("validateWeights", () => {
  it("all weights must be > 0", () => {
    expect(validateWeights([0, 5], 100)).toBe("กรุณากรอก mg ทุกน้ำหนักให้มากกว่า 0");
    expect(validateWeights([], 100)).toBe("กรุณากรอก mg ทุกน้ำหนักให้มากกว่า 0");
  });
  it("total must not exceed remaining", () => {
    expect(validateWeights([60, 60], 100)).toBe("mg รวมเกินปริมาณคงเหลือของขวด");
  });
  it("ok returns empty string", () => {
    expect(validateWeights([10, 10, 10], 100)).toBe("");
  });
});
