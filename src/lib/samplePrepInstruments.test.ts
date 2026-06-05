import { describe, it, expect } from "vitest";
import {
  SAMPLE_PREP_INSTRUMENTS,
  SAMPLE_PREP_ROOM_SLUG,
  samplePrepGroups,
  getSamplePrepInstrument,
} from "./samplePrepInstruments";

describe("samplePrepInstruments catalog", () => {
  it("targets the sample-prep room", () => {
    expect(SAMPLE_PREP_ROOM_SLUG).toBe("sample-prep");
  });

  it("has 13 instruments with unique ids", () => {
    expect(SAMPLE_PREP_INSTRUMENTS).toHaveLength(13);
    const ids = SAMPLE_PREP_INSTRUMENTS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has 8 basic instruments with no readings", () => {
    const basic = SAMPLE_PREP_INSTRUMENTS.filter((i) => i.group === "basic");
    expect(basic).toHaveLength(8);
    for (const i of basic) expect(i.readings).toHaveLength(0);
  });

  it("has 4 temp instruments each with one temp reading", () => {
    const temp = SAMPLE_PREP_INSTRUMENTS.filter((i) => i.group === "temp");
    expect(temp).toHaveLength(4);
    for (const i of temp) {
      expect(i.readings).toHaveLength(1);
      expect(i.readings[0].key).toBe("temp");
      expect(i.readings[0].unit).toBe("°C");
    }
  });

  it("has 1 ph instrument with a ph reading", () => {
    const ph = SAMPLE_PREP_INSTRUMENTS.filter((i) => i.group === "ph");
    expect(ph).toHaveLength(1);
    expect(ph[0].id).toBe("LD-011");
    expect(ph[0].readings[0].key).toBe("ph");
  });

  it("getSamplePrepInstrument resolves by id", () => {
    expect(getSamplePrepInstrument("LD-009")?.name).toBe("Hot Air Oven");
    expect(getSamplePrepInstrument("nope")).toBeUndefined();
  });

  it("every instrument belongs to a declared group", () => {
    const keys = samplePrepGroups.map((g) => g.key);
    for (const i of SAMPLE_PREP_INSTRUMENTS) expect(keys).toContain(i.group);
  });
});
