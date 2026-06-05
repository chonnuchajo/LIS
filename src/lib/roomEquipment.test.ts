import { describe, it, expect } from "vitest";
import { getRoomCatalog, ROOM_CATALOGS } from "./roomEquipment";
import { getRoomBySlug } from "./dailyCheckRooms";

describe("roomEquipment registry", () => {
  it("registers sample-prep, analysis, extraction catalogs", () => {
    for (const slug of ["sample-prep", "analysis", "extraction"]) {
      const cat = getRoomCatalog(slug);
      expect(cat).toBeDefined();
      expect(cat!.slug).toBe(slug);
      expect(getRoomBySlug(slug)).toBeDefined();
    }
  });

  it("returns undefined for unknown slug", () => {
    expect(getRoomCatalog("nope")).toBeUndefined();
  });

  it("every instrument's group is declared in its catalog groups", () => {
    for (const cat of Object.values(ROOM_CATALOGS)) {
      const keys = cat.groups.map((g) => g.key);
      for (const inst of cat.instruments) expect(keys).toContain(inst.group);
    }
  });
});

describe("analysis catalog", () => {
  const cat = getRoomCatalog("analysis")!;
  it("has 7 instruments with unique ids", () => {
    expect(cat.instruments).toHaveLength(7);
    const ids = cat.instruments.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("has 3 GC and 4 HPLC instruments, each with 3 readings", () => {
    const gc = cat.instruments.filter((i) => i.group === "gc");
    const hplc = cat.instruments.filter((i) => i.group === "hplc");
    expect(gc).toHaveLength(3);
    expect(hplc).toHaveLength(4);
    for (const i of cat.instruments) expect(i.readings).toHaveLength(3);
  });
});

describe("extraction catalog", () => {
  const cat = getRoomCatalog("extraction")!;
  it("has 10 instruments with unique ids", () => {
    expect(cat.instruments).toHaveLength(10);
    const ids = cat.instruments.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("has 4 status-only (no readings) and 6 temp instruments", () => {
    const basic = cat.instruments.filter((i) => i.group === "basic");
    const temp = cat.instruments.filter((i) => i.group === "temp");
    expect(basic).toHaveLength(4);
    for (const i of basic) expect(i.readings).toHaveLength(0);
    expect(temp).toHaveLength(6);
    for (const i of temp) {
      expect(i.readings).toHaveLength(1);
      expect(i.readings[0].key).toBe("temp");
      expect(i.readings[0].unit).toBe("°C");
    }
  });
});
