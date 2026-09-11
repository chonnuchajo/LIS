// Pure helper for deriving and matching the Batch column shown on
// /density-results. DMA "Sample name" can be the batch itself or product name
// followed by batch, often with repeat/position suffixes like "-P1" or "TOP".

function stripRepeatSuffix(value) {
  return value.replace(/-P\d+$/i, '');
}

function stripBatchPrefix(value) {
  return value.replace(/^B\./i, '');
}

function normalizeBatch(value) {
  return stripBatchPrefix(stripRepeatSuffix(String(value || '').trim())).toUpperCase();
}

function sameBatch(left, right) {
  const a = normalizeBatch(left);
  const b = normalizeBatch(right);
  return !!a && !!b && a === b;
}

function batchLikeToken(value) {
  const token = String(value || '').trim();
  if (!token || token.includes('%')) return false;
  return /\d/.test(token) || /^B\./i.test(token) || token.includes('-');
}

function extractDensityBatch(sampleName) {
  if (sampleName == null) return null;
  const sample = String(sampleName).trim();
  if (!sample) return null;
  const tokens = sample.split(/\s+/).filter(Boolean);

  if (tokens.length === 1) return stripRepeatSuffix(tokens[0]) || null;

  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    const token = tokens[i];
    if (/^P\d+$/i.test(token) && i > 0) {
      const previous = stripRepeatSuffix(tokens[i - 1]);
      if (batchLikeToken(previous)) return previous;
      continue;
    }

    const candidate = stripRepeatSuffix(token);
    if (batchLikeToken(candidate)) return candidate;
  }

  return sample;
}

function densityBatchForRow(rowOrSampleName) {
  if (rowOrSampleName && typeof rowOrSampleName === 'object') {
    const row = rowOrSampleName;
    const explicitBatch = row.Batch ?? row.batch;
    if (explicitBatch != null && String(explicitBatch).trim() !== '') {
      return String(explicitBatch).trim();
    }
    return extractDensityBatch(row['Sample name']);
  }
  return extractDensityBatch(rowOrSampleName);
}

function withDensityBatch(row) {
  const batch = densityBatchForRow(row);
  return { ...row, Batch: batch || '' };
}

function batchMatches(petitionBatchNo, rowOrSampleName) {
  const b = petitionBatchNo == null ? '' : String(petitionBatchNo).trim();
  if (!b) return false;
  const x = densityBatchForRow(rowOrSampleName);
  if (!x) return false;
  return sameBatch(x, b);
}

module.exports = { extractDensityBatch, densityBatchForRow, withDensityBatch, batchMatches };
