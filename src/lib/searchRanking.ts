type SearchFields = { primary?: readonly unknown[]; secondary?: readonly unknown[] };

function scoreFields(query: string, values: readonly unknown[] = []): number {
  let best = 0;
  for (const value of values) {
    const text = String(value ?? "").trim().toLowerCase();
    const position = text.indexOf(query);
    const score = position < 0 ? 0 : text === query ? 3 : position === 0 ? 2 : 1 / (Array.from(text.slice(0, position)).length + 1);
    best = Math.max(best, score);
  }
  return best;
}

export function getSearchScore(query: string, fields: SearchFields): number {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return 0;
  const primaryScore = scoreFields(normalized, fields.primary);
  return primaryScore ? 3 + primaryScore : scoreFields(normalized, fields.secondary);
}

export function rankSearchResults<Item>(
  items: readonly Item[],
  query: string,
  getFields: (item: Item) => SearchFields,
): Item[] {
  if (!query.trim()) return [...items];
  return items
    .map((item) => ({ item, score: getSearchScore(query, getFields(item)) }))
    .sort((left, right) => right.score - left.score)
    .map(({ item }) => item);
}
