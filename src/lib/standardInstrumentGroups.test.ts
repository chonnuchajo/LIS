import { describe, it, expect } from "vitest";
import {
  methodCodeToGroup,
  buildSubstanceGroups,
  resolveGroups,
} from "./standardInstrumentGroups";
import type { MethodDoc } from "./methodRegistry";

const method = (over: Partial<MethodDoc>): MethodDoc => ({
  _id: "x", code: "X", label: "X", requiresMachine: false, machinePrefix: "",
  defaultTimes: 1, order: 0, active: true, builtIn: false, ...over,
});

const methodByCode = new Map<string, MethodDoc>([
  ["GC", method({ code: "GC", machinePrefix: "GC", requiresMachine: true, defaultTimes: 3 })],
  ["HPLC", method({ code: "HPLC", machinePrefix: "HPLC", requiresMachine: true, defaultTimes: 1 })],
  ["TITRATION", method({ code: "TITRATION", machinePrefix: "", requiresMachine: false })],
]);

describe("methodCodeToGroup", () => {
  it("maps GC/HPLC by machinePrefix; non-machine/unknown → null", () => {
    expect(methodCodeToGroup("GC", methodByCode)).toBe("gc");
    expect(methodCodeToGroup("HPLC", methodByCode)).toBe("hplc");
    expect(methodCodeToGroup("TITRATION", methodByCode)).toBeNull();
    expect(methodCodeToGroup("NOPE", methodByCode)).toBeNull();
  });
});

describe("buildSubstanceGroups + resolveGroups", () => {
  it("single-substance item → one group", () => {
    const master = [{ item_no: "P1", common_name: "Abamectin 1.8% EC" }];
    const simple = [{ itemNo: "P1", methods: [["GC"]] }];
    const idx = buildSubstanceGroups(master, simple, methodByCode);
    expect(resolveGroups("Abamectin", idx)).toEqual(["gc"]);
  });

  it("same substance in a GC item and an HPLC item → two groups (gc before hplc)", () => {
    const master = [
      { item_no: "P1", common_name: "Atrazine 90% WG" },
      { item_no: "P2", common_name: "Atrazine 50% SC" },
    ];
    const simple = [
      { itemNo: "P1", methods: [["GC"]] },
      { itemNo: "P2", methods: [["HPLC"]] },
    ];
    const idx = buildSubstanceGroups(master, simple, methodByCode);
    expect(resolveGroups("Atrazine", idx)).toEqual(["gc", "hplc"]);
  });

  it("combined 'A + B' item resolves each substance by position", () => {
    const master = [{ item_no: "P1", common_name: "Atrazine + Ametryn" }];
    const simple = [{ itemNo: "P1", methods: [["GC"], ["HPLC"]] }];
    const idx = buildSubstanceGroups(master, simple, methodByCode);
    expect(resolveGroups("Atrazine", idx)).toEqual(["gc"]);
    expect(resolveGroups("Ametryn", idx)).toEqual(["hplc"]);
  });

  it("substance with no simple-method entry → empty", () => {
    const master = [{ item_no: "P1", common_name: "Abamectin 1.8% EC" }];
    const idx = buildSubstanceGroups(master, [], methodByCode);
    expect(resolveGroups("Abamectin", idx)).toEqual([]);
    expect(resolveGroups("Unknown", idx)).toEqual([]);
  });
});
