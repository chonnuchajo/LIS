import { describe, expect, it } from "vitest";
import { addMfDateFields, appendMfDateNote, mergeMfItemRows } from "./mfItemDates";

describe("mergeMfItemRows", () => {
  it("sorts distinct create_date values and picks previous and latest dates", () => {
    const result = mergeMfItemRows(
      [
        { item_id: "A", create_date: "2026-09-12T00:00:00Z", note: "historical 2" },
        { item_id: "A", create_date: "2026-09-10T00:00:00Z", note: "historical 1" },
      ],
      [{ item_id: "A", create_date: "2026-09-14T00:00:00Z", note: "current" }],
    );

    expect(result).toEqual([
      {
        item_id: "A",
        create_date: "2026-09-14T00:00:00Z",
        note: "current",
        MF_Before: "2026-09-12",
        MF_Lasted: "2026-09-14",
      },
    ]);
  });

  it("returns null MF_Before when item has only one date", () => {
    const result = mergeMfItemRows([], [
      { item_id: "B", create_date: "2026-09-14T00:00:00Z", note: "current only" },
    ]);

    expect(result[0]).toMatchObject({
      MF_Before: null,
      MF_Lasted: "2026-09-14",
    });
  });

  it("returns null dates when neither API has create_date for the item", () => {
    const result = mergeMfItemRows(
      [{ item_id: "C", note: "historical without date" }],
      [{ item_id: "C", note: "current without date" }],
    );

    expect(result).toEqual([
      {
        item_id: "C",
        note: "current without date",
        MF_Before: null,
        MF_Lasted: null,
      },
    ]);
  });

  it("keeps historical-only rows and deduplicates repeated dates before calculating", () => {
    const result = mergeMfItemRows(
      [
        { item_no: "D", create_date: "2026-09-12T00:00:00Z", prod_order_no: "MF-2" },
        { item_no: "D", create_date: "2026-09-12T00:00:00Z", prod_order_no: "MF-2-DUP" },
        { item_no: "D", create_date: "2026-09-10T00:00:00Z", prod_order_no: "MF-1" },
      ],
      [],
    );

    expect(result).toHaveLength(3);
    expect(result.every((row) => row.MF_Before === "2026-09-10")).toBe(true);
    expect(result.every((row) => row.MF_Lasted === "2026-09-12")).toBe(true);
  });

  it("does not mutate API source rows", () => {
    const historical = [{ item_id: "E", create_date: "2026-09-10" }];
    const current = [{ item_id: "E", create_date: "2026-09-14" }];

    mergeMfItemRows(historical, current);

    expect(historical).toEqual([{ item_id: "E", create_date: "2026-09-10" }]);
    expect(current).toEqual([{ item_id: "E", create_date: "2026-09-14" }]);
  });
});

describe("appendMfDateNote", () => {
  it("adds MF dates into existing additional info", () => {
    expect(appendMfDateNote("MF: F-NADNG-15", {
      MF_Before: "2026-09-12",
      MF_Lasted: "2026-09-14",
    })).toBe("MF: F-NADNG-15 | MF_Before: 2026-09-12 | MF_Lasted: 2026-09-14");
  });

  it("uses dash for missing MF dates", () => {
    expect(appendMfDateNote("", { MF_Before: null, MF_Lasted: null })).toBe("MF_Before: - | MF_Lasted: -");
  });
});

describe("addMfDateFields", () => {
  it("adds MF dates to existing target rows matched by item key", () => {
    const result = addMfDateFields(
      [
        { item_no: "F-NADNG-15", item_name1: "นาแดน-จี" },
        { item_no: "NO-DATE", item_name1: "ไม่มีวันที่" },
      ],
      [{ item_no: "F-NADNG-15", create_date: "2026-09-12T00:00:00Z" }],
      [{ item_no: "F-NADNG-15", create_date: "2026-09-14T00:00:00Z" }],
    );

    expect(result).toEqual([
      {
        item_no: "F-NADNG-15",
        item_name1: "นาแดน-จี",
        MF_Before: "2026-09-12",
        MF_Lasted: "2026-09-14",
      },
      {
        item_no: "NO-DATE",
        item_name1: "ไม่มีวันที่",
        MF_Before: null,
        MF_Lasted: null,
      },
    ]);
  });
});
