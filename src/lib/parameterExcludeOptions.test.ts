import { describe, expect, it } from "vitest";

import { buildParameterExcludeOptions } from "./parameterExcludeOptions";
import type { ParameterItem } from "./api";

const items = [
  {
    item_no: "RM-001",
    item_name1: "Water EC RM",
    common_name: "EC",
    inventory_posting_group: "RM",
  },
  {
    item_no: "FG-001",
    item_name1: "Water EC FG",
    common_name: "EC",
    inventory_posting_group: "FG",
  },
  {
    item_no: "RM-002",
    item_name1: "Water SC RM",
    common_name: "SC",
    inventory_posting_group: "RM",
  },
  {
    item_no: "RM-003",
    item_name1: "Powder WP RM",
    common_name: "WP",
    inventory_posting_group: "RM",
  },
];

const groupMembership = new Map([
  ["RM-001", ["g-water"]],
]);

function build(form: Partial<ParameterItem>) {
  return buildParameterExcludeOptions({
    form,
    masterItems: items,
    groupMembership,
  });
}

describe("buildParameterExcludeOptions — ต้องใช้กฎ 'ใช้กับ' ชุดเดียวกับหน้ากรอกผล", () => {
  // หมวดหมู่เป็นประตู AND: RM + RO ต้องเหลือเฉพาะ RM ที่รหัสขึ้นต้น RO ไม่ใช่ RM ทั้งหมด
  it("narrows by category AND subCategory instead of OR-ing them", () => {
    const masterItems = [
      { item_no: "RO-0001", item_name1: "RO item", inventory_posting_group: "RM" },
      { item_no: "ROPH-0002", item_name1: "ROPH item", inventory_posting_group: "RM" },
      { item_no: "RI-0003", item_name1: "RI item", inventory_posting_group: "RM" },
      { item_no: "F-0004", item_name1: "FG item", inventory_posting_group: "FG" },
    ];
    const out = buildParameterExcludeOptions({
      form: { categories: ["RM"], subCategories: ["RO"] },
      masterItems,
    });
    expect(out.itemNames.values).toEqual(["RO item", "ROPH item"]);
  });

  it("treats a category with no subCategory as the whole category", () => {
    const masterItems = [
      { item_no: "RO-0001", item_name1: "RO item", inventory_posting_group: "RM" },
      { item_no: "RI-0003", item_name1: "RI item", inventory_posting_group: "RM" },
      { item_no: "F-0004", item_name1: "FG item", inventory_posting_group: "FG" },
    ];
    const out = buildParameterExcludeOptions({
      form: { categories: ["RM"] },
      masterItems,
    });
    expect(out.itemNames.values).toEqual(["RI item", "RO item"]);
  });
});

describe("buildParameterExcludeOptions", () => {
  it("limits exclusions to items inside the included product type", () => {
    const result = build({ productTypes: ["water"] });

    expect(result.itemNames.values).toEqual(["Water EC FG", "Water EC RM", "Water SC RM"]);
    expect(result.commonNames.values).toEqual(["EC", "SC"]);
    expect(result.productTypes.show).toBe(false);
    expect(result.categories.values).toEqual(["FG", "RM"]);
    expect(result.itemGroups.values).toEqual(["g-water"]);
  });

  it("shows item names for an included common name and hides product type when it is only water", () => {
    const result = build({ commonNames: ["EC"] });

    expect(result.itemNames.values).toEqual(["Water EC FG", "Water EC RM"]);
    expect(result.productTypes.show).toBe(false);
    expect(result.categories.values).toEqual(["FG", "RM"]);
    expect(result.commonNames.show).toBe(false);
  });

  it("uses all master items when applyAll is selected", () => {
    const result = build({ applyAll: true });

    expect(result.commonNames.values).toEqual(["EC", "SC", "WP"]);
    expect(result.productTypes.values).toEqual(["powder", "water"]);
    expect(result.productTypes.show).toBe(true);
  });

  it("hides dimensions that do not narrow the current matched set", () => {
    const result = build({ commonNames: ["SC"] });

    expect(result.categories.show).toBe(false);
    expect(result.itemGroups.show).toBe(false);
    expect(result.itemNames.show).toBe(true);
  });

});
