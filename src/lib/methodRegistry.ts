export type MethodDoc = {
  _id: string;
  code: string;
  label: string;
  requiresMachine: boolean;
  machinePrefix: string;
  defaultTimes: number;
  order: number;
  active: boolean;
  builtIn: boolean;
};

export type MethodInput = {
  code?: string;
  label: string;
  requiresMachine: boolean;
  machinePrefix: string;
  defaultTimes: number;
  order?: number;
  active?: boolean;
};

// One SimpleMethod entry as stored. `methods` is the new positional AND-set field;
// `instruments` is the legacy flat field kept for back-compat reads.
type SimpleMethodEntry = { methods?: string[][]; instruments?: string[] };

// Read a SimpleMethod entry into positional AND-sets, length === substanceCount.
// New `methods` wins; otherwise legacy `instruments` maps string→[string], BOTH/""→[].
export function readSlotMethods(entry: SimpleMethodEntry, substanceCount: number): string[][] {
  let slots: string[][];
  if (Array.isArray(entry.methods)) {
    slots = entry.methods.map((s) => (Array.isArray(s) ? s.filter(Boolean) : []));
  } else if (Array.isArray(entry.instruments)) {
    slots = entry.instruments.map((v) => {
      const t = String(v || '').trim().toUpperCase();
      return t && t !== 'BOTH' ? [t] : [];
    });
  } else {
    slots = [];
  }
  const out: string[][] = [];
  for (let i = 0; i < substanceCount; i += 1) out.push(slots[i] ?? []);
  return out;
}

// Does a machine (by name) satisfy a method? Longer prefixes are tried first so
// "HPLC ..." is not misread as "GC ...". Only machine-backed methods can match.
export function machineMatchesMethod(machineName: string, method: MethodDoc, allMethods: MethodDoc[]): boolean {
  if (!method.requiresMachine || !method.machinePrefix) return false;
  const name = String(machineName || '').trim().toUpperCase();
  const prefixes = allMethods
    .filter((m) => m.requiresMachine && m.machinePrefix)
    .map((m) => m.machinePrefix)
    .sort((a, b) => b.length - a.length);
  const winner = prefixes.find((p) => name.startsWith(p));
  return winner === method.machinePrefix;
}
