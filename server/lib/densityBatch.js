// Pure helpers for matching a petition batch number to a Result-Density row's
// "Sample name". The trailing batch number is the segment after the last "-",
// taken from the first whitespace-delimited token (so " TOP"/" bottom" suffixes
// are ignored).

function extractDensityBatch(sampleName) {
  if (sampleName == null) return null;
  const token = String(sampleName).trim().split(/\s+/)[0] || '';
  if (!token) return null;
  if (token.includes('-')) {
    const seg = token.slice(token.lastIndexOf('-') + 1);
    return seg || null;
  }
  return token;
}

function batchMatches(petitionBatchNo, sampleName) {
  const b = petitionBatchNo == null ? '' : String(petitionBatchNo).trim();
  if (!b) return false;
  const x = extractDensityBatch(sampleName);
  if (!x) return false;
  if (x === b) return true;
  if (/^\d+$/.test(x) && /^\d+$/.test(b)) return parseInt(x, 10) === parseInt(b, 10);
  return false;
}

module.exports = { extractDensityBatch, batchMatches };
