import { describe, it, expect } from "vitest";
import {
  makeEmptyRow,
  validateRow,
  buildBottles,
  composeSolventNote,
  findReceiveScanMatch,
  applyReceiveScanMatch,
  applyReceiveBarcodeRegistration,
  sanitizeDecimalInput,
  sanitizeIntegerInput,
} from "./receiveCart.helpers";

describe("receiveCart.helpers", () => {
  it("makeEmptyRow คืนแถวว่าง category=null", () => {
    const r = makeEmptyRow();
    expect(r.category).toBeNull();
    expect(r.itemId).toBe("");
    expect(r.type).toBe("primary");
    expect(r.count).toBe("1");
    expect(r.purity).toBe("");
    expect(r.qty).toBe("1");
    expect(r.sizeLiter).toBe("");
    expect(r.price).toBe("");
    expect(r.sameExp).toBe(true);
  });

  it("validateRow: ยังไม่เลือกของ → error", () => {
    expect(validateRow(makeEmptyRow())).toBe("ยังไม่ได้เลือกของ");
  });

  it("validateRow: standard ต้องมี size>0 แบบทศนิยมไม่เกิน 4 และ count เป็นจำนวนเต็มบวก", () => {
    const base = { ...makeEmptyRow(), category: "standard" as const, itemId: "s1" };
    expect(validateRow({ ...base, sizeMl: "0" })).toBe("ปริมาณต้องเป็นตัวเลข และทศนิยมไม่เกิน 4 ตำแหน่ง");
    expect(validateRow({ ...base, sizeMl: "1.12345" })).toBe("ปริมาณต้องเป็นตัวเลข และทศนิยมไม่เกิน 4 ตำแหน่ง");
    expect(validateRow({ ...base, sizeMl: "1mg" })).toBe("ปริมาณต้องเป็นตัวเลข และทศนิยมไม่เกิน 4 ตำแหน่ง");
    expect(validateRow({ ...base, sizeMl: "100", count: "0" })).toBe("จำนวนขวดต้องเป็นจำนวนเต็มบวก");
    expect(validateRow({ ...base, sizeMl: "100", count: "2", type: "primary", lotNo: "L1", commonExp: "2027-01-01" })).toContain("% Purity");
    expect(validateRow({ ...base, sizeMl: "100.1234", count: "2", type: "primary", lotNo: "L1", purity: "99.5", commonExp: "2027-01-01" })).toBeNull();
  });

  it("validateRow: scanned standard defaults to primary type before receive", () => {
    const scanned = {
      ...makeEmptyRow(),
      category: "standard" as const,
      itemId: "s1",
      itemCode: "STD-001",
      itemName: "Standard A",
      sizeMl: "100",
      count: "1",
      lotNo: "L1",
      commonExp: "2027-01-01",
      purity: "99.5",
      lotNo: "L1",
    };

    expect(scanned.type).toBe("primary");
    expect(validateRow(scanned)).toBeNull();
  });

  it("validateRow: standard receive requires Lot No and EXP", () => {
    const base = { ...makeEmptyRow(), category: "standard" as const, itemId: "s1", type: "primary" as const, sizeMl: "100", count: "2", purity: "99.5" };
    expect(validateRow({ ...base, lotNo: "", commonExp: "2027-01-01" })).toContain("Lot No");
    expect(validateRow({ ...base, lotNo: "L1", sameExp: true, commonExp: "" })).toContain("EXP");
    expect(validateRow({ ...base, lotNo: "L1", sameExp: false, perExp: ["2027-01-01", ""] })).toContain("EXP");
  });

  it("validateRow: solvent/glassware ต้อง qty เป็นจำนวนเต็มบวก", () => {
    const sol = {
      ...makeEmptyRow(),
      category: "solvent" as const,
      itemId: "x",
      qty: "0",
      sizeLiter: "2.5",
      price: "1200",
      lotNo: "L1",
      exp: "2027-01-01",
    };
    expect(validateRow(sol)).toBe("จำนวนต้องเป็นจำนวนเต็มบวก");
    expect(validateRow({ ...sol, qty: "3" })).toBeNull();
  });

  it("validateRow: solvent receive requires Lot No, EXP, size and price but glassware does not", () => {
    const solvent = { ...makeEmptyRow(), category: "solvent" as const, itemId: "sol1", qty: "1", sizeLiter: "2.5", price: "1200" };
    expect(validateRow({ ...solvent, lotNo: "", exp: "2027-01-01" })).toContain("Lot No");
    expect(validateRow({ ...solvent, lotNo: "L1", exp: "" })).toContain("EXP");
    expect(validateRow({ ...solvent, lotNo: "L1", exp: "2027-01-01", sizeLiter: "" })).toBe("กรุณาระบุขนาด/ขวด");
    expect(validateRow({ ...solvent, lotNo: "L1", exp: "2027-01-01", sizeLiter: "0" })).toBe("ขนาด/ขวดไม่ถูกต้อง");
    expect(validateRow({ ...solvent, lotNo: "L1", exp: "2027-01-01", price: "" })).toBe("กรุณาระบุราคา");
    expect(validateRow({ ...solvent, lotNo: "L1", exp: "2027-01-01", price: "-1" })).toBe("ราคาไม่ถูกต้อง");

    const glassware = { ...makeEmptyRow(), category: "glassware" as const, itemId: "g1", qty: "1" };
    expect(validateRow(glassware)).toBeNull();
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

  it("buildBottles: per-bottle exp สั้นกว่า count → เติม undefined ให้ครบ", () => {
    const r = { ...makeEmptyRow(), count: "3", sameExp: false, perExp: ["2027-01-01"] };
    expect(buildBottles(r)).toEqual([{ exp: "2027-01-01" }, { exp: undefined }, { exp: undefined }]);
  });

  it("buildBottles: ไม่แนบ photoUrls แม้มีข้อมูลรูปค้างอยู่", () => {
    const r = {
      ...makeEmptyRow(),
      count: "2",
      sameExp: false,
      perExp: ["2027-01-01", "2027-02-02"],
      perPhotoUrls: [["/LIS/uploads/qc-photos/a.webp"], []],
    } as ReturnType<typeof makeEmptyRow> & { perPhotoUrls: string[][] };
    expect(buildBottles(r)).toEqual([
      { exp: "2027-01-01" },
      { exp: "2027-02-02" },
    ]);
  });

  it("composeSolventNote: รวม lot/exp/ขนาด/ราคา/note ด้วย ·", () => {
    const r = { ...makeEmptyRow(), lotNo: "L1", exp: "2027-01-01", sizeLiter: "2.5", price: "1200", note: "ใหม่" };
    expect(composeSolventNote(r)).toBe("lot L1 · exp 2027-01-01 · ขนาด 2.5 L · ราคา 1200 บาท · ใหม่");
    expect(composeSolventNote({ ...makeEmptyRow() })).toBe("");
  });


  it("findReceiveScanMatch: matches barcode by exact standard code", () => {
    const match = findReceiveScanMatch(" STD-001\n", [
      { category: "standard", id: "s1", code: "STD-001", name: "Standard A", label: "STD-001 Standard A" },
    ]);

    expect(match).toEqual({ category: "standard", id: "s1", code: "STD-001", name: "Standard A", label: "STD-001 Standard A" });
  });

  it("findReceiveScanMatch: matches solvent names case-insensitively", () => {
    const match = findReceiveScanMatch("methanol", [
      { category: "solvent", id: "sol1", code: "", name: "Methanol", label: "Methanol" },
    ]);

    expect(match?.id).toBe("sol1");
  });

  it("findReceiveScanMatch: matches registered barcode aliases", () => {
    const match = findReceiveScanMatch(" 654694 ", [
      { category: "standard", id: "std1", code: "STD-001", name: "Standard A", label: "STD-001 Standard A", barcodes: ["654694"] },
    ]);

    expect(match?.id).toBe("std1");
  });

  it("findReceiveScanMatch: searches by partial code/name when Enter is used in barcode box", () => {
    const match = findReceiveScanMatch("dard a", [
      { category: "standard", id: "std1", code: "STD-001", name: "Standard A", label: "STD-001 Standard A", barcodes: [] },
    ]);

    expect(match?.id).toBe("std1");
  });

  it("findReceiveScanMatch: does not partial-match unknown numeric barcodes", () => {
    const match = findReceiveScanMatch("123", [
      { category: "standard", id: "std1", code: "STD-001", name: "Standard A", label: "STD-001 Standard A", barcodes: ["0012345"] },
    ]);

    expect(match).toBeNull();
  });

  it("sanitize inputs keep only decimal or integer digits", () => {
    expect(sanitizeDecimalInput("1a2.34567 mg", 4)).toBe("12.3456");
    expect(sanitizeIntegerInput("1.2 ขวด")).toBe("12");
  });

  it("applyReceiveBarcodeRegistration: fills the first empty row after popup selection", () => {
    const empty = makeEmptyRow();
    const existing = { ...makeEmptyRow(), category: "solvent" as const, itemId: "sol1", itemName: "Methanol" };

    const rows = applyReceiveBarcodeRegistration([existing, empty], " 654694 ", {
      category: "standard",
      id: "std1",
      code: "STD-001",
      name: "Standard A",
      label: "STD-001 Standard A",
    });

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ barcode: "654694", category: "standard", itemId: "std1", itemCode: "STD-001", type: "primary" });
  });

  it("applyReceiveScanMatch: adds scanned items above existing rows", () => {
    const empty = makeEmptyRow();
    const existing = { ...makeEmptyRow(), category: "solvent" as const, itemId: "sol1", itemName: "Methanol" };

    const rows = applyReceiveScanMatch([existing, empty], {
      category: "standard", id: "std1", code: "STD-001", name: "Standard A", label: "STD-001 Standard A",
    });

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ category: "standard", itemId: "std1", itemName: "Standard A", itemCode: "STD-001", type: "primary" });
    expect(rows[1].itemId).toBe("sol1");
  });

  it("applyReceiveScanMatch: scanning 1, 2, 3 displays as 3, 2, 1", () => {
    const one = { category: "standard" as const, id: "std1", code: "STD-001", name: "Standard 1", label: "STD-001 Standard 1" };
    const two = { category: "standard" as const, id: "std2", code: "STD-002", name: "Standard 2", label: "STD-002 Standard 2" };
    const three = { category: "standard" as const, id: "std3", code: "STD-003", name: "Standard 3", label: "STD-003 Standard 3" };

    const rows = [one, two, three].reduce((acc, option) => applyReceiveScanMatch(acc, option), [makeEmptyRow()]);

    expect(rows.map((row) => row.itemId)).toEqual(["std3", "std2", "std1"]);
  });
});
