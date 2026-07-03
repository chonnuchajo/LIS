import { describe, it, expect } from "vitest";
import { classifyInstrument, resolveTimes, buildWeighTasks } from "./standardWeighing";
import type { StandardConfigDoc } from "./standardConfig";

const cfg = (p: Partial<StandardConfigDoc>): StandardConfigDoc => ({
  _id: Math.random().toString(36).slice(2),
  instrument: "GC", scope: "all", commonName: null, commonNameLower: null,
  times: 1, isDefault: false, note: "", ...p,
});

const GC_DEFAULT = cfg({ instrument: "GC", scope: "all", times: 3, isDefault: true });
const HPLC_DEFAULT = cfg({ instrument: "HPLC", scope: "all", times: 1, isDefault: true });

describe("classifyInstrument", () => {
  it("reads GC / HPLC from machine name", () => {
    expect(classifyInstrument("GC 7890A")).toBe("GC");
    expect(classifyInstrument("HPLC 1260 1")).toBe("HPLC");
    expect(classifyInstrument("เครื่องชั่งดิจิตอล")).toBeNull();
  });
});

describe("resolveTimes", () => {
  it("uses instrument default when no substance override", () => {
    expect(resolveTimes("GC", "Abamectin", [GC_DEFAULT, HPLC_DEFAULT])).toBe(3);
  });
  it("substance override beats default (case-insensitive)", () => {
    const override = cfg({ instrument: "GC", scope: "substance", commonName: "Abamectin", commonNameLower: "abamectin", times: 5 });
    expect(resolveTimes("GC", "abamectin", [GC_DEFAULT, override])).toBe(5);
  });
  it("returns null when no config for the instrument", () => {
    expect(resolveTimes("GC", "Abamectin", [])).toBeNull();
  });
});

describe("buildWeighTasks", () => {
  const petition: any = {
    _id: "p1", petitionNo: "P-1",
    items: [{ seq: 1, sampleName: "S1", commonName: "Abamectin", batchNo: "B1", sampleId: "P-1-1" }],
    assignedMachines: [{ machineId: "m1", code: "LD-003", name: "GC 7890A", sampleName: "S1", commonName: "Abamectin" }],
  };

  it("builds one task per substance x instrument with resolved times", () => {
    const tasks = buildWeighTasks(petition, [GC_DEFAULT, HPLC_DEFAULT]);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ commonName: "Abamectin", substance: "Abamectin", instrument: "GC", times: 3, sampleId: "P-1-1" });
    expect(tasks[0].key).toBe("Abamectin|Abamectin|GC");
  });

  it("splits a combo commonName into per-substance tasks on the assigned instrument", () => {
    const p2: any = {
      _id: "p2", petitionNo: "P-2",
      items: [{ seq: 1, sampleName: "S", commonName: "2,4-D + Butachlor", batchNo: "B", sampleId: "P-2-1" }],
      assignedMachines: [{ machineId: "m", code: "LD-003", name: "GC 7890A", sampleName: "S", commonName: "2,4-D + Butachlor" }],
    };
    const tasks = buildWeighTasks(p2, [GC_DEFAULT, HPLC_DEFAULT]);
    expect(tasks.map((t) => t.substance)).toEqual(["2,4-D", "Butachlor"]);
    expect(tasks.every((t) => t.instrument === "GC" && t.times === 3)).toBe(true);
  });

  it("ignores substances with no GC/HPLC machine assigned", () => {
    const p3: any = { _id: "p3", petitionNo: "P-3",
      items: [{ seq: 1, sampleName: "S", commonName: "Water", batchNo: "B", sampleId: "P-3-1" }],
      assignedMachines: [] };
    expect(buildWeighTasks(p3, [GC_DEFAULT, HPLC_DEFAULT])).toEqual([]);
  });
});
