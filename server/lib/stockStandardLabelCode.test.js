const {
  buildStandardLabelCodeDefaults,
  formatStandardLabelCode,
  parseStandardLabelCode,
  standardLabelCodePrefix,
} = require('./stockStandardLabelCode');

describe('stockStandardLabelCode', () => {
  test('uses the standard code as a fixed two-character prefix', () => {
    expect(standardLabelCodePrefix('1')).toBe('01');
    expect(standardLabelCodePrefix('01')).toBe('01');
    expect(standardLabelCodePrefix('STD-001')).toBe('01');
  });

  test('formats standard label Code as standard prefix plus Buddhist year and bottle number', () => {
    expect(formatStandardLabelCode('1', 69, 1)).toBe('016901');
    expect(formatStandardLabelCode('01', 69, 2)).toBe('016902');
  });

  test('parses editable year and bottle while rejecting changed standard prefix', () => {
    expect(parseStandardLabelCode('016901', '1')).toEqual({
      labelCode: '016901',
      prefix: '01',
      buddhistYear: 69,
      bottleNo: 1,
    });
    expect(parseStandardLabelCode('026901', '1')).toBeNull();
  });

  test('defaults to the next bottle in the current Buddhist year for that standard', () => {
    const defaults = buildStandardLabelCodeDefaults('1', [
      { labelCode: '016901' },
      { labelCode: '016905' },
      { labelCode: '017001' },
      { labelCode: '026999' },
    ], { count: 2, now: new Date('2026-08-22T00:00:00.000Z') });

    expect(defaults).toEqual({
      prefix: '01',
      buddhistYear: 69,
      nextBottleNo: 6,
      codes: ['016906', '016907'],
    });
  });
});
