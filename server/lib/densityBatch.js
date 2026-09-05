// Pure helper for matching a petition batch number to a Result-Density row's
// "Sample name". DMA exports can store either the batch itself or a product
// name followed by the batch, often with a DMA repeat suffix like "-P1".
// Avoid matching short numeric tail segments such as "009" inside
// "26S-FPN5-GMP-009".

function extractDensityBatch(sampleName) {
  if (sampleName == null) return null;
  const token = String(sampleName).trim();
  return token || null;
}

function stripBatchPrefix(value) {
  return value.replace(/^B\./i, '');
}

function sameBatch(left, right) {
  const a = String(left || '').trim().toUpperCase();
  const b = String(right || '').trim().toUpperCase();
  return a === b || stripBatchPrefix(a) === stripBatchPrefix(b);
}

function trailingCandidates(sampleName) {
  const sample = String(sampleName || '').trim();
  if (!sample) return [];
  const tokens = sample.split(/\s+/).filter(Boolean);
  const last = tokens[tokens.length - 1] || '';
  const previous = tokens[tokens.length - 2] || '';
  const candidates = [];

  if (tokens.length > 1) candidates.push({ value: last, repeatSuffix: false });

  const compactRepeat = last.match(/^(.+)-P\d+$/i);
  if (compactRepeat) candidates.push({ value: compactRepeat[1], repeatSuffix: true });

  if (/^P\d+$/i.test(last) && previous) candidates.push({ value: previous, repeatSuffix: true });

  return candidates;
}

function batchMatches(petitionBatchNo, sampleName) {
  const b = petitionBatchNo == null ? '' : String(petitionBatchNo).trim();
  if (!b) return false;
  const x = extractDensityBatch(sampleName);
  if (!x) return false;
  if (sameBatch(x, b)) return true;

  const numericOnly = /^\d+$/.test(b);
  return trailingCandidates(x).some((candidate) => {
    if (!sameBatch(candidate.value, b)) return false;
    return !numericOnly || candidate.repeatSuffix || /^B\./i.test(candidate.value);
  });
}

module.exports = { extractDensityBatch, batchMatches };
