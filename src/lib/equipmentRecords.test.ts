import { describe, it, expect } from "vitest";
import { filterEquipmentRecords } from "./equipmentRecords";
import type { EquipmentCheckRecord } from "./api";

const rec = (over: Partial<EquipmentCheckRecord>): EquipmentCheckRecord => ({
  roomSlug: "analysis",
  instrumentId: "LD-003",
  instrumentName: "GC 7890A",
  status: "normal",
  readings: [],
  recorder: "tester",
  date: "2026-06-05",
  checkedAt: "2026-06-05T03:00:00.000Z",
  ...over,
});

const data: EquipmentCheckRecord[] = [
  rec({ roomSlug: "analysis", instrumentId: "LD-003", status: "normal" }),
  rec({ roomSlug: "analysis", instrumentId: "LD-044", status: "abnormal" }),
  rec({ roomSlug: "extraction", instrumentId: "LD-020", status: "normal" }),
];

describe("filterEquipmentRecords", () => {
  it("returns all rows when every filter is 'all'", () => {
    expect(filterEquipmentRecords(data, { room: "all", instrumentId: "all", status: "all" }))
      .toHaveLength(3);
  });

  it("returns all rows when filters are undefined", () => {
    expect(filterEquipmentRecords(data, {})).toHaveLength(3);
  });

  it("filters by room", () => {
    const out = filterEquipmentRecords(data, { room: "analysis" });
    expect(out).toHaveLength(2);
    expect(out.every((r) => r.roomSlug === "analysis")).toBe(true);
  });

  it("filters by instrumentId", () => {
    const out = filterEquipmentRecords(data, { instrumentId: "LD-020" });
    expect(out).toHaveLength(1);
    expect(out[0].roomSlug).toBe("extraction");
  });

  it("filters by status", () => {
    const out = filterEquipmentRecords(data, { status: "abnormal" });
    expect(out).toHaveLength(1);
    expect(out[0].instrumentId).toBe("LD-044");
  });

  it("combines room + status", () => {
    const out = filterEquipmentRecords(data, { room: "analysis", status: "normal" });
    expect(out).toHaveLength(1);
    expect(out[0].instrumentId).toBe("LD-003");
  });

  it("does not mutate the input array", () => {
    const copy = [...data];
    filterEquipmentRecords(data, { room: "analysis" });
    expect(data).toEqual(copy);
  });
});
