// resolve กลุ่มเครื่อง (gc/hplc) ของสาร จาก simple method — reverse index
// join master-items (commonName) + simple-methods (method code ราย-ตำแหน่งสาร).
// ไม่มี field group ที่ StockStandard: simple method เป็น source of truth ตัวเดียว.
import { readSlotMethods, type MethodDoc } from "./methodRegistry";
import { parseSubstances, matchSubstanceKey } from "./substances";
import { getItemNo, getRawCommonName } from "./masterItemFields";

export type InstrumentGroup = "gc" | "hplc";

type SimpleMethodEntry = { itemNo: string; methods?: string[][]; instruments?: string[] };
type MasterItemRaw = Record<string, unknown>;

// method code → group ผ่าน machinePrefix (machine-backed เท่านั้น). อื่น → null.
export function methodCodeToGroup(
  code: string,
  methodByCode: Map<string, MethodDoc>,
): InstrumentGroup | null {
  const method = methodByCode.get(code);
  if (!method || !method.requiresMachine) return null;
  const prefix = String(method.machinePrefix || "").trim().toUpperCase();
  if (prefix === "HPLC") return "hplc";
  if (prefix === "GC") return "gc";
  return null;
}

// build: matchSubstanceKey(สาร) → Set<group> รวมทุกสินค้า.
export function buildSubstanceGroups(
  masterItems: MasterItemRaw[],
  simpleMethods: SimpleMethodEntry[],
  methodByCode: Map<string, MethodDoc>,
): Map<string, Set<InstrumentGroup>> {
  const itemNoToEntry = new Map<string, SimpleMethodEntry>();
  simpleMethods.forEach((entry) => {
    if (entry.itemNo) itemNoToEntry.set(String(entry.itemNo).trim(), entry);
  });

  const index = new Map<string, Set<InstrumentGroup>>();
  masterItems.forEach((item) => {
    const commonName = getRawCommonName(item);
    if (!commonName) return;
    const entry = itemNoToEntry.get(getItemNo(item));
    if (!entry) return;
    const substances = parseSubstances(commonName);
    const slots = readSlotMethods(entry, substances.length);
    substances.forEach((name, i) => {
      const key = matchSubstanceKey(name);
      if (!key) return;
      (slots[i] ?? []).forEach((code) => {
        const group = methodCodeToGroup(code, methodByCode);
        if (!group) return;
        let set = index.get(key);
        if (!set) { set = new Set<InstrumentGroup>(); index.set(key, set); }
        set.add(group);
      });
    });
  });
  return index;
}

// lookup — คืน gc ก่อน hplc เพื่อความ deterministic.
export function resolveGroups(
  name: string,
  index: Map<string, Set<InstrumentGroup>>,
): InstrumentGroup[] {
  const set = index.get(matchSubstanceKey(name));
  if (!set) return [];
  return (["gc", "hplc"] as InstrumentGroup[]).filter((g) => set.has(g));
}
