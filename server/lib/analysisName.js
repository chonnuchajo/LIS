const FORMULATION_SUFFIXES = new Set([
  'CS', 'DP', 'EC', 'EW', 'FS', 'GR', 'ME', 'OD', 'SC', 'SG', 'SL', 'SP', 'TC', 'TK', 'ULV', 'WDG', 'WG', 'WP',
]);

function normalizeAnalysisName(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

function canonicalAnalysisName(value) {
  return normalizeAnalysisName(value)
    .split('+')
    .map((part) => {
      const tokens = part.trim().split(/\s+/).filter(Boolean);
      while (tokens.length > 1 && FORMULATION_SUFFIXES.has(tokens[tokens.length - 1].replace(/\.$/, ''))) {
        tokens.pop();
      }
      return tokens.join(' ');
    })
    .filter(Boolean)
    .sort()
    .join('+');
}

if (require.main === module) {
  const assert = require('assert');
  assert.strictEqual(
    canonicalAnalysisName('PROPANIL 36% + ANILOFOS 18% W/V EC'),
    canonicalAnalysisName('ANILOFOS 18% W/V +PROPANIL 36% EC'),
  );
  assert.strictEqual(canonicalAnalysisName('ABAMECTIN 1.8% EC'), canonicalAnalysisName('ABAMECTIN 1.8%'));
}

module.exports = { normalizeAnalysisName, canonicalAnalysisName };
