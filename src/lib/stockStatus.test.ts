import { describe, it, expect } from "vitest";
import { parseExp, expiryStatus, qtyStatus } from "./stockStatus";

const DAY = 86400000;
// fixed "now" so tests are deterministic: 2026-06-01 12:00 local
const NOW = new Date(2026, 5, 1, 12, 0, 0).getTime();

describe("parseExp", () => {
  it("returns null for empty / dash / invalid", () => {
    expect(parseExp(undefined)).toBeNull();
    expect(parseExp("")).toBeNull();
    expect(parseExp("-")).toBeNull();
    expect(parseExp("not a date")).toBeNull();
  });

  it("parses dd/mm/yyyy and dd-mm-yyyy", () => {
    expect(parseExp("15/06/2026")).toBe(new Date(2026, 5, 15).getTime());
    expect(parseExp("15-06-2026")).toBe(new Date(2026, 5, 15).getTime());
  });

  it("parses yyyy-mm-dd", () => {
    expect(parseExp("2026-06-15")).toBe(new Date(2026, 5, 15).getTime());
  });
});

describe("expiryStatus", () => {
  it("returns 'none' when no/invalid date", () => {
    expect(expiryStatus(undefined, NOW)).toBe("none");
    expect(expiryStatus("-", NOW)).toBe("none");
  });

  it("returns 'expired' when the date is before today", () => {
    expect(expiryStatus("31/05/2026", NOW)).toBe("expired"); // yesterday
    expect(expiryStatus("01/01/2020", NOW)).toBe("expired"); // long past
  });

  it("treats the exp day itself as still valid (not expired)", () => {
    expect(expiryStatus("01/06/2026", NOW)).toBe("soon"); // expires today -> still soon, not expired
  });

  it("returns 'soon' within the warning window", () => {
    const in10Days = new Date(NOW + 10 * DAY);
    const s = `${in10Days.getDate()}/${in10Days.getMonth() + 1}/${in10Days.getFullYear()}`;
    expect(expiryStatus(s, NOW)).toBe("soon");
  });

  it("returns 'ok' well beyond the warning window", () => {
    expect(expiryStatus("01/06/2030", NOW)).toBe("ok");
  });
});

describe("qtyStatus", () => {
  it("returns 'out' when total is 0 or below", () => {
    expect(qtyStatus(0, 1)).toBe("out");
    expect(qtyStatus(-2, 1)).toBe("out");
  });

  it("returns 'low' when total is at or below the threshold but above 0", () => {
    expect(qtyStatus(1, 1)).toBe("low");
    expect(qtyStatus(2, 3)).toBe("low");
    expect(qtyStatus(3, 3)).toBe("low");
  });

  it("returns 'ok' when total is above the threshold", () => {
    expect(qtyStatus(2, 1)).toBe("ok");
    expect(qtyStatus(10, 3)).toBe("ok");
  });
});
