// Pure routing + validation for the printer registry.
// Mirror of the client copy in src/lib/printConfig.ts — keep the map and the
// URL validation rules identical.

const PRINTER_KINDS = ['a4', 'sticker'];

// Which physical printer kind each document type prints to.
const DOC_TYPE_KIND = {
  'sample-label': 'sticker',
  'stock-label': 'sticker',
  'coa': 'a4',
  'service-request': 'a4',
  'daily-check-report': 'a4',
  'goods-receipt': 'a4',
};

const PRINT_DOC_TYPES = Object.keys(DOC_TYPE_KIND);

function kindForDocType(docType) {
  return DOC_TYPE_KIND[docType] || null;
}

// Media/paper size is derived from the document type, never stored per printer.
function paperSizeForSlug(slug) {
  if (slug === 'sample-label') return 'label-100x50';
  if (slug === 'stock-label') return 'label-6x4';
  return 'A4';
}

// Returns an error string, or null when valid.
function validatePrinterInput(input, opts) {
  const requireUrl = !opts || opts.requireUrl !== false;
  const { kind, cupsPrinterUrl } = input || {};
  if (!PRINTER_KINDS.includes(kind)) return 'kind ต้องเป็น a4 หรือ sticker';
  const raw = typeof cupsPrinterUrl === 'string' ? cupsPrinterUrl.trim() : '';
  if (!raw) return requireUrl ? 'ต้องระบุ CUPS printer URL' : null;
  let url;
  try {
    url = new URL(raw);
  } catch (_) {
    return 'CUPS URL ไม่ถูกต้อง';
  }
  if (!['http:', 'https:', 'ipp:', 'ipps:'].includes(url.protocol)) {
    return 'CUPS URL ต้องเป็น http, https, ipp หรือ ipps';
  }
  const parts = url.pathname.split('/').filter(Boolean);
  const qi = parts.findIndex((p) => p === 'printers' || p === 'classes');
  if (qi < 0 || !parts[qi + 1]) {
    return 'CUPS URL ต้องระบุ queue เช่น https://192.168.0.237:631/printers/PRINTER_NAME';
  }
  return null;
}

// Pure: the printer used for a kind — the explicit default, else the first.
function pickDefault(configs, kind) {
  const ofKind = (configs || []).filter((c) => c.kind === kind);
  return ofKind.find((c) => c.isDefault) || ofKind[0] || null;
}

module.exports = {
  PRINTER_KINDS,
  DOC_TYPE_KIND,
  PRINT_DOC_TYPES,
  kindForDocType,
  paperSizeForSlug,
  validatePrinterInput,
  pickDefault,
};
