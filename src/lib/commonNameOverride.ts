export interface CommonNameOverrideRow {
  _id?: string;
  raw: string;
  canonical: string;
  note?: string;
}

// Match key for comparing against ERP common_name values — guards against
// whitespace and case noise so "DIURON  +  HEXAZINONE" === "diuron + hexazinone".
export function normalizeKey(value: string): string {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function buildOverrideMap(
  rows: CommonNameOverrideRow[] | undefined,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows || []) {
    if (!row || !row.raw || !row.canonical) continue;
    map.set(normalizeKey(row.raw), String(row.canonical).trim());
  }
  return map;
}

// Returns the canonical common_name if an override exists, else the trimmed raw.
export function normalizeCommonName(raw: string, map: Map<string, string>): string {
  const canonical = map.get(normalizeKey(raw));
  return canonical || String(raw || "").trim();
}
