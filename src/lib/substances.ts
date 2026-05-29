// Split a commonName into its component substances by "+", merging short
// fragments (3+ parts) down to at most 2 substances. Used by Petition Assign,
// Master Items (Simple Method tab), and Standard Config to keep positional
// instrument arrays aligned across the app.
export function parseSubstances(commonName: string): string[] {
  const parts = commonName.split("+").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return [commonName.trim()].filter(Boolean);
  if (parts.length <= 2) return parts;

  while (parts.length > 2) {
    let shortestIdx = 0;
    for (let i = 1; i < parts.length; i += 1) {
      if (parts[i].length < parts[shortestIdx].length) shortestIdx = i;
    }
    let neighborIdx: number;
    if (shortestIdx === 0) neighborIdx = 1;
    else if (shortestIdx === parts.length - 1) neighborIdx = shortestIdx - 1;
    else
      neighborIdx =
        parts[shortestIdx - 1].length <= parts[shortestIdx + 1].length
          ? shortestIdx - 1
          : shortestIdx + 1;

    const lo = Math.min(shortestIdx, neighborIdx);
    const hi = Math.max(shortestIdx, neighborIdx);
    const merged = `${parts[lo]} + ${parts[hi]}`;
    parts.splice(lo, hi - lo + 1, merged);
  }
  return parts;
}

export function substanceKey(value: string): string {
  return value.trim().toLowerCase();
}

// Take the first whitespace-separated token. Used to reduce a product spec
// like "ABAMECTIN 1.8% W/V EC (BROWN)" to its active substance "ABAMECTIN".
// Used after parseSubstances() splits on "+".
export function extractSubstanceName(raw: string): string {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0] || "";
}
