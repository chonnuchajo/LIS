const mockPdf = jest.fn(async () => Buffer.from('%PDF-test'));
const mockClose = jest.fn();
const mockPage = { setJavaScriptEnabled: jest.fn(), setRequestInterception: jest.fn(), on: jest.fn(), setContent: jest.fn(), pdf: mockPdf };
jest.mock('puppeteer-core', () => ({ launch: async () => ({ newPage: async () => mockPage, close: mockClose }) }));
const PrinterConfig = require('../models/PrinterConfig');
const handler = require('./print').stack.find(layer => layer.route?.path === '/pdf').route.stack[0].handle;
test('Validation PDF has page totals and does not query physical printer settings', async () => {
  const oldPath = process.env.PRINT_CHROME_PATH;
  process.env.PRINT_CHROME_PATH = __filename;
  const find = jest.spyOn(PrinterConfig, 'find').mockImplementation(() => { throw new Error('Unexpected printer lookup'); });
  const res = { setHeader: jest.fn(), send: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() };
  try {
    await handler({ body: { docType: 'method-validation', html: '<main>QA report</main>' } }, res);
    expect(find).not.toHaveBeenCalled();
    expect(mockPdf).toHaveBeenCalledWith(expect.objectContaining({ format: 'A4', displayHeaderFooter: true, footerTemplate: expect.stringContaining('totalPages') }));
    expect(mockPage.setJavaScriptEnabled).toHaveBeenCalledWith(false);
    expect(res.send).toHaveBeenCalledWith(Buffer.from('%PDF-test'));
    expect(mockClose).toHaveBeenCalled();
  } finally { find.mockRestore(); if (oldPath === undefined) delete process.env.PRINT_CHROME_PATH; else process.env.PRINT_CHROME_PATH = oldPath; }
});

test('Validation repeats the document header with space reserved above report content', async () => {
  const oldPath = process.env.PRINT_CHROME_PATH;
  process.env.PRINT_CHROME_PATH = __filename;
  const res = { setHeader: jest.fn(), send: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() };
  try {
    await handler({ body: { docType: 'method-validation', html: '<html><head></head><body><header class="document-running"><table><tr><td>QA analyte</td></tr></table></header><main>Results</main></body></html>' } }, res);
    expect(mockPdf).toHaveBeenLastCalledWith(expect.objectContaining({ headerTemplate: expect.stringContaining('QA analyte') }));
    expect(mockPage.setContent).toHaveBeenLastCalledWith(expect.stringContaining('@page{margin:42mm 15mm 15mm}'), expect.any(Object));
    expect(mockPage.setContent.mock.calls.at(-1)[0]).not.toContain('document-running');
    expect(res.send).toHaveBeenCalled();
  } finally { if (oldPath === undefined) delete process.env.PRINT_CHROME_PATH; else process.env.PRINT_CHROME_PATH = oldPath; }
});
