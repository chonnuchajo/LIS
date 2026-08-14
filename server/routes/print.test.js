jest.mock('../models/PrinterConfig', () => ({
  findById: jest.fn(),
  find: jest.fn(),
}));

const mockExecute = jest.fn((operation, message, callback) => {
  callback(null, { statusCode: 'successful-ok' });
});

jest.mock('ipp', () => ({
  Printer: jest.fn(() => ({ execute: mockExecute })),
}));

const mockPage = {
  setJavaScriptEnabled: jest.fn().mockResolvedValue(undefined),
  setRequestInterception: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
  setContent: jest.fn().mockResolvedValue(undefined),
  setViewport: jest.fn().mockResolvedValue(undefined),
  $$: jest.fn().mockResolvedValue([
    { boundingBox: jest.fn().mockResolvedValue({ x: 0, y: 0, width: 246, height: 95 }) },
  ]),
  screenshot: jest.fn().mockResolvedValue(Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde,
  ])),
  pdf: jest.fn().mockResolvedValue(undefined),
};

const mockBrowser = {
  newPage: jest.fn().mockResolvedValue(mockPage),
  close: jest.fn().mockResolvedValue(undefined),
};

jest.mock('puppeteer-core', () => ({
  launch: jest.fn().mockResolvedValue(mockBrowser),
}));

const printRoute = require('./print');

describe('printHtmlJob label raster routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    process.env.PRINT_CHROME_PATH = __filename;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('prints stock labels through the PNG label path', async () => {
    await printRoute.__private.printHtmlJob({
      docType: 'stock-label',
      html: '<div class="stock-label-page">STOCK</div>',
      copiesOverride: 1,
      printerConfig: { cupsPrinterUrl: 'http://cups.local:631/printers/label' },
    });

    expect(mockPage.$$).toHaveBeenCalledWith('.stock-label-page');
    expect(mockPage.setViewport).toHaveBeenCalledWith({
      width: 286,
      height: 134,
      deviceScaleFactor: expect.closeTo(519 / 246, 4),
    });
    expect(mockPage.pdf).not.toHaveBeenCalled();
    expect(mockPage.screenshot).toHaveBeenCalledTimes(1);
    expect(mockExecute).toHaveBeenCalledWith(
      'Print-Job',
      expect.objectContaining({
        'operation-attributes-tag': expect.objectContaining({
          'document-format': 'image/png',
        }),
      }),
      expect.any(Function),
    );
  });

  test('builds sticker test print HTML as a stock label page', () => {
    const html = printRoute.__private.testPrintHtml({
      kind: 'sticker',
      label: 'Label Printer',
      cupsPrinterUrl: 'http://cups.local:631/printers/label',
    });

    expect(html).toContain('class="stock-label-page"');
    expect(html).toContain('width:65mm');
    expect(html).toContain('height:25mm');
  });
});
