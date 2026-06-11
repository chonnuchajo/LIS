/**
 * zScore — compare targetValue against historical values
 * Returns null if fewer than 3 values or zero variance.
 * Result includes { mean, stdev, zScore, warning } where warning = |z| > 2.5
 */
function zScore(values, targetValue) {
  if (!Array.isArray(values) || values.length < 3) return null;

  // Sanitize: filter out NaN/Infinity from input array
  const sanitized = values.filter(v => Number.isFinite(v));
  if (sanitized.length < 3) return null;

  // Reject if targetValue is NaN or Infinity
  if (!Number.isFinite(targetValue)) return null;

  const n = sanitized.length;
  const mean = sanitized.reduce((a, b) => a + b, 0) / n;
  const variance = sanitized.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
  const stdev = Math.sqrt(variance);
  if (stdev === 0) return null;
  const z = (targetValue - mean) / stdev;
  return { mean, stdev, zScore: z, warning: Math.abs(z) > 2.5 };
}

/**
 * linearRegression — least-squares fit over [{x, y}] pairs
 * Returns null if fewer than 2 points or degenerate x values.
 * Result includes { slope, intercept }
 */
function linearRegression(xyPairs) {
  if (!Array.isArray(xyPairs) || xyPairs.length < 2) return null;
  const n = xyPairs.length;
  const sumX = xyPairs.reduce((s, p) => s + p.x, 0);
  const sumY = xyPairs.reduce((s, p) => s + p.y, 0);
  const sumXY = xyPairs.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = xyPairs.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

/**
 * consecutiveStreak — count how many records from index 0 match predicate
 * Records should be sorted newest-first (index 0 = most recent).
 */
function consecutiveStreak(records, predicate) {
  let streak = 0;
  for (const record of records) {
    if (predicate(record)) streak++;
    else break;
  }
  return streak;
}

module.exports = { zScore, linearRegression, consecutiveStreak };
