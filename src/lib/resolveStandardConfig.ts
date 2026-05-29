import { parseSubstances, substanceKey } from "./substances";
import type {
  InstrumentConfig,
  StandardConfigDoc,
  StandardOverrideDoc,
} from "@/pages/standardConfig/types";

export type ResolveResult = {
  name: string;
  gc: InstrumentConfig;
  hplc: InstrumentConfig;
  source: "override" | "base" | "none";
};

const EMPTY: InstrumentConfig = { enabled: false, unit: "ml", slots: [] };

function pickByTier(
  overrides: StandardOverrideDoc[],
  predicate: (o: StandardOverrideDoc) => boolean,
): StandardOverrideDoc | null {
  const matches = overrides.filter(predicate);
  if (matches.length === 0) return null;
  matches.sort((a, b) => b.priority - a.priority);
  return matches[0];
}

function overrideToResult(o: StandardOverrideDoc, fallbackName: string): ResolveResult {
  return { name: o.matchValue || fallbackName, gc: o.gc, hplc: o.hplc, source: "override" };
}

// NOTE: StandardOverrideDoc.scope (substanceOnly | wholeCommonName) is intentionally
// not consumed by this lookup in Phase 1 — every matched override returns the same
// {gc, hplc} regardless. Scope drives Phase 2 stock-deduction semantics: it tells
// the deduction engine whether an override applies to only the matched substance
// position or to every substance in the commonName. Keep the field flowing through
// the schema + UI; honour it when stock deduction is wired up.
export function resolveStandardConfig(
  commonName: string,
  substanceIndex: number,
  configs: StandardConfigDoc[],
  overrides: StandardOverrideDoc[],
): ResolveResult {
  const substances = parseSubstances(commonName);
  const substance = substances[substanceIndex] || "";
  const commonLower = commonName.trim().toLowerCase();
  const substanceLower = substanceKey(substance);

  // Tier 1: exact commonName match
  const cnHit = pickByTier(
    overrides,
    (o) => o.matchType === "commonName" && o.matchValueLower === commonLower,
  );
  if (cnHit) return overrideToResult(cnHit, substance);

  // Tier 2: substring in commonName (case-insensitive)
  const subHit = pickByTier(
    overrides,
    (o) => o.matchType === "substring" && commonLower.includes(o.matchValueLower),
  );
  if (subHit) return overrideToResult(subHit, substance);

  // Tier 3: exact substance match at substanceIndex
  const subsHit = pickByTier(
    overrides,
    (o) => o.matchType === "substance" && o.matchValueLower === substanceLower,
  );
  if (subsHit) return overrideToResult(subsHit, substance);

  // Tier 4: base config
  const base = configs.find((c) => c.nameLower === substanceLower);
  if (base) {
    return { name: base.name, gc: base.gc, hplc: base.hplc, source: "base" };
  }

  return { name: substance, gc: EMPTY, hplc: EMPTY, source: "none" };
}
