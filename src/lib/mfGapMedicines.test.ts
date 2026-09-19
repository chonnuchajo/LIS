import { describe, expect, it } from "vitest";
import { buildMfGapMedicineRows } from "./mfGapMedicines";

describe("buildMfGapMedicineRows", () => {
  it("keeps medicine items with MF_Lasted - MF_Before at least 30 days", () => {
    const rows = buildMfGapMedicineRows(
      [
        { item_no: "F-KEEP", item_name1: "ยาเว้นผลิต", common_name: "Medicine A" },
        { item_no: "R-KEEP", item_name1: "วัตถุดิบเว้นผลิต", common_name: "Medicine B" },
        { item_no: "F-SHORT", item_name1: "ยาเว้นผลิตสั้น" },
        { item_no: "A-DROP", item_name1: "ไม่ใช่ยา" },
      ],
      [
        { item_no: "F-KEEP", create_date: "2026-07-01" },
        { item_no: "R-KEEP", create_date: "2026-07-10" },
        { item_no: "F-SHORT", create_date: "2026-08-01" },
        { item_no: "A-DROP", create_date: "2026-07-01" },
      ],
      [
        { item_no: "F-KEEP", create_date: "2026-08-01" },
        { item_no: "R-KEEP", create_date: "2026-08-09" },
        { item_no: "F-SHORT", create_date: "2026-08-15" },
        { item_no: "A-DROP", create_date: "2026-08-05" },
      ],
    );

    expect(rows.map((row) => row.itemNo)).toEqual(["F-KEEP", "R-KEEP"]);
    expect(rows[0]).toMatchObject({ itemName: "ยาเว้นผลิต", commonName: "Medicine A", mfGapDays: 31 });
    expect(rows[1]).toMatchObject({ itemName: "วัตถุดิบเว้นผลิต", commonName: "Medicine B", mfGapDays: 30 });
  });
});
