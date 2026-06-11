const { zScore, linearRegression, consecutiveStreak } = require('../smartRules');

describe('zScore', () => {
  test('returns null when fewer than 3 values', () => {
    expect(zScore([1, 2], 3)).toBeNull();
  });

  test('returns null when stdev is zero (all same values)', () => {
    expect(zScore([5, 5, 5, 5], 5)).toBeNull();
  });

  test('returns correct zScore for value within normal range', () => {
    const result = zScore([1, 2, 3, 4, 5], 3);
    expect(result).not.toBeNull();
    expect(result.zScore).toBeCloseTo(0, 1);
    expect(result.warning).toBe(false);
  });

  test('returns warning=true for extreme outlier (|z| > 2.5)', () => {
    const result = zScore([1, 2, 3, 4, 5], 10);
    expect(result.warning).toBe(true);
    expect(result.zScore).toBeGreaterThan(2.5);
  });

  test('includes mean and stdev in result', () => {
    const result = zScore([2, 4, 6], 4);
    expect(result.mean).toBeCloseTo(4, 5);
    expect(result.stdev).toBeGreaterThan(0);
  });

  test('filters NaN and returns valid result if enough values remain', () => {
    const result = zScore([1, 2, NaN, 4, 5], 3);
    expect(result).not.toBeNull();
    expect(result.zScore).toBeDefined();
    expect(Number.isFinite(result.zScore)).toBe(true);
  });

  test('filters Infinity and returns valid result if enough values remain', () => {
    const result = zScore([1, 2, Infinity, 4, 5], 3);
    expect(result).not.toBeNull();
    expect(result.zScore).toBeDefined();
    expect(Number.isFinite(result.zScore)).toBe(true);
  });

  test('returns null when targetValue is NaN', () => {
    expect(zScore([1, 2, 3, 4, 5], NaN)).toBeNull();
  });

  test('returns null when targetValue is Infinity', () => {
    expect(zScore([1, 2, 3, 4, 5], Infinity)).toBeNull();
  });

  test('returns null when filtering NaN/Infinity leaves fewer than 3 values', () => {
    expect(zScore([1, 2, NaN, Infinity], 2)).toBeNull();
  });
});

describe('linearRegression', () => {
  test('returns null for fewer than 2 points', () => {
    expect(linearRegression([{ x: 1, y: 2 }])).toBeNull();
  });

  test('returns correct slope for perfectly linear data', () => {
    const result = linearRegression([
      { x: 0, y: 1 },
      { x: 1, y: 3 },
      { x: 2, y: 5 },
      { x: 3, y: 7 },
    ]);
    expect(result.slope).toBeCloseTo(2, 5);
    expect(result.intercept).toBeCloseTo(1, 5);
  });

  test('returns near-zero slope for flat data', () => {
    const result = linearRegression([
      { x: 0, y: 5 },
      { x: 1, y: 5 },
      { x: 2, y: 5 },
    ]);
    expect(Math.abs(result.slope)).toBeLessThan(0.001);
  });

  test('returns null when all x values are the same (degenerate)', () => {
    expect(linearRegression([
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 1, y: 3 },
    ])).toBeNull();
  });
});

describe('consecutiveStreak', () => {
  test('returns 0 when no records', () => {
    expect(consecutiveStreak([], r => r.status === 'fail')).toBe(0);
  });

  test('counts consecutive matching records from start', () => {
    const records = [
      { status: 'fail' },
      { status: 'fail' },
      { status: 'fail' },
      { status: 'pass' },
    ];
    expect(consecutiveStreak(records, r => r.status === 'fail')).toBe(3);
  });

  test('returns 0 when first record does not match', () => {
    const records = [{ status: 'pass' }, { status: 'fail' }];
    expect(consecutiveStreak(records, r => r.status === 'fail')).toBe(0);
  });

  test('returns total count when all records match', () => {
    const records = [
      { status: 'fail' },
      { status: 'fail' },
      { status: 'fail' },
    ];
    expect(consecutiveStreak(records, r => r.status === 'fail')).toBe(3);
  });
});
