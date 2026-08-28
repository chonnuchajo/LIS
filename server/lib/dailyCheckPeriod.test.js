const { describe, expect, test } = require('@jest/globals');
const { getDailyCheckPeriod } = require('./dailyCheckPeriod');

describe('getDailyCheckPeriod', () => {
  test.each([
    ['2026-08-28T08:00:00', 'morning'],
    ['2026-08-28T12:00:00', 'morning'],
    ['2026-08-28T13:00:00', 'afternoon'],
    ['2026-08-28T17:00:00', 'afternoon'],
  ])('returns %s period as %s', (iso, period) => {
    expect(getDailyCheckPeriod(new Date(iso))).toBe(period);
  });

  test.each([
    '2026-08-28T07:59:00',
    '2026-08-28T12:30:00',
    '2026-08-28T17:30:00',
  ])('returns null outside allowed periods for %s', (iso) => {
    expect(getDailyCheckPeriod(new Date(iso))).toBeNull();
  });
});
