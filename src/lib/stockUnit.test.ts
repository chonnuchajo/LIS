import { describe, it, expect } from "vitest";
import {
  addShelfLife,
  computeWorkingExp,
  nextMidnight,
  workingExpForWithdraw,
  parseScannedQrId,
  unitDerivedStatus,
  summarizeUnits,
  buildUnitTree,
  computeWorkingLifecycle,
  workingUsability,
  pickFefoSealed,
  visibleBottles,
} from "./stockUnit";
import type { StockUnitItem } from "@/types/stock";

function mk(p: Partial<StockUnitItem> & { _id: string }): StockUnitItem {
  return {
    qrId: "qr_" + p._id,
    itemCode: "C1",
    itemName: "Std",
    kind: "sealed",
    volume: { initial: 50, remaining: 50, unit: "ml" },
    status: "active",
    ...p,
  };
}

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

describe("nextMidnight", () => {
  it("คืนเที่ยงคืน 00:00 ของวันถัดจากวันที่เบิก", () => {
    expect(nextMidnight(new Date(2026, 5, 8, 14, 30, 15))).toEqual(new Date(2026, 5, 9, 0, 0, 0, 0));
  });
  it("เบิกตอนเที่ยงคืนพอดี → เที่ยงคืนวันถัดไป", () => {
    expect(nextMidnight(new Date(2026, 5, 8, 0, 0, 0))).toEqual(new Date(2026, 5, 9, 0, 0, 0, 0));
  });
});

