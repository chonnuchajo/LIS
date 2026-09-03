// Pure helper for matching a petition batch number to a Result-Density row's
// "Sample name". Matching is exact against the whole Sample name value,
// ignoring letter case because DMA exports may use mixed-case product codes.

function extractDensityBatch(sampleName) {
  if (sampleName == null) return null;
  const token = String(sampleName).trim();
  return token || null;
}

function batchMatches(petitionBatchNo, sampleName) {
  const b = petitionBatchNo == null ? '' : String(petitionBatchNo).trim();
  if (!b) return false;
  const x = extractDensityBatch(sampleName);
  if (!x) return false;
  return x.toUpperCase() === b.toUpperCase();
}

module.exports = { extractDensityBatch, batchMatches };
