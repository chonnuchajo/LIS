import { describe, it, expect } from "vitest";
import {
  groupRequisitionsByInstrument,
  validateRequisitionQty,
  todayStr,
  type ChemicalRequisition,
} from "./chemicalRequisition";

const mk = (over: Partial<ChemicalRequisition>): ChemicalRequisition => ({
  _id: "x", date: "2026-07-03", roomSlug: "analysis",
  instrumentId: "LD-004", instrumentName: "GC 8890", itemType: "solvent",
  solventId: "s1", solventName: "Methanol", qty: 1, unit: "bottle",
  note: "", requestedBy: { email: "", name: "" }, ...over,
});

describe("groupRequisitionsByInstrument", () => {
  it("groups rows by instrumentId", () => {
    const g = groupRequisitionsByInstrument([
      mk({ instrumentId: "LD-004" }),
      mk({ instrumentId: "LD-004" }),
      mk({ instrumentId: "LD-003" }),
    ]);
    expect(g["LD-004"]).toHaveLength(2);
    expect(g["LD-003"]).toHaveLength(1);
    expect(g["LD-001"]).toBeUndefined();
  });
  it("empty input → empty map", () => {
    expect(groupRequisitionsByInstrument([])).toEqual({});
  });
});

describe("validateRequisitionQty", () => {
  it("ok within stock", () => expect(validateRequisitionQty(2, 5)).toBe(""));
  it("ok exactly at stock", () => expect(validateRequisitionQty(5, 5)).toBe(""));
  it("requires a positive whole bottle count", () => {
    expect(validateRequisitionQty(0, 5)).toBe("จำนวนต้องเป็นจำนวนเต็มบวก");
    expect(validateRequisitionQty(-1, 5)).toBe("จำนวนต้องเป็นจำนวนเต็มบวก");
    expect(validateRequisitionQty(1.5, 5)).toBe("จำนวนต้องเป็นจำนวนเต็มบวก");
  });
  it("over stock", () => expect(validateRequisitionQty(6, 5)).toBe("จำนวน stock ไม่พอ"));
});

describe("todayStr", () => {
  it("formats YYYY-MM-DD", () => expect(todayStr(new Date(2026, 6, 3))).toBe("2026-07-03"));
});
