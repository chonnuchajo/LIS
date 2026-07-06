import { describe, it, expect } from "vitest";
import {
  STANDARD_STATUS,
  standardStatusMeta,
  isSameLocalDay,
  todayWorkingUnits,
  activeWorkingUnits,
  splitTimeLabel,
} from "./standardStatus";
import type { StockUnitItem } from "@/types/stock";

function mk(p: Partial<StockUnitItem> & { _id: string }): StockUnitItem {
  return {
    qrId: "qr_" + p._id,
    itemCode: "C1",
    itemName: "Std",
    kind: "working",
    volume: { initial: 10, remaining: 10, unit: "ml" },
    status: "active",
    ...p,
  };
}

describe("STANDARD_STATUS", () => {
  it("covers every WorkingUsability key", () => {
    for (const k of ["active", "freqDue", "expired", "empty", "discarded"] as const) {
      expect(STANDARD_STATUS[k]).toBeTruthy();
      expect(typeof STANDARD_STATUS[k].label).toBe("string");
      expect(typeof STANDARD_STATUS[k].cls).toBe("string");
    }
  });
  it("only active is usable", () => {
    expect(STANDARD_STATUS.active.usable).toBe(true);
    expect(STANDARD_STATUS.freqDue.usable).toBe(false);
    expect(STANDARD_STATUS.expired.usable).toBe(false);
    expect(STANDARD_STATUS.empty.usable).toBe(false);
    expect(STANDARD_STATUS.discarded.usable).toBe(false);
  });
  it("active label is พร้อมใช้งาน", () => {
    expect(STANDARD_STATUS.active.label).toBe("พร้อมใช้งาน");
  });
});

describe("standardStatusMeta", () => {
  it("maps an active working unit to the usable meta", () => {
    const meta = standardStatusMeta(mk({ _id: "1" }));
    expect(meta.usable).toBe(true);
    expect(meta.label).toBe("พร้อมใช้งาน");
  });
  it("maps a discarded unit to ทิ้งแล้ว", () => {
    const meta = standardStatusMeta(mk({ _id: "2", status: "discarded" }));
    expect(meta.usable).toBe(false);
    expect(meta.label).toBe("ทิ้งแล้ว");
  });
  it("maps an expired unit to หมดอายุ", () => {
    const meta = standardStatusMeta(mk({ _id: "3", exp: "2000-01-01" }));
    expect(meta.label).toBe("หมดอายุ");
  });
});

describe("isSameLocalDay", () => {
  const ref = new Date("2026-07-06T09:00:00");
  it("true for same local calendar day", () => {
    expect(isSameLocalDay("2026-07-06T08:10:00", ref)).toBe(true);
  });
  it("false for a different day", () => {
    expect(isSameLocalDay("2026-07-05T23:59:00", ref)).toBe(false);
  });
  it("false for null/undefined", () => {
    expect(isSameLocalDay(null, ref)).toBe(false);
    expect(isSameLocalDay(undefined, ref)).toBe(false);
  });
});

describe("todayWorkingUnits", () => {
  const now = new Date("2026-07-06T10:00:00");
  const units: StockUnitItem[] = [
    mk({ _id: "sealed", kind: "sealed", withdrawnDate: "2026-07-06T08:00:00" }),
    mk({ _id: "todayA", withdrawnDate: "2026-07-06T08:10:00" }),
    mk({ _id: "todayDiscarded", status: "discarded", withdrawnDate: "2026-07-06T08:20:00" }),
    mk({ _id: "yesterday", withdrawnDate: "2026-07-05T08:10:00" }),
    mk({ _id: "byCreatedAt", withdrawnDate: null, createdAt: "2026-07-06T09:00:00" }),
  ];

  it("keeps only working units withdrawn/created today (incl. discarded)", () => {
    const rows = todayWorkingUnits(units, now);
    const ids = rows.map((u) => u._id);
    expect(ids).toContain("todayA");
    expect(ids).toContain("todayDiscarded");
    expect(ids).toContain("byCreatedAt");
    expect(ids).not.toContain("sealed");
    expect(ids).not.toContain("yesterday");
  });

  it("sorts usable units before non-usable (discarded/empty) ones", () => {
    const rows = todayWorkingUnits(units, now);
    const firstDiscardedIdx = rows.findIndex((u) => u.status === "discarded");
    const lastUsableIdx = rows.reduce(
      (acc, u, i) => (standardStatusMeta(u).usable ? i : acc),
      -1,
    );
    expect(lastUsableIdx).toBeLessThan(firstDiscardedIdx);
  });
});

describe("activeWorkingUnits", () => {
  const now = new Date("2026-07-06T10:00:00");
  const units: StockUnitItem[] = [
    mk({ _id: "b", itemCode: "STD-2", itemName: "Benzene std" }),
    mk({ _id: "a", itemCode: "STD-10", itemName: "Acetone std" }),
    mk({ _id: "disc", itemCode: "STD-3", status: "discarded" }),
    mk({ _id: "sealed", itemCode: "STD-4", kind: "sealed" }),
    mk({ _id: "exp", itemCode: "STD-1", exp: "2000-01-01" }),
  ];

  it("drops discarded + non-working units", () => {
    const ids = activeWorkingUnits(units, {}, now).map((u) => u._id);
    expect(ids).not.toContain("disc");
    expect(ids).not.toContain("sealed");
    expect(ids).toContain("a");
    expect(ids).toContain("exp");
  });

  it("sorts by itemCode natural-numeric", () => {
    const codes = activeWorkingUnits(units, {}, now).map((u) => u.itemCode);
    expect(codes).toEqual(["STD-1", "STD-2", "STD-10"]);
  });

  it("searches name or code (case-insensitive)", () => {
    expect(activeWorkingUnits(units, { search: "acetone" }, now).map((u) => u._id)).toEqual(["a"]);
    expect(activeWorkingUnits(units, { search: "std-2" }, now).map((u) => u._id)).toEqual(["b"]);
  });

  it("statusFilter usable keeps only active; attention keeps the rest", () => {
    expect(activeWorkingUnits(units, { statusFilter: "usable" }, now).map((u) => u._id)).not.toContain("exp");
    expect(activeWorkingUnits(units, { statusFilter: "attention" }, now).map((u) => u._id)).toEqual(["exp"]);
  });
});

describe("splitTimeLabel", () => {
  const now = new Date("2026-07-06T10:00:00");
  it("today → 'แบ่งวันนี้ เวลา ...'", () => {
    expect(splitTimeLabel({ withdrawnDate: "2026-07-06T08:10:00" }, now)).toContain("แบ่งวันนี้");
  });
  it("other day → 'แบ่งเมื่อ ...'", () => {
    expect(splitTimeLabel({ withdrawnDate: "2026-07-01T08:10:00" }, now)).toContain("แบ่งเมื่อ");
  });
  it("falls back to createdAt, empty when no date", () => {
    expect(splitTimeLabel({ withdrawnDate: null, createdAt: "2026-07-06T09:00:00" }, now)).toContain("แบ่งวันนี้");
    expect(splitTimeLabel({ withdrawnDate: null }, now)).toBe("");
  });
});
