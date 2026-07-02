import type { MethodDoc } from './methodRegistry';

// One substance slot within a commonName group: its name + the AND-set of
// method codes required for it (positional, aligned to parseSubstances()).
export type SubstanceSlotLike = {
  name: string;
  methods: string[];
};

// A machine-backed method shared by one or more substances in a group.
export type GroupMachineMethod = {
  code: string;              // method code, e.g. "GC"
  method: MethodDoc;         // resolved registry method (requiresMachine === true)
  substanceNames: string[];  // substances in the group requiring this method
};

// Collapse a group's per-substance machine-backed methods into one entry per
// distinct method code. GC on two substances → a single entry whose
// substanceNames lists both. Bench (non-machine), unknown, and empty codes are
// excluded — the page handles those as per-substance signals. First-seen code
// order is preserved so the UI is stable.
export function groupMachineMethods(
  slots: SubstanceSlotLike[],
  methodByCode: Map<string, MethodDoc>,
): GroupMachineMethod[] {
  const order: string[] = [];
  const byCode = new Map<string, GroupMachineMethod>();
  slots.forEach((slot) => {
    slot.methods.forEach((code) => {
      const method = methodByCode.get(code);
      if (!method || !method.requiresMachine) return;
      let entry = byCode.get(code);
      if (!entry) {
        entry = { code, method, substanceNames: [] };
        byCode.set(code, entry);
        order.push(code);
      }
      if (slot.name && !entry.substanceNames.includes(slot.name)) {
        entry.substanceNames.push(slot.name);
      }
    });
  });
  return order.map((code) => byCode.get(code)!);
}
