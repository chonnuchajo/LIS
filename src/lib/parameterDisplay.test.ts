import { describe, expect, it } from "vitest";
import { FIELD_TYPE_META, SCOPE_LABEL, summarizeOptionFilter } from "@/lib/parameterDisplay";

describe("parameterDisplay", () => {
  it("FIELD_TYPE_META ครบทุกชนิด field", () => {
    for (const key of ["text", "number", "float", "enum", "timer", "photo", "file", "reference"] as const) {
      expect(FIELD_TYPE_META[key].label).toBeTruthy();
      expect(FIELD_TYPE_META[key].Icon).toBeTruthy();
    }
    expect(SCOPE_LABEL.qc).toBe("QC");
    expect(SCOPE_LABEL.lab).toBe("Lab");
  });

  it("summarizeOptionFilter: ว่าง/undefined → ''", () => {
    expect(summarizeOptionFilter(undefined)).toBe("");
    expect(summarizeOptionFilter({})).toBe("");
  });

  it("summarizeOptionFilter: itemNames เกิน 2 ตัด +N", () => {
    expect(summarizeOptionFilter({ itemNames: ["A", "B", "C"] })).toBe("item: A/B+1");
  });

  it("summarizeOptionFilter: resolve ชื่อกลุ่มผ่าน map", () => {
    const map = new Map([["g1", "กลุ่มน้ำ"]]);
    expect(summarizeOptionFilter({ itemGroups: ["g1"] }, map)).toBe("กลุ่ม: กลุ่มน้ำ");
  });
});
