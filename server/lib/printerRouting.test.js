const {
  PRINTER_KINDS,
  DOC_TYPE_KIND,
  PRINT_DOC_TYPES,
  kindForDocType,
  paperSizeForSlug,
  normalizePrinterAddress,
  printerTargetFromAddress,
  validatePrinterInput,
  pickDefault,
} = require('./printerRouting');

describe('printerRouting kinds/map', () => {
  test('two kinds', () => {
    expect(PRINTER_KINDS).toEqual(['a4', 'sticker']);
  });
  test('all six doc types map to a kind', () => {
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
    expect(validatePrinterInput({ kind: 'a4', cupsPrinterUrl: '' })).toMatch(/Printer IP \/ URL/);
  });
  test('allows empty url when requireUrl false', () => {
    expect(validatePrinterInput({ kind: 'a4', cupsPrinterUrl: '' }, { requireUrl: false })).toBeNull();
  });
  test('rejects non-url and non-host input', () => {
    expect(validatePrinterInput({ kind: 'a4', cupsPrinterUrl: 'not a url' })).toMatch(/ไม่ถูกต้อง/);
  });
  test('rejects wrong protocol', () => {
    expect(validatePrinterInput({ kind: 'a4', cupsPrinterUrl: 'ftp://host/printers/x' })).toMatch(/http/);
  });
  test('accepts url with no queue as direct URL', () => {
    expect(validatePrinterInput({ kind: 'a4', cupsPrinterUrl: 'https://192.168.0.237:631/' })).toBeNull();
  });
});

describe('printer address normalization', () => {
  test('accepts direct printer IP and host', () => {
    expect(validatePrinterInput({ kind: 'sticker', cupsPrinterUrl: '192.168.1.50' })).toBeNull();
    expect(validatePrinterInput({ kind: 'a4', cupsPrinterUrl: 'printer.local' })).toBeNull();
  });

  test('normalizes bare values to IPP endpoint', () => {
    expect(normalizePrinterAddress('192.168.1.50')).toBe('ipp://192.168.1.50:631/ipp/print');
    expect(normalizePrinterAddress('printer.local')).toBe('ipp://printer.local:631/ipp/print');
    expect(normalizePrinterAddress('192.168.1.50:632')).toBe('ipp://192.168.1.50:632/ipp/print');
  });

  test('keeps full CUPS and IPP URLs intact', () => {
    expect(normalizePrinterAddress('http://cups:631/printers/Zebra')).toBe('http://cups:631/printers/Zebra');
    expect(normalizePrinterAddress('ipps://printer.local:631/ipp/print')).toBe('ipps://printer.local:631/ipp/print');
  });

  test('resolves target uri for CUPS and direct IPP', () => {
    expect(printerTargetFromAddress('http://cups:631/printers/Zebra')).toEqual({
      printerUri: 'ipp://cups:631/printers/Zebra',
      display: 'http://cups:631/printers/Zebra',
      isDirect: false,
    });
    expect(printerTargetFromAddress('192.168.1.50')).toEqual({
      printerUri: 'ipp://192.168.1.50:631/ipp/print',
      display: '192.168.1.50',
      isDirect: true,
    });
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
