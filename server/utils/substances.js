// MUST stay in sync with src/lib/substances.ts. Same algorithm, no transpile.
function parseSubstances(commonName) {
  const value = String(commonName || '');
  const parts = value.split('+').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  if (parts.length <= 2) return parts;

  while (parts.length > 2) {
    let shortestIdx = 0;
    for (let i = 1; i < parts.length; i += 1) {
      if (parts[i].length < parts[shortestIdx].length) shortestIdx = i;
    }
    let neighborIdx;
    if (shortestIdx === 0) neighborIdx = 1;
    else if (shortestIdx === parts.length - 1) neighborIdx = shortestIdx - 1;
    else neighborIdx = parts[shortestIdx - 1].length <= parts[shortestIdx + 1].length
      ? shortestIdx - 1
      : shortestIdx + 1;

    const lo = Math.min(shortestIdx, neighborIdx);
    const hi = Math.max(shortestIdx, neighborIdx);
    const merged = `${parts[lo]} + ${parts[hi]}`;
    parts.splice(lo, hi - lo + 1, merged);
  }
  return parts;
}

function substanceKey(value) {
  return String(value || '').trim().toLowerCase();
}

function extractSubstanceName(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  return trimmed.split(/\s+/)[0] || '';
}

module.exports = { parseSubstances, substanceKey, extractSubstanceName };
