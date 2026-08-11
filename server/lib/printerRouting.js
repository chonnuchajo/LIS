// Pure routing + validation for the printer registry.
// Mirror of the client copy in src/lib/printConfig.ts — keep the map and the
// URL validation rules identical.

const PRINTER_KINDS = ['a4', 'sticker'];
const URL_PROTOCOLS = ['http:', 'https:', 'ipp:', 'ipps:'];
const HOST_WITH_OPTIONAL_PORT = /^[A-Za-z0-9.-]+(?::\d{1,5})?$/;

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

function hasUrlProtocol(raw) {
  return /^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(raw);
}

function normalizePrinterAddress(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (hasUrlProtocol(raw)) return raw;
  if (!HOST_WITH_OPTIONAL_PORT.test(raw)) throw new Error('Printer IP / URL ไม่ถูกต้อง');
  const parsed = new URL(`ipp://${raw}`);
  if (!parsed.port) parsed.port = '631';
  parsed.pathname = '/ipp/print';
  return parsed.toString();
}

function printerTargetFromAddress(value) {
  const raw = String(value || '').trim();
  const normalized = normalizePrinterAddress(raw);
  const url = new URL(normalized);
  const parts = url.pathname.split('/').filter(Boolean);
  const qi = parts.findIndex((p) => p === 'printers' || p === 'classes');
  const hasQueue = qi >= 0 && parts[qi + 1];
  const protocol = url.protocol === 'https:' ? 'ipps:' : url.protocol === 'http:' ? 'ipp:' : url.protocol;
  return { printerUri: `${protocol}//${url.host}${url.pathname}`, display: raw || normalized, isDirect: !hasQueue };
}

// Returns an error string, or null when valid.
function validatePrinterInput(input, opts) {
  const requireUrl = !opts || opts.requireUrl !== false;
  const { kind, cupsPrinterUrl } = input || {};
  if (!PRINTER_KINDS.includes(kind)) return 'kind ต้องเป็น a4 หรือ sticker';
  const raw = typeof cupsPrinterUrl === 'string' ? cupsPrinterUrl.trim() : '';
  if (!raw) return requireUrl ? 'ต้องระบุ Printer IP / URL' : null;
  let url;
  try {
    url = new URL(normalizePrinterAddress(raw));
  } catch (_) {
    return 'Printer IP / URL ไม่ถูกต้อง';
  }
  if (!URL_PROTOCOLS.includes(url.protocol)) {
    return 'Printer IP / URL ต้องเป็น IP เครื่องปริ้น, http, https, ipp หรือ ipps';
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
  normalizePrinterAddress,
  printerTargetFromAddress,
  validatePrinterInput,
  pickDefault,
};
