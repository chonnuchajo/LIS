import { describe, it, expect } from "vitest";
import {
  isUsableBottle, usableBottleCount, standardLevel, solventLevel, glasswareLevel, summarizeStandard,
  standardMatchesStatuses, getStandardAlertSummary, type StandardStatus,
} from "./stockStatus";

const now = new Date("2026-07-07T00:00:00Z");
const mk = (o: Partial<{
  status: string;
  exp: string | null;
  volume: { remaining?: number | null };
  labelCode: string;
  lotNo: string;
}>) => ({ status: "active", exp: null, ...o });

describe("isUsableBottle", () => {
  it("active + no exp is usable", () => expect(isUsableBottle(mk({}), now)).toBe(true));
  it("active + future exp is usable", () => expect(isUsableBottle(mk({ exp: "2026-08-01" }), now)).toBe(true));
  it("expired is not usable", () => expect(isUsableBottle(mk({ exp: "2026-06-01" }), now)).toBe(false));
  it("empty/discarded not usable", () => {
    expect(isUsableBottle(mk({ status: "empty" }), now)).toBe(false);
    expect(isUsableBottle(mk({ status: "discarded" }), now)).toBe(false);
  });
  it("remaining zero is not usable", () => expect(isUsableBottle(mk({ volume: { remaining: 0 } }), now)).toBe(false));
});

describe("usableBottleCount", () => {
  it("counts only usable bottles across all", () => {
    const n = usableBottleCount(
      [mk({}), mk({ status: "empty" }), mk({ exp: "2026-06-01" }), mk({ exp: "2026-09-01" })],
      now,
    );
    expect(n).toBe(2);
  });
});

describe("standardLevel", () => {
  it("0 out, 1 low, 2+ ok", () => {
    expect(standardLevel(0)).toBe("out");
    expect(standardLevel(1)).toBe("low");
    expect(standardLevel(2)).toBe("ok");
  });
});

describe("solventLevel", () => {
  it("0 out, 1 low, 2+ ok", () => {
    expect(solventLevel(0)).toBe("out");
    expect(solventLevel(1)).toBe("low");
    expect(solventLevel(5)).toBe("ok");
  });
});

describe("glasswareLevel", () => {
  it("0 out, else ok (no low)", () => {
    expect(glasswareLevel(0)).toBe("out");
    expect(glasswareLevel(1)).toBe("ok");
    expect(glasswareLevel(99)).toBe("ok");
  });
});

describe("summarizeStandard", () => {
  it("counts usable / expired / expiringSoon", () => {
    const s = summarizeStandard(
      [mk({}), mk({ exp: "2026-07-20" }), mk({ exp: "2026-06-01" }), mk({ status: "discarded" }), mk({ volume: { remaining: 0 } })],
      now, 30,
    );
    expect(s).toEqual({ usable: 2, expired: 1, expiringSoon: 1 });
  });
});

describe("standardMatchesStatuses", () => {
  const S = (...xs: StandardStatus[]) => new Set(xs);
  const sum = (usable: number, expired = 0, expiringSoon = 0) => ({ usable, expired, expiringSoon });

  it("empty set matches everything", () => {
    expect(standardMatchesStatuses(sum(0), S())).toBe(true);
    expect(standardMatchesStatuses(sum(5, 2, 1), S())).toBe(true);
  });

  it("ok requires level ok AND no expiry issues", () => {
    expect(standardMatchesStatuses(sum(2), S("ok"))).toBe(true);
    expect(standardMatchesStatuses(sum(2, 1, 0), S("ok"))).toBe(false);
    expect(standardMatchesStatuses(sum(2, 0, 1), S("ok"))).toBe(false);
    expect(standardMatchesStatuses(sum(1), S("ok"))).toBe(false); // low ไม่ใช่ ok
  });

  it("out / low match by usable level", () => {
    expect(standardMatchesStatuses(sum(0), S("out"))).toBe(true);
    expect(standardMatchesStatuses(sum(1), S("out"))).toBe(false);
    expect(standardMatchesStatuses(sum(1), S("low"))).toBe(true);
    expect(standardMatchesStatuses(sum(2), S("low"))).toBe(false);
  });

  it("expired / soon match by counts", () => {
    expect(standardMatchesStatuses(sum(2, 1, 0), S("expired"))).toBe(true);
    expect(standardMatchesStatuses(sum(2, 0, 0), S("expired"))).toBe(false);
    expect(standardMatchesStatuses(sum(2, 0, 3), S("soon"))).toBe(true);
    expect(standardMatchesStatuses(sum(2, 0, 0), S("soon"))).toBe(false);
  });

  it("union: matches if ANY selected status matches", () => {
    expect(standardMatchesStatuses(sum(2, 0, 1), S("expired", "soon"))).toBe(true);
    expect(standardMatchesStatuses(sum(2, 0, 0), S("expired", "soon"))).toBe(false);
    expect(standardMatchesStatuses(sum(0), S("ok", "out"))).toBe(true);
  });

  it("expiringSoon summary fails ok but passes ok+soon union", () => {
    const s = sum(2, 0, 1);
    expect(standardMatchesStatuses(s, S("ok"))).toBe(false);
    expect(standardMatchesStatuses(s, S("ok", "soon"))).toBe(true);
  });
});

describe("getStandardAlertSummary", () => {
  it("ไม่สร้าง alert ถ้าแค่เหลือ 1 ขวด แต่ไม่มีขวดหมดอายุหรือใกล้หมดอายุ", () => {
    expect(getStandardAlertSummary({ usable: 1, expired: 0, expiringSoon: 0 })).toBeNull();
  });

  it("สร้าง alert ถ้าเหลือ 0 ขวด แม้ไม่มีขวดหมดอายุหรือใกล้หมดอายุ", () => {
    expect(getStandardAlertSummary({ usable: 0, expired: 0, expiringSoon: 0 })).toEqual({
      lowStock: true,
      expired: false,
      expiringSoon: false,
      severity: "destructive",
      message: "หมด เหลือรวม 0 ขวด",
    });
  });

  it("รวม low stock และ near expiry ของ standard เดียวกันเป็น alert เดียว", () => {
    const alert = getStandardAlertSummary({ usable: 1, expired: 0, expiringSoon: 1 });

    expect(alert).toEqual({
      lowStock: true,
      expired: false,
      expiringSoon: true,
      severity: "destructive",
      message: "ใกล้หมด เหลือรวม 1 ขวด / ใกล้หมดอายุ 1 ขวด",
    });
  });

  it("แจ้งเตือนหมดอายุระบุขวดที่หมดด้วย label, lot และวันหมดอายุ", () => {
    const units = [
      mk({ labelCode: "STD-EXP-01", lotNo: "LOT-A", exp: "2026-06-01" }),
      mk({ labelCode: "STD-OK-01", lotNo: "LOT-B", exp: "2026-08-01" }),
    ];
    const summary = summarizeStandard(units, now, 30);

    const alert = getStandardAlertSummary(summary, { units, now });

    expect(alert?.message).toContain("หมดอายุ 1 ขวด: STD-EXP-01 · Lot LOT-A · EXP 01/06/2569");
  });
});