describe("workingExpForWithdraw", () => {
  it("ไม่มีความถี่ → เที่ยงคืนของวันที่เบิก", () => {
    const exp = workingExpForWithdraw({
      withdrawnAt: new Date(2026, 5, 8, 14, 0),
      frequency: "",
      shelf: { value: 0, unit: "day" },
      parentExp: null,
    });
    expect(exp).toEqual(new Date(2026, 5, 9, 0, 0, 0, 0));
  });
  it("frequency เป็นช่องว่างล้วน → ถือว่าไม่มีความถี่ → เที่ยงคืน", () => {
    const exp = workingExpForWithdraw({
      withdrawnAt: new Date(2026, 5, 8, 9, 0),
      frequency: "   ",
      shelf: { value: 0, unit: "day" },
      parentExp: null,
    });
    expect(exp).toEqual(new Date(2026, 5, 9, 0, 0, 0, 0));
  });
  it("มีความถี่ → วันเบิก + openShelfLife (เหมือน computeWorkingExp)", () => {
    const exp = workingExpForWithdraw({
      withdrawnAt: new Date("2026-01-01"),
      frequency: "1/1 Week",
      shelf: { value: 7, unit: "day" },
      parentExp: null,
    });
    expect(exp).toEqual(new Date("2026-01-08"));
  });
  it("ไม่มีความถี่ แต่เที่ยงคืนเกิน EXP แม่ → cap ที่ EXP แม่", () => {
    const parentExp = new Date(2026, 5, 8, 18, 0);
    const exp = workingExpForWithdraw({
      withdrawnAt: new Date(2026, 5, 8, 14, 0),
      frequency: "",
      shelf: { value: 0, unit: "day" },
      parentExp,
    });
    expect(exp).toEqual(parentExp);
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

describe("buildUnitTree", () => {
  it("sealed ล้วน → root เลข 1,2,3 ไม่มีลูก", () => {
    const rows = buildUnitTree([
      mk({ _id: "a" }),
      mk({ _id: "b" }),
      mk({ _id: "c" }),
    ]);
    expect(rows.map((r) => r.label)).toEqual(["1", "2", "3"]);
    expect(rows.every((r) => r.depth === 0 && !r.hasChildren)).toBe(true);
  });

  it("working ลูกซ้อนใต้ ref เป็น 1.1/1.2 เรียงตามเวลาแบ่ง", () => {
    const rows = buildUnitTree([
      mk({ _id: "p1" }),
      mk({ _id: "w2", kind: "working", parentId: "p1", withdrawnDate: "2026-06-02" }),
      mk({ _id: "w1", kind: "working", parentId: "p1", withdrawnDate: "2026-06-01" }),
      mk({ _id: "p2" }),
    ]);
    expect(rows.map((r) => r.label)).toEqual(["1", "1.1", "1.2", "2"]);
    expect(rows.map((r) => r.unit._id)).toEqual(["p1", "w1", "w2", "p2"]);
    const root = rows.find((r) => r.label === "1")!;
    expect(root.hasChildren).toBe(true);
    const child = rows.find((r) => r.label === "1.1")!;
    expect(child.depth).toBe(1);
    expect(child.rootId).toBe("p1");
  });

  it("กรอง discarded ออก และ working ที่พ่อหายกลายเป็น orphan root ต่อท้าย", () => {
    const rows = buildUnitTree([
      mk({ _id: "p1" }),
      mk({ _id: "pd", status: "discarded" }),
      mk({ _id: "worphan", kind: "working", parentId: "pd" }),
    ]);
    expect(rows.map((r) => r.label)).toEqual(["1", "2"]);
    const orphan = rows.find((r) => r.unit._id === "worphan")!;
    expect(orphan.depth).toBe(0);
    expect(orphan.hasChildren).toBe(false);
  });
});

describe("computeWorkingLifecycle", () => {
  it("exp = withdraw + shelf, frequencyDue = withdraw + frequency", () => {
    const r = computeWorkingLifecycle({
      withdrawnAt: new Date("2026-01-01"), frequency: "1/1 week",
      shelf: { value: 30, unit: "day" }, parentExp: new Date("2026-12-31"),
    });
    expect(r.exp).toEqual(new Date("2026-01-31"));
    expect(r.frequencyDue).toEqual(new Date("2026-01-08"));
  });
  it("no frequency → frequencyDue null", () => {
    const r = computeWorkingLifecycle({
      withdrawnAt: new Date("2026-01-01"), frequency: "", shelf: { value: 30, unit: "day" }, parentExp: null,
    });
    expect(r.frequencyDue).toBeNull();
  });
  it("shelf 0 → exp = parentExp", () => {
    const r = computeWorkingLifecycle({
      withdrawnAt: new Date("2026-01-01"), frequency: "1/1 week", shelf: { value: 0, unit: "day" }, parentExp: new Date("2026-06-30"),
    });
    expect(r.exp).toEqual(new Date("2026-06-30"));
  });
  it("caps exp at parentExp when shelf pushes past it", () => {
    const r = computeWorkingLifecycle({
      withdrawnAt: new Date("2026-01-01"), frequency: "", shelf: { value: 300, unit: "day" }, parentExp: new Date("2026-02-01"),
    });
    expect(r.exp).toEqual(new Date("2026-02-01"));
  });
  it("caps frequencyDue at parentExp when interval pushes past it", () => {
    const r = computeWorkingLifecycle({
      withdrawnAt: new Date("2026-01-01"), frequency: "1/6 month", shelf: { value: 5, unit: "day" }, parentExp: new Date("2026-02-01"),
    });
    expect(r.frequencyDue).toEqual(new Date("2026-02-01"));
  });
});

describe("workingUsability", () => {
  const now = new Date("2026-06-15");
  it("active when before both", () => {
    expect(workingUsability({ status: "active", exp: "2026-07-01", frequencyDue: "2026-06-20" }, now)).toBe("active");
  });
  it("freqDue when past frequencyDue but before exp", () => {
    expect(workingUsability({ status: "active", exp: "2026-07-01", frequencyDue: "2026-06-10" }, now)).toBe("freqDue");
  });
  it("expired takes priority over freqDue", () => {
    expect(workingUsability({ status: "active", exp: "2026-06-01", frequencyDue: "2026-06-10" }, now)).toBe("expired");
  });
  it("no frequencyDue → governed by exp only", () => {
    expect(workingUsability({ status: "active", exp: "2026-07-01", frequencyDue: null }, now)).toBe("active");
  });
  it("discarded/empty short-circuit", () => {
    expect(workingUsability({ status: "discarded" }, now)).toBe("discarded");
    expect(workingUsability({ status: "empty" }, now)).toBe("empty");
  });
});

describe("pickFefoSealed", () => {
  it("picks earliest-exp active sealed, ignores working/expired/discarded", () => {
    const units = [
      mk({ _id: "s1", kind: "sealed", exp: "2026-12-31" }),
      mk({ _id: "s2", kind: "sealed", exp: "2026-03-01" }),
      mk({ _id: "w1", kind: "working", exp: "2026-01-01" }),
      mk({ _id: "s3", kind: "sealed", status: "discarded", exp: "2026-02-01" }),
    ];
    expect(pickFefoSealed(units, new Date("2026-01-01"))?._id).toBe("s2");
  });
  it("returns null when no active sealed", () => {
    expect(pickFefoSealed([mk({ _id: "w1", kind: "working" })], new Date("2026-01-01"))).toBeNull();
  });
  it("ignores an expired sealed bottle even if its exp is earliest", () => {
    const units = [
      mk({ _id: "s1", kind: "sealed", exp: "2026-06-01" }),
      mk({ _id: "sx", kind: "sealed", exp: "2025-01-01" }), // expired relative to `now` below
    ];
    expect(pickFefoSealed(units, new Date("2026-01-01"))?._id).toBe("s1");
  });
});

describe("visibleBottles", () => {
  it("drops discarded, keeps order by receivedDate", () => {
    const rows = visibleBottles([
      { _id: "b", status: "active", receivedDate: "2026-02-01" } as any,
      { _id: "a", status: "active", receivedDate: "2026-01-01" } as any,
      { _id: "d", status: "discarded", receivedDate: "2026-01-15" } as any,
    ]);
    expect(rows.map((u) => u._id)).toEqual(["a", "b"]);
  });
});
