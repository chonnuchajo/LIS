const {
  PRINTER_KINDS,
  DOC_TYPE_KIND,
  PRINT_DOC_TYPES,
  kindForDocType,
  paperSizeForSlug,
  validatePrinterInput,
  pickDefault,
} = require('./printerRouting');

describe('printerRouting kinds/map', () => {
  test('two kinds', () => {
    expect(PRINTER_KINDS).toEqual(['a4', 'sticker']);
  });
  test('all five doc types map to a kind', () => {
    expect(PRINT_DOC_TYPES).toEqual([
      'sample-label', 'stock-label', 'coa', 'service-request', 'daily-check-report', 'goods-receipt',
    ]);
    expect(kindForDocType('sample-label')).toBe('sticker');
    expect(kindForDocType('stock-label')).toBe('sticker');
    expect(kindForDocType('coa')).toBe('a4');
    expect(kindForDocType('service-request')).toBe('a4');
    expect(kindForDocType('daily-check-report')).toBe('a4');
    expect(kindForDocType('goods-receipt')).toBe('a4');
    expect(kindForDocType('nope')).toBeNull();
  });
  test('paper size derives from slug', () => {
    expect(paperSizeForSlug('sample-label')).toBe('label-100x50');
    expect(paperSizeForSlug('stock-label')).toBe('label-6x4');
    expect(paperSizeForSlug('coa')).toBe('A4');
    expect(paperSizeForSlug('anything-else')).toBe('A4');
  });
});

describe('validatePrinterInput', () => {
  const ok = 'https://192.168.0.237:631/printers/HP-A4';
  test('accepts a valid CUPS URL', () => {
    expect(validatePrinterInput({ kind: 'a4', cupsPrinterUrl: ok })).toBeNull();
    expect(validatePrinterInput({ kind: 'sticker', cupsPrinterUrl: 'ipps://host:631/classes/labels' })).toBeNull();
  });
  test('rejects bad kind', () => {
    expect(validatePrinterInput({ kind: 'a3', cupsPrinterUrl: ok })).toMatch(/kind/);
  });
  test('rejects missing url when required', () => {
    expect(validatePrinterInput({ kind: 'a4', cupsPrinterUrl: '' })).toMatch(/CUPS printer URL/);
  });
  test('allows empty url when requireUrl false', () => {
    expect(validatePrinterInput({ kind: 'a4', cupsPrinterUrl: '' }, { requireUrl: false })).toBeNull();
  });
  test('rejects non-url', () => {
    expect(validatePrinterInput({ kind: 'a4', cupsPrinterUrl: 'not a url' })).toMatch(/ไม่ถูกต้อง/);
  });
  test('rejects wrong protocol', () => {
    expect(validatePrinterInput({ kind: 'a4', cupsPrinterUrl: 'ftp://host/printers/x' })).toMatch(/http/);
  });
  test('rejects url with no queue', () => {
    expect(validatePrinterInput({ kind: 'a4', cupsPrinterUrl: 'https://192.168.0.237:631/' })).toMatch(/queue/);
  });
});

describe('pickDefault', () => {
  const list = [
    { id: '1', kind: 'a4', isDefault: false },
    { id: '2', kind: 'a4', isDefault: true },
    { id: '3', kind: 'sticker', isDefault: false },
  ];
  test('returns the explicit default of the kind', () => {
    expect(pickDefault(list, 'a4').id).toBe('2');
  });
  test('falls back to the first of the kind when none flagged', () => {
    expect(pickDefault(list, 'sticker').id).toBe('3');
  });
  test('null when kind absent or list empty', () => {
    expect(pickDefault(list, 'nope')).toBeNull();
    expect(pickDefault([], 'a4')).toBeNull();
    expect(pickDefault(undefined, 'a4')).toBeNull();
  });
});
