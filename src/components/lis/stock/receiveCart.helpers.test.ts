import { describe, it, expect } from "vitest";
import {
  makeEmptyRow,
  validateRow,
  buildBottles,
  composeSolventNote,
} from "./receiveCart.helpers";

describe("receiveCart.helpers", () => {
  it("makeEmptyRow คืนแถวว่าง category=null", () => {
    const r = makeEmptyRow();
    expect(r.category).toBeNull();
    expect(r.itemId).toBe("");
    expect(r.source).toBe("primary");
    expect(r.count).toBe("1");
    expect(r.qty).toBe("1");
    expect(r.sameExp).toBe(true);
  });

  it("validateRow: ยังไม่เลือกของ → error", () => {
    expect(validateRow(makeEmptyRow())).toBe("ยังไม่ได้เลือกของ");
  });

  it("validateRow: standard ต้องมี size>0, count เป็นจำนวนเต็มบวก, source", () => {
    const base = { ...makeEmptyRow(), category: "standard" as const, itemId: "s1" };
    expect(validateRow({ ...base, sizeMl: "0" })).toBe("ขนาด/ขวดไม่ถูกต้อง");
    expect(validateRow({ ...base, sizeMl: "100", count: "0" })).toBe("จำนวนขวดต้องเป็นจำนวนเต็มบวก");
    expect(validateRow({ ...base, sizeMl: "100", count: "2", source: "" as never })).toBe("ต้องเลือกที่มา");
    expect(validateRow({ ...base, sizeMl: "100", count: "2" })).toBeNull();
  });

  it("validateRow: solvent/glassware ต้อง qty เป็นจำนวนเต็มบวก", () => {
    const sol = { ...makeEmptyRow(), category: "solvent" as const, itemId: "x", qty: "0" };
    expect(validateRow(sol)).toBe("จำนวนต้องเป็นจำนวนเต็มบวก");
    expect(validateRow({ ...sol, qty: "3" })).toBeNull();
  });

  it("buildBottles: sameExp → ทุกขวด exp เดียวกัน", () => {
    const r = { ...makeEmptyRow(), count: "3", sameExp: true, commonExp: "2027-01-01" };
    expect(buildBottles(r)).toEqual([
      { exp: "2027-01-01" }, { exp: "2027-01-01" }, { exp: "2027-01-01" },
    ]);
  });

  it("buildBottles: sameExp + commonExp ว่าง → exp undefined", () => {
    const r = { ...makeEmptyRow(), count: "2", sameExp: true, commonExp: "" };
    expect(buildBottles(r)).toEqual([{ exp: undefined }, { exp: undefined }]);
  });

  it("buildBottles: per-bottle exp ตัดตามจำนวน", () => {
    const r = { ...makeEmptyRow(), count: "2", sameExp: false, perExp: ["2027-01-01", "2027-02-02", "x"] };
    expect(buildBottles(r)).toEqual([{ exp: "2027-01-01" }, { exp: "2027-02-02" }]);
  });

  it("composeSolventNote: รวม lot/exp/ขนาด/note ด้วย ·", () => {
    const r = { ...makeEmptyRow(), lotNo: "L1", exp: "2027-01-01", sizeLabel: "2.5 L", note: "ใหม่" };
    expect(composeSolventNote(r)).toBe("lot L1 · exp 2027-01-01 · ขนาด 2.5 L · ใหม่");
    expect(composeSolventNote({ ...makeEmptyRow() })).toBe("");
  });
});
