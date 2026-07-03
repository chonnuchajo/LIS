import { parseSubstances } from "@/lib/substances";
import type { StandardConfigDoc } from "@/lib/standardConfig";
import type { Petition } from "@/types/petition.types";

export type WeighInstrument = "GC" | "HPLC";

export type WeighTask = {
  key: string;            // `${commonName}|${substance}|${instrument}` — unique per petition
  sampleId: string;       // representative sampleId of the substance group
  commonName: string;     // group commonName (may be a combo "A + B")
  substance: string;      // one parseSubstances() token
  instrument: WeighInstrument;
  times: number | null;   // null → not configured → blocks completion
};

/** Classify a machine by its name; only GC/HPLC consume a standard. */
export function classifyInstrument(machineName: string): WeighInstrument | null {
  const n = String(machineName || "").toUpperCase();
  if (/\bHPLC\b/.test(n)) return "HPLC";
  if (/\bGC\b/.test(n)) return "GC";
  return null;
}

/** Substance override (scope='substance') beats the instrument default (scope='all'). */
export function resolveTimes(
  instrument: string,
  substance: string,
  configs: StandardConfigDoc[],
): number | null {
  const inst = String(instrument || "").toUpperCase();
  const key = String(substance || "").trim().toLowerCase();
  const override = configs.find(
    (c) => c.scope === "substance" && String(c.instrument).toUpperCase() === inst && (c.commonNameLower ?? "") === key,
  );
  if (override) return override.times;
  const def = configs.find((c) => c.scope === "all" && String(c.instrument).toUpperCase() === inst);
  return def ? def.times : null;
}

/** Minimal shape of a per-task weighing draft, enough to evaluate readiness. */
export type WeighDraftState = {
  mode: "fresh" | "working";
  masses: string[];       // raw string inputs
  bottleQrId: string;
  bottleRemaining: number;
  workingQrId: string;
  deductedAt: string | null;
};

/** Is this task's draft complete enough to allow moving on (assign/submit)? */
export function draftReady(task: WeighTask, d: WeighDraftState): boolean {
  if (task.times == null) return false;
  if (d.deductedAt) return true;
  if (d.mode === "working") return !!d.workingQrId;
  const nums = d.masses.map(Number).filter((n) => n > 0);
  if (nums.length !== task.times || !d.bottleQrId) return false;
  return nums.reduce((s, n) => s + n, 0) <= d.bottleRemaining;
}

/**
 * One task per (substance token × distinct GC/HPLC instrument assigned to its group).
 * Groups are keyed by sampleName+commonName; the instrument comes from the machines
 * assigned to that group in petition.assignedMachines. Weigh once per substance per
 * instrument per petition (not per batch), so tasks are de-duplicated by key.
 */
export function buildWeighTasks(petition: Petition, configs: StandardConfigDoc[]): WeighTask[] {
  const items = petition.items ?? [];
  const machines = petition.assignedMachines ?? [];
  const sampleIdOf = (sampleName?: string, commonName?: string): string => {
    const it = items.find((i) => (i.sampleName ?? "") === (sampleName ?? "") && (i.commonName ?? "") === (commonName ?? ""));
    return it?.sampleId || (it ? `${petition.petitionNo}-${it.seq}` : "");
  };

  const seen = new Set<string>();
  const tasks: WeighTask[] = [];
  for (const m of machines) {
    const instrument = classifyInstrument(m.name);
    if (!instrument) continue;
    const commonName = (m.commonName ?? "").trim();
    if (!commonName) continue;
    const substances = parseSubstances(commonName);
    for (const substance of substances) {
      const key = `${commonName}|${substance}|${instrument}`;
      if (seen.has(key)) continue;
      seen.add(key);
      tasks.push({
        key,
        sampleId: sampleIdOf(m.sampleName, m.commonName),
        commonName,
        substance,
        instrument,
        times: resolveTimes(instrument, substance, configs),
      });
    }
  }
  return tasks;
}
