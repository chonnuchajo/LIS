// Pure helpers for matching a petition batch number to a Result-Density row's
// "Sample name". The trailing batch number is the segment after the last "-",
// taken from the core token up to the first whitespace or "(" — so position
// suffixes (" TOP"/" bottom"), layer markers ("(B)") and re-sample suffixes
// ("(B)-2") are all ignored (e.g. "26S-ANF18+PPN36-006(B)-2" -> "006").

function extractDensityBatch(sampleName) {
  if (sampleName == null) return null;
  const token = String(sampleName).trim().split(/[\s(]/)[0] || '';
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
